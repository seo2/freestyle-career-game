// Career view 8: work. Presentation only; forwards pointer clicks to controller
// commands. Warehouse crates are still block placeholders (docs/ASSETS.md >
// Pendientes). Moved verbatim out of careerViews.ts.

import { palette } from "../../ui/palette";
import { addButton, addHitZone, addPanel, addSoftPanel } from "../../ui/kit";
import { jobOptions } from "../../data/jobs";
import { formatDuration } from "../../systems/CalendarSystem";
import type { JobOption } from "../../core/types";
import { line, mcFigure, rect, viewTitle } from "./viewKit";
import type { ViewCtx } from "./viewKit";

export function renderWork(ctx: ViewCtx): void {
  const state = ctx.controller.state;
  viewTitle(ctx, "8. Trabajo", "Gana dinero para invertir en tu carrera.");
  line(ctx, 610, 118, `Dinero actual: $${state.cash}`, 16, palette.green, 220);
  addPanel(ctx.scene, ctx.layer, 36, 150, 490, 258);
  jobOptions.forEach((option, index) => jobRow(ctx, option, index, 60, 176 + index * 52, 438));
  addPanel(ctx.scene, ctx.layer, 550, 150, 374, 258);
  warehouseScene(ctx, 580, 174, 314, 186);
  addSoftPanel(ctx.scene, ctx.layer, 38, 426, 884, 46);
  line(ctx, 64, 454, "Trabajar da caja, pero baja energia e impulso si abusas.", 13, palette.ink, 700);
}

function jobRow(ctx: ViewCtx, option: JobOption, index: number, x: number, y: number, w: number): void {
  const { controller } = ctx;
  const disabled = controller.state.energy < option.energy;
  rect(ctx, x + 3, y + 3, w, 42, "#000000", 0.26);
  rect(ctx, x, y, w, 42, "#101735");
  rect(ctx, x, y, 4, 42, palette.green);
  if (!disabled) {
    addHitZone(ctx.scene, ctx.layer, x, y, w, 42, () => controller.performJob(option));
  }
  line(ctx, x + 16, y + 26, `${index + 1}. ${option.label}`, 14, disabled ? "#7d8295" : palette.ink, 190);
  line(ctx, x + 260, y + 26, `$${option.cash}`, 14, palette.green, 54);
  line(ctx, x + 330, y + 26, formatDuration(option.blocks), 11, palette.yellow, 34);
  addButton(ctx.scene, ctx.layer, x + w - 42, y + 8, 28, 24, "+", () => controller.performJob(option), {
    fill: "#202955",
    size: 13,
    disabled,
  });
}

function warehouseScene(ctx: ViewCtx, x: number, y: number, w: number, h: number): void {
  // Legacy sketched crates + the pixel MC; a flat panel plus the compact
  // placeholder holds the composition until real sprites land (Fase 3).
  rect(ctx, x, y, w, h, "#323948");
  mcFigure(ctx, x + 170, y + 156, 1.05);
  line(ctx, x + 164, y + 36, "Enfoque + disciplina", 13, palette.ink, 130);
}
