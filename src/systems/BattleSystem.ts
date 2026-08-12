// Battle flow: tier setup, per-round resolution, and reward payout.
// Pure state mutation — the orchestrator owns UI focus, views, and event
// finalization (this module never touches state.lastEvent or saves).

import type {
  BattleResource,
  BattleResourceId,
  BattleState,
  BattleStimulus,
  GameState,
  RoundResult,
  TimeAdvance,
} from "../core/types";
import { maxEnergy, stageIndex } from "../core/derived";
import { clamp } from "../utils/math";
import type { RandomSource } from "../services/RandomService";
import { battleResources, battleRivals, battleStimuli } from "../data/battle";
import { BattleConfig } from "../data/config/BattleConfig";
import { DifficultyConfig, difficultyRules } from "../data/config/DifficultyConfig";
import { advanceClock, formatDuration } from "./CalendarSystem";
import { addXp, applyRhythm } from "./ProgressionSystem";

export function battleLabel(state: GameState): string {
  switch (state.stage) {
    case "pieza":
      return "Batalla casera";
    case "plaza":
      return "Batalla plaza";
    case "regional":
      return "Regional";
    case "nacional":
      return "Nacional";
    case "internacional":
      return "Internacional";
    case "estrella":
      return "Festival";
    case "leyenda":
      return "Leyenda";
  }
}

export function battleDurationBlocks(state: GameState): number {
  return stageIndex(state) === 0 ? BattleConfig.duration.piezaBlocks : BattleConfig.duration.otherStagesBlocks;
}

// Energy the battle entry charges at the current stage. Single source of the
// rule: startBattle deducts it, ActionsSystem gates on it, BattleScene shows it.
export function battleEnergyCost(state: GameState): number {
  return BattleConfig.entry.energyCostBase + stageIndex(state) * BattleConfig.entry.energyCostPerStage;
}

// Seconds the decision timer grants each round at the current difficulty
// (single source: startBattle/advanceBattleRound arm it, GameController ticks
// it, BattleScene sizes its countdown bar with it).
export function battleRoundSeconds(state: GameState): number {
  return BattleConfig.timer.roundSeconds * difficultyRules(state.difficulty).timerMultiplier;
}

// The round the current round would answer to: every completed round is in
// results (pendingResult still points into it during the verdict beat).
function lastRound(battle: BattleState): RoundResult | null {
  return battle.results.length > 0 ? battle.results[battle.results.length - 1] : null;
}

// Hype resolveBattle awards for winning the current round with this resource
// (read-only preview for the choice cards; the resolver consumes it too, so
// the projection can never drift from the payout). Base hype comes from the
// card data; the stimulus, response and repetition rules swing it.
export function projectedHypeGain(battle: BattleState, choice: BattleResource): number {
  const previous = lastRound(battle);
  const stimulusBonus = battle.prompt.best.includes(choice.id)
    ? BattleConfig.roll.promptBonus / BattleConfig.hype.winPromptBonusDivisor
    : 0;
  const responseBonus =
    choice.id === "respuesta" && previous?.rivalChoice === "ataque" ? BattleConfig.tension.responseBonus : 0;
  const repetitionPenalty = previous?.choice === choice.id ? BattleConfig.tension.repetitionPenalty : 0;
  return choice.baseHype + stimulusBonus + responseBonus - repetitionPenalty;
}

// Deals the round's hand: BattleConfig.hand.size distinct resources, drawn
// uniformly without replacement (always exactly hand.size RNG draws). Rule
// (a): after a rival Ataque the counter must be playable, so Respuesta
// replaces the last dealt card when missing (deterministic, no extra draw).
// Rule (b) holds by construction: nothing forces a stimulus-best resource
// into the hand — reading the stimulus means recognizing when the hand fits.
function dealHand(rng: RandomSource, rivalLastChoice: BattleResourceId | null): BattleResourceId[] {
  const pool = battleResources.map((resource) => resource.id);
  const hand: BattleResourceId[] = [];
  for (let i = 0; i < BattleConfig.hand.size; i += 1) {
    hand.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]);
  }
  if (rivalLastChoice === "ataque" && !hand.includes("respuesta")) {
    hand[hand.length - 1] = "respuesta";
  }
  return hand;
}

