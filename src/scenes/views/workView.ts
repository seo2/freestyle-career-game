// Career view 8: TRABAJO, rebuilt against its mockup
// (reference/screens "ChatGPT Image 15 jun 2026, 06_37_39 a.m. (1).png": job
// rows on the left, an illustrated panel for the selected job on the right, a
// "DINERO ACTUAL" badge top right and a wide info bar at the bottom).
//
// Presentation only (AGENTS.md): every click forwards a GameController command,
// nothing here computes rules or touches GameState. Which row is highlighted is
// presentation state, so it lives in a module-local variable instead of
// GameState.
//
// Geometry: the mockup is 1672x941 and the canvas is 960x540 (factor 0.574), so
// every constant below is the measured mockup pixel times 0.574 — horizontally
// verbatim. Vertically the whole screen is compressed into the 92..518 band,
// because CareerScene keeps drawing the career HUD over y 10..86 on every
// sub-view and the mockup's own header has to land under it.

import type Phaser from "phaser";
import { eventBus } from "../../events/EventBus";
import { palette } from "../../ui/palette";
import { addButton, addDisplayText, addHitZone, addPanel, addText } from "../../ui/kit";
import { clamp } from "../../utils/math";
import { jobOptions } from "../../data/jobs";
import { formatDuration } from "../../systems/CalendarSystem";
import type { JobOption } from "../../core/types";
import { line, mcFigure, rect } from "./viewKit";
import type { ViewCtx } from "./viewKit";

// Header: title 53..344 x 55..88, money frame 885..1633 x 41..112.
const HEAD = {
  titleX: 30,
  titleY: 98,
  titleSize: 26,
  cashX: 508,
  cashY: 94,
  cashW: 430,
  cashH: 36,
  cashLabelX: 538,
  cashValueX: 746,
  cashLabelSize: 15,
  cashValueSize: 19,
} as const;

// Left list panel 35..864, right illustration panel 885..1633, both y 122..712.
const LIST = { x: 22, y: 138, w: 474, h: 272 } as const;
const DETAIL = { x: 508, y: 138, w: 430, h: 272 } as const;

// Rows 56..826 wide, 119 tall on a 138 pitch; icon frame 66..191, label at 229,
// price at 631, "+" button 752..826.
const ROW = {
  x: 33,
  y0: 152,
  w: 442,
  h: 54,
  pitch: 63,
  iconDx: 6,
  iconDy: 3,
  iconW: 62,
  iconH: 48,
  labelX: 124,
  labelDy: 6,
  labelSize: 19,
  detailDy: 32,
  detailSize: 11,
  priceX: 362,
  priceDy: 11,
  priceSize: 19,
  plusW: 44,
  plusH: 40,
  monogramSize: 26,
} as const;

// Row colours sampled from the mockup (selected frame 61,103,252 over a
// 0,15,62 fill; quiet rows drop to 31,34,85 over 2,14,47).
const ROW_COLORS = {
  shadow: "#00040f",
  border: "#242c68",
  borderSelected: "#3d67fc",
  fill: "#050f38",
  fillSelected: "#0d1a55",
  iconFill: "#00081c",
  iconBorder: "#2b3474",
  artFill: "#151d4a",
  buttonFill: "#1a2145",
  buttonFillSelected: "#25317a",
  badgeRim: "#1b2ac8",
  badgeFace: "#3550ee",
  blockedInk: "#6f7495",
  blockedFill: "#070a1e",
} as const;

// Illustrated panel of the selected job: the per-job art is still a pending
// asset (docs/ASSETS.md > Pendientes), so the composition is the kit's own
// framed stage plus the real MC sprite — never procedural scenery.
const ART = {
  x: 520,
  y: 150,
  w: 406,
  h: 168,
  mcScale: 1.7,
  mcY: 270,
  captionY: 326,
  captionSize: 19,
  detailY: 350,
  detailSize: 12,
  summaryY: 386,
  summarySize: 13,
} as const;

// Bottom info bar 35..1633 x 732..900, "i" badge 62..156 x 766..860, copy at
// 193 on a 55px line pitch.
const INFO = {
  x: 22,
  y: 418,
  w: 916,
  h: 100,
  badgeX: 36,
  badgeY: 445,
  badgeSize: 46,
  textX: 104,
  textY: 440,
  textSize: 18,
  textWrap: 340,
  lineSpacing: 8,
  badgeChamfer: 6,
  badgeGlyphSize: 24,
} as const;

// The mockup has no back control (the removed nav bar used to be the way out),
// so this screen puts one in the free right half of its info bar: a mouse-only
// player must never be trapped in a sub-view.
const BACK = { x: 772, y: 444, w: 142, h: 48 } as const;

const INFO_COPY = "Trabaja para ganar dinero y poder invertir en tu carrera.";

// Which row drives the right-hand panel. Presentation state: clicking a row
// both selects it and takes the shift, so the panel always shows the last job
// the player looked at.
let selectedJob = 0;

