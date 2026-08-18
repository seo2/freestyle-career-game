// Clothing (spec §21–25) plus hats, glasses, jewelry, tattoos and props (§26/§27).
//
// Prices, level requirements and item names come from the Creador de Avatar design.
// The spec's metadata shape carries them: `price` means the shop sells it, an
// `unlock` of career_level means it is a career REWARD and the shop must refuse to
// sell it (§34 — "Las piezas con nivel no se venden").

import type { Asset, DrawContext } from "../asset";
import { ellipse, line, path, rect, limb } from "./kit";
import { arm, leg, legGap, torsoPath } from "./geometry";
import type { Category, ItemMeta, Rarity } from "../types";

interface Spec {
  id: string;
  name: string;
  rarity?: Rarity;
  price?: number;
  level?: number;
  colors?: ItemMeta["colors"];
  style?: ItemMeta["style"];
  rules?: ItemMeta["rules"];
}

const meta = (category: Category, s: Spec): ItemMeta => ({
  id: s.id,
  name: s.name,
  category,
  rarity: s.rarity ?? (s.level ? "epic" : s.price ? "uncommon" : "common"),
  ...(s.price ? { price: s.price, currency: "cash" as const } : {}),
  ...(s.level ? { unlock: { type: "career_level" as const, value: s.level } } : {}),
  ...(s.colors ? { colors: s.colors } : {}),
  ...(s.style ? { style: s.style } : {}),
  ...(s.rules ? { rules: s.rules } : {}),
});

const FABRIC: ItemMeta["colors"] = ["fabric_primary"];

// --- tops -------------------------------------------------------------------
// A top covers the torso and, depending on the cut, the arms. Sleeve length is the
// whole difference between a tank top and a hoodie, so it is a parameter.
// A sleeve is the ARM's geometry, grown. Asking ./geometry rather than recomputing
// is the fix for sleeves that used to float beside the arm.
function sleeves(ctx: DrawContext, grow: number, length: number, fill: string): string {
  if (length <= 0) return "";
  return ([-1, 1] as const)
    .map((side) => {
      const a = arm(ctx, side, grow);
      return limb(a.x - grow / 2, a.y + 2, a.w, length, fill);
    })
    .join("");
}

function topShape(ctx: DrawContext, opts: { grow: number; drop: number; sleeve: number; neck: number }): string {
  const { colors: c, cx, y } = ctx;
  const shell = path(torsoPath(ctx, opts.grow, opts.drop), c.fabric);
  const collar = opts.neck > 0 ? rect(cx - opts.neck / 2, y.chin + 2, opts.neck, 22, 11, c.fabricShade, false) : "";
  // Sleeves BEFORE the shell so the shoulder seam is the shell's edge, not a line
  // across the arm.
  return sleeves(ctx, opts.grow * 0.6, opts.sleeve, c.fabric) + shell + collar;
}

