// Derived values computed from GameState. Pure functions, never stored.

import type { GameState, StageDef, StageId } from "./types";
import { ProgressionConfig } from "../data/config/ProgressionConfig";
import { stages } from "../data/stages";

export function maxEnergy(state: GameState): number {
  const cfg = ProgressionConfig.maxEnergy;
  return (
    cfg.base +
    state.level * cfg.perLevel +
    state.stats.disciplina * cfg.perDisciplina +
    state.homeLevel * cfg.perHomeLevel
  );
}

export function recordCost(state: GameState): number {
  const cfg = ProgressionConfig.recordCost;
  return Math.max(cfg.floor, cfg.base - state.studioLevel * cfg.discountPerStudioLevel);
}

export function stageIndex(state: GameState, id: StageId = state.stage): number {
  return Math.max(
    0,
    stages.findIndex((stage) => stage.id === id),
  );
}

export function currentStage(state: GameState): StageDef {
  return stages.find((stage) => stage.id === state.stage) ?? stages[0];
}

export function momentumMood(state: GameState): string {
  if (state.momentum >= ProgressionConfig.momentumMood.onFireThreshold) return "En racha";
  if (state.momentum >= ProgressionConfig.momentumMood.activeThreshold) return "Activo";
  if (state.momentum >= ProgressionConfig.momentumMood.coldThreshold) return "Frio";
  return "Quemado";
}
