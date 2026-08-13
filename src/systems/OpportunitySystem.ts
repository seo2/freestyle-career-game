// Scheduled opportunities (Fase 6): rolling them for the week, taking them and
// letting them expire.
//
// An action is always available; an opportunity has a DATE. That is the whole
// point: you plan the week around the Wednesday interview, or you lose it. A
// missed offer is not a punishment the game hides — it says so, because the
// player choosing to let it go is a decision worth feeling.
//
// Pure functions over GameState, RNG only through the injected RandomSource.

import type { GameState, ScheduledOpportunity } from "../core/types";
import type { OpportunityDef } from "../data/opportunities";
import { opportunities } from "../data/opportunities";
import { OpportunityConfig } from "../data/config/OpportunityConfig";
import { PlanConfig } from "../data/config/PlanConfig";
import { stages } from "../data/stages";
import type { RandomSource } from "../services/RandomService";
import { stageIndex } from "../core/derived";
import { clamp } from "../utils/math";

export function findOpportunity(id: string): OpportunityDef | null {
  return opportunities.find((offer) => offer.id === id) ?? null;
}

// The offers that could reach a player at this stage.
function eligible(state: GameState): OpportunityDef[] {
  const reached = stageIndex(state);
  return opportunities.filter((offer) => {
    const needed = stages.findIndex((stage) => stage.id === offer.minStage);
    return needed <= reached;
  });
}

// Rolls the week's offers. Consumes a fixed number of RNG draws — two per slot
// (the chance and the pick) plus one for the day — so the draw count never
// depends on the outcome and the deterministic trace harness stays stable.
export function rollWeekOpportunities(state: GameState, rng: RandomSource): ScheduledOpportunity[] {
  const pool = eligible(state);
  const rolled: ScheduledOpportunity[] = [];
  const { roll } = OpportunityConfig;
  for (let slot = 0; slot < roll.maxPerWeek; slot += 1) {
    const chance = rng.next();
    const pickIndex = pool.length > 0 ? rng.int(0, pool.length - 1) : 0;
    const day = rng.int(roll.earliestDay, roll.latestDay);
    if (chance > roll.chancePerSlot || pool.length === 0) continue;
    const offer = pool[pickIndex];
    // One offer per day, and never twice the same offer in a week: a repeated
    // slot is dropped rather than re-rolled, which keeps the draw count fixed.
    if (rolled.some((entry) => entry.day === day || entry.id === offer.id)) continue;
    rolled.push({ id: offer.id, day, taken: false, missed: false });
  }
  return rolled;
}

export function opportunityOn(state: GameState, day: number): ScheduledOpportunity | null {
  return state.opportunities.find((entry) => entry.day === day && !entry.taken && !entry.missed) ?? null;
}

// Offers whose day has passed without being taken. Called by the clock as days
// roll so a missed chance is announced on the day it dies, not at week's end.
export function expireOpportunities(state: GameState): string[] {
  const notes: string[] = [];
  for (const entry of state.opportunities) {
    if (entry.taken || entry.missed) continue;
    if (entry.day >= state.day) continue;
    entry.missed = true;
    const offer = findOpportunity(entry.id);
    if (offer) notes.push(offer.missedMessage);
  }
  return notes;
}

export interface OpportunityPayout {
  offer: OpportunityDef;
  message: string;
}

// Taking the offer scheduled for today: pays out and marks it taken. Returns
// null when there is nothing to take or the player cannot afford it, so the
// caller can explain instead of silently doing nothing. The clock is advanced by
// the caller (ActionsSystem owns time), keeping this system about the offer.
export function takeOpportunity(state: GameState, day: number): OpportunityPayout | null {
  const entry = opportunityOn(state, day);
  if (!entry) return null;
  const offer = findOpportunity(entry.id);
  if (!offer) return null;
  if (state.energy < offer.energyCost) return null;
  entry.taken = true;
  state.cash += offer.cash ?? 0;
  state.fans = Math.max(0, state.fans + (offer.fans ?? 0));
  state.respect = Math.max(0, state.respect + (offer.respect ?? 0));
  state.fame = Math.max(0, state.fame + (offer.fame ?? 0));
  state.momentum = clamp(state.momentum + offer.momentum, 0, 100);
  return { offer, message: offer.takenMessage };
}

// Mandatory rest (Bible: fatigue and mental health force a break). Below the
// floor every action except resting closes — the game stops letting you dig a
// deeper hole.
export function isBurntOut(state: GameState): boolean {
  return state.health < OpportunityConfig.burnout.healthFloor;
}

export function burnoutReason(): string {
  return OpportunityConfig.burnout.reason;
}

// Offers still live this week, for the planning panel.
export function pendingOpportunities(state: GameState): ScheduledOpportunity[] {
  return state.opportunities.filter((entry) => !entry.taken && !entry.missed && entry.day >= state.day);
}

// The weekday an offer may be planned on: its own day and nothing else. Kept
// here so the calendar and the plan agree on what "scheduled" means.
export function opportunityPlannableOn(state: GameState, day: number): boolean {
  return day >= 1 && day <= PlanConfig.week.days && opportunityOn(state, day) !== null;
}
