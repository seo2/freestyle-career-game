import { describe, it, expect } from "vitest";
import { createNewState } from "../core/state";
import type { GameState } from "../core/types";
import type { BattleState } from "../core/types";
import { SAVE_KEY, LEGACY_SAVE_KEY_V1, createSaveManager, type StorageLike } from "./SaveManager";

function createMemoryStorage(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
}

// A v1 save is today's GameState with a 0-23 `hour` field instead of `block`.
// `stripIdentity` reproduces a real v1 blob, written before the Crear MC and
// tienda fields existed.
function makeV1Save(hour: number, options: { stripIdentity?: boolean } = {}): { raw: string; state: GameState } {
  const state = createNewState("MC Legacy", 99);
  state.mode = "career";
  state.cash = 44;
  const { block: _block, ...rest } = state;
  const blob: Record<string, unknown> = { ...rest, hour };
  if (options.stripIdentity) {
    for (const key of ["nickname", "look", "skin", "voice", "difficulty", "items"]) delete blob[key];
  }
  return { raw: JSON.stringify(blob), state };
}

function fakeBattle(): BattleState {
  return {
    eventName: "Compite en la plaza",
    rivalName: "Rival X",
    rivalStyle: "agresivo",
    rivalPower: 10,
    rivalEnergy: 90,
    rivalEnergyMax: 100,
    rivalHype: 40,
    rewardCash: 20,
    rewardFans: 5,
    rewardRespect: 3,
    rewardFame: 2,
    rewardXp: 15,
    round: 2,
    maxRounds: 3,
    hype: 40,
    playerScore: 1,
    rivalScore: 0,
    prompt: { text: "Tema", best: ["flow"] },
    results: [],
    pendingResult: null,
    finished: false,
    result: null,
  };
}

