// Career view 6: entrenamiento, rebuilt against its mockup (Fase 4).
//
// Mockup: reference/screens "ChatGPT Image 15 jun 2026, 06_23_15 a.m. (6).png"
// (1672x941). Every measured value below is the mockup pixel times
// 960/1672 = 0.574, and the comments keep the mockup number. Measured geometry:
// left panel 41..1065 x 105..867, availability strip 76..1029 x 129..208, one
// row per stat at 76..1021 with pitch 111 and height 88 (icon box 84 square at
// +13, name at +145, meter 146..625, NIVEL at +705, + button at +866), right
// column 1090..1624 with the coach bubble on top, the MC below and a big button
// at 1133..1580 x 705..805.
//
// Deliberate deviations from the mockup:
//  * The mockup shows 5 rows and a "PUNTOS DISPONIBLES" counter; we have 7
//    trainable stats and no skill-point currency, so the pitch is tightened to
//    fit all seven and the strip shows the real gate (energy left).
//  * The mockup's bar is a per-level fill under a separate "NIVEL 3"; a stat
//    here is one 1..99 number, so the bar runs against
//    ProgressionConfig.statBounds.max and the exact value is printed next to it.
//  * The mockup's big button reads ENTRENAR, but training has no target until a
//    stat is picked (each row is the real command). That slot carries the exit
//    instead: with the Fase 4 nav bar gone it is the only on-screen way back,
//    and a mouse-only player would otherwise be trapped.
//
// Presentation only: every click forwards a GameController command and every
// number is read from state or from a config file (AGENTS.md).

import { AssetRegistry, stageBackdropKey } from "../../game/AssetRegistry";
import { palette } from "../../ui/palette";
import { addDisplayText, addHitZone, addPanel, addSoftPanel, addSpriteImage, addText } from "../../ui/kit";
import { statLabels, trainingStats } from "../../data/stats";
import { ProgressionConfig } from "../../data/config/ProgressionConfig";
import { TrainingConfig } from "../../data/config/TrainingConfig";
import { formatDuration } from "../../systems/CalendarSystem";
import { clamp } from "../../utils/math";
import type { StatKey } from "../../core/types";
import { line, mcFigure, rect, statColor } from "./viewKit";
import type { ViewCtx } from "./viewKit";

// Screen chrome shared by the Fase 4 sub-views. Duplicated per view file on
// purpose: views/viewKit.ts is edited by the other Fase 4 screens in parallel,
// so nothing new lands there this pass (consolidation is a follow-up).
const TITLE = { x: 28, y: 92, size: 26 } as const;

const LEFT = { x: 26, y: 124, w: 590, h: 376 } as const; // mockup 41..1065 x 105..867
const RIGHT = { x: 628, y: 124, w: 306, h: 376 } as const; // mockup 1090..1624

// Availability strip in the mockup's "PUNTOS DISPONIBLES" slot (76..1029).
const STRIP = { x: 44, y: 134, w: 554, h: 34 } as const;

// Rows: mockup pitch 111 / height 88 for five rows; seven need a tighter pitch.
const ROW = {
  x: 44,
  y0: 176,
  w: 554,
  h: 40,
  pitch: 46,
  iconBox: 34, // mockup 84 square, capped by the tighter row
  labelX: 50, // mockup +145, pulled in with the smaller icon box
  meterW: 250, // mockup meter spans 0.506 of the row
  levelX: 398, // mockup +705
  plusX: 508, // mockup +866
  plusW: 36,
} as const;

// Row colours sampled from the mockup rows (border #272c61 over fill #070e35).
const ROW_COLORS = {
  border: "#272c61",
  fill: "#070e35",
  borderDim: "#141838",
  fillDim: "#05081c",
  iconBorder: "#6f7488",
  iconFill: "#0b0d14",
  textDim: "#6a6f85",
  track: "#0d0f13",
  tick: "#242a52",
} as const;

// Stat pictograms, mapped onto the icons that are already cut (docs/ASSETS.md):
// the mockup's own per-stat art (books, spotlight, brain) is still pending.
const statIconKeys: Record<StatKey, string> = {
  flow: AssetRegistry.icons.battleFlow.key,
  punchline: AssetRegistry.icons.battlePunchline.key,
  metrica: AssetRegistry.icons.battleMetrica.key,
  improvisacion: AssetRegistry.icons.battleRespuesta.key,
  escena: AssetRegistry.icons.resFans.key,
  carisma: AssetRegistry.icons.battleHumor.key,
  disciplina: AssetRegistry.icons.actionTrain.key,
};

