// The seven non-base career views (calendar/map/training/social/work/shop/
// stats), ported 1:1 from the legacy canvas renderer's draw functions.
// Presentation only: reads controller state, forwards pointer clicks to
// controller commands. CareerScene calls renderCareerView() on every redraw
// with the container it owns; keyboard input stays global in InputRouter.
//
// Legacy y-coordinates are alphabetic text baselines; the kit uses top-left
// origin, so every text call subtracts the font size from the legacy y.
// Character/prop pixel art (drawMc, mic stand, speaker stacks, crates) is NOT
// ported — compact placeholder blocks hold the layout until Fase 3 sprites.

import type Phaser from "phaser";
import { gameContext } from "../game/context";
import { palette } from "../ui/palette";
import {
  addButton,
  addHitZone,
  addMeter,
  addPanel,
  addRect,
  addSoftPanel,
  addText,
  addTextBlock,
} from "../ui/kit";
import { calendarActionIds } from "../data/actions";
import { socialPostOptions } from "../data/social";
import { jobOptions } from "../data/jobs";
import { upgrades } from "../data/upgrades";
import { stages } from "../data/stages";
import { statLabels, trainingStats } from "../data/stats";
import { currentStage, stageIndex } from "../core/derived";
import { getCareerGoals } from "../systems/ProgressionSystem";
import { formatDuration } from "../systems/CalendarSystem";
import { nextUpgrade, upgradeCost, upgradeLevel } from "../systems/StoreSystem";
import { clamp } from "../utils/math";
import type { CareerGoal, JobOption, SocialPostOption, StageId, StatKey, UpgradeDef } from "../core/types";
import type { GameController } from "../managers/GameController";

type Vec2 = readonly [number, number];

interface ViewCtx {
  scene: Phaser.Scene;
  layer: Phaser.GameObjects.Container;
  controller: GameController;
}

const viewRenderers = {
  calendar: renderCalendar,
  map: renderMap,
  training: renderTraining,
  social: renderSocial,
  work: renderWork,
  shop: renderShop,
  stats: renderStats,
} as const;

export function renderCareerView(
  scene: Phaser.Scene,
  layer: Phaser.GameObjects.Container,
  view: "calendar" | "map" | "training" | "social" | "work" | "shop" | "stats",
): void {
  viewRenderers[view]({ scene, layer, controller: gameContext().controller });
}

// --- Shared drawing helpers ---------------------------------------------------

function rect(ctx: ViewCtx, x: number, y: number, w: number, h: number, color: string, alpha = 1): void {
  if (w <= 0 || h <= 0) return;
  addRect(ctx.scene, ctx.layer, x, y, w, h, color, alpha);
}

// Single line at a legacy baseline y; ellipsized when wider than maxWidth
// (legacy drawTextLine). maxWidth 0 renders unclipped (legacy drawText).
function line(ctx: ViewCtx, x: number, y: number, content: string, size: number, color: string, maxWidth = 0): void {
  const text = addText(ctx.scene, ctx.layer, x, y - size, content, size, color);
  if (maxWidth <= 0 || text.width <= maxWidth) return;
  let trimmed = content;
  while (trimmed.length > 1 && text.width > maxWidth) {
    trimmed = trimmed.slice(0, -1);
    text.setText(`${trimmed.trimEnd()}...`);
  }
}

