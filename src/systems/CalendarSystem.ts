// Calendar system: clock advancement with day/week rollover recovery, action
// energy spending, and time formatting. Pure functions over GameState —
// mutate in place, no globals, no DOM. Time runs in day blocks (0=Mañana,
// 1=Tarde, 2=Noche); every action costs whole blocks.

import type { GameState, TimeAdvance, WeekSummary } from "../core/types";
import { maxEnergy } from "../core/derived";
import { CalendarConfig } from "../data/config/CalendarConfig";
import { clamp } from "../utils/math";
import { closeWeek } from "./PlanSystem";
import { decayRelationships } from "./RelationshipSystem";
import { chargeLiving } from "./LivingSystem";

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
  const relationshipMessages: string[] = [];
  let closedWeek: WeekSummary | null = null;

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
      // Close the week BEFORE the counter moves, so the summary carries the
      // number of the week that actually ended (Bible: resumen semanal), and
      // the fresh plan and opening snapshot belong to the new one.
      // The week costs money to have lived (Fase 9). Charged BEFORE the summary is
      // built, so its cash line is the truth about the week that just ended.
      relationshipMessages.push(...chargeLiving(state));
      closedWeek = closeWeek(state);
      // The people you did not see this week (Fase 7). Charged BEFORE the
      // counter moves, so the bond that cooled belongs to the week that ended.
      relationshipMessages.push(...decayRelationships(state));
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
  if (weekChanged && closedWeek) {
    messages.push(
      `Semana ${closedWeek.week} cerrada: ${signedCash(closedWeek.cash)}, +${closedWeek.fans} fans, +${closedWeek.respect} respeto.`,
    );
    messages.push(`Semana ${state.week}: recuperaste energia y la agenda esta vacia.`);
    messages.push(...relationshipMessages);
  }
  const fx: TimeAdvance = {
    label,
    fromBlock,
    toBlock: state.block,
    blocks,
    daysPassed,
  };
  return { messages, fx };
}

// A week can now close in the red (Fase 9 charges rent), and the summary used to
// print "+$-15" because the plus was hardcoded. Money is the one number here that
// can go either way.
function signedCash(amount: number): string {
  return amount < 0 ? `-$${Math.abs(amount)}` : `+$${amount}`;
}

export function formatBlock(block: number): string {
  return CalendarConfig.clock.blockLabels[block] ?? CalendarConfig.clock.blockLabels[0];
}

export function formatDuration(blocks: number): string {
  return blocks === 1 ? "1 bloque" : `${blocks} bloques`;
}
