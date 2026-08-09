import { beforeEach, describe, expect, it, vi } from "vitest";
import { createNewState } from "../core/state";
import { createSequenceRng, createStateRng } from "../services/RandomService";
import { battleChoices, battlePrompts, battleRivals } from "../data/battle";
import { DifficultyConfig } from "../data/config/DifficultyConfig";
import type { BattleChoice, Difficulty, GameState, StageId } from "../core/types";
import { battleDurationBlocks, battleLabel, finishBattle, resolveBattle, startBattle } from "./BattleSystem";

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
    expect(state.battle?.finished).toBe(false);
    expect(state.battle?.result).toBeNull();
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

describe("resolveBattle", () => {
  it("plays a full win-loss-win match with exact rolls, hype, and notes", () => {
    const state = stateAtStage("pieza", 86); // fresh-state stats, momentum 42, health 88
    // Sequence: start prompt(0) | r1 player(.99) rival(0) prompt(0)
    //           | r2 player(0) rival(.99) prompt(0) | r3 player(.99) rival(0)
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
    });
    expect(battle.playerScore).toBe(1);
    expect(battle.hype).toBe(66); // 50 + 12 + 12/3
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
    });
    expect(battle.rivalScore).toBe(1);
    expect(battle.hype).toBe(59); // 66 - 7
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
    });
    expect(battle.finished).toBe(true);
    expect(battle.result).toBe("win");
    expect(battle.round).toBe(3); // no increment, no extra prompt pick
    expect(battle.hype).toBe(75); // 59 + 12 + 4
    expect(battle.playerScore).toBe(2);
    expect(battle.rivalScore).toBe(1);
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
