// Career actions: the weekly-loop verbs (practice, cypher, work, social,
// write, record, battle, show, rest). Descriptors are pure reads; execution
// mutates GameState in place and reports an ActionResult for the orchestrator
// to finalize. Durations run in day blocks (see CalendarSystem).

import type { ActionResult, CareerActionInfo, GameState, StatKey } from "../core/types";
import { maxEnergy, recordCost, stageIndex, currentStage } from "../core/derived";
import { ActionsConfig } from "../data/config/ActionsConfig";
import { statLabels } from "../data/stats";
import type { RandomSource } from "../services/RandomService";
import { clamp } from "../utils/math";
import { advanceClock, formatDuration, spendActionTime } from "./CalendarSystem";
import { addStat, addXp, applyRhythm, rhythmPreview } from "./ProgressionSystem";
import { battleDurationBlocks, battleEnergyCost, battleLabel, startBattle } from "./BattleSystem";
import { burnoutReason, isBurntOut } from "./OpportunitySystem";
import { startCypher } from "./CypherSystem";
import { CypherConfig } from "../data/config/CypherConfig";

export function getCareerActions(state: GameState): CareerActionInfo[] {
  const actions: CareerActionInfo[] = [];
  const tired = state.energy < ActionsConfig.tirednessEnergyThreshold ? "Necesitas descansar." : undefined;
  const stage = currentStage(state);

  actions.push({
    id: "practice",
    label: "Practicar",
    detail: "Barras frente al espejo y beats en loop.",
    cost: `${formatDuration(ActionsConfig.practice.blocks)} / -${ActionsConfig.practice.energyCost} energia`,
    rhythm: rhythmPreview(state, "practice", ActionsConfig.practice.rhythmDelta),
    durationBlocks: ActionsConfig.practice.blocks,
    disabledReason: state.energy < ActionsConfig.practice.energyCost ? tired : undefined,
  });

  actions.push({
    id: "cypher",
    label: "Cypher",
    detail: "Rondas con amigos: practicas el recurso que elijas.",
    cost: `${formatDuration(CypherConfig.entry.blocks)} / -${CypherConfig.entry.energyCost} energia`,
    rhythm: rhythmPreview(state, "cypher", ActionsConfig.cypher.rhythmDelta),
    durationBlocks: CypherConfig.entry.blocks,
    disabledReason: state.energy < CypherConfig.entry.energyCost ? tired : undefined,
  });

  actions.push({
    id: "work",
    label: "Trabajar",
    detail: "Turno corto para financiar micros y estudio.",
    cost: `${formatDuration(ActionsConfig.work.blocks)} / -${ActionsConfig.work.energyCost} energia`,
    rhythm: rhythmPreview(state, "work", ActionsConfig.work.rhythmDelta),
    durationBlocks: ActionsConfig.work.blocks,
    disabledReason: state.energy < ActionsConfig.work.energyCost ? tired : undefined,
  });

  actions.push({
    id: "social",
    label: "Subir clip",
    detail: "Publicar freestyle, responder comentarios.",
    cost: `${formatDuration(ActionsConfig.social.blocks)} / -${ActionsConfig.social.energyCost} energia`,
    rhythm: rhythmPreview(state, "social", ActionsConfig.social.rhythmDelta),
    durationBlocks: ActionsConfig.social.blocks,
    disabledReason: state.energy < ActionsConfig.social.energyCost ? tired : undefined,
  });

  actions.push({
    id: "write",
    label: "Escribir tema",
    detail: "Convertir barras en una cancion grabable.",
    cost: `${formatDuration(ActionsConfig.write.blocks)} / -${ActionsConfig.write.energyCost} energia`,
    rhythm: rhythmPreview(state, "write", ActionsConfig.write.rhythmDelta),
    durationBlocks: ActionsConfig.write.blocks,
    disabledReason: state.energy < ActionsConfig.write.energyCost ? tired : undefined,
  });

  actions.push({
    id: "record",
    label: "Grabar",
    detail: "Pagar estudio y subir una cancion terminada.",
    cost: `${formatDuration(ActionsConfig.record.blocks)} / $${recordCost(state)} / -${ActionsConfig.record.energyCost} energia`,
    rhythm: rhythmPreview(state, "record", ActionsConfig.record.rhythmDelta),
    durationBlocks: ActionsConfig.record.blocks,
    disabledReason:
      state.discProgress < ActionsConfig.record.songProgressRequired
        ? `Necesitas ${ActionsConfig.record.songProgressRequired}% de cancion.`
        : state.cash < recordCost(state)
          ? "Falta dinero."
          : state.energy < ActionsConfig.record.energyCost
            ? tired
            : undefined,
  });

  const battleCost = battleEnergyCost(state);
  actions.push({
    id: "battle",
    label: battleLabel(state),
    detail: `${stage.place}: ronda por decisiones rapidas.`,
    cost: `${formatDuration(battleDurationBlocks(state))} / -${battleCost} energia`,
    rhythm: rhythmPreview(state, "battle", ActionsConfig.battle.rhythmDelta),
    durationBlocks: battleDurationBlocks(state),
    disabledReason: state.energy < battleCost ? tired : undefined,
  });

  if (state.songs >= ActionsConfig.show.unlockMinSongs || stageIndex(state) >= ActionsConfig.show.unlockMinStageIndex) {
    actions.push({
      id: "show",
      label: "Show chico",
      detail: "Tocar en vivo, vender merch y probar canciones.",
      cost: `${formatDuration(ActionsConfig.show.blocks)} / -${ActionsConfig.show.energyCost} energia`,
      rhythm: rhythmPreview(state, "show", ActionsConfig.show.rhythmDelta),
      durationBlocks: ActionsConfig.show.blocks,
      disabledReason: state.energy < ActionsConfig.show.energyCost ? tired : undefined,
    });
  }

  actions.push({
    id: "rest",
    label: "Descansar",
    detail: "Recuperar aire y evitar quemarte.",
    cost: `${formatDuration(ActionsConfig.rest.blocks)} / +energia / +salud`,
    rhythm: rhythmPreview(
      state,
      "rest",
      state.energy < ActionsConfig.rest.lowEnergyThreshold
        ? ActionsConfig.rest.rhythmLowEnergyDelta
        : ActionsConfig.rest.rhythmRestedDelta,
    ),
    durationBlocks: ActionsConfig.rest.blocks,
  });

  // Mandatory rest (Bible: fatigue and mental health force a break). Below the
  // health floor every action except resting closes — the game stops letting you
  // dig a deeper hole. Applied last so it overrides every other reason.
  if (isBurntOut(state)) {
    for (const action of actions) {
      if (action.id !== "rest") action.disabledReason = burnoutReason();
    }
  }

  return actions;
}

