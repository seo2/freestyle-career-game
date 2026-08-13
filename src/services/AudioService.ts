// Audio (Fase 8): the game makes sound, and the setting survives a reload.
//
// Design constraints that shaped this:
//
//  * NO ASSETS. The sounds are synthesized from a few oscillators (src/data/
//    sounds.ts explains why). So there is nothing to preload and nothing to fail
//    to load.
//  * IT MUST NEVER THROW. Audio is decoration; a browser that blocks or lacks
//    WebAudio has to leave the game entirely playable. Every entry point here is
//    guarded, and a failed context is remembered so it is not retried on every
//    keypress.
//  * IT MUST NOT BREAK THE TRACE HARNESS. No Date.now, no Math.random, nothing
//    that reaches GameState. Headless Chromium gives an AudioContext that starts
//    suspended and is never resumed without a gesture, so in a trace run this
//    class does exactly nothing audible — by design, not by accident.
//  * IT MUST BE VERIFIABLE. Sound cannot be screenshotted, so every play is
//    recorded in a bounded log that a Playwright run can read through
//    window.audio_log(). "The code looks right" is not evidence.

import type { AudioSettings } from "../core/types";
import { AudioConfig } from "../data/config/AudioConfig";
import { soundDuration, sounds, type SoundId } from "../data/sounds";
import { MusicPlayer } from "./MusicPlayer";
import type { MusicTrackId } from "../data/music";

type ContextFactory = () => AudioContext | null;

