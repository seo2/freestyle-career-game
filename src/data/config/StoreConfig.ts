// Store/upgrade tuning values. Formula shapes live in StoreSystem; every
// number the store balances on lives here.

export const StoreConfig = {
  costCurve: {
    quadraticCoefficientPerLevel: 25,
  },
  purchase: {
    xpBase: 14,
    xpPerLevel: 4,
    rhythmBase: 6,
    rhythmPerLevel: 2,
    clockBlocks: 1,
  },
} as const;
