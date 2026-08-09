import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GameState, StatKey, TimeAdvance, UpgradeKey } from "../core/types";
import { createNewState } from "../core/state";
import { createStateRng } from "../services/RandomService";
import { itemCategories, storeItems, type ItemCategory } from "../data/items";
import { upgrades } from "../data/upgrades";
import {
  buyItem,
  buyRecommendedItem,
  buyUpgradeByKey,
  canAffordItem,
  findItem,
  isOwned,
  itemPrice,
  itemsByCategory,
  missingCash,
  recommendedItem,
  setUpgradeLevel,
  unownedItems,
  upgradeCost,
  upgradeLevel,
  upgradeMaxLevel,
} from "./StoreSystem";

// StoreSystem is tested in isolation: the sibling systems get sentinel mocks
// so we can pin the exact arguments StoreSystem passes, the mutation order,
// and the message assembly order — independent of sibling implementations.
const mocks = vi.hoisted(() => ({
  addStat: vi.fn<(state: unknown, stat: string, amount: number) => void>(),
  addXp: vi.fn<(state: unknown, amount: number) => string[]>(),
  applyRhythm: vi.fn<(state: unknown, actionId: string, baseDelta: number) => string[]>(),
  advanceClock:
    vi.fn<(state: GameState, blocks: number, label: string) => { messages: string[]; fx: TimeAdvance }>(),
}));

vi.mock("./ProgressionSystem", () => ({
  addStat: mocks.addStat,
  addXp: mocks.addXp,
  applyRhythm: mocks.applyRhythm,
}));

vi.mock("./CalendarSystem", () => ({
  advanceClock: mocks.advanceClock,
}));

function newState(cash: number): GameState {
  const state = createNewState("Tester", 1234);
  state.cash = cash;
  return state;
}

const outfitDef = upgrades[0];
const studioDef = upgrades[1];
const homeDef = upgrades[2];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.addXp.mockReturnValue(["<xp>"]);
  mocks.applyRhythm.mockReturnValue(["<rhythm>"]);
  mocks.advanceClock.mockImplementation((state, blocks, label) => {
    const fromBlock = state.block;
    state.block += blocks;
    return {
      messages: ["<clock>"],
      fx: { label, fromBlock, toBlock: state.block, blocks, daysPassed: 0 },
    };
  });
});

// --- Catalogue ----------------------------------------------------------------

describe("item catalogue", () => {
  it("keeps the four EQUIPO rows of the mockup, in order, with their prices", () => {
    expect(itemsByCategory("equipo").map((item) => [item.id, item.label, item.price])).toEqual([
      ["microfono", "Microfono", 150],
      ["audifonos", "Audifonos", 90],
      ["interfaz", "Interfaz", 200],
      ["monitores", "Monitores", 180],
    ]);
  });

  it("fills the other three tabs with three items each", () => {
    const counts: Record<ItemCategory, number> = { equipo: 4, ropa: 3, beats: 3, otros: 3 };
    for (const category of itemCategories) {
      expect(itemsByCategory(category)).toHaveLength(counts[category]);
      expect(itemsByCategory(category).every((item) => item.category === category)).toBe(true);
    }
    expect(itemCategories).toEqual(["equipo", "ropa", "beats", "otros"]);
    expect(storeItems).toHaveLength(13);
  });

  it("uses unique ids, positive prices and a human effect label everywhere", () => {
    expect(new Set(storeItems.map((item) => item.id)).size).toBe(storeItems.length);
    for (const item of storeItems) {
      expect(item.price).toBeGreaterThan(0);
      expect(item.description.length).toBeGreaterThan(0);
      expect(item.effectLabel).toMatch(/^\+\d+ a /);
      // Stat grants stay small: stats live on a 1..99 scale.
      if (item.grants.stat) expect(item.grants.stat.amount).toBeLessThanOrEqual(3);
    }
  });

  it("pins the microfono row of the mockup (price, effect, grants)", () => {
    const mic = findItem("microfono");
    expect(mic).not.toBeNull();
    expect(mic?.price).toBe(150);
    expect(mic?.description).toBe("Mejora la calidad de tus grabaciones.");
    expect(mic?.effectLabel).toBe("+2 a Punchline");
    expect(mic?.grants).toEqual({ studio: 1, stat: { key: "punchline", amount: 2 } });
  });

  it("findItem returns null for an unknown id", () => {
    expect(findItem("no-existe")).toBeNull();
  });
});

