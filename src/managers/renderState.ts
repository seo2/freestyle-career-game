// The renderer-independent state dump behind window.render_game_to_text().
//
// It lives outside GameController because it is a pure read of the state plus
// two presentation fields, and because it is the single most load-bearing
// function in the project: the deterministic trace harness compares exactly
// this output, so every behaviour change in the game shows up here first.
// Keeping it apart also keeps GameController under the 500-line rule.

import { getCareerActions } from "../systems/ActionsSystem";
import { getCareerGoals } from "../systems/ProgressionSystem";
import { formatBlock } from "../systems/CalendarSystem";
import { canAffordItem, recommendedItem } from "../systems/StoreSystem";
import { projectedHypeGain } from "../systems/BattleSystem";
import {
  battleDay,
  lastWeekSummary,
  openDays,
  todaysPlan,
} from "../systems/PlanSystem";
import { findOpportunity, isBurntOut } from "../systems/OpportunitySystem";
import { resourceById } from "../data/battle";
import { momentumMood } from "../core/derived";
import type { CareerView, GameState, TimeAdvance } from "../core/types";

export function renderStateToText(
state: GameState,
careerView: CareerView,
timeFx: (TimeAdvance & { elapsed: number; duration: number }) | null,
): string {
  const recommended = recommendedItem(state);
  const actions =
    state.mode === "career"
      ? getCareerActions(state).map((action, index) => ({
          key: String(index + 1),
          id: action.id,
          label: action.label,
          durationBlocks: action.durationBlocks,
          cost: action.cost,
          rhythm: action.rhythm,
          disabled: Boolean(action.disabledReason),
          reason: action.disabledReason ?? null,
        }))
      : [];
  const liveBattle = state.battle;
  const battle = liveBattle
    ? {
        event: liveBattle.eventName,
        rival: liveBattle.rivalName,
        // Who the rival is (gauntlet 10): the archetype and the personality
        // weights that decide which resource they reach for.
        rivalStyle: liveBattle.rivalStyle,
        rivalArchetype: liveBattle.rivalArchetype,
        rivalFlow: liveBattle.rivalFlow,
        rivalPunchline: liveBattle.rivalPunchline,
        rivalPersonality: liveBattle.rivalPersonality,
        // What this event's crowd rewards and what leaves it cold.
        crowdLoves: liveBattle.crowdLoves,
        crowdColds: liveBattle.crowdColds,
        crowdLine: liveBattle.crowdLine,
        round: liveBattle.round,
        score: `${liveBattle.playerScore}-${liveBattle.rivalScore}`,
        hype: liveBattle.hype,
        rivalEnergy: liveBattle.rivalEnergy,
        rivalEnergyMax: liveBattle.rivalEnergyMax,
        rivalHype: liveBattle.rivalHype,
        stimulus: liveBattle.prompt.label,
        prompt: liveBattle.prompt.text,
        // Whole seconds only (determinism contract): the millisecond
        // remainder varies run to run, whole seconds cannot within a
        // capture step. Frozen while a verdict beat is on screen.
        timerSeconds: Math.ceil(liveBattle.timeLeft),
        // Round-result beat on screen (Enter/CONTINUAR advances past it).
        pendingResult: liveBattle.pendingResult
          ? {
              round: liveBattle.pendingResult.round,
              choice: liveBattle.pendingResult.choice,
              rivalChoice: liveBattle.pendingResult.rivalChoice,
              tensionNotes: [...liveBattle.pendingResult.tensionNotes],
              playerHypeDelta: liveBattle.pendingResult.playerHypeDelta,
              playerVerdict: liveBattle.pendingResult.playerVerdict,
              rivalHypeDelta: liveBattle.pendingResult.rivalHypeDelta,
              rivalVerdict: liveBattle.pendingResult.rivalVerdict,
            }
          : null,
        // Per-round verdicts of everything resolved so far.
        results: liveBattle.results.map((entry) => ({
          round: entry.round,
          choice: entry.choice,
          rivalChoice: entry.rivalChoice,
          tensionNotes: [...entry.tensionNotes],
          playerHypeDelta: entry.playerHypeDelta,
          playerVerdict: entry.playerVerdict,
          rivalHypeDelta: entry.rivalHypeDelta,
          rivalVerdict: entry.rivalVerdict,
        })),
        finished: liveBattle.finished,
        result: liveBattle.result,
        // The dealt hand of 5, digit hotkeys 1..5. projectedHype is the
        // exact hype a win would award (single source in BattleSystem).
        hand: liveBattle.hand.map((id, index) => {
          const resource = resourceById(id);
          return {
            key: String(index + 1),
            id,
            label: resource.label,
            boosted: liveBattle.prompt.best.includes(id),
            projectedHype: projectedHypeGain(liveBattle, resource),
          };
        }),
      }
    : null;
  // Weekly plan (Fase 6): the intent per day, what today holds, what is still
  // open and the last closed week. Renderer-independent, like everything else
  // in this dump, so the harness can verify planning without a screenshot.
  const lastWeek = lastWeekSummary(state);
  const week = {
    number: state.week,
    day: state.day,
    plan: state.plan,
    today: todaysPlan(state),
    openDays: openDays(state),
    battleDay: battleDay(),
    record: state.weekRecord,
    // Scheduled offers (Fase 6): what knocked this week, on which day, and
    // whether it was taken or lost.
    opportunities: state.opportunities.map((entry) => ({
      id: entry.id,
      day: entry.day,
      label: findOpportunity(entry.id)?.label ?? entry.id,
      taken: entry.taken,
      missed: entry.missed,
    })),
    burntOut: isBurntOut(state),
    lastClosed: lastWeek
      ? {
          week: lastWeek.week,
          cash: lastWeek.cash,
          fans: lastWeek.fans,
          respect: lastWeek.respect,
          xp: lastWeek.xp,
          battlesWon: lastWeek.battlesWon,
          battlesLost: lastWeek.battlesLost,
          days: lastWeek.days,
        }
      : null,
    closedWeeks: state.weekLog.length,
  };
  return JSON.stringify({
    coordinate_system: "canvas 960x540, origin top-left, x right, y down",
    week,
    mode: state.mode,
    careerView: state.mode === "career" ? careerView : null,
    player: {
      name: state.playerName,
      nickname: state.nickname,
      look: state.look,
      skin: state.skin,
      voice: state.voice,
      difficulty: state.difficulty,
      stage: state.stage,
      level: state.level,
      week: state.week,
      day: state.day,
      block: state.block,
      timeLabel: formatBlock(state.block),
      xp: state.xp,
      xpNext: state.xpNext,
      energy: state.energy,
      health: state.health,
      cash: state.cash,
      fans: state.fans,
      respect: state.respect,
      fame: state.fame,
      songs: state.songs,
      discProgress: state.discProgress,
      upgrades: {
        outfit: state.outfitLevel,
        studio: state.studioLevel,
        home: state.homeLevel,
      },
      items: [...state.items],
      momentum: state.momentum,
      momentumMood: momentumMood(state),
      lastActionId: state.lastActionId,
      actionStreak: state.actionStreak,
      stats: state.stats,
    },
    timeFx: timeFx
      ? {
          label: timeFx.label,
          blocks: timeFx.blocks,
          from: formatBlock(timeFx.fromBlock),
          to: formatBlock(timeFx.toBlock),
          daysPassed: timeFx.daysPassed,
        }
      : null,
    lastEvent: state.lastEvent,
    goals: getCareerGoals(state).map((goal) => ({
      label: goal.label,
      detail: goal.detail,
      value: goal.value,
      max: goal.max,
    })),
    recommendedItem: recommended
      ? {
          id: recommended.id,
          label: recommended.label,
          category: recommended.category,
          price: recommended.price,
          affordable: canAffordItem(state, recommended),
        }
      : null,
    actions,
    battle,
  });
}
