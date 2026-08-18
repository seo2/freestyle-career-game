// Hats, glasses, jewelry, tattoos, piercings and props (spec §19/§20/§26/§27).
//
// This is where the compatibility engine earns its keep: a bucket hat and dreads do
// not fit together, and the spec (§45/§46) insists that fact live in metadata —
// `rules.incompatible` — and never as a branch in the renderer.

import type { Asset, DrawContext } from "../asset";
import { ellipse, line, path, rect, limb } from "./kit";
import type { Category, ItemMeta, Rarity } from "../types";

interface Spec {
  id: string;
  name: string;
  rarity?: Rarity;
  price?: number;
  level?: number;
  colors?: ItemMeta["colors"];
  rules?: ItemMeta["rules"];
  style?: ItemMeta["style"];
}

const meta = (category: Category, s: Spec): ItemMeta => ({
  id: s.id,
  name: s.name,
  category,
  rarity: s.rarity ?? (s.level ? "epic" : s.price ? "uncommon" : "common"),
  ...(s.price ? { price: s.price, currency: "cash" as const } : {}),
  ...(s.level ? { unlock: { type: "career_level" as const, value: s.level } } : {}),
  ...(s.colors ? { colors: s.colors } : {}),
  ...(s.rules ? { rules: s.rules } : {}),
  ...(s.style ? { style: s.style } : {}),
});

// A crown that sits on the skull, shared by every hat so all of them fit all six
// face shapes without being redrawn.
const hatCrown = (ctx: DrawContext, grow: number, height: number, fill: string): string => {
  const w = ctx.body.headW + grow;
  const x = ctx.cx - w / 2;
  const top = ctx.y.crown - (height - 30);
  return path(
    `M${x} ${top + height}C${x} ${top + 12} ${x + w * 0.24} ${top} ${ctx.cx} ${top}` +
      `C${x + w * 0.76} ${top} ${x + w} ${top + 12} ${x + w} ${top + height}Z`,
    fill,
  );
};

// The two hairstyles with real volume: anything that clamps to the skull cannot be
// worn over them. Stated once, referenced by the hats that conflict.
const BULKY_HAIR = ["hair_004", "hair_005"];

export const hatAssets: Asset[] = [
  {
    meta: meta("hat", { id: "hat_001", name: "Gorra plana", colors: ["fabric_primary"], style: { street: 8 } }),
    draw: (ctx) => ({
      hat:
        hatCrown(ctx, 18, 62, ctx.colors.fabric) +
        // Visera recta y ancha. Se queda oscura aparte del color de la gorra: una
        // visera que sigue la tela pierde el negro que la define.
        rect(ctx.cx - ctx.body.headW / 2 - 34, ctx.y.hairline - 12, ctx.body.headW + 68, 22, 8, ctx.colors.ink),
    }),
  },
  {
    meta: meta("hat", { id: "hat_002", name: "Gorra curva", colors: ["fabric_primary"], style: { street: 7, sport: 5 } }),
    draw: (ctx) => ({
      hat:
        hatCrown(ctx, 14, 60, ctx.colors.fabric) +
        path(
          `M${ctx.cx - ctx.body.headW / 2 - 6} ${ctx.y.hairline - 10}` +
            `C${ctx.cx - ctx.body.headW / 2 - 40} ${ctx.y.hairline + 2} ${ctx.cx - 20} ${ctx.y.hairline + 18} ${ctx.cx + ctx.body.headW / 2 + 4} ${ctx.y.hairline - 2}` +
            `L${ctx.cx + ctx.body.headW / 2 + 4} ${ctx.y.hairline - 16}Z`,
          ctx.colors.ink,
        ),
    }),
  },
  {
    meta: meta("hat", {
      id: "hat_003",
      name: "Beanie",
      colors: ["fabric_primary"],
      // Se ajusta al craneo: no entra sobre un afro ni sobre dreads.
      rules: { incompatible: BULKY_HAIR },
      style: { street: 6, alternative: 5 },
    }),
    draw: (ctx) => ({
      hat:
        hatCrown(ctx, 12, 72, ctx.colors.fabric) +
        rect(ctx.cx - ctx.body.headW / 2 - 8, ctx.y.hairline - 16, ctx.body.headW + 16, 30, 14, ctx.colors.fabricShade),
    }),
  },
  {
    meta: meta("hat", {
      id: "hat_004",
      name: "Bucket",
      price: 11000,
      colors: ["fabric_primary"],
      rules: { incompatible: BULKY_HAIR },
      style: { street: 7, originality: 7 },
    }),
    draw: (ctx) => ({
      hat:
        hatCrown(ctx, 8, 58, ctx.colors.fabric) +
        path(
          `M${ctx.cx - ctx.body.headW / 2 - 40} ${ctx.y.hairline - 8}h${ctx.body.headW + 80}` +
            `l-18 34h${-(ctx.body.headW + 44)}Z`,
          ctx.colors.fabric,
        ),
    }),
  },
  {
    meta: meta("hat", { id: "hat_005", name: "Fedora", level: 13, rarity: "legendary", colors: ["fabric_primary"], style: { formal: 8, luxury: 7 } }),
    draw: (ctx) => ({
      hat:
        hatCrown(ctx, 4, 66, ctx.colors.fabric) +
        rect(ctx.cx - ctx.body.headW / 2 - 52, ctx.y.hairline - 10, ctx.body.headW + 104, 18, 9, ctx.colors.fabric) +
        rect(ctx.cx - ctx.body.headW / 2 - 4, ctx.y.hairline - 26, ctx.body.headW + 8, 18, 4, ctx.colors.fabricShade, false),
    }),
  },
];

