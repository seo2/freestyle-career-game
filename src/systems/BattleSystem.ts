// Battle flow: tier setup, per-round resolution, and reward payout.
// Pure state mutation — the orchestrator owns UI focus, views, and event
// finalization (this module never touches state.lastEvent or saves).

import type { BattleChoice, BattlePrompt, BattleState, GameState, TimeAdvance } from "../core/types";
import { maxEnergy, stageIndex } from "../core/derived";
import { clamp } from "../utils/math";
import type { RandomSource } from "../services/RandomService";
import { battlePrompts, battleRivals } from "../data/battle";
import { BattleConfig } from "../data/config/BattleConfig";
import { DifficultyConfig, difficultyRules } from "../data/config/DifficultyConfig";
import { advanceClock, formatDuration } from "./CalendarSystem";
import { addXp, applyRhythm } from "./ProgressionSystem";

export function battleLabel(state: GameState): string {
  switch (state.stage) {
    case "pieza":
      return "Batalla casera";
    case "plaza":
      return "Batalla plaza";
    case "regional":
      return "Regional";
    case "nacional":
      return "Nacional";
    case "internacional":
      return "Internacional";
    case "estrella":
      return "Festival";
    case "leyenda":
      return "Leyenda";
  }
}

export function battleDurationBlocks(state: GameState): number {
  return stageIndex(state) === 0 ? BattleConfig.duration.piezaBlocks : BattleConfig.duration.otherStagesBlocks;
}

// Returns false (no mutation, no RNG consumed) when too tired to enter.
export function startBattle(state: GameState, rng: RandomSource): boolean {
  const cost = BattleConfig.entry.energyCostBase + stageIndex(state) * BattleConfig.entry.energyCostPerStage;
  if (state.energy < cost) return false;
  state.energy = clamp(state.energy - cost, 0, maxEnergy(state));
  const tier = getBattleTier(state);
  state.mode = "battle";
  state.battle = {
    ...tier,
    round: 1,
    maxRounds: BattleConfig.rounds.maxRounds,
    hype: BattleConfig.rounds.openingHype,
    playerScore: 0,
    rivalScore: 0,
    prompt: pickPrompt(rng),
    results: [],
    finished: false,
    result: null,
  };
  return true;
}

type BattleTier = Omit<
  BattleState,
  "round" | "maxRounds" | "hype" | "playerScore" | "rivalScore" | "prompt" | "results" | "finished" | "result"
>;

function getBattleTier(state: GameState): BattleTier {
  const idx = stageIndex(state);
  const picked = battleRivals[idx] ?? battleRivals[0];
  const tier = BattleConfig.tier;
  // Difficulty is the one mechanical choice of the Crear MC screen: it shifts
  // how strong every rival is (and, at payout time, how much a battle pays).
  const difficulty = difficultyRules(state.difficulty);
  return {
    eventName: picked[0],
    rivalName: picked[1],
    rivalStyle: picked[2],
    rivalPower: Math.max(
      DifficultyConfig.rivalPowerFloor,
      tier.rivalPowerBase +
        idx * tier.rivalPowerPerStage +
        Math.floor(state.level / tier.rivalPowerLevelDivisor) +
        difficulty.rivalPowerBonus,
    ),
    rewardCash: tier.rewardCashBase + idx * tier.rewardCashPerStage,
    rewardFans: tier.rewardFansBase + idx * tier.rewardFansPerStage,
    rewardRespect: tier.rewardRespectBase + idx * tier.rewardRespectPerStage,
    rewardFame: tier.rewardFameBase + idx * tier.rewardFamePerStage,
    rewardXp: tier.rewardXpBase + idx * tier.rewardXpPerStage,
  };
}

function pickPrompt(rng: RandomSource): BattlePrompt {
  return battlePrompts[rng.int(0, battlePrompts.length - 1)];
}

