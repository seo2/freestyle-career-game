// Arc epilogues (Fase 7): the chapter closes and the game tells you who you
// became — read from what you did, never from a menu.
//
// The GDD's rule is "destinos como atractores, no rutas escritas". So this system
// composes: it takes the axes the player actually moved, the decisions they made
// in that stage, and the weeks it took, and builds the chapter out of fragments.
// Two players who reach Plaza on the same week can read different endings, and a
// player who never leaned anywhere reads that too — which is honest, not a gap.
//
// Pure functions over GameState. No RNG at all: an epilogue is a mirror, and a
// mirror does not roll dice.

import type { DecisionRecord, GameState, IdentityAxis, StageId } from "../core/types";
import { axisChapterLines, destinyAttractors, stageChapters, undecidedLine } from "../data/epilogues";
import { DilemmaConfig } from "../data/config/DilemmaConfig";
import { stages } from "../data/stages";
import { releaseTitle } from "./ReleaseSystem";

const AXES: IdentityAxis[] = ["undergroundComercial", "batalleroMusico", "soloCrew", "autenticoPolemico"];

export interface Epilogue {
  stage: StageId;
  title: string;
  opening: string;
  // One line per axis that actually leaned, strongest first. Empty leans read as
  // the undecided line instead of inventing a destiny.
  chapterLines: string[];
  // The emerging profile, when the axes point somewhere clearly enough.
  destiny: { label: string; line: string } | null;
  // What the chapter cost and what it left.
  weeks: number;
  decisions: DecisionRecord[];
  battlesWon: number;
  battlesLost: number;
  opens: string;
}

// How far an axis leaned, and which way — the same threshold the identity readout
// uses, so the epilogue never claims a lean the stats screen calls undefined.
function leanedAxes(state: GameState): { axis: IdentityAxis; value: number }[] {
  return AXES.map((axis) => ({ axis, value: state.axes[axis] }))
    .filter((entry) => Math.abs(entry.value) >= DilemmaConfig.axes.leanThreshold)
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
}

// The emerging profile. When several attractors hold, the one the player leaned
// into HARDEST wins — scored by how far past its thresholds they went. Picking
// the first match instead read a +52 comercial MC as a producer just because
// "productor" happened to be listed earlier.
export function destinyFor(state: GameState): { label: string; line: string } | null {
  let best: { label: string; line: string; score: number } | null = null;
  for (const attractor of destinyAttractors) {
    const needs = Object.entries(attractor.needs) as [IdentityAxis, number][];
    let score = 0;
    const holds = needs.every(([axis, needed]) => {
      const value = state.axes[axis];
      if (needed >= 0) {
        if (value < needed) return false;
        score += value - needed;
        return true;
      }
      if (value > needed) return false;
      score += needed - value;
      return true;
    });
    if (!holds) continue;
    // A tie goes to the attractor that asked for more axes: it is the sharper
    // read of the same career.
    const weighted = score + needs.length;
    if (!best || weighted > best.score) best = { label: attractor.label, line: attractor.line, score: weighted };
  }
  return best ? { label: best.label, line: best.line } : null;
}

// Builds the epilogue of the stage just left behind.
export function buildEpilogue(state: GameState, stage: StageId): Epilogue | null {
  const chapter = stageChapters[stage];
  if (!chapter) return null;
  const leans = leanedAxes(state);
  const chapterLines = leans.map((entry) =>
    entry.value > 0 ? axisChapterLines[entry.axis].high : axisChapterLines[entry.axis].low,
  );
  // Only the decisions made during this chapter belong in it.
  const decisions = state.decisions.filter((entry) => entry.week >= state.epilogueFromWeek);
  const battles = state.weekLog
    .filter((week) => week.week >= state.epilogueFromWeek)
    .reduce(
      (totals, week) => ({
        won: totals.won + week.battlesWon,
        lost: totals.lost + week.battlesLost,
      }),
      { won: 0, lost: 0 },
    );
  // A recording career gets named too (Fase 10). Without this an MC who put out a
  // disco read exactly like one who never entered a studio, because the chapter was
  // composed from the axes alone.
  const work = releaseTitle(state);
  if (work) {
    chapterLines.unshift(
      `Dejaste algo grabado: ${work.toLowerCase()}. Eso queda cuando el ruido se apaga.`,
    );
  }
  return {
    stage,
    title: chapter.title,
    opening: chapter.opening,
    chapterLines: chapterLines.length > 0 ? chapterLines : [undecidedLine],
    destiny: destinyFor(state),
    weeks: Math.max(1, state.week - state.epilogueFromWeek + 1),
    decisions,
    battlesWon: battles.won,
    battlesLost: battles.lost,
    opens: chapter.opens,
  };
}

// Called when the stage advances: remembers which chapter closed and stops the
// loop on it. The stage clock restarts here so the next chapter measures itself.
export function openEpilogue(state: GameState, leftStage: StageId): void {
  if (!stageChapters[leftStage]) return;
  state.pendingEpilogue = leftStage;
  // The closing chapter's start is remembered BEFORE the new stage's clock
  // starts, or the epilogue would measure the chapter it is not about.
  state.epilogueFromWeek = state.stageStartedWeek;
  state.stageStartedWeek = state.week;
  state.mode = "epilogue";
}

// Closing it returns to the career. The chapter itself is not stored: it is a
// read of the state, so it can always be rebuilt.
export function closeEpilogue(state: GameState): void {
  state.pendingEpilogue = null;
  state.mode = "career";
}

// The title of the stage the player is heading into, for the epilogue's footer.
export function nextStageTitle(state: GameState): string {
  const index = stages.findIndex((stage) => stage.id === state.stage);
  return stages[index]?.title ?? "";
}