// --- Ownership / affordability helpers ---------------------------------------

describe("ownership and price helpers", () => {
  it("reads ownership off state.items", () => {
    const state = newState(0);
    expect(isOwned(state, "microfono")).toBe(false);
    state.items.push("microfono");
    expect(isOwned(state, "microfono")).toBe(true);
    expect(isOwned(state, "audifonos")).toBe(false);
  });

  it("reports price, affordability and the missing amount", () => {
    const mic = findItem("microfono");
    if (!mic) throw new Error("microfono missing");
    expect(itemPrice(mic)).toBe(150);
    const poor = newState(125); // the mockup's wallet
    expect(canAffordItem(poor, mic)).toBe(false);
    expect(missingCash(poor, mic)).toBe(25);
    const rich = newState(150);
    expect(canAffordItem(rich, mic)).toBe(true);
    expect(missingCash(rich, mic)).toBe(0);
  });

  it("lists unowned items cheapest first and drops the owned ones", () => {
    const state = newState(0);
    expect(unownedItems(state).map((item) => item.price)).toEqual([
      60, 70, 80, 90, 110, 120, 130, 140, 150, 150, 160, 180, 200,
    ]);
    expect(unownedItems(state)[0].id).toBe("cuaderno");
    state.items.push("cuaderno", "gorra");
    expect(unownedItems(state).map((item) => item.id)).not.toContain("cuaderno");
    expect(unownedItems(state)[0].id).toBe("beat-boombap");
  });
});

describe("recommendedItem", () => {
  it("is null when nothing in the catalogue is affordable", () => {
    expect(recommendedItem(newState(59))).toBeNull(); // cheapest item costs 60
  });

  it("is the cheapest affordable unowned item", () => {
    expect(recommendedItem(newState(60))?.id).toBe("cuaderno");
    expect(recommendedItem(newState(95))?.id).toBe("cuaderno");
    const owned = newState(95);
    owned.items.push("cuaderno", "gorra");
    expect(recommendedItem(owned)?.id).toBe("beat-boombap"); // 80
  });

  it("is null once everything is owned", () => {
    const state = newState(9999);
    state.items = storeItems.map((item) => item.id);
    expect(recommendedItem(state)).toBeNull();
  });
});

// --- buyItem ------------------------------------------------------------------

