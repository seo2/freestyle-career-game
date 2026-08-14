// Cost of living (Fase 9). Formula shapes live in src/systems/LivingSystem.ts;
// every number they consume lives here.
//
// This exists because the economy was measured and found to have no sink at all:
// over ten simulated weeks the wallet went from $25 to $25, because nothing in the
// game ever took money away. One shift of work funded a career indefinitely, which
// is the exact opposite of the Bible's "el dinero nunca debe sobrar".

export const LivingConfig = {
  // Charged when the week closes. Sized against work, which pays about $48 for a
  // two-block shift: at $58 a week the rent is roughly one and a quarter shifts,
  // so about an eighth of the week's twenty-one blocks. Enough that the budget is
  // a real line in the plan, not so much that the game becomes a job.
  weeklyBase: 58,
  // Living costs more as you rise: better room, more travel, more people around
  // you. Battle rewards climb faster (+$85 a stage), so the pressure eases as the
  // career grows — which is the right shape. It should squeeze hardest at the
  // start, when a bad week actually hurts.
  weeklyPerStage: 26,
  // What a week you could not pay costs instead. There is no Game Over in this
  // game (Bible), so falling short is a setback with a story, not a wall.
  shortfall: {
    // Asking at home to cover it. The bond is the point: money trouble lands on
    // the people around you, which is what makes it more than a number.
    familiaPenalty: 9,
    // The week drags: momentum is the game's word for "are things moving".
    momentumPenalty: 8,
    // Sleeping badly over money.
    healthPenalty: 4,
  },
} as const;