export const topAssets: Asset[] = [
  {
    meta: meta("top", { id: "top_001", name: "Polera lisa", colors: FABRIC, style: { street: 4, originality: 2 } }),
    draw: (ctx) => ({ top: topShape(ctx, { grow: 8, drop: 10, sleeve: 104, neck: 58 }) }),
  },
  {
    meta: meta("top", { id: "top_002", name: "Polera oversize", colors: FABRIC, style: { street: 7, originality: 4 } }),
    draw: (ctx) => ({ top: topShape(ctx, { grow: 22, drop: 48, sleeve: 132, neck: 66 }) }),
  },
  {
    meta: meta("top", { id: "top_003", name: "Buzo con capucha", colors: FABRIC, style: { street: 8, sport: 5 } }),
    draw: (ctx) => ({
      top:
        topShape(ctx, { grow: 28, drop: 56, sleeve: ctx.y.waist - ctx.y.shoulders + 74, neck: 0 }) +
        // La capucha caida detras del cuello, y el bolsillo canguro.
        path(
          `M${ctx.cx - 54} ${ctx.y.chin - 2}C${ctx.cx - 46} ${ctx.y.shoulders + 34} ${ctx.cx - 18} ${ctx.y.shoulders + 48} ${ctx.cx} ${ctx.y.shoulders + 48}` +
            `C${ctx.cx + 18} ${ctx.y.shoulders + 48} ${ctx.cx + 46} ${ctx.y.shoulders + 34} ${ctx.cx + 54} ${ctx.y.chin - 2}` +
            `C${ctx.cx + 30} ${ctx.y.chin - 14} ${ctx.cx - 30} ${ctx.y.chin - 14} ${ctx.cx - 54} ${ctx.y.chin - 2}Z`,
          ctx.colors.fabricShade,
        ) + rect(ctx.cx - 56, ctx.y.waist + 6, 112, 46, 20, ctx.colors.fabricShade, false),
    }),
  },
  {
    meta: meta("top", { id: "top_004", name: "Camisa abierta", colors: FABRIC, style: { classic: 6, street: 4 } }),
    draw: (ctx) => {
      const halfS = ctx.body.shoulderW / 2 + 12;
      const armW = Math.round(ctx.body.legW * 0.72) + 6;
      // Dos paneles con el torso visible en medio: eso es lo que la hace "abierta".
      const panel = (side: -1 | 1): string =>
        path(
          `M${ctx.cx + side * halfS} ${ctx.y.shoulders + 20}` +
            `C${ctx.cx + side * halfS} ${ctx.y.shoulders - 8} ${ctx.cx + side * (halfS - 22)} ${ctx.y.chin + 6} ${ctx.cx + side * 20} ${ctx.y.chin + 10}` +
            `L${ctx.cx + side * 22} ${ctx.y.hip + 18}L${ctx.cx + side * (halfS - 8)} ${ctx.y.hip + 18}Z`,
          ctx.colors.fabric,
        );
      return {
        top:
          panel(-1) +
          panel(1) +
          limb(ctx.cx - halfS - armW + 10, ctx.y.shoulders + 6, armW, 128, ctx.colors.fabric) +
          limb(ctx.cx + halfS - 10, ctx.y.shoulders + 6, armW, 128, ctx.colors.fabric),
      };
    },
  },
  {
    meta: meta("top", { id: "top_005", name: "Chaqueta de cuero", price: 24000, colors: FABRIC, style: { street: 8, luxury: 5, alternative: 7 } }),
    draw: (ctx) => ({
      top:
        topShape(ctx, { grow: 18, drop: 24, sleeve: ctx.y.waist - ctx.y.shoulders + 70, neck: 0 }) +
        rect(ctx.cx - 8, ctx.y.chin + 6, 16, ctx.y.hip - ctx.y.chin + 14, 4, ctx.colors.fabricShade, false) +
        rect(ctx.cx - 46, ctx.y.chin + 4, 92, 22, 8, ctx.colors.fabricShade),
    }),
  },
  {
    meta: meta("top", { id: "top_006", name: "Puffer inflada", price: 38000, rarity: "rare", colors: FABRIC, style: { street: 9, luxury: 6 } }),
    draw: (ctx) => {
      const base = topShape(ctx, { grow: 36, drop: 36, sleeve: ctx.y.waist - ctx.y.shoulders + 70, neck: 0 });
      const halfS = ctx.body.shoulderW / 2 + 34;
      // Los canales horizontales son lo que la lee como inflada y no como abrigo.
      const quilt = [0, 1, 2, 3]
        .map((i) => line(`M${ctx.cx - halfS + 10} ${ctx.y.shoulders + 48 + i * 40}h${halfS * 2 - 20}`, ctx.colors.fabricShade, 8))
        .join("");
      return { top: base + quilt };
    },
  },
  {
    meta: meta("top", { id: "top_007", name: "Jersey de equipo", level: 9, colors: FABRIC, style: { sport: 9, street: 6 } }),
    draw: (ctx) => ({
      top:
        topShape(ctx, { grow: 22, drop: 32, sleeve: 0, neck: 64 }) +
        rect(ctx.cx - 34, ctx.y.chest + 6, 68, 54, 6, ctx.colors.fabric2, false),
    }),
  },
  {
    meta: meta("top", { id: "top_008", name: "Traje sastre", level: 15, rarity: "legendary", colors: FABRIC, style: { formal: 10, luxury: 8 } }),
    draw: (ctx) => ({
      top:
        topShape(ctx, { grow: 14, drop: 32, sleeve: ctx.y.waist - ctx.y.shoulders + 74, neck: 0 }) +
        path(
          `M${ctx.cx - 44} ${ctx.y.chin + 6}L${ctx.cx} ${ctx.y.chest + 24}L${ctx.cx + 44} ${ctx.y.chin + 6}` +
            `L${ctx.cx + 26} ${ctx.y.chin + 2}L${ctx.cx} ${ctx.y.chin + 22}L${ctx.cx - 26} ${ctx.y.chin + 2}Z`,
          ctx.colors.fabricShade,
        ),
    }),
  },
];

