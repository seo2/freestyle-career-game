// The asset registry (spec §80: AVATAR DATA → ASSET REGISTRY → {assets, rules,
// metadata} → RESOLVER → LAYER MANAGER → RENDERER).
//
// Everything the game knows about avatar content enters through here. The creator
// UI, the shop, the inventory and the NPC generator all read this one index, which
// is what §79 means by "the avatar creator is a client of the avatar system".

import { bodyAssets, browAssets, eyeAssets, faceAssets, mouthAssets, noseAssets } from "./assets/body";
import { facialHairAssets, hairAssets } from "./assets/hair";
import { bottomAssets, jacketAssets, shoeAssets, topAssets } from "./assets/clothing";
import {
  glassesAssets,
  hatAssets,
  jewelryAssets,
  piercingAssets,
  propAssets,
  tattooAssets,
} from "./assets/accessories";
import { skinTonesMeta } from "./assets/skin";
import type { Asset } from "./asset";
import type { AssetId, Category, ItemMeta } from "./types";

const ALL: readonly Asset[] = [
  ...bodyAssets,
  ...faceAssets,
  ...eyeAssets,
  ...browAssets,
  ...noseAssets,
  ...mouthAssets,
  ...hairAssets,
  ...facialHairAssets,
  ...topAssets,
  ...jacketAssets,
  ...bottomAssets,
  ...shoeAssets,
  ...hatAssets,
  ...glassesAssets,
  ...jewelryAssets,
  ...tattooAssets,
  ...piercingAssets,
  ...propAssets,
];

const byId = new Map<AssetId, Asset>();
for (const asset of ALL) {
  // A duplicate id would make the registry non-deterministic depending on import
  // order, and §30 says ids are unique. Fail loudly at module load, not silently
  // three screens later.
  if (byId.has(asset.meta.id)) throw new Error(`asset duplicado: ${asset.meta.id}`);
  byId.set(asset.meta.id, asset);
}

// Skin tones draw nothing, so they are metadata-only entries in the index. The
// creator still needs to list them like any other category.
const metaOnly = new Map<AssetId, ItemMeta>(skinTonesMeta.map((tone) => [tone.id, tone]));

export const assetRegistry = {
  get: (id: AssetId): Asset | undefined => byId.get(id),
  meta: (id: AssetId): ItemMeta | undefined => byId.get(id)?.meta ?? metaOnly.get(id),
  all: (): readonly Asset[] => ALL,
  byCategory: (category: Category): readonly Asset[] => ALL.filter((a) => a.meta.category === category),
  // Every listable item of a category, drawable or not. This is what the creator's
  // option grid iterates.
  itemsOf: (category: Category): readonly ItemMeta[] =>
    category === "skin" ? skinTonesMeta : ALL.filter((a) => a.meta.category === category).map((a) => a.meta),
  categories: (): readonly Category[] => [...new Set(ALL.map((a) => a.meta.category))],
};

export type AssetRegistry = typeof assetRegistry;

// A first-week MC: the cheapest of everything, nothing on his neck, no ink. §49's
// Era 1 — "inexpensive clothing, basic sneakers, few accessories, simple hairstyle".
// He is meant to look like someone who has not made it yet, because the whole point
// of the system is that his wardrobe becomes the record of his career.
export function starterConfig(): import("./types").AvatarConfig {
  return {
    version: 1,
    appearance: {
      body: "body_03",
      skin: "skin_03",
      face: "face_01",
      eyes: "eyes_01",
      eyebrows: "brows_01",
      nose: "nose_01",
      mouth: "mouth_01",
      hair: "hair_002",
      facial_hair: null,
    },
    equipment: {
      top: "top_001",
      jacket: null,
      bottom: "bottom_001",
      socks: null,
      shoes: "shoes_002",
      hat: null,
      glasses: null,
      jewelry: null,
      accessory: null,
      prop: null,
      tattoo: null,
      piercing: null,
    },
    colors: {
      skin_primary: 2,
      hair_primary: 0,
      fabric_primary: 1,
      fabric_secondary: 0,
      metal_primary: 0,
      accent_primary: 2,
    },
  };
}
