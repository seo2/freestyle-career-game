// The cypher: rapping in a circle with friends (owner decision, 2026-08-13).
//
// It is TRAINING, not a career event. There is no rival roll and no hype meter:
// you throw a resource and roll against YOUR OWN stat, so the question is
// whether the thing you tried came out. What you take home is stat points in the
// stats that resource exercises — which makes the cypher the any-day outlet and
// lets the stage battle keep its weekend appointment without ever locking a
// player out of rapping.
//
// Pure functions over GameState, RNG only through the injected RandomSource.
// Progression (stats, xp, momentum) and the clock stay in their own systems.

import type { CypherTurn, GameState, StatKey } from "../core/types";
import type { BattleResource, BattleResourceId } from "../core/types";
import { battleResources, resourceById } from "../data/battle";
import { CypherConfig } from "../data/config/CypherConfig";
import { statLabels } from "../data/stats";
import type { RandomSource } from "../services/RandomService";
import { addStat, addXp, applyRhythm } from "./ProgressionSystem";
import { spendActionTime } from "./CalendarSystem";
import { clamp } from "../utils/math";

// Deals the turn's options: distinct resources drawn without replacement, so a
// circle always offers a choice. Consumes exactly handSize draws.
function dealOptions(rng: RandomSource): BattleResourceId[] {
  const pool = battleResources.map((resource) => resource.id);
  const hand: BattleResourceId[] = [];
  for (let i = 0; i < CypherConfig.entry.handSize; i += 1) {
    hand.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]);
  }
  return hand;
}

export function cypherEnergyCost(): number {
  return CypherConfig.entry.energyCost;
}

// Opens the cypher. Returns false without touching state or RNG when there is
// not enough energy, so the caller can explain.
export function startCypher(state: GameState, rng: RandomSource): boolean {
  if (state.energy < CypherConfig.entry.energyCost) return false;
  state.mode = "cypher";
  state.cypher = {
    turn: 1,
    maxTurns: CypherConfig.entry.turns,
    options: dealOptions(rng),
    turns: [],
    pending: null,
    finished: false,
  };
  return true;
}

// How well a resource comes out for this MC: their own stats plus a roll. No
// opponent — the cypher measures you against yourself.
function verdictFor(score: number): { label: string; kind: "great" | "good" | "weak" } {
  const turn = CypherConfig.turn;
  if (score >= turn.greatAt) return { label: turn.labels.great, kind: "great" };
  if (score >= turn.goodAt) return { label: turn.labels.good, kind: "good" };
  return { label: turn.labels.weak, kind: "weak" };
}

// The stats a resource exercises (data, shared with the battle).
export function exercisedStats(resource: BattleResource): StatKey[] {
  return resource.stats;
}

// Throws a resource into the circle. Consumes exactly one RNG draw (the roll)
// and parks the cypher on the turn's verdict, so the screen can show what came
// out before the circle moves on.
export function throwResource(state: GameState, rng: RandomSource, choice: BattleResource): void {
  const cypher = state.cypher;
  if (!cypher || cypher.finished || cypher.pending) return;
  if (!cypher.options.includes(choice.id)) return;
  const conf = CypherConfig.turn;
  const stats = exercisedStats(choice);
  const statSum = stats.reduce((sum, key) => sum + state.stats[key], 0);
  const statScore = Math.floor((statSum * conf.statWeight) / stats.length);
  const roll = rng.int(conf.rollMin, conf.rollMax);
  const score = statScore + roll;
  const verdict = verdictFor(score);
  // Repeating a resource in the same circle teaches less: variety is the point.
  const repeated = cypher.turns.some((entry) => entry.choice === choice.id);
  const base =
    verdict.kind === "great" ? conf.xpGreat : verdict.kind === "good" ? conf.xpGood : conf.xpWeak;
  const gain = Math.max(0, base - (repeated ? conf.repeatPenalty : 0));

  // Practice pays into the stats the resource exercises, split so a two-stat
  // resource does not train twice as fast.
  const perStat = Math.max(1, Math.round(gain / stats.length));
  const learned: CypherTurn["learned"] = [];
  for (const stat of stats) {
    addStat(state, stat, perStat);
    learned.push({ stat, amount: perStat, label: statLabels[stat] });
  }

  const entry: CypherTurn = {
    turn: cypher.turn,
    choice: choice.id,
    score,
    verdict: verdict.label,
    kind: verdict.kind,
    repeated,
    learned,
  };
  cypher.turns.push(entry);
  cypher.pending = entry;
}

// Past the turn's verdict: next turn with fresh options, or the closing screen.
// RNG per advance: handSize draws (none on the last advance).
export function advanceCypher(state: GameState, rng: RandomSource): void {
  const cypher = state.cypher;
  if (!cypher || cypher.finished || !cypher.pending) return;
  cypher.pending = null;
  if (cypher.turn >= cypher.maxTurns) {
    cypher.finished = true;
    return;
  }
  cypher.turn += 1;
  cypher.options = dealOptions(rng);
}

export interface CypherOutcome {
  parts: string[];
  fx: ReturnType<typeof spendActionTime>["fx"];
}

// Closes the cypher: pays momentum, career xp and the clock, then clears it.
// The stat points were already paid turn by turn — that is the practice.
export function finishCypher(state: GameState, rng: RandomSource): CypherOutcome | null {
  const cypher = state.cypher;
  if (!cypher || !cypher.finished) return null;
  void rng;
  const conf = CypherConfig.payout;
  const cleanTurns = cypher.turns.filter((entry) => entry.kind === "great").length;
  const goodTurns = cypher.turns.filter((entry) => entry.kind !== "weak").length;
  const allClean = cleanTurns === cypher.turns.length && cypher.turns.length > 0;

  const parts: string[] = [];
  const learnedTotals = new Map<StatKey, number>();
  for (const entry of cypher.turns) {
    for (const gain of entry.learned) {
      learnedTotals.set(gain.stat, (learnedTotals.get(gain.stat) ?? 0) + gain.amount);
    }
  }
  const learnedText = [...learnedTotals.entries()]
    .map(([stat, amount]) => `+${amount} ${statLabels[stat]}`)
    .join(", ");
  parts.push(
    goodTurns === 0
      ? `Cypher trabado: te fuiste con ${learnedText}.`
      : `Cypher: ${goodTurns}/${cypher.turns.length} te salieron. ${learnedText}.`,
  );

  if (allClean) {
    state.respect = Math.max(0, state.respect + conf.respectAllClean);
    parts.push(`El circulo te reconocio: +${conf.respectAllClean} respeto.`);
  }

  const momentum =
    allClean ? conf.momentumGreat : goodTurns > 0 ? conf.momentumGood : conf.momentumWeak;
  state.momentum = clamp(state.momentum + momentum, 0, 100);
  parts.push(...applyRhythm(state, conf.rhythmActionId, momentum));
  parts.push(...addXp(state, conf.xpBase + goodTurns * conf.xpPerGoodTurn));

  const clock = spendActionTime(state, CypherConfig.entry.energyCost, CypherConfig.entry.blocks, "Cypher");
  parts.push(...clock.messages);

  state.cypher = null;
  state.mode = "career";
  return { parts, fx: clock.fx };
}

// Read-only helper for the screen: the resources on offer this turn.
export function cypherOptions(state: GameState): BattleResource[] {
  return (state.cypher?.options ?? []).map((id) => resourceById(id));
}
