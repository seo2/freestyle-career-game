// Weekly planning tuning (Fase 6, gauntlet 3 v2). Formula shapes live in
// src/systems/PlanSystem.ts; every number they consume lives here.

export const PlanConfig = {
  // The week the mockup draws: seven day cards, one planned action each.
  week: {
    days: 7,
    // The stage battle is scheduled on this weekday (1-based, so 6 = SAB).
    // It is the anchor that makes planning a decision: you must arrive with
    // energy, and the days before it are a real trade-off.
    battleDay: 6,
    // Shown in the message that explains why the battle is closed today.
    battleDayLabel: "SAB",
  },
  // A day nobody planned: you drift. It costs the day and a little momentum,
  // because doing nothing is a choice the game should not hide.
  idleDay: {
    momentumPenalty: 4,
    message: "Dia sin plan: se te fue en nada.",
  },
  // A planned action you cannot afford when the day arrives (energy dropped
  // below its cost) does not silently vanish: it falls through to rest, and the
  // summary says so. Overplanning has to cost something.
  brokenPlan: {
    message: "No te alcanzo la energia: el dia se fue en descansar.",
  },
  // How many weekly summaries the save keeps, so the calendar's week arrows can
  // browse real history without the save growing forever.
  history: {
    maxWeeks: 12,
  },
} as const;
