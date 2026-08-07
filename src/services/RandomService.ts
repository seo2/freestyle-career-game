// All game randomness flows through a RandomSource. Never call Math.random
// in game code — a seeded source keeps runs replayable and testable.

export interface RandomSource {
  next(): number;
  int(min: number, max: number): number;
}

// LCG advanced in place on the host object's `seed` (the live GameState),
// so the RNG stream survives save/load exactly like the legacy engine.
export function createStateRng(host: { seed: number }): RandomSource {
  return {
    next(): number {
      host.seed = (host.seed * 1664525 + 1013904223) >>> 0;
      return host.seed / 4294967296;
    },
    int(min: number, max: number): number {
      return Math.floor(this.next() * (max - min + 1)) + min;
    },
  };
}

// Fixed-sequence source for tests that need scripted outcomes.
export function createSequenceRng(values: number[]): RandomSource {
  let index = 0;
  return {
    next(): number {
      const value = values[index % values.length];
      index += 1;
      return value;
    },
    int(min: number, max: number): number {
      return Math.floor(this.next() * (max - min + 1)) + min;
    },
  };
}