function viewTitle(ctx: ViewCtx, title: string, detail: string): void {
  line(ctx, 40, 118, title, 27, palette.ink);
  line(ctx, 42, 142, detail, 11, palette.muted, 560);
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

function statColor(stat: StatKey): string {
  return statColors[stat];
}

function stageTitle(stageId: StageId): string {
  return stages.find((stage) => stage.id === stageId)?.title ?? "Pieza";
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

function actionShortLabel(id: string, fallback: string): string {
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

function actionAccent(id: string): string {
  return actionAccents[id] ?? palette.yellow;
}

function actionIcon(ctx: ViewCtx, id: string, x: number, y: number, color: string): void {
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

// Compact stand-in for the legacy procedural pixel MC (real sprites land in
// Fase 3). Anchor matches legacy drawMc: (x, y) at hip level, feet ~25*s below.
function mcPlaceholder(ctx: ViewCtx, x: number, y: number, s: number): void {
  rect(ctx, x - 26 * s, y + 20 * s, 52 * s, 7 * s, "#000000", 0.22);
  rect(ctx, x - 14 * s, y - 7 * s, 28 * s, 32 * s, palette.borderLo);
  rect(ctx, x - 20 * s, y - 40 * s, 40 * s, 37 * s, palette.panelAlt);
  rect(ctx, x - 16 * s, y - 64 * s, 32 * s, 28 * s, palette.borderHi);
  rect(ctx, x - 18 * s, y - 69 * s, 36 * s, 8 * s, palette.yellow);
}

function goalRow(ctx: ViewCtx, x: number, y: number, w: number, goal: CareerGoal): void {
  line(ctx, x, y, goal.label, 11, palette.ink, w);
  line(ctx, x, y + 13, goal.detail, 9, palette.muted, w);
  rect(ctx, x, y + 19, w, 6, "#08090c", 0.92);
  rect(ctx, x, y + 19, Math.floor((clamp(goal.value, 0, goal.max) / goal.max) * w), 6, goal.color);
}

// --- Calendar -------------------------------------------------------------------

function renderCalendar(ctx: ViewCtx): void {
  const { controller } = ctx;
  const state = controller.state;
  viewTitle(ctx, "4. Calendario semanal", "Programa una accion rapida o vuelve a la base.");
  const days = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];
  const actions = controller.careerActions();
  const x0 = 40;
  const y = 156;
  const cardW = 120;
  days.forEach((day, index) => {
    const action = actions.find((item) => item.id === calendarActionIds[index]);
    const x = x0 + index * 127;
    const active = index + 1 === state.day;
    const disabled = !action || Boolean(action.disabledReason);
    rect(ctx, x + 4, y + 4, cardW, 206, "#000000", 0.28);
    rect(ctx, x, y, cardW, 206, active ? "#182151" : "#111737");
    rect(ctx, x, y, cardW, 4, active ? palette.yellow : "#30386d");
    if (action && !disabled) {
      addHitZone(ctx.scene, ctx.layer, x, y, cardW, 206, () => controller.runCareerAction(action.id));
    }
    line(ctx, x + 22, y + 34, day, 16, palette.ink);
    actionIcon(ctx, action?.id ?? "rest", x + 47, y + 58, disabled ? "#555b6d" : actionAccent(action?.id ?? "rest"));
    line(
      ctx,
      x + 18,
      y + 116,
      actionShortLabel(action?.id ?? "rest", action?.label ?? "Libre"),
      13,
      disabled ? "#74798c" : palette.ink,
      84,
    );
    line(ctx, x + 24, y + 142, action ? formatDuration(action.durationBlocks) : "-", 11, palette.yellow, 78);
    rect(ctx, x + 24, y + 156, 72, 34, "#060812", 0.58);
  });

  addSoftPanel(ctx.scene, ctx.layer, 42, 382, 580, 78);
  line(ctx, 64, 412, "Informacion", 16, palette.yellow);
  addTextBlock(ctx.scene, ctx.layer, 64, 424, state.lastEvent, 12, palette.ink, 520);
  addButton(ctx.scene, ctx.layer, 724, 402, 154, 42, "Continuar", () => controller.setCareerView("base"), {
    size: 13,
  });
}

// --- Map --------------------------------------------------------------------------

function renderMap(ctx: ViewCtx): void {
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

// --- Training ------------------------------------------------------------------------

function renderTraining(ctx: ViewCtx): void {
  viewTitle(ctx, "6. Entrenamiento", "Sube atributos concretos consumiendo un bloque y energia.");
  addPanel(ctx.scene, ctx.layer, 36, 150, 580, 310);
  trainingStats.forEach((stat, index) => trainingRow(ctx, stat, index, 60, 176 + index * 39, 526));
  addPanel(ctx.scene, ctx.layer, 638, 150, 286, 310);
  line(ctx, 690, 196, "Entrenar cada dia", 18, palette.ink);
  line(ctx, 718, 226, "te hace mejor.", 18, palette.ink);
  mcPlaceholder(ctx, 780, 342, 1.2);
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

// --- Social --------------------------------------------------------------------------

function renderSocial(ctx: ViewCtx): void {
  const { controller } = ctx;
  const state = controller.state;
  viewTitle(ctx, "7. Redes sociales", "Publica contenido, gana fans y cuida la energia.");
  const engagement = clamp(12 + state.stats.carisma * 3 + Math.floor(state.momentum / 5), 0, 99);
  addPanel(ctx.scene, ctx.layer, 36, 150, 530, 310);
  line(ctx, 62, 180, `Seguidores ${state.fans}`, 15, palette.blue, 190);
  line(ctx, 348, 180, `Engagement ${engagement}%`, 15, palette.yellow, 160);
  socialPostOptions.forEach((option, index) => socialRow(ctx, option, index, 60, 206 + index * 55, 482));
  addPanel(ctx.scene, ctx.layer, 594, 150, 330, 310);
  line(ctx, 694, 184, "Vista previa", 17, palette.ink);
  socialPreview(ctx, 622, 204, 274, 166);
  addButton(
    ctx.scene,
    ctx.layer,
    674,
    394,
    166,
    42,
    "Publicar",
    () => controller.publishSocialPost(socialPostOptions[0]),
    { size: 13, disabled: state.energy < socialPostOptions[0].energy },
  );
}

function socialRow(ctx: ViewCtx, option: SocialPostOption, index: number, x: number, y: number, w: number): void {
  const { controller } = ctx;
  const disabled = controller.state.energy < option.energy;
  rect(ctx, x + 3, y + 3, w, 42, "#000000", 0.26);
  rect(ctx, x, y, w, 42, index === 0 ? "#1b2555" : "#101735");
  rect(ctx, x, y, 4, 42, palette.pink);
  if (!disabled) {
    addHitZone(ctx.scene, ctx.layer, x, y, w, 42, () => controller.publishSocialPost(option));
  }
  line(ctx, x + 16, y + 26, `${index + 1}. ${option.label}`, 13, disabled ? "#7d8295" : palette.ink, 210);
  line(ctx, x + 260, y + 26, `+${option.fans} fans`, 11, palette.blue, 82);
  line(ctx, x + 368, y + 26, formatDuration(option.blocks), 11, palette.yellow, 34);
}

function socialPreview(ctx: ViewCtx, x: number, y: number, w: number, h: number): void {
  const state = ctx.controller.state;
  rect(ctx, x, y, w, h, "#0b1026");
  for (let i = 0; i < 8; i += 1) {
    const bx = x + 12 + i * 32;
    const bh = 34 + ((i * 13) % 42);
    rect(ctx, bx, y + 82 - bh, 22, bh, "#151e40");
    rect(ctx, bx + 6, y + 58 - bh, 4, 5, "#d8b653");
    rect(ctx, bx + 14, y + 72 - bh, 4, 5, "#6aa7ff");
  }
  rect(ctx, x + 14, y + 14, 36, 36, "#171a20");
  line(ctx, x + 62, y + 36, state.playerName, 12, palette.ink, 120);
  mcPlaceholder(ctx, x + 142, y + 120, 0.72);
  rect(ctx, x + 12, y + h - 34, w - 24, 1, "#2d356d");
  line(ctx, x + 18, y + h - 14, "Nuevo freestyle en la plaza.", 10, palette.ink, w - 36);
}

// --- Work -----------------------------------------------------------------------------

function renderWork(ctx: ViewCtx): void {
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
  mcPlaceholder(ctx, x + 170, y + 156, 1.05);
  line(ctx, x + 164, y + 36, "Enfoque + disciplina", 13, palette.ink, 130);
}

// --- Shop -----------------------------------------------------------------------------

function renderShop(ctx: ViewCtx): void {
  const state = ctx.controller.state;
  viewTitle(ctx, "9. Tienda", "Compra equipo, ropa y base para mejorar tu carrera.");
  line(ctx, 752, 118, `Dinero $${state.cash}`, 18, palette.green, 140);
  addPanel(ctx.scene, ctx.layer, 36, 150, 520, 310);
  upgrades.forEach((upgrade, index) => shopRow(ctx, upgrade, index, 62, 184 + index * 70, 464));
  addPanel(ctx.scene, ctx.layer, 586, 150, 338, 310);
  shopPreview(ctx, 630, 186);
  const next = nextUpgrade(state);
  line(ctx, 626, 408, next ? `${next.label}: ${next.effect}` : "Setup al maximo", 15, palette.yellow, 240);
  const detail = next
    ? `Costo recomendado: $${upgradeCost(next, upgradeLevel(state, next.key))}.`
    : "No hay compras pendientes.";
  addTextBlock(ctx.scene, ctx.layer, 626, 420, detail, 12, palette.ink, 240);
}

function shopRow(ctx: ViewCtx, upgrade: UpgradeDef, index: number, x: number, y: number, w: number): void {
  const { controller } = ctx;
  const state = controller.state;
  const level = upgradeLevel(state, upgrade.key);
  const maxed = level >= upgrade.maxLevel;
  const cost = upgradeCost(upgrade, level);
  const disabled = maxed || state.cash < cost;
  rect(ctx, x + 3, y + 3, w, 52, "#000000", 0.26);
  rect(ctx, x, y, w, 52, "#101735");
  rect(ctx, x, y, 4, 52, upgrade.color);
  if (!disabled) {
    addHitZone(ctx.scene, ctx.layer, x, y, w, 52, () => controller.buyUpgradeByKey(upgrade.key));
  }
  line(ctx, x + 16, y + 25, `${index + 1}. ${upgrade.label}`, 15, palette.ink, 128);
  line(ctx, x + 166, y + 25, `Nv ${level}/${upgrade.maxLevel}`, 12, palette.muted, 64);
  line(ctx, x + 256, y + 25, maxed ? "MAX" : `$${cost}`, 14, maxed ? palette.teal : palette.green, 70);
  line(ctx, x + 16, y + 43, upgrade.effect, 10, palette.muted, 230);
  addButton(ctx.scene, ctx.layer, x + w - 54, y + 12, 36, 28, "+", () => controller.buyUpgradeByKey(upgrade.key), {
    fill: "#202955",
    size: 13,
    disabled,
  });
}

function shopPreview(ctx: ViewCtx, x: number, y: number): void {
  rect(ctx, x, y, 250, 164, "#111835");
  rect(ctx, x, y + 111, 250, 2, "#3c4370");
  // Placeholder gear blocks where the mic stand and speaker stacks will land
  // once Fase 3 sprites replace the legacy procedural props.
  rect(ctx, x + 36, y + 56, 34, 56, palette.panelAlt);
  rect(ctx, x + 184, y + 56, 34, 56, palette.panelAlt);
  rect(ctx, x + 122, y + 60, 4, 52, palette.muted);
  rect(ctx, x + 116, y + 50, 16, 12, palette.black);
}

// --- Stats ----------------------------------------------------------------------------

function renderStats(ctx: ViewCtx): void {
  const state = ctx.controller.state;
  viewTitle(ctx, "13. Estadisticas", "Perfil del artista y metricas de carrera.");
  addPanel(ctx.scene, ctx.layer, 32, 152, 244, 312);
  line(ctx, 112, 184, "Perfil", 16, palette.ink);
  mcPlaceholder(ctx, 154, 316, 1.28);
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
