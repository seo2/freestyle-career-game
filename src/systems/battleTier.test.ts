// Who turns up tonight. With three rivals a stage, the pick is the thing that
// makes a stage have faces instead of a face — and it is weighted by grudge, so
// the rivalry ledger becomes something that happens TO the player.

import { describe, expect, it } from "vitest";
import { createNewState } from "../core/state";
import { createSequenceRng } from "../services/RandomService";
import { pickRival } from "./battleTier";
import { rivalRoster } from "../data/rivals";
import { BattleConfig } from "../data/config/BattleConfig";
import type { GameState, StageId } from "../core/types";

function career(stage: StageId = "plaza"): GameState {
  const state = createNewState("Test", 1);
  state.mode = "career";
  state.stage = stage;
  return state;
}

const poolFor = (stage: StageId): string[] =>
  rivalRoster.filter((rival) => rival.stage === stage).map((rival) => rival.name);

describe("pickRival", () => {
  it("only ever fields someone from the current stage", () => {
    for (const stage of ["pieza", "plaza", "regional", "nacional"] as StageId[]) {
      for (const draw of [0, 0.25, 0.5, 0.75, 0.999]) {
        const chosen = pickRival(career(stage), createSequenceRng([draw]));
        expect(poolFor(stage)).toContain(chosen.name);
      }
    }
  });

  it("can field every rival of a stage, so none is dead content", () => {
    const stage: StageId = "plaza";
    const seen = new Set<string>();
    for (let i = 0; i < 40; i += 1) {
      seen.add(pickRival(career(stage), createSequenceRng([i / 40])).name);
    }
    expect(seen.size).toBe(poolFor(stage).length);
  });

  it("consumes exactly one draw whatever it picks", () => {
    // The trace harness compares byte-identical runs, so a variable draw count
    // would desync every scenario downstream of a battle.
    const state = career();
    const rng = createSequenceRng([0.9, 0.1, 0.1]);
    pickRival(state, rng);
    // The next value must still be the second one in the script.
    expect(rng.next()).toBeCloseTo(0.1, 10);
  });

  it("makes the rival who hates you more likely than a stranger", () => {
    const stage: StageId = "plaza";
    const pool = poolFor(stage);
    const target = pool[pool.length - 1];

    const share = (state: GameState): number => {
      let hits = 0;
      const tries = 200;
      for (let i = 0; i < tries; i += 1) {
        if (pickRival(state, createSequenceRng([i / tries])).name === target) hits += 1;
      }
      return hits / tries;
    };

    const strangers = share(career(stage));
    const grudge = career(stage);
    grudge.rivalries = [
      { name: target, faced: 3, won: 0, lost: 3, heat: BattleConfig.rivalPick.baseWeight * 0 + 100, lastWeek: 1 },
    ];
    expect(share(grudge)).toBeGreaterThan(strangers);
  });

  it("never locks anyone out, however hot the grudge", () => {
    // A rivalry should colour the odds, not replace the roster: meeting only one
    // person for the rest of a stage would be worse than meeting three at random.
    const stage: StageId = "plaza";
    const state = career(stage);
    state.rivalries = [{ name: poolFor(stage)[0], faced: 9, won: 9, lost: 0, heat: 100, lastWeek: 1 }];
    const seen = new Set<string>();
    for (let i = 0; i < 60; i += 1) seen.add(pickRival(state, createSequenceRng([i / 60])).name);
    expect(seen.size).toBe(poolFor(stage).length);
  });
});
