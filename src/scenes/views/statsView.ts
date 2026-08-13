// Career view 13: estadisticas, rebuilt against its mockup (Fase 4).
//
// Mockup: reference/screens "ChatGPT Image 15 jun 2026, 06_25_08 a.m. (3).png"
// (1672x941). Every measured value below is the mockup pixel times
// 960/1672 = 0.574, and the comments keep the mockup number. Measured geometry:
// three columns 41..457 / 477..1157 / 1174..1652 spanning 69..837, attribute
// rows with pitch 89, career-metric cards with pitch 117, and a full-width
// footer bar at 850..920 whose right end is the [ESC] VOLVER chip.
//
// Deliberate deviations from the mockup:
//  * The mockup's 8th attribute ("salud mental") is not a trainable stat here,
//    so the middle column lists the seven real ones.
//  * The mockup's per-attribute "NIVEL 3 / 65 of 100" implies a per-level point
//    tier we do not model: a stat is a single 1..99 number, so the value runs
//    against ProgressionConfig.statBounds.max.
//  * The left column's flavour quote and the right column's invented
//    "RESUMEN GENERAL" score become real data: the current stage card and the
//    live career goals from ProgressionSystem.
//  * The map screen became a places hub, so the seven-stage ladder
//    (pieza -> leyenda) lives in this screen's footer bar, next to the mockup's
//    own [ESC] VOLVER chip.
//
// Read-only screen: nothing here mutates state, and the only command it sends
// is setCareerView("base") from the back chip.

import { DilemmaConfig } from "../../data/config/DilemmaConfig";
import { axisLean, identitySummary, recentDecisions } from "../../systems/DilemmaSystem";
import type { IdentityAxis } from "../../core/types";
import { AssetRegistry, stageBackdropKey } from "../../game/AssetRegistry";
import { palette } from "../../ui/palette";
import { addDisplayText, addHitZone, addMeter, addPanel, addSpriteImage, addText } from "../../ui/kit";
import { statLabels, trainingStats } from "../../data/stats";
import { stages } from "../../data/stages";
import { ProgressionConfig } from "../../data/config/ProgressionConfig";
import { currentStage, recordCost, stageIndex } from "../../core/derived";
import { getCareerGoals } from "../../systems/ProgressionSystem";
import { clamp } from "../../utils/math";
import type { CareerGoal, StatKey } from "../../core/types";
import { line, mcFigure, rect, statColor } from "./viewKit";
import type { ViewCtx } from "./viewKit";

// Screen chrome shared by the Fase 4 sub-views. Duplicated per view file on
// purpose: views/viewKit.ts is edited by the other Fase 4 screens in parallel,
// so nothing new lands there this pass (consolidation is a follow-up).
const TITLE = { x: 28, y: 92, size: 26 } as const;

const LEFT = { x: 26, y: 124, w: 238, h: 354 } as const; // mockup 41..457 x 69..837
const MID = { x: 272, y: 124, w: 390, h: 354 } as const; // mockup 477..1157
const RIGHT = { x: 670, y: 124, w: 264, h: 274 } as const; // mockup 1174..1652 x 69..644
const GOALS = { x: 670, y: 404, w: 264, h: 74 } as const; // mockup 1174..1652 x 648..837
const FOOTER = { x: 26, y: 486, w: 908, h: 40 } as const; // mockup 26..1646 x 850..920
// Identity panel (Fase 7): no mockup carries it, so it takes the free band under
// the profile column, where the eye already goes for "who is this MC".
const IDENTITY = { x: 26, y: 300, w: 248, h: 178, pitch: 30, firstDy: 32 } as const;

// Attribute rows: mockup pitch 89 / height ~86, scaled for seven rows.
const ROW = {
  x: 284,
  y0: 168,
  w: 366,
  h: 40,
  pitch: 44,
  iconBox: 34,
  labelX: 48,
  meterW: 200,
  valueX: 262,
} as const;

// Career-metric cards: mockup pitch 117 / height 116.
const METRIC = { x: 682, y0: 166, w: 240, h: 54, pitch: 58 } as const;

const CARD = {
  border: "#272c61",
  fill: "#070e35",
  iconBorder: "#6f7488",
  iconFill: "#0b0d14",
  track: "#0d0f13",
  tick: "#242a52",
  dim: "#6a6f85",
} as const;

