// Dilemma tuning (Fase 7). Formula shapes live in src/systems/DilemmaSystem.ts;
// every number they consume lives here.

export const DilemmaConfig = {
  roll: {
    // Chance (0..1) that a lived day brings a dilemma. Capped at one per week, so
    // this is really "how likely is it that an eligible week delivers its one":
    // at 0.40 a seven-day week lands one about 96% of the time. It was 0.28, and
    // a measured run to Plaza (scripts/playthrough.mjs) found only 2 dilemmas
    // where docs/PLAN.md asks for at least 3.
    chancePerDay: 0.4,
    // Never two in the same week: the point is that a decision is an event.
    maxPerWeek: 1,
    // How many opening weeks stay clear: the first week is for learning the
    // loop, not for a decision the player cannot judge yet. (Named for the
    // intention — "firstWeek" read as an off-by-one waiting to happen.)
    quietWeeks: 1,
  },
  axes: {
    min: -100,
    max: 100,
    // The labels each end of an axis carries, for the identity readout.
    labels: {
      undergroundComercial: { low: "Underground", high: "Comercial" },
      batalleroMusico: { low: "Batallero", high: "Musico" },
      soloCrew: { low: "Lobo solitario", high: "Crew" },
      autenticoPolemico: { low: "Autentico", high: "Polemico" },
    },
    // Below this absolute value an axis reads as "sin definir": the MC has not
    // leaned anywhere yet, and saying so is more honest than a fake label.
    leanThreshold: 12,
  },
  log: {
    // The career's memory is the point, but a save should not grow forever.
    maxDecisions: 60,
  },
} as const;
