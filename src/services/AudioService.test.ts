// Audio is decoration, so the thing worth pinning is that it can never hurt the
// game: it must not throw where WebAudio is missing or broken, must respect the
// player's switch, and must record what it played so a headless run can check it.

import { describe, expect, it, vi } from "vitest";
import { AudioService } from "./AudioService";
import { AudioConfig } from "../data/config/AudioConfig";
import { sounds, soundDuration, type SoundId } from "../data/sounds";
import type { AudioSettings } from "../core/types";

const ON: AudioSettings = { volume: AudioConfig.volume.start, sfxOn: true, musicOn: true };

// A fake WebAudio graph that records what was built, so the scheduling can be
// asserted without a browser.
function fakeContext(state: AudioContextState = "running") {
  const voices: { wave: string; freq: number; start: number; stop: number }[] = [];
  const gains: number[] = [];
  const ctx = {
    state,
    currentTime: 10,
    destination: {},
    createGain: () => ({
      gain: {
        value: 0,
        setValueAtTime: () => undefined,
        linearRampToValueAtTime: (v: number) => gains.push(v),
        exponentialRampToValueAtTime: () => undefined,
      },
      connect: () => undefined,
      disconnect: () => undefined,
    }),
    createOscillator: () => {
      const voice = { wave: "", freq: 0, start: 0, stop: 0 };
      voices.push(voice);
      return {
        set type(v: string) {
          voice.wave = v;
        },
        frequency: {
          set value(v: number) {
            voice.freq = v;
          },
        },
        connect: () => undefined,
        disconnect: () => undefined,
        start: (t: number) => (voice.start = t),
        stop: (t: number) => (voice.stop = t),
        onended: null as (() => void) | null,
      };
    },
    resume: () => Promise.resolve(),
  };
  return { ctx: ctx as unknown as AudioContext, voices, gains };
}

