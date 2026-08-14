import { describe, expect, it } from "vitest";
import { createNewState } from "../core/state";
import { weeklyCost } from "./LivingSystem";
import { advanceClock } from "./CalendarSystem";
import {
  battleDay,
  blocksLeftToday,
  dayAlreadyLived,
  clearPlan,
  closeWeek,
  emptyPlan,
  isBattleDay,
  lastWeekSummary,
  openDays,
  planDay,
  plannedActionFor,
  recordBattleOutcome,
  recordDay,
  todaysPlan,
} from "./PlanSystem";
import { PlanConfig } from "../data/config/PlanConfig";

describe("emptyPlan", () => {
  it("opens every day of the week", () => {
    const plan = emptyPlan();
    expect(plan).toHaveLength(PlanConfig.week.days);
    expect(plan.every((slot) => slot === null)).toBe(true);
  });

  it("is what a new career starts with", () => {
    const state = createNewState("Test", 1);
    expect(state.plan).toEqual(emptyPlan());
    expect(state.weekRecord).toEqual([]);
    expect(state.weekLog).toEqual([]);
    expect(state.weekOpening).toEqual({ cash: 25, fans: 0, respect: 0, fame: 0, xp: 0 });
  });
});

describe("planDay", () => {
  it("writes intent into a day and reads it back, costing no time or energy", () => {
    const state = createNewState("Test", 1);
    const before = { energy: state.energy, block: state.block, day: state.day };
    expect(planDay(state, 3, "work")).toBe(true);
    expect(plannedActionFor(state, 3)).toBe("work");
    expect(state.energy).toBe(before.energy);
    expect(state.block).toBe(before.block);
    expect(state.day).toBe(before.day);
  });

  it("clears a day when handed null", () => {
    const state = createNewState("Test", 1);
    planDay(state, 2, "train");
    expect(planDay(state, 2, null)).toBe(true);
    expect(plannedActionFor(state, 2)).toBeNull();
  });

  it("refuses days outside the week", () => {
    const state = createNewState("Test", 1);
    expect(planDay(state, 0, "work")).toBe(false);
    expect(planDay(state, PlanConfig.week.days + 1, "work")).toBe(false);
    expect(state.plan).toEqual(emptyPlan());
  });

  it("refuses to rewrite a day that already happened", () => {
    const state = createNewState("Test", 1);
    state.day = 4;
    expect(planDay(state, 3, "work")).toBe(false);
    expect(plannedActionFor(state, 3)).toBeNull();
    // Today itself is still yours to change.
    expect(planDay(state, 4, "work")).toBe(true);
  });

  it("keeps the battle on its scheduled weekday, and lets you skip it", () => {
    const state = createNewState("Test", 1);
    // The appointment is what makes the week a decision: it cannot be moved.
    expect(planDay(state, battleDay(), "battle")).toBe(true);
    expect(planDay(state, battleDay() - 1, "battle")).toBe(false);
    // But nothing forces you to take it: planning work over it is allowed, and
    // that trade-off is the point.
    expect(planDay(state, battleDay(), "work")).toBe(true);
    expect(plannedActionFor(state, battleDay())).toBe("work");
  });

  it("knows when today is the appointment", () => {
    const state = createNewState("Test", 1);
    state.day = battleDay();
    expect(isBattleDay(state)).toBe(true);
    state.day = battleDay() - 1;
    expect(isBattleDay(state)).toBe(false);
  });
});

describe("todaysPlan and openDays", () => {
  it("reads the plan for the day the game is on", () => {
    const state = createNewState("Test", 1);
    planDay(state, 1, "write");
    expect(todaysPlan(state)).toBe("write");
    state.day = 2;
    expect(todaysPlan(state)).toBeNull();
  });

  it("counts only the days still ahead, so a played week is not nagged about", () => {
    const state = createNewState("Test", 1);
    expect(openDays(state)).toBe(PlanConfig.week.days);
    planDay(state, 1, "work");
    planDay(state, 2, "train");
    expect(openDays(state)).toBe(PlanConfig.week.days - 2);
    state.day = 6;
    // Days 1..5 are behind us: only 6 and 7 can still be open.
    expect(openDays(state)).toBe(2);
  });

  it("clears only the days that have not happened yet", () => {
    const state = createNewState("Test", 1);
    planDay(state, 1, "work");
    planDay(state, 5, "train");
    state.day = 3;
    clearPlan(state);
    // The record of a played day survives; the future is wiped.
    expect(plannedActionFor(state, 1)).toBe("work");
    expect(plannedActionFor(state, 5)).toBeNull();
  });
});

describe("recordDay", () => {
  it("logs what a day ended up being, and never duplicates a day", () => {
    const state = createNewState("Test", 1);
    recordDay(state, "work", "work", "Trabajaste.");
    recordDay(state, "work", "rest", "No te alcanzo la energia.");
    expect(state.weekRecord).toHaveLength(1);
    expect(state.weekRecord[0]).toEqual({
      day: 1,
      planned: "work",
      ran: "rest",
      note: "No te alcanzo la energia.",
    });
  });
});

