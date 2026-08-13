// Weekly planning (Fase 6, gauntlet 3 v2).
//
// The Bible's main loop is: enter the room -> PLAN THE WEEK -> execute ->
// resolve consequences -> weekly summary -> new week. This system owns the plan
// itself: writing intent into a day, reading what a day holds, running the
// planned day, and rolling the week over into a summary.
//
// Pure functions over GameState, like every other system: they mutate the state
// they are handed and never touch storage, the DOM or Math.random. Executing an
// action is still ActionsSystem's job — this system decides WHAT runs today and
// records WHAT HAPPENED, so the two concerns cannot drift.

import type { GameState, PlannedDayRecord, WeekPlan, WeekSummary } from "../core/types";
import { PlanConfig } from "../data/config/PlanConfig";
import { CalendarConfig } from "../data/config/CalendarConfig";
import { clamp } from "../utils/math";
import { opportunityPlannableOn } from "./OpportunitySystem";

// The plan slot id that means "take the offer scheduled for this day". It is
// not a career action: ActionsSystem knows nothing about it, the controller
// resolves it through OpportunitySystem.
export const OFFER_ACTION_ID = "offer";

// An empty week: every day open. Used for a new career and every week rollover.
export function emptyPlan(): WeekPlan {
  return new Array<string | null>(PlanConfig.week.days).fill(null);
}

export function weekOpeningSnapshot(state: GameState): GameState["weekOpening"] {
  return { cash: state.cash, fans: state.fans, respect: state.respect, fame: state.fame, xp: state.xp };
}

// Days are 1-based in GameState (day 1 = Monday); the plan is 0-based.
function slotOf(day: number): number {
  return clamp(Math.round(day) - 1, 0, PlanConfig.week.days - 1);
}

export function plannedActionFor(state: GameState, day: number): string | null {
  return state.plan[slotOf(day)] ?? null;
}

export function todaysPlan(state: GameState): string | null {
  return plannedActionFor(state, state.day);
}

// The weekday the stage battle sits on. It is what makes the plan a decision
// rather than a list: the week has a fixed appointment you must arrive to with
// something left in the tank.
export function battleDay(): number {
  return PlanConfig.week.battleDay;
}

export function isBattleDay(state: GameState): boolean {
  return state.day === PlanConfig.week.battleDay;
}

// Writing intent into a day costs nothing — deciding is free, executing is not.
// Passing null clears the day. Returns false when the day is out of the week or
// already spent, so the UI can explain instead of silently doing nothing.
export function planDay(state: GameState, day: number, actionId: string | null): boolean {
  if (day < 1 || day > PlanConfig.week.days) return false;
  // A day that already happened cannot be re-planned: the week only moves
  // forward, and the record of a played day is the truth.
  if (day < state.day) return false;
  // The battle is the week's appointment, not a chore you can do any day: it
  // only fits its scheduled weekday. Planning something else there is allowed —
  // skipping the battle is a real decision, not a bug.
  if (actionId === "battle" && day !== PlanConfig.week.battleDay) return false;
  // An offer can only be planned on the day it was scheduled for: that date is
  // the whole reason it is an opportunity and not just another action.
  if (actionId === OFFER_ACTION_ID && !opportunityPlannableOn(state, day)) return false;
  state.plan[slotOf(day)] = actionId;
  return true;
}

export function clearPlan(state: GameState): void {
  for (let day = state.day; day <= PlanConfig.week.days; day += 1) {
    state.plan[slotOf(day)] = null;
  }
}

// Records what a day ended up being. Called as the day is played, so the weekly
// summary is a log rather than a reconstruction.
export function recordDay(
  state: GameState,
  planned: string | null,
  ran: string | null,
  note: string,
  outcome?: PlannedDayRecord["outcome"],
): void {
  const existing = state.weekRecord.find((entry) => entry.day === state.day);
  const record: PlannedDayRecord = { day: state.day, planned, ran, note, ...(outcome ? { outcome } : {}) };
  if (existing) Object.assign(existing, record);
  else state.weekRecord.push(record);
}

// Has today's commitment already been lived? One planned action per day is the
// day's commitment (the mockup gives each day a single slot); the blocks left
// over stay free for room actions, but the plan itself cannot be farmed twice.
export function dayAlreadyLived(state: GameState): boolean {
  return state.weekRecord.some((entry) => entry.day === state.day);
}

// Stamps the result of a battle onto the day it was fought. The battle resolves
// in its own scene and pays out later, so without this the weekly summary could
// never count it (and counting by reading the event wording would break the
// moment the copy changes).
export function recordBattleOutcome(
  state: GameState,
  day: number,
  note: string,
  outcome: "win" | "loss" | "draw",
): void {
  const entry = state.weekRecord.find((record) => record.day === day);
  if (entry) {
    entry.note = note;
    entry.outcome = outcome;
    return;
  }
  state.weekRecord.push({ day, planned: "battle", ran: "battle", note, outcome });
}

// Closes the week: turns the running record into a summary with the resource
// deltas since the week opened, appends it to the bounded history, and hands
// back a fresh plan. Called by the clock when the week rolls over.
export function closeWeek(state: GameState): WeekSummary {
  const opening = state.weekOpening;
  const summary: WeekSummary = {
    week: state.week,
    days: [...state.weekRecord],
    cash: state.cash - opening.cash,
    fans: state.fans - opening.fans,
    respect: state.respect - opening.respect,
    fame: state.fame - opening.fame,
    xp: state.xp - opening.xp,
    battlesWon: state.weekRecord.filter((entry) => entry.outcome === "win").length,
    battlesLost: state.weekRecord.filter((entry) => entry.outcome === "loss").length,
  };
  state.weekLog.push(summary);
  // Keep the history bounded so a long career cannot bloat the save.
  while (state.weekLog.length > PlanConfig.history.maxWeeks) state.weekLog.shift();
  state.weekRecord = [];
  state.plan = emptyPlan();
  // The new week knocks with its own offers (the controller rolls them).
  state.opportunities = [];
  state.weekOpening = weekOpeningSnapshot(state);
  return summary;
}

// The last finished week, for the summary panel.
export function lastWeekSummary(state: GameState): WeekSummary | null {
  return state.weekLog[state.weekLog.length - 1] ?? null;
}

// How much of the week is still unplanned, so the room can nudge without
// nagging ("te quedan 3 dias sin plan").
export function openDays(state: GameState): number {
  let open = 0;
  for (let day = state.day; day <= PlanConfig.week.days; day += 1) {
    if (state.plan[slotOf(day)] === null) open += 1;
  }
  return open;
}

// Blocks left in today, so the UI can say whether the planned day still fits.
export function blocksLeftToday(state: GameState): number {
  return Math.max(0, CalendarConfig.clock.blocksPerDay - state.block);
}
