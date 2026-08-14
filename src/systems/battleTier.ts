// How a battle's opponent and stakes are BUILT for the current stage: which
// rival from the roster, how strong, what the crowd rewards, what it pays.
//
// Split out of BattleSystem, which owns the FLOW (rounds, resolution, payout).
// Two reasons: the file was at its size limit, and the grudge a rival carries
// (RelationshipSystem) belongs to who they are, not to how a round resolves.

import type { BattleState, GameState, RivalProfile } from "../core/types";
import { stageIndex } from "../core/derived";
import { crowdByStage, rivalRoster } from "../data/rivals";
import { stages } from "../data/stages";
import { trainingStats } from "../data/stats";
import { BattleConfig } from "../data/config/BattleConfig";
import { DifficultyConfig, difficultyRules } from "../data/config/DifficultyConfig";
import { rivalryEdge, rivalryWith } from "./RelationshipSystem";
import type { RandomSource } from "../services/RandomService";

export type BattleTier = Omit<
  BattleState,
  | "rivalEnergy"
  | "rivalEnergyMax"
  | "rivalHype"
  | "round"
  | "maxRounds"
  | "hype"
  | "playerScore"
  | "rivalScore"
  | "prompt"
  | "hand"
  | "timeLeft"
  | "results"
  | "pendingResult"
  | "finished"
  | "result"
>;

// Who turns up tonight. Every stage has three rivals, and the pick is WEIGHTED BY
// GRUDGE: someone you beat badly is more likely to be waiting than someone with no
// history with you. That is what makes the rivalry ledger a thing that happens to
// you rather than a table you can read.
//
// Consumes exactly ONE draw whatever the outcome, so the trace harness stays
// deterministic (the same rule the rest of the systems follow).
export function pickRival(state: GameState, rng: RandomSource): RivalProfile {
  const stage = stages[stageIndex(state)]?.id ?? "pieza";
  const pool = rivalRoster.filter((entry) => entry.stage === stage);
  const roll = rng.next();
  if (pool.length === 0) return rivalRoster[0];
  const cfg = BattleConfig.rivalPick;
  const weights = pool.map((entry) => {
    const heat = rivalryWith(state, entry.name)?.heat ?? 0;
    return cfg.baseWeight + heat * cfg.heatWeight;
  });
  const total = weights.reduce((sum, w) => sum + w, 0);
  let cursor = roll * total;
  for (let i = 0; i < pool.length; i += 1) {
    cursor -= weights[i];
    if (cursor < 0) return pool[i];
  }
  return pool[pool.length - 1];
}

export function getBattleTier(state: GameState, rng: RandomSource): BattleTier {
  const idx = stageIndex(state);
  const profile = pickRival(state, rng);
  const crowd = crowdByStage[profile.stage];
  // What this rival remembers about you (Fase 7). A grudge makes them stronger
  // and more aggressive, so the second time is not the first time.
  const grudge = rivalryEdge(state, profile.name);
  // What the MC has actually trained. The rival scales with this, not only with
  // the stage: measuring the old curve showed a nacional rival losing 100% of the
  // time because the player's stats had left him behind three stages ago.
  const trained = trainingStats.reduce((sum, key) => sum + state.stats[key], 0) / trainingStats.length;
  const tier = BattleConfig.tier;
  // Difficulty is the one mechanical choice of the Crear MC screen: it shifts
  // how strong every rival is (and, at payout time, how much a battle pays).
  const difficulty = difficultyRules(state.difficulty);
  return {
    eventName: profile.eventName,
    rivalName: profile.name,
    rivalStyle: profile.style,
    rivalArchetype: profile.archetype,
    rivalFlow: profile.flow,
    rivalPunchline: profile.punchline,
    rivalPersonality: {
      ...profile.personality,
      agresividad: profile.personality.agresividad + grudge.aggression,
    },
    crowdLoves: crowd.loves,
    crowdColds: crowd.colds,
    crowdLine: crowd.line,
    rivalPower: Math.max(
      DifficultyConfig.rivalPowerFloor,
      tier.rivalPowerBase +
        idx * tier.rivalPowerPerStage +
        Math.floor(state.level / tier.rivalPowerLevelDivisor) +
        Math.floor(trained * tier.rivalPowerPerPlayerStat) +
        difficulty.rivalPowerBonus +
        grudge.power,
    ),
    rewardCash: tier.rewardCashBase + idx * tier.rewardCashPerStage,
    rewardFans: tier.rewardFansBase + idx * tier.rewardFansPerStage,
    rewardRespect: tier.rewardRespectBase + idx * tier.rewardRespectPerStage,
    rewardFame: tier.rewardFameBase + idx * tier.rewardFamePerStage,
    rewardXp: tier.rewardXpBase + idx * tier.rewardXpPerStage,
  };
}