export function renderWork(ctx: ViewCtx): void {
  const state = ctx.controller.state;
  const selected = clampSelection();

  bindJobKeys(ctx);
  header(ctx, state.cash);
  addPanel(ctx.scene, ctx.layer, LIST.x, LIST.y, LIST.w, LIST.h);
  jobOptions.forEach((option, index) => jobRow(ctx, option, index, index === selected));
  detailPanel(ctx, jobOptions[selected]);
  infoBar(ctx);
}

function clampSelection(): number {
  if (selectedJob < 0 || selectedJob >= jobOptions.length) selectedJob = 0;
  return selectedJob;
}

function selectJob(index: number): void {
  if (selectedJob === index) return;
  selectedJob = index;
  // FOCUS_CHANGED is the bus event CareerScene already redraws on for cursor
  // moves; the view never emits state changes.
  eventBus.emit("FOCUS_CHANGED", undefined);
}

// Fase 4 debt: arrows and Enter did nothing here. The global InputRouter owns
// the letter/digit hotkeys and preventDefaults Enter/Space while a sub-view is
// open, so Phaser's keyboard plugin never sees them. Same solution as
// mapView.bindNodeKeys: one window-level keydown listener bound per scene
// life, dropped on scene SHUTDOWN ("shutdown" is Phaser.Scenes.Events.SHUTDOWN,
// kept as a string to avoid a value import), that no-ops unless TRABAJO is the
// open career view. The cursor clamps at both ends, like the room dock.
let boundScene: Phaser.Scene | null = null;

function bindJobKeys(ctx: ViewCtx): void {
  if (boundScene === ctx.scene) return;
  boundScene = ctx.scene;
  const { controller } = ctx;
  // Same energy gate as the row's hit zone and "+" button: a dimmed (blocked)
  // shift takes no Enter. The rule itself stays in JobsSystem.
  const confirm = (): void => {
    const option = jobOptions[clampSelection()];
    if (option && controller.state.energy >= option.energy) controller.performJob(option);
  };
  const onKey = (event: KeyboardEvent): void => {
    if (controller.state.mode !== "career" || controller.careerView !== "work") return;
    if (event.key === "ArrowDown") selectJob(clamp(clampSelection() + 1, 0, jobOptions.length - 1));
    else if (event.key === "ArrowUp") selectJob(clamp(clampSelection() - 1, 0, jobOptions.length - 1));
    else if (event.key === "Enter" || event.code === "Space") confirm();
    else return;
    event.preventDefault();
  };
  window.addEventListener("keydown", onKey);
  ctx.scene.events.once("shutdown", () => {
    window.removeEventListener("keydown", onKey);
    boundScene = null;
  });
}

function header(ctx: ViewCtx, cash: number): void {
  addDisplayText(ctx.scene, ctx.layer, HEAD.titleX, HEAD.titleY, "8. TRABAJO", HEAD.titleSize, palette.ink);
  addPanel(ctx.scene, ctx.layer, HEAD.cashX, HEAD.cashY, HEAD.cashW, HEAD.cashH);
  const centerY = HEAD.cashY + HEAD.cashH / 2;
  const label = addText(
    ctx.scene,
    ctx.layer,
    HEAD.cashLabelX,
    centerY,
    "DINERO ACTUAL:",
    HEAD.cashLabelSize,
    palette.ink,
  );
  label.setOrigin(0, 0.5).setPosition(HEAD.cashLabelX, centerY);
  const value = addText(ctx.scene, ctx.layer, HEAD.cashValueX, centerY, `$ ${cash}`, HEAD.cashValueSize, palette.green);
  value.setOrigin(0, 0.5).setPosition(HEAD.cashValueX, centerY);
}

function jobRow(ctx: ViewCtx, option: JobOption, index: number, selected: boolean): void {
  const { controller } = ctx;
  // Mirrors the JobsSystem guard: a shift you cannot pay in energy reads as a
  // quiet row and carries no hit zone (the rule itself stays in the system).
  const blocked = controller.state.energy < option.energy;
  const y = ROW.y0 + index * ROW.pitch;
  const take = (): void => {
    selectJob(index);
    controller.performJob(option);
  };

  rect(ctx, ROW.x + 3, y + 3, ROW.w, ROW.h, ROW_COLORS.shadow, 0.45);
  rect(ctx, ROW.x, y, ROW.w, ROW.h, selected ? ROW_COLORS.borderSelected : ROW_COLORS.border);
  rect(
    ctx,
    ROW.x + 2,
    y + 2,
    ROW.w - 4,
    ROW.h - 4,
    blocked ? ROW_COLORS.blockedFill : selected ? ROW_COLORS.fillSelected : ROW_COLORS.fill,
  );
  if (!blocked) addHitZone(ctx.scene, ctx.layer, ROW.x, y, ROW.w, ROW.h, take);

  jobIcon(ctx, ROW.x + ROW.iconDx, y + ROW.iconDy, option.label, blocked);
  // Digit affordance: InputRouter's number keys already run jobOptions[n-1],
  // which was invisible because no row printed its index. The mockup has no
  // numbers, so it stays a small muted digit between the icon and the label.
  line(ctx, ROW.x + 75, y + ROW.h / 2 + 5, String(index + 1), 10, ROW_COLORS.blockedInk);
  const ink = blocked ? ROW_COLORS.blockedInk : palette.ink;
  line(ctx, ROW.labelX, y + ROW.labelDy + ROW.labelSize, option.label.toUpperCase(), ROW.labelSize, ink, 210);
  line(
    ctx,
    ROW.labelX,
    y + ROW.detailDy + ROW.detailSize,
    `${formatDuration(option.blocks)} · -${option.energy} energia`,
    ROW.detailSize,
    blocked ? ROW_COLORS.blockedInk : palette.muted,
    210,
  );
  line(
    ctx,
    ROW.priceX,
    y + ROW.priceDy + ROW.priceSize,
    `$ ${option.cash}`,
    ROW.priceSize,
    blocked ? ROW_COLORS.blockedInk : palette.green,
    62,
  );
  addButton(
    ctx.scene,
    ctx.layer,
    ROW.x + ROW.w - ROW.plusW - 2,
    y + Math.floor((ROW.h - ROW.plusH) / 2),
    ROW.plusW,
    ROW.plusH,
    "+",
    take,
    { fill: selected ? ROW_COLORS.buttonFillSelected : ROW_COLORS.buttonFill, size: 18, disabled: blocked, selected },
  );
}

