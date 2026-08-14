// Cost of living (Fase 9): the week costs money to have lived.
//
// The economy was measured (scripts/measure-economy.mjs) and had no sink at all —
// ten weeks in, the wallet still held its opening $25, because nothing in the game
// ever took money away. Work paid, battles paid, and the only outgoings were
// voluntary. So money was never scarce, which makes "trabajar" a button nobody
// needs to press and the Bible's "el dinero nunca debe sobrar" impossible.
//
// Falling short does NOT end anything (Bible: no Game Over). It lands on the
// people around you and on the week's momentum, which is a story rather than a
// wall: you covered the rent by asking at home, and it cost you something there.
//
// Pure functions over GameState. No RNG: rent is not a dice roll.

import type { GameState } from "../core/types";
import { LivingConfig } from "../data/config/LivingConfig";
import { RelationshipConfig } from "../data/config/RelationshipConfig";
import { stageIndex } from "../core/derived";
import { clamp } from "../utils/math";

// What this week costs, at the stage the player is living in.
export function weeklyCost(state: GameState): number {
  return LivingConfig.weeklyBase + stageIndex(state) * LivingConfig.weeklyPerStage;
}

// Charges the week. Called as the week closes, BEFORE the summary is built, so the
// summary's cash line is the truth about the week that just ended.
export function chargeLiving(state: GameState): string[] {
  const cost = weeklyCost(state);
  if (state.cash >= cost) {
    state.cash -= cost;
    return [`Semana pagada: -$${cost} de vivir.`];
  }

  // Short. Pay what there is, and the rest lands somewhere real.
  const paid = state.cash;
  const missing = cost - paid;
  state.cash = 0;
  const { familiaPenalty, momentumPenalty, healthPenalty } = LivingConfig.shortfall;
  const bond = state.bonds.familia ?? { affinity: 0, fedWeek: 0 };
  state.bonds.familia = {
    affinity: clamp(bond.affinity - familiaPenalty, RelationshipConfig.bonds.min, RelationshipConfig.bonds.max),
    fedWeek: bond.fedWeek,
  };
  state.momentum = clamp(state.momentum - momentumPenalty, 0, 100);
  state.health = clamp(state.health - healthPenalty, 0, 100);
  return [
    `No te alcanzo para la semana: faltaron $${missing}.`,
    "Lo cubrieron en tu casa, y eso se siente.",
  ];
}
