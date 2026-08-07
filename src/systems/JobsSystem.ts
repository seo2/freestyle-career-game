// Jobs system: paid shifts that trade energy and time for cash. Pure
// functions over GameState — mutate in place, no globals, no DOM. Ported
// verbatim from the legacy main.ts engine (RNG call order preserved).

import type { ActionResult, GameState, JobOption } from "../core/types";
import type { RandomSource } from "../services/RandomService";
import { JobsConfig } from "../data/config/JobsConfig";
import { addStat, addXp, applyRhythm } from "./ProgressionSystem";
import { formatDuration, spendActionTime } from "./CalendarSystem";

export function performJob(state: GameState, rng: RandomSource, option: JobOption): ActionResult {
  if (state.energy < option.energy) {
    return { type: "event", parts: ["Estas demasiado cansado para tomar ese turno."], fx: null };
  }
  const earned =
    option.cash +
    state.stats.disciplina * JobsConfig.earnings.disciplinaMultiplier +
    rng.int(JobsConfig.earnings.randomMin, JobsConfig.earnings.randomMax);
  state.cash += earned;
  if (rng.next() < option.disciplineChance) addStat(state, "disciplina", JobsConfig.rewards.disciplinaGain);
  const levelMessages = addXp(state, JobsConfig.xp.base + option.blocks * JobsConfig.xp.perBlock);
  const rhythmMessages = applyRhythm(state, `work-${option.id}`, JobsConfig.rhythm.delta);
  const time = spendActionTime(state, option.energy, option.blocks, option.label);
  return {
    type: "event",
    parts: [
      `${option.label} (${formatDuration(option.blocks)}): +$${earned}.`,
      ...rhythmMessages,
      ...levelMessages,
      ...time.messages,
    ],
    fx: time.fx,
  };
}