// --- jackets ----------------------------------------------------------------
// A jacket goes OVER a top (layer 11 against 10) and declares nothing about it. A
// jacket that hid the shirt would be a top.
export const jacketAssets: Asset[] = [
  {
    meta: meta("jacket", { id: "jacket_001", name: "Bomber", price: 28000, colors: FABRIC, style: { street: 7 } }),
    draw: (ctx) => {
      const halfS = ctx.body.shoulderW / 2 + 24;
      const armW = Math.round(ctx.body.legW * 0.72) + 12;
      const panel = (side: -1 | 1): string =>
        path(
          `M${ctx.cx + side * halfS} ${ctx.y.shoulders + 18}` +
            `C${ctx.cx + side * halfS} ${ctx.y.shoulders - 10} ${ctx.cx + side * (halfS - 20)} ${ctx.y.chin + 4} ${ctx.cx + side * 26} ${ctx.y.chin + 10}` +
            `L${ctx.cx + side * 28} ${ctx.y.waist + 26}L${ctx.cx + side * (halfS - 4)} ${ctx.y.waist + 26}Z`,
          ctx.colors.fabric,
        );
      return {
        jacket:
          panel(-1) +
          panel(1) +
          limb(ctx.cx - halfS - armW + 10, ctx.y.shoulders + 4, armW, ctx.y.waist - ctx.y.shoulders + 40, ctx.colors.fabric) +
          limb(ctx.cx + halfS - 10, ctx.y.shoulders + 4, armW, ctx.y.waist - ctx.y.shoulders + 40, ctx.colors.fabric) +
          rect(ctx.cx - halfS + 4, ctx.y.waist + 18, halfS * 2 - 8, 22, 10, ctx.colors.fabricShade),
      };
    },
  },
];

// --- bottoms ----------------------------------------------------------------
// Two legs with a gap you can see. The first version used a fixed 10px gap that a
// baggy cut closed entirely, and the trousers read as one column with a seam painted
// down it — the clearest defect on the whole contact sheet.
function legsShape(ctx: DrawContext, opts: { grow: number; hem: number; length: number }): string {
  const { colors: c, cx, y } = ctx;
  const gap = legGap(opts.grow);
  const one = (side: -1 | 1): string => {
    const l = leg(ctx, side, opts.grow);
    const bottom = l.y + opts.length;
    // The hem flares outward only, so the two legs never grow into each other.
    const flare = side === -1 ? -opts.hem : opts.hem;
    return path(
      `M${l.x} ${l.y}h${l.w}` +
        `L${l.x + l.w + Math.max(0, flare)} ${bottom}` +
        `L${l.x + Math.min(0, flare)} ${bottom}Z`,
      c.fabric,
    );
  };
  const waistW = (ctx.body.legW + opts.grow) * 2 + gap;
  return one(-1) + one(1) + rect(cx - waistW / 2, y.hip - 22, waistW, 34, 12, c.fabricShade);
}

