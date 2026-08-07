// Progression tuning values: XP curve, level-up rewards, stat bounds, the
// action-rhythm (momentum) economy, momentum mood thresholds and career-goal
// presentation. Formula shapes live in ProgressionSystem / core/derived.

export const ProgressionConfig = {
  xpCurve: {
    nextLevelMultiplier: 1.22,
    nextLevelFlatBonus: 18,
  },
  levelUp: {
    energyGain: 18,
    healthGain: 7,
    statGain: 1,
  },
  statBounds: {
    min: 1,
    max: 99,
  },
  rhythm: {
    repeatPenaltyCap: 12,
    repeatPenaltyPerStreak: 4,
    freshActionBonus: -4,
    fatigueEnergyThreshold: 24,
    fatiguePenalty: 5,
    nightBlock: 2,
    nightPenalty: 3,
  },
  momentumMood: {
    onFireThreshold: 78,
    activeThreshold: 55,
    coldThreshold: 30,
  },
  maxEnergy: {
    base: 90,
    perLevel: 2,
    perDisciplina: 1,
    perHomeLevel: 8,
  },
  recordCost: {
    floor: 20,
    base: 35,
    discountPerStudioLevel: 5,
  },
  goals: {
    legacyFameCap: 2500,
  },
  goalColors: {
    nextStage: "#2fa58d",
    legacy: "#d65a8a",
    payStudio: "#d65a8a",
    firstSong: "#e1b84a",
    recordSong: "#77c46b",
  },
} as const;
