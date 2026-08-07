// Starting balance for a brand-new career (AGENTS.md: Data Driven). The
// structural origin (week 1, day 1, stage "pieza", zeroed careers counters)
// stays in core/state.ts; every tunable starting number lives here.

import type { Stats } from "../../core/types";

export const NewGameConfig = {
  startingBlock: 0,
  xpToFirstLevel: 70,
  startingEnergy: 86,
  startingHealth: 88,
  startingCash: 25,
  startingMomentum: 42,
  startingStats: {
    flow: 2,
    punchline: 2,
    metrica: 1,
    improvisacion: 2,
    escena: 1,
    carisma: 1,
    disciplina: 1,
  } satisfies Stats,
} as const;
