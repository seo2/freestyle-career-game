import { beforeEach, describe, expect, it, vi } from "vitest";
import { createNewState } from "../core/state";
import { createSequenceRng, createStateRng } from "../services/RandomService";
import { battleChoices, battlePrompts, battleRivals } from "../data/battle";
import { BattleConfig } from "../data/config/BattleConfig";
import { DifficultyConfig } from "../data/config/DifficultyConfig";
import type { BattleChoice, Difficulty, GameState, StageId } from "../core/types";
import {
  advanceBattleRound,
  battleDurationBlocks,
  battleEnergyCost,
  battleLabel,
  finishBattle,
  projectedHypeGain,
  resolveBattle,
  startBattle,
} from "./BattleSystem";

// BattleSystem unit tests mock its collaborators (Calendar/Progression) so
// the suite stays hermetic: it verifies battle math, message templates, and
// the exact call order into the other systems, not their internals.
const h = vi.hoisted(() => ({ log: [] as string[] }));

vi.mock("./CalendarSystem", () => ({
  // Mirrors the real formatter so the finish message stays pinned verbatim.
  formatDuration: (blocks: number) => (blocks === 1 ? "1 bloque" : `${blocks} bloques`),
  advanceClock: (state: { block: number }, blocks: number, label: string) => {
    h.log.push(`advanceClock:${blocks}:${label}`);
    const fromBlock = state.block;
    state.block = (state.block + blocks) % 3;
    return {
      messages: [`[clock ${label} ${blocks}]`],
      fx: { label, fromBlock, toBlock: state.block, blocks, daysPassed: 0 },
    };
  },
}));

vi.mock("./ProgressionSystem", () => ({
  addXp: (state: { xp: number }, amount: number) => {
    h.log.push(`addXp:${amount}`);
    state.xp += amount;
    return [`[xp ${amount}]`];
  },
  applyRhythm: (_state: unknown, actionId: string, baseDelta: number) => {
    h.log.push(`applyRhythm:${actionId}:${baseDelta}`);
    return [`[rhythm ${actionId} ${baseDelta}]`];
  },
}));

function choiceById(id: string): BattleChoice {
  const found = battleChoices.find((choice) => choice.id === id);
  if (!found) throw new Error(`unknown choice ${id}`);
  return found;
}

function stateAtStage(stage: StageId, energy: number): GameState {
  const state = createNewState("Test", 1);
  state.mode = "career";
  state.stage = stage;
  state.energy = energy;
  return state;
}

beforeEach(() => {
  h.log.length = 0;
});

describe("battleLabel", () => {
  it("maps each stage to its event label", () => {
    const expected: Record<StageId, string> = {
      pieza: "Batalla casera",
      plaza: "Batalla plaza",
      regional: "Regional",
      nacional: "Nacional",
      internacional: "Internacional",
      estrella: "Festival",
      leyenda: "Leyenda",
    };
    for (const [stage, label] of Object.entries(expected)) {
      expect(battleLabel(stateAtStage(stage as StageId, 80))).toBe(label);
    }
  });
});

describe("battleDurationBlocks", () => {
  it("costs 1 block in the pieza and 2 blocks everywhere else", () => {
    const expected: [StageId, number][] = [
      ["pieza", 1],
      ["plaza", 2],
      ["regional", 2],
      ["nacional", 2],
      ["internacional", 2],
      ["estrella", 2],
      ["leyenda", 2],
    ];
    for (const [stage, blocks] of expected) {
      expect(battleDurationBlocks(stateAtStage(stage, 80))).toBe(blocks);
    }
  });
});

