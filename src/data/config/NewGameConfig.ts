// Starting balance for a brand-new career (AGENTS.md: Data Driven). The
// structural origin (week 1, day 1, stage "pieza", zeroed careers counters)
// stays in core/state.ts; every tunable starting number lives here.

import type { Difficulty, Stats } from "../../core/types";

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
  // Crear MC defaults. GDD: creation is identity, never a stat build — the only
  // mechanical choice here is `difficulty` (see DifficultyConfig).
  identity: {
    nickname: "Freestyler",
    look: 1,
    skin: 1,
    voice: 1,
    difficulty: "normal" as Difficulty,
    nameMaxLength: 16,
    nicknameMaxLength: 16,
  },
  // How many variants each cosmetic selector cycles through (1-based indexes).
  identityOptions: {
    looks: 4,
    skins: 5,
    voices: 3,
  },
} as const;
