// Body, face shape and facial features (spec §9, §11–16).
//
// The body asset draws the WHOLE naked figure — head, ears, neck, torso, arms,
// hands, legs, feet. That is deliberate and it is the hard lesson from the previous
// pixel-art pass: when the base is incomplete, taking off a garment exposes a hole,
// and no amount of clever layering hides it. Here, every slot can be empty and the
// avatar is still a person.

import type { Asset, DrawContext } from "../asset";
import { ellipse, headShape, limb, path, rect, line } from "./kit";
import { arm, hand, leg, torsoPath } from "./geometry";
import type { ItemMeta } from "../types";

const bodyMeta = (id: string, name: string, unlockLevel?: number): ItemMeta => ({
  id,
  name,
  category: "body",
  rarity: "common",
  colors: ["skin_primary"],
  ...(unlockLevel ? { unlock: { type: "career_level", value: unlockLevel } } : {}),
});

// One draw function for every build: the metrics differ, the drawing does not. Six
// separate figure drawings would be six things to keep in sync.
function drawBody(ctx: DrawContext): Record<string, string> {
  const { body: b, colors: c, cx, y } = ctx;

  // Every limb comes from ./geometry, never re-derived here. A sleeve asks the same
  // module, which is what stops it landing beside the arm instead of on it.
  const legL = leg(ctx, -1);
  const legR = leg(ctx, 1);
  const legs =
    limb(legL.x, legL.y, legL.w, legL.h, c.skin) + limb(legR.x, legR.y, legR.w, legR.h, c.skin);
  // Feet point outward, so the figure stands instead of balancing on two posts.
  const feet =
    rect(legL.x - 12, y.ankle - 6, legL.w + 18, 42, 16, c.skin) +
    rect(legR.x - 6, y.ankle - 6, legR.w + 18, 42, 16, c.skin);

  const torso = path(torsoPath(ctx, 0, 0), c.skin);

  const armL = arm(ctx, -1);
  const armR = arm(ctx, 1);
  const arms =
    limb(armL.x, armL.y, armL.w, armL.h, c.skin) + limb(armR.x, armR.y, armR.w, armR.h, c.skin);
  const handL = hand(ctx, -1);
  const handR = hand(ctx, 1);
  const hands =
    ellipse(handL.cx, handL.cy, handL.r, handL.r * 1.06, c.skin) +
    ellipse(handR.cx, handR.cy, handR.r, handR.r * 1.06, c.skin);

  // A neck you can see. At 40px tall behind the chin the head read as sitting
  // directly on the shoulders.
  const neck = rect(cx - 28, y.chin - 20, 56, 46, 16, c.skin);
  const ears =
    ellipse(cx - b.headW / 2 - 2, y.eyes + 12, 16, 22, c.skin) +
    ellipse(cx + b.headW / 2 + 2, y.eyes + 12, 16, 22, c.skin);
  const head = headShape(cx - b.headW / 2, y.crown, b.headW, b.headH, b.headR, c.skin);

  return {
    legs: legs + feet,
    body: torso + arms + hands,
    neck,
    ears,
    head,
  };
}

export const bodyAssets: Asset[] = [
  { meta: bodyMeta("body_01", "Bajo y delgado"), draw: (ctx) => drawBody(ctx) },
  { meta: bodyMeta("body_02", "Delgado"), draw: (ctx) => drawBody(ctx) },
  { meta: bodyMeta("body_03", "Normal"), draw: (ctx) => drawBody(ctx) },
  { meta: bodyMeta("body_04", "Atletico", 6), draw: (ctx) => drawBody(ctx) },
  { meta: bodyMeta("body_05", "Fornido"), draw: (ctx) => drawBody(ctx) },
  { meta: bodyMeta("body_06", "Alto"), draw: (ctx) => drawBody(ctx) },
];

// --- face shapes ------------------------------------------------------------
// The face asset draws no head: the head's BOX comes from the face shape (through
// the renderer's metrics) and the body paints it. What this asset adds is what sits
// on the face and belongs to its structure — the cheek/jaw shading that makes an
// angular face angular.
const faceMeta = (id: string, name: string): ItemMeta => ({
  id,
  name,
  category: "face",
  rarity: "common",
});

