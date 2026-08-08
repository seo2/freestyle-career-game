// Store system.
//
// Objetivo: vender los items del catalogo (mockup "9. TIENDA") y mantener el
// backbone interno de niveles (outfit/studio/home) del que dependen maxEnergy,
// recordCost, la presencia en batalla y las formulas de acciones.
//
// Entradas: GameState + RandomSource + id de item/upgrade.
// Salidas: ActionResult (el orquestador finaliza evento, desbloqueo y guardado).
// Eventos: ninguno directo — GameController emite STATE_CHANGED.
// Dependencias: data/items, data/upgrades, config/StoreConfig, CalendarSystem,
// ProgressionSystem.
//
// Ejemplo:
//   const result = buyItem(state, rng, "microfono");
//
// Ninguna ruta de tienda consume aleatoriedad: `_rng` existe por uniformidad de
// firma entre sistemas (paridad del stream de RNG) y nunca debe llamarse.

import type { ActionResult, GameState, UpgradeDef, UpgradeKey } from "../core/types";
import type { RandomSource } from "../services/RandomService";
import { StoreConfig } from "../data/config/StoreConfig";
import { storeItems, type ItemCategory, type ItemDef, type ItemGrants } from "../data/items";
import { upgrades } from "../data/upgrades";
import { clamp } from "../utils/math";
import { advanceClock } from "./CalendarSystem";
import { addStat, addXp, applyRhythm } from "./ProgressionSystem";

// --- Internal upgrade backbone ------------------------------------------------

export function upgradeLevel(state: GameState, key: UpgradeKey): number {
  if (key === "outfit") return state.outfitLevel;
  if (key === "studio") return state.studioLevel;
  return state.homeLevel;
}

export function setUpgradeLevel(state: GameState, key: UpgradeKey, value: number): void {
  if (key === "outfit") state.outfitLevel = value;
  else if (key === "studio") state.studioLevel = value;
  else state.homeLevel = value;
}

export function upgradeMaxLevel(key: UpgradeKey): number {
  return upgrades.find((upgrade) => upgrade.key === key)?.maxLevel ?? 0;
}

export function upgradeCost(def: UpgradeDef, level: number): number {
  return def.baseCost + def.costStep * level + level * level * StoreConfig.costCurve.quadraticCoefficientPerLevel;
}

export function nextUpgrade(state: GameState): UpgradeDef | null {
  const available = upgrades.filter((upgrade) => upgradeLevel(state, upgrade.key) < upgrade.maxLevel);
  if (available.length === 0) return null;
  return [...available].sort((a, b) => {
    const levelDelta = upgradeLevel(state, a.key) - upgradeLevel(state, b.key);
    if (levelDelta !== 0) return levelDelta;
    return upgradeCost(a, upgradeLevel(state, a.key)) - upgradeCost(b, upgradeLevel(state, b.key));
  })[0];
}

// --- Item catalogue reads -----------------------------------------------------

export function itemsByCategory(category: ItemCategory): ItemDef[] {
  return storeItems.filter((item) => item.category === category);
}

export function findItem(itemId: string): ItemDef | null {
  return storeItems.find((item) => item.id === itemId) ?? null;
}

export function isOwned(state: GameState, itemId: string): boolean {
  return state.items.includes(itemId);
}

export function itemPrice(item: ItemDef): number {
  return item.price;
}

export function canAffordItem(state: GameState, item: ItemDef): boolean {
  return state.cash >= item.price;
}

// How much cash is still missing for `item` (0 when affordable).
export function missingCash(state: GameState, item: ItemDef): number {
  return Math.max(0, item.price - state.cash);
}

// Every item the player can still buy, cheapest first.
export function unownedItems(state: GameState): ItemDef[] {
  return storeItems.filter((item) => !isOwned(state, item.id)).sort((a, b) => a.price - b.price);
}

// The recommended purchase (U hotkey): cheapest unowned item you can pay for.
export function recommendedItem(state: GameState): ItemDef | null {
  return unownedItems(state).find((item) => canAffordItem(state, item)) ?? null;
}

// --- Purchases ----------------------------------------------------------------

