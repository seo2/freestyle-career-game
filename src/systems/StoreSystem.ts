// Store/upgrade system: upgrade levels, pricing, recommendation and purchase
// flows. Ported verbatim from the legacy monolith — same formulas, same
// mutation order, same message strings. Mutates the passed GameState in place;
// event finalization (stage unlock + lastEvent + save) belongs to the caller.

import type { ActionResult, GameState, UpgradeDef, UpgradeKey } from "../core/types";
import type { RandomSource } from "../services/RandomService";
import { StoreConfig } from "../data/config/StoreConfig";
import { upgrades } from "../data/upgrades";
import { advanceClock } from "./CalendarSystem";
import { addXp, applyRhythm } from "./ProgressionSystem";

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

// Purchase the recommended upgrade. Legacy consumed no randomness on any store
// path; `_rng` stays in the signature for the uniform system-action shape but
// must never be called (RNG stream parity).
export function buyRecommendedUpgrade(state: GameState, _rng: RandomSource): ActionResult {
  const upgrade = nextUpgrade(state);
  if (!upgrade) {
    return { type: "event", parts: ["Ya tienes el setup al maximo por ahora."], fx: null };
  }
  const level = upgradeLevel(state, upgrade.key);
  const cost = upgradeCost(upgrade, level);
  if (state.cash < cost) return { type: "none" };

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
      `Invertiste $${cost} en ${upgrade.label} Nv ${level + 1}: ${upgrade.effect}.`,
      ...rhythmMessages,
      ...levelMessages,
      ...clock.messages,
    ],
    fx: clock.fx,
  };
}

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
