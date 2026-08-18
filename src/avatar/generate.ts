// Random and preset avatars (spec §56/§58/§59).
//
// Lives in the SYSTEM and not in the creator, for two reasons. The creator's
// "Aleatorio" button and the NPC generator want the same thing — a valid random
// combination — and duplicating that in two places is how they drift apart. And the
// project forbids Math.random outright (every run has to stay replayable), so the
// RNG is injected: the same seed yields the same MC, and the same rival.
//
// §58 is the rule that matters: "Randomization must generate valid combinations. It
// should not equip locked items."

import { assetRegistry } from "./registry";
import { paletteFor } from "./palettes";
import { statusOf, withItem, type WardrobeState } from "./wardrobe";
import { skinTonesMeta } from "./assets/skin";
import type { RandomSource } from "../services/RandomService";
import type { AvatarConfig, Category, ColorToken, ItemMeta, Unlock } from "./types";

// Categories a random avatar fills, and whether it may be left empty. Leaving hats
// and jewelry optional is what stops every random MC from looking like a christmas
// tree — an empty slot is a legitimate look.
const FILL: { category: Category; optional?: boolean }[] = [
  { category: "body" },
  { category: "face" },
  { category: "eyes" },
  { category: "eyebrows" },
  { category: "nose" },
  { category: "mouth" },
  { category: "hair", optional: true },
  { category: "facial_hair", optional: true },
  { category: "top" },
  { category: "bottom" },
  { category: "shoes" },
  { category: "jacket", optional: true },
  { category: "hat", optional: true },
  { category: "glasses", optional: true },
  { category: "jewelry", optional: true },
  { category: "tattoo", optional: true },
  { category: "piercing", optional: true },
  { category: "prop", optional: true },
];

const RECOLOURABLE: ColorToken[] = ["hair_primary", "fabric_primary", "fabric_secondary", "metal_primary", "accent_primary"];

const pick = <T>(rng: RandomSource, list: readonly T[]): T => list[rng.int(0, list.length - 1)];

export interface GenerateOptions {
  // What the player already owns, so a random look can use a bought jacket.
  wardrobe?: WardrobeState;
  // The career system's gate. Defaults to refusing everything gated, which is the
  // safe answer for an NPC: it dresses from the free pool.
  satisfied?: (unlock: Unlock) => boolean;
  // Chance an optional slot is left empty, 0..1.
  emptyChance?: number;
}

export function randomAvatar(rng: RandomSource, base: AvatarConfig, options: GenerateOptions = {}): AvatarConfig {
  const wardrobe = options.wardrobe ?? { owned: [], wallet: { cash: 0 } };
  const satisfied = options.satisfied ?? ((): boolean => false);
  const emptyChance = options.emptyChance ?? 0.45;

  let config = base;
  for (const slot of FILL) {
    // Only what is genuinely wearable right now: free, or already owned. A random
    // avatar that equips a locked item would be showing the player something they
    // cannot keep.
    const wearable = assetRegistry.itemsOf(slot.category).filter((item: ItemMeta) => {
      const status = statusOf(item, config, wardrobe, satisfied);
      return status.kind === "ready" || status.kind === "equipped";
    });
    if (wearable.length === 0) continue;
    if (slot.optional && rng.next() < emptyChance) {
      config = emptied(config, slot.category);
      continue;
    }
    config = withItem(config, pick(rng, wearable));
  }

  // Skin is part of appearance, not a colour choice (spec §39).
  config = { ...config, appearance: { ...config.appearance, skin: pick(rng, skinTonesMeta).id } };

  const colors = { ...config.colors };
  for (const token of RECOLOURABLE) colors[token] = rng.int(0, paletteFor[token].length - 1);
  return { ...config, colors };
}

function emptied(config: AvatarConfig, category: Category): AvatarConfig {
  if (category === "hair" || category === "facial_hair") {
    return { ...config, appearance: { ...config.appearance, [category]: null } };
  }
  return { ...config, equipment: { ...config.equipment, [category]: null } };
}