function applyGrants(state: GameState, grants: ItemGrants): void {
  if (grants.outfit) {
    setUpgradeLevel(state, "outfit", clamp(state.outfitLevel + grants.outfit, 0, upgradeMaxLevel("outfit")));
  }
  if (grants.studio) {
    setUpgradeLevel(state, "studio", clamp(state.studioLevel + grants.studio, 0, upgradeMaxLevel("studio")));
  }
  if (grants.home) {
    setUpgradeLevel(state, "home", clamp(state.homeLevel + grants.home, 0, upgradeMaxLevel("home")));
  }
  if (grants.stat) addStat(state, grants.stat.key, grants.stat.amount);
}

function itemXp(item: ItemDef): number {
  const purchase = StoreConfig.purchase;
  return purchase.xpBase + Math.floor((item.price * purchase.xpPerHundredPrice) / 100);
}

// Buys a catalogue item. Mutation order (mirrors the legacy purchase path):
// cash -> inventory -> grants -> xp -> rhythm -> clock.
export function buyItem(state: GameState, _rng: RandomSource, itemId: string): ActionResult {
  const item = findItem(itemId);
  if (!item) return { type: "none" };
  if (isOwned(state, item.id)) {
    return { type: "event", parts: [`Ya tienes ${item.label}.`], fx: null };
  }
  const missing = missingCash(state, item);
  if (missing > 0) {
    return { type: "event", parts: [`Faltan $${missing} para ${item.label}.`], fx: null };
  }

  state.cash -= item.price;
  state.items.push(item.id);
  applyGrants(state, item.grants);
  const levelMessages = addXp(state, itemXp(item));
  const rhythmMessages = applyRhythm(state, StoreConfig.itemRhythmActionId, StoreConfig.purchase.rhythmBase);
  const clock = advanceClock(state, StoreConfig.purchase.clockBlocks, item.label);
  return {
    type: "event",
    parts: [
      `Compraste ${item.label} por $${item.price}: ${item.effectLabel}.`,
      ...rhythmMessages,
      ...levelMessages,
      ...clock.messages,
    ],
    fx: clock.fx,
  };
}

// U hotkey / "comprar recomendado": buys the cheapest affordable unowned item.
// When nothing is affordable it reports the gap to the cheapest one, and when
// the catalogue is exhausted it says so.
export function buyRecommendedItem(state: GameState, rng: RandomSource): ActionResult {
  const target = recommendedItem(state) ?? unownedItems(state)[0];
  if (!target) {
    return { type: "event", parts: ["Ya tienes todo lo de la tienda por ahora."], fx: null };
  }
  return buyItem(state, rng, target.id);
}

// --- Legacy upgrade purchases -------------------------------------------------
// Kept as the internal way to raise a level directly (no UI path in Fase 4).

export function buyUpgradeByKey(state: GameState, _rng: RandomSource, key: UpgradeKey): ActionResult {
  const upgrade = upgrades.find((item) => item.key === key);
  if (!upgrade) return { type: "none" };
  const level = upgradeLevel(state, upgrade.key);
  if (level >= upgrade.maxLevel) {
    return { type: "event", parts: [`${upgrade.label} ya esta al maximo por ahora.`], fx: null };
  }
  const cost = upgradeCost(upgrade, level);
  if (state.cash < cost) {
    return { type: "event", parts: [`Faltan $${cost - state.cash} para mejorar ${upgrade.label}.`], fx: null };
  }

  state.cash -= cost;
  setUpgradeLevel(state, upgrade.key, level + 1);
  const levelMessages = addXp(state, StoreConfig.purchase.xpBase + level * StoreConfig.purchase.xpPerLevel);
  const rhythmMessages = applyRhythm(
    state,
    `upgrade-${upgrade.key}`,
    StoreConfig.purchase.rhythmBase + level * StoreConfig.purchase.rhythmPerLevel,
  );
  const clock = advanceClock(state, StoreConfig.purchase.clockBlocks, upgrade.shortLabel);
  return {
    type: "event",
    parts: [
      `Compraste ${upgrade.label} Nv ${level + 1}: ${upgrade.effect}.`,
      ...rhythmMessages,
      ...levelMessages,
      ...clock.messages,
    ],
    fx: clock.fx,
  };
}