export const bottomAssets: Asset[] = [
  {
    meta: meta("bottom", { id: "bottom_001", name: "Jeans gastados", colors: FABRIC, style: { street: 5, classic: 5 } }),
    draw: (ctx) => ({ bottom: legsShape(ctx, { grow: 8, hem: 6, length: ctx.y.ankle - ctx.y.hip + 14 }) }),
  },
  {
    meta: meta("bottom", { id: "bottom_002", name: "Buzo deportivo", colors: FABRIC, style: { sport: 8, street: 6 } }),
    draw: (ctx) => ({
      bottom:
        legsShape(ctx, { grow: 14, hem: 0, length: ctx.y.ankle - ctx.y.hip + 8 }) +
        rect(ctx.cx - ctx.body.legW - 5, ctx.y.ankle - 10, ctx.body.legW + 8, 24, 12, ctx.colors.fabricShade) +
        rect(ctx.cx + 5 - 3, ctx.y.ankle - 10, ctx.body.legW + 8, 24, 12, ctx.colors.fabricShade),
    }),
  },
  {
    meta: meta("bottom", { id: "bottom_003", name: "Cargo", colors: FABRIC, style: { street: 8, alternative: 5 } }),
    draw: (ctx) => ({
      bottom:
        legsShape(ctx, { grow: 20, hem: 10, length: ctx.y.ankle - ctx.y.hip + 14 }) +
        rect(ctx.cx - ctx.body.legW - 34, ctx.y.knee - 40, 40, 54, 8, ctx.colors.fabricShade) +
        rect(ctx.cx + ctx.body.legW - 6, ctx.y.knee - 40, 40, 54, 8, ctx.colors.fabricShade),
    }),
  },
  {
    meta: meta("bottom", { id: "bottom_004", name: "Baggy", colors: FABRIC, style: { street: 9, originality: 6 } }),
    draw: (ctx) => ({ bottom: legsShape(ctx, { grow: 30, hem: 22, length: ctx.y.ankle - ctx.y.hip + 20 }) }),
  },
  {
    meta: meta("bottom", { id: "bottom_005", name: "Short", colors: FABRIC, style: { sport: 6, street: 5 } }),
    draw: (ctx) => ({ bottom: legsShape(ctx, { grow: 16, hem: 8, length: 150 }) }),
  },
  {
    meta: meta("bottom", { id: "bottom_006", name: "Jeans rotos premium", price: 19000, rarity: "rare", colors: FABRIC, style: { luxury: 6, alternative: 8 } }),
    draw: (ctx) => ({
      bottom:
        legsShape(ctx, { grow: 10, hem: 6, length: ctx.y.ankle - ctx.y.hip + 14 }) +
        rect(ctx.cx - ctx.body.legW + 4, ctx.y.knee - 12, 40, 16, 6, ctx.colors.skin, false) +
        rect(ctx.cx + 18, ctx.y.knee + 26, 34, 14, 6, ctx.colors.skin, false),
    }),
  },
  {
    meta: meta("bottom", { id: "bottom_007", name: "Cuero negro", level: 11, rarity: "epic", colors: FABRIC, style: { luxury: 7, alternative: 9 } }),
    draw: (ctx) => ({
      bottom:
        legsShape(ctx, { grow: 4, hem: 0, length: ctx.y.ankle - ctx.y.hip + 12 }) +
        line(`M${ctx.cx - ctx.body.legW} ${ctx.y.knee}h${ctx.body.legW - 8}`, ctx.colors.fabricShade, 7) +
        line(`M${ctx.cx + 8} ${ctx.y.knee}h${ctx.body.legW - 8}`, ctx.colors.fabricShade, 7),
    }),
  },
];

