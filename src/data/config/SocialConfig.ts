// Social media tuning values (AGENTS.md: Data Driven). Formula shapes live
// in SocialSystem; every number a post uses comes from here.

export const SocialConfig = {
  viral: {
    baseThreshold: 0.88,
    carismaThresholdFactor: 0.012,
    fanBonus: 48,
    fameBonus: 10,
    rhythmBonus: 9,
  },
  fans: {
    carismaMultiplier: 3,
    outfitMultiplier: 5,
    randomMin: 0,
    randomMax: 10,
  },
  fame: {
    fanDivisor: 12,
  },
  health: {
    viralCost: 4,
    normalCost: 1,
  },
  carisma: {
    gainThreshold: 0.68,
    gain: 1,
  },
  xp: {
    base: 16,
    viralBonus: 16,
  },
} as const;
