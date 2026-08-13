// Audio tuning (Fase 8). Formula shapes live in src/services/AudioService.ts;
// every number they consume lives here.

export const AudioConfig = {
  volume: {
    min: 0,
    max: 10,
    // Where a new career opens. Not at the ceiling: the first thing a player
    // hears should not be the loudest thing the game can do.
    start: 6,
    // Master trim applied on top of the player's setting. The synth voices below
    // are square and triangle waves, which are much harsher per unit of gain than
    // recorded samples, so the whole bus sits low.
    master: 0.16,
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
} as const;