// Gauntlet 10 seam: the rival's visible resource for the current round.
// AI Rivals will replace this seeded uniform pick with personality-driven
// choice (agresividad, humor, frecuencia de riesgo...) — same signature,
// same single RNG draw contract.
export function chooseRivalMove(battle: BattleState, rng: RandomSource): BattleResourceId {
  void battle; // personalities (gauntlet 10) will read rivalStyle/rivalPower
  return battleResources[rng.int(0, battleResources.length - 1)].id;
}

// Returns false (no mutation, no RNG consumed) when too tired to enter.
// RNG draws: 1 stimulus pick + hand.size hand draws, in that order.
export function startBattle(state: GameState, rng: RandomSource): boolean {
  const cost = battleEnergyCost(state);
  if (state.energy < cost) return false;
  state.energy = clamp(state.energy - cost, 0, maxEnergy(state));
  const tier = getBattleTier(state);
  const rival = BattleConfig.rival;
  const prompt = pickStimulus(rng);
  const hand = dealHand(rng, null);
  state.mode = "battle";
  state.battle = {
    ...tier,
    rivalEnergy: clamp(rival.energyBase + tier.rivalPower * rival.energyPerPower, 0, rival.energyMax),
    rivalEnergyMax: rival.energyMax,
    rivalHype: BattleConfig.rounds.openingHype,
    round: 1,
    maxRounds: BattleConfig.rounds.maxRounds,
    hype: BattleConfig.rounds.openingHype,
    playerScore: 0,
    rivalScore: 0,
    prompt,
    hand,
    timeLeft: battleRoundSeconds(state),
    results: [],
    pendingResult: null,
    finished: false,
    result: null,
  };
  return true;
}

type BattleTier = Omit<
  BattleState,
  | "rivalEnergy"
  | "rivalEnergyMax"
  | "rivalHype"
  | "round"
  | "maxRounds"
  | "hype"
  | "playerScore"
  | "rivalScore"
  | "prompt"
  | "hand"
  | "timeLeft"
  | "results"
  | "pendingResult"
  | "finished"
  | "result"
>;

function getBattleTier(state: GameState): BattleTier {
  const idx = stageIndex(state);
  const picked = battleRivals[idx] ?? battleRivals[0];
  const tier = BattleConfig.tier;
  // Difficulty is the one mechanical choice of the Crear MC screen: it shifts
  // how strong every rival is (and, at payout time, how much a battle pays).
  const difficulty = difficultyRules(state.difficulty);
  return {
    eventName: picked[0],
    rivalName: picked[1],
    rivalStyle: picked[2],
    rivalPower: Math.max(
      DifficultyConfig.rivalPowerFloor,
      tier.rivalPowerBase +
        idx * tier.rivalPowerPerStage +
        Math.floor(state.level / tier.rivalPowerLevelDivisor) +
        difficulty.rivalPowerBonus,
    ),
    rewardCash: tier.rewardCashBase + idx * tier.rewardCashPerStage,
    rewardFans: tier.rewardFansBase + idx * tier.rewardFansPerStage,
    rewardRespect: tier.rewardRespectBase + idx * tier.rewardRespectPerStage,
    rewardFame: tier.rewardFameBase + idx * tier.rewardFamePerStage,
    rewardXp: tier.rewardXpBase + idx * tier.rewardXpPerStage,
  };
}

function pickStimulus(rng: RandomSource): BattleStimulus {
  return battleStimuli[rng.int(0, battleStimuli.length - 1)];
}

// One-word grade for a hype delta (round-result panel vocabulary).
function verdictFor(delta: number): string {
  const verdict = BattleConfig.verdict;
  return delta >= verdict.greatMin ? verdict.labels.great : delta >= verdict.goodMin ? verdict.labels.good : verdict.labels.weak;
}

// The rival's side of a round: power + round pressure + seeded swing.
function rollRival(battle: BattleState, rng: RandomSource): number {
  const roll = BattleConfig.roll;
  return (
    battle.rivalPower * roll.rivalPowerWeight +
    battle.round * roll.roundWeight +
    rng.int(roll.rivalRandomMin, roll.rivalRandomMax)
  );
}

// Meter movement every performed round shares (verdict deltas stay raw; the
// meters clamp here).
function applyRoundSwing(battle: BattleState, playerHypeDelta: number, rivalHypeDelta: number): void {
  battle.hype = clamp(battle.hype + playerHypeDelta, 0, 100);
  battle.rivalHype = clamp(battle.rivalHype + rivalHypeDelta, 0, 100);
  battle.rivalEnergy = clamp(battle.rivalEnergy - BattleConfig.rival.roundEnergyDrain, 0, battle.rivalEnergyMax);
}

