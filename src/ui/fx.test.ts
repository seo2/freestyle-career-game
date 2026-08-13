// The animation primitives are unit-tested because the capture harness cannot
// verify them: headless frames carry deltas of hundreds of milliseconds, so a
// 200-260ms effect finishes inside a single frame and no screenshot can ever
// sample it mid-flight (documented in CLAUDE.md). The maths is what makes the
// effect correct on a real 60fps screen, so the maths is what gets pinned.

import { describe, expect, it } from "vitest";
import { EasedValue, Pulse, Shake } from "./fx";

describe("EasedValue", () => {
  it("covers half the remaining distance every half-life, whatever the frame times", () => {
    const oneBigStep = new EasedValue(0, 100);
    oneBigStep.target = 100;
    expect(oneBigStep.advance(100)).toBeCloseTo(50, 5);

    // Two half-steps must land in the same place as one full step: that is what
    // makes the easing frame-rate independent.
    const twoSmallSteps = new EasedValue(0, 100);
    twoSmallSteps.target = 100;
    twoSmallSteps.advance(50);
    twoSmallSteps.advance(50);
    expect(twoSmallSteps.value).toBeCloseTo(oneBigStep.value, 5);
  });

  it("settles exactly on the target instead of creeping forever", () => {
    const value = new EasedValue(0, 60);
    value.target = 43;
    for (let i = 0; i < 100; i += 1) value.advance(16);
    expect(value.value).toBe(43);
  });

  it("chases a target that moves mid-flight", () => {
    const value = new EasedValue(50, 80);
    value.target = 80;
    value.advance(40);
    const rising = value.value;
    expect(rising).toBeGreaterThan(50);
    expect(rising).toBeLessThan(80);
    value.target = 20;
    for (let i = 0; i < 60; i += 1) value.advance(16);
    // 60 frames land within a hundredth of a pixel; the frame after that snaps
    // it exact (the "settles exactly" test above pins that end state).
    expect(value.value).toBeCloseTo(20, 1);
  });

  it("snaps without easing when the scene needs the value now", () => {
    const value = new EasedValue(10, 100);
    value.snap(70);
    expect(value.value).toBe(70);
    expect(value.advance(16)).toBe(70);
  });
});

describe("Shake", () => {
  it("moves the screen after a kick and returns exactly to rest", () => {
    const shake = new Shake(260, 34);
    expect(shake.advance(16)).toEqual({ x: 0, y: 0 }); // nothing to shake yet

    shake.kick(6);
    expect(shake.active).toBe(true);
    const offsets = [];
    for (let i = 0; i < 6; i += 1) offsets.push(shake.advance(16));
    // It actually displaces the view...
    expect(offsets.some((offset) => offset.x !== 0 || offset.y !== 0)).toBe(true);
    // ...within the amplitude it was given, on both axes.
    for (const offset of offsets) {
      expect(Math.abs(offset.x)).toBeLessThanOrEqual(6);
      expect(Math.abs(offset.y)).toBeLessThanOrEqual(6);
    }
    // ...and it always comes back to zero, so the camera can never be left off
    // centre by a frame that arrived late.
    shake.advance(400);
    expect(shake.active).toBe(false);
    expect(shake.advance(16)).toEqual({ x: 0, y: 0 });
  });

  it("decays: the first frames displace more than the last ones", () => {
    const shake = new Shake(300, 34);
    shake.kick(8);
    const magnitudes: number[] = [];
    for (let i = 0; i < 18; i += 1) {
      const offset = shake.advance(16);
      magnitudes.push(Math.abs(offset.x) + Math.abs(offset.y));
    }
    const early = Math.max(...magnitudes.slice(0, 6));
    const late = Math.max(...magnitudes.slice(12));
    expect(early).toBeGreaterThan(late);
  });

  it("is deterministic: the same kick and the same frames give the same shake", () => {
    const run = (): string => {
      const shake = new Shake(260, 34);
      shake.kick(5);
      return Array.from({ length: 10 }, () => JSON.stringify(shake.advance(16))).join("|");
    };
    expect(run()).toBe(run());
  });

  it("restarts on a new hit instead of stacking into a longer rumble", () => {
    const shake = new Shake(200, 34);
    shake.kick(4);
    shake.advance(150);
    shake.kick(4); // second punchline lands
    shake.advance(150);
    expect(shake.active).toBe(true); // the first kick alone would be over
  });
});

describe("Pulse", () => {
  it("ramps from 0 to 1 and stops there", () => {
    const pulse = new Pulse(200);
    pulse.restart();
    const first = pulse.advance(50);
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThan(1);
    expect(pulse.done).toBe(false);
    expect(pulse.advance(400)).toBe(1);
    expect(pulse.done).toBe(true);
    expect(pulse.advance(16)).toBe(1);
  });

  it("eases out, so an entrance lands softly instead of stopping dead", () => {
    const pulse = new Pulse(200);
    pulse.restart();
    // Half way through time, an ease-out curve is already past half way in
    // progress (that is what makes the landing soft).
    expect(pulse.advance(100)).toBeGreaterThan(0.5);
  });

  it("starts finished, so nothing animates until something asks for it", () => {
    expect(new Pulse(200).done).toBe(true);
  });
});
