// Store tuning values. Formula shapes live in StoreSystem; every number the
// store balances on lives here. Item prices and grants are content, so they
// live in src/data/items.ts.

export const StoreConfig = {
  // Cost curve of the internal upgrade levels (legacy abstract upgrades).
  costCurve: {
    quadraticCoefficientPerLevel: 25,
  },
  purchase: {
    xpBase: 14,
    // Upgrade purchases scale with the level bought...
    xpPerLevel: 4,
    // ...item purchases scale with what they cost (per $100 of price).
    xpPerHundredPrice: 6,
    rhythmBase: 6,
    rhythmPerLevel: 2,
    clockBlocks: 1,
  },
  // Shared rhythm action id for every item purchase: shopping twice in a row
  // is a repeated action (momentum penalty), like any other repeated block.
  itemRhythmActionId: "buy-item",
} as const;
