// Pins the battle spectacle curves; see battleFeel.ts for why they are pure.

import { describe, expect, it } from "vitest";
import { countUp, crowdBounce, lunge, pickShout } from "./battleFeel";

describe("crowdBounce", () => {
  it("never pushes the crowd down, only up", () => {
    for (let t = 0; t < 4000; t += 23) {
      for (let s = 0; s < 12; s += 1) expect(crowdBounce(t, s, 1, 0)).toBeLessThanOrEqual(0);
    }
  });

  it("a cold room barely sways and a hot one jumps", () => {
    const peak = (energy: number): number => {
      let max = 0;
      for (let t = 0; t < 2000; t += 5) max = Math.max(max, -crowdBounce(t, 0, energy, 0));
      return max;
    };
    expect(peak(0)).toBeLessThanOrEqual(1);
    expect(peak(1)).toBeGreaterThanOrEqual(5);
  });

  it("slices bounce out of step with each other", () => {
    const heights = Array.from({ length: 6 }, (_, s) => crowdBounce(300, s, 1, 0));
    expect(new Set(heights).size).toBeGreaterThan(2);
  });

  it("a roar throws everyone up at once", () => {
    expect(crowdBounce(0, 0, 0, 1)).toBeLessThanOrEqual(-9);
  });
});

describe("lunge", () => {
  it("starts home, strikes, holds, and comes back", () => {
    expect(lunge(0)).toBe(0);
    expect(lunge(0.3)).toBe(1);
    expect(lunge(1)).toBeCloseTo(0, 5);
    expect(lunge(0.7)).toBeGreaterThan(0);
    expect(lunge(0.7)).toBeLessThan(1);
  });
});

describe("countUp", () => {
  it("counts from zero to the value and lands on it exactly", () => {
    expect(countUp(18, 0)).toBe(0);
    expect(countUp(18, 1)).toBe(18);
    expect(countUp(-7, 1)).toBe(-7);
    expect(countUp(18, 0.5)).toBeGreaterThan(9);
  });
});

describe("pickShout", () => {
  it("is deterministic and stays inside the pool", () => {
    const pool = ["a", "b", "c"] as const;
    for (let r = 1; r < 10; r += 1) {
      expect(pool).toContain(pickShout(pool, r, 0));
      expect(pickShout(pool, r, 1)).toBe(pickShout(pool, r, 1));
    }
  });
});
