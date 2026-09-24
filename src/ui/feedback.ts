// Action feedback: what changed, and how a "+12" floats away.
//
// The room used to answer a decision with one line of text. These are the
// pieces that make it answer with the numbers themselves: `diffFeedback` reads
// two snapshots of the state and says what moved (presentation only — it never
// decides anything), and `Floater` is the frame-delta curve a delta rides on.
// Both are pure so the maths is unit-tested: headless captures run at hundreds
// of ms per frame and cannot sample an animation mid-flight (CLAUDE.md).

import type { GameState, StatKey } from "../core/types";
import { statLabels, trainingStats } from "../data/stats";
import { palette } from "./palette";

// Where a delta floats from: a HUD card (resources the HUD shows) or the MC
// (everything that lives in the character: skills, xp, songs).
export type FeedbackAnchor = "energy" | "cash" | "fans" | "respect" | "mc";

export interface FeedbackDelta {
  anchor: FeedbackAnchor;
  text: string;
  color: string;
  // Positive deltas celebrate, negative ones just inform: the scene may play
  // them differently (a pop vs. a plain fade).
  positive: boolean;
}

export type FeedbackSnapshot = Pick<
  GameState,
  "energy" | "cash" | "fans" | "respect" | "xp" | "level" | "songs" | "discProgress"
> & { stats: Record<StatKey, number> };

export function feedbackSnapshot(state: GameState): FeedbackSnapshot {
  return {
    energy: state.energy,
    cash: state.cash,
    fans: state.fans,
    respect: state.respect,
    xp: state.xp,
    level: state.level,
    songs: state.songs,
    discProgress: state.discProgress,
    stats: { ...state.stats },
  };
}

const NEGATIVE = palette.red;

function signed(amount: number, prefix = ""): string {
  return amount >= 0 ? `+${prefix}${amount}` : `-${prefix}${Math.abs(amount)}`;
}

// What moved between two snapshots, in the order the eye should read it: the
// headline gains first (skills, level), then resources, energy last because
// almost every action spends it.
export function diffFeedback(prev: FeedbackSnapshot, next: FeedbackSnapshot): FeedbackDelta[] {
  const out: FeedbackDelta[] = [];

  if (next.level > prev.level) {
    out.push({ anchor: "mc", text: `¡NIVEL ${next.level}!`, color: palette.yellow, positive: true });
  }
  for (const key of trainingStats) {
    const d = Math.round(next.stats[key] - prev.stats[key]);
    if (d !== 0) {
      out.push({
        anchor: "mc",
        text: `${signed(d)} ${statLabels[key].toUpperCase()}`,
        color: d > 0 ? palette.teal : NEGATIVE,
        positive: d > 0,
      });
    }
  }
  if (next.songs > prev.songs) {
    out.push({ anchor: "mc", text: "¡TEMA TERMINADO!", color: palette.yellow, positive: true });
  } else {
    const d = Math.round(next.discProgress - prev.discProgress);
    if (d > 0) out.push({ anchor: "mc", text: `+${d}% TEMA`, color: palette.pink, positive: true });
  }
  // XP only shows when it went up without a level-up (a level-up resets the bar
  // and would read as a loss).
  const xp = Math.round(next.xp - prev.xp);
  if (xp > 0 && next.level === prev.level) {
    out.push({ anchor: "mc", text: `+${xp} XP`, color: palette.blue, positive: true });
  }

  const resource = (anchor: FeedbackAnchor, d: number, color: string, prefix = ""): void => {
    const rounded = Math.round(d);
    if (rounded === 0) return;
    out.push({ anchor, text: signed(rounded, prefix), color: rounded > 0 ? color : NEGATIVE, positive: rounded > 0 });
  };
  resource("cash", next.cash - prev.cash, palette.green, "$");
  resource("fans", next.fans - prev.fans, palette.blue);
  resource("respect", next.respect - prev.respect, "#9f86ff");
  resource("energy", next.energy - prev.energy, palette.green);
  return out;
}

// One floating delta's life: a short pop in, a rise, a hold, then a fade. The
// scene reads `rise`, `alpha` and `scale` every frame; `delayMs` staggers a
// burst so several deltas from one action read one after the other.
export class Floater {
  private elapsed: number;

  constructor(
    delayMs = 0,
    private readonly lifeMs = 1500,
    private readonly risePx = 30,
    private readonly popMs = 160,
    private readonly fadeMs = 450,
  ) {
    this.elapsed = -delayMs;
  }

  get done(): boolean {
    return this.elapsed >= this.lifeMs;
  }

  // Still waiting for its stagger slot: drawn nowhere yet.
  get pending(): boolean {
    return this.elapsed < 0;
  }

  advance(deltaMs: number): void {
    this.elapsed = Math.min(this.lifeMs, this.elapsed + deltaMs);
  }

  private get t(): number {
    return Math.max(0, this.elapsed) / this.lifeMs;
  }

  // Pixels above the anchor; eased out so it leaps first and settles.
  get rise(): number {
    const t = this.t;
    return this.risePx * (1 - (1 - t) * (1 - t));
  }

  get alpha(): number {
    if (this.pending) return 0;
    const fadeStart = this.lifeMs - this.fadeMs;
    if (this.elapsed <= fadeStart) return 1;
    return Math.max(0, 1 - (this.elapsed - fadeStart) / this.fadeMs);
  }

  // Overshoots to 1.35 and lands on 1 over the pop window.
  get scale(): number {
    if (this.pending) return 1;
    const p = Math.min(1, this.elapsed / this.popMs);
    return 1 + 0.35 * (1 - p);
  }
}

// The MC's idle: a breath (slow, 1px) plus a nod on every beat, because a
// freestyler at rest is still moving to something. Returns pixels to lift the
// sprite by (negative = down) and a vertical scale for the breath.
export function idlePose(timeMs: number, bpm = 88): { dy: number; scaleY: number } {
  const beatMs = 60000 / bpm;
  const phase = (timeMs % beatMs) / beatMs;
  // The nod: drop fast on the beat, come back up over the first 40%.
  const nod = phase < 0.4 ? -2 * (1 - phase / 0.4) : 0;
  const breath = Math.sin((timeMs / 2400) * Math.PI * 2);
  return { dy: Math.round(nod), scaleY: 1 + breath * 0.012 };
}

// Deterministic lamp flicker (no RNG): two incommensurate sines, so the light
// breathes irregularly without ever repeating in an obvious loop.
export function flicker(timeMs: number, seed: number): number {
  const a = Math.sin(timeMs / 470 + seed * 1.7);
  const b = Math.sin(timeMs / 1130 + seed * 2.9);
  return 0.5 + 0.3 * a + 0.2 * b;
}