// Same icon mapping as the training screen; the mockup's own per-stat art
// (books, spotlight, brain) is still a pending asset (docs/ASSETS.md).
const statIconKeys: Record<StatKey, string> = {
  flow: AssetRegistry.icons.battleFlow.key,
  punchline: AssetRegistry.icons.battlePunchline.key,
  metrica: AssetRegistry.icons.battleMetrica.key,
  improvisacion: AssetRegistry.icons.battleRespuesta.key,
  escena: AssetRegistry.icons.resFans.key,
  carisma: AssetRegistry.icons.battleHumor.key,
  disciplina: AssetRegistry.icons.actionTrain.key,
};

export function renderStats(ctx: ViewCtx): void {
  addDisplayText(ctx.scene, ctx.layer, TITLE.x, TITLE.y, "13. ESTADISTICAS", TITLE.size, palette.ink);

  addPanel(ctx.scene, ctx.layer, LEFT.x, LEFT.y, LEFT.w, LEFT.h, "#0a1030");
  profileColumn(ctx);

  addPanel(ctx.scene, ctx.layer, MID.x, MID.y, MID.w, MID.h, "#0a1030");
  columnHeader(ctx, ROW.x, 134, ROW.w, "ATRIBUTOS PRINCIPALES");
  trainingStats.forEach((stat, index) => attributeRow(ctx, stat, index));

  addPanel(ctx.scene, ctx.layer, RIGHT.x, RIGHT.y, RIGHT.w, RIGHT.h, "#0a1030");
  careerColumn(ctx);

  addPanel(ctx.scene, ctx.layer, GOALS.x, GOALS.y, GOALS.w, GOALS.h, "#0a1030");
  goalsColumn(ctx);

  identityColumn(ctx);

  footerBar(ctx);
}

function columnHeader(ctx: ViewCtx, x: number, y: number, w: number, label: string): void {
  rect(ctx, x, y, w, 26, "#050a20");
  rect(ctx, x, y, w, 1, palette.line);
  rect(ctx, x, y + 25, w, 1, CARD.border);
  const text = addText(ctx.scene, ctx.layer, 0, 0, label, 11, palette.muted);
  text.setOrigin(0.5, 0.5).setPosition(x + w / 2, y + 13);
}

// --- Left column: portrait, identity, career level, current stage -----------

function profileColumn(ctx: ViewCtx): void {
  const state = ctx.controller.state;
  const stage = currentStage(state);
  columnHeader(ctx, 38, 134, 214, "PERFIL DEL ARTISTA");

  // Portrait well: the stage art of wherever the career is right now, with the
  // MC standing on it (mockup shows the same city-night framing).
  rect(ctx, 38, 164, 214, 134, CARD.border);
  rect(ctx, 40, 166, 210, 130, "#04061a");
  coverImage(ctx, stageBackdropKey(state.stage), 40, 166, 210, 130);
  mcFigure(ctx, 145, 262, 1.15);

  rect(ctx, 38, 304, 214, 44, CARD.fill);
  rect(ctx, 38, 304, 214, 1, CARD.border);
  const name = addText(ctx.scene, ctx.layer, 0, 0, state.playerName, 19, palette.yellow);
  name.setOrigin(0.5, 0.5).setPosition(145, 319);
  const nickname = addText(ctx.scene, ctx.layer, 0, 0, state.nickname, 9, palette.muted);
  nickname.setOrigin(0.5, 0.5).setPosition(145, 338);

  rect(ctx, 38, 354, 214, 56, CARD.fill);
  rect(ctx, 38, 354, 214, 1, CARD.border);
  line(ctx, 48, 371, "NIVEL DE CARRERA", 9, palette.muted, 190);
  rect(ctx, 48, 376, 32, 26, palette.yellow);
  rect(ctx, 50, 378, 28, 22, "#0b0f28");
  const level = addText(ctx.scene, ctx.layer, 0, 0, String(state.level), 15, palette.yellow);
  level.setOrigin(0.5, 0.5).setPosition(64, 389);
  addMeter(ctx.scene, ctx.layer, 88, 378, 154, 10, state.xp, state.xpNext, palette.blue);
  line(ctx, 88, 402, `${state.xp} / ${state.xpNext} XP`, 9, palette.muted, 154);

  rect(ctx, 38, 416, 214, 54, CARD.fill);
  rect(ctx, 38, 416, 214, 1, CARD.border);
  line(ctx, 48, 433, "ETAPA ACTUAL", 9, palette.muted, 190);
  line(ctx, 48, 452, stage.title.toUpperCase(), 14, palette.teal, 194);
  line(ctx, 48, 466, stage.place, 9, palette.muted, 194);
}

