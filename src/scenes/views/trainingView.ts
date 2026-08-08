// Career view 6: training. Presentation only; forwards pointer clicks to
// controller commands. Moved verbatim out of careerViews.ts.

import { palette } from "../../ui/palette";
import { addButton, addHitZone, addMeter, addPanel } from "../../ui/kit";
import { statLabels, trainingStats } from "../../data/stats";
import type { StatKey } from "../../core/types";
import { line, mcFigure, rect, statColor, viewTitle } from "./viewKit";
import type { ViewCtx } from "./viewKit";

export function renderTraining(ctx: ViewCtx): void {
  viewTitle(ctx, "6. Entrenamiento", "Sube atributos concretos consumiendo un bloque y energia.");
  addPanel(ctx.scene, ctx.layer, 36, 150, 580, 310);
  trainingStats.forEach((stat, index) => trainingRow(ctx, stat, index, 60, 176 + index * 39, 526));
  addPanel(ctx.scene, ctx.layer, 638, 150, 286, 310);
  line(ctx, 690, 196, "Entrenar cada dia", 18, palette.ink);
  line(ctx, 718, 226, "te hace mejor.", 18, palette.ink);
  mcFigure(ctx, 780, 342, 1.2);
  line(ctx, 680, 424, "1-7 entrena una stat", 12, palette.muted, 210);
}

function trainingRow(ctx: ViewCtx, stat: StatKey, index: number, x: number, y: number, w: number): void {
  const { controller } = ctx;
  const state = controller.state;
  const value = state.stats[stat];
  const disabled = state.energy < 14;
  rect(ctx, x + 3, y + 3, w, 32, "#000000", 0.26);
  rect(ctx, x, y, w, 32, "#101735");
  rect(ctx, x, y, 4, 32, statColor(stat));
  if (!disabled) {
    addHitZone(ctx.scene, ctx.layer, x, y, w, 32, () => controller.trainSpecificStat(stat));
  }
  line(ctx, x + 18, y + 21, `${index + 1}. ${statLabels[stat]}`, 13, palette.ink, 132);
  addMeter(ctx.scene, ctx.layer, x + 166, y + 13, 210, 8, value, 20, statColor(stat));
  line(ctx, x + 392, y + 21, `Nivel ${value}`, 12, palette.muted, 70);
  addButton(ctx.scene, ctx.layer, x + w - 42, y + 5, 28, 22, "+", () => controller.trainSpecificStat(stat), {
    fill: "#202955",
    size: 13,
    disabled,
  });
}
