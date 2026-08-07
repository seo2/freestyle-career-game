import { describe, expect, it } from "vitest";
import type { ActionResult } from "../core/types";
import { createNewState } from "../core/state";
import { createSequenceRng, createStateRng } from "../services/RandomService";
import { trainSpecificStat } from "./TrainingSystem";

function asEvent(result: ActionResult): Extract<ActionResult, { type: "event" }> {
  if (result.type !== "event") throw new Error(`expected event, got ${result.type}`);
  return result;
}

describe("trainSpecificStat", () => {
  it("blocks training below 14 energy without touching state", () => {
    const state = createNewState("Tester", 42);
    state.energy = 13;
    const result = asEvent(trainSpecificStat(state, createStateRng(state), "flow"));

    expect(result.parts).toEqual(["Necesitas energia para entrenar."]);
    expect(result.fx).toBeNull();
    expect(state.stats.flow).toBe(2);
    expect(state.xp).toBe(0);
    expect(state.energy).toBe(13);
    expect(state.lastActionId).toBeNull();
    expect(state.block).toBe(0);
    expect(state.seed).toBe(42);
  });

  it("trains a stat: +1 level, xp, rhythm and clock", () => {
    const state = createNewState("Tester", 42);
    const result = asEvent(trainSpecificStat(state, createStateRng(state), "flow"));

    expect(result.parts).toEqual(["Entrenaste Flow: +1 nivel.", "Impulso +9: Frio."]);
    expect(result.fx).toEqual({
      label: "Entrenar Flow",
      fromBlock: 0,
      toBlock: 1,
      blocks: 1,
      daysPassed: 0,
    });
    expect(state.stats.flow).toBe(3);
    expect(state.xp).toBe(20);
    expect(state.energy).toBe(72);
    expect(state.momentum).toBe(51);
    expect(state.lastActionId).toBe("train-flow");
    expect(state.actionStreak).toBe(1);
    expect(state.seed).toBe(42); // training consumes no randomness
  });

  it("computes the discipline bonus before raising the stat", () => {
    const state = createNewState("Tester", 42);
    state.stats.disciplina = 9; // floor(9/5)=1 before the +1; floor(10/5)=2 after
    const result = asEvent(trainSpecificStat(state, createStateRng(state), "disciplina"));

    expect(result.parts[0]).toBe("Entrenaste Disciplina: +1 nivel.");
    expect(state.stats.disciplina).toBe(10);
    expect(state.xp).toBe(23); // 20 + bonus 1 + disciplina extra 2
  });

  it("places level-up messages after rhythm and before time messages", () => {
    const state = createNewState("Tester", 42);
    state.xp = 55; // 55 + 20 crosses xpNext 70
    const result = asEvent(trainSpecificStat(state, createStateRng(state), "flow"));

    expect(result.parts).toEqual([
      "Entrenaste Flow: +1 nivel.",
      "Impulso +9: Frio.",
      "Subiste a nivel 2: +1 Impro.",
    ]);
    expect(state.level).toBe(2);
    expect(state.xp).toBe(5);
    expect(state.xpNext).toBe(103);
    expect(state.stats.improvisacion).toBe(3);
    expect(state.energy).toBe(81); // level-up refill to cap 95, then -14
  });

  it("appends clock messages last when the session closes the day", () => {
    const state = createNewState("Tester", 42);
    state.block = 2; // Noche: night penalty applies and 1 block rolls the day
    const result = asEvent(trainSpecificStat(state, createSequenceRng([0.5]), "flow"));

    expect(result.parts).toEqual([
      "Entrenaste Flow: +1 nivel.",
      "Impulso +6: Frio.",
      "Paso un dia.",
    ]);
    expect(result.fx).toEqual({
      label: "Entrenar Flow",
      fromBlock: 2,
      toBlock: 0,
      blocks: 1,
      daysPassed: 1,
    });
    expect(state.day).toBe(2);
    expect(state.momentum).toBe(45); // 42 +6 rhythm, -3 day rollover
    expect(state.energy).toBe(81); // 86 -14, +9 day-rollover recovery
  });
});
