// The cost of living exists so that money is scarce. These tests pin that it
// charges, that it scales, and — the part that matters most — that falling short
// is a setback with a story instead of a wall.

import { describe, expect, it } from "vitest";
import { createNewState } from "../core/state";
import { chargeLiving, weeklyCost } from "./LivingSystem";
import { LivingConfig } from "../data/config/LivingConfig";
import { RelationshipConfig } from "../data/config/RelationshipConfig";
import type { GameState, StageId } from "../core/types";

function career(stage: StageId = "pieza"): GameState {
  const state = createNewState("Test", 1);
  state.mode = "career";
  state.stage = stage;
  return state;
}

describe("weeklyCost", () => {
  it("charges more as the career rises", () => {
    const stages: StageId[] = ["pieza", "plaza", "regional", "nacional"];
    const costs = stages.map((stage) => weeklyCost(career(stage)));
    for (let i = 1; i < costs.length; i += 1) expect(costs[i]).toBeGreaterThan(costs[i - 1]);
  });

  it("stays under what a battle at that stage pays", () => {
    // Living should squeeze hardest at the start and ease as the career grows.
    // If a week ever cost more than winning at that stage pays, the ladder would
    // be a treadmill you cannot get off.
    expect(weeklyCost(career("pieza"))).toBeGreaterThan(0);
    expect(LivingConfig.weeklyPerStage).toBeLessThan(85); // BattleConfig rewardCashPerStage
  });
});

describe("chargeLiving", () => {
  it("takes the week's cost out of the wallet", () => {
    const state = career();
    state.cash = 500;
    const cost = weeklyCost(state);
    const messages = chargeLiving(state);
    expect(state.cash).toBe(500 - cost);
    expect(messages.join(" ")).toContain(String(cost));
  });

  it("empties the wallet rather than going negative", () => {
    const state = career();
    state.cash = 10;
    chargeLiving(state);
    expect(state.cash).toBe(0);
  });

  it("lands a shortfall on the people around you, not on a Game Over", () => {
    // The Bible's rule is that nothing ends the run. Falling short costs the
    // family bond, the week's momentum and some sleep — a story, not a wall.
    const state = career();
    state.cash = 0;
    const familia = state.bonds.familia.affinity;
    const momentum = state.momentum;
    const health = state.health;

    const messages = chargeLiving(state);

    expect(state.bonds.familia.affinity).toBe(familia - LivingConfig.shortfall.familiaPenalty);
    expect(state.momentum).toBe(momentum - LivingConfig.shortfall.momentumPenalty);
    expect(state.health).toBe(health - LivingConfig.shortfall.healthPenalty);
    expect(state.mode).toBe("career"); // still playing
    expect(messages.join(" ")).toContain("casa");
  });

  it("says how much was missing, so the player can plan around it", () => {
    const state = career();
    state.cash = 20;
    const missing = weeklyCost(state) - 20;
    expect(chargeLiving(state).join(" ")).toContain(String(missing));
  });

  it("never pushes a bond or a meter below its floor", () => {
    const state = career();
    state.cash = 0;
    state.bonds.familia = { affinity: 2, fedWeek: 1 };
    state.momentum = 3;
    state.health = 1;
    chargeLiving(state);
    expect(state.bonds.familia.affinity).toBe(RelationshipConfig.bonds.min);
    expect(state.momentum).toBe(0);
    expect(state.health).toBe(0);
  });

  it("does not touch the visit clock: rent is not a visit", () => {
    const state = career();
    state.cash = 0;
    state.bonds.familia = { affinity: 50, fedWeek: 3 };
    chargeLiving(state);
    expect(state.bonds.familia.fedWeek).toBe(3);
  });
});
