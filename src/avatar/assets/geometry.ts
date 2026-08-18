// Where the limbs ARE, computed once.
//
// This module exists because of a bug that was invisible in the code and obvious in
// a contact sheet: the body drew an arm at one x and every sleeve computed its own,
// slightly different x. The sleeves read as shoulder pads floating beside the arm
// they were supposed to cover.
//
// A garment must never re-derive anatomy. It asks here, so a sleeve cannot miss.

import type { BodyMetrics, DrawContext } from "../asset";

export interface Limb {
  x: number;
  y: number;
  w: number;
  h: number;
}

// The gap between the legs. It scales with how wide the garment is, because a fixed
// gap closed up the moment a baggy trouser widened each leg and the two merged into
// one column — which is exactly how the first pass looked.
export const legGap = (grow = 0): number => 16 + grow * 0.5;

export function arm(ctx: DrawContext, side: -1 | 1, grow = 0): Limb {
  const b = ctx.body;
  const w = Math.round(b.legW * 0.7) + grow;
  const inner = b.shoulderW / 2 - 6;
  return {
    x: side === -1 ? ctx.cx - inner - w : ctx.cx + inner,
    y: ctx.y.shoulders - 4,
    w,
    h: ctx.y.waist - ctx.y.shoulders + 96,
  };
}

// The hand sits at the end of the arm, always. Returned as a circle so a sleeve can
// stop short of it and the hand still reads.
export function hand(ctx: DrawContext, side: -1 | 1): { cx: number; cy: number; r: number } {
  const a = arm(ctx, side);
  return { cx: a.x + a.w / 2, cy: a.y + a.h, r: a.w * 0.56 };
}

export function leg(ctx: DrawContext, side: -1 | 1, grow = 0): Limb {
  const b = ctx.body;
  const w = b.legW + grow;
  const gap = legGap(grow);
  return {
    x: side === -1 ? ctx.cx - gap / 2 - w : ctx.cx + gap / 2,
    y: ctx.y.hip - 14,
    w,
    h: ctx.y.ankle - ctx.y.hip + 14,
  };
}

// The torso outline, as a path. Shared so a shirt has the same shoulders as the body
// underneath it and cannot show a sliver of skin at the seam.
export function torsoPath(ctx: DrawContext, grow: number, drop: number): string {
  const b: BodyMetrics = ctx.body;
  const halfS = b.shoulderW / 2 + grow;
  const halfW = b.waistW / 2 + grow;
  const bottom = ctx.y.hip + drop;
  const { cx, y } = ctx;
  return (
    `M${cx - halfS} ${y.shoulders + 24}` +
    `C${cx - halfS} ${y.shoulders - 8} ${cx - halfS + 24} ${y.chin + 6} ${cx} ${y.chin + 6}` +
    `C${cx + halfS - 24} ${y.chin + 6} ${cx + halfS} ${y.shoulders - 8} ${cx + halfS} ${y.shoulders + 24}` +
    `L${cx + halfW} ${bottom}C${cx + halfW} ${bottom + 18} ${cx - halfW} ${bottom + 18} ${cx - halfW} ${bottom}Z`
  );
}