describe("dayAlreadyLived", () => {
  it("marks today spent once its plan has run, so the plan cannot be farmed", () => {
    const state = createNewState("Test", 1);
    expect(dayAlreadyLived(state)).toBe(false);
    recordDay(state, "practice", "practice", "Practicaste.");
    expect(dayAlreadyLived(state)).toBe(true);
    // Tomorrow is a fresh commitment even though the record survives.
    state.day = 2;
    expect(dayAlreadyLived(state)).toBe(false);
  });
});

describe("closeWeek", () => {
  it("summarizes the week that ended with its deltas and hands back a clean week", () => {
    const state = createNewState("Test", 1);
    planDay(state, 4, "work");
    recordDay(state, "work", "work", "Trabajaste en la obra.");
    state.cash += 90;
    state.fans += 12;
    state.respect += 3;
    state.fame += 1;
    state.xp += 40;

    const summary = closeWeek(state);
    expect(summary.week).toBe(1);
    expect(summary.cash).toBe(90);
    expect(summary.fans).toBe(12);
    expect(summary.respect).toBe(3);
    expect(summary.fame).toBe(1);
    expect(summary.xp).toBe(40);
    expect(summary.days).toHaveLength(1);

    // The new week starts clean, and the next summary measures from here.
    expect(state.plan).toEqual(emptyPlan());
    expect(state.weekRecord).toEqual([]);
    expect(state.weekOpening.cash).toBe(state.cash);
    expect(lastWeekSummary(state)).toEqual(summary);
  });

  it("counts battles from the recorded outcome, not from the event wording", () => {
    const state = createNewState("Test", 1);
    // A battle day is first recorded as it starts, then stamped when it ends —
    // the outcome is data, so rewording the event copy cannot break the count.
    recordDay(state, "battle", "battle", "Batalla");
    recordBattleOutcome(state, 1, "Ganaste en Cypher de pieza: +$35.", "win");
    state.day = 2;
    recordDay(state, "battle", "battle", "Batalla");
    recordBattleOutcome(state, 2, "Perdiste en Cypher de pieza: +$0.", "loss");
    const summary = closeWeek(state);
    expect(summary.battlesWon).toBe(1);
    expect(summary.battlesLost).toBe(1);
    expect(summary.days[0].outcome).toBe("win");
  });

  it("stamps a battle day even when the clock rolled past it", () => {
    const state = createNewState("Test", 1);
    recordDay(state, "battle", "battle", "Batalla");
    // The payout advanced the clock into the next day before the stamp lands.
    state.day = 2;
    recordBattleOutcome(state, 1, "Ganaste: +$35.", "win");
    expect(state.weekRecord).toHaveLength(1);
    expect(state.weekRecord[0]).toMatchObject({ day: 1, outcome: "win" });
  });

  it("keeps the history bounded so a long career cannot bloat the save", () => {
    const state = createNewState("Test", 1);
    for (let i = 0; i < PlanConfig.history.maxWeeks + 5; i += 1) {
      state.week = i + 1;
      closeWeek(state);
    }
    expect(state.weekLog).toHaveLength(PlanConfig.history.maxWeeks);
    // The oldest weeks are the ones dropped.
    expect(state.weekLog[0].week).toBe(6);
    expect(state.weekLog[state.weekLog.length - 1].week).toBe(PlanConfig.history.maxWeeks + 5);
  });
});

describe("the clock closes the week", () => {
  it("rolls the plan over exactly when the week turns, labelled with the week that ended", () => {
    const state = createNewState("Test", 1);
    planDay(state, 7, "work");
    recordDay(state, "work", "work", "Trabajaste.");
    // Enough to cover the week's cost of living AND leave the +50 the summary is
    // about, so this test stays about the plan rollover (Fase 9 added the charge).
    const cost = weeklyCost(state);
    state.cash += 50 + cost;
    state.day = 7;
    state.block = 2;

    const result = advanceClock(state, 1, "Descansar");
    expect(state.week).toBe(2);
    expect(state.plan).toEqual(emptyPlan());
    expect(state.weekLog).toHaveLength(1);
    // The summary belongs to week 1, not to the week that is starting.
    expect(state.weekLog[0].week).toBe(1);
    expect(state.weekLog[0].cash).toBe(50);
    expect(result.messages).toContain("Semana 1 cerrada: +$50, +0 fans, +0 respeto.");
  });

  it("does not close anything while the week is still running", () => {
    const state = createNewState("Test", 1);
    advanceClock(state, 3, "Trabajo"); // day 1 -> day 2
    expect(state.week).toBe(1);
    expect(state.weekLog).toEqual([]);
  });
});

describe("blocksLeftToday", () => {
  it("reports what still fits in today", () => {
    const state = createNewState("Test", 1);
    expect(blocksLeftToday(state)).toBe(3);
    state.block = 2;
    expect(blocksLeftToday(state)).toBe(1);
  });
});
