import type { GameState } from "./types";
import { NewGameConfig } from "../data/config/NewGameConfig";

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
  };
}
