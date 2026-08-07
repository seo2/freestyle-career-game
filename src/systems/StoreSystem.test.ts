import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GameState, TimeAdvance, UpgradeKey } from "../core/types";
import { createNewState } from "../core/state";
import { createStateRng } from "../services/RandomService";
import { upgrades } from "../data/upgrades";
import {
  buyRecommendedUpgrade,
  buyUpgradeByKey,
  nextUpgrade,
  setUpgradeLevel,
  upgradeCost,
  upgradeLevel,
} from "./StoreSystem";

// StoreSystem is tested in isolation: the sibling systems get sentinel mocks
// so we can pin the exact arguments StoreSystem passes, the mutation order,
// and the message assembly order — independent of sibling implementations.
const mocks = vi.hoisted(() => ({
  addXp: vi.fn<(state: unknown, amount: number) => string[]>(),
  applyRhythm: vi.fn<(state: unknown, actionId: string, baseDelta: number) => string[]>(),
  advanceClock:
    vi.fn<(state: GameState, blocks: number, label: string) => { messages: string[]; fx: TimeAdvance }>(),
}));

vi.mock("./ProgressionSystem", () => ({
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

describe("upgradeLevel / setUpgradeLevel", () => {
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

describe("nextUpgrade", () => {
  it("picks the cheapest among equal levels (fresh state -> outfit)", () => {
    const state = newState(0);
    expect(nextUpgrade(state)?.key).toBe("outfit");
  });

  it("prefers lower level over cheaper cost", () => {
    const state = newState(0);
    state.outfitLevel = 2;
    state.studioLevel = 3; // maxed, excluded
    state.homeLevel = 1;
    expect(nextUpgrade(state)?.key).toBe("home");
  });

  it("breaks level ties by current cost", () => {
    const state = newState(0);
    state.outfitLevel = 1; // cost 165
    state.studioLevel = 1; // cost 215
    state.homeLevel = 1; // cost 285
    expect(nextUpgrade(state)?.key).toBe("outfit");
  });

  it("returns null when everything is maxed", () => {
    const state = newState(0);
    state.outfitLevel = 3;
    state.studioLevel = 3;
    state.homeLevel = 3;
    expect(nextUpgrade(state)).toBeNull();
  });
});

describe("buyRecommendedUpgrade", () => {
  it("returns the maxed-out event when nothing is left to buy", () => {
    const state = newState(9999);
    state.outfitLevel = 3;
    state.studioLevel = 3;
    state.homeLevel = 3;
    const result = buyRecommendedUpgrade(state, createStateRng(state));
    expect(result).toEqual({
      type: "event",
      parts: ["Ya tienes el setup al maximo por ahora."],
      fx: null,
    });
    expect(mocks.advanceClock).not.toHaveBeenCalled();
  });

  it("returns silently (type none) when cash is insufficient, touching nothing", () => {
    const state = newState(54); // outfit at level 0 costs 55
    const seedBefore = state.seed;
    const result = buyRecommendedUpgrade(state, createStateRng(state));
    expect(result).toEqual({ type: "none" });
    expect(state.cash).toBe(54);
    expect(state.outfitLevel).toBe(0);
    expect(state.seed).toBe(seedBefore);
    expect(mocks.addXp).not.toHaveBeenCalled();
    expect(mocks.applyRhythm).not.toHaveBeenCalled();
    expect(mocks.advanceClock).not.toHaveBeenCalled();
  });

  it("buys the recommended upgrade: deducts, levels up, then xp/rhythm/clock in order", () => {
    const state = newState(100);
    const seedBefore = state.seed;
    let cashAtXpTime = -1;
    let outfitAtXpTime = -1;
    mocks.addXp.mockImplementation(() => {
      cashAtXpTime = state.cash;
      outfitAtXpTime = state.outfitLevel;
      return ["<xp>"];
    });

    const result = buyRecommendedUpgrade(state, createStateRng(state));

    expect(state.cash).toBe(45);
    expect(state.outfitLevel).toBe(1);
    // Cash and level were already mutated before addXp ran (legacy order).
    expect(cashAtXpTime).toBe(45);
    expect(outfitAtXpTime).toBe(1);
    expect(mocks.addXp).toHaveBeenCalledWith(state, 14);
    expect(mocks.applyRhythm).toHaveBeenCalledWith(state, "upgrade-outfit", 6);
    expect(mocks.advanceClock).toHaveBeenCalledWith(state, 1, "Ropa");
    // Legacy call order: addXp -> applyRhythm -> advanceClock.
    expect(mocks.addXp.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.applyRhythm.mock.invocationCallOrder[0],
    );
    expect(mocks.applyRhythm.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.advanceClock.mock.invocationCallOrder[0],
    );
    // Message order: main, rhythm, level, time.
    expect(result).toEqual({
      type: "event",
      parts: ["Invertiste $55 en Outfit Nv 1: +fans/batalla.", "<rhythm>", "<xp>", "<clock>"],
      fx: { label: "Ropa", fromBlock: 0, toBlock: 1, blocks: 1, daysPassed: 0 },
    });
    // Store paths never consume randomness.
    expect(state.seed).toBe(seedBefore);
  });

  it("scales cost, xp and rhythm with the current level", () => {
    const state = newState(1000);
    state.outfitLevel = 3;
    state.studioLevel = 3;
    state.homeLevel = 2; // next: home, cost 510
    const result = buyRecommendedUpgrade(state, createStateRng(state));
    expect(state.cash).toBe(490);
    expect(state.homeLevel).toBe(3);
    expect(mocks.addXp).toHaveBeenCalledWith(state, 22); // 14 + 2*4
    expect(mocks.applyRhythm).toHaveBeenCalledWith(state, "upgrade-home", 10); // 6 + 2*2
    expect(mocks.advanceClock).toHaveBeenCalledWith(state, 1, "Casa");
    expect(result.type).toBe("event");
    if (result.type === "event") {
      expect(result.parts[0]).toBe("Invertiste $510 en Base Nv 3: +energia/salud.");
    }
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
