// Battle spectacle curves (Fase 12 D): the crowd bouncing to the room's
// energy, a performer lunging when a round lands, and a number counting up.
//
// Pure functions of time so the maths is unit-tested (headless captures run at
// hundreds of ms per frame and cannot sample these mid-flight — CLAUDE.md) and
// so a given moment always looks the same. No Math.random: variety between
// crowd slices comes from fixed per-slice phases.

// One slice of the foreground crowd, `timeMs` into the battle. `energy` is the
// room from 0 (cold, barely swaying) to 1 (packed and jumping); `roar` is a
// 0..1 flash that throws everyone up at once. Returns pixels to move the slice
// by (negative = up).
export function crowdBounce(timeMs: number, slice: number, energy: number, roar: number, bpm = 92): number {
  const e = Math.max(0, Math.min(1, energy));
  const beatMs = 60000 / bpm;
  // Each slice rides its own fixed phase, so the crowd bounces in groups
  // instead of as one rigid strip. The golden-ratio step never lines up.
  const phase = ((timeMs / beatMs + slice * 0.618) % 1 + 1) % 1;
  // A hop: up fast, down on the beat. |sin| over a beat gives that shape.
  const hop = Math.abs(Math.sin(phase * Math.PI));
  const amplitude = 0.6 + e * e * 5.4; // cold ~0.6px sway, hot ~6px jumps
  const jump = Math.max(0, Math.min(1, roar)) * 9;
  return -Math.round(hop * amplitude + jump);
}

// A performer's lunge when a round lands: out fast toward the centre, hold,
// ease back. `t` is 0..1 over the move; returns 0..1 of the full lunge.
export function lunge(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  if (x < 0.18) return x / 0.18; // strike
  if (x < 0.45) return 1; // hold the pose
  const back = (x - 0.45) / 0.55;
  return 1 - back * back * (3 - 2 * back); // smoothstep home
}

// A number counting toward its value over the first part of a beat, so a
// "+18" reads as the crowd piling on instead of appearing whole.
export function countUp(target: number, t: number): number {
  const x = Math.max(0, Math.min(1, t));
  const eased = 1 - Math.pow(1 - x, 3);
  return Math.round(target * eased);
}

// A deterministic pick: the same round and slot always shout the same thing.
export function pickShout<T>(pool: readonly T[], round: number, slot: number): T {
  return pool[(round * 7 + slot * 3) % pool.length];
}
