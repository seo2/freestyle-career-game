// Career view 13: stats. Read-only profile and career metrics. Moved verbatim
// out of careerViews.ts.

import { palette } from "../../ui/palette";
import { addMeter, addPanel } from "../../ui/kit";
import { statLabels, trainingStats } from "../../data/stats";
import { line, mcFigure, rect, stageTitle, statColor, viewTitle } from "./viewKit";
import type { ViewCtx } from "./viewKit";

export function renderStats(ctx: ViewCtx): void {
  const state = ctx.controller.state;
  viewTitle(ctx, "13. Estadisticas", "Perfil del artista y metricas de carrera.");
  addPanel(ctx.scene, ctx.layer, 32, 152, 244, 312);
  line(ctx, 112, 184, "Perfil", 16, palette.ink);
  mcFigure(ctx, 154, 316, 1.28);
  line(ctx, 80, 394, state.playerName, 20, palette.yellow, 148);
  line(ctx, 66, 424, `Nivel ${state.level} · ${stageTitle(state.stage)}`, 12, palette.ink, 180);
  addMeter(ctx.scene, ctx.layer, 66, 444, 168, 10, state.xp, state.xpNext, palette.blue);

  addPanel(ctx.scene, ctx.layer, 298, 152, 374, 312);
  line(ctx, 324, 184, "Atributos principales", 16, palette.ink);
  trainingStats.forEach((stat, index) => {
    const y = 208 + index * 33;
    line(ctx, 324, y, statLabels[stat], 12, palette.ink, 112);
    addMeter(ctx.scene, ctx.layer, 452, y - 7, 134, 8, state.stats[stat], 20, statColor(stat));
    line(ctx, 604, y, String(state.stats[stat]), 12, palette.muted, 28);
  });

  addPanel(ctx.scene, ctx.layer, 694, 152, 230, 312);
  line(ctx, 770, 184, "Carrera", 16, palette.ink);
  careerMetric(ctx, "Fans", state.fans, palette.blue, 720, 218);
  careerMetric(ctx, "Respeto", state.respect, palette.pink, 720, 280);
  careerMetric(ctx, "Fama", state.fame, palette.yellow, 720, 342);
  careerMetric(ctx, "Dinero", `$${state.cash}`, palette.green, 720, 404);
}

function careerMetric(ctx: ViewCtx, label: string, value: number | string, color: string, x: number, y: number): void {
  rect(ctx, x, y - 24, 176, 44, "#101735");
  rect(ctx, x, y - 24, 4, 44, color);
  line(ctx, x + 16, y - 4, label, 12, palette.muted, 90);
  line(ctx, x + 112, y - 4, String(value), 13, color, 54);
}