describe("startBattle", () => {
  it("returns false without mutating state or consuming RNG when too tired", () => {
    const state = stateAtStage("pieza", 21); // cost is 22 + 0*3
    const before = JSON.stringify(state);
    const rng = createStateRng(state);
    expect(startBattle(state, rng)).toBe(false);
    expect(JSON.stringify(state)).toBe(before);
    expect(state.battle).toBeNull();
    expect(state.mode).toBe("career");
  });

  it("deducts exactly the stage cost and enters battle mode at the boundary", () => {
    const state = stateAtStage("pieza", 22);
    expect(startBattle(state, createSequenceRng([0]))).toBe(true);
    expect(state.energy).toBe(0);
    expect(state.mode).toBe("battle");
    expect(state.battle).not.toBeNull();
    expect(state.battle?.round).toBe(1);
    expect(state.battle?.maxRounds).toBe(3);
    expect(state.battle?.hype).toBe(50);
    expect(state.battle?.playerScore).toBe(0);
    expect(state.battle?.rivalScore).toBe(0);
    expect(state.battle?.results).toEqual([]);
    expect(state.battle?.pendingResult).toBeNull();
    expect(state.battle?.finished).toBe(false);
    expect(state.battle?.result).toBeNull();
  });

  it("initializes the real rival meters from the tier power", () => {
    const state = stateAtStage("pieza", 80);
    startBattle(state, createSequenceRng([0]));
    // Pieza tier power 3: energy 70 + 3*2 = 76 of 100, hype at the opening 50.
    expect(state.battle?.rivalEnergy).toBe(76);
    expect(state.battle?.rivalEnergyMax).toBe(100);
    expect(state.battle?.rivalHype).toBe(50);
  });

  it("clamps rival energy at its max for overpowered rivals", () => {
    // The old fabricated HUD showed 70 + power*2 on a /100 bar, exceeding it.
    const state = stateAtStage("estrella", 80);
    state.level = 60; // power = 3 + 5*2 + floor(60/3) = 33 -> raw energy 136
    startBattle(state, createSequenceRng([0]));
    expect(state.battle?.rivalPower).toBe(33);
    expect(state.battle?.rivalEnergy).toBe(100);
    expect(state.battle?.rivalEnergyMax).toBe(100);
  });

  it("picks the opening prompt with rng.int(0, prompts-1)", () => {
    const state = stateAtStage("pieza", 80);
    // 0.5 * 6 prompts -> index 3
    expect(startBattle(state, createSequenceRng([0.5]))).toBe(true);
    expect(state.battle?.prompt).toBe(battlePrompts[3]);
  });

  it("scales tier rivals and rewards per stage (level 1)", () => {
    const stages: StageId[] = ["pieza", "plaza", "regional", "nacional", "internacional", "estrella"];
    stages.forEach((stage, idx) => {
      const state = stateAtStage(stage, 80);
      const cost = 22 + idx * 3;
      expect(startBattle(state, createSequenceRng([0]))).toBe(true);
      expect(state.energy).toBe(80 - cost);
      const battle = state.battle;
      expect(battle?.eventName).toBe(battleRivals[idx][0]);
      expect(battle?.rivalName).toBe(battleRivals[idx][1]);
      expect(battle?.rivalStyle).toBe(battleRivals[idx][2]);
      expect(battle?.rivalPower).toBe(3 + idx * 2); // + floor(1/3) = 0
      expect(battle?.rewardCash).toBe(35 + idx * 85);
      expect(battle?.rewardFans).toBe(18 + idx * 95);
      expect(battle?.rewardRespect).toBe(10 + idx * 18);
      expect(battle?.rewardFame).toBe(3 + idx * 25);
      expect(battle?.rewardXp).toBe(48 + idx * 28);
    });
  });

  it("adds level/3 to rival power", () => {
    const state = stateAtStage("pieza", 80);
    state.level = 7;
    startBattle(state, createSequenceRng([0]));
    expect(state.battle?.rivalPower).toBe(3 + 0 + 2); // floor(7/3)
  });
});

