// Save/load persistence for the career sim. Pure module: storage is injected
// (localStorage in the browser, an in-memory map in tests) and no other
// globals are touched. v2 saves carry the day-block clock; v1 saves (24h
// clock) are migrated on load and re-persisted under the v2 key.

import type {
  BondId,
  BondState,
  DecisionRecord,
  Difficulty,
  GameState,
  IdentityAxes,
  PlannedDayRecord,
  RivalryState,
  ScheduledOpportunity,
  StageId,
  WeekPlan,
  WeekSummary,
} from "../core/types";
import { createNewState } from "../core/state";
import { CalendarConfig } from "../data/config/CalendarConfig";
import { PlanConfig } from "../data/config/PlanConfig";
import { DilemmaConfig } from "../data/config/DilemmaConfig";
import { RelationshipConfig } from "../data/config/RelationshipConfig";
import { bondDefs } from "../data/bonds";
import { emptyPlan } from "../systems/PlanSystem";
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
// Fase 6 (weekly plan): a save written before it has no plan at all, so the
// week is backfilled empty and the player simply starts planning from today.
// The history and the running record backfill empty for the same reason — a
// reconstructed past would be a lie.
function backfillPlan(value: unknown): WeekPlan {
  const plan = emptyPlan();
  if (!Array.isArray(value)) return plan;
  for (let i = 0; i < plan.length; i += 1) {
    const entry = value[i];
    plan[i] = typeof entry === "string" ? entry : null;
  }
  return plan;
}

function backfillDayRecords(value: unknown): PlannedDayRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is PlannedDayRecord =>
      typeof entry === "object" && entry !== null && typeof (entry as PlannedDayRecord).day === "number",
  );
}

function backfillWeekLog(value: unknown): WeekSummary[] {
  if (!Array.isArray(value)) return [];
  const log = value.filter(
    (entry): entry is WeekSummary =>
      typeof entry === "object" && entry !== null && typeof (entry as WeekSummary).week === "number",
  );
  // Trim to the bound even if an older save (or a hand-edited one) carries more.
  return log.slice(-PlanConfig.history.maxWeeks);
}

function backfillAxes(value: unknown): IdentityAxes {
  const neutral: IdentityAxes = {
    undergroundComercial: 0,
    batalleroMusico: 0,
    soloCrew: 0,
    autenticoPolemico: 0,
  };
  if (typeof value !== "object" || value === null) return neutral;
  const saved = value as Partial<Record<keyof IdentityAxes, unknown>>;
  for (const axis of Object.keys(neutral) as (keyof IdentityAxes)[]) {
    const raw = saved[axis];
    if (typeof raw === "number" && Number.isFinite(raw)) {
      neutral[axis] = clamp(raw, DilemmaConfig.axes.min, DilemmaConfig.axes.max);
    }
  }
  return neutral;
}

function backfillDecisions(value: unknown): DecisionRecord[] {
  if (!Array.isArray(value)) return [];
  const records = value.filter(
    (entry): entry is DecisionRecord =>
      typeof entry === "object" &&
      entry !== null &&
      typeof (entry as DecisionRecord).dilemmaId === "string" &&
      typeof (entry as DecisionRecord).optionId === "string",
  );
  return records.slice(-DilemmaConfig.log.maxDecisions);
}

function backfillBonds(value: unknown): Record<BondId, BondState> {
  const cfg = RelationshipConfig.bonds;
  // A save from before relationships existed starts where a new career does:
  // the family is there, the crew is something you build. Not at zero — nobody
  // wakes up estranged because the game grew a feature.
  const fresh = {} as Record<BondId, BondState>;
  for (const def of bondDefs) fresh[def.id] = { affinity: def.start, fedWeek: 0 };
  if (typeof value !== "object" || value === null) return fresh;
  const saved = value as Partial<Record<BondId, unknown>>;
  for (const def of bondDefs) {
    const raw = saved[def.id];
    if (typeof raw !== "object" || raw === null) continue;
    const bond = raw as Partial<BondState>;
    fresh[def.id] = {
      affinity: typeof bond.affinity === "number" && Number.isFinite(bond.affinity)
        ? clamp(bond.affinity, cfg.min, cfg.max)
        : def.start,
      fedWeek: typeof bond.fedWeek === "number" && Number.isFinite(bond.fedWeek) ? bond.fedWeek : 0,
    };
  }
  return fresh;
}

