// Dilemmas and identity (Fase 7).
//
// The owner's guiding principle is "mismo origen, destinos distintos": everyone
// starts in the same room with the same potential, and the ending comes from how
// the career was carried. This system is where that becomes real — every choice
// moves the identity axes, gets written into the career's memory, and starts
// deciding which dilemmas can even reach you.
//
// The Bible's rule holds in the data, not here: no option is the right answer.
// This system does not judge a choice, it just applies it.
//
// Pure functions over GameState, RNG only through the injected RandomSource.

import type {
  DecisionRecord,
  DilemmaDef,
  DilemmaOption,
  GameState,
  IdentityAxes,
  IdentityAxis,
} from "../core/types";
import { dilemmas } from "../data/dilemmas";
import { identityDrift } from "../data/identityDrift";
import { DilemmaConfig } from "../data/config/DilemmaConfig";
import { PlanConfig } from "../data/config/PlanConfig";
import { stages } from "../data/stages";
import type { RandomSource } from "../services/RandomService";
import { stageIndex } from "../core/derived";
import { maxEnergy } from "../core/derived";
import { addXp } from "./ProgressionSystem";
import { applyAxisPull } from "./RelationshipSystem";
import { clamp } from "../utils/math";

export function findDilemma(id: string): DilemmaDef | null {
  return dilemmas.find((dilemma) => dilemma.id === id) ?? null;
}

// Which dilemmas could reach this MC right now: stage reached, axis gates met,
// and not already used up. The axis gates are the seed of divergence — two
// players in the same week can be offered different situations.
export function eligibleDilemmas(state: GameState): DilemmaDef[] {
  const reached = stageIndex(state);
  return dilemmas.filter((dilemma) => {
    const needed = stages.findIndex((stage) => stage.id === dilemma.minStage);
    if (needed > reached) return false;
    if (dilemma.once && state.seenDilemmas.includes(dilemma.id)) return false;
    if (!dilemma.requires) return true;
    return Object.entries(dilemma.requires).every(([axis, gate]) => {
      const value = state.axes[axis as IdentityAxis];
      if (gate.min !== undefined && value < gate.min) return false;
      if (gate.max !== undefined && value > gate.max) return false;
      return true;
    });
  });
}

// Has a dilemma already landed this week? One per week, so a decision stays an
// event instead of becoming paperwork.
export function dilemmaThisWeek(state: GameState): boolean {
  return state.decisions.filter((entry) => entry.week === state.week).length >= DilemmaConfig.roll.maxPerWeek;
}

// How far into the career we are, in days. Week 1 day 1 is day 1.
function livedDays(state: GameState): number {
  return (state.week - 1) * PlanConfig.week.days + state.day;
}

// Rolls for a dilemma after a lived day. Consumes exactly TWO RNG draws (the
// chance and the pick) whatever the outcome, so the deterministic trace harness
// cannot drift with the result. Returns the dilemma that landed, or null.
export function rollDilemma(state: GameState, rng: RandomSource): DilemmaDef | null {
  const pool = eligibleDilemmas(state);
  const chance = rng.next();
  const pickIndex = pool.length > 0 ? rng.int(0, pool.length - 1) : 0;
  if (state.pendingDilemma) return null;
  // Counted in days lived, not weeks: a quiet first WEEK capped a short arc at two
  // dilemmas (see DilemmaConfig.roll.quietDays).
  if (livedDays(state) <= DilemmaConfig.roll.quietDays) return null;
  if (dilemmaThisWeek(state)) return null;
  if (pool.length === 0) return null;
  if (chance > DilemmaConfig.roll.chancePerDay) return null;
  const dilemma = pool[pickIndex];
  state.pendingDilemma = dilemma.id;
  state.mode = "dilemma";
  return dilemma;
}

// What you DID this block, not what you answered. Called by ActionsSystem after
// every action that actually ran.
//
// Until Fase 10 the axes moved only when a dilemma was answered, which meant a
// player who recorded a hundred songs and never battled had the same identity as
// one who battled every weekend — the destiny came from three answers while the
// weeks counted for nothing. The nudges are small next to a dilemma's 6-22, so a
// choice under pressure still weighs more than one afternoon; across a career the
// sum outweighs them, which is exactly the intent.
//
// Returns the axes that actually moved, so a caller can say so if it wants to.
export function driftFromAction(state: GameState, actionId: string): Partial<Record<IdentityAxis, number>> {
  const drift = identityDrift[actionId];
  if (!drift) return {};
  const { driftCap } = DilemmaConfig.axes;
  const applied: Partial<Record<IdentityAxis, number>> = {};
  for (const [axis, delta] of Object.entries(drift) as [IdentityAxis, number][]) {
    const current = state.axes[axis];
    // Two brakes, and both were needed. Diminishing returns make each further
    // afternoon count less, and the cap stops the weeks from taking an axis all the
    // way out: without it, twenty weeks of one activity pinned every axis to ±97,
    // where a dilemma's ±15 does nothing and the game's headline decisions become
    // decoration.
    const damped = delta * (1 - Math.abs(current) / driftCap);
    // Already past what a life alone can buy? Then only decisions move you.
    if (Math.abs(current) >= driftCap && Math.sign(damped) === Math.sign(current)) continue;
    moveAxis(state.axes, axis, damped);
    applied[axis] = damped;
  }
  // Choosing the crew (or yourself) with your time counts the same as choosing it
  // in a dilemma: the bond feels it.
  applyAxisPull(state, applied);
  return applied;
}

