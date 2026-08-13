// Progression rules: stats, XP/levels, stage unlocks, career goals and the
// action-rhythm (momentum) economy. Pure functions over GameState — no DOM,
// no storage, no timers. Ported verbatim from the legacy main.ts engine.

import type { CareerGoal, GameState, StageDef, StatKey } from "../core/types";
import { maxEnergy, momentumMood, recordCost, stageIndex } from "../core/derived";
import { ActionsConfig } from "../data/config/ActionsConfig";
import { ProgressionConfig } from "../data/config/ProgressionConfig";
import { stages } from "../data/stages";
import { statLabels } from "../data/stats";
import { clamp } from "../utils/math";
import { openEpilogue } from "./EpilogueSystem";

export function addStat(state: GameState, stat: StatKey, amount: number): void {
  state.stats[stat] = clamp(
    state.stats[stat] + amount,
    ProgressionConfig.statBounds.min,
    ProgressionConfig.statBounds.max,
  );
}

export function addXp(state: GameState, amount: number): string[] {
  const messages: string[] = [];
  state.xp += amount;
  while (state.xp >= state.xpNext) {
    state.xp -= state.xpNext;
    state.level += 1;
    state.xpNext = Math.round(
      state.xpNext * ProgressionConfig.xpCurve.nextLevelMultiplier + ProgressionConfig.xpCurve.nextLevelFlatBonus,
    );
    state.energy = clamp(state.energy + ProgressionConfig.levelUp.energyGain, 0, maxEnergy(state));
    state.health = clamp(state.health + ProgressionConfig.levelUp.healthGain, 0, 100);
    const statToRaise = pickLevelStat(state);
    addStat(state, statToRaise, ProgressionConfig.levelUp.statGain);
    messages.push(`Subiste a nivel ${state.level}: +${ProgressionConfig.levelUp.statGain} ${statLabels[statToRaise]}.`);
  }
  return messages;
}

function pickLevelStat(state: GameState): StatKey {
  const ordered: StatKey[] = [
    "flow",
    "punchline",
    "improvisacion",
    "metrica",
    "escena",
    "carisma",
    "disciplina",
  ];
  return ordered[(state.level + stageIndex(state)) % ordered.length];
}

export function maybeUnlockStage(state: GameState): string | null {
  const next = stages[stageIndex(state) + 1];
  if (!next) return null;
  const unlocks =
    state.level >= next.minLevel &&
    state.fans >= next.minFans &&
    state.respect >= next.minRespect &&
    state.fame >= next.minFame;
  if (!unlocks) return null;
  const leftStage = state.stage;
  state.stage = next.id;
  // Closing a chapter stops the loop and shows what it says about you (Fase 7):
  // without this the identity axes would accumulate and never be paid.
  openEpilogue(state, leftStage);
  return `Nuevo circuito desbloqueado: ${next.title}.`;
}

// Legacy setEvent, minus persistence: the orchestrator saves after finalizing.
export function finalizeEvent(state: GameState, parts: string[]): void {
  const unlock = maybeUnlockStage(state);
  if (unlock) parts.push(unlock);
  state.lastEvent = parts.join(" ");
}

export function stageGoalProgress(state: GameState, stage: StageDef): number {
  const ratios = [
    stage.minLevel <= 1 ? 1 : clamp(state.level / stage.minLevel, 0, 1),
    stage.minFans <= 0 ? 1 : clamp(state.fans / stage.minFans, 0, 1),
    stage.minRespect <= 0 ? 1 : clamp(state.respect / stage.minRespect, 0, 1),
    stage.minFame <= 0 ? 1 : clamp(state.fame / stage.minFame, 0, 1),
  ];
  return ratios.reduce((sum, value) => sum + value, 0) / ratios.length;
}

export function getCareerGoals(state: GameState): CareerGoal[] {
  const next = stages[stageIndex(state) + 1];
  const goals: CareerGoal[] = [];

  if (next) {
    goals.push({
      label: `Abrir ${next.title}`,
      detail: `Nv ${state.level}/${next.minLevel} · Resp ${state.respect}/${next.minRespect}`,
      value: Math.round(stageGoalProgress(state, next) * 100),
      max: 100,
      color: ProgressionConfig.goalColors.nextStage,
    });
  } else {
    goals.push({
      label: "Legado",
      detail: `Fama ${state.fame} · Fans ${state.fans}`,
      value: clamp(state.fame, 0, ProgressionConfig.goals.legacyFameCap),
      max: ProgressionConfig.goals.legacyFameCap,
      color: ProgressionConfig.goalColors.legacy,
    });
  }

  if (state.discProgress < ActionsConfig.record.songProgressRequired) {
    goals.push({
      label: "Primer tema",
      detail: `${state.discProgress}% escrito`,
      value: state.discProgress,
      max: ActionsConfig.record.songProgressRequired,
      color: ProgressionConfig.goalColors.firstSong,
    });
  } else if (state.cash < recordCost(state)) {
    goals.push({
      label: "Pagar estudio",
      detail: `$${state.cash}/$${recordCost(state)}`,
      value: state.cash,
      max: recordCost(state),
      color: ProgressionConfig.goalColors.payStudio,
    });
  } else {
    goals.push({
      label: "Grabar tema",
      detail: "Listo para entrar al estudio",
      value: 1,
      max: 1,
      color: ProgressionConfig.goalColors.recordSong,
    });
  }

  return goals;
}

export function rhythmPreview(state: GameState, actionId: string, baseDelta: number): string {
  const rhythm = ProgressionConfig.rhythm;
  const repeatPenalty =
    state.lastActionId === actionId
      ? Math.min(rhythm.repeatPenaltyCap, (state.actionStreak + 1) * rhythm.repeatPenaltyPerStreak)
      : rhythm.freshActionBonus;
  const fatiguePenalty =
    state.energy < rhythm.fatigueEnergyThreshold && actionId !== "rest" ? rhythm.fatiguePenalty : 0;
  const nightPenalty =
    state.block === rhythm.nightBlock && actionId !== "rest" ? rhythm.nightPenalty : 0;
  const delta = Math.round(baseDelta - repeatPenalty - fatiguePenalty - nightPenalty);
  if (delta > 0) return `Impulso +${delta}`;
  if (delta < 0) return `Impulso ${delta}`;
  return "Impulso neutro";
}

export function applyRhythm(state: GameState, actionId: string, baseDelta: number): string[] {
  const repeated = state.lastActionId === actionId;
  state.actionStreak = repeated ? state.actionStreak + 1 : 1;
  state.lastActionId = actionId;

  const rhythm = ProgressionConfig.rhythm;
  const repeatPenalty = repeated
    ? Math.min(rhythm.repeatPenaltyCap, state.actionStreak * rhythm.repeatPenaltyPerStreak)
    : rhythm.freshActionBonus;
  const fatiguePenalty =
    state.energy < rhythm.fatigueEnergyThreshold && actionId !== "rest" ? rhythm.fatiguePenalty : 0;
  const nightPenalty =
    state.block === rhythm.nightBlock && actionId !== "rest" ? rhythm.nightPenalty : 0;
  const delta = Math.round(baseDelta - repeatPenalty - fatiguePenalty - nightPenalty);
  state.momentum = clamp(state.momentum + delta, 0, 100);

  if (delta > 0) return [`Impulso +${delta}: ${momentumMood(state)}.`];
  if (delta < 0) return [`Impulso ${delta}: ${momentumMood(state)}.`];
  return [`Impulso estable: ${momentumMood(state)}.`];
}
