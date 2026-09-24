// The prologue battle (Fase 12 E): a real battle the night before day one.
import { describe, expect, it } from "vitest";
import { createNewState } from "../core/state";
import { createStateRng } from "../services/RandomService";
import { resourceById } from "../data/battle";
import { IntroConfig } from "../data/config/IntroConfig";
import { advanceBattleRound, finishIntroBattle, resolveBattle, startIntroBattle } from "./BattleSystem";
import type { GameState } from "../core/types";

function playOut(state: GameState): void {
  const rng = createStateRng(state);
  startIntroBattle(state, rng);
  while (state.battle && !state.battle.finished) {
    resolveBattle(state, rng, resourceById(state.battle.hand[0]));
    advanceBattleRound(state, rng);
  }
}

describe("prologue battle", () => {
  it("faces the named pieza rival without spending energy", () => {
    const state = createNewState("MC Test", 42);
    const energy = state.energy;
    startIntroBattle(state, createStateRng(state));
    expect(state.mode).toBe("battle");
    expect(state.battle?.intro).toBe(true);
    expect(state.battle?.rivalName).toBe(IntroConfig.rivalName);
    expect(state.battle?.eventName).toBe(IntroConfig.eventName);
    expect(state.energy).toBe(energy);
  });

  it("moves no clock, pays no cash and leaves the rival remembering you", () => {
    const state = createNewState("MC Test", 7);
    const before = { week: state.week, day: state.day, block: state.block, cash: state.cash };
    playOut(state);
    const outcome = finishIntroBattle(state);
    expect(outcome).not.toBeNull();
    expect({ week: state.week, day: state.day, block: state.block, cash: state.cash }).toEqual(before);
    expect(state.mode).toBe("intro");
    expect(state.battle).toBeNull();
    const rivalry = state.rivalries.find((r) => r.name === IntroConfig.rivalName);
    expect(rivalry?.faced).toBe(1);
  });

  it("pays a win only the prologue's nudge", () => {
    for (let seed = 1; seed < 60; seed += 1) {
      const state = createNewState("MC Test", seed);
      playOut(state);
      const won = state.battle?.result === "win";
      const fans = state.fans;
      finishIntroBattle(state);
      if (won) {
        expect(state.fans - fans).toBe(IntroConfig.winReward.fans);
        return;
      }
    }
  });

  it("never collects a normal battle through the prologue path", () => {
    const state = createNewState("MC Test", 3);
    expect(finishIntroBattle(state)).toBeNull();
  });
});