const faceAsset = (id: string, name: string, jaw: (ctx: DrawContext) => string): Asset => ({
  meta: faceMeta(id, name),
  draw: (ctx) => ({ face: jaw(ctx) }),
});

export const faceAssets: Asset[] = [
  faceAsset("face_01", "Ovalado", (ctx) =>
    ellipse(ctx.cx, ctx.y.mouth + 18, ctx.body.headW * 0.3, 14, ctx.colors.skinShade, false),
  ),
  faceAsset("face_02", "Redondo", (ctx) =>
    ellipse(ctx.cx, ctx.y.mouth + 22, ctx.body.headW * 0.36, 18, ctx.colors.skinShade, false),
  ),
  faceAsset("face_03", "Cuadrado", (ctx) =>
    rect(ctx.cx - ctx.body.headW * 0.32, ctx.y.mouth + 12, ctx.body.headW * 0.64, 16, 6, ctx.colors.skinShade, false),
  ),
  faceAsset("face_04", "Alargado", (ctx) =>
    ellipse(ctx.cx, ctx.y.mouth + 24, ctx.body.headW * 0.26, 20, ctx.colors.skinShade, false),
  ),
  faceAsset("face_05", "Corazon", (ctx) =>
    path(
      `M${ctx.cx - 34} ${ctx.y.mouth + 10}L${ctx.cx + 34} ${ctx.y.mouth + 10}L${ctx.cx} ${ctx.y.mouth + 34}Z`,
      ctx.colors.skinShade,
      false,
    ),
  ),
  faceAsset("face_06", "Anguloso", (ctx) =>
    path(
      `M${ctx.cx - 40} ${ctx.y.mouth + 8}L${ctx.cx + 40} ${ctx.y.mouth + 8}L${ctx.cx + 26} ${ctx.y.mouth + 30}L${ctx.cx - 26} ${ctx.y.mouth + 30}Z`,
      ctx.colors.skinShade,
      false,
    ),
  ),
];

// --- eyes, brows, nose, mouth ----------------------------------------------
const feature = (
  id: string,
  name: string,
  category: ItemMeta["category"],
  layer: string,
  draw: (ctx: DrawContext) => string,
): Asset => ({
  meta: { id, name, category, rarity: "common" },
  draw: (ctx) => ({ [layer]: draw(ctx) }) as Record<string, string>,
});

const eyeX = (ctx: DrawContext, side: -1 | 1): number => ctx.cx + side * ctx.body.headW * 0.19;

export const eyeAssets: Asset[] = [
  feature("eyes_01", "Normales", "eyes", "eyes", (ctx) =>
    [-1, 1]
      .map(
        (s) =>
          ellipse(eyeX(ctx, s as -1 | 1), ctx.y.eyes, 13, 16, ctx.colors.ink, false) +
          ellipse(eyeX(ctx, s as -1 | 1) + 4, ctx.y.eyes - 5, 4.5, 5, "#FFFFFF", false),
      )
      .join(""),
  ),
  feature("eyes_02", "Entrecerrados", "eyes", "eyes", (ctx) =>
    [-1, 1]
      .map((s) => {
        const x = eyeX(ctx, s as -1 | 1);
        return line(`M${x - 15} ${ctx.y.eyes + 4}Q${x} ${ctx.y.eyes - 8} ${x + 15} ${ctx.y.eyes + 4}`, ctx.colors.ink, 10);
      })
      .join(""),
  ),
  feature("eyes_03", "Ladeados", "eyes", "eyes", (ctx) =>
    [-1, 1]
      .map(
        (s) =>
          ellipse(eyeX(ctx, s as -1 | 1) + 4, ctx.y.eyes, 13, 16, ctx.colors.ink, false) +
          ellipse(eyeX(ctx, s as -1 | 1) + 8, ctx.y.eyes - 5, 4.5, 5, "#FFFFFF", false),
      )
      .join(""),
  ),
  feature("eyes_04", "Caidos", "eyes", "eyes", (ctx) =>
    [-1, 1]
      .map((s) => {
        const x = eyeX(ctx, s as -1 | 1);
        return (
          ellipse(x, ctx.y.eyes + 3, 13, 13, ctx.colors.ink, false) +
          rect(x - 15, ctx.y.eyes - 12, 30, 8, 4, ctx.colors.skinShade, false)
        );
      })
      .join(""),
  ),
];

