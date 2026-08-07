// Jobs tuning values (AGENTS.md: Data Driven). Formula shapes live in
// JobsSystem; every number a paid shift uses comes from here.

export const JobsConfig = {
  earnings: {
    disciplinaMultiplier: 3,
    randomMin: 0,
    randomMax: 12,
  },
  xp: {
    base: 8,
    perBlock: 2,
  },
  rewards: {
    disciplinaGain: 1,
  },
  rhythm: {
    delta: -2,
  },
} as const;
