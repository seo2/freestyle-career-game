// Temporary music loops (Fase 8). Pure data; the sequencer that plays it lives in
// src/services/MusicPlayer.ts and every global number in AudioConfig.
//
// These are PLACEHOLDERS, and the code says so out loud because a placeholder
// nobody labels becomes the shipped version by accident. The Bible asks for boom
// bap / jazz / soul / lo-fi / trap per zone, and a few oscillators do not fake a
// real track. What they DO give, today, for nothing: a room that is not silent, a
// tempo per zone, and a working music switch — so the game can be listened to
// while the real tracks are still a pending asset (docs/ASSETS.md). The player is
// built so a sampled loop can replace a pattern here without touching the wiring.
//
// A pattern is a grid of sixteenth-note steps. Sixteen steps to the bar, so a
// four-on-the-floor kick is steps 0/4/8/12 and reads as such in the data.

export type MusicTrackId = "menu" | "career" | "battle" | "cypher";

// Percussion voices. The sequencer synthesizes each from noise or a pitch sweep;
// none of them needs a sample.
export type DrumVoice = "kick" | "snare" | "hat" | "openHat";

export interface MusicTrack {
  id: MusicTrackId;
  label: string;
  bpm: number;
  // Sixteenth-note steps in the loop. 16 = one bar, 32 = two.
  steps: number;
  // Which steps each drum voice hits.
  drums: Partial<Record<DrumVoice, number[]>>;
  // Bass line: [step, semitone offset from the track's root, length in steps].
  bass: [number, number, number][];
  // Chord stabs / melody: same shape, played an octave or two up.
  keys: [number, number, number][];
  // Root note in Hz. Everything else is an offset in semitones from here.
  root: number;
  // 0..1 trim for this track alone, on top of the music bus. A battle loop under
  // ten sound effects needs less room than a quiet menu.
  gain: number;
}

// The minor-key intervals these loops are built from, as semitone offsets.
const ROOT = 0;
const MIN3 = 3;
const P4 = 5;
const P5 = 7;
const MIN7 = 10;
const OCT = 12;

export const musicTracks: Record<MusicTrackId, MusicTrack> = {
  // Menu: slow, sparse, nothing in a hurry. It plays under a still screen, so it
  // must survive being heard for minutes at a time.
  menu: {
    id: "menu",
    label: "Menu (lo-fi)",
    bpm: 76,
    steps: 32,
    drums: {
      kick: [0, 10, 16, 22],
      snare: [8, 24],
      hat: [2, 6, 10, 14, 18, 22, 26, 30],
    },
    bass: [
      [0, ROOT, 6],
      [8, MIN7 - OCT, 6],
      [16, P4 - OCT, 6],
      [24, MIN3, 6],
    ],
    keys: [
      [0, ROOT + OCT, 8],
      [8, MIN3 + OCT, 8],
      [16, P5 + OCT, 8],
      [24, MIN7 + OCT, 8],
    ],
    root: 110,
    gain: 0.5,
  },
  // The room and the city: boom bap, the genre the game is about. Head-nodding
  // tempo, kick on 1 and the "and" of 3, snare on 2 and 4.
  career: {
    id: "career",
    label: "Carrera (boom bap)",
    bpm: 88,
    steps: 32,
    drums: {
      kick: [0, 7, 16, 22, 26],
      snare: [4, 12, 20, 28],
      hat: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30],
      openHat: [14, 30],
    },
    bass: [
      [0, ROOT, 4],
      [6, ROOT, 2],
      [12, MIN3, 4],
      [16, P4 - OCT, 4],
      [22, ROOT, 2],
      [26, MIN7 - OCT, 6],
    ],
    keys: [
      [0, MIN3 + OCT, 6],
      [12, P5 + OCT, 4],
      [20, MIN7 + OCT, 4],
      [26, P4 + OCT, 6],
    ],
    root: 98,
    gain: 0.45,
  },
  // Battle: same family, harder and faster, and deliberately thinner in the
  // middle so the round verdicts cut through instead of fighting the loop.
  battle: {
    id: "battle",
    label: "Batalla (boom bap duro)",
    bpm: 96,
    steps: 16,
    drums: {
      kick: [0, 3, 8, 11],
      snare: [4, 12],
      hat: [0, 2, 4, 6, 8, 10, 12, 14],
      openHat: [15],
    },
    bass: [
      [0, ROOT, 3],
      [3, ROOT, 2],
      [8, P5 - OCT, 3],
      [11, MIN3, 2],
      [14, P4 - OCT, 2],
    ],
    keys: [[0, ROOT + OCT, 2]],
    root: 87,
    gain: 0.38,
  },
  // Cypher: jazzier and looser, because it is friends in a circle and not a
  // competition. Brushed hats, walking bass.
  cypher: {
    id: "cypher",
    label: "Cypher (jazz)",
    bpm: 84,
    steps: 32,
    drums: {
      kick: [0, 14, 16, 30],
      snare: [8, 24],
      hat: [0, 3, 6, 8, 11, 14, 16, 19, 22, 24, 27, 30],
    },
    bass: [
      [0, ROOT, 4],
      [4, MIN3, 4],
      [8, P4 - OCT, 4],
      [12, P5 - OCT, 4],
      [16, MIN7 - OCT, 4],
      [20, P5 - OCT, 4],
      [24, P4 - OCT, 4],
      [28, MIN3, 4],
    ],
    keys: [
      [2, MIN7 + OCT, 4],
      [10, P5 + OCT, 4],
      [18, MIN3 + OCT + OCT, 4],
      [26, ROOT + OCT, 6],
    ],
    root: 104,
    gain: 0.42,
  },
};

// Seconds per sixteenth-note step.
export function stepSeconds(track: MusicTrack): number {
  return 60 / track.bpm / 4;
}

// Length of one loop, in seconds.
export function loopSeconds(track: MusicTrack): number {
  return stepSeconds(track) * track.steps;
}

// Semitone offset to a frequency, from the track's own root.
export function noteHz(track: MusicTrack, semitones: number): number {
  return track.root * Math.pow(2, semitones / 12);
}