describe("buyItem", () => {
  it("returns none for an unknown id, touching nothing", () => {
    const state = newState(9999);
    const result = buyItem(state, createStateRng(state), "no-existe");
    expect(result).toEqual({ type: "none" });
    expect(state.cash).toBe(9999);
    expect(state.items).toEqual([]);
    expect(mocks.advanceClock).not.toHaveBeenCalled();
  });

  it("refuses a duplicate purchase with the Ya tienes message", () => {
    const state = newState(9999);
    state.items.push("microfono");
    const result = buyItem(state, createStateRng(state), "microfono");
    expect(result).toEqual({ type: "event", parts: ["Ya tienes Microfono."], fx: null });
    expect(state.cash).toBe(9999);
    expect(state.items).toEqual(["microfono"]);
    expect(mocks.addXp).not.toHaveBeenCalled();
    expect(mocks.advanceClock).not.toHaveBeenCalled();
  });

  it("reports the exact gap when cash is short", () => {
    const state = newState(125);
    const result = buyItem(state, createStateRng(state), "microfono");
    expect(result).toEqual({ type: "event", parts: ["Faltan $25 para Microfono."], fx: null });
    expect(state.cash).toBe(125);
    expect(state.items).toEqual([]);
    expect(state.studioLevel).toBe(0);
    expect(mocks.addStat).not.toHaveBeenCalled();
    expect(mocks.addXp).not.toHaveBeenCalled();
    expect(mocks.applyRhythm).not.toHaveBeenCalled();
    expect(mocks.advanceClock).not.toHaveBeenCalled();
  });

  it("buys an item: cash, inventory and grants land before xp/rhythm/clock", () => {
    const state = newState(200);
    const seedBefore = state.seed;
    let cashAtXpTime = -1;
    let itemsAtXpTime: string[] = [];
    let studioAtXpTime = -1;
    mocks.addXp.mockImplementation(() => {
      cashAtXpTime = state.cash;
      itemsAtXpTime = [...state.items];
      studioAtXpTime = state.studioLevel;
      return ["<xp>"];
    });

    const result = buyItem(state, createStateRng(state), "microfono");

    expect(state.cash).toBe(50);
    expect(state.items).toEqual(["microfono"]);
    expect(state.studioLevel).toBe(1);
    expect(cashAtXpTime).toBe(50);
    expect(itemsAtXpTime).toEqual(["microfono"]);
    expect(studioAtXpTime).toBe(1);
    // Stat grant goes through ProgressionSystem.addStat (bounds live there).
    expect(mocks.addStat).toHaveBeenCalledWith(state, "punchline", 2);
    // xp = 14 + floor(150 * 6 / 100) = 23; rhythm is a flat shared action id.
    expect(mocks.addXp).toHaveBeenCalledWith(state, 23);
    expect(mocks.applyRhythm).toHaveBeenCalledWith(state, "buy-item", 6);
    expect(mocks.advanceClock).toHaveBeenCalledWith(state, 1, "Microfono");
    // Call order: addStat -> addXp -> applyRhythm -> advanceClock.
    expect(mocks.addStat.mock.invocationCallOrder[0]).toBeLessThan(mocks.addXp.mock.invocationCallOrder[0]);
    expect(mocks.addXp.mock.invocationCallOrder[0]).toBeLessThan(mocks.applyRhythm.mock.invocationCallOrder[0]);
    expect(mocks.applyRhythm.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.advanceClock.mock.invocationCallOrder[0],
    );
    // Message order: main, rhythm, level, time.
    expect(result).toEqual({
      type: "event",
      parts: ["Compraste Microfono por $150: +2 a Punchline.", "<rhythm>", "<xp>", "<clock>"],
      fx: { label: "Microfono", fromBlock: 0, toBlock: 1, blocks: 1, daysPassed: 0 },
    });
    // Store paths never consume randomness.
    expect(state.seed).toBe(seedBefore);
  });

  it("scales xp with the price and pays the exact price", () => {
    const cases: [string, number, number, string][] = [
      ["audifonos", 90, 19, "Audifonos"],
      ["cuaderno", 60, 17, "Cuaderno de rimas"],
      ["interfaz", 200, 26, "Interfaz"],
    ];
    for (const [id, price, xp, label] of cases) {
      vi.clearAllMocks();
      mocks.addXp.mockReturnValue(["<xp>"]);
      mocks.applyRhythm.mockReturnValue(["<rhythm>"]);
      const state = newState(500);
      const result = buyItem(state, createStateRng(state), id);
      expect(state.cash).toBe(500 - price);
      expect(mocks.addXp).toHaveBeenCalledWith(state, xp);
      expect(mocks.advanceClock).toHaveBeenCalledWith(state, 1, label);
      expect(result.type).toBe("event");
    }
  });

  it("applies outfit/home grants and clamps every level to its max", () => {
    const state = newState(9999);
    buyItem(state, createStateRng(state), "gorra");
    expect(state.outfitLevel).toBe(1);
    buyItem(state, createStateRng(state), "mesa");
    expect(state.homeLevel).toBe(1);
    // Already maxed: the grant cannot push the level past upgrades' maxLevel.
    state.studioLevel = upgradeMaxLevel("studio");
    buyItem(state, createStateRng(state), "microfono");
    expect(state.studioLevel).toBe(3);
    // Items without a level grant leave the backbone alone.
    const before = [state.outfitLevel, state.studioLevel, state.homeLevel];
    buyItem(state, createStateRng(state), "beat-trap");
    expect([state.outfitLevel, state.studioLevel, state.homeLevel]).toEqual(before);
    expect(mocks.addStat).toHaveBeenLastCalledWith(state, "improvisacion" satisfies StatKey, 2);
  });
});