export function executeAction(state: GameState, rng: RandomSource, actionId: string): ActionResult {
  const action = getCareerActions(state).find((item) => item.id === actionId);
  if (!action || action.disabledReason) return { type: "none" };

  switch (actionId) {
    case "practice":
      return runPractice(state, rng);
    case "cypher":
      // Owner decision (2026-08-13): the cypher is training with its own
      // screen, so the action opens it instead of resolving in one line. Its
      // rewards are paid turn by turn there (CypherSystem).
      return startCypher(state, rng) ? { type: "cypher-started" } : { type: "none" };
    case "work":
      return runWork(state, rng);
    case "social":
      return runSocial(state, rng);
    case "write":
      return runWrite(state, rng);
    case "record":
      return runRecord(state, rng);
    case "battle":
      return startBattle(state, rng) ? { type: "battle-started" } : { type: "none" };
    case "show":
      return runShow(state, rng);
    case "rest":
      return runRest(state);
    default:
      return { type: "none" };
  }
}

function runPractice(state: GameState, rng: RandomSource): ActionResult {
  const cfg = ActionsConfig.practice;
  const gained: StatKey = rng.next() > cfg.flowVsImproPickThreshold ? "flow" : "improvisacion";
  addStat(state, gained, cfg.statGain);
  const levelMessages = addXp(state, cfg.xp);
  const rhythmMessages = applyRhythm(state, "practice", cfg.rhythmDelta);
  const clock = spendActionTime(state, cfg.energyCost, cfg.blocks, "Practicar");
  return {
    type: "event",
    parts: [
      `Practicaste en la pieza: +${cfg.statGain} ${statLabels[gained]}.`,
      ...rhythmMessages,
      ...levelMessages,
      ...clock.messages,
    ],
    fx: clock.fx,
  };
}