// --- Middle column: the seven trainable attributes ---------------------------

function attributeRow(ctx: ViewCtx, stat: StatKey, index: number): void {
  const value = ctx.controller.state.stats[stat];
  const max = ProgressionConfig.statBounds.max;
  const y = ROW.y0 + index * ROW.pitch;
  const accent = statColor(stat);

  rect(ctx, ROW.x, y, ROW.w, ROW.h, CARD.border);
  rect(ctx, ROW.x + 2, y + 2, ROW.w - 4, ROW.h - 4, CARD.fill);
  rect(ctx, ROW.x, y, 3, ROW.h, accent);

  const box = ROW.iconBox;
  rect(ctx, ROW.x + 6, y + 3, box, box, CARD.iconBorder);
  rect(ctx, ROW.x + 8, y + 5, box - 4, box - 4, CARD.iconFill);
  if (
    !addSpriteImage(
      ctx.scene,
      ctx.layer,
      statIconKeys[stat],
      ROW.x + 6 + box / 2,
      y + 3 + box / 2,
      box - 10,
      0.5,
      0.5,
      box - 8,
    )
  ) {
    rect(ctx, ROW.x + 15, y + 12, box - 18, box - 18, accent);
  }

  line(ctx, ROW.x + ROW.labelX, y + 18, statLabels[stat].toUpperCase(), 14, palette.ink, 200);
  statMeter(ctx, ROW.x + ROW.labelX, y + 22, ROW.meterW, value, max, accent);
  line(ctx, ROW.x + ROW.valueX, y + 18, `NIVEL ${value}`, 13, palette.ink, 98);
  line(ctx, ROW.x + ROW.valueX, y + 33, `${value} / ${max}`, 9, accent, 98);
}

// Level meter with a graduated track: early-career stats fill a few percent of
// the 1..99 range, and without the ticks plus the bright fill cap a low value
// reads as a broken bar instead of "a long way to go".
function statMeter(
  ctx: ViewCtx,
  x: number,
  y: number,
  w: number,
  value: number,
  max: number,
  color: string,
): void {
  const h = 12;
  rect(ctx, x, y, w, h, CARD.track);
  for (let i = 1; i < 5; i += 1) rect(ctx, x + Math.floor((w * i) / 5), y + 1, 1, h - 2, CARD.tick);
  const fill = Math.max(5, Math.floor(((w - 2) * clamp(value, 0, max)) / max));
  rect(ctx, x + 1, y + 1, fill, h - 2, color);
  rect(ctx, x + fill - 1, y, 2, h, palette.ink);
}

// Backdrop art scaled to cover a box and cropped to it, so the portrait reads as
// full-bleed instead of a letterboxed thumbnail (addSpriteImage alone only ever
// contains).
function coverImage(ctx: ViewCtx, key: string, x: number, y: number, w: number, h: number): void {
  const image = addSpriteImage(ctx.scene, ctx.layer, key, x + w / 2, y + h / 2, h, 0.5, 0.5);
  if (!image || image.width <= 0 || image.height <= 0) return;
  const scale = Math.max(w / image.width, h / image.height);
  image.setScale(scale);
  image.setCrop((image.width - w / scale) / 2, (image.height - h / scale) / 2, w / scale, h / scale);
}

// --- Right column: career metrics --------------------------------------------

function careerColumn(ctx: ViewCtx): void {
  const state = ctx.controller.state;
  const next = stages[stageIndex(state) + 1];
  columnHeader(ctx, METRIC.x, 134, METRIC.w, "METRICAS DE CARRERA");
  const goal = (min: number): string => {
    if (!next) return "ETAPA MAXIMA";
    return min > 0 ? `META ${next.title.toUpperCase()}: ${min}` : "SIN REQUISITO";
  };
  metricCard(
    ctx,
    0,
    "FANS",
    String(state.fans),
    goal(next?.minFans ?? 0),
    palette.blue,
    AssetRegistry.icons.resFans.key,
  );
  metricCard(
    ctx,
    1,
    "RESPETO",
    String(state.respect),
    goal(next?.minRespect ?? 0),
    "#7b63cc",
    AssetRegistry.icons.resRespect.key,
  );
  metricCard(ctx, 2, "FAMA", String(state.fame), goal(next?.minFame ?? 0), palette.yellow, null);
  metricCard(
    ctx,
    3,
    "DINERO",
    `$${state.cash}`,
    `ESTUDIO: $${recordCost(state)}`,
    palette.green,
    AssetRegistry.icons.resCash.key,
  );
}

