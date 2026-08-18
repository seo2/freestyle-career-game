// Hair and facial hair (spec §17/§18).
//
// Hair is the one category that paints into TWO of the 27 layers: back_hair (03,
// behind the whole body) and front_hair (21, over the face). That split is what
// lets an afro sit behind the shoulders while its hairline still covers the
// forehead. A single layer cannot do both, which is why the spec numbers them apart.

import type { Asset, DrawContext } from "../asset";
import { ellipse, path, rect, limb } from "./kit";
import type { ItemMeta } from "../types";

const hairMeta = (id: string, name: string, extra: Partial<ItemMeta> = {}): ItemMeta => ({
  id,
  name,
  category: "hair",
  rarity: "common",
  colors: ["hair_primary"],
  ...extra,
});

// The crown sits on the skull: a cap over the head's own box, so it follows every
// face shape without being redrawn per shape.
function crown(ctx: DrawContext, grow: number, drop: number, radius: number): string {
  const w = ctx.body.headW + grow;
  const x = ctx.cx - w / 2;
  const yTop = ctx.y.crown - drop;
  const h = ctx.y.hairline - yTop + 26;
  return path(
    `M${x} ${yTop + h}` +
      `C${x} ${yTop + radius * 0.2} ${x + radius} ${yTop} ${ctx.cx} ${yTop}` +
      `C${x + w - radius} ${yTop} ${x + w} ${yTop + radius * 0.2} ${x + w} ${yTop + h}` +
      `C${x + w - 22} ${yTop + h - 22} ${ctx.cx + 30} ${yTop + h - 32} ${ctx.cx} ${yTop + h - 32}` +
      `C${ctx.cx - 30} ${yTop + h - 32} ${x + 22} ${yTop + h - 22} ${x} ${yTop + h}Z`,
    ctx.colors.hair,
  );
}

export const hairAssets: Asset[] = [
  {
    meta: hairMeta("hair_001", "Rapado"),
    draw: (ctx) => ({ front_hair: crown(ctx, 6, 2, 60) }),
  },
  {
    meta: hairMeta("hair_002", "Fade"),
    draw: (ctx) => ({ front_hair: crown(ctx, 12, 8, 70) }),
  },
  {
    meta: hairMeta("hair_003", "Trenzas"),
    draw: (ctx) => {
      const w = ctx.body.headW;
      const braids = [-0.42, -0.16, 0.16, 0.42]
        .map((f) => limb(ctx.cx + w * f - 9, ctx.y.hairline, 18, ctx.body.headH * 0.92, ctx.colors.hair))
        .join("");
      return { back_hair: braids, front_hair: crown(ctx, 16, 10, 72) };
    },
  },
  {
    meta: hairMeta("hair_004", "Afro"),
    draw: (ctx) => ({
      back_hair: ellipse(ctx.cx, ctx.y.hairline - 6, ctx.body.headW * 0.74, ctx.body.headH * 0.56, ctx.colors.hair),
      front_hair: crown(ctx, 10, 4, 66),
    }),
  },
  {
    meta: hairMeta("hair_005", "Dreads"),
    draw: (ctx) => {
      const w = ctx.body.headW;
      const locks = [-0.5, -0.28, 0.28, 0.5]
        .map((f, i) =>
          limb(
            ctx.cx + w * f - 13,
            ctx.y.hairline - (i === 0 || i === 3 ? 8 : 0),
            26,
            ctx.body.headH * (i === 0 || i === 3 ? 1.18 : 0.98),
            ctx.colors.hair,
          ),
        )
        .join("");
      return { back_hair: locks, front_hair: crown(ctx, 18, 12, 74) };
    },
  },
  {
    // Priced, not level-gated: a mullet is a choice you pay a stylist for.
    meta: hairMeta("hair_006", "Mullet", { rarity: "uncommon", price: 9000, currency: "cash" }),
    draw: (ctx) => ({
      back_hair: rect(
        ctx.cx - ctx.body.headW * 0.44,
        ctx.y.hairline + 20,
        ctx.body.headW * 0.88,
        ctx.body.headH * 0.72,
        16,
        ctx.colors.hair,
      ),
      front_hair: crown(ctx, 14, 8, 70),
    }),
  },
];

// --- facial hair -----------------------------------------------------------
const beardMeta = (id: string, name: string, extra: Partial<ItemMeta> = {}): ItemMeta => ({
  id,
  name,
  category: "facial_hair",
  rarity: "common",
  colors: ["hair_primary"],
  ...extra,
});

export const facialHairAssets: Asset[] = [
  {
    meta: beardMeta("beard_001", "Chivo"),
    draw: (ctx) => ({
      facial_hair:
        rect(ctx.cx - 26, ctx.y.mouth - 22, 52, 12, 6, ctx.colors.hair, false) +
        path(
          `M${ctx.cx - 20} ${ctx.y.mouth + 12}h40v16c0 14-9 22-20 22s-20-8-20-22Z`,
          ctx.colors.hair,
          false,
        ),
    }),
  },
  {
    meta: beardMeta("beard_002", "Bigote"),
    draw: (ctx) => ({
      facial_hair: path(
        `M${ctx.cx - 30} ${ctx.y.mouth - 20}h60c0 14-13 21-30 21s-30-7-30-21Z`,
        ctx.colors.hair,
        false,
      ),
    }),
  },
  {
    meta: beardMeta("beard_003", "Barba completa"),
    draw: (ctx) => ({
      facial_hair:
        path(
          `M${ctx.cx - ctx.body.headW * 0.44} ${ctx.y.nose}` +
            `C${ctx.cx - ctx.body.headW * 0.44} ${ctx.y.chin + 26} ${ctx.cx - 40} ${ctx.y.chin + 40} ${ctx.cx} ${ctx.y.chin + 40}` +
            `C${ctx.cx + 40} ${ctx.y.chin + 40} ${ctx.cx + ctx.body.headW * 0.44} ${ctx.y.chin + 26} ${ctx.cx + ctx.body.headW * 0.44} ${ctx.y.nose}` +
            `C${ctx.cx + 30} ${ctx.y.nose + 34} ${ctx.cx - 30} ${ctx.y.nose + 34} ${ctx.cx - ctx.body.headW * 0.44} ${ctx.y.nose}Z`,
          ctx.colors.hair,
        ) + rect(ctx.cx - 32, ctx.y.mouth - 22, 64, 13, 6, ctx.colors.hair, false),
    }),
  },
];