// The browser's AudioContext, or null where there is none (jsdom, node).
const defaultFactory: ContextFactory = () => {
  const Ctor =
    typeof window === "undefined"
      ? undefined
      : (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
  if (!Ctor) return null;
  try {
    return new Ctor();
  } catch {
    return null;
  }
};

export class AudioService {
  private ctx: AudioContext | null = null;
  private ctxFailed = false;
  private bus: GainNode | null = null;
  private settings: AudioSettings;
  // What was played, newest last. Bounded: this is a test hook, not a history.
  // Sound ids, plus "music:<track>" / "music:off" entries so a headless run can
  // check what the music did too.
  private log: string[] = [];
  private static readonly LOG_MAX = 64;
  private readonly music = new MusicPlayer();
  // What the game last asked for, kept so the switch can restore it instead of
  // leaving the player on a silent screen after turning sound back on.
  private wantedTrack: MusicTrackId | null = null;

  constructor(
    settings: AudioSettings,
    private readonly factory: ContextFactory = defaultFactory,
  ) {
    this.settings = { ...settings };
  }

  getSettings(): AudioSettings {
    return { ...this.settings };
  }

  applySettings(settings: AudioSettings): void {
    this.settings = { ...settings };
    if (this.bus) this.bus.gain.value = this.busGain();
    this.music.setVolume(AudioConfig.music.busGain);
    // Turning sound off stops the loop outright rather than muting it: a silent
    // oscillator still costs a browser something, for hours.
    this.syncMusic();
  }

  // Effective gain of the whole bus: the player's 0..10 scaled by the master trim.
  // Muted SFX is expressed as a gain of zero rather than an early return, so a
  // muted game still schedules nothing audible but keeps one code path.
  private busGain(): number {
    const { min, max, master } = AudioConfig.volume;
    const clamped = Math.min(max, Math.max(min, this.settings.volume));
    return (clamped / max) * master;
  }

  // The log a Playwright run reads. Draining it makes each assertion about the
  // action it just performed instead of everything since boot.
  drainLog(): string[] {
    const out = this.log;
    this.log = [];
    return out;
  }

  // Which loop belongs to the screen the player is on. Null means silence on
  // purpose — a dilemma reads louder without a beat under it.
  setMusic(id: MusicTrackId | null): void {
    if (this.wantedTrack === id) return;
    this.wantedTrack = id;
    this.syncMusic();
  }

  private syncMusic(): void {
    const wanted = this.settings.musicOn && this.settings.volume > AudioConfig.volume.min ? this.wantedTrack : null;
    if (this.music.playing() === wanted) return;
    // Logged before the context is touched, exactly like play(): headless runs
    // have no audible output but the intent is still the interesting fact.
    this.record(wanted ? `music:${wanted}` : "music:off");
    const ctx = this.context();
    if (!ctx) return;
    this.music.play(wanted);
  }

  musicPlaying(): MusicTrackId | null {
    return this.music.playing();
  }

  // A browser will not start an AudioContext without a gesture. Called from the
  // first real key/pointer event; safe to call repeatedly.
  unlock(): void {
    const ctx = this.context();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      // The loop asked for before the gesture never actually started, so it is
      // restarted once the context is running.
      void ctx
        .resume()
        .then(() => this.restartMusic())
        .catch(() => undefined);
      return;
    }
    this.restartMusic();
  }

  // Re-applies the wanted track after an unlock: play() short-circuits when the
  // id has not changed, so the player has to be told to start from scratch.
  private restartMusic(): void {
    const wanted = this.settings.musicOn && this.settings.volume > AudioConfig.volume.min ? this.wantedTrack : null;
    if (!wanted || this.music.playing() === wanted) return;
    this.music.play(wanted);
  }

  private context(): AudioContext | null {
    if (this.ctx || this.ctxFailed) return this.ctx;
    // The factory itself can throw — a browser policy, a locked-down embed — and
    // audio is never allowed to take the game down with it. A test caught this
    // escaping: the default factory guarded itself, the call site did not.
    let ctx: AudioContext | null;
    try {
      ctx = this.factory();
    } catch {
      this.ctxFailed = true;
      return null;
    }
    if (!ctx) {
      // Remembered, so a missing WebAudio is not re-probed on every keypress.
      this.ctxFailed = true;
      return null;
    }
    this.ctx = ctx;
    try {
      this.bus = ctx.createGain();
      this.bus.gain.value = this.busGain();
      this.bus.connect(ctx.destination);
      // The music has its own sub-bus under the master, so the loop can sit below
      // the effects without touching their gain.
      this.music.attach(ctx, this.bus);
      this.music.setVolume(AudioConfig.music.busGain);
    } catch {
      this.ctxFailed = true;
      this.ctx = null;
      this.bus = null;
    }
    return this.ctx;
  }

  play(id: SoundId): void {
    if (!this.settings.sfxOn || this.settings.volume <= AudioConfig.volume.min) return;
    // Logged before the context is touched: what the game MEANT to play is the
    // interesting fact for a test, and headless runs have no audible output.
    this.record(id);
    const ctx = this.context();
    const bus = this.bus;
    if (!ctx || !bus || ctx.state !== "running") return;
    const def = sounds[id];
    let at = ctx.currentTime;
    const budget = Math.min(soundDuration(id), AudioConfig.maxDurationSeconds);
    const end = at + budget;
    for (const step of def.steps) {
      if (at >= end) break;
      const seconds = Math.min(step.seconds, end - at);
      if (step.freq > 0 && step.gain > 0) this.voice(ctx, bus, def.wave, step.freq, at, seconds, step.gain);
      at += seconds;
    }
  }

  private record(id: string): void {
    this.log.push(id);
    if (this.log.length > AudioService.LOG_MAX) this.log.shift();
  }

  // One note. Each gets its own oscillator and gain, stopped explicitly: a shared
  // oscillator would need re-tuning mid-flight and leaves clicks between steps.
  private voice(
    ctx: AudioContext,
    bus: GainNode,
    wave: OscillatorType,
    freq: number,
    at: number,
    seconds: number,
    gain: number,
  ): void {
    try {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = wave;
      osc.frequency.value = freq;
      const { attack, releaseFloor } = AudioConfig.envelope;
      env.gain.setValueAtTime(releaseFloor, at);
      env.gain.linearRampToValueAtTime(gain, at + Math.min(attack, seconds / 2));
      // Exponential release: a linear one to zero clicks, and a ramp to exactly
      // zero is not allowed by the spec.
      env.gain.exponentialRampToValueAtTime(releaseFloor, at + seconds);
      osc.connect(env);
      env.connect(bus);
      osc.start(at);
      osc.stop(at + seconds);
      osc.onended = () => {
        osc.disconnect();
        env.disconnect();
      };
    } catch {
      // A voice that cannot be built is a silent frame, never a crash.
    }
  }
}
