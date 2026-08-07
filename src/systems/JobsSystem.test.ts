import { describe, expect, it } from "vitest";
import type { ActionResult } from "../core/types";
import { createNewState } from "../core/state";
import { createSequenceRng, createStateRng } from "../services/RandomService";
import { jobOptions } from "../data/jobs";
import { performJob } from "./JobsSystem";

const delivery = jobOptions[0]; // cash 40, energy 16, blocks 1, disciplineChance 0.35
const construction = jobOptions[2]; // cash 62, energy 28, blocks 2, disciplineChance 0.75

function asEvent(result: ActionResult): Extract<ActionResult, { type: "event" }> {
  if (result.type !== "event") throw new Error(`expected event, got ${result.type}`);
  return result;
}

describe("performJob", () => {
  it("blocks the shift below the option energy without consuming rng", () => {
    const state = createNewState("Tester", 42);
    state.energy = 15;
    const result = asEvent(performJob(state, createStateRng(state), delivery));

    expect(result.parts).toEqual(["Estas demasiado cansado para tomar ese turno."]);
    expect(result.fx).toBeNull();
    expect(state.cash).toBe(25);
    expect(state.energy).toBe(15);
    expect(state.seed).toBe(42); // guard path makes zero rng calls
  });

  it("pays out a shift: cash, xp, rhythm and clock", () => {
    const state = createNewState("Tester", 42);
    // rolls: pay bonus 6, discipline 0.5 (>= 0.35, no gain)
    const result = asEvent(performJob(state, createSequenceRng([0.5, 0.5]), delivery));

    expect(result.parts).toEqual(["Repartidor (1 bloque): +$49.", "Impulso +2: Frio."]);
    expect(result.fx).toEqual({
      label: "Repartidor",
      fromBlock: 0,
      toBlock: 1,
      blocks: 1,
      daysPassed: 0,
    });
    expect(state.cash).toBe(74); // 25 + 40 + disciplina 3 + roll 6
    expect(state.stats.disciplina).toBe(1);
    expect(state.xp).toBe(10); // 8 + 1 block * 2
    expect(state.energy).toBe(70);
    expect(state.momentum).toBe(44);
    expect(state.lastActionId).toBe("work-delivery");
  });

  it("computes pay before the discipline gain lands", () => {
    const state = createNewState("Tester", 42);
    state.stats.disciplina = 5;
    // rolls: pay bonus 6, discipline 0.2 (< 0.35, +1)
    const result = asEvent(performJob(state, createSequenceRng([0.5, 0.2]), delivery));

    expect(result.parts[0]).toBe("Repartidor (1 bloque): +$61."); // 40 + 5*3 + 6, pre-gain disciplina
    expect(state.cash).toBe(86);
    expect(state.stats.disciplina).toBe(6);
  });

  it("applies the repeat penalty when grinding the same job", () => {
    const state = createNewState("Tester", 42);
    state.lastActionId = "work-delivery";
    state.actionStreak = 1;
    const result = asEvent(performJob(state, createSequenceRng([0.5, 0.9]), delivery));

    expect(result.parts).toEqual(["Repartidor (1 bloque): +$49.", "Impulso -10: Frio."]);
    expect(state.momentum).toBe(32); // 42 - (2 + repeat 8)
    expect(state.actionStreak).toBe(2);
  });

  it("appends clock messages last when the shift crosses into the next day", () => {
    const state = createNewState("Tester", 42);
    state.block = 1; // Tarde: a 2-block shift runs past the end of the day
    // rolls: pay bonus 6, discipline 0.9 (>= 0.75, no gain)
    const result = asEvent(performJob(state, createSequenceRng([0.5, 0.9]), construction));

    expect(result.parts).toEqual(["Obra (2 bloques): +$71.", "Impulso +2: Frio.", "Paso un dia."]);
    expect(result.fx).toEqual({
      label: "Obra",
      fromBlock: 1,
      toBlock: 0,
      blocks: 2,
      daysPassed: 1,
    });
    expect(state.cash).toBe(96); // 25 + 62 + 3 + 6
    expect(state.xp).toBe(12); // 8 + 2 blocks * 2
    expect(state.day).toBe(2);
    expect(state.energy).toBe(67); // 86 -28, +9 day-rollover recovery
    expect(state.momentum).toBe(41); // 42 +2 rhythm, -3 day rollover
  });

  it("consumes exactly two rng rolls in legacy order", () => {
    const state = createNewState("Tester", 555);
    const ref = { seed: 555 };
    const refRng = createStateRng(ref);
    // Replay the legacy stream: pay bonus int, then discipline roll.
    const expectedEarned = delivery.cash + state.stats.disciplina * 3 + refRng.int(0, 12);
    refRng.next();

    performJob(state, createStateRng(state), delivery);

    expect(state.seed).toBe(ref.seed);
    expect(state.cash).toBe(25 + expectedEarned);
  });
});