function runWork(state: GameState, rng: RandomSource): ActionResult {
  const cfg = ActionsConfig.work;
  const earned = cfg.earnBase + state.stats.disciplina * cfg.earnPerDisciplina + rng.int(0, cfg.earnRandomMax);
  state.cash += earned;
  addStat(state, "disciplina", rng.next() > cfg.disciplinaGainThreshold ? cfg.disciplinaGain : 0);
  const levelMessages = addXp(state, cfg.xp);
  const rhythmMessages = applyRhythm(state, "work", cfg.rhythmDelta);
  const clock = spendActionTime(state, cfg.energyCost, cfg.blocks, "Trabajar");
  return {
    type: "event",
    parts: [`Trabajaste ${formatDuration(cfg.blocks)}: +$${earned}.`, ...rhythmMessages, ...levelMessages, ...clock.messages],
    fx: clock.fx,
  };
}

function runSocial(state: GameState, rng: RandomSource): ActionResult {
  const cfg = ActionsConfig.social;
  const viral = rng.next() > cfg.viralThreshold;
  const fanGain =
    state.stats.carisma * cfg.fansPerCarisma +
    state.outfitLevel * cfg.fansPerOutfitLevel +
    rng.int(cfg.fansRandomMin, cfg.fansRandomMax) +
    (viral ? cfg.viralFansBonus : 0);
  const fameGain = Math.floor(fanGain / cfg.fameFromFansDivisor) + (viral ? cfg.viralFameBonus : 0);
  state.fans += fanGain;
  state.fame += fameGain;
  state.health = clamp(state.health - (viral ? cfg.healthCostViral : cfg.healthCostNormal), 0, 100);
  addStat(state, "carisma", rng.next() > cfg.carismaGainThreshold ? cfg.carismaGain : 0);
  const levelMessages = addXp(state, cfg.xpBase + (viral ? cfg.xpViralBonus : 0));
  const rhythmMessages = applyRhythm(state, "social", viral ? cfg.rhythmViralDelta : cfg.rhythmDelta);
  const clock = spendActionTime(state, cfg.energyCost, cfg.blocks, "Redes");
  return {
    type: "event",
    parts: [
      viral
        ? `El clip se movio fuerte: +${fanGain} fans.`
        : `Subiste un clip: +${fanGain} fans.`,
      ...rhythmMessages,
      ...levelMessages,
      ...clock.messages,
    ],
    fx: clock.fx,
  };
}

function runWrite(state: GameState, rng: RandomSource): ActionResult {
  const cfg = ActionsConfig.write;
  const progress =
    cfg.progressBase +
    state.stats.metrica * cfg.progressPerMetrica +
    state.studioLevel * cfg.progressPerStudioLevel +
    rng.int(0, cfg.progressRandomMax);
  state.discProgress = clamp(state.discProgress + progress, 0, cfg.progressCap);
  addStat(state, rng.next() > cfg.metricaVsPunchlinePickThreshold ? "metrica" : "punchline", cfg.statGain);
  const levelMessages = addXp(state, cfg.xp);
  const rhythmMessages = applyRhythm(state, "write", cfg.rhythmDelta);
  const clock = spendActionTime(state, cfg.energyCost, cfg.blocks, "Escribir");
  return {
    type: "event",
    parts: [
      `Escribiste: +${progress}% de cancion.`,
      ...rhythmMessages,
      ...levelMessages,
      ...clock.messages,
    ],
    fx: clock.fx,
  };
}