export function resolveBattle(state: GameState, rng: RandomSource, choice: BattleChoice): void {
  const battle = state.battle;
  if (!battle || battle.finished) return;
  const roll = BattleConfig.roll;
  const statValue = state.stats[choice.stat];
  const promptBonus = battle.prompt.best.includes(choice.id) ? roll.promptBonus : 0;
  const energyBonus =
    state.energy > roll.highEnergyThreshold
      ? roll.highEnergyBonus
      : state.energy < roll.lowEnergyThreshold
        ? roll.lowEnergyPenalty
        : 0;
  const healthBonus =
    state.health > roll.highHealthThreshold
      ? roll.highHealthBonus
      : state.health < roll.lowHealthThreshold
        ? roll.lowHealthPenalty
        : 0;
  const momentumBonus = Math.floor((state.momentum - roll.momentumPivot) / roll.momentumDivisor);
  const presenceBonus =
    state.outfitLevel * roll.outfitPresenceWeight +
    (state.stage === "pieza" ? 0 : state.outfitLevel * roll.offPiezaOutfitWeight);
  const playerRoll =
    statValue * roll.statWeight +
    state.level * roll.levelWeight +
    promptBonus +
    energyBonus +
    healthBonus +
    momentumBonus +
    presenceBonus +
    Math.floor(battle.hype / roll.hypeDivisor) +
    rng.int(roll.playerRandomMin, roll.playerRandomMax);
  const rivalRoll =
    battle.rivalPower * roll.rivalPowerWeight +
    battle.round * roll.roundWeight +
    rng.int(roll.rivalRandomMin, roll.rivalRandomMax);
  const wonRound = playerRoll >= rivalRoll;

  if (wonRound) {
    battle.playerScore += 1;
    battle.hype = clamp(
      battle.hype + BattleConfig.hype.winGain + promptBonus / BattleConfig.hype.winPromptBonusDivisor,
      0,
      100,
    );
  } else {
    battle.rivalScore += 1;
    battle.hype = clamp(battle.hype - BattleConfig.hype.lossDrop, 0, 100);
  }

  battle.results.push({
    round: battle.round,
    choice: choice.id,
    player: playerRoll,
    rival: rivalRoll,
    note: wonRound ? "El publico reacciona a tu ronda." : "El rival conecto mas fuerte.",
  });

  if (battle.round >= battle.maxRounds) {
    battle.finished = true;
    battle.result =
      battle.playerScore > battle.rivalScore
        ? "win"
        : battle.playerScore < battle.rivalScore
          ? "loss"
          : "draw";
  } else {
    battle.round += 1;
    battle.prompt = pickPrompt(rng);
  }
}

// Pays out rewards and exits battle mode. Returns the event parts and clock
// fx for the orchestrator to finalize; null when there is nothing to finish.
// rng is part of the system contract even though this path consumes none.
export function finishBattle(state: GameState, rng: RandomSource): { parts: string[]; fx: TimeAdvance } | null {
  void rng;
  const battle = state.battle;
  if (!battle || !battle.finished) return null;
  const won = battle.result === "win";
  const draw = battle.result === "draw";
  const payout = BattleConfig.payout;
  // Difficulty scales the whole payout (normal = 1, so the base tiers stay).
  const reward = (amount: number): number =>
    Math.floor(amount * difficultyRules(state.difficulty).rewardMultiplier);
  const cash = reward(won ? battle.rewardCash : draw ? Math.floor(battle.rewardCash * payout.cashDrawFraction) : 0);
  const fans = reward(
    won
      ? battle.rewardFans
      : draw
        ? Math.floor(battle.rewardFans * payout.fansDrawFraction)
        : Math.floor(battle.rewardFans * payout.fansLossFraction),
  );
  const respect = reward(
    won
      ? battle.rewardRespect
      : draw
        ? Math.floor(battle.rewardRespect * payout.respectDrawFraction)
        : Math.floor(battle.rewardRespect * payout.respectLossFraction),
  );
  const fame = reward(
    won
      ? battle.rewardFame
      : draw
        ? Math.floor(battle.rewardFame * payout.fameDrawFraction)
        : Math.floor(battle.rewardFame * payout.fameLossFraction),
  );
  const xp = reward(
    won
      ? battle.rewardXp
      : draw
        ? Math.floor(battle.rewardXp * payout.xpDrawFraction)
        : Math.floor(battle.rewardXp * payout.xpLossFraction),
  );

  state.cash += cash;
  state.fans += fans;
  state.respect += respect;
  state.fame += fame;
  const levelMessages = addXp(state, xp);
  const rhythmMessages = applyRhythm(
    state,
    "battle",
    won ? BattleConfig.rhythm.winDelta : draw ? BattleConfig.rhythm.drawDelta : BattleConfig.rhythm.lossDelta,
  );
  const clock = advanceClock(state, battleDurationBlocks(state), battle.eventName);

  const resultText = won ? "Ganaste" : draw ? "Empataste" : "Perdiste";
  const parts = [
    `${resultText} en ${battle.eventName} (${formatDuration(battleDurationBlocks(state))}): +$${cash}, +${fans} fans, +${respect} respeto.`,
    ...rhythmMessages,
    ...levelMessages,
    ...clock.messages,
  ];
  state.battle = null;
  state.mode = "career";
  return { parts, fx: clock.fx };
}
