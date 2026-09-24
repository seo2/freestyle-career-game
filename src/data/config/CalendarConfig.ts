// Calendar tuning values (AGENTS.md: Data Driven). Formula shapes live in
// CalendarSystem; every number the clock uses comes from here.

export const CalendarConfig = {
  clock: {
    blocksPerDay: 3,
    daysPerWeek: 7,
    // Player-visible names for blocks 0..2, indexed by GameState.block.
    blockLabels: ["Mañana", "Tarde", "Noche"],
    // Short weekday names for days 1..7, indexed by GameState.day - 1.
    dayLabels: ["LUN", "MAR", "MIE", "JUE", "VIE", "SAB", "DOM"],
  },
  dailyRecovery: {
    energyBase: 8,
    energyPerDisciplina: 1,
    health: 2,
  },
  weeklyRecovery: {
    energyBase: 18,
    energyPerDisciplina: 3,
    health: 6,
  },
  momentum: {
    decayPerDay: 3,
  },
  energy: {
    overdraftFloor: -20,
  },
} as const;
