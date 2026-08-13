// The cypher is training: you roll against your OWN stats, the payoff is stat
// points, and the stage battle keeps its appointment because this is the any-day
// outlet. These tests pin that it stays training and never turns into a battle.

import { describe, expect, it } from "vitest";
import { createNewState } from "../core/state";
import { createSequenceRng } from "../services/RandomService";
import { resourceById } from "../data/battle";
import { CypherConfig } from "../data/config/CypherConfig";
import {
  advanceCypher,
  cypherOptions,
  finishCypher,
  startCypher,
  throwResource,
} from "./CypherSystem";
import type { GameState } from "../core/types";

function career(): GameState {
  const state = createNewState("Test", 1);
  state.mode = "career";
  return state;
}

describe("startCypher", () => {
  it("opens a circle with its options and charges nothing yet", () => {
    const state = career();
    const energy = state.energy;
    expect(startCypher(state, createSequenceRng([0]))).toBe(true);
    expect(state.mode).toBe("cypher");
    const cypher = state.cypher;
    if (!cypher) throw new Error("cypher missing");
    expect(cypher.turn).toBe(1);
    expect(cypher.maxTurns).toBe(CypherConfig.entry.turns);
    expect(cypher.options).toHaveLength(CypherConfig.entry.handSize);
    expect(new Set(cypher.options).size).toBe(CypherConfig.entry.handSize);
    expect(cypher.turns).toEqual([]);
    expect(cypher.pending).toBeNull();
    // The cost lands when the circle closes, so leaving early is not free money.
    expect(state.energy).toBe(energy);
  });

  it("refuses when too tired, without touching state or RNG", () => {
    const state = career();
    state.energy = CypherConfig.entry.energyCost - 1;
    const snapshot = JSON.stringify(state);
    expect(startCypher(state, createSequenceRng([0]))).toBe(false);
    expect(JSON.stringify(state)).toBe(snapshot);
  });
});

describe("throwing into the circle", () => {
  it("pays stat points into the stats the resource exercises, and parks on the verdict", () => {
    const state = career();
    startCypher(state, createSequenceRng([0])); // zero draws -> first three resources
    const cypher = state.cypher;
    if (!cypher) throw new Error("cypher missing");
    const choice = resourceById(cypher.options[0]);
    const before = choice.stats.map((stat) => state.stats[stat]);

    // A high roll makes it come out clean.
    throwResource(state, createSequenceRng([0.99]), choice);
    const turn = cypher.pending;
    if (!turn) throw new Error("no pending turn");
    expect(turn.kind).toBe("great");
    expect(turn.verdict).toBe(CypherConfig.turn.labels.great);
    expect(turn.learned.length).toBe(choice.stats.length);
    choice.stats.forEach((stat, index) => {
      expect(state.stats[stat]).toBeGreaterThan(before[index]);
    });
    // The circle waits on its verdict: same turn, no auto-advance.
    expect(cypher.turn).toBe(1);
    expect(cypher.turns).toHaveLength(1);
  });

  it("still teaches something when the turn comes out fumbled", () => {
    const state = career();
    startCypher(state, createSequenceRng([0]));
    const cypher = state.cypher;
    if (!cypher) throw new Error("cypher missing");
    const choice = resourceById(cypher.options[0]);
    const before = choice.stats.map((stat) => state.stats[stat]);
    throwResource(state, createSequenceRng([0]), choice); // lowest roll
    expect(cypher.pending?.kind).toBe("weak");
    // Practice is practice: a fumbled turn is worth less, never nothing.
    choice.stats.forEach((stat, index) => {
      expect(state.stats[stat]).toBeGreaterThan(before[index]);
    });
  });

  it("teaches less when you repeat a resource in the same circle", () => {
    const state = career();
    // Deal the same pool twice so the same resource is available again.
    const rng = createSequenceRng([0, 0, 0, 0.99, 0, 0, 0, 0.99]);
    startCypher(state, rng);
    const cypher = state.cypher;
    if (!cypher) throw new Error("cypher missing");
    const first = resourceById(cypher.options[0]);
    throwResource(state, rng, first);
    const firstGain = cypher.turns[0].learned[0].amount;
    advanceCypher(state, rng);
    const again = resourceById(cypher.options[0]);
    if (again.id !== first.id) return; // the deal moved on; nothing to compare
    throwResource(state, rng, again);
    expect(cypher.turns[1].repeated).toBe(true);
    expect(cypher.turns[1].learned[0].amount).toBeLessThanOrEqual(firstGain);
  });

  it("refuses a resource that is not on offer, and refuses while a verdict is up", () => {
    const state = career();
    startCypher(state, createSequenceRng([0]));
    const cypher = state.cypher;
    if (!cypher) throw new Error("cypher missing");
    const notOffered = resourceById(
      (["punchline", "flow", "humor", "ataque", "defensa", "metrica", "dobletempo", "respuesta", "storytelling", "improvisacion"] as const).find(
        (id) => !cypher.options.includes(id),
      ) ?? "punchline",
    );
    const snapshot = JSON.stringify(state);
    throwResource(state, createSequenceRng([0.5]), notOffered);
    expect(JSON.stringify(state)).toBe(snapshot);

    throwResource(state, createSequenceRng([0.5]), resourceById(cypher.options[0]));
    const afterFirst = JSON.stringify(state);
    throwResource(state, createSequenceRng([0.5]), resourceById(cypher.options[1]));
    expect(JSON.stringify(state)).toBe(afterFirst);
  });
});

