// Shape helpers shared by every asset.
//
// These exist so an asset reads as a description of a garment instead of a wall of
// path data, and so the stroke weight is decided in ONE place. The spec (§4.2) asks
// for "clean shapes, controlled outlines, solid colors, strong silhouettes"; the
// outline weight is what makes that consistent across fifty assets authored at
// different times.

import { INK } from "../palettes";

// 6 against an 800-tall canvas. At the barbershop's 240px that lands near 1.8px,
// and at the HUD's 46px it disappears — which is correct: the flat shapes carry the
// silhouette on their own once the outline is sub-pixel.
export const STROKE = 6;

const attrs = (fill: string, outline: boolean): string =>
  `fill="${fill}"${outline ? ` stroke="${INK}" stroke-width="${STROKE}" stroke-linejoin="round"` : ""}`;

export const rect = (
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string,
  outline = true,
): string => `<rect x="${r2(x)}" y="${r2(y)}" width="${r2(w)}" height="${r2(h)}" rx="${r2(r)}" ${attrs(fill, outline)}/>`;

export const ellipse = (cx: number, cy: number, rx: number, ry: number, fill: string, outline = true): string =>
  `<ellipse cx="${r2(cx)}" cy="${r2(cy)}" rx="${r2(rx)}" ry="${r2(ry)}" ${attrs(fill, outline)}/>`;

export const path = (d: string, fill: string, outline = true): string => `<path d="${d}" ${attrs(fill, outline)}/>`;

export const line = (d: string, stroke: string, width: number): string =>
  `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${r2(width)}" stroke-linecap="round"/>`;

// A capsule between two points: arms, legs, braids, chains. Written as a rounded
// rect when vertical, which is the common case and keeps the markup small.
export const limb = (x: number, y: number, w: number, h: number, fill: string, outline = true): string =>
  rect(x, y, w, h, w / 2, fill, outline);

// Head box driven by the face shape's radius string. SVG `rx` cannot express
// "50%" or per-corner radii, so a shape that needs them is emitted as a path.
export function headShape(x: number, y: number, w: number, h: number, radius: string, fill: string): string {
  if (radius.endsWith("%")) {
    const pct = Number.parseFloat(radius) / 100;
    return ellipse(x + w / 2, y + h / 2, (w / 2) * (pct * 2 > 1 ? 1 : pct * 2), h / 2, fill);
  }
  // Uniform or per-corner pixel radii: let CSS-ish shorthand degrade to the first
  // value, which is what the design's own head boxes did.
  const first = Number.parseFloat(radius) || w * 0.28;
  return rect(x, y, w, h, Math.min(first, w / 2, h / 2), fill);
}

const r2 = (n: number): number => Math.round(n * 100) / 100;
