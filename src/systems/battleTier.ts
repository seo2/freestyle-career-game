// How a battle's opponent and stakes are BUILT for the current stage: which
// rival from the roster, how strong, what the crowd rewards, what it pays.
//
// Split out of BattleSystem, which owns the FLOW (rounds, resolution, payout).
// Two reasons: the file was at its size limit, and the grudge a rival carries
// (RelationshipSystem) belongs to who they are, not to how a round resolves.

import type { BattleState, GameState } from "../core/types";
import { stageIndex } from "../core/derived";
import { crowdByStage, rivalRoster } from "../data/rivals";
import { BattleConfig } from "../data/config/BattleConfig";
import { DifficultyConfig, difficultyRules } from "../data/config/DifficultyConfig";
import { rivalryEdge } from "./RelationshipSystem";

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

export function getBattleTier(state: GameState): BattleTier {
  const idx = stageIndex(state);
  const profile = rivalRoster[idx] ?? rivalRoster[0];
  const crowd = crowdByStage[profile.stage];
  // What this rival remembers about you (Fase 7). A grudge makes them stronger
  // and more aggressive, so the second time is not the first time.
  const grudge = rivalryEdge(state, profile.name);
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