// The two read-only helpers exist so the entry cost and the hype preview live
// in exactly one place (BattleScene and ActionsSystem consume them).
describe("battleEnergyCost", () => {
  it("equals what startBattle deducts, across stages", () => {
    const stages: StageId[] = ["pieza", "plaza", "regional", "nacional", "internacional", "estrella", "leyenda"];
    stages.forEach((stage, idx) => {
      const state = stateAtStage(stage, 80);
      const cost = battleEnergyCost(state);
      expect(cost).toBe(22 + idx * 3);
      startBattle(state, createSequenceRng([0]));
      expect(state.energy).toBe(80 - cost);
    });
  });

  it("is the exact gate between refused and accepted entry", () => {
    const state = stateAtStage("plaza", 0);
    state.energy = battleEnergyCost(state) - 1;
    expect(startBattle(state, createSequenceRng([0]))).toBe(false);
    state.energy = battleEnergyCost(state);
    expect(startBattle(state, createSequenceRng([0]))).toBe(true);
  });
});

describe("projectedHypeGain", () => {
  it("equals the hype actually awarded on a won round with the prompt bonus", () => {
    const state = stateAtStage("pieza", 86);
    // start prompt(0) -> battlePrompts[0] (best: respuesta/humor), then a
    // forced player win (.99 player roll, 0 rival roll).
    const rng = createSequenceRng([0, 0.99, 0]);
    startBattle(state, rng);
    const battle = state.battle;
    if (!battle) throw new Error("battle missing");
    const projected = projectedHypeGain(battle, choiceById("respuesta"));
    expect(projected).toBe(16); // winGain 12 + promptBonus 12/3
    resolveBattle(state, rng, choiceById("respuesta"));
    expect(battle.results[0].playerHypeDelta).toBe(projected);
    expect(battle.hype).toBe(50 + projected);
  });

  it("equals the hype actually awarded on a won round without the bonus", () => {
    const state = stateAtStage("pieza", 86);
    const rng = createSequenceRng([0, 0.99, 0]);
    startBattle(state, rng);
    const battle = state.battle;
    if (!battle) throw new Error("battle missing");
    const projected = projectedHypeGain(battle, choiceById("flow")); // off-prompt
    expect(projected).toBe(12); // winGain only
    resolveBattle(state, rng, choiceById("flow"));
    expect(battle.results[0].playerHypeDelta).toBe(projected);
    expect(battle.hype).toBe(50 + projected);
  });
});