function backfillRivalries(value: unknown): RivalryState[] {
  if (!Array.isArray(value)) return [];
  const records = value.filter(
    (entry): entry is RivalryState =>
      typeof entry === "object" && entry !== null && typeof (entry as RivalryState).name === "string",
  );
  return records.slice(-RelationshipConfig.log.maxRivalries).map((entry) => ({
    ...entry,
    heat: clamp(Number(entry.heat) || 0, 0, RelationshipConfig.rivalry.max),
  }));
}

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
        // A cypher is never persisted, exactly like a battle.
        cypher: null,
        block: clamp(saved.block ?? 0, 0, CalendarConfig.clock.blocksPerDay - 1),
        nickname: backfillNickname(saved.nickname),
        look: backfillOption(saved.look, NewGameConfig.identityOptions.looks, NewGameConfig.identity.look),
        skin: backfillOption(saved.skin, NewGameConfig.identityOptions.skins, NewGameConfig.identity.skin),
        voice: backfillOption(saved.voice, NewGameConfig.identityOptions.voices, NewGameConfig.identity.voice),
        difficulty: backfillDifficulty(saved.difficulty),
        items: backfillItems(saved.items),
        // Fase 6: an older save has no week plan. It backfills empty (and the
        // opening snapshot is taken from the loaded resources) so the player
        // just starts planning from today instead of inheriting a fake week.
        plan: backfillPlan(saved.plan),
        weekRecord: backfillDayRecords(saved.weekRecord),
        weekLog: backfillWeekLog(saved.weekLog),
        // Offers are a per-week roll, so an older save simply starts with none
        // and gets its own at the next week rollover.
        opportunities: Array.isArray(saved.opportunities)
          ? saved.opportunities.filter(
              (entry): entry is ScheduledOpportunity =>
                typeof entry === "object" && entry !== null && typeof (entry as ScheduledOpportunity).id === "string",
            )
          : [],
        opportunitiesWeek: typeof saved.opportunitiesWeek === "number" ? saved.opportunitiesWeek : 0,
        // Fase 7: identity and the decision log ARE the career, so they are
        // persisted. A save from before it backfills neutral — nobody is born
        // commercial or underground.
        axes: backfillAxes(saved.axes),
        decisions: backfillDecisions(saved.decisions),
        // The people (Fase 7). Rivalries backfill empty: an old save has no
        // record of who it humiliated, and inventing grudges would be a lie.
        bonds: backfillBonds(saved.bonds),
        rivalries: backfillRivalries(saved.rivalries),
        // A dilemma waiting for an answer is not persisted: reloading mid-choice
        // should not trap the player on a screen with no context.
        pendingDilemma: null,
        seenDilemmas: Array.isArray(saved.seenDilemmas)
          ? saved.seenDilemmas.filter((id): id is string => typeof id === "string")
          : [],
        // A chapter waiting to be read survives a reload: it is a milestone, not
        // a transient screen.
        pendingEpilogue: typeof saved.pendingEpilogue === "string" ? (saved.pendingEpilogue as StageId) : null,
        stageStartedWeek:
          typeof saved.stageStartedWeek === "number" && saved.stageStartedWeek > 0 ? saved.stageStartedWeek : 1,
        epilogueFromWeek:
          typeof saved.epilogueFromWeek === "number" && saved.epilogueFromWeek > 0 ? saved.epilogueFromWeek : 1,
        weekOpening: saved.weekOpening ?? {
          cash: saved.cash ?? 0,
          fans: saved.fans ?? 0,
          respect: saved.respect ?? 0,
          fame: saved.fame ?? 0,
          xp: saved.xp ?? 0,
        },
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
        // A cypher is never persisted, exactly like a battle.
        cypher: null,
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