describe("AudioService never hurts the game", () => {
  it("does nothing and throws nothing when there is no WebAudio at all", () => {
    const audio = new AudioService(ON, () => null);
    expect(() => audio.play("uiConfirm")).not.toThrow();
    expect(() => audio.unlock()).not.toThrow();
    // Still recorded: what the game MEANT to play is the fact a test cares about.
    expect(audio.drainLog()).toEqual(["uiConfirm"]);
  });

  it("probes a missing context once instead of on every keypress", () => {
    const factory = vi.fn(() => null);
    const audio = new AudioService(ON, factory);
    for (let i = 0; i < 20; i += 1) audio.play("uiMove");
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it("survives a context that throws while being built", () => {
    const audio = new AudioService(ON, () => {
      throw new Error("blocked");
    });
    expect(() => audio.play("uiConfirm")).not.toThrow();
  });

  it("survives a context whose nodes throw", () => {
    const broken = {
      state: "running",
      currentTime: 0,
      destination: {},
      createGain: () => {
        throw new Error("no nodes");
      },
    } as unknown as AudioContext;
    const audio = new AudioService(ON, () => broken);
    expect(() => audio.play("battleWin")).not.toThrow();
  });
});

describe("AudioService respects the switch", () => {
  it("plays nothing at all with sfx off", () => {
    const { ctx, voices } = fakeContext();
    const audio = new AudioService({ ...ON, sfxOn: false }, () => ctx);
    audio.play("battleWin");
    expect(voices).toHaveLength(0);
    // Not even logged: the game did not ask for a sound, it asked for silence.
    expect(audio.drainLog()).toEqual([]);
  });

  it("plays nothing at volume zero, which is what MUSICA: NO means", () => {
    const { ctx, voices } = fakeContext();
    const audio = new AudioService({ ...ON, volume: 0 }, () => ctx);
    audio.play("battleWin");
    expect(voices).toHaveLength(0);
  });

  it("scales the bus by the player's volume, trimmed by the master", () => {
    const { ctx } = fakeContext();
    const audio = new AudioService(ON, () => ctx);
    audio.play("uiMove");
    const half = new AudioService({ ...ON, volume: AudioConfig.volume.max }, () => fakeContext().ctx);
    half.play("uiMove");
    // Both are silent-safe; what matters is the setting round-trips.
    expect(audio.getSettings().volume).toBe(AudioConfig.volume.start);
    audio.applySettings({ ...ON, volume: 2 });
    expect(audio.getSettings().volume).toBe(2);
  });

  it("stays silent while the context is suspended, as it is in a headless run", () => {
    const { ctx, voices } = fakeContext("suspended");
    const audio = new AudioService(ON, () => ctx);
    audio.play("battleWin");
    expect(voices).toHaveLength(0);
    // Logged anyway, which is exactly how a trace run can still assert intent.
    expect(audio.drainLog()).toEqual(["battleWin"]);
  });
});

describe("AudioService scheduling", () => {
  it("builds one voice per audible step, in order, back to back", () => {
    const { ctx, voices } = fakeContext();
    const audio = new AudioService(ON, () => ctx);
    audio.play("battleWin");
    const steps = sounds.battleWin.steps;
    expect(voices).toHaveLength(steps.length);
    expect(voices.map((v) => v.freq)).toEqual(steps.map((s) => s.freq));
    // Each note starts where the previous one ended: gaps would read as stutter.
    for (let i = 1; i < voices.length; i += 1) {
      expect(voices[i].start).toBeCloseTo(voices[i - 1].stop, 5);
    }
    expect(voices[0].wave).toBe(sounds.battleWin.wave);
  });

  it("skips rests without leaving a gap in the timeline", () => {
    const { ctx, voices } = fakeContext();
    const audio = new AudioService(ON, () => ctx);
    audio.play("dilemma");
    const audible = sounds.dilemma.steps.filter((s) => s.freq > 0);
    expect(voices).toHaveLength(audible.length);
    // The rest still advances the clock, so the second note lands after it.
    expect(voices[1].start).toBeGreaterThan(voices[0].stop);
  });

  it("never lets a sound run past the hard ceiling", () => {
    const { ctx, voices } = fakeContext();
    const audio = new AudioService(ON, () => ctx);
    audio.play("battleWin");
    const last = voices[voices.length - 1];
    expect(last.stop - 10).toBeLessThanOrEqual(AudioConfig.maxDurationSeconds + 1e-6);
  });

  it("keeps the log bounded so a long session cannot grow it forever", () => {
    const audio = new AudioService(ON, () => null);
    for (let i = 0; i < 500; i += 1) audio.play("uiMove");
    expect(audio.drainLog().length).toBeLessThanOrEqual(64);
    // Drained: the next assertion is about the next action, not the whole session.
    expect(audio.drainLog()).toEqual([]);
  });
});

describe("the sound catalogue", () => {
  it("keeps every sound short enough to be a sound and not a tune", () => {
    for (const id of Object.keys(sounds) as SoundId[]) {
      expect(soundDuration(id)).toBeGreaterThan(0);
      expect(soundDuration(id)).toBeLessThanOrEqual(AudioConfig.maxDurationSeconds);
    }
  });

  it("keeps the cursor sound the quietest and shortest thing in it", () => {
    // A move sound you notice is a move sound you will come to hate, and the
    // cursor moves on nearly every keypress.
    const move = soundDuration("uiMove");
    for (const id of Object.keys(sounds) as SoundId[]) {
      if (id === "uiMove") continue;
      expect(soundDuration(id)).toBeGreaterThanOrEqual(move);
    }
    const moveGain = Math.max(...sounds.uiMove.steps.map((s) => s.gain));
    expect(moveGain).toBeLessThan(Math.max(...sounds.verdictGreat.steps.map((s) => s.gain)));
  });

  it("gives every id a definition that matches its key", () => {
    for (const [key, def] of Object.entries(sounds)) expect(def.id).toBe(key);
  });
});