describe("SaveManager", () => {
  it("uses the v2 key and keeps the v1 key name for migration", () => {
    expect(SAVE_KEY).toBe("freestyle-career-save-v2");
    expect(LEGACY_SAVE_KEY_V1).toBe("freestyle-career-save-v1");
  });

  it("round-trips a state through save/load", () => {
    const storage = createMemoryStorage();
    const manager = createSaveManager(storage);
    const state = createNewState("MC Test", 1234);
    state.mode = "battle";
    state.battle = fakeBattle();
    state.animationTime = 99;
    state.cash = 77;
    state.week = 4;
    state.block = 2;

    const snapshot = manager.save(state);

    // Snapshot is returned for the caller to keep as savedSnapshot.
    expect(snapshot.mode).toBe("career");
    expect(snapshot.inputName).toBe("MC Test");
    expect(snapshot.battle).toBeNull();
    expect(snapshot.animationTime).toBe(0);
    expect(snapshot.cash).toBe(77);
    expect(snapshot.block).toBe(2);

    const loaded = manager.load();
    expect(loaded).not.toBeNull();
    expect(loaded).toEqual(snapshot);
    expect(storage.map.has(SAVE_KEY)).toBe(true);
    expect(storage.map.has(LEGACY_SAVE_KEY_V1)).toBe(false);
  });

  it("returns null when nothing is stored", () => {
    const manager = createSaveManager(createMemoryStorage());
    expect(manager.load()).toBeNull();
  });

  it("migrates a v1 save: hour maps to block and persists under the v2 key", () => {
    const cases: [number, number][] = [
      [10, 0],
      [14, 1],
      [23, 2],
    ];
    for (const [hour, block] of cases) {
      const storage = createMemoryStorage();
      const manager = createSaveManager(storage);
      const { raw, state } = makeV1Save(hour);
      storage.setItem(LEGACY_SAVE_KEY_V1, raw);

      const loaded = manager.load();
      expect(loaded).not.toBeNull();
      expect(loaded?.block).toBe(block);
      expect(loaded && "hour" in loaded).toBe(false);
      expect(loaded?.playerName).toBe("MC Legacy");
      expect(loaded?.cash).toBe(44);
      expect(loaded?.stage).toBe(state.stage);

      // Migration is persisted immediately; the v1 blob stays behind.
      expect(storage.map.has(SAVE_KEY)).toBe(true);
      expect(storage.map.get(LEGACY_SAVE_KEY_V1)).toBe(raw);
      expect(JSON.parse(storage.map.get(SAVE_KEY) as string)).toEqual(loaded);
    }
  });

  it("maps the v1 hour boundaries: 0/11 morning, 12/18 afternoon, 19 night", () => {
    const cases: [number, number][] = [
      [0, 0],
      [11, 0],
      [12, 1],
      [18, 1],
      [19, 2],
    ];
    for (const [hour, block] of cases) {
      const storage = createMemoryStorage();
      storage.setItem(LEGACY_SAVE_KEY_V1, makeV1Save(hour).raw);
      expect(createSaveManager(storage).load()?.block).toBe(block);
    }
  });

  it("prefers the v2 save when both keys exist", () => {
    const storage = createMemoryStorage();
    const manager = createSaveManager(storage);
    const v2 = createNewState("MC Nuevo", 7);
    v2.block = 1;
    manager.save(v2);
    storage.setItem(LEGACY_SAVE_KEY_V1, makeV1Save(23).raw);

    const loaded = manager.load();
    expect(loaded?.playerName).toBe("MC Nuevo");
    expect(loaded?.block).toBe(1);
  });

  it("returns null on corrupt JSON", () => {
    const storage = createMemoryStorage();
    storage.setItem(SAVE_KEY, "{not json!!");
    const manager = createSaveManager(storage);
    expect(manager.load()).toBeNull();
  });

  it("returns null on corrupt v1 JSON", () => {
    const storage = createMemoryStorage();
    storage.setItem(LEGACY_SAVE_KEY_V1, "{not json!!");
    const manager = createSaveManager(storage);
    expect(manager.load()).toBeNull();
  });

  it("returns null when storage access throws", () => {
    const manager = createSaveManager({
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {},
      removeItem: () => {},
    });
    expect(manager.load()).toBeNull();
  });

  it("normalize clamps ranges, resets transients, and rebuilds lastEvent", () => {
    const manager = createSaveManager(createMemoryStorage());
    const saved = createNewState("MC Viejo", 42);
    saved.mode = "career";
    saved.level = 7;
    saved.outfitLevel = 9;
    saved.studioLevel = -2;
    saved.homeLevel = 3;
    saved.battle = fakeBattle();
    saved.animationTime = 123;
    // Simulate an old save missing newer fields.
    delete (saved as Partial<GameState>).momentum;
    delete (saved as Partial<GameState>).lastActionId;
    delete (saved as Partial<GameState>).actionStreak;

    const normalized = manager.normalize(saved);

    expect(normalized.mode).toBe("start");
    expect(normalized.inputName).toBe("MC Viejo");
    expect(normalized.battle).toBeNull();
    expect(normalized.animationTime).toBe(0);
    expect(normalized.outfitLevel).toBe(3);
    expect(normalized.studioLevel).toBe(0);
    expect(normalized.homeLevel).toBe(3);
    expect(normalized.momentum).toBe(42);
    expect(normalized.lastActionId).toBeNull();
    expect(normalized.actionStreak).toBe(0);
    expect(normalized.lastEvent).toBe("Partida encontrada: MC Viejo, nivel 7.");
  });

  it("normalize backfills a missing block and clamps it into 0..2", () => {
    const manager = createSaveManager(createMemoryStorage());
    const saved = createNewState("MC Bloques", 42);
    delete (saved as Partial<GameState>).block;
    expect(manager.normalize(saved).block).toBe(0);
    saved.block = 9;
    expect(manager.normalize(saved).block).toBe(2);
    saved.block = -1;
    expect(manager.normalize(saved).block).toBe(0);
    saved.block = 1;
    expect(manager.normalize(saved).block).toBe(1);
  });

  it("normalize clamps momentum into 0-100", () => {
    const manager = createSaveManager(createMemoryStorage());
    const saved = createNewState("MC Momentum", 42);
    saved.momentum = 250;
    expect(manager.normalize(saved).momentum).toBe(100);
    saved.momentum = -5;
    expect(manager.normalize(saved).momentum).toBe(0);
  });

  it("normalize backfills a missing player name", () => {
    const manager = createSaveManager(createMemoryStorage());
    const saved = createNewState("", 42);
    saved.playerName = "";
    const normalized = manager.normalize(saved);
    expect(normalized.inputName).toBe("MC Barrio");
    // Verbatim legacy template: interpolates the raw (empty) saved name.
    expect(normalized.lastEvent).toBe("Partida encontrada: , nivel 1.");
  });

  // Project rule 3: the key stays at v2, so saves written before the Crear MC
  // and tienda systems existed must keep loading with the config defaults.
  it("normalize backfills the identity fields of a v2 save that predates them", () => {
    const manager = createSaveManager(createMemoryStorage());
    const saved = createNewState("MC Antiguo", 42);
    saved.mode = "career";
    saved.level = 3;
    delete (saved as Partial<GameState>).nickname;
    delete (saved as Partial<GameState>).look;
    delete (saved as Partial<GameState>).skin;
    delete (saved as Partial<GameState>).voice;
    delete (saved as Partial<GameState>).difficulty;
    delete (saved as Partial<GameState>).items;

    const normalized = manager.normalize(saved);

    expect(normalized.nickname).toBe("Freestyler");
    expect(normalized.look).toBe(1);
    expect(normalized.skin).toBe(1);
    expect(normalized.voice).toBe(1);
    expect(normalized.difficulty).toBe("normal");
    expect(normalized.items).toEqual([]);
    // The rest of the save survives untouched.
    expect(normalized.playerName).toBe("MC Antiguo");
    expect(normalized.level).toBe(3);
  });

  it("normalize clamps the cosmetic selectors and rejects unknown difficulties", () => {
    const manager = createSaveManager(createMemoryStorage());
    const saved = createNewState("MC Raro", 42);
    saved.look = 99;
    saved.skin = 0;
    saved.voice = -3;
    saved.difficulty = "imposible" as GameState["difficulty"];
    const normalized = manager.normalize(saved);
    expect(normalized.look).toBe(4); // 4 looks
    expect(normalized.skin).toBe(1); // 5 skins, 1-based
    expect(normalized.voice).toBe(1); // 3 voices
    expect(normalized.difficulty).toBe("normal");

    saved.look = 3;
    saved.skin = 5;
    saved.voice = 2;
    saved.difficulty = "dificil";
    const kept = manager.normalize(saved);
    expect([kept.look, kept.skin, kept.voice, kept.difficulty]).toEqual([3, 5, 2, "dificil"]);
  });

  it("normalize keeps owned items, dedupes them and drops non-strings", () => {
    const manager = createSaveManager(createMemoryStorage());
    const saved = createNewState("MC Compras", 42);
    saved.items = ["microfono", "microfono", "gorra", 7 as unknown as string];
    expect(manager.normalize(saved).items).toEqual(["microfono", "gorra"]);
    saved.items = "nope" as unknown as string[];
    expect(manager.normalize(saved).items).toEqual([]);
  });

  it("normalize trims a nickname and falls back to the default when empty", () => {
    const manager = createSaveManager(createMemoryStorage());
    const saved = createNewState("MC Apodo", 42);
    saved.nickname = "  El Duro  ";
    expect(manager.normalize(saved).nickname).toBe("El Duro");
    saved.nickname = "   ";
    expect(manager.normalize(saved).nickname).toBe("Freestyler");
    saved.nickname = "0123456789ABCDEFGHIJ"; // 20 chars, max is 16
    expect(manager.normalize(saved).nickname).toBe("0123456789ABCDEF");
  });

  it("keeps migrating a v1 save that has none of the new fields", () => {
    const storage = createMemoryStorage();
    const manager = createSaveManager(storage);
    const { raw } = makeV1Save(20, { stripIdentity: true });
    storage.setItem(LEGACY_SAVE_KEY_V1, raw);

    const loaded = manager.load();
    expect(loaded).not.toBeNull();
    expect(loaded?.block).toBe(2);
    expect(loaded && "hour" in loaded).toBe(false);
    expect(loaded && "nickname" in loaded).toBe(false);

    const normalized = manager.normalize(loaded as GameState);
    expect(normalized.nickname).toBe("Freestyler");
    expect(normalized.look).toBe(1);
    expect(normalized.skin).toBe(1);
    expect(normalized.voice).toBe(1);
    expect(normalized.difficulty).toBe("normal");
    expect(normalized.items).toEqual([]);
    expect(normalized.playerName).toBe("MC Legacy");
    expect(normalized.cash).toBe(44);
  });

  it("round-trips the identity fields and the owned items through save/load", () => {
    const storage = createMemoryStorage();
    const manager = createSaveManager(storage);
    const state = createNewState("MC Ida", 5);
    state.nickname = "El Duro";
    state.look = 3;
    state.skin = 4;
    state.voice = 2;
    state.difficulty = "dificil";
    state.items = ["microfono", "gorra"];

    manager.save(state);
    const loaded = manager.load();
    expect(loaded?.nickname).toBe("El Duro");
    expect(loaded?.look).toBe(3);
    expect(loaded?.skin).toBe(4);
    expect(loaded?.voice).toBe(2);
    expect(loaded?.difficulty).toBe("dificil");
    expect(loaded?.items).toEqual(["microfono", "gorra"]);
  });

  it("delete removes both the v2 and v1 saves", () => {
    const storage = createMemoryStorage();
    const manager = createSaveManager(storage);
    manager.save(createNewState("MC Test", 1));
    storage.setItem(LEGACY_SAVE_KEY_V1, makeV1Save(10).raw);
    manager.delete();
    expect(storage.map.has(SAVE_KEY)).toBe(false);
    expect(storage.map.has(LEGACY_SAVE_KEY_V1)).toBe(false);
    expect(manager.load()).toBeNull();
  });
});
