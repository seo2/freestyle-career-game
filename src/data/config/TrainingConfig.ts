// Training tuning values (AGENTS.md: Data Driven). Formula shapes live in
// TrainingSystem; every number a training session uses comes from here.

export const TrainingConfig = {
  session: {
    energyCost: 14,
    blocks: 1,
    statGain: 1,
  },
  xp: {
    base: 20,
    disciplineBonusDivisor: 5,
    disciplinaTrainingBonus: 2,
  },
  rhythm: {
    delta: 5,
  },
} as const;
