// Relationship tuning (Fase 7). Formula shapes live in
// src/systems/RelationshipSystem.ts; every number they consume lives here.

export const RelationshipConfig = {
  bonds: {
    min: 0,
    max: 100,
    // Charged every week, against a visit that pays once. That is the whole point
    // of bonds: if affinity only ever went up, keeping it would not be a decision.
    // A measured arc proved it — with the decay skipped on fed weeks both bonds
    // sat at 100/100 after five weeks.
    decayPerWeek: 6,
    // Above this a bond is "firme" and pays its bonus; below the low mark it is
    // "fria" and charges its penalty. Between them it is simply there.
    warmAt: 65,
    coldAt: 30,
  },
  familia: {
    // Resting at home with the family in your corner heals more; resting in a
    // house you never visit heals less. Both measured FROM the bond's starting
    // affinity, so a fresh career gets 0 and relationships never silently
    // re-tune the balance (RelationshipSystem.acrossAffinity explains why).
    restHealthAtMax: 5,
    restHealthAtMin: -3,
  },
  crew: {
    // Your people in the crowd: a hype head start in battle. Small on purpose —
    // support, not a battle won beforehand. Losing the crew costs the bonus and
    // nothing more; the family is the bond that charges for neglect.
    hypeAtMax: 8,
    hypeAtMin: 0,
  },
  rivalry: {
    // Heat is the grudge. Beating someone makes them want you more than losing
    // to them does: the winner of the last round is the one with something to
    // prove against.
    heatOnPlayerWin: 22,
    heatOnPlayerLoss: 8,
    heatOnDraw: 12,
    // Winning by a landslide is humiliation, and humiliation is remembered.
    // Measured in rounds won minus rounds lost.
    humiliationMargin: 3,
    heatOnHumiliation: 16,
    // A grudge cools if you never cross paths again.
    decayPerWeek: 3,
    max: 100,
    // How much heat buys the rival: one power point per this much heat, capped
    // so a rivalry sharpens an opponent instead of making them unbeatable.
    heatPerPowerPoint: 18,
    maxPowerBonus: 4,
    // A rival with a grudge attacks more (the Bible's `agresividad` weight).
    aggressionAtMaxHeat: 3,
    // Below this, heat is just history: no bonus, no warning line.
    readableAt: 20,
  },
  log: {
    // One rivalry per stage today, but a save should not grow without bound.
    maxRivalries: 24,
  },
} as const;
