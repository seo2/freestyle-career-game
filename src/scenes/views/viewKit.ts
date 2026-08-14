// Shared drawing kit for the seven non-base career views, extracted verbatim
// from the former single-file careerViews.ts. Every helper here is used by more
// than one view, or is the view's contract with CareerScene (ViewCtx).
//
// Legacy y-coordinates are alphabetic text baselines; the kit uses top-left
// origin, so every text call subtracts the font size from the legacy y.

import type Phaser from "phaser";
import { palette } from "../../ui/palette";
import { addRect, addText } from "../../ui/kit";
import { drawCharacter, lookOf } from "../../ui/characterDraw";
import { clamp } from "../../utils/math";
import type { CareerGoal, StatKey } from "../../core/types";
import type { GameController } from "../../managers/GameController";

export type Vec2 = readonly [number, number];

export interface ViewCtx {
  scene: Phaser.Scene;
  layer: Phaser.GameObjects.Container;
  controller: GameController;
}

export function rect(ctx: ViewCtx, x: number, y: number, w: number, h: number, color: string, alpha = 1): void {
  if (w <= 0 || h <= 0) return;
  addRect(ctx.scene, ctx.layer, x, y, w, h, color, alpha);
}

// Single line at a legacy baseline y; ellipsized when wider than maxWidth
// (legacy drawTextLine). maxWidth 0 renders unclipped (legacy drawText).
export function line(ctx: ViewCtx, x: number, y: number, content: string, size: number, color: string, maxWidth = 0): void {
  const text = addText(ctx.scene, ctx.layer, x, y - size, content, size, color);
  if (maxWidth <= 0 || text.width <= maxWidth) return;
  let trimmed = content;
  while (trimmed.length > 1 && text.width > maxWidth) {
    trimmed = trimmed.slice(0, -1);
    text.setText(`${trimmed.trimEnd()}...`);
  }
}


const statColors: Record<StatKey, string> = {
  flow: palette.teal,
  punchline: palette.red,
  metrica: palette.blue,
  improvisacion: palette.yellow,
  escena: palette.pink,
  carisma: palette.green,
  disciplina: palette.ink,
};

export function statColor(stat: StatKey): string {
  return statColors[stat];
}


const actionShortLabels: Record<string, string> = {
  practice: "Practicar",
  cypher: "Cypher",
  work: "Trabajar",
  social: "Clip",
  write: "Tema",
  record: "Grabar",
  battle: "Batalla",
  show: "Show",
  rest: "Descansar",
};

export function actionShortLabel(id: string, fallback: string): string {
  return actionShortLabels[id] ?? fallback;
}

const actionAccents: Record<string, string> = {
  practice: palette.teal,
  cypher: palette.yellow,
  work: "#b58b62",
  social: palette.green,
  write: palette.blue,
  record: palette.pink,
  battle: palette.red,
  show: palette.pink,
  rest: "#9aa0ad",
};

export function actionAccent(id: string): string {
  return actionAccents[id] ?? palette.yellow;
}

export function actionIcon(ctx: ViewCtx, id: string, x: number, y: number, color: string): void {
  rect(ctx, x, y, 26, 26, "#0d0f13");
  if (id === "battle") {
    rect(ctx, x + 5, y + 11, 16, 5, color);
    rect(ctx, x + 18, y + 7, 5, 5, palette.ink);
    return;
  }
  if (id === "social") {
    rect(ctx, x + 6, y + 5, 14, 18, color);
    rect(ctx, x + 9, y + 8, 8, 2, palette.ink);
    rect(ctx, x + 9, y + 17, 8, 2, palette.ink);
    return;
  }
  if (id === "write") {
    rect(ctx, x + 5, y + 6, 13, 16, palette.ink);
    rect(ctx, x + 9, y + 10, 13, 4, color);
    return;
  }
  if (id === "rest") {
    rect(ctx, x + 5, y + 14, 16, 6, color);
    rect(ctx, x + 8, y + 9, 6, 5, palette.ink);
    return;
  }
  rect(ctx, x + 6, y + 7, 14, 14, color);
  rect(ctx, x + 10, y + 11, 6, 6, "#0d0f13");
}

// MC figure where the legacy screens drew drawMc(x, y, s): idle sprite with
// feet on the legacy foot line (y + 25*s, ~110px tall at the common scales);
// the compact block placeholder stays as the missing-texture fallback.
// The MC figure inside a panel: real sprite plus a grounding shadow (panels
// have no floor art, so without it the sprite reads as floating).
export function mcFigure(ctx: ViewCtx, x: number, y: number, s: number): void {
  // The MC is composited from his layers now (Fase 10), so the skin tone, the cut
  // and the clothes he actually owns show up on every screen instead of the same
  // flat sprite. The height matches what the old sprite drew at this scale, so no
  // layout moves.
  const feetY = y + 25 * s;
  drawCharacter(ctx.scene, ctx.layer, x, feetY, Math.round(92 * s), lookOf(ctx.controller.state));
}

export function goalRow(ctx: ViewCtx, x: number, y: number, w: number, goal: CareerGoal): void {
  line(ctx, x, y, goal.label, 11, palette.ink, w);
  line(ctx, x, y + 13, goal.detail, 9, palette.muted, w);
  rect(ctx, x, y + 19, w, 6, "#08090c", 0.92);
  rect(ctx, x, y + 19, Math.floor((clamp(goal.value, 0, goal.max) / goal.max) * w), 6, goal.color);
}