export const browAssets: Asset[] = [
  feature("brows_01", "Rectas", "eyebrows", "eyebrows", (ctx) =>
    [-1, 1]
      .map((s) => rect(eyeX(ctx, s as -1 | 1) - 22, ctx.y.brow, 44, 11, 5.5, ctx.colors.hair, false))
      .join(""),
  ),
  feature("brows_02", "Serias", "eyebrows", "eyebrows", (ctx) =>
    [-1, 1]
      .map((s) => {
        const x = eyeX(ctx, s as -1 | 1);
        const inner = s === -1 ? x + 22 : x - 22;
        const outer = s === -1 ? x - 22 : x + 22;
        return path(
          `M${outer} ${ctx.y.brow}L${inner} ${ctx.y.brow - 9}L${inner} ${ctx.y.brow + 2}L${outer} ${ctx.y.brow + 11}Z`,
          ctx.colors.hair,
          false,
        );
      })
      .join(""),
  ),
  feature("brows_03", "Arqueadas", "eyebrows", "eyebrows", (ctx) =>
    [-1, 1]
      .map((s) => {
        const x = eyeX(ctx, s as -1 | 1);
        return line(`M${x - 22} ${ctx.y.brow + 8}Q${x} ${ctx.y.brow - 12} ${x + 22} ${ctx.y.brow + 4}`, ctx.colors.hair, 11);
      })
      .join(""),
  ),
];

export const noseAssets: Asset[] = [
  feature("nose_01", "Recta", "nose", "nose", (ctx) =>
    path(
      `M${ctx.cx - 4} ${ctx.y.nose - 16}L${ctx.cx - 12} ${ctx.y.nose + 8}L${ctx.cx + 12} ${ctx.y.nose + 8}L${ctx.cx + 4} ${ctx.y.nose - 16}Z`,
      ctx.colors.skinShade,
      false,
    ),
  ),
  feature("nose_02", "Ancha", "nose", "nose", (ctx) =>
    ellipse(ctx.cx, ctx.y.nose + 2, 18, 12, ctx.colors.skinShade, false),
  ),
  feature("nose_03", "Aguilena", "nose", "nose", (ctx) =>
    path(
      `M${ctx.cx - 3} ${ctx.y.nose - 20}Q${ctx.cx + 14} ${ctx.y.nose - 6} ${ctx.cx + 10} ${ctx.y.nose + 8}L${ctx.cx - 10} ${ctx.y.nose + 8}Z`,
      ctx.colors.skinShade,
      false,
    ),
  ),
];

export const mouthAssets: Asset[] = [
  feature("mouth_01", "Neutra", "mouth", "mouth", (ctx) =>
    rect(ctx.cx - 26, ctx.y.mouth - 5, 52, 10, 5, ctx.colors.ink, false),
  ),
  feature("mouth_02", "Media sonrisa", "mouth", "mouth", (ctx) =>
    line(`M${ctx.cx - 28} ${ctx.y.mouth - 6}Q${ctx.cx} ${ctx.y.mouth + 16} ${ctx.cx + 28} ${ctx.y.mouth - 6}`, ctx.colors.ink, 10),
  ),
  feature("mouth_03", "Rapeando", "mouth", "mouth", (ctx) =>
    path(
      `M${ctx.cx - 26} ${ctx.y.mouth - 8}h52c0 24-12 34-26 34s-26-10-26-34Z`,
      ctx.colors.ink,
      false,
    ) + path(`M${ctx.cx - 14} ${ctx.y.mouth + 6}h28c0 12-7 17-14 17s-14-5-14-17Z`, "#C05A5A", false),
  ),
  feature("mouth_04", "Seria", "mouth", "mouth", (ctx) =>
    line(`M${ctx.cx - 26} ${ctx.y.mouth + 4}Q${ctx.cx} ${ctx.y.mouth - 8} ${ctx.cx + 26} ${ctx.y.mouth + 4}`, ctx.colors.ink, 10),
  ),
];