function metricCard(
  ctx: ViewCtx,
  index: number,
  label: string,
  value: string,
  hint: string,
  color: string,
  iconKey: string | null,
): void {
  const { x, w, h } = METRIC;
  const y = METRIC.y0 + index * METRIC.pitch;
  rect(ctx, x, y, w, h, CARD.border);
  rect(ctx, x + 2, y + 2, w - 4, h - 4, CARD.fill);
  rect(ctx, x, y, 3, h, color);

  if (iconKey) addSpriteImage(ctx.scene, ctx.layer, iconKey, x + 26, y + 25, 28, 0.5, 0.5, 32);
  else fameGlyph(ctx, x + 26, y + 25, color);

  line(ctx, x + 50, y + 16, label, 10, palette.muted, 140);
  line(ctx, x + 50, y + 35, value, 16, color, 140);
  line(ctx, x + 50, y + 49, hint, 9, palette.muted, 150);

  // Mockup sparkline: three rising bars, a decorative rhythm mark.
  [9, 14, 19].forEach((barH, i) =>
    rect(ctx, x + w - 36 + i * 11, y + 36 - barH, 8, barH, color, 0.45 + i * 0.2),
  );
}

// --- Right column bottom: live career goals ----------------------------------

function goalsColumn(ctx: ViewCtx): void {
  line(ctx, GOALS.x + 12, 421, "OBJETIVOS", 10, palette.muted, 200);
  // ProgressionSystem returns exactly two goals; slicing keeps the block safe
  // if a third is ever added.
  getCareerGoals(ctx.controller.state)
    .slice(0, 2)
    .forEach((goal, index) => compactGoal(ctx, GOALS.x + 12, 439 + index * 26, GOALS.w - 24, goal));
}

// Tighter than viewKit's goalRow: label and detail share one line so two goals
// fit the mockup's bottom-right block without touching.
function compactGoal(ctx: ViewCtx, x: number, y: number, w: number, goal: CareerGoal): void {
  line(ctx, x, y, goal.label, 11, palette.ink, 112);
  line(ctx, x + 116, y, goal.detail, 9, palette.muted, w - 116);
  rect(ctx, x, y + 5, w, 7, CARD.track);
  const fill = Math.floor(((w - 2) * clamp(goal.value, 0, goal.max)) / goal.max);
  if (fill > 0) rect(ctx, x + 1, y + 6, fill, 5, goal.color);
}

// --- Footer: the seven-stage ladder plus the back chip -----------------------

// The stage ladder used to live on the map screen; the Fase 4 map became a
// places hub, so this is the only place the pieza -> leyenda run is visible.
// Identity (Fase 7): the four axes of the GDD and the last decisions that moved
// them. An MC who has decided nothing shows nothing — "mismo origen" means the
// label is earned, not assigned.
function identityColumn(ctx: ViewCtx): void {
  const state = ctx.controller.state;
  const x = IDENTITY.x;
  rect(ctx, x, IDENTITY.y, IDENTITY.w, IDENTITY.h, "#0a1030");
  columnHeader(ctx, x, IDENTITY.y, IDENTITY.w, "QUIEN VAS SIENDO");

  const axes: IdentityAxis[] = ["undergroundComercial", "batalleroMusico", "soloCrew", "autenticoPolemico"];
  axes.forEach((axis, index) => {
    const y = IDENTITY.y + IDENTITY.firstDy + index * IDENTITY.pitch;
    const labels = DilemmaConfig.axes.labels[axis];
    const value = state.axes[axis];
    line(ctx, x + 10, y, labels.low.toUpperCase(), 9, palette.muted, IDENTITY.w / 2 - 12);
    const highText = addText(ctx.scene, ctx.layer, 0, y - 9, labels.high.toUpperCase(), 9, palette.muted);
    highText.setX(Math.round(x + IDENTITY.w - 14 - highText.width));

    // A slider: the needle sits where the decisions put it, centre = undecided.
    const trackY = y + 6;
    rect(ctx, x + 10, trackY, IDENTITY.w - 20, 6, "#050a20");
    rect(ctx, x + 10 + (IDENTITY.w - 20) / 2, trackY, 1, 6, CARD.border);
    const span = (IDENTITY.w - 24) / 2;
    const needleX = Math.round(x + 12 + span + (value / DilemmaConfig.axes.max) * span);
    const lean = axisLean(state.axes, axis);
    rect(ctx, needleX - 2, trackY - 2, 5, 10, lean.label === "Sin definir" ? CARD.border : palette.yellow);
  });

  // The sliders already show all four axes, so the line names only the two
  // strongest leans — four of them just truncated.
  // Names only, no numbers: the sliders already show how far each lean went, and
  // four labelled values simply truncated.
  const summary = identitySummary(state)
    .map((entry) => ({ label: entry.replace(/\s*\([^)]*\)/, ""), value: Math.abs(Number(entry.replace(/[^-\d]/g, ""))) }))
    .sort((a, b) => b.value - a.value);
  const strongest = summary.slice(0, 2).map((entry) => entry.label);
  line(
    ctx,
    x + 10,
    IDENTITY.y + IDENTITY.h - 26,
    strongest.length > 0 ? strongest.join(" · ") : "Sin definir: todavia no decidiste nada grande.",
    10,
    strongest.length > 0 ? palette.teal : palette.muted,
    IDENTITY.w - 20,
  );
  const last = recentDecisions(state, 1)[0];
  line(
    ctx,
    x + 10,
    IDENTITY.y + IDENTITY.h - 10,
    last ? `Ultima: ${last.choice} (sem ${last.week})` : "Sin decisiones registradas.",
    10,
    palette.muted,
    IDENTITY.w - 20,
  );
}

