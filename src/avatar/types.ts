// Avatar system — data model (Fase 11).
//
// Implements docs/AVATAR-SYSTEM.md, the handoff spec. Two rules from that document
// govern everything in this folder:
//
//   Golden Rule (§79): the creator UI is a CLIENT of the avatar system, never the
//   system itself. No `if (hair === 'hair_023')` anywhere — behaviour comes from
//   item metadata.
//
//   §78: the renderer must be testable independently from the UI, deterministic
//   (same config always yields the same avatar) and versioned.
//
// So this file is types only, and everything downstream is pure functions over
// them. Nothing here imports Phaser or touches the DOM.

// --- identity ---------------------------------------------------------------
// Asset ids are unique, immutable, lowercase and machine-readable, and they are
// INDEPENDENT of the display name (§30): a name can be retitled for the player
// without invalidating a save that references the id.
export type AssetId = string;

// One primary category per item (§32). The order here is meaningless — layer order
// is its own thing, in layers.ts, precisely so that adding a category cannot
// change what draws on top of what.
export type Category =
  | "body"
  | "skin"
  | "face"
  | "eyes"
  | "eyebrows"
  | "nose"
  | "mouth"
  | "hair"
  | "facial_hair"
  | "tattoo"
  | "piercing"
  | "top"
  | "jacket"
  | "bottom"
  | "socks"
  | "shoes"
  | "hat"
  | "glasses"
  | "jewelry"
  | "accessory"
  | "prop"
  | "effect";

// §33. A collection and economy device, explicitly NOT a power level: nothing in
// the game may read rarity to compute an outcome.
export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary" | "iconic";

// §34/§70. The avatar system stores the condition and never evaluates it — the
// career, economy and story systems answer whether it is satisfied. That split is
// what keeps progression out of the wardrobe.
export type UnlockType =
  | "purchase"
  | "battle_reward"
  | "battle_wins"
  | "mission_reward"
  | "event_reward"
  | "achievement"
  | "career_level"
  | "fame_level"
  | "story"
  | "album"
  | "tour"
  | "special_event";

export interface Unlock {
  type: UnlockType;
  // Threshold for the numeric conditions (career_level 8, battle_wins 10). Absent
  // for the ones that are simply granted by an event.
  value?: number;
}

// §20/§36. May influence gameplay later; the avatar system itself never reads it.
export interface StyleAttributes {
  street?: number;
  luxury?: number;
  classic?: number;
  alternative?: number;
  sport?: number;
  formal?: number;
  originality?: number;
  stage_presence?: number;
}

// §45/§46. Data, never code. The spec is explicit that a compatibility rule must
// not be a branch in the renderer.
export interface ItemRules {
  // Cannot be worn together with these ids.
  incompatible?: AssetId[];
  // Needs these equipped first.
  requires?: AssetId[];
  // Takes over another slot while equipped (a helmet replaces a hat).
  replaces?: Category[];
}

// Which recolourable regions an asset exposes (§43/§44). One asset with tokens
// beats four colour duplicates; a colour that changes the ARTWORK is its own asset.
export type ColorToken =
  | "skin_primary"
  | "skin_shadow"
  | "hair_primary"
  | "hair_secondary"
  | "fabric_primary"
  | "fabric_secondary"
  | "metal_primary"
  | "accent_primary"
  | "ink";

export interface ItemMeta {
  id: AssetId;
  name: string;
  category: Category;
  rarity: Rarity;
  // Absent = not for sale. Present without an `unlock` = buyable from the start.
  price?: number;
  // §35: currencies are referenced by id and never hard-coded into the assets.
  currency?: CurrencyId;
  // Which tokens the player may recolour on this asset.
  colors?: ColorToken[];
  unlock?: Unlock;
  style?: StyleAttributes;
  rules?: ItemRules;
  // §50/§51: an item that carries a story. Rendered with its own treatment and
  // never silently replaced.
  iconic?: string;
}

export type CurrencyId = "cash" | "respect" | "fame" | "style_points";

// --- the avatar itself ------------------------------------------------------
// §39/§68. This object is sufficient to reproduce the avatar, and it is versioned
// because §69 requires that the game keep loading older configurations.
export const AVATAR_SCHEMA_VERSION = 1;

// What the player IS. Free, because §3 puts physical likeness ahead of the economy:
// looking like yourself is never something the game charges for.
export interface Appearance {
  body: AssetId;
  skin: AssetId;
  face: AssetId;
  eyes: AssetId;
  eyebrows: AssetId;
  nose: AssetId;
  mouth: AssetId;
  hair: AssetId | null;
  facial_hair: AssetId | null;
}

// What the player WEARS. Every slot is nullable: §21 says not every slot is
// mandatory, and an avatar in a tank top with no jacket is a complete avatar.
export interface Equipment {
  top: AssetId | null;
  jacket: AssetId | null;
  bottom: AssetId | null;
  socks: AssetId | null;
  shoes: AssetId | null;
  hat: AssetId | null;
  glasses: AssetId | null;
  jewelry: AssetId | null;
  accessory: AssetId | null;
  prop: AssetId | null;
  tattoo: AssetId | null;
  piercing: AssetId | null;
}

// Chosen colour per token. Indices into the palettes in palettes.ts, not hexes:
// storing an index means a palette can be retuned without rewriting saves.
export type ColorChoices = Partial<Record<ColorToken, number>>;

export interface AvatarConfig {
  version: number;
  appearance: Appearance;
  equipment: Equipment;
  colors: ColorChoices;
}

// §37/§38. Inventory and equipment stay separate — owning a jacket and wearing it
// are different facts, and conflating them makes a closet impossible.
export interface AvatarInventory {
  owned: AssetId[];
}

// §47/§48. An outfit references ids and is independent of the inventory. If an id
// becomes unavailable the outfit is FLAGGED, never silently repaired.
export interface Outfit {
  id: string;
  name: string;
  items: Partial<Equipment>;
}
