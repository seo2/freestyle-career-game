// Audio tuning (Fase 8). Formula shapes live in src/services/AudioService.ts;
// every number they consume lives here.

export const AudioConfig = {
  volume: {
    min: 0,
    max: 10,
    // Where a new career opens. Not at the ceiling: the first thing a player
    // hears should not be the loudest thing the game can do.
    start: 6,
    // Master trim applied on top of the player's setting. Set by MEASUREMENT, not
    // by ear-guessing: window.audio_probe renders the real chain offline and
    // reports its peak. At the first value (0.16) the whole game came out at about
    // -30 dBFS, which is roughly two thirds of the way to inaudible on a laptop.
    // At 0.8 the effects peak near -16 dBFS with the volume at its default 6/10,
    // and a full 10/10 still leaves headroom for several at once.
    master: 0.8,
  },
  envelope: {
    // Attack/release in seconds. Short attack keeps a UI blip feeling immediate;
    // a release that never reaches zero would click when the node stops.
    attack: 0.005,
    releaseFloor: 0.0001,
  },
  // A voice is never allowed to run longer than this, so a bug cannot leave a
  // tone droning under the whole game.
  maxDurationSeconds: 1.2,
  music: {
    // The music bus sits UNDER the sound effects: a loop the player stops hearing
    // after a minute is doing its job, one that competes with a verdict is not.
    // Measured at about 3 dB below the effects.
    busGain: 0.42,
    // Lookahead scheduling. The timer only has to wake up often enough that the
    // window never runs dry; the audio clock places the notes, so 25 ms of jitter
    // in the callback costs nothing.
    tickMs: 60,
    lookaheadSeconds: 0.35,
    // A tick that somehow falls far behind cannot schedule an unbounded burst.
    maxStepsPerTick: 64,
    // Upper bound for the offline probe, which schedules a whole span at once.
    maxRenderSteps: 4096,
    // Keeps the live-voice list from growing across a long session.
    maxLiveVoices: 96,
    // A beat of silence before the loop starts, so switching screens does not
    // slam a downbeat into the transition.
    startDelay: 0.08,
    noteAttack: 0.02,
    // Drum voices. `from`/`to` are a pitch sweep for the kick and a filter corner
    // for the noise voices.
    drums: {
      kick: { from: 130, to: 46, seconds: 0.16, gain: 0.9 },
      snare: { from: 1600, to: 1600, seconds: 0.13, gain: 0.32 },
      hat: { from: 7000, to: 7000, seconds: 0.03, gain: 0.16 },
      openHat: { from: 6000, to: 6000, seconds: 0.13, gain: 0.14 },
    },
  },
} as const;