export function renderTraining(ctx: ViewCtx): void {
  const { controller } = ctx;
  const state = controller.state;
  const cost = TrainingConfig.session.energyCost;
  const canTrain = state.energy >= cost;

  addDisplayText(ctx.scene, ctx.layer, TITLE.x, TITLE.y, "6. ENTRENAMIENTO", TITLE.size, palette.ink);

  addPanel(ctx.scene, ctx.layer, LEFT.x, LEFT.y, LEFT.w, LEFT.h, "#0a1030");
  energyStrip(ctx, state.energy, canTrain);
  trainingStats.forEach((stat, index) => trainingRow(ctx, stat, index, canTrain));

  addPanel(ctx.scene, ctx.layer, RIGHT.x, RIGHT.y, RIGHT.w, RIGHT.h, "#0a1030");
  coachBubble(ctx);
  // The mockup stands the MC on a city-night backdrop inside the panel; the
  // stage art of wherever the career is doubles as that well.
  rect(ctx, 644, 208, 274, 144, ROW_COLORS.border);
  rect(ctx, 646, 210, 270, 140, "#04061a");
  coverImage(ctx, stageBackdropKey(state.stage), 646, 210, 270, 140);
  mcFigure(ctx, 781, 316, 1.4);
  sessionCost(ctx, cost);
  exitButton(ctx, 653, 424, 256, 50);
  line(ctx, 706, 492, "o presiona ESC", 9, palette.muted, 180);
}

// The mockup's counter slot, carrying the real gate: energy left. Green while a
// session is affordable, red once it is not.
function energyStrip(ctx: ViewCtx, energy: number, canTrain: boolean): void {
  const { x, y, w, h } = STRIP;
  rect(ctx, x, y, w, h, "#050a20");
  rect(ctx, x, y, w, 1, palette.line);
  rect(ctx, x, y + h - 1, w, 1, ROW_COLORS.border);
  line(ctx, x + 18, y + 23, "ENERGIA DISPONIBLE:", 15, palette.ink, 240);
  line(ctx, x + 254, y + 23, String(energy), 17, canTrain ? palette.green : palette.red, 70);
  if (!canTrain) line(ctx, x + 330, y + 22, "SIN ENERGIA PARA ENTRENAR", 11, palette.red, 220);
}

// One trainable stat. Rows whose energy requirement is not met are dimmed and
// carry no hit zone, so an unaffordable session cannot be clicked at all.
function trainingRow(ctx: ViewCtx, stat: StatKey, index: number, canTrain: boolean): void {
  const { controller } = ctx;
  const value = controller.state.stats[stat];
  const max = ProgressionConfig.statBounds.max;
  const y = ROW.y0 + index * ROW.pitch;
  const accent = statColor(stat);
  const train = (): void => controller.trainSpecificStat(stat);

  rect(ctx, ROW.x + 3, y + 3, ROW.w, ROW.h, "#000000", 0.3);
  rect(ctx, ROW.x, y, ROW.w, ROW.h, canTrain ? ROW_COLORS.border : ROW_COLORS.borderDim);
  rect(ctx, ROW.x + 2, y + 2, ROW.w - 4, ROW.h - 4, canTrain ? ROW_COLORS.fill : ROW_COLORS.fillDim);
  rect(ctx, ROW.x, y, 3, ROW.h, accent, canTrain ? 1 : 0.35);
  if (canTrain) addHitZone(ctx.scene, ctx.layer, ROW.x, y, ROW.w, ROW.h, train);

  statIcon(ctx, stat, ROW.x + 6, y + 3, canTrain);
  line(
    ctx,
    ROW.x + ROW.labelX,
    y + 18,
    `${index + 1}. ${statLabels[stat].toUpperCase()}`,
    14,
    canTrain ? palette.ink : ROW_COLORS.textDim,
    150,
  );
  statMeter(ctx, ROW.x + ROW.labelX, y + 22, ROW.meterW, value, max, accent, canTrain);
  line(
    ctx,
    ROW.x + ROW.levelX,
    y + 18,
    `NIVEL ${value}`,
    14,
    canTrain ? palette.ink : ROW_COLORS.textDim,
    96,
  );
  line(ctx, ROW.x + ROW.levelX, y + 33, `${value} / ${max}`, 9, canTrain ? accent : ROW_COLORS.textDim, 96);
  plusButton(ctx, ROW.x + ROW.plusX, y + 5, ROW.plusW, ROW.h - 10, canTrain, train);
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
  bright: boolean,
): void {
  const h = 12;
  rect(ctx, x, y, w, h, ROW_COLORS.track);
  for (let i = 1; i < 5; i += 1) rect(ctx, x + Math.floor((w * i) / 5), y + 1, 1, h - 2, ROW_COLORS.tick);
  const fill = Math.max(5, Math.floor(((w - 2) * clamp(value, 0, max)) / max));
  rect(ctx, x + 1, y + 1, fill, h - 2, color, bright ? 1 : 0.4);
  rect(ctx, x + fill - 1, y, 2, h, bright ? palette.ink : ROW_COLORS.textDim);
}