function footerBar(ctx: ViewCtx): void {
  const current = stageIndex(ctx.controller.state);
  rect(ctx, FOOTER.x, FOOTER.y, FOOTER.w, FOOTER.h, "#050a20");
  rect(ctx, FOOTER.x, FOOTER.y, FOOTER.w, 1, palette.line);
  rect(ctx, FOOTER.x, FOOTER.y + FOOTER.h - 1, FOOTER.w, 1, CARD.border);

  const chipW = 100;
  const gap = 6;
  stages.forEach((stage, index) => {
    const x = 38 + index * (chipW + gap);
    const reached = index <= current;
    const active = index === current;
    rect(ctx, x, 493, chipW, 26, active ? palette.yellow : reached ? palette.teal : "#1a2048");
    rect(ctx, x + 2, 495, chipW - 4, 22, active ? "#2b2410" : "#070e35");
    const label = addText(
      ctx.scene,
      ctx.layer,
      0,
      0,
      stage.title.toUpperCase(),
      10,
      active ? palette.yellow : reached ? palette.ink : CARD.dim,
    );
    label.setOrigin(0.5, 0.5).setPosition(x + chipW / 2, 506);
    if (index < stages.length - 1) rect(ctx, x + chipW, 505, gap, 2, reached ? palette.teal : "#1a2048");
  });

  backChip(ctx, 790, 493, 128, 26);
}

// Visible, clickable way back (the mockup's own [ESC] VOLVER chip). The Fase 4
// room dropped the persistent nav bar, so without this a mouse-only player
// could not leave the screen at all.
function backChip(ctx: ViewCtx, x: number, y: number, w: number, h: number): void {
  rect(ctx, x, y, w, h, palette.borderHi);
  rect(ctx, x + 2, y + 2, w - 4, h - 4, "#2a3480");
  rect(ctx, x + 8, y + 6, 36, h - 12, "#0a0f26");
  const esc = addText(ctx.scene, ctx.layer, 0, 0, "ESC", 9, palette.muted);
  esc.setOrigin(0.5, 0.5).setPosition(x + 26, y + h / 2);
  const label = addText(ctx.scene, ctx.layer, 0, 0, "VOLVER", 13, palette.ink);
  label.setOrigin(0.5, 0.5).setPosition(x + 84, y + h / 2);
  addHitZone(ctx.scene, ctx.layer, x, y, w, h, () => ctx.controller.setCareerView("base"));
}

// No star icon has been cut yet (docs/ASSETS.md), so fame is marked with a
// plump four-point pixel star composed from kit rects.
function fameGlyph(ctx: ViewCtx, cx: number, cy: number, color: string): void {
  rect(ctx, cx - 2, cy - 11, 4, 22, color);
  rect(ctx, cx - 11, cy - 2, 22, 4, color);
  rect(ctx, cx - 5, cy - 7, 10, 14, color);
  rect(ctx, cx - 7, cy - 5, 14, 10, color);
}
