import type { BondId, GameState } from "./types";
import { NewGameConfig } from "../data/config/NewGameConfig";
import { bondDefs } from "../data/bonds";
import { AudioConfig } from "../data/config/AudioConfig";
import { emptyPlan } from "../systems/PlanSystem";

// Where each bond opens, from its definition — the number belongs to the data,
// not to this literal.
const bondStart = (id: BondId): number => bondDefs.find((def) => def.id === id)?.start ?? 0;

// Seed defaults to wall clock (like the legacy engine) but is injectable so
// tests and trace captures can pin the whole run.
export function createNewState(name = "MC Barrio", seed: number = Date.now() >>> 0): GameState {
  return {
    mode: "start",
    playerName: name,
    inputName: name,
    nickname: NewGameConfig.identity.nickname,
    look: NewGameConfig.identity.look,
    skin: NewGameConfig.identity.skin,
    voice: NewGameConfig.identity.voice,
    difficulty: NewGameConfig.identity.difficulty,
    week: 1,
    // A fresh career starts with the week wide open: the first decision the
    // game asks for is what to do with it (Bible: plan the week).
    plan: emptyPlan(),
    weekRecord: [],
    weekLog: [],
    opportunities: [],
    opportunitiesWeek: 0,
    weekOpening: {
      cash: NewGameConfig.startingCash,
      fans: 0,
      respect: 0,
      fame: 0,
      xp: 0,
    },
    day: 1,
    block: NewGameConfig.startingBlock,
    level: 1,
    xp: 0,
    xpNext: NewGameConfig.xpToFirstLevel,
    energy: NewGameConfig.startingEnergy,
    health: NewGameConfig.startingHealth,
    cash: NewGameConfig.startingCash,
    fans: 0,
    respect: 0,
    fame: 0,
    songs: 0,
    discProgress: 0,
    outfitLevel: 0,
    studioLevel: 0,
    homeLevel: 0,
    items: [],
    momentum: NewGameConfig.startingMomentum,
    lastActionId: null,
    actionStreak: 0,
    stage: "pieza",
    stats: { ...NewGameConfig.startingStats },
    lastEvent: "Escribe tu nombre artistico y empieza desde la pieza.",
    seed,
    animationTime: 0,
    battle: null,
    cypher: null,
    // Mismo origen: every axis starts neutral and only decisions move it.
    axes: { undergroundComercial: 0, batalleroMusico: 0, soloCrew: 0, autenticoPolemico: 0 },
    decisions: [],
    pendingDilemma: null,
    seenDilemmas: [],
    pendingEpilogue: null,
    stageStartedWeek: 1,
    epilogueFromWeek: 1,
    // The family is already there when the career starts; the crew is something
    // you build. fedWeek 0 means "nobody has visited yet", so week 1's visit still
    // counts — a 1 here used to swallow it, because the visit now pays once a week.
    bonds: {
      familia: { affinity: bondStart("familia"), fedWeek: 0 },
      crew: { affinity: bondStart("crew"), fedWeek: 0 },
    },
    rivalries: [],
    releases: [],
    // The default cut, which the barbershop can change for money.
    hair: NewGameConfig.identity.hair,
    hairColor: NewGameConfig.identity.hairColor,
    beard: NewGameConfig.identity.beard,
    // Sound on, at a volume that is not the loudest thing the game can do.
    audio: { volume: AudioConfig.volume.start, sfxOn: true, musicOn: true },
  };
}
