// Save/load persistence for the career sim. Pure module: storage is injected
// (localStorage in the browser, an in-memory map in tests) and no other
// globals are touched. v2 saves carry the day-block clock; v1 saves (24h
// clock) are migrated on load and re-persisted under the v2 key.

import type { Difficulty, GameState } from "../core/types";
import { createNewState } from "../core/state";
import { CalendarConfig } from "../data/config/CalendarConfig";
import { DifficultyConfig } from "../data/config/DifficultyConfig";
import { NewGameConfig } from "../data/config/NewGameConfig";
import { clamp } from "../utils/math";

export const SAVE_KEY = "freestyle-career-save-v2";
export const LEGACY_SAVE_KEY_V1 = "freestyle-career-save-v1";

// v1 stored a 0-23 hour clock. These cutoffs map a saved hour onto the block
// (0=Mañana, 1=Tarde, 2=Noche) that was in progress at save time.
const V1_MORNING_END_HOUR = 12;
const V1_AFTERNOON_END_HOUR = 19;

// v1 save shape: today's GameState with `hour` in place of `block`. Stage ids
// from the 6-stage era are a subset of the current ones, so they pass through.
type SaveV1 = Omit<GameState, "block"> & { hour: number };

function migrateV1(saved: SaveV1): GameState {
  const { hour, ...rest } = saved;
  const block = hour < V1_MORNING_END_HOUR ? 0 : hour < V1_AFTERNOON_END_HOUR ? 1 : 2;
  return { ...rest, block };
}

// --- Field backfills (project rule 3: a save must never break) ----------------
// Saves written before the Crear MC / tienda systems existed simply lack these
// fields, so the key stays at v2 and every new field falls back to its config
// default (and is clamped into range).

function backfillOption(value: number | undefined, count: number, fallback: number): number {
  return Number.isInteger(value) ? clamp(value as number, 1, count) : fallback;
}

function backfillDifficulty(value: Difficulty | undefined): Difficulty {
  return value !== undefined && DifficultyConfig.order.includes(value)
    ? value
    : NewGameConfig.identity.difficulty;
}

// Owned item ids only: strings, no duplicates. Unknown ids are kept so a save
// from a newer catalogue survives a downgrade.
function backfillItems(value: string[] | undefined): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id): id is string => typeof id === "string"))];
}

function backfillNickname(value: string | undefined): string {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed.slice(0, NewGameConfig.identity.nicknameMaxLength) || NewGameConfig.identity.nickname;
}

// Minimal subset of the Web Storage API the manager needs.
export interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

export interface SaveManagerApi {
  load(): GameState | null;
  normalize(saved: GameState): GameState;
  save(state: GameState): GameState;
  delete(): void;
}

export function createSaveManager(storage: StorageLike): SaveManagerApi {
  return {
    // Raw read of the persisted blob; null on missing or corrupt data.
    // Falls back to the v1 key, migrating hour -> block and persisting the
    // result under the v2 key (the v1 blob stays behind, harmless).
    load(): GameState | null {
      try {
        const raw = storage.getItem(SAVE_KEY);
        if (raw) return JSON.parse(raw) as GameState;
        const legacyRaw = storage.getItem(LEGACY_SAVE_KEY_V1);
        if (!legacyRaw) return null;
        const migrated = migrateV1(JSON.parse(legacyRaw) as SaveV1);
        storage.setItem(SAVE_KEY, JSON.stringify(migrated));
        return migrated;
      } catch {
        return null;
      }
    },

    // Backfills missing fields from a fresh state, clamps ranges, and resets
    // transient/session fields so an old save always yields a valid state.
    normalize(saved: GameState): GameState {
      return {
        ...createNewState(saved.playerName || "MC Barrio"),
        ...saved,
        mode: "start",
        inputName: saved.playerName || "MC Barrio",
        animationTime: 0,
        battle: null,
        block: clamp(saved.block ?? 0, 0, CalendarConfig.clock.blocksPerDay - 1),
        nickname: backfillNickname(saved.nickname),
        look: backfillOption(saved.look, NewGameConfig.identityOptions.looks, NewGameConfig.identity.look),
        skin: backfillOption(saved.skin, NewGameConfig.identityOptions.skins, NewGameConfig.identity.skin),
        voice: backfillOption(saved.voice, NewGameConfig.identityOptions.voices, NewGameConfig.identity.voice),
        difficulty: backfillDifficulty(saved.difficulty),
        items: backfillItems(saved.items),
        outfitLevel: clamp(saved.outfitLevel ?? 0, 0, 3),
        studioLevel: clamp(saved.studioLevel ?? 0, 0, 3),
        homeLevel: clamp(saved.homeLevel ?? 0, 0, 3),
        momentum: clamp(saved.momentum ?? 42, 0, 100),
        lastActionId: saved.lastActionId ?? null,
        actionStreak: saved.actionStreak ?? 0,
        lastEvent: `Partida encontrada: ${saved.playerName}, nivel ${saved.level}.`,
      };
    },

    // Persists a snapshot (always resumable in career mode, mid-battle state
    // dropped) and returns it so the caller can keep it as savedSnapshot.
    save(state: GameState): GameState {
      const toSave: GameState = {
        ...state,
        mode: "career",
        inputName: state.playerName,
        battle: null,
        animationTime: 0,
      };
      storage.setItem(SAVE_KEY, JSON.stringify(toSave));
      return toSave;
    },

    delete(): void {
      storage.removeItem(SAVE_KEY);
      storage.removeItem(LEGACY_SAVE_KEY_V1);
    },
  };
}
