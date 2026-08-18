// Ownership, equipping and purchasing (spec §37/§38/§70).
//
// Pure functions over plain data, and the split the spec insists on:
//
//   * The avatar system decides whether an item CAN be equipped.
//   * The career system decides whether an unlock condition is SATISFIED.
//
// So nothing here knows what a career level is. It takes a `progress` callback and
// asks. That is what lets fame, battle wins and story beats all gate items without
// the wardrobe growing a dependency on any of them.

import type { AssetId, AvatarConfig, ItemMeta, Unlock } from "./types";

// The career/economy/story systems answer this. `unlock` is handed over whole so a
// new unlock type needs no change here.
export type ProgressCheck = (unlock: Unlock) => boolean;

export interface Wallet {
  cash: number;
}

export type ItemStatus =
  | { kind: "equipped" }
  | { kind: "ready" } //   owned or free: equip it
  | { kind: "buy"; price: number } //  in the shop and affordable
  | { kind: "short"; price: number; missing: number }
  | { kind: "locked"; unlock: Unlock }; //  a career reward, not for sale

export interface WardrobeState {
  owned: readonly AssetId[];
  wallet: Wallet;
}

const isEquipped = (config: AvatarConfig, item: ItemMeta): boolean => {
  const slot = item.category as keyof AvatarConfig["equipment"];
  return (
    config.equipment[slot] === item.id ||
    Object.values(config.appearance).includes(item.id)
  );
};

export function statusOf(
  item: ItemMeta,
  config: AvatarConfig,
  state: WardrobeState,
  satisfied: ProgressCheck,
): ItemStatus {
  if (isEquipped(config, item)) return { kind: "equipped" };

  // A level-gated item is a REWARD: while the condition is unmet it is not for sale
  // at any price, which is the rule the design states out loud on the shop screen.
  if (item.unlock && !satisfied(item.unlock)) return { kind: "locked", unlock: item.unlock };

  if (state.owned.includes(item.id)) return { kind: "ready" };
  if (item.price === undefined) return { kind: "ready" };
  if (state.wallet.cash >= item.price) return { kind: "buy", price: item.price };
  return { kind: "short", price: item.price, missing: item.price - state.wallet.cash };
}

export interface EquipResult {
  config: AvatarConfig;
  state: WardrobeState;
  // What to tell the player. Null when nothing happened.
  message: string | null;
  changed: boolean;
}

// Equipping and buying are one action from the player's side — you click the
// sneakers and they go on — but two facts in the data, and the refusal cases have
// to leave both untouched rather than half-applied.
export function equip(
  item: ItemMeta,
  config: AvatarConfig,
  state: WardrobeState,
  satisfied: ProgressCheck,
): EquipResult {
  const status = statusOf(item, config, state, satisfied);
  const unchanged = { config, state, changed: false };

  if (status.kind === "equipped") return { ...unchanged, message: "Ya lo andas trayendo." };
  if (status.kind === "locked") {
    const need = status.unlock.value;
    return { ...unchanged, message: need ? `Se gana en nivel ${need}. No esta en venta.` : "Se gana jugando." };
  }
  if (status.kind === "short") {
    return { ...unchanged, message: `Te faltan $${status.missing.toLocaleString("es-CL")}` };
  }

  const bought = status.kind === "buy";
  const nextState: WardrobeState = bought
    ? { owned: [...state.owned, item.id], wallet: { cash: state.wallet.cash - status.price } }
    : state;

  return {
    config: withItem(config, item),
    state: nextState,
    changed: true,
    message: bought ? `${item.name} comprado por $${status.price.toLocaleString("es-CL")}` : null,
  };
}

// Places an item in the right half of the config. Appearance and equipment are
// separate objects (§39) and the item's own category says which one it belongs to.
export function withItem(config: AvatarConfig, item: ItemMeta): AvatarConfig {
  const appearanceSlots = ["body", "face", "eyes", "eyebrows", "nose", "mouth", "hair", "facial_hair"];
  if (appearanceSlots.includes(item.category)) {
    return { ...config, appearance: { ...config.appearance, [item.category]: item.id } };
  }
  return { ...config, equipment: { ...config.equipment, [item.category]: item.id } };
}

// Clears a slot. Only equipment can be emptied: an avatar with no eyes is not a
// look, it is a bug.
export function clearSlot(config: AvatarConfig, slot: keyof AvatarConfig["equipment"]): AvatarConfig {
  return { ...config, equipment: { ...config.equipment, [slot]: null } };
}
