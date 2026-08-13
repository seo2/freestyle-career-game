// The music sequencer (Fase 8). Plays the placeholder loops of src/data/music.ts.
//
// Two things drive the design:
//
//  * LOOKAHEAD SCHEDULING, not a timer per note. A setInterval that fires one note
//    at a time drifts audibly within seconds, because timer callbacks are not
//    sample-accurate. So a slow timer wakes up and schedules every step falling
//    inside a short window ahead of the audio clock, and the audio clock — never
//    Date.now — decides when they sound. This is also why the frozen clock in the
//    trace harness cannot desync the music.
//  * NOISE WITHOUT Math.random. The drums are noise bursts, and the project bans
//    Math.random (traces must be reproducible). The buffer is filled from a small
//    seeded generator instead, so every run gets byte-identical noise.
//
// Never throws: like the rest of the audio layer, a browser that refuses is a
// silent game, not a broken one.

import { AudioConfig } from "../data/config/AudioConfig";
import {
  loopSeconds,
  musicTracks,
  noteHz,
  stepSeconds,
  type DrumVoice,
  type MusicTrack,
  type MusicTrackId,
} from "../data/music";

// Deterministic white noise: an LCG, the same shape RandomService uses, so the
// drums are identical on every run and Math.random is never touched.
function fillNoise(data: Float32Array): void {
  let seed = 0x2545f491;
  for (let i = 0; i < data.length; i += 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    data[i] = (seed / 0xffffffff) * 2 - 1;
  }
}

export class MusicPlayer {
  private ctx: AudioContext | null = null;
  private bus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private current: MusicTrackId | null = null;
  // Audio-clock time of the next step still to be scheduled.
  private nextStepAt = 0;
  private step = 0;
  private volume = 1;

  // Everything scheduled, so a track change can silence it instead of leaving the
  // old loop ringing under the new one.
  private live: { osc: OscillatorNode | AudioBufferSourceNode; gain: GainNode }[] = [];