// --- glasses ----------------------------------------------------------------
const lensPair = (ctx: DrawContext, fill: string, outline: boolean): string => {
  const w = ctx.body.headW * 0.4;
  const h = 46;
  const yTop = ctx.y.eyes - h / 2;
  return (
    rect(ctx.cx - ctx.body.headW * 0.46, yTop, w, h, 12, fill, outline) +
    rect(ctx.cx + ctx.body.headW * 0.06, yTop, w, h, 12, fill, outline) +
    rect(ctx.cx - 12, ctx.y.eyes - 6, 24, 10, 5, ctx.colors.ink, false) +
    rect(ctx.cx - ctx.body.headW / 2 - 16, ctx.y.eyes - 14, 20, 9, 4, ctx.colors.ink, false) +
    rect(ctx.cx + ctx.body.headW / 2 - 4, ctx.y.eyes - 14, 20, 9, 4, ctx.colors.ink, false)
  );
};

export const glassesAssets: Asset[] = [
  {
    meta: meta("glasses", { id: "glasses_001", name: "Lentes de sol", style: { street: 6 } }),
    draw: (ctx) => ({ glasses: lensPair(ctx, "#252036", true) }),
  },
  {
    meta: meta("glasses", { id: "glasses_002", name: "Lentes shutter", price: 6000, style: { originality: 8, alternative: 6 } }),
    draw: (ctx) => {
      const base = lensPair(ctx, "#1B1726", true);
      const slats = [0, 1, 2, 3]
        .map((i) => line(`M${ctx.cx - ctx.body.headW * 0.46} ${ctx.y.eyes - 16 + i * 10}h${ctx.body.headW * 0.92}`, ctx.colors.fabric, 5))
        .join("");
      return { glasses: base + slats };
    },
  },
  {
    meta: meta("glasses", { id: "glasses_003", name: "Lentes de marca", price: 34000, rarity: "rare", style: { luxury: 9 } }),
    draw: (ctx) => ({ glasses: lensPair(ctx, ctx.colors.metal, true) }),
  },
];

// --- jewelry ----------------------------------------------------------------
const chain = (ctx: DrawContext, drop: number, width: number, color: string): string =>
  line(
    `M${ctx.cx - 46} ${ctx.y.chin + 16}C${ctx.cx - 42} ${ctx.y.chin + 16 + drop} ${ctx.cx + 42} ${ctx.y.chin + 16 + drop} ${ctx.cx + 46} ${ctx.y.chin + 16}`,
    color,
    width,
  );