function runRecord(state: GameState, rng: RandomSource): ActionResult {
  const cfg = ActionsConfig.record;
  state.cash -= recordCost(state);
  state.discProgress = 0;
  state.songs += 1;
  const fanGain =
    cfg.fansBase +
    state.stats.flow * cfg.fansPerFlow +
    state.stats.carisma * cfg.fansPerCarisma +
    state.studioLevel * cfg.fansPerStudioLevel +
    state.outfitLevel * cfg.fansPerOutfitLevel +
    rng.int(0, cfg.fansRandomMax);
  state.fans += fanGain;
  state.fame += Math.floor(fanGain / cfg.fameFromFansDivisor);
  state.respect += cfg.respectGain;
  const levelMessages = addXp(state, cfg.xp);
  const rhythmMessages = applyRhythm(state, "record", cfg.rhythmDelta);
  const clock = spendActionTime(state, cfg.energyCost, cfg.blocks, "Grabar");
  return {
    type: "event",
    parts: [
      `Grabaste la cancion #${state.songs}: +${fanGain} fans.`,
      ...rhythmMessages,
      ...levelMessages,
      ...clock.messages,
    ],
    fx: clock.fx,
  };
}

function runShow(state: GameState, rng: RandomSource): ActionResult {
  const cfg = ActionsConfig.show;
  const earned =
    cfg.earnBase +
    state.songs * cfg.earnPerSong +
    state.stats.escena * cfg.earnPerEscena +
    state.outfitLevel * cfg.earnPerOutfitLevel +
    rng.int(0, cfg.earnRandomMax);
  const fans =
    cfg.fansBase +
    state.stats.escena * cfg.fansPerEscena +
    state.outfitLevel * cfg.fansPerOutfitLevel +
    state.studioLevel * cfg.fansPerStudioLevel +
    rng.int(0, cfg.fansRandomMax);
  state.cash += earned;
  state.fans += fans;
  state.fame += Math.floor(fans / cfg.fameFromFansDivisor);
  addStat(state, "escena", cfg.escenaGain);
  const levelMessages = addXp(state, cfg.xp);
  const rhythmMessages = applyRhythm(state, "show", cfg.rhythmDelta);
  const clock = spendActionTime(state, cfg.energyCost, cfg.blocks, "Show");
  return {
    type: "event",
    parts: [
      `Hiciste show: +$${earned}, +${fans} fans.`,
      ...rhythmMessages,
      ...levelMessages,
      ...clock.messages,
    ],
    fx: clock.fx,
  };
}

function runRest(state: GameState): ActionResult {
  const cfg = ActionsConfig.rest;
  const rhythmBase = state.energy < cfg.lowEnergyThreshold ? cfg.rhythmLowEnergyDelta : cfg.rhythmRestedDelta;
  state.energy = clamp(
    state.energy + cfg.energyBase + state.stats.disciplina * cfg.energyPerDisciplina + state.homeLevel * cfg.energyPerHomeLevel,
    0,
    maxEnergy(state),
  );
  state.health = clamp(state.health + cfg.healthBase + state.homeLevel * cfg.healthPerHomeLevel, 0, 100);
  const rhythmMessages = applyRhythm(state, "rest", rhythmBase);
  const clock = advanceClock(state, cfg.blocks, "Descansar");
  return {
    type: "event",
    parts: ["Descansaste y ordenaste la cabeza.", ...rhythmMessages, ...clock.messages],
    fx: clock.fx,
  };
}