  attach(ctx: AudioContext, destination: AudioNode): void {
    if (this.ctx) return;
    try {
      this.ctx = ctx;
      this.bus = ctx.createGain();
      this.bus.gain.value = this.volume;
      this.bus.connect(destination);
      const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate);
      fillNoise(buffer.getChannelData(0));
      this.noise = buffer;
    } catch {
      this.ctx = null;
      this.bus = null;
    }
  }

  playing(): MusicTrackId | null {
    return this.current;
  }

  setVolume(value: number): void {
    this.volume = value;
    if (this.bus) this.bus.gain.value = value;
  }

  // Switches loops. Called with null for the screens that are better silent — a
  // dilemma reads louder with the music out from under it.
  play(id: MusicTrackId | null): void {
    if (id === this.current) return;
    this.stop();
    this.current = id;
    if (!id || !this.ctx || !this.bus) return;
    this.step = 0;
    this.nextStepAt = this.ctx.currentTime + AudioConfig.music.startDelay;
    // An OfflineAudioContext has no timers and reports "suspended" until it is
    // rendered, so it drives itself through renderWindow() instead.
    if (typeof setInterval === "function" && this.ctx.state !== "closed") {
      this.timer = setInterval(() => this.tick(), AudioConfig.music.tickMs);
    }
    // One tick immediately, so the loop starts on the beat instead of after the
    // first timer interval.
    this.tick();
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.current = null;
    for (const voice of this.live) {
      try {
        voice.gain.gain.cancelScheduledValues(0);
        voice.gain.gain.value = 0;
        voice.osc.stop();
      } catch {
        // Already stopped, or a node that never started. Nothing to do.
      }
    }
    this.live = [];
  }

  // Schedules every step that falls inside the lookahead window.
  private tick(): void {
    const ctx = this.ctx;
    const id = this.current;
    if (!ctx || !id || ctx.state !== "running") return;
    const track = musicTracks[id];
    const horizon = ctx.currentTime + AudioConfig.music.lookaheadSeconds;
    let guard = 0;
    while (this.nextStepAt < horizon && guard < AudioConfig.music.maxStepsPerTick) {
      guard += 1;
      this.scheduleStep(track, this.step % track.steps, this.nextStepAt);
      this.nextStepAt += stepSeconds(track);
      this.step += 1;
    }
    // Drop finished voices so a long session cannot grow the list forever.
    if (this.live.length > AudioConfig.music.maxLiveVoices) {
      this.live = this.live.slice(-AudioConfig.music.maxLiveVoices);
    }
  }

  private scheduleStep(track: MusicTrack, step: number, at: number): void {
    for (const [voice, steps] of Object.entries(track.drums) as [DrumVoice, number[]][]) {
      if (steps.includes(step)) this.drum(voice, at, track.gain);
    }
    const seconds = stepSeconds(track);
    for (const [start, semis, length] of track.bass) {
      if (start === step) this.tone("triangle", noteHz(track, semis), at, length * seconds * 0.9, track.gain * 0.9);
    }
    for (const [start, semis, length] of track.keys) {
      if (start === step) this.tone("square", noteHz(track, semis), at, length * seconds * 0.8, track.gain * 0.28);
    }
  }

  // A pitched note with a soft attack, so the loop sits under the game instead of
  // poking at it.
  private tone(wave: OscillatorType, freq: number, at: number, seconds: number, gain: number): void {
    const ctx = this.ctx;
    const bus = this.bus;
    if (!ctx || !bus) return;
    try {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = wave;
      osc.frequency.value = freq;
      const attack = Math.min(AudioConfig.music.noteAttack, seconds / 3);
      env.gain.setValueAtTime(AudioConfig.envelope.releaseFloor, at);
      env.gain.linearRampToValueAtTime(gain, at + attack);
      env.gain.exponentialRampToValueAtTime(AudioConfig.envelope.releaseFloor, at + seconds);
      osc.connect(env);
      env.connect(bus);
      osc.start(at);
      osc.stop(at + seconds);
      this.live.push({ osc, gain: env });
    } catch {
      // A voice that cannot be built is a silent beat, never a crash.
    }
  }

  // Drums, synthesized: the kick is a pitch sweep, everything else is filtered
  // noise. No samples means nothing to load and nothing to be missing.
  private drum(voice: DrumVoice, at: number, trackGain: number): void {
    const ctx = this.ctx;
    const bus = this.bus;
    if (!ctx || !bus) return;
    const cfg = AudioConfig.music.drums[voice];
    try {
      if (voice === "kick") {
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(cfg.from, at);
        osc.frequency.exponentialRampToValueAtTime(cfg.to, at + cfg.seconds);
        env.gain.setValueAtTime(cfg.gain * trackGain, at);
        env.gain.exponentialRampToValueAtTime(AudioConfig.envelope.releaseFloor, at + cfg.seconds);
        osc.connect(env);
        env.connect(bus);
        osc.start(at);
        osc.stop(at + cfg.seconds);
        this.live.push({ osc, gain: env });
        return;
      }
      if (!this.noise) return;
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      const filter = ctx.createBiquadFilter();
      filter.type = voice === "snare" ? "bandpass" : "highpass";
      filter.frequency.value = cfg.from;
      const env = ctx.createGain();
      env.gain.setValueAtTime(cfg.gain * trackGain, at);
      env.gain.exponentialRampToValueAtTime(AudioConfig.envelope.releaseFloor, at + cfg.seconds);
      src.connect(filter);
      filter.connect(env);
      env.connect(bus);
      src.start(at);
      src.stop(at + cfg.seconds);
      this.live.push({ osc: src, gain: env });
    } catch {
      // Same contract as tone(): a missing beat, never a crash.
    }
  }

  // Schedules a fixed span up front, with no timer. Used by the offline probe:
  // an OfflineAudioContext has no wall clock for the lookahead timer to chase, so
  // "how loud does this loop actually come out" has to be rendered in one go.
  renderWindow(seconds: number): void {
    const ctx = this.ctx;
    const id = this.current;
    if (!ctx || !id) return;
    const track = musicTracks[id];
    const end = ctx.currentTime + seconds;
    let guard = 0;
    while (this.nextStepAt < end && guard < AudioConfig.music.maxRenderSteps) {
      guard += 1;
      this.scheduleStep(track, this.step % track.steps, this.nextStepAt);
      this.nextStepAt += stepSeconds(track);
      this.step += 1;
    }
  }

  // How long one loop of the current track lasts, for tests and diagnostics.
  loopLength(): number {
    return this.current ? loopSeconds(musicTracks[this.current]) : 0;
  }
}
