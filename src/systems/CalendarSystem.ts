// Calendar system: clock advancement with day/week rollover recovery, action
// energy spending, and time formatting. Pure functions over GameState —
// mutate in place, no globals, no DOM. Time runs in day blocks (0=Mañana,
// 1=Tarde, 2=Noche); every action costs whole blocks.

import type { GameState, TimeAdvance } from "../core/types";
import { maxEnergy } from "../core/derived";
import { CalendarConfig } from "../data/config/CalendarConfig";
import { clamp } from "../utils/math";

export interface ClockResult {
  messages: string[];
  fx: TimeAdvance;
}

export function spendActionTime(
  state: GameState,
  energyCost: number,
  blocks: number,
  label: string,
): ClockResult {
  state.energy = clamp(state.energy - energyCost, CalendarConfig.energy.overdraftFloor, maxEnergy(state));
  if (state.energy < 0) {
    state.health = clamp(state.health + state.energy, 0, 100);
    state.energy = 0;
  }
  return advanceClock(state, blocks, label);
}

export function advanceClock(state: GameState, blocks: number, label: string): ClockResult {
  const messages: string[] = [];
  const fromBlock = state.block;
  let daysPassed = 0;
  let weekChanged = false;

  state.block += Math.max(0, Math.round(blocks));
  while (state.block >= CalendarConfig.clock.blocksPerDay) {
    state.block -= CalendarConfig.clock.blocksPerDay;
    state.day += 1;
    daysPassed += 1;
    state.energy = clamp(
      state.energy +
        CalendarConfig.dailyRecovery.energyBase +
        state.stats.disciplina * CalendarConfig.dailyRecovery.energyPerDisciplina,
      0,
      maxEnergy(state),
    );
    state.health = clamp(state.health + CalendarConfig.dailyRecovery.health, 0, 100);
    if (state.day > CalendarConfig.clock.daysPerWeek) {
      state.week += 1;
      state.day = 1;
      weekChanged = true;
      state.energy = clamp(
        state.energy +
          CalendarConfig.weeklyRecovery.energyBase +
          state.stats.disciplina * CalendarConfig.weeklyRecovery.energyPerDisciplina,
        0,
        maxEnergy(state),
      );
      state.health = clamp(state.health + CalendarConfig.weeklyRecovery.health, 0, 100);
    }
  }

  if (daysPassed > 0) {
    state.momentum = clamp(state.momentum - daysPassed * CalendarConfig.momentum.decayPerDay, 0, 100);
    messages.push(`Paso ${daysPassed === 1 ? "un dia" : `${daysPassed} dias`}.`);
  }
  if (weekChanged) messages.push(`Semana ${state.week}: recuperaste energia.`);
  const fx: TimeAdvance = {
    label,
    fromBlock,
    toBlock: state.block,
    blocks,
    daysPassed,
  };
  return { messages, fx };
}

export function formatBlock(block: number): string {
  return CalendarConfig.clock.blockLabels[block] ?? CalendarConfig.clock.blockLabels[0];
}

export function formatDuration(blocks: number): string {
  return blocks === 1 ? "1 bloque" : `${blocks} bloques`;
}
