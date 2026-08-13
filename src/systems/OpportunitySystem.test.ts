import { describe, expect, it } from "vitest";
import { createNewState } from "../core/state";
import { createSequenceRng } from "../services/RandomService";
import { getCareerActions } from "./ActionsSystem";
import {
  burnoutReason,
  expireOpportunities,
  findOpportunity,
  isBurntOut,
  opportunityOn,
  opportunityPlannableOn,
  pendingOpportunities,
  rollWeekOpportunities,
  takeOpportunity,
} from "./OpportunitySystem";
import { OFFER_ACTION_ID, planDay } from "./PlanSystem";
import { OpportunityConfig } from "../data/config/OpportunityConfig";
import { opportunities } from "../data/opportunities";
import type { GameState } from "../core/types";

function career(stage: GameState["stage"] = "pieza"): GameState {
  const state = createNewState("Test", 1);
  state.mode = "career";
  state.stage = stage;
  return state;
}

describe("rollWeekOpportunities", () => {
  it("consumes the same number of RNG draws whatever it rolls", () => {
    // Three draws per slot (chance, pick, day): the count must not depend on the
    // outcome, or the deterministic trace harness would drift.
    const count = (draws: number[]): number => {
      let used = 0;
      const rng = {
        next: () => {
          used += 1;
          return draws[used - 1] ?? 0;
        },
        int: (min: number, max: number) => {
          used += 1;
          const value = draws[used - 1] ?? 0;
          return min + Math.floor(value * (max - min + 1));
        },
      };
      rollWeekOpportunities(career(), rng);
      return used;
    };
    // Everything rolls (low chance values pass) vs nothing rolls (high values).
    expect(count([0, 0, 0, 0, 0, 0])).toBe(OpportunityConfig.roll.maxPerWeek * 3);
    expect(count([0.99, 0, 0, 0.99, 0, 0])).toBe(OpportunityConfig.roll.maxPerWeek * 3);
  });

  it("schedules offers inside the planning window, never on the battle day", () => {
    const state = career();
    // Walk many seeds so every reachable day is exercised.
    for (let seed = 0; seed < 40; seed += 1) {
      const rolled = rollWeekOpportunities(state, createSequenceRng([0.1, seed / 40, seed / 40, 0.1, seed / 41, seed / 41]));
      for (const entry of rolled) {
        expect(entry.day).toBeGreaterThanOrEqual(OpportunityConfig.roll.earliestDay);
        expect(entry.day).toBeLessThanOrEqual(OpportunityConfig.roll.latestDay);
      }
    }
  });

  it("never rolls two offers on the same day, nor the same offer twice", () => {
    const state = career("regional");
    for (let seed = 0; seed < 40; seed += 1) {
      const rolled = rollWeekOpportunities(state, createSequenceRng([0.1, seed / 40, 0.3, 0.1, seed / 40, 0.3]));
      const days = rolled.map((entry) => entry.day);
      const ids = rolled.map((entry) => entry.id);
      expect(new Set(days).size).toBe(days.length);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("only offers what the stage has reached", () => {
    const rookie = rollWeekOpportunities(career("pieza"), createSequenceRng([0, 0.99, 0.5, 0, 0.99, 0.5]));
    for (const entry of rookie) {
      expect(findOpportunity(entry.id)?.minStage).toBe("pieza");
    }
    // A later stage can still draw the early offers plus its own.
    const veteran = rollWeekOpportunities(career("regional"), createSequenceRng([0, 0.99, 0.5, 0, 0.9, 0.4]));
    expect(veteran.length).toBeGreaterThan(0);
  });
});

describe("taking an offer", () => {
  it("pays what the offer promises and marks it taken", () => {
    const state = career();
    state.opportunities = [{ id: "entrevista-radio", day: 3, taken: false, missed: false }];
    const offer = findOpportunity("entrevista-radio");
    if (!offer) throw new Error("offer missing");
    const before = { cash: state.cash, fans: state.fans, respect: state.respect, fame: state.fame };

    const payout = takeOpportunity(state, 3);
    expect(payout?.offer.id).toBe("entrevista-radio");
    expect(state.fans).toBe(before.fans + (offer.fans ?? 0));
    expect(state.respect).toBe(before.respect + (offer.respect ?? 0));
    expect(state.fame).toBe(before.fame + (offer.fame ?? 0));
    expect(state.cash).toBe(before.cash + (offer.cash ?? 0));
    expect(state.opportunities[0].taken).toBe(true);
    // Taken means gone: it cannot be milked twice.
    expect(takeOpportunity(state, 3)).toBeNull();
  });

  it("refuses when the energy is not there, leaving the offer alive", () => {
    const state = career();
    state.opportunities = [{ id: "cypher-sorpresa", day: 3, taken: false, missed: false }];
    state.energy = 1;
    expect(takeOpportunity(state, 3)).toBeNull();
    expect(state.opportunities[0].taken).toBe(false);
    expect(state.opportunities[0].missed).toBe(false);
  });

  it("respects negative sides of an offer (a sponsor costs respect)", () => {
    const state = career("plaza");
    state.respect = 30;
    state.opportunities = [{ id: "sponsor-local", day: 3, taken: false, missed: false }];
    takeOpportunity(state, 3);
    const offer = findOpportunity("sponsor-local");
    expect(state.respect).toBe(30 + (offer?.respect ?? 0));
    expect(offer?.respect).toBeLessThan(0);
  });
});

describe("expiry", () => {
  it("kills an offer whose day has passed, and says which one", () => {
    const state = career();
    state.opportunities = [{ id: "entrevista-radio", day: 2, taken: false, missed: false }];
    state.day = 2;
    expect(expireOpportunities(state)).toEqual([]); // still today

    state.day = 3;
    const notes = expireOpportunities(state);
    expect(notes).toEqual([findOpportunity("entrevista-radio")?.missedMessage]);
    expect(state.opportunities[0].missed).toBe(true);
    // It only dies once, however many times the clock moves afterwards.
    expect(expireOpportunities(state)).toEqual([]);
  });

  it("leaves a taken offer alone", () => {
    const state = career();
    state.opportunities = [{ id: "entrevista-radio", day: 2, taken: true, missed: false }];
    state.day = 5;
    expect(expireOpportunities(state)).toEqual([]);
    expect(state.opportunities[0].missed).toBe(false);
  });

  it("lists only what is still on the table", () => {
    const state = career();
    state.opportunities = [
      { id: "entrevista-radio", day: 2, taken: true, missed: false },
      { id: "cypher-sorpresa", day: 4, taken: false, missed: false },
      { id: "pega-de-fin-de-semana", day: 5, taken: false, missed: true },
    ];
    state.day = 3;
    expect(pendingOpportunities(state).map((entry) => entry.id)).toEqual(["cypher-sorpresa"]);
  });
});

describe("planning an offer", () => {
  it("can only be planned on the day it was scheduled for", () => {
    const state = career();
    state.opportunities = [{ id: "cypher-sorpresa", day: 4, taken: false, missed: false }];
    expect(opportunityPlannableOn(state, 4)).toBe(true);
    expect(opportunityPlannableOn(state, 3)).toBe(false);
    expect(planDay(state, 4, OFFER_ACTION_ID)).toBe(true);
    expect(planDay(state, 3, OFFER_ACTION_ID)).toBe(false);
  });

  it("cannot be planned once it is gone", () => {
    const state = career();
    state.opportunities = [{ id: "cypher-sorpresa", day: 4, taken: false, missed: true }];
    expect(opportunityOn(state, 4)).toBeNull();
    expect(planDay(state, 4, OFFER_ACTION_ID)).toBe(false);
  });
});

describe("mandatory rest", () => {
  it("closes everything but resting below the health floor", () => {
    const state = career();
    state.health = OpportunityConfig.burnout.healthFloor - 1;
    expect(isBurntOut(state)).toBe(true);
    const actions = getCareerActions(state);
    for (const action of actions) {
      if (action.id === "rest") expect(action.disabledReason).toBeUndefined();
      else expect(action.disabledReason).toBe(burnoutReason());
    }
  });

  it("leaves a healthy MC alone", () => {
    const state = career();
    state.health = OpportunityConfig.burnout.healthFloor;
    expect(isBurntOut(state)).toBe(false);
    const practice = getCareerActions(state).find((action) => action.id === "practice");
    expect(practice?.disabledReason).toBeUndefined();
  });
});

describe("the offer catalogue", () => {
  it("keeps every offer honest: a cost, a payoff and both messages", () => {
    for (const offer of opportunities) {
      expect(offer.energyCost).toBeGreaterThan(0);
      expect(offer.blocks).toBeGreaterThan(0);
      const payoff =
        (offer.cash ?? 0) + (offer.fans ?? 0) + (offer.respect ?? 0) + (offer.fame ?? 0) + (offer.xp ?? 0);
      expect(payoff).not.toBe(0);
      expect(offer.takenMessage.length).toBeGreaterThan(0);
      expect(offer.missedMessage.length).toBeGreaterThan(0);
    }
  });

  it("has no duplicate ids", () => {
    const ids = opportunities.map((offer) => offer.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