// Moves an axis, clamped. Exported because the identity readout and the tests
// both need the same bounds the system uses.
export function moveAxis(axes: IdentityAxes, axis: IdentityAxis, delta: number): void {
  axes[axis] = clamp(axes[axis] + delta, DilemmaConfig.axes.min, DilemmaConfig.axes.max);
}

// Which way an axis leans, in words. Below the threshold it says so instead of
// inventing a label for an MC who has not leaned anywhere yet.
export function axisLean(axes: IdentityAxes, axis: IdentityAxis): { label: string; value: number } {
  // Rounded for reading. The stored value keeps its fraction so that a damped
  // nudge of 0.4 still accumulates instead of rounding away to nothing.
  const value = Math.round(axes[axis]);
  const labels = DilemmaConfig.axes.labels[axis];
  if (Math.abs(value) < DilemmaConfig.axes.leanThreshold) return { label: "Sin definir", value };
  return { label: value > 0 ? labels.high : labels.low, value };
}

export interface DilemmaResolution {
  parts: string[];
  record: DecisionRecord;
}

// Answers the pending dilemma. Applies the option (resources and axes), writes
// the decision into the career's memory, and hands the caller the lines to show.
// No RNG: a decision is the player's, not the dice's.
export function resolveDilemma(state: GameState, optionId: string): DilemmaResolution | null {
  const dilemma = state.pendingDilemma ? findDilemma(state.pendingDilemma) : null;
  if (!dilemma) return null;
  const option = dilemma.options.find((entry) => entry.id === optionId);
  if (!option) return null;

  applyOption(state, option);
  for (const [axis, delta] of Object.entries(option.axes) as [IdentityAxis, number][]) {
    moveAxis(state.axes, axis, delta);
  }
  // A decision lands on people, not only on sliders (Fase 7): choosing the crew
  // warms the crew, choosing yourself cools it.
  applyAxisPull(state, option.axes);

  const record: DecisionRecord = {
    dilemmaId: dilemma.id,
    optionId: option.id,
    week: state.week,
    day: state.day,
    title: dilemma.title,
    choice: option.label,
    outcome: option.outcome,
    axes: option.axes,
  };
  state.decisions.push(record);
  // Keep the memory bounded so a long career cannot bloat the save. The oldest
  // decisions drop first; the axes they moved are already baked in.
  while (state.decisions.length > DilemmaConfig.log.maxDecisions) state.decisions.shift();
  if (!state.seenDilemmas.includes(dilemma.id)) state.seenDilemmas.push(dilemma.id);

  state.pendingDilemma = null;
  state.mode = "career";

  const parts = [option.outcome, ...addXp(state, option.xp ?? 0)];
  return { parts, record };
}

function applyOption(state: GameState, option: DilemmaOption): void {
  state.cash = Math.max(0, state.cash + (option.cash ?? 0));
  state.fans = Math.max(0, state.fans + (option.fans ?? 0));
  state.respect = Math.max(0, state.respect + (option.respect ?? 0));
  state.fame = Math.max(0, state.fame + (option.fame ?? 0));
  state.health = clamp(state.health + (option.health ?? 0), 0, 100);
  state.energy = clamp(state.energy + (option.energy ?? 0), 0, maxEnergy(state));
  state.momentum = clamp(state.momentum + (option.momentum ?? 0), 0, 100);
}

// The career's memory, newest first, for the identity screen.
export function recentDecisions(state: GameState, limit: number): DecisionRecord[] {
  return [...state.decisions].reverse().slice(0, limit);
}

// A one-line read of who this MC is becoming, built only from axes that have
// actually leaned. Empty when nothing has: an MC with no decisions has no label,
// which is the whole point of "mismo origen".
export function identitySummary(state: GameState): string[] {
  const axes: IdentityAxis[] = ["undergroundComercial", "batalleroMusico", "soloCrew", "autenticoPolemico"];
  return axes
    .map((axis) => axisLean(state.axes, axis))
    .filter((lean) => lean.label !== "Sin definir")
    .map((lean) => `${lean.label} (${lean.value > 0 ? "+" : ""}${lean.value})`);
}