export const jewelryAssets: Asset[] = [
  {
    meta: meta("jewelry", { id: "chain_001", name: "Cadena fina", price: 14000, colors: ["metal_primary"], style: { street: 5, luxury: 3 } }),
    draw: (ctx) => ({ necklace: chain(ctx, 52, 9, ctx.colors.metal) }),
  },
  {
    meta: meta("jewelry", { id: "chain_002", name: "Cadena gruesa", price: 42000, rarity: "rare", colors: ["metal_primary"], style: { street: 8, luxury: 7 } }),
    draw: (ctx) => ({
      necklace: chain(ctx, 74, 18, ctx.colors.metal) + ellipse(ctx.cx, ctx.y.chin + 96, 20, 22, ctx.colors.metal),
    }),
  },
  {
    meta: meta("jewelry", { id: "chain_003", name: "Cubana helada", price: 120000, level: 14, rarity: "legendary", colors: ["metal_primary"], style: { luxury: 10, stage_presence: 9 } }),
    draw: (ctx) => ({
      necklace:
        chain(ctx, 82, 24, ctx.colors.metal) +
        [-2, -1, 0, 1, 2]
          .map((i) => ellipse(ctx.cx + i * 22, ctx.y.chin + 92 - Math.abs(i) * 9, 9, 9, "#EAF7FF", false))
          .join(""),
    }),
  },
  {
    meta: meta("jewelry", { id: "watch_001", name: "Reloj de oro", price: 88000, rarity: "epic", colors: ["metal_primary"], style: { luxury: 9 } }),
    draw: (ctx) => {
      const armW = Math.round(ctx.body.legW * 0.72);
      const x = ctx.cx - ctx.body.shoulderW / 2 - armW + 6;
      return {
        front_accessories:
          rect(x - 4, ctx.y.waist + 22, armW + 8, 22, 8, ctx.colors.metal) +
          rect(x + armW / 2 - 12, ctx.y.waist + 16, 26, 34, 8, ctx.colors.metal),
      };
    },
  },
];

// --- tattoos ----------------------------------------------------------------
// Ink over skin but under clothing (layer 08 against 09/10): a sleeve covered by a
// hoodie is correct, and it is why the layer order is fixed rather than negotiated.
const inkFill = "rgba(18,16,15,0.42)";

export const tattooAssets: Asset[] = [
  {
    meta: meta("tattoo", { id: "tattoo_neck_001", name: "Cuello", style: { street: 6, alternative: 6 } }),
    draw: (ctx) => ({
      tattoos_body:
        rect(ctx.cx - 22, ctx.y.chin + 2, 44, 9, 4, inkFill, false) +
        rect(ctx.cx - 14, ctx.y.chin + 16, 28, 7, 3, inkFill, false),
    }),
  },
  {
    meta: meta("tattoo", { id: "tattoo_arm_001", name: "Manga izquierda", price: 12000, style: { street: 8 } }),
    draw: (ctx) => {
      const armW = Math.round(ctx.body.legW * 0.72);
      const x = ctx.cx - ctx.body.shoulderW / 2 - armW + 10;
      return {
        tattoos_body: [0, 1, 2]
          .map((i) => rect(x + 4, ctx.y.shoulders + 40 + i * 44, armW - 8, 30, 8, inkFill, false))
          .join(""),
      };
    },
  },
  {
    meta: meta("tattoo", { id: "tattoo_hand_001", name: "Nudillos", price: 8000, style: { street: 7, alternative: 7 } }),
    draw: (ctx) => {
      const armW = Math.round(ctx.body.legW * 0.72);
      return {
        tattoos_body: [-1, 1]
          .map((s) =>
            rect(
              ctx.cx + s * (ctx.body.shoulderW / 2 + armW / 2 - 8) - 14,
              ctx.y.waist + 44,
              28,
              10,
              4,
              inkFill,
              false,
            ),
          )
          .join(""),
      };
    },
  },
  {
    meta: meta("tattoo", { id: "tattoo_arm_002", name: "Doble manga", level: 8, rarity: "epic", style: { street: 9, originality: 7 } }),
    draw: (ctx) => {
      const armW = Math.round(ctx.body.legW * 0.72);
      return {
        tattoos_body: [-1, 1]
          .flatMap((s) =>
            [0, 1, 2].map((i) =>
              rect(
                ctx.cx + s * (ctx.body.shoulderW / 2 + armW / 2 - 8) - (armW - 8) / 2,
                ctx.y.shoulders + 40 + i * 44,
                armW - 8,
                30,
                8,
                inkFill,
                false,
              ),
            ),
          )
          .join(""),
      };
    },
  },
  {
    meta: meta("tattoo", { id: "tattoo_face_001", name: "Lagrima", level: 12, rarity: "iconic", style: { alternative: 9, originality: 8 } }),
    draw: (ctx) => ({
      tattoos_body: path(
        `M${ctx.cx + ctx.body.headW * 0.2} ${ctx.y.eyes + 22}l7 16h-14Z`,
        inkFill,
        false,
      ),
    }),
  },
];

