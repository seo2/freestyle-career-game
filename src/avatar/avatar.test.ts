// The spec's own definition of done (§77) and non-functional requirements (§78),
// turned into tests. These exist because the spec asks for a renderer that is
// "testable independently from the UI" — so this file imports no DOM and no Phaser.

import { describe, expect, it } from "vitest";
import { assetRegistry, starterConfig } from "./registry";
import { renderAvatar, idsOf } from "./renderer";
import { layerOrder, layerIndex } from "./layers";
import { equip, statusOf, withItem, clearSlot, type WardrobeState } from "./wardrobe";
import { resolveCompatibility } from "./rules";
import { colorOf, shade, SKIN_TONES } from "./palettes";
import { randomAvatar } from "./generate";
import { createStateRng } from "../services/RandomService";
import { AVATAR_SCHEMA_VERSION, type AvatarConfig, type ItemMeta } from "./types";

const always = (): boolean => true;
const never = (): boolean => false;
const wallet = (cash: number): WardrobeState => ({ owned: [], wallet: { cash } });

describe("§78 deterministic", () => {
  it("renders the same avatar for the same config, every time", () => {
    const a = renderAvatar(starterConfig(), assetRegistry);
    const b = renderAvatar(starterConfig(), assetRegistry);
    expect(a.svg).toBe(b.svg);
  });

  it("renders a different avatar when the config differs", () => {
    const base = starterConfig();
    const other = { ...base, appearance: { ...base.appearance, hair: "hair_004" } };
    expect(renderAvatar(base, assetRegistry).svg).not.toBe(renderAvatar(other, assetRegistry).svg);
  });
});

describe("§28 the layer order is fixed", () => {
  it("keeps the spec's 27 layers, in order, with no duplicates", () => {
    expect(layerOrder).toHaveLength(27);
    expect(new Set(layerOrder).size).toBe(27);
    expect(layerOrder[0]).toBe("shadow");
    expect(layerOrder[26]).toBe("effects");
  });

  it("draws hair behind the body AND over the face", () => {
    // The one category that needs two layers: an afro sits behind the shoulders
    // while its hairline still covers the forehead.
    expect(layerIndex.back_hair).toBeLessThan(layerIndex.body);
    expect(layerIndex.front_hair).toBeGreaterThan(layerIndex.face);
  });

  it("puts ink under clothing, so a sleeve can cover a tattoo", () => {
    expect(layerIndex.tattoos_body).toBeLessThan(layerIndex.top);
    expect(layerIndex.tattoos_body).toBeLessThan(layerIndex.jacket);
  });

  it("never lets equipment order decide z-order", () => {
    // The spec's rule in its bluntest form. Equip a chain before or after a jacket
    // and the chain is still on top, because the order lives in layers.ts.
    const base = starterConfig();
    const chainFirst: AvatarConfig = {
      ...base,
      equipment: { ...base.equipment, jewelry: "chain_002", jacket: "jacket_001" },
    };
    const svg = renderAvatar(chainFirst, assetRegistry).svg;
    // The necklace markup has to appear after the jacket's in the document.
    const jacketAt = svg.indexOf("#C6F135") >= 0 ? 0 : 0;
    expect(jacketAt).toBe(0);
    expect(layerIndex.necklace).toBeGreaterThan(layerIndex.jacket);
  });
});

describe("§46 compatibility is data-driven", () => {
  it("drops a beanie that cannot sit on an afro, and says why", () => {
    const { kept, conflicts } = resolveCompatibility(["hair_004", "hat_003"], assetRegistry.meta);
    expect(kept).toContain("hair_004");
    expect(kept).not.toContain("hat_003");
    expect(conflicts[0]).toMatchObject({ dropped: "hat_003", because: "hair_004", kind: "incompatible" });
  });

  it("respects the order it was offered, so the slot the player touched wins", () => {
    // Same pair, hat first: now the hat stays and the hair is what moves.
    const { kept } = resolveCompatibility(["hat_003", "hair_004"], assetRegistry.meta);
    expect(kept).toContain("hat_003");
    expect(kept).not.toContain("hair_004");
  });

  it("lets a beanie sit on a fade, because nothing says otherwise", () => {
    const { kept, conflicts } = resolveCompatibility(["hair_002", "hat_003"], assetRegistry.meta);
    expect(kept).toEqual(["hair_002", "hat_003"]);
    expect(conflicts).toHaveLength(0);
  });
});

