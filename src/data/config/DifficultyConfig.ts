// Difficulty tuning. The Crear MC screen only picks an id; the mechanical
// weight of that choice lives here and is applied by BattleSystem:
//   rivalPowerBonus  -> added to the rival power of every battle tier
//   rewardMultiplier -> scales the whole battle payout (cash/fans/respect/fame/xp)
//   timerMultiplier  -> scales BattleConfig.timer.roundSeconds (facil = more time)
// Keeping the knobs in one table means new difficulties are a data edit.

import type { Difficulty } from "../../core/types";

export interface DifficultyRules {
  label: string;
  rivalPowerBonus: number;
  rewardMultiplier: number;
  timerMultiplier: number;
}

export const DifficultyConfig = {
  // Cycling order for the selector (wraps at both ends).
  order: ["facil", "normal", "dificil"] as readonly Difficulty[],
  // Used when a save carries an unknown difficulty id.
  fallback: "normal" as Difficulty,
  // Rival power never drops below this, however generous the difficulty is.
  rivalPowerFloor: 0,
  levels: {
    facil: { label: "Facil", rivalPowerBonus: -1, rewardMultiplier: 1.15, timerMultiplier: 1.4 },
    normal: { label: "Normal", rivalPowerBonus: 0, rewardMultiplier: 1, timerMultiplier: 1 },
    dificil: { label: "Dificil", rivalPowerBonus: 2, rewardMultiplier: 0.9, timerMultiplier: 0.8 },
  } satisfies Record<Difficulty, DifficultyRules>,
} as const;

// Safe lookup: hand-edited or future saves may carry an unknown id.
export function difficultyRules(id: Difficulty): DifficultyRules {
  return DifficultyConfig.levels[id] ?? DifficultyConfig.levels[DifficultyConfig.fallback];
}