// --- props ------------------------------------------------------------------
// Context-sensitive by design (spec §27): a battle wants a microphone, a studio
// wants headphones. The prop lives in the equipment slot and the scene may override
// it — which is why it is one slot and not a hard-coded per-scene decision.
export const propAssets: Asset[] = [
  {
    meta: meta("prop", { id: "prop_mic_001", name: "Microfono de mano", style: { stage_presence: 7 } }),
    draw: (ctx) => {
      const armW = Math.round(ctx.body.legW * 0.72);
      const x = ctx.cx + ctx.body.shoulderW / 2 + armW / 2 - 12;
      return {
        props:
          ellipse(x, ctx.y.waist + 34, 17, 19, "#3A3A3A") +
          limb(x - 8, ctx.y.waist + 46, 16, 74, "#242424"),
      };
    },
  },
  {
    meta: meta("prop", { id: "prop_mic_002", name: "Microfono vintage", price: 26000, rarity: "rare", style: { stage_presence: 9, classic: 8 } }),
    draw: (ctx) => {
      const armW = Math.round(ctx.body.legW * 0.72);
      const x = ctx.cx + ctx.body.shoulderW / 2 + armW / 2 - 12;
      return {
        props:
          rect(x - 20, ctx.y.waist + 18, 40, 44, 14, ctx.colors.metal) +
          limb(x - 7, ctx.y.waist + 58, 14, 66, "#242424"),
      };
    },
  },
  {
    meta: meta("prop", { id: "prop_bag_001", name: "Mochila", style: { street: 6 } }),
    draw: (ctx) => ({
      back_accessories: rect(
        ctx.cx - ctx.body.shoulderW / 2 - 26,
        ctx.y.shoulders + 20,
        ctx.body.shoulderW + 52,
        ctx.y.waist - ctx.y.shoulders + 20,
        22,
        ctx.colors.fabric2,
      ),
    }),
  },
  {
    meta: meta("prop", { id: "prop_boom_001", name: "Boombox", price: 31000, rarity: "rare", style: { classic: 9, street: 8 } }),
    draw: (ctx) => {
      const x = ctx.cx + ctx.body.shoulderW / 2 + 26;
      return {
        props:
          rect(x, ctx.y.waist + 6, 118, 76, 10, "#2A2724") +
          ellipse(x + 34, ctx.y.waist + 44, 22, 22, "#4A453E") +
          ellipse(x + 84, ctx.y.waist + 44, 22, 22, "#4A453E"),
      };
    },
  },
];

// --- piercings --------------------------------------------------------------
export const piercingAssets: Asset[] = [
  {
    meta: meta("piercing", { id: "piercing_ear_001", name: "Argolla", colors: ["metal_primary"] }),
    draw: (ctx) => ({
      front_accessories: ellipse(ctx.cx - ctx.body.headW / 2 - 2, ctx.y.eyes + 32, 9, 9, "none", true),
    }),
  },
  {
    meta: meta("piercing", { id: "piercing_ear_002", name: "Dormilona", colors: ["metal_primary"] }),
    draw: (ctx) => ({
      front_accessories: ellipse(ctx.cx - ctx.body.headW / 2 - 2, ctx.y.eyes + 28, 7, 7, ctx.colors.metal),
    }),
  },
];
