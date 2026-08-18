// The avatar renderer (spec §40/§41).
//
// The spec's pipeline, in order:
//
//   Avatar Configuration → Asset Resolver → Compatibility Rules → Layer Resolver
//   → SVG Renderer → Rendered Avatar
//
// This file is that pipeline, as one pure function. It imports no framework and
// touches no DOM, because §78 requires the renderer be testable independently from
// the UI — and because the same function has to serve the creator screen, the
// battle scene, NPCs (§55) and profile cards.

import { CANVAS, ANCHORS, LIGHT } from "./canvas";
import { sortLayers, layerOrder, type LayerId } from "./layers";
import { colorOf, shade, INK } from "./palettes";
import { skinIndexOf } from "./assets/skin";
import { resolveCompatibility, type Conflict } from "./rules";
import type { Asset, BodyMetrics, DrawColors, DrawContext } from "./asset";
import type { AssetId, AvatarConfig, ItemMeta } from "./types";

export interface Registry {
  get: (id: AssetId) => Asset | undefined;
  meta: (id: AssetId) => ItemMeta | undefined;
}

export interface RenderResult {
  svg: string;
  // Which ids actually made it in, and what got displaced. The creator shows the
  // conflicts to the player instead of silently dropping a garment.
  used: AssetId[];
  conflicts: Conflict[];
}

// Body metrics come from the body asset's own id. The spec (§9) says all body types
// share the anchor system, so a build changes widths and lift, never rows.
const BODY_METRICS: Record<string, Omit<BodyMetrics, "headW" | "headH" | "headR">> = {
  body_01: { shoulderW: 150, waistW: 128, lift: 26, legW: 62 }, // Short Slim
  body_02: { shoulderW: 158, waistW: 132, lift: 8, legW: 64 }, // Slim
  body_03: { shoulderW: 178, waistW: 152, lift: 0, legW: 72 }, // Average
  body_04: { shoulderW: 196, waistW: 158, lift: -6, legW: 76 }, // Athletic
  body_05: { shoulderW: 218, waistW: 202, lift: -2, legW: 88 }, // Heavy
  body_06: { shoulderW: 166, waistW: 140, lift: -24, legW: 66 }, // Tall
};

// Face shape drives the head's box. Six shapes (spec §12) as width/height/radius
// rather than six head drawings — which is what lets one hat fit all of them.
const FACE_SHAPES: Record<string, { w: number; h: number; r: string }> = {
  face_01: { w: 150, h: 136, r: "50%" }, //                    Oval
  face_02: { w: 156, h: 132, r: "46%" }, //                     Round
  face_03: { w: 152, h: 138, r: "34px 34px 22px 22px" }, //     Square
  face_04: { w: 136, h: 154, r: "40% 40% 44% 44%" }, //         Long
  face_05: { w: 158, h: 136, r: "48% 48% 40% 40%" }, //         Heart
  face_06: { w: 146, h: 140, r: "30px 30px 40px 40px" }, //     Angular
};

function metricsFor(config: AvatarConfig): BodyMetrics {
  const build = BODY_METRICS[config.appearance.body] ?? BODY_METRICS.body_03;
  const face = FACE_SHAPES[config.appearance.face] ?? FACE_SHAPES.face_01;
  return { ...build, headW: face.w, headH: face.h, headR: face.r };
}

function colorsFor(config: AvatarConfig): DrawColors {
  const c = config.colors;
  // Skin comes from `appearance.skin`, not from the colour choices: the spec's own
  // config example carries it there ("skin": "skin_05"), and a tone is part of who
  // the character IS rather than a palette slider on a garment.
  const skin = colorOf("skin_primary", skinIndexOf(config.appearance.skin));
  const hair = colorOf("hair_primary", c.hair_primary);
  const fabric = colorOf("fabric_primary", c.fabric_primary);
  return {
    skin,
    skinShade: shade(skin),
    hair,
    hairShade: shade(hair, 0.34),
    fabric,
    fabricShade: shade(fabric),
    fabric2: colorOf("fabric_secondary", c.fabric_secondary),
    metal: colorOf("metal_primary", c.metal_primary),
    accent: colorOf("accent_primary", c.accent_primary),
    ink: INK,
  };
}

// Every id the config references, in the order that decides conflicts. Appearance
// comes first because a haircut is part of who you are, and a hat that fights it is
// the thing that should move.
export function idsOf(config: AvatarConfig): AssetId[] {
  const a = config.appearance;
  const e = config.equipment;
  return [
    a.body,
    a.face,
    a.eyes,
    a.eyebrows,
    a.nose,
    a.mouth,
    a.hair,
    a.facial_hair,
    e.tattoo,
    e.socks,
    e.shoes,
    e.bottom,
    e.top,
    e.jacket,
    e.jewelry,
    e.glasses,
    e.hat,
    e.piercing,
    e.accessory,
    e.prop,
  ].filter((id): id is AssetId => typeof id === "string" && id.length > 0);
}

export function renderAvatar(config: AvatarConfig, registry: Registry): RenderResult {
  const { kept, conflicts } = resolveCompatibility(idsOf(config), registry.meta);

  const body = metricsFor(config);
  const colors = colorsFor(config);
  const y: Record<string, number> = {};
  for (const [key, value] of Object.entries(ANCHORS)) {
    y[key] = key === "centerX" ? value : value + body.lift;
  }
  const ctx: DrawContext = { body, colors, y, cx: ANCHORS.centerX };

  // Collect (layer, markup) pairs, then sort by the fixed order. Collecting first
  // and sorting after is what keeps the asset list order from leaking into z-order.
  const parts: { layer: LayerId; svg: string }[] = [];
  for (const id of kept) {
    const asset = registry.get(id);
    if (!asset) continue;
    const drawn = asset.draw(ctx);
    for (const layer of layerOrder) {
      const markup = drawn[layer];
      if (markup) parts.push({ layer, svg: markup });
    }
  }

  const bodyMarkup = sortLayers(parts)
    .map((p) => p.svg)
    .join("");

  // A stable id per render keeps two avatars on the same page from sharing defs.
  const uid = hash(kept.join("|") + JSON.stringify(config.colors));
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS.w} ${CANVAS.h}" fill="none" role="img">
<defs>
  <clipPath id="dim-${uid}"><rect x="${LIGHT.shadeFromX}" y="0" width="${CANVAS.w - LIGHT.shadeFromX}" height="${CANVAS.h}"/></clipPath>
  <filter id="dark-${uid}"><feColorMatrix type="matrix" values=".70 0 0 0 0  0 .70 0 0 0  0 0 .76 0 0  0 0 0 1 0"/></filter>
  <g id="fig-${uid}">${bodyMarkup}</g>
</defs>
<ellipse cx="${ANCHORS.centerX}" cy="${ANCHORS.sole + 8}" rx="132" ry="20" fill="#000" opacity="0.24"/>
<use href="#fig-${uid}"/>
<use href="#fig-${uid}" clip-path="url(#dim-${uid})" filter="url(#dark-${uid})"/>
</svg>`,
    used: kept,
    conflicts,
  };
}

// Small non-cryptographic hash, only for making defs ids unique per look. Written
// out rather than pulled in so the renderer keeps zero dependencies.
function hash(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}