// Backdrop art scaled to cover a box and cropped to it, so the well reads as a
// full-bleed window instead of a letterboxed thumbnail (addSpriteImage alone
// only ever contains).
function coverImage(ctx: ViewCtx, key: string, x: number, y: number, w: number, h: number): void {
  const image = addSpriteImage(ctx.scene, ctx.layer, key, x + w / 2, y + h / 2, h, 0.5, 0.5);
  if (!image || image.width <= 0 || image.height <= 0) return;
  const scale = Math.max(w / image.width, h / image.height);
  image.setScale(scale);
  image.setCrop((image.width - w / scale) / 2, (image.height - h / scale) / 2, w / scale, h / scale);
}

function statIcon(ctx: ViewCtx, stat: StatKey, x: number, y: number, enabled: boolean): void {
  const size = ROW.iconBox;
  rect(ctx, x, y, size, size, enabled ? ROW_COLORS.iconBorder : ROW_COLORS.borderDim);
  rect(ctx, x + 2, y + 2, size - 4, size - 4, ROW_COLORS.iconFill);
  const icon = addSpriteImage(
    ctx.scene,
    ctx.layer,
    statIconKeys[stat],
    x + size / 2,
    y + size / 2,
    size - 10,
    0.5,
    0.5,
    size - 8,
  );
  if (icon) icon.setAlpha(enabled ? 1 : 0.4);
  else rect(ctx, x + 9, y + 9, size - 18, size - 18, statColor(stat), enabled ? 1 : 0.4);
}

// The mockup's per-row "+" square.
function plusButton(
  ctx: ViewCtx,
  x: number,
  y: number,
  w: number,
  h: number,
  enabled: boolean,
  run: () => void,
): void {
  rect(ctx, x, y, w, h, enabled ? palette.borderHi : ROW_COLORS.borderDim);
  rect(ctx, x + 2, y + 2, w - 4, h - 4, enabled ? "#202b66" : "#0b0f22");
  const glyph = addText(ctx.scene, ctx.layer, x, y, "+", 17, enabled ? palette.ink : ROW_COLORS.textDim);
  glyph.setOrigin(0.5, 0.5).setPosition(x + w / 2, y + h / 2);
  if (enabled) addHitZone(ctx.scene, ctx.layer, x, y, w, h, run);
}

// Coach line from the mockup, bubble plus tail (mockup 1123..1590 x 140..310).
function coachBubble(ctx: ViewCtx): void {
  const x = 646;
  const y = 136;
  const w = 270;
  const h = 62;
  rect(ctx, x, y, w, h, palette.borderHi);
  rect(ctx, x + 2, y + 2, w - 4, h - 4, "#0d1436");
  rect(ctx, x + w / 2 - 6, y + h, 12, 6, palette.borderHi);
  rect(ctx, x + w / 2 - 4, y + h, 8, 4, "#0d1436");
  line(ctx, x + 26, y + 26, "ENTRENAR CADA DIA", 13, palette.ink, w - 40);
  line(ctx, x + 54, y + 48, "TE HACE MEJOR.", 13, palette.ink, w - 40);
}

// What a session actually costs, straight from TrainingConfig.
function sessionCost(ctx: ViewCtx, cost: number): void {
  const x = 653;
  const y = 358;
  const w = 256;
  addSoftPanel(ctx.scene, ctx.layer, x, y, w, 52);
  addSpriteImage(ctx.scene, ctx.layer, AssetRegistry.icons.actionTrain.key, x + 30, y + 26, 26, 0.5, 0.5, 34);
  line(ctx, x + 60, y + 22, "COSTO POR SESION", 10, palette.muted, 180);
  line(
    ctx,
    x + 60,
    y + 42,
    `-${cost} energia · ${formatDuration(TrainingConfig.session.blocks)}`,
    12,
    palette.yellow,
    186,
  );
}

// Visible, clickable way back. The Fase 4 room dropped the persistent nav bar,
// so without this a mouse-only player could not leave the screen at all.
function exitButton(ctx: ViewCtx, x: number, y: number, w: number, h: number): void {
  rect(ctx, x + 3, y + 3, w, h, "#000000", 0.32);
  rect(ctx, x - 2, y - 2, w + 4, h + 4, palette.borderHi);
  rect(ctx, x, y, w, h, "#2a3480");
  rect(ctx, x, y, w, 2, "#8f97e8");
  addSpriteImage(
    ctx.scene,
    ctx.layer,
    AssetRegistry.icons.actionExit.key,
    x + 34,
    y + h / 2,
    28,
    0.5,
    0.5,
    28,
  );
  const label = addText(ctx.scene, ctx.layer, x, y, "VOLVER", 16, palette.ink);
  label.setOrigin(0.5, 0.5).setPosition(x + w / 2 + 16, y + h / 2);
  addHitZone(ctx.scene, ctx.layer, x, y, w, h, () => ctx.controller.setCareerView("base"));
}