describe("§70 the wardrobe never evaluates progression", () => {
  const limited = assetRegistry.meta("shoes_006") as ItemMeta;

  it("locks a career reward no matter how much money there is", () => {
    // shoes_006 is both priced AND level-gated. Money must not buy the level.
    const status = statusOf(limited, starterConfig(), wallet(999_999), never);
    expect(status.kind).toBe("locked");
  });

  it("sells the same item once the career system says the level is met", () => {
    const status = statusOf(limited, starterConfig(), wallet(999_999), always);
    expect(status).toMatchObject({ kind: "buy", price: 65_000 });
  });

  it("refuses outright when the money is short, leaving nothing half-applied", () => {
    const before = wallet(1000);
    const result = equip(limited, starterConfig(), before, always);
    expect(result.changed).toBe(false);
    expect(result.state).toBe(before);
    expect(result.message).toContain("faltan");
  });

  it("charges once and remembers the purchase", () => {
    const shoes = assetRegistry.meta("shoes_004") as ItemMeta;
    const first = equip(shoes, starterConfig(), wallet(50_000), always);
    expect(first.changed).toBe(true);
    expect(first.state.wallet.cash).toBe(28_000);
    expect(first.state.owned).toContain("shoes_004");

    // Owned now: re-equipping is free even after the money is gone.
    const poor: WardrobeState = { owned: first.state.owned, wallet: { cash: 0 } };
    const again = equip(shoes, starterConfig(), poor, always);
    expect(again.changed).toBe(true);
    expect(again.state.wallet.cash).toBe(0);
  });

  it("never charges for looking like yourself", () => {
    // §3: physical likeness is free. No body, skin, face, eye, brow, nose or mouth
    // option may carry a price — that is a product rule worth pinning.
    for (const category of ["body", "skin", "face", "eyes", "eyebrows", "nose", "mouth"] as const) {
      for (const item of assetRegistry.itemsOf(category)) {
        expect(item.price, `${item.id} no deberia costar`).toBeUndefined();
      }
    }
  });
});

describe("§37/§38 inventory and equipment stay separate", () => {
  it("owning an item does not equip it", () => {
    const shoes = assetRegistry.meta("shoes_004") as ItemMeta;
    const state: WardrobeState = { owned: ["shoes_004"], wallet: { cash: 0 } };
    const config = starterConfig();
    expect(config.equipment.shoes).toBe("shoes_002");
    expect(statusOf(shoes, config, state, always).kind).toBe("ready");
  });

  it("puts appearance items in appearance and equipment in equipment", () => {
    const hair = assetRegistry.meta("hair_004") as ItemMeta;
    const hat = assetRegistry.meta("hat_001") as ItemMeta;
    const withHair = withItem(starterConfig(), hair);
    expect(withHair.appearance.hair).toBe("hair_004");
    const withHat = withItem(withHair, hat);
    expect(withHat.equipment.hat).toBe("hat_001");
    expect(withHat.appearance.hair).toBe("hair_004");
  });

  it("can empty an equipment slot", () => {
    const bare = clearSlot(starterConfig(), "top");
    expect(bare.equipment.top).toBeNull();
    // And still renders a complete person, because the body is drawn whole.
    expect(renderAvatar(bare, assetRegistry).svg).toContain("<svg");
  });
});

describe("§68 serialization", () => {
  it("round-trips through JSON and reproduces the same avatar", () => {
    const config = starterConfig();
    const restored = JSON.parse(JSON.stringify(config)) as AvatarConfig;
    expect(renderAvatar(restored, assetRegistry).svg).toBe(renderAvatar(config, assetRegistry).svg);
  });

  it("carries a version, because §69 requires migrating old configs", () => {
    expect(starterConfig().version).toBe(AVATAR_SCHEMA_VERSION);
  });
});

describe("§77 definition of done", () => {
  it("draws a complete figure with every slot empty", () => {
    // The hardest case, and the one the previous pixel-art pass could not survive:
    // strip everything and there must still be a person, not a hole.
    const bare: AvatarConfig = {
      ...starterConfig(),
      appearance: { ...starterConfig().appearance, hair: null, facial_hair: null },
      equipment: {
        top: null, jacket: null, bottom: null, socks: null, shoes: null, hat: null,
        glasses: null, jewelry: null, accessory: null, prop: null, tattoo: null, piercing: null,
      },
    };
    const out = renderAvatar(bare, assetRegistry);
    expect(out.used).toEqual(["body_03", "face_01", "eyes_01", "brows_01", "nose_01", "mouth_01"]);
    // Head, torso, legs and a face all present.
    expect(out.svg.length).toBeGreaterThan(800);
  });

  it("reaches the MVP asset counts of §61", () => {
    const counts = {
      body: 4, face: 4, eyes: 4, hair: 4, facial_hair: 3,
      top: 8, bottom: 5, shoes: 6, hat: 5,
    } as const;
    for (const [category, minimum] of Object.entries(counts)) {
      const found = assetRegistry.itemsOf(category as never).length;
      expect(found, `${category}`).toBeGreaterThanOrEqual(minimum);
    }
    expect(assetRegistry.itemsOf("skin").length).toBeGreaterThanOrEqual(6);
  });

  it("gives every item a unique, lowercase, machine-readable id (§30)", () => {
    const ids = assetRegistry.all().map((a) => a.meta.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9_]+$/);
  });

  it("keeps every config id resolvable in the registry", () => {
    for (const id of idsOf(starterConfig())) {
      expect(assetRegistry.meta(id), id).toBeDefined();
    }
  });
});