describe("buyRecommendedItem", () => {
  it("buys the cheapest affordable unowned item", () => {
    const state = newState(100);
    const result = buyRecommendedItem(state, createStateRng(state));
    expect(state.items).toEqual(["cuaderno"]);
    expect(state.cash).toBe(40);
    expect(result.type).toBe("event");
    if (result.type === "event") {
      expect(result.parts[0]).toBe("Compraste Cuaderno de rimas por $60: +2 a Punchline.");
    }
  });

  it("reports the gap to the cheapest item when nothing is affordable", () => {
    const state = newState(25); // fresh-career wallet
    const result = buyRecommendedItem(state, createStateRng(state));
    expect(result).toEqual({
      type: "event",
      parts: ["Faltan $35 para Cuaderno de rimas."],
      fx: null,
    });
    expect(state.items).toEqual([]);
    expect(mocks.advanceClock).not.toHaveBeenCalled();
  });

  it("says the catalogue is exhausted when everything is owned", () => {
    const state = newState(9999);
    state.items = storeItems.map((item) => item.id);
    const result = buyRecommendedItem(state, createStateRng(state));
    expect(result).toEqual({
      type: "event",
      parts: ["Ya tienes todo lo de la tienda por ahora."],
      fx: null,
    });
    expect(state.cash).toBe(9999);
    expect(mocks.advanceClock).not.toHaveBeenCalled();
  });

  it("consumes no randomness on any recommended path", () => {
    const rich = newState(9999);
    const seedBefore = rich.seed;
    buyRecommendedItem(rich, createStateRng(rich));
    expect(rich.seed).toBe(seedBefore);
    const poor = newState(0);
    buyRecommendedItem(poor, createStateRng(poor));
    expect(poor.seed).toBe(seedBefore);
  });
});

// --- Internal upgrade backbone ------------------------------------------------

describe("upgradeLevel / setUpgradeLevel / upgradeMaxLevel", () => {
  it("maps each key to its state field", () => {
    const state = newState(0);
    state.outfitLevel = 1;
    state.studioLevel = 2;
    state.homeLevel = 3;
    expect(upgradeLevel(state, "outfit")).toBe(1);
    expect(upgradeLevel(state, "studio")).toBe(2);
    expect(upgradeLevel(state, "home")).toBe(3);
  });

  it("writes each key to its state field", () => {
    const state = newState(0);
    setUpgradeLevel(state, "outfit", 2);
    setUpgradeLevel(state, "studio", 1);
    setUpgradeLevel(state, "home", 3);
    expect(state.outfitLevel).toBe(2);
    expect(state.studioLevel).toBe(1);
    expect(state.homeLevel).toBe(3);
  });

  it("reads each max level from the upgrade data (0 for unknown keys)", () => {
    expect(upgradeMaxLevel("outfit")).toBe(3);
    expect(upgradeMaxLevel("studio")).toBe(3);
    expect(upgradeMaxLevel("home")).toBe(3);
    expect(upgradeMaxLevel("hat" as UpgradeKey)).toBe(0);
  });
});

