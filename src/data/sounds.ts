// The game's sound catalogue (Fase 8). Pure data: the synth that plays it lives
// in src/services/AudioService.ts and every global number in AudioConfig.
//
// These are SYNTHESIZED, not sampled. No audio files exist in the project, and
// the two ways to get them both had a cost the owner has not agreed to: generating
// them spends their credits, and cutting them from somewhere else is not ours to
// cut. A handful of square/triangle blips needs no assets, is byte-deterministic
// (which the trace harness cares about), weighs nothing, and is the right register
// for a pixel-art game anyway.
//
// MUSIC is a different matter: a boom-bap loop is not something a few oscillators
// can fake, so per-zone music stays a pending asset (docs/ASSETS.md). The service
// is built so dropping the files in later needs no new plumbing.

export type SoundId =
  | "uiMove"
  | "uiConfirm"
  | "uiBack"
  | "uiDenied"
  | "cardPlayed"
  | "verdictGreat"
  | "verdictWeak"
  | "battleWin"
  | "battleLoss"
  | "levelUp"
  | "cash"
  | "weekClose"
  | "dilemma";

// One step of a voice: a note held for `seconds`, or a rest when `freq` is 0.
export interface ToneStep {
  freq: number;
  seconds: number;
  // Peak gain of this step, 0..1, before the master trim and the player's volume.
  gain: number;
}

export interface SoundDef {
  id: SoundId;
  // "square" reads as chiptune and cuts through; "triangle" is softer, for the
  // sounds that should not poke the player every time they move the cursor.
  wave: OscillatorType;
  steps: ToneStep[];
}

// Note frequencies used below, so the melodies read as music instead of numbers.
const A3 = 220;
const C4 = 261.63;
const E4 = 329.63;
const G4 = 392.0;
const A4 = 440;
const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const A5 = 880;
const D3 = 146.83;
const F3 = 174.61;

export const sounds: Record<SoundId, SoundDef> = {
  // Cursor movement happens constantly, so it is the quietest and shortest thing
  // in the catalogue. A move sound you notice is a move sound you will hate.
  uiMove: { id: "uiMove", wave: "triangle", steps: [{ freq: A4, seconds: 0.035, gain: 0.18 }] },
  uiConfirm: {
    id: "uiConfirm",
    wave: "square",
    steps: [
      { freq: E4, seconds: 0.045, gain: 0.3 },
      { freq: A4, seconds: 0.07, gain: 0.3 },
    ],
  },
  uiBack: {
    id: "uiBack",
    wave: "triangle",
    steps: [
      { freq: A4, seconds: 0.04, gain: 0.24 },
      { freq: E4, seconds: 0.06, gain: 0.24 },
    ],
  },
  // Refusals fall instead of rising: the shape says "no" before the text does.
  uiDenied: {
    id: "uiDenied",
    wave: "square",
    steps: [
      { freq: A3, seconds: 0.06, gain: 0.26 },
      { freq: F3, seconds: 0.1, gain: 0.26 },
    ],
  },
  cardPlayed: {
    id: "cardPlayed",
    wave: "square",
    steps: [
      { freq: C5, seconds: 0.04, gain: 0.28 },
      { freq: G4, seconds: 0.05, gain: 0.22 },
    ],
  },
  // The verdict beat is the loudest moment of a round, so the two verdicts are
  // deliberately opposite arpeggios: up and bright, or down and flat.
  verdictGreat: {
    id: "verdictGreat",
    wave: "square",
    steps: [
      { freq: E5, seconds: 0.05, gain: 0.34 },
      { freq: G5, seconds: 0.05, gain: 0.34 },
      { freq: A5, seconds: 0.11, gain: 0.34 },
    ],
  },
  verdictWeak: {
    id: "verdictWeak",
    wave: "triangle",
    steps: [
      { freq: A3, seconds: 0.07, gain: 0.3 },
      { freq: D3, seconds: 0.13, gain: 0.3 },
    ],
  },
  battleWin: {
    id: "battleWin",
    wave: "square",
    steps: [
      { freq: C5, seconds: 0.09, gain: 0.34 },
      { freq: E5, seconds: 0.09, gain: 0.34 },
      { freq: G5, seconds: 0.09, gain: 0.34 },
      { freq: C5 * 2, seconds: 0.2, gain: 0.32 },
    ],
  },
  battleLoss: {
    id: "battleLoss",
    wave: "triangle",
    steps: [
      { freq: G4, seconds: 0.11, gain: 0.3 },
      { freq: E4, seconds: 0.11, gain: 0.3 },
      { freq: C4, seconds: 0.24, gain: 0.28 },
    ],
  },
  levelUp: {
    id: "levelUp",
    wave: "square",
    steps: [
      { freq: A4, seconds: 0.06, gain: 0.3 },
      { freq: C5, seconds: 0.06, gain: 0.3 },
      { freq: E5, seconds: 0.16, gain: 0.32 },
    ],
  },
  cash: {
    id: "cash",
    wave: "square",
    steps: [
      { freq: G5, seconds: 0.035, gain: 0.24 },
      { freq: C5 * 2, seconds: 0.07, gain: 0.24 },
    ],
  },
  weekClose: {
    id: "weekClose",
    wave: "triangle",
    steps: [
      { freq: C4, seconds: 0.1, gain: 0.26 },
      { freq: G4, seconds: 0.1, gain: 0.26 },
      { freq: C5, seconds: 0.18, gain: 0.26 },
    ],
  },
  // A dilemma stops the loop, so its sound is a held, unresolved interval — it
  // asks something instead of announcing it.
  dilemma: {
    id: "dilemma",
    wave: "triangle",
    steps: [
      { freq: C4, seconds: 0.14, gain: 0.28 },
      { freq: 0, seconds: 0.05, gain: 0 },
      { freq: E4, seconds: 0.22, gain: 0.26 },
    ],
  },
};

// Total length of a sound, for the tests and for the service's own bound.
export function soundDuration(id: SoundId): number {
  return sounds[id].steps.reduce((total, step) => total + step.seconds, 0);
}