describe("resolveBattle", () => {
  it("plays a full win-loss-win match with exact rolls, hype, meters, and verdicts", () => {
    const state = stateAtStage("pieza", 86); // fresh-state stats, momentum 42, health 88
    // Sequence: start prompt(0) | r1 player(.99) rival(0), advance prompt(0)
    //           | r2 player(0) rival(.99), advance prompt(0) | r3 player(.99) rival(0)
    // Same draw count and order as before the round-result beat: the next
    // prompt pick moved from resolveBattle into advanceBattleRound.
    const rng = createSequenceRng([0, 0.99, 0, 0, 0, 0.99, 0, 0.99, 0]);
    startBattle(state, rng); // energy 86 - 22 = 64, prompt = battlePrompts[0]
    const battle = state.battle;
    if (!battle) throw new Error("battle missing");
    expect(battle.prompt).toBe(battlePrompts[0]);

    // Round 1: "respuesta" matches prompt 0's best -> +12 bonus, forced win.
    // player = impro 2*8 + lvl 3 + 12 + energy 4 + health 3 + momentum -1
    //          + presence 0 + hype floor(50/8)=6 + roll 26 = 69
    // rival  = power 3*8 + round 2 + roll 12 = 38
    resolveBattle(state, rng, choiceById("respuesta"));
    expect(battle.results[0]).toEqual({
      round: 1,
      choice: "respuesta",
      player: 69,
      rival: 38,
      note: "El publico reacciona a tu ronda.",
      playerHypeDelta: 16, // winGain 12 + promptBonus 12/3
      playerVerdict: "¡BUENISIMO!",
      rivalHypeDelta: 4, // weak answer still earns a little
      rivalVerdict: "DEBIL",
    });
    expect(battle.playerScore).toBe(1);
    expect(battle.hype).toBe(66); // 50 + 16
    expect(battle.rivalHype).toBe(54); // 50 + 4
    expect(battle.rivalEnergy).toBe(68); // 76 - 8 round drain
    // The battle parks on the round-result beat: same round, same prompt.
    expect(battle.pendingResult).toBe(battle.results[0]);
    expect(battle.round).toBe(1);
    expect(battle.prompt).toBe(battlePrompts[0]);
    expect(battle.finished).toBe(false);

    advanceBattleRound(state, rng); // consumes the next-prompt draw (0)
    expect(battle.pendingResult).toBeNull();
    expect(battle.round).toBe(2);
    expect(battle.prompt).toBe(battlePrompts[0]);

    // Round 2: "flow" off-prompt, forced loss.
    // player = flow 2*8 + 3 + 0 + 4 + 3 - 1 + 0 + floor(66/8)=8 + roll 7 = 40
    // rival  = 24 + 4 + roll 34 = 62
    resolveBattle(state, rng, choiceById("flow"));
    expect(battle.results[1]).toEqual({
      round: 2,
      choice: "flow",
      player: 40,
      rival: 62,
      note: "El rival conecto mas fuerte.",
      playerHypeDelta: -7, // lossDrop
      playerVerdict: "DEBIL",
      rivalHypeDelta: 12, // rival win gain
      rivalVerdict: "BIEN",
    });
    expect(battle.rivalScore).toBe(1);
    expect(battle.hype).toBe(59); // 66 - 7
    expect(battle.rivalHype).toBe(66); // 54 + 12
    expect(battle.rivalEnergy).toBe(60);

    advanceBattleRound(state, rng);
    expect(battle.round).toBe(3);

    // Round 3: "respuesta" again, forced win -> match decided 2-1.
    // player = 16 + 3 + 12 + 4 + 3 - 1 + 0 + floor(59/8)=7 + roll 26 = 70
    // rival  = 24 + 6 + roll 12 = 42
    resolveBattle(state, rng, choiceById("respuesta"));
    expect(battle.results[2]).toEqual({
      round: 3,
      choice: "respuesta",
      player: 70,
      rival: 42,
      note: "El publico reacciona a tu ronda.",
      playerHypeDelta: 16,
      playerVerdict: "¡BUENISIMO!",
      rivalHypeDelta: 4,
      rivalVerdict: "DEBIL",
    });
    // Last round still shows its verdict first; the advance settles the match.
    expect(battle.finished).toBe(false);
    expect(battle.pendingResult).toBe(battle.results[2]);
    expect(battle.hype).toBe(75); // 59 + 16
    expect(battle.rivalHype).toBe(70); // 66 + 4
    expect(battle.rivalEnergy).toBe(52);

    advanceBattleRound(state, rng); // final round: no prompt draw
    expect(battle.pendingResult).toBeNull();
    expect(battle.finished).toBe(true);
    expect(battle.result).toBe("win");
    expect(battle.round).toBe(3); // no increment, no extra prompt pick
    expect(battle.playerScore).toBe(2);
    expect(battle.rivalScore).toBe(1);
  });

  it("ignores choices while a round result is pending", () => {
    const state = stateAtStage("pieza", 86);
    const rng = createSequenceRng([0, 0.99, 0]);
    startBattle(state, rng);
    resolveBattle(state, rng, choiceById("respuesta"));
    const before = JSON.stringify(state);
    resolveBattle(state, createSequenceRng([0.4, 0.4]), choiceById("flow"));
    expect(JSON.stringify(state)).toBe(before);
  });

  it("declares a draw when scores tie after the last round", () => {
    const state = stateAtStage("pieza", 80);
    startBattle(state, createSequenceRng([0]));
    const battle = state.battle;
    if (!battle) throw new Error("battle missing");
    // Hand-craft a 1-0 scoreboard entering round 3, then force a rival win:
    // 1-1 exercises the verbatim draw branch of the result ternary.
    battle.round = 3;
    battle.playerScore = 1;
    battle.rivalScore = 0;
    // player = flow 16 + 3 + 0 + energy 4 + health 3 - 1 + 0 + 6 + roll 7 = 38
    // rival  = 24 + 6 + roll 34 = 64
    resolveBattle(state, createSequenceRng([0, 0.99]), choiceById("flow"));
    expect(battle.finished).toBe(false); // verdict beat first
    advanceBattleRound(state, createSequenceRng([0]));
    expect(battle.finished).toBe(true);
    expect(battle.playerScore).toBe(1);
    expect(battle.rivalScore).toBe(1);
    expect(battle.result).toBe("draw");
  });

  it("is a no-op when the battle is already finished", () => {
    const state = stateAtStage("pieza", 86);
    startBattle(state, createSequenceRng([0]));
    const battle = state.battle;
    if (!battle) throw new Error("battle missing");
    battle.finished = true;
    battle.result = "win";
    const before = JSON.stringify(state);
    resolveBattle(state, createSequenceRng([0.4, 0.4, 0.4]), choiceById("flow"));
    expect(JSON.stringify(state)).toBe(before);
  });

  it("is a no-op without a battle", () => {
    const state = stateAtStage("pieza", 86);
    const before = JSON.stringify(state);
    resolveBattle(state, createSequenceRng([0.4]), choiceById("flow"));
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe("advanceBattleRound", () => {
  it("is a no-op without a pending round result", () => {
    const state = stateAtStage("pieza", 86);
    advanceBattleRound(state, createSequenceRng([0])); // no battle
    expect(state.battle).toBeNull();
    startBattle(state, createSequenceRng([0]));
    const before = JSON.stringify(state);
    advanceBattleRound(state, createSequenceRng([0])); // cards on screen
    expect(JSON.stringify(state)).toBe(before);
  });

  it("is a no-op once the battle is finished", () => {
    const state = stateAtStage("pieza", 86);
    startBattle(state, createSequenceRng([0]));
    if (!state.battle) throw new Error("battle missing");
    state.battle.finished = true;
    state.battle.result = "win";
    const before = JSON.stringify(state);
    advanceBattleRound(state, createSequenceRng([0]));
    expect(JSON.stringify(state)).toBe(before);
  });
});

// The verdict vocabulary is data: the panel words and their thresholds live in
// BattleConfig so tuning them never touches the system.
describe("verdict config", () => {
  it("keeps the mockup vocabulary and threshold ordering", () => {
    expect(BattleConfig.verdict.labels).toEqual({ great: "¡BUENISIMO!", good: "BIEN", weak: "DEBIL" });
    expect(BattleConfig.verdict.greatMin).toBeGreaterThan(BattleConfig.verdict.goodMin);
    // The boosted win reads great, the plain win reads good, the loss weak.
    expect(BattleConfig.hype.winGain + BattleConfig.roll.promptBonus / BattleConfig.hype.winPromptBonusDivisor).toBeGreaterThanOrEqual(BattleConfig.verdict.greatMin);
    expect(BattleConfig.hype.winGain).toBeGreaterThanOrEqual(BattleConfig.verdict.goodMin);
    expect(-BattleConfig.hype.lossDrop).toBeLessThan(BattleConfig.verdict.goodMin);
    // Rival: a won round reads good, the weak-answer consolation reads weak.
    expect(BattleConfig.rival.hypeWinGain).toBeGreaterThanOrEqual(BattleConfig.verdict.goodMin);
    expect(BattleConfig.rival.hypeLossGain).toBeLessThan(BattleConfig.verdict.goodMin);
  });
});

// Difficulty is the one mechanical choice of the Crear MC screen: it moves
// rival power at tier setup and scales the payout at finish time.
describe("difficulty", () => {
  it("keeps a single source of truth for the three difficulty knobs", () => {
    expect(DifficultyConfig.order).toEqual(["facil", "normal", "dificil"]);
    expect(DifficultyConfig.levels.facil.rivalPowerBonus).toBe(-1);
    expect(DifficultyConfig.levels.facil.rewardMultiplier).toBe(1.15);
    expect(DifficultyConfig.levels.normal.rivalPowerBonus).toBe(0);
    expect(DifficultyConfig.levels.normal.rewardMultiplier).toBe(1);
    expect(DifficultyConfig.levels.dificil.rivalPowerBonus).toBe(2);
    expect(DifficultyConfig.levels.dificil.rewardMultiplier).toBe(0.9);
  });

  it("shifts rival power at every stage (pieza base 3, plaza base 5)", () => {
    const expected: [Difficulty, number, number][] = [
      // difficulty, pieza rivalPower, plaza rivalPower
      ["facil", 2, 4],
      ["normal", 3, 5],
      ["dificil", 5, 7],
    ];
    for (const [difficulty, pieza, plaza] of expected) {
      const inRoom = stateAtStage("pieza", 80);
      inRoom.difficulty = difficulty;
      startBattle(inRoom, createSequenceRng([0]));
      expect(inRoom.battle?.rivalPower).toBe(pieza);

      const inPlaza = stateAtStage("plaza", 80);
      inPlaza.difficulty = difficulty;
      startBattle(inPlaza, createSequenceRng([0]));
      expect(inPlaza.battle?.rivalPower).toBe(plaza);
    }
  });

  it("never lets a generous difficulty push rival power below the floor", () => {
    const state = stateAtStage("pieza", 80);
    state.difficulty = "facil";
    startBattle(state, createSequenceRng([0]));
    expect(state.battle?.rivalPower).toBeGreaterThanOrEqual(DifficultyConfig.rivalPowerFloor);
  });

  it("scales the full win payout (pieza tier 35/18/10/3/48)", () => {
    const expected: [Difficulty, number, number, number, number, number][] = [
      // difficulty, cash, fans, respect, fame, xp
      ["facil", 40, 20, 11, 3, 55],
      ["normal", 35, 18, 10, 3, 48],
      ["dificil", 31, 16, 9, 2, 43],
    ];
    for (const [difficulty, cash, fans, respect, fame, xp] of expected) {
      const state = stateAtStage("pieza", 80);
      state.difficulty = difficulty;
      startBattle(state, createSequenceRng([0]));
      if (!state.battle) throw new Error("battle missing");
      state.battle.finished = true;
      state.battle.result = "win";
      const outcome = finishBattle(state, createSequenceRng([0]));
      if (!outcome) throw new Error("expected outcome");
      expect(state.cash).toBe(25 + cash);
      expect(state.fans).toBe(fans);
      expect(state.respect).toBe(respect);
      expect(state.fame).toBe(fame);
      expect(state.xp).toBe(xp);
      expect(outcome.parts[0]).toBe(
        `Ganaste en Cypher de pieza (1 bloque): +$${cash}, +${fans} fans, +${respect} respeto.`,
      );
    }
  });

  it("scales the loss consolation too", () => {
    // Loss split on the pieza tier: 0 cash, floor(18*.22)=3 fans, floor(10*.25)=2 respeto.
    const expected: [Difficulty, number, number][] = [
      ["facil", 3, 2], // floor(3*1.15)=3, floor(2*1.15)=2
      ["normal", 3, 2],
      ["dificil", 2, 1], // floor(3*.9)=2, floor(2*.9)=1
    ];
    for (const [difficulty, fans, respect] of expected) {
      const state = stateAtStage("pieza", 80);
      state.difficulty = difficulty;
      startBattle(state, createSequenceRng([0]));
      if (!state.battle) throw new Error("battle missing");
      state.battle.finished = true;
      state.battle.result = "loss";
      const outcome = finishBattle(state, createSequenceRng([0]));
      expect(state.cash).toBe(25);
      expect(state.fans).toBe(fans);
      expect(state.respect).toBe(respect);
      expect(outcome?.parts[0]).toBe(`Perdiste en Cypher de pieza (1 bloque): +$0, +${fans} fans, +${respect} respeto.`);
    }
  });
});

describe("finishBattle", () => {
  function finishedBattleState(stage: StageId, result: "win" | "loss" | "draw"): GameState {
    const state = stateAtStage(stage, 80);
    startBattle(state, createSequenceRng([0]));
    if (!state.battle) throw new Error("battle missing");
    state.battle.finished = true;
    state.battle.result = result;
    return state;
  }

  it("returns null when there is no finished battle", () => {
    const state = stateAtStage("pieza", 86);
    expect(finishBattle(state, createSequenceRng([0]))).toBeNull();
    startBattle(state, createSequenceRng([0]));
    expect(finishBattle(state, createSequenceRng([0]))).toBeNull(); // not finished
    expect(state.mode).toBe("battle");
  });

  it("pays full rewards on a win and clears the battle", () => {
    const state = finishedBattleState("pieza", "win");
    const outcome = finishBattle(state, createSequenceRng([0]));
    if (!outcome) throw new Error("expected outcome");
    // Pieza tier: cash 35, fans 18, respect 10, fame 3, xp 48; duration 1 block.
    expect(outcome.parts).toEqual([
      "Ganaste en Cypher de pieza (1 bloque): +$35, +18 fans, +10 respeto.",
      "[rhythm battle 18]",
      "[xp 48]",
      "[clock Cypher de pieza 1]",
    ]);
    expect(state.cash).toBe(25 + 35);
    expect(state.fans).toBe(18);
    expect(state.respect).toBe(10);
    expect(state.fame).toBe(3);
    expect(state.xp).toBe(48);
    expect(h.log).toEqual(["addXp:48", "applyRhythm:battle:18", "advanceClock:1:Cypher de pieza"]);
    expect(outcome.fx).toEqual({
      label: "Cypher de pieza",
      fromBlock: 0,
      toBlock: 1,
      blocks: 1,
      daysPassed: 0,
    });
    expect(state.battle).toBeNull();
    expect(state.mode).toBe("career");
  });

  it("pays the draw split with Math.floor on a regional draw", () => {
    const state = finishedBattleState("regional", "draw");
    const outcome = finishBattle(state, createSequenceRng([0]));
    if (!outcome) throw new Error("expected outcome");
    // Regional tier: cash 205, fans 208, respect 46, fame 53, xp 104.
    // Draw: floor(205*.35)=71, floor(208*.45)=93, floor(46*.5)=23,
    //       floor(53*.45)=23, floor(104*.55)=57. Duration 2 blocks.
    expect(outcome.parts[0]).toBe("Empataste en Regional Sur (2 bloques): +$71, +93 fans, +23 respeto.");
    expect(state.cash).toBe(25 + 71);
    expect(state.fans).toBe(93);
    expect(state.respect).toBe(23);
    expect(state.fame).toBe(23);
    expect(state.xp).toBe(57);
    expect(h.log).toEqual(["addXp:57", "applyRhythm:battle:7", "advanceClock:2:Regional Sur"]);
    expect(state.battle).toBeNull();
    expect(state.mode).toBe("career");
  });

  it("pays the consolation split on a loss", () => {
    const state = finishedBattleState("pieza", "loss");
    const outcome = finishBattle(state, createSequenceRng([0]));
    if (!outcome) throw new Error("expected outcome");
    // Loss: cash 0, floor(18*.22)=3, floor(10*.25)=2, floor(3*.2)=0,
    //       floor(48*.32)=15.
    expect(outcome.parts[0]).toBe("Perdiste en Cypher de pieza (1 bloque): +$0, +3 fans, +2 respeto.");
    expect(state.cash).toBe(25);
    expect(state.fans).toBe(3);
    expect(state.respect).toBe(2);
    expect(state.fame).toBe(0);
    expect(state.xp).toBe(15);
    expect(h.log).toEqual(["addXp:15", "applyRhythm:battle:-10", "advanceClock:1:Cypher de pieza"]);
    expect(state.battle).toBeNull();
    expect(state.mode).toBe("career");
  });
});