// Neutral framed slot for the per-job icon, which is a pending asset
// (docs/ASSETS.md): the mockup's frame plus the job monogram, never an
// improvised drawing of a clipboard or a hammer.
function jobIcon(ctx: ViewCtx, x: number, y: number, label: string, blocked: boolean): void {
  rect(ctx, x, y, ROW.iconW, ROW.iconH, blocked ? ROW_COLORS.border : ROW_COLORS.iconBorder);
  rect(ctx, x + 2, y + 2, ROW.iconW - 4, ROW.iconH - 4, ROW_COLORS.iconFill);
  const glyph = addText(
    ctx.scene,
    ctx.layer,
    x + ROW.iconW / 2,
    y + ROW.iconH / 2,
    label.charAt(0).toUpperCase(),
    ROW.monogramSize,
    blocked ? ROW_COLORS.blockedInk : palette.yellow,
  );
  glyph.setOrigin(0.5, 0.5).setPosition(x + ROW.iconW / 2, y + ROW.iconH / 2);
}

function detailPanel(ctx: ViewCtx, option: JobOption): void {
  addPanel(ctx.scene, ctx.layer, DETAIL.x, DETAIL.y, DETAIL.w, DETAIL.h);
  rect(ctx, ART.x, ART.y, ART.w, ART.h, ROW_COLORS.artFill);
  rect(ctx, ART.x, ART.y, ART.w, 2, ROW_COLORS.iconBorder);
  mcFigure(ctx, ART.x + ART.w / 2, ART.mcY, ART.mcScale);
  line(ctx, ART.x, ART.captionY + ART.captionSize, option.label.toUpperCase(), ART.captionSize, palette.ink, ART.w);
  addText(ctx.scene, ctx.layer, ART.x, ART.detailY, option.detail, ART.detailSize, palette.muted, {
    wordWrap: { width: ART.w, useAdvancedWrap: true },
  });
  line(
    ctx,
    ART.x,
    ART.summaryY + ART.summarySize,
    `Paga $${option.cash} · ${formatDuration(option.blocks)} · -${option.energy} energia`,
    ART.summarySize,
    palette.yellow,
    ART.w,
  );
}

function infoBar(ctx: ViewCtx): void {
  addPanel(ctx.scene, ctx.layer, INFO.x, INFO.y, INFO.w, INFO.h);
  infoBadge(ctx);
  addText(ctx.scene, ctx.layer, INFO.textX, INFO.textY, INFO_COPY, INFO.textSize, palette.ink, {
    wordWrap: { width: INFO.textWrap, useAdvancedWrap: true },
    lineSpacing: INFO.lineSpacing,
  });
  addButton(ctx.scene, ctx.layer, BACK.x, BACK.y, BACK.w, BACK.h, "VOLVER", () => ctx.controller.setCareerView("base"), {
    fill: "#050e2d",
    textColor: palette.yellow,
    size: 15,
    selected: true,
  });
}

// The mockup's round "i" badge, as a chamfered pixel disc (two overlapping
// rects keep the corners crisp at 960x540).
function infoBadge(ctx: ViewCtx): void {
  const { badgeX: x, badgeY: y, badgeSize: s } = INFO;
  const c = INFO.badgeChamfer;
  rect(ctx, x, y + c, s, s - 2 * c, ROW_COLORS.badgeRim);
  rect(ctx, x + c, y, s - 2 * c, s, ROW_COLORS.badgeRim);
  rect(ctx, x + 4, y + 4 + c - 2, s - 8, s - 8 - 2 * (c - 2), ROW_COLORS.badgeFace);
  rect(ctx, x + 4 + c - 2, y + 4, s - 8 - 2 * (c - 2), s - 8, ROW_COLORS.badgeFace);
  const glyph = addText(ctx.scene, ctx.layer, x + s / 2, y + s / 2, "i", INFO.badgeGlyphSize, palette.ink);
  glyph.setOrigin(0.5, 0.5).setPosition(x + s / 2, y + s / 2);
}
