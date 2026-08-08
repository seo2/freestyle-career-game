// Career view 5: stage progress map. The isometric city is still a block
// placeholder (docs/ASSETS.md > Pendientes). Moved verbatim out of
// careerViews.ts.

import { palette } from "../../ui/palette";
import { addPanel, addSoftPanel } from "../../ui/kit";
import { stages } from "../../data/stages";
import { currentStage, stageIndex } from "../../core/derived";
import { getCareerGoals } from "../../systems/ProgressionSystem";
import { goalRow, line, rect, viewTitle } from "./viewKit";
import type { Vec2, ViewCtx } from "./viewKit";

export function renderMap(ctx: ViewCtx): void {
  const state = ctx.controller.state;
  viewTitle(ctx, "5. Mapa (progreso)", currentStage(state).nextHint);
  addPanel(ctx.scene, ctx.layer, 36, 146, 888, 266);
  cityMap(ctx, 54, 164, 852, 230);
  // One node per career stage (stages.length entries, pieza -> leyenda).
  const points: Vec2[] = [
    [120, 312],
    [252, 240],
    [386, 320],
    [512, 228],
    [644, 302],
    [762, 210],
    [858, 296],
  ];
  const idx = stageIndex(state);
  points.forEach((point, index) => {
    if (index === 0) return;
    dottedLine(ctx, points[index - 1], point, index <= idx ? palette.yellow : "#5b628c");
  });
  stages.forEach((stage, index) => {
    const [x, y] = points[index];
    const open = index <= idx;
    const next = index === idx + 1;
    const color = open ? palette.yellow : next ? palette.teal : "#5a5f74";
    rect(ctx, x - 22, y - 10, 44, 20, "#000000", 0.4);
    rect(ctx, x - 14, y - 16, 28, 28, color);
    rect(ctx, x - 8, y - 10, 16, 16, "#10142b");
    line(ctx, x - 44, y - 24, stage.title, 13, open ? palette.ink : "#8a8fa5", 88);
    if (!open && !next) line(ctx, x - 18, y + 28, "LOCK", 9, palette.red);
    if (stage.id === state.stage) line(ctx, x - 24, y + 42, "ACTUAL", 9, palette.green);
  });
  addSoftPanel(ctx.scene, ctx.layer, 38, 426, 884, 46);
  const goal = getCareerGoals(state)[0];
  line(ctx, 64, 454, `Nivel ${state.level} · ${goal.label}`, 14, palette.ink, 300);
  goalRow(ctx, 386, 438, 300, goal);
  line(ctx, 714, 454, `Fans ${state.fans} · Resp ${state.respect} · Fama ${state.fame}`, 11, palette.muted, 178);
}

function cityMap(ctx: ViewCtx, x: number, y: number, w: number, h: number): void {
  rect(ctx, x, y, w, h, "#111a33");
  for (let i = 0; i < 22; i += 1) {
    const bx = x + 16 + ((i * 73) % (w - 60));
    const by = y + 34 + ((i * 47) % (h - 86));
    const bw = 28 + (i % 3) * 14;
    const bh = 28 + (i % 4) * 9;
    rect(ctx, bx, by, bw, bh, i % 2 === 0 ? "#172343" : "#1b2a4d");
    for (let win = 0; win < 4; win += 1) {
      rect(ctx, bx + 7 + win * 10, by + 8 + ((i + win) % 3) * 8, 4, 5, "#d8b653");
    }
  }
  for (let road = 0; road < 5; road += 1) {
    // Legacy drew slightly slanted strokes; approximated with thin rects.
    const yMid = Math.round((y + 42 + road * 42 + (y + 26 + road * 37)) / 2);
    rect(ctx, x, yMid, w, 2, "#f3f2e9", 0.12);
  }
}

function dottedLine(ctx: ViewCtx, a: Vec2, b: Vec2, color: string): void {
  const steps = 18;
  for (let i = 0; i <= steps; i += 2) {
    const t = i / steps;
    rect(ctx, a[0] + (b[0] - a[0]) * t - 3, a[1] + (b[1] - a[1]) * t - 3, 6, 6, color);
  }
}
