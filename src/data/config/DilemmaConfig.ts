// Dilemma tuning (Fase 7). Formula shapes live in src/systems/DilemmaSystem.ts;
// every number they consume lives here.

export const DilemmaConfig = {
  roll: {
    // Chance (0..1) that a lived day brings a dilemma. Capped at one per week, so
    // this is really "how likely is it that an eligible week delivers its one":
    // at 0.40 a seven-day week lands one about 96% of the time. It was 0.28, and
    // a measured run to Plaza (scripts/playthrough.mjs) found only 2 dilemmas
    // where docs/PLAN.md asks for at least 3.
    // 0.40 stays. It was raised to 0.50 to lift the low tail of "dilemmas per
    // arc", and measuring four seeds DISPROVED that: the count is not limited by
    // the rate, it is limited by how many weeks the arc lasts. With one dilemma a
    // week and week 1 quiet, a three-week arc can only ever deliver two, and since
    // Fase 9 made battles winnable a lucky player promotes in three weeks. That is
    // a gate question, not a probability question — recorded in docs/GDD.md.
    chancePerDay: 0.4,
    // Never two in the same week: the point is that a decision is an event.
    maxPerWeek: 1,
    // How many opening DAYS stay clear. It was a whole quiet WEEK, and measuring
    // four full arcs showed what that cost: since Fase 9 made battles winnable, a
    // lucky player promotes in three weeks, and one dilemma a week with week 1
    // silent gives a ceiling of TWO — below the plan's own closing criterion, and
    // no probability can lift a ceiling.
    //
    // The reason for the silence was "let the player understand the loop before
    // asking them to gamble something", and that takes DAYS, not twenty-one
    // blocks. At 4 the earliest dilemma lands on day 5, by which time the room,
    // the calendar and a battle have all been seen.
    quietDays: 4,
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