// Resolves the current round and parks the battle on its round-result beat
// (pendingResult); advanceBattleRound moves the match forward. Consumes
// exactly three RNG draws, in order: rival move, player roll, rival roll.
export function resolveBattle(state: GameState, rng: RandomSource, choice: BattleResource): void {
  const battle = state.battle;
  if (!battle || battle.finished || battle.pendingResult) return;
  // Only the dealt hand is playable (guards a stale cursor or hotkey).
  if (!battle.hand.includes(choice.id)) return;
  const rivalChoice = chooseRivalMove(battle, rng);
  const roll = BattleConfig.roll;
  // Multi-stat resources average their stats so no card out-scales the rest.
  const statSum = choice.stats.reduce((sum, key) => sum + state.stats[key], 0);
  const statScore = Math.floor((statSum * roll.statWeight) / choice.stats.length);
  const promptBonus = battle.prompt.best.includes(choice.id) ? roll.promptBonus : 0;
  const energyBonus =
    state.energy > roll.highEnergyThreshold
      ? roll.highEnergyBonus
      : state.energy < roll.lowEnergyThreshold
        ? roll.lowEnergyPenalty
        : 0;
  const healthBonus =
    state.health > roll.highHealthThreshold
      ? roll.highHealthBonus
      : state.health < roll.lowHealthThreshold
        ? roll.lowHealthPenalty
        : 0;
  const momentumBonus = Math.floor((state.momentum - roll.momentumPivot) / roll.momentumDivisor);
  const presenceBonus =
    state.outfitLevel * roll.outfitPresenceWeight +
    (state.stage === "pieza" ? 0 : state.outfitLevel * roll.offPiezaOutfitWeight);
  const playerRoll =
    statScore +
    state.level * roll.levelWeight +
    promptBonus +
    energyBonus +
    healthBonus +
    momentumBonus +
    presenceBonus +
    Math.floor(battle.hype / roll.hypeDivisor) +
    rng.int(roll.playerRandomMin, roll.playerRandomMax);
  const rivalRoll = rollRival(battle, rng);
  const wonRound = playerRoll >= rivalRoll;

  // Tension rules (Bible): repeating bores the crowd on any outcome; the
  // counter only pays when the round is actually taken. Hype deltas grade the
  // answers, so they stay raw; the meters clamp in applyRoundSwing.
  const previous = lastRound(battle);
  const repeated = previous?.choice === choice.id;
  const responded = choice.id === "respuesta" && previous?.rivalChoice === "ataque";
  const tension = BattleConfig.tension;
  const playerHypeDelta = wonRound
    ? projectedHypeGain(battle, choice)
    : -(BattleConfig.hype.lossDrop + (repeated ? tension.repetitionPenalty : 0));
  const rivalHypeDelta = wonRound ? BattleConfig.rival.hypeLossGain : BattleConfig.rival.hypeWinGain;
  const tensionNotes: string[] = [];
  if (responded && wonRound) tensionNotes.push(tension.notes.response);
  if (repeated) tensionNotes.push(tension.notes.repetition);

  if (wonRound) battle.playerScore += 1;
  else battle.rivalScore += 1;
  applyRoundSwing(battle, playerHypeDelta, rivalHypeDelta);

  const result: RoundResult = {
    round: battle.round,
    choice: choice.id,
    rivalChoice,
    player: playerRoll,
    rival: rivalRoll,
    note: wonRound ? "El publico reacciona a tu ronda." : "El rival conecto mas fuerte.",
    tensionNotes,
    playerHypeDelta,
    playerVerdict: verdictFor(playerHypeDelta),
    rivalHypeDelta,
    rivalVerdict: verdictFor(rivalHypeDelta),
  };
  battle.results.push(result);
  battle.pendingResult = result;
}

