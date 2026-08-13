// Relationships (Fase 7): the people who remember what you did.
//
// The plan asks for "RelationshipSystem basico (familia, crew, rivales con
// afinidad); rivalidades persistentes". Two halves, and both exist to make the
// week harder to plan rather than to add a screen of numbers:
//
//   BONDS decay. Affinity only moves up when you show up, and every week that
//   passes without showing up takes some back. That is what turns "descansar"
//   from a wasted block into a choice with a reason, and what makes the cypher
//   more than training. A bond that only ever grew would be bookkeeping.
//
//   RIVALRIES remember. Beating someone raises their heat, and heat buys them
//   power and aggression the next time you meet — so the rival you humiliated
//   in the plaza is waiting for you, and the battle says so out loud. Without
//   this, every battle is the first battle.
//
// Pure functions over GameState. No RNG: what someone remembers about you is
// not a dice roll.

import type { BondId, BondState, GameState, RivalryState } from "../core/types";
import { bondDefs, rivalryLines } from "../data/bonds";
import { RelationshipConfig } from "../data/config/RelationshipConfig";

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

// Interpolates an effect across a bond's affinity, anchored at WHERE THE BOND
// STARTS rather than at zero. That anchor matters: measured against zero, a fresh
// career would already collect the bonus, so adding relationships would silently
// re-tune the battle and rest balance that scripts/playthrough.mjs had just
// measured. Anchored at the start, a new career gets exactly nothing and the
// whole effect is differential — which is what "showing up matters" should mean.
//
// Above the anchor the effect runs to `atMax`; below it, down to `atMin` (which
// is 0 for bonds whose neglect costs the bonus rather than charging a penalty).
function acrossAffinity(affinity: number, bondId: BondId, atMin: number, atMax: number): number {
  const { min, max } = RelationshipConfig.bonds;
  const anchor = bondDefs.find((def) => def.id === bondId)?.start ?? min;
  const value = clamp(affinity, min, max);
  if (value >= anchor) {
    const span = max - anchor;
    return span > 0 ? (atMax * (value - anchor)) / span : atMax;
  }
  const span = anchor - min;
  return span > 0 ? (atMin * (anchor - value)) / span : atMin;
}

export function bondOf(state: GameState, id: BondId): BondState {
  return state.bonds[id] ?? { affinity: 0, fedWeek: 0 };
}

export function affinityOf(state: GameState, id: BondId): number {
  return bondOf(state, id).affinity;
}

// Warm / cold / neither, for the readouts and for the effects that read a
// temperature instead of a number.
export function bondTemperature(state: GameState, id: BondId): "warm" | "cold" | "steady" {
  const affinity = affinityOf(state, id);
  if (affinity >= RelationshipConfig.bonds.warmAt) return "warm";
  if (affinity <= RelationshipConfig.bonds.coldAt) return "cold";
  return "steady";
}

// Showing up. Called with the action the player just lived; every bond that
// counts that action as attention warms up and remembers the week.
export function feedBonds(state: GameState, actionId: string): string[] {
  const messages: string[] = [];
  const { min, max } = RelationshipConfig.bonds;
  for (const def of bondDefs) {
    const gain = def.fedBy[actionId];
    if (!gain) continue;
    const bond = bondOf(state, def.id);
    const before = bond.affinity;
    const after = clamp(before + gain, min, max);
    state.bonds[def.id] = { affinity: after, fedWeek: state.week };
    // Only speak when the bond crosses into warm: a message every single rest
    // would be noise, and the stats screen already shows the number.
    if (before < RelationshipConfig.bonds.warmAt && after >= RelationshipConfig.bonds.warmAt) {
      messages.push(def.warmLine);
    }
  }
  return messages;
}

// A dilemma that chose the crew warms the crew. The axes already moved; this
// makes the choice land on a person instead of only on a slider.
export function applyAxisPull(state: GameState, axisDeltas: Partial<Record<string, number>>): void {
  const { min, max } = RelationshipConfig.bonds;
  for (const def of bondDefs) {
    if (!def.axis) continue;
    const delta = axisDeltas[def.axis.axis];
    if (typeof delta !== "number" || delta === 0) continue;
    // A "low" bond is warmed by movement towards the negative end of its axis.
    const towardsBond = def.axis.towards === "high" ? delta : -delta;
    const bond = bondOf(state, def.id);
    state.bonds[def.id] = {
      affinity: clamp(bond.affinity + towardsBond * def.axis.weight, min, max),
      // A decision is not a visit: it moves the bond without resetting the clock
      // on the decay, or answering dilemmas would replace showing up.
      fedWeek: bond.fedWeek,
    };
  }
}

// --- effects the rest of the game reads ------------------------------------

// What the family adds to (or takes from) a night of rest. This is why
// neglecting the house costs something concrete.
export function restHealthBonus(state: GameState): number {
  const cfg = RelationshipConfig.familia;
  return Math.round(acrossAffinity(affinityOf(state, "familia"), "familia", cfg.restHealthAtMin, cfg.restHealthAtMax));
}

