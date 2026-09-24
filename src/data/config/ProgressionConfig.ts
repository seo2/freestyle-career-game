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
  // Named ranks a skill climbs through (Fase 12 C). A stat is shown as its rank
  // plus one pip per point inside it, never against statBounds.max: the
  // strongest rival in the game has flow 10, so a bar out of 99 said "you are
  // nowhere" to a player who was already competitive. Bands are measured
  // against the rival table (src/data/rivals.ts): pieza rivals sit at 2..4,
  // plaza 4..6, regional 5..8, the top of the game 9..10. Each `min` is where
  // the rank starts; the last rank is open-ended.
  skillTiers: [
    { min: 1, label: "Novato" },
    { min: 3, label: "Aprendiz" },
    { min: 5, label: "Callejero" },
    { min: 8, label: "Filoso" },
    { min: 12, label: "Veterano" },
    { min: 17, label: "Maestro" },
    { min: 24, label: "Leyenda" },
  ],
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