// --- shoes ------------------------------------------------------------------
// Fictional brands only (spec §25). The names below are the placeholders the spec
// suggests, adapted: nothing here references a real brand.
// A shoe has to be WIDER than the trouser hem or it disappears behind it, and its
// sole has to be a different value or the whole foot is one blob.
function shoePair(ctx: DrawContext, opts: { shaft: number; sole: number; toe: number }): string {
  const { colors: c, y } = ctx;
  const shoe = (side: -1 | 1): string => {
    const l = leg(ctx, side, 10);
    const top = y.ankle - opts.shaft;
    // The toe points away from the centre line: that is what makes a pair of feet
    // read as standing rather than as two bricks.
    const toeOut = side === -1 ? -14 : 8;
    return (
      rect(l.x, top, l.w, opts.shaft + 30, 16, c.fabric) +
      rect(l.x + toeOut, y.ankle + 18, l.w + 16, opts.toe, opts.toe / 2, c.fabric) +
      rect(l.x + toeOut - 2, y.sole - opts.sole, l.w + 20, opts.sole, opts.sole / 2, c.ink)
    );
  };
  return shoe(-1) + shoe(1);
}

export const shoeAssets: Asset[] = [
  {
    meta: meta("shoes", { id: "shoes_001", name: "De lona", colors: FABRIC, style: { street: 3, classic: 6 } }),
    draw: (ctx) => ({ shoes: shoePair(ctx, { shaft: 6, sole: 16, toe: 30 }) }),
  },
  {
    meta: meta("shoes", { id: "shoes_002", name: "Deportivas gastadas", colors: FABRIC, style: { sport: 4, street: 3 } }),
    draw: (ctx) => ({ shoes: shoePair(ctx, { shaft: 10, sole: 20, toe: 34 }) }),
  },
  {
    meta: meta("shoes", { id: "shoes_003", name: "Altas clasicas", colors: FABRIC, style: { street: 7, classic: 7 } }),
    draw: (ctx) => ({ shoes: shoePair(ctx, { shaft: 54, sole: 20, toe: 34 }) }),
  },
  {
    meta: meta("shoes", { id: "shoes_004", name: "Runners Rhyme", price: 22000, colors: FABRIC, style: { sport: 9, street: 6 } }),
    draw: (ctx) => ({
      shoes:
        shoePair(ctx, { shaft: 16, sole: 28, toe: 38 }) +
        line(`M${ctx.cx - ctx.body.legW - 12} ${ctx.y.ankle + 6}h${ctx.body.legW}`, ctx.colors.fabric2, 8) +
        line(`M${ctx.cx + 12} ${ctx.y.ankle + 6}h${ctx.body.legW}`, ctx.colors.fabric2, 8),
    }),
  },
  {
    meta: meta("shoes", { id: "shoes_005", name: "Botas de trabajo", price: 16000, colors: FABRIC, style: { alternative: 7, street: 5 } }),
    draw: (ctx) => ({ shoes: shoePair(ctx, { shaft: 76, sole: 24, toe: 32 }) }),
  },
  {
    // Both priced AND level-gated, exactly as the design has it: you have to be
    // someone AND have the money.
    meta: meta("shoes", { id: "shoes_006", name: "Edicion limitada", price: 65000, level: 10, rarity: "legendary", colors: FABRIC, style: { luxury: 9, originality: 9, stage_presence: 8 } }),
    draw: (ctx) => ({
      shoes:
        shoePair(ctx, { shaft: 42, sole: 30, toe: 40 }) +
        ellipse(ctx.cx - ctx.body.legW / 2 - 14, ctx.y.ankle + 2, 12, 12, ctx.colors.metal) +
        ellipse(ctx.cx + ctx.body.legW / 2 + 14, ctx.y.ankle + 2, 12, 12, ctx.colors.metal),
    }),
  },
];
