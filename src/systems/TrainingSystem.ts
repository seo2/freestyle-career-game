// Training system: focused stat practice sessions. Pure functions over
// GameState — mutate in place, no globals, no DOM. Ported verbatim from the
// legacy main.ts engine.

import type { ActionResult, GameState, StatKey } from "../core/types";
import type { RandomSource } from "../services/RandomService";
import { TrainingConfig } from "../data/config/TrainingConfig";
import { statLabels } from "../data/stats";
import { addStat, addXp, applyRhythm } from "./ProgressionSystem";
import { spendActionTime } from "./CalendarSystem";

// Training consumes no randomness; rng is kept for the uniform system
// signature (state, rng, payload) used by the orchestrator.
export function trainSpecificStat(state: GameState, _rng: RandomSource, stat: StatKey): ActionResult {
  if (state.energy < TrainingConfig.session.energyCost) {
    return { type: "event", parts: ["Necesitas energia para entrenar."], fx: null };
  }
  const disciplineBonus = Math.floor(state.stats.disciplina / TrainingConfig.xp.disciplineBonusDivisor);
  addStat(state, stat, TrainingConfig.session.statGain);
  const extraXp = disciplineBonus + (stat === "disciplina" ? TrainingConfig.xp.disciplinaTrainingBonus : 0);
  const levelMessages = addXp(state, TrainingConfig.xp.base + extraXp);
  const rhythmMessages = applyRhythm(state, `train-${stat}`, TrainingConfig.rhythm.delta);
  const time = spendActionTime(
    state,
    TrainingConfig.session.energyCost,
    TrainingConfig.session.blocks,
    `Entrenar ${statLabels[stat]}`,
  );
  return {
    type: "event",
    parts: [
      `Entrenaste ${statLabels[stat]}: +${TrainingConfig.session.statGain} nivel.`,
      ...rhythmMessages,
      ...levelMessages,
      ...time.messages,
    ],
    fx: time.fx,
  };
}