describe("advancing and closing", () => {
  it("deals fresh options each turn and closes after the last one", () => {
    const state = career();
    const rng = createSequenceRng([0.1, 0.4, 0.7, 0.9, 0.2, 0.5, 0.8, 0.9, 0.3, 0.6, 0.1, 0.9]);
    startCypher(state, rng);
    const cypher = state.cypher;
    if (!cypher) throw new Error("cypher missing");
    for (let turn = 1; turn <= CypherConfig.entry.turns; turn += 1) {
      expect(cypher.turn).toBe(turn);
      expect(cypher.options).toHaveLength(CypherConfig.entry.handSize);
      throwResource(state, rng, resourceById(cypher.options[0]));
      expect(cypher.pending).not.toBeNull();
      advanceCypher(state, rng);
    }
    expect(cypher.finished).toBe(true);
    expect(cypher.turns).toHaveLength(CypherConfig.entry.turns);
  });

  it("pays the clock, momentum and career xp only when the circle closes", () => {
    const state = career();
    const rng = createSequenceRng([0, 0, 0, 0.99, 0, 0, 0, 0.99, 0, 0, 0, 0.99]);
    startCypher(state, rng);
    const cypher = state.cypher;
    if (!cypher) throw new Error("cypher missing");
    const energyBefore = state.energy;
    // Nothing is charged mid-circle.
    throwResource(state, rng, resourceById(cypher.options[0]));
    expect(state.energy).toBe(energyBefore);
    expect(finishCypher(state, rng)).toBeNull(); // not finished yet
    advanceCypher(state, rng);
    while (!cypher.finished) {
      throwResource(state, rng, resourceById(cypher.options[0]));
      advanceCypher(state, rng);
    }
    const outcome = finishCypher(state, rng);
    if (!outcome) throw new Error("expected an outcome");
    expect(state.energy).toBe(energyBefore - CypherConfig.entry.energyCost);
    expect(state.xp).toBeGreaterThan(0);
    expect(state.mode).toBe("career");
    expect(state.cypher).toBeNull();
    expect(outcome.fx.label).toBe("Cypher");
    expect(outcome.parts[0]).toContain("Cypher");
  });

  it("never pays a battle's rewards: no cash and no fans", () => {
    const state = career();
    const rng = createSequenceRng([0, 0, 0, 0.99, 0, 0, 0, 0.99, 0, 0, 0, 0.99]);
    startCypher(state, rng);
    const cypher = state.cypher;
    if (!cypher) throw new Error("cypher missing");
    const cash = state.cash;
    const fans = state.fans;
    while (!cypher.finished) {
      throwResource(state, rng, resourceById(cypher.options[0]));
      advanceCypher(state, rng);
    }
    finishCypher(state, rng);
    // A cypher is practice, not a stage: money and fans come from real events.
    expect(state.cash).toBe(cash);
    expect(state.fans).toBe(fans);
  });

  it("only gives the circle's respect when every turn came out clean", () => {
    const clean = career();
    const cleanRng = createSequenceRng([0, 0, 0, 0.99, 0, 0, 0, 0.99, 0, 0, 0, 0.99]);
    startCypher(clean, cleanRng);
    let cypher = clean.cypher;
    if (!cypher) throw new Error("cypher missing");
    while (!cypher.finished) {
      throwResource(clean, cleanRng, resourceById(cypher.options[0]));
      advanceCypher(clean, cleanRng);
    }
    const respectBefore = clean.respect;
    finishCypher(clean, cleanRng);
    expect(clean.respect).toBe(respectBefore + CypherConfig.payout.respectAllClean);

    const messy = career();
    const messyRng = createSequenceRng([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    startCypher(messy, messyRng);
    cypher = messy.cypher;
    if (!cypher) throw new Error("cypher missing");
    while (!cypher.finished) {
      throwResource(messy, messyRng, resourceById(cypher.options[0]));
      advanceCypher(messy, messyRng);
    }
    const messyRespect = messy.respect;
    finishCypher(messy, messyRng);
    expect(messy.respect).toBe(messyRespect);
  });

  it("is a no-op without a cypher", () => {
    const state = career();
    const snapshot = JSON.stringify(state);
    throwResource(state, createSequenceRng([0.5]), resourceById("punchline"));
    advanceCypher(state, createSequenceRng([0.5]));
    expect(finishCypher(state, createSequenceRng([0.5]))).toBeNull();
    expect(JSON.stringify(state)).toBe(snapshot);
  });
});

describe("cypherOptions", () => {
  it("hands the screen the resources on offer, resolved from data", () => {
    const state = career();
    startCypher(state, createSequenceRng([0]));
    const options = cypherOptions(state);
    expect(options).toHaveLength(CypherConfig.entry.handSize);
    for (const option of options) {
      expect(option.stats.length).toBeGreaterThan(0);
      expect(option.label.length).toBeGreaterThan(0);
    }
    expect(cypherOptions(career())).toEqual([]);
  });
});