// The hype your crew brings to a battle just by being in the crowd.
export function crewHypeBoost(state: GameState): number {
  const cfg = RelationshipConfig.crew;
  return Math.round(acrossAffinity(affinityOf(state, "crew"), "crew", cfg.hypeAtMin, cfg.hypeAtMax));
}

// --- rivalries -------------------------------------------------------------

export function rivalryWith(state: GameState, rivalName: string): RivalryState | null {
  return state.rivalries.find((entry) => entry.name === rivalName) ?? null;
}

// The grudge a rival carries into this battle: power and aggression, bounded.
export function rivalryEdge(state: GameState, rivalName: string): { power: number; aggression: number } {
  const rivalry = rivalryWith(state, rivalName);
  const cfg = RelationshipConfig.rivalry;
  if (!rivalry || rivalry.heat < cfg.readableAt) return { power: 0, aggression: 0 };
  return {
    power: Math.min(cfg.maxPowerBonus, Math.floor(rivalry.heat / cfg.heatPerPowerPoint)),
    aggression: Math.round((rivalry.heat / cfg.max) * cfg.aggressionAtMaxHeat),
  };
}

// What the battle screen says about this rival's memory of you. Null when there
// is nothing to say — silence is the honest read for a first meeting.
export function rivalryLine(state: GameState, rivalName: string): string | null {
  const rivalry = rivalryWith(state, rivalName);
  if (!rivalry || rivalry.heat < RelationshipConfig.rivalry.readableAt) return null;
  return rivalryLines.find((entry) => rivalry.heat >= entry.from)?.line ?? null;
}

// The record against a rival, in the player's terms, for the stats screen.
export function rivalryRecord(state: GameState, rivalName: string): string {
  const rivalry = rivalryWith(state, rivalName);
  if (!rivalry) return "Sin historia";
  return `${rivalry.won}-${rivalry.lost}`;
}

// Called when a battle ends: the rival remembers. `margin` is rounds won minus
// rounds lost, so a landslide reads as humiliation.
export function recordRivalry(
  state: GameState,
  rivalName: string,
  outcome: "win" | "loss" | "draw",
  margin: number,
): string[] {
  const cfg = RelationshipConfig.rivalry;
  const existing = rivalryWith(state, rivalName);
  const rivalry: RivalryState = existing ?? {
    name: rivalName,
    faced: 0,
    won: 0,
    lost: 0,
    heat: 0,
    lastWeek: state.week,
  };
  const before = rivalry.heat;
  let heat = outcome === "win" ? cfg.heatOnPlayerWin : outcome === "loss" ? cfg.heatOnPlayerLoss : cfg.heatOnDraw;
  const humiliated = outcome === "win" && margin >= cfg.humiliationMargin;
  if (humiliated) heat += cfg.heatOnHumiliation;

  rivalry.faced += 1;
  if (outcome === "win") rivalry.won += 1;
  if (outcome === "loss") rivalry.lost += 1;
  rivalry.heat = clamp(rivalry.heat + heat, 0, cfg.max);
  rivalry.lastWeek = state.week;
  if (!existing) {
    state.rivalries.push(rivalry);
    while (state.rivalries.length > RelationshipConfig.log.maxRivalries) state.rivalries.shift();
  }

  const messages: string[] = [];
  if (humiliated) messages.push(`${rivalName} no va a olvidar esto.`);
  else if (before < cfg.readableAt && rivalry.heat >= cfg.readableAt) messages.push(`${rivalName} te tomo la matricula.`);
  return messages;
}

// --- the weekly bill -------------------------------------------------------

// Called when the week closes: bonds nobody fed cool down and grudges nobody
// renewed fade. Returns what is worth telling the player.
export function decayRelationships(state: GameState): string[] {
  const messages: string[] = [];
  const bonds = RelationshipConfig.bonds;
  for (const def of bondDefs) {
    const bond = bondOf(state, def.id);
    // Fed this week? Then this week costs nothing.
    if (bond.fedWeek >= state.week) continue;
    const before = bond.affinity;
    const after = clamp(before - bonds.decayPerWeek, bonds.min, bonds.max);
    state.bonds[def.id] = { affinity: after, fedWeek: bond.fedWeek };
    // Speak only on the way down across the cold line: that is news.
    if (before > bonds.coldAt && after <= bonds.coldAt) messages.push(def.coldLine);
  }
  const rivalry = RelationshipConfig.rivalry;
  for (const entry of state.rivalries) {
    if (entry.lastWeek >= state.week) continue;
    entry.heat = clamp(entry.heat - rivalry.decayPerWeek, 0, rivalry.max);
  }
  return messages;
}

// The one-line read of where the player stands, for the stats screen.
export function relationshipSummary(state: GameState): string {
  const warm = bondDefs.filter((def) => bondTemperature(state, def.id) === "warm").map((def) => def.label);
  const cold = bondDefs.filter((def) => bondTemperature(state, def.id) === "cold").map((def) => def.label);
  if (cold.length > 0) return `Te estas alejando de: ${cold.join(", ")}.`;
  if (warm.length > 0) return `Te acompañan: ${warm.join(", ")}.`;
  return "Nadie cerca, nadie lejos.";
}
