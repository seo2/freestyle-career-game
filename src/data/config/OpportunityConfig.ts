// Scheduled-opportunity tuning (Fase 6). Formula shapes live in
// src/systems/OpportunitySystem.ts; every number they consume lives here.

export const OpportunityConfig = {
  roll: {
    // How many offers a week can carry. Some weeks are quiet on purpose: a week
    // where nothing knocks is what makes the busy weeks feel busy.
    maxPerWeek: 2,
    // Chance (0..1) of rolling each slot. Two slots at 0.55 give roughly a
    // quarter of weeks with nothing, half with one offer and a quarter with two.
    chancePerSlot: 0.55,
    // Offers never land on the first day of the week (you would see them before
    // you could plan around them) nor on the battle day (the appointment owns
    // it), so they fall between these weekdays, inclusive.
    earliestDay: 2,
    latestDay: 5,
  },
  // Mandatory rest (Bible: fatigue and mental health force a break). Below this
  // health everything except resting closes: the game stops letting you dig.
  burnout: {
    healthFloor: 25,
    reason: "Estas quemado: hoy solo puedes descansar.",
    // What the room says when it happens, so the state is never a mystery.
    notice: "Salud mental en el piso: el cuerpo te pide parar.",
  },
} as const;