// Decision-timer expiry: the round auto-resolves as a "Pasada" — the player
// skips (no card consumed, no player roll), the rival performs and takes the
// round, and the crowd cools by the configured penalty. Consumes two RNG
// draws (rival move, rival roll): never more than a played round, so the
// stream stays deterministic whatever the player does. GameController.update
// calls this when battle.timeLeft hits zero.
export function expireBattleRound(state: GameState, rng: RandomSource): void {
  const battle = state.battle;
  if (!battle || battle.finished || battle.pendingResult) return;
  const rivalChoice = chooseRivalMove(battle, rng);
  const rivalRoll = rollRival(battle, rng);
  const playerHypeDelta = -BattleConfig.timer.passHypePenalty;
  const rivalHypeDelta = BattleConfig.rival.hypeWinGain;

  battle.rivalScore += 1;
  applyRoundSwing(battle, playerHypeDelta, rivalHypeDelta);
  battle.timeLeft = 0;

  const result: RoundResult = {
    round: battle.round,
    choice: null,
    rivalChoice,
    player: 0,
    rival: rivalRoll,
    note: "El rival aprovecho tu silencio.",
    tensionNotes: [BattleConfig.tension.notes.timeout],
    playerHypeDelta,
    playerVerdict: verdictFor(playerHypeDelta),
    rivalHypeDelta,
    rivalVerdict: verdictFor(rivalHypeDelta),
  };
  battle.results.push(result);
  battle.pendingResult = result;
}

// Advances past the round-result beat (Enter / CONTINUAR): next round with a
// fresh stimulus, a fresh hand of 5 and a re-armed timer, or the final
// verdict after the last round. RNG draws per advance: 1 stimulus pick +
// hand.size hand draws, in that order (the final advance consumes none).
export function advanceBattleRound(state: GameState, rng: RandomSource): void {
  const battle = state.battle;
  if (!battle || battle.finished || !battle.pendingResult) return;
  battle.pendingResult = null;
  if (battle.round >= battle.maxRounds) {
    battle.finished = true;
    battle.result =
      battle.playerScore > battle.rivalScore
        ? "win"
        : battle.playerScore < battle.rivalScore
          ? "loss"
          : "draw";
  } else {
    battle.round += 1;
    battle.prompt = pickStimulus(rng);
    battle.hand = dealHand(rng, lastRound(battle)?.rivalChoice ?? null);
    battle.timeLeft = battleRoundSeconds(state);
  }
}

// Pays out rewards and exits battle mode. Returns the event parts and clock
// fx for the orchestrator to finalize; null when there is nothing to finish.
// rng is part of the system contract even though this path consumes none.
export function finishBattle(state: GameState, rng: RandomSource): { parts: string[]; fx: TimeAdvance } | null {
  void rng;
  const battle = state.battle;
  if (!battle || !battle.finished) return null;
  const won = battle.result === "win";
  const draw = battle.result === "draw";
  const payout = BattleConfig.payout;
  // Difficulty scales the whole payout (normal = 1, so the base tiers stay).
  const reward = (amount: number): number =>
    Math.floor(amount * difficultyRules(state.difficulty).rewardMultiplier);
  const cash = reward(won ? battle.rewardCash : draw ? Math.floor(battle.rewardCash * payout.cashDrawFraction) : 0);
  const fans = reward(
    won
      ? battle.rewardFans
      : draw
        ? Math.floor(battle.rewardFans * payout.fansDrawFraction)
        : Math.floor(battle.rewardFans * payout.fansLossFraction),
  );
  const respect = reward(
    won
      ? battle.rewardRespect
      : draw
        ? Math.floor(battle.rewardRespect * payout.respectDrawFraction)
        : Math.floor(battle.rewardRespect * payout.respectLossFraction),
  );
  const fame = reward(
    won
      ? battle.rewardFame
      : draw
        ? Math.floor(battle.rewardFame * payout.fameDrawFraction)
        : Math.floor(battle.rewardFame * payout.fameLossFraction),
  );
  const xp = reward(
    won
      ? battle.rewardXp
      : draw
        ? Math.floor(battle.rewardXp * payout.xpDrawFraction)
        : Math.floor(battle.rewardXp * payout.xpLossFraction),
  );

  state.cash += cash;
  state.fans += fans;
  state.respect += respect;
  state.fame += fame;
  const levelMessages = addXp(state, xp);
  const rhythmMessages = applyRhythm(
    state,
    "battle",
    won ? BattleConfig.rhythm.winDelta : draw ? BattleConfig.rhythm.drawDelta : BattleConfig.rhythm.lossDelta,
  );
  const clock = advanceClock(state, battleDurationBlocks(state), battle.eventName);

  const resultText = won ? "Ganaste" : draw ? "Empataste" : "Perdiste";
  const parts = [
    `${resultText} en ${battle.eventName} (${formatDuration(battleDurationBlocks(state))}): +$${cash}, +${fans} fans, +${respect} respeto.`,
    ...rhythmMessages,
    ...levelMessages,
    ...clock.messages,
  ];
  state.battle = null;
  state.mode = "career";
  return { parts, fx: clock.fx };
}