describe("upgradeCost", () => {
  it("matches the legacy formula baseCost + costStep*level + level*level*25", () => {
    // outfit: base 55, step 85
    expect(upgradeCost(outfitDef, 0)).toBe(55);
    expect(upgradeCost(outfitDef, 1)).toBe(165);
    expect(upgradeCost(outfitDef, 2)).toBe(325);
    expect(upgradeCost(outfitDef, 3)).toBe(535);
    // studio: base 75, step 115
    expect(upgradeCost(studioDef, 0)).toBe(75);
    expect(upgradeCost(studioDef, 1)).toBe(215);
    expect(upgradeCost(studioDef, 2)).toBe(405);
    // home: base 110, step 150
    expect(upgradeCost(homeDef, 0)).toBe(110);
    expect(upgradeCost(homeDef, 1)).toBe(285);
    expect(upgradeCost(homeDef, 2)).toBe(510);
  });
});


describe("buyUpgradeByKey", () => {
  it("returns none for an unknown key", () => {
    const state = newState(9999);
    const result = buyUpgradeByKey(state, createStateRng(state), "hat" as UpgradeKey);
    expect(result).toEqual({ type: "none" });
    expect(state.cash).toBe(9999);
  });

  it("returns the maxed event for a maxed upgrade", () => {
    const state = newState(9999);
    state.outfitLevel = 3;
    const result = buyUpgradeByKey(state, createStateRng(state), "outfit");
    expect(result).toEqual({
      type: "event",
      parts: ["Outfit ya esta al maximo por ahora."],
      fx: null,
    });
    expect(state.cash).toBe(9999);
    expect(mocks.advanceClock).not.toHaveBeenCalled();
  });

  it("reports the missing amount when cash is insufficient", () => {
    const state = newState(25); // studio costs 75 -> missing 50
    const result = buyUpgradeByKey(state, createStateRng(state), "studio");
    expect(result).toEqual({
      type: "event",
      parts: ["Faltan $50 para mejorar Estudio."],
      fx: null,
    });
    expect(state.cash).toBe(25);
    expect(state.studioLevel).toBe(0);
    expect(mocks.addXp).not.toHaveBeenCalled();
    expect(mocks.applyRhythm).not.toHaveBeenCalled();
    expect(mocks.advanceClock).not.toHaveBeenCalled();
  });

  it("buys a specific upgrade with the Compraste message", () => {
    const state = newState(200);
    const seedBefore = state.seed;
    const result = buyUpgradeByKey(state, createStateRng(state), "home");
    expect(state.cash).toBe(90);
    expect(state.homeLevel).toBe(1);
    expect(mocks.addXp).toHaveBeenCalledWith(state, 14);
    expect(mocks.applyRhythm).toHaveBeenCalledWith(state, "upgrade-home", 6);
    expect(mocks.advanceClock).toHaveBeenCalledWith(state, 1, "Casa");
    expect(result).toEqual({
      type: "event",
      parts: ["Compraste Base Nv 1: +energia/salud.", "<rhythm>", "<xp>", "<clock>"],
      fx: { label: "Casa", fromBlock: 0, toBlock: 1, blocks: 1, daysPassed: 0 },
    });
    expect(state.seed).toBe(seedBefore);
  });

  it("scales the by-key purchase with the current level", () => {
    const state = newState(500);
    state.studioLevel = 1; // cost 215
    const result = buyUpgradeByKey(state, createStateRng(state), "studio");
    expect(state.cash).toBe(285);
    expect(state.studioLevel).toBe(2);
    expect(mocks.addXp).toHaveBeenCalledWith(state, 18); // 14 + 1*4
    expect(mocks.applyRhythm).toHaveBeenCalledWith(state, "upgrade-studio", 8); // 6 + 1*2
    expect(result.type).toBe("event");
    if (result.type === "event") {
      expect(result.parts[0]).toBe("Compraste Estudio Nv 2: +temas/grabar.");
    }
  });
});