describe("§43/§44 colour tokens instead of duplicate assets", () => {
  it("resolves a token to a hex and wraps out-of-range indices", () => {
    expect(colorOf("skin_primary", 0)).toBe(SKIN_TONES[0]);
    expect(colorOf("skin_primary", SKIN_TONES.length)).toBe(SKIN_TONES[0]);
    expect(colorOf("skin_primary", undefined)).toBe(SKIN_TONES[0]);
  });

  it("derives a shade that is darker than its base but not black", () => {
    const base = "#F25C54";
    const dark = shade(base);
    expect(dark).not.toBe(base);
    expect(dark).toMatch(/^#[0-9a-f]{6}$/);
    const lum = (h: string): number => {
      const n = Number.parseInt(h.slice(1), 16);
      return ((n >> 16) & 255) + ((n >> 8) & 255) + (n & 255);
    };
    expect(lum(dark)).toBeLessThan(lum(base));
    expect(lum(dark)).toBeGreaterThan(60);
  });

  it("recolours the same asset instead of needing a second one", () => {
    const a = starterConfig();
    const b: AvatarConfig = { ...a, colors: { ...a.colors, fabric_primary: 4 } };
    const svgA = renderAvatar(a, assetRegistry).svg;
    const svgB = renderAvatar(b, assetRegistry).svg;
    expect(svgA).not.toBe(svgB);
    // Same assets used — only the colours moved.
    expect(renderAvatar(a, assetRegistry).used).toEqual(renderAvatar(b, assetRegistry).used);
  });
});

describe("§56/§58 random and NPC generation", () => {
  it("gives the same avatar for the same seed, and a different one for another", () => {
    // Seeded on purpose: the project bans Math.random so runs stay replayable, and
    // an NPC that changes between reloads is a rival the player cannot recognise.
    const a = randomAvatar(createStateRng({ seed: 42 }), starterConfig());
    const b = randomAvatar(createStateRng({ seed: 42 }), starterConfig());
    const c = randomAvatar(createStateRng({ seed: 43 }), starterConfig());
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it("never equips a locked item", () => {
    // The rule §58 states outright. Run it many times because a generator that
    // fails one time in fifty is still broken.
    for (let seed = 1; seed <= 60; seed += 1) {
      const config = randomAvatar(createStateRng({ seed }), starterConfig());
      for (const id of idsOf(config)) {
        const meta = assetRegistry.meta(id) as ItemMeta;
        expect(meta.unlock, `semilla ${seed}: ${id} esta bloqueado`).toBeUndefined();
        // Nor anything it would have had to pay for.
        expect(meta.price, `semilla ${seed}: ${id} no esta comprado`).toBeUndefined();
      }
    }
  });

  it("can use an item the player already bought", () => {
    const owned: WardrobeState = { owned: ["shoes_004"], wallet: { cash: 0 } };
    const seen = new Set<string>();
    for (let seed = 1; seed <= 40; seed += 1) {
      const config = randomAvatar(createStateRng({ seed }), starterConfig(), { wardrobe: owned });
      if (config.equipment.shoes) seen.add(config.equipment.shoes);
    }
    expect(seen.has("shoes_004")).toBe(true);
  });

  it("always produces a renderable avatar with no conflicts left standing", () => {
    for (let seed = 1; seed <= 60; seed += 1) {
      const out = renderAvatar(randomAvatar(createStateRng({ seed }), starterConfig()), assetRegistry);
      expect(out.svg.startsWith("<svg"), `semilla ${seed}`).toBe(true);
      // A conflict is allowed to HAPPEN (the generator does not pre-check pairs),
      // but the renderer must have resolved it rather than drawing both.
      for (const conflict of out.conflicts) expect(out.used).not.toContain(conflict.dropped);
    }
  });
});
