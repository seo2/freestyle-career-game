// Career view 4: weekly calendar, rebuilt against its mockup
// (reference/screens "ChatGPT Image 15 jun 2026, 06_23_14 a.m. (4).png", read in
// docs/PANTALLAS.md). Presentation only: every click forwards a GameController
// command, nothing here computes rules or touches GameState.
//
// The mockup is 1672x941 and the canvas is 960x540, so every measured value
// below is the mockup pixel times 0.574 (the mockup number stays in the
// comment). CareerScene keeps drawing the HUD on top (y 10..86), so the screen
// starts at the week header.

import { actionIconKey } from "../../game/AssetRegistry";
import { palette } from "../../ui/palette";
import { addButton, addDisplayText, addHitZone, addPanel, addSpriteImage, addText, addTextBlock } from "../../ui/kit";
import { eventBus } from "../../events/EventBus";
import { battleDay, dayAlreadyLived, openDays, plannedActionFor, todaysPlan } from "../../systems/PlanSystem";
import type { GameState, WeekSummary } from "../../core/types";
import { currentStage } from "../../core/derived";
import { actionAccent, actionIcon, actionShortLabel, rect } from "./viewKit";
import type { ViewCtx } from "./viewKit";

// "◀ SEMANA n ▶": mockup text 727..933 x 172..204, arrows 661..1008.
const HEADER = { centerX: 480, centerY: 108, size: 22, arrowDx: 92, arrowH: 22 } as const;

// One card per weekday. Mockup: cards 70..274 (204 wide) on a 223 pitch,
// 240..690 tall; day label 267..293; icons 320..435; action label 460..481;
// dashed slot 527..667 inset 21 from each side.
const CARD = {
  x0: 40,
  pitch: 128,
  w: 117,
  y: 138,
  h: 258,
  chamfer: 5,
  dayCenterY: 161,
  iconCenterY: 216,
  iconH: 56,
  iconMaxW: 80,
  labelCenterY: 270,
  slotDx: 12,
  slotDy: 165,
  slotW: 92,
  slotH: 80,
  bracketLen: 20,
  bracketThickness: 3,
} as const;

// Card colours sampled from the mockup (fill 19,27,78 / border 58,60,130).
const CARD_COLORS = {
  shadow: "#000617",
  border: "#3a4288",
  borderBlocked: "#252c5e",
  fill: "#131b4e",
  fillActive: "#1a2360",
  fillBlocked: "#0e1436",
  slot: "#39428a",
  labelBlocked: "#6f7495",
} as const;

// Bottom row: INFORMACION panel 74..1041 x 713..886, CONTINUAR 1275..1604 x
// 776..858.
const INFO = { x: 42, y: 409, w: 555, h: 100, fill: "#050e2d" } as const;
const CONTINUE = { x: 732, y: 445, w: 189, h: 47 } as const;


// The mockup prints its own short card wording (ENTRENAR / REDES / TRABAJAR /
// DESCANSAR / ESCRIBIR / BATALLA / LIBRE). Kept as data so a long action label
// can never push a card to three lines.
const CARD_LABELS: Record<string, string> = {
  practice: "ENTRENAR",
  social: "REDES",
  work: "TRABAJAR",
  rest: "DESCANSAR",
  write: "ESCRIBIR",
  battle: "BATALLA",
  cypher: "CYPHER",
};

const DAYS = ["LUN", "MAR", "MIE", "JUE", "VIE", "SAB", "DOM"];

// Which week the arrows are looking at: 0 = the live week (planning), 1 = last
// finished week, 2 = the one before it... Presentation state, so it lives here
// and never in GameState.
let historyOffset = 0;

export function renderCalendar(ctx: ViewCtx): void {
  const { controller } = ctx;
  const state = controller.state;

  // A finished week is read-only history; the live week is where you plan.
  const log = state.weekLog;
  historyOffset = Math.max(0, Math.min(historyOffset, log.length));
  const summary = historyOffset > 0 ? log[log.length - historyOffset] : null;

  weekHeader(ctx, summary ? summary.week : state.week, log.length, Boolean(summary));

  if (summary) {
    renderHistoryWeek(ctx, summary);
    return;
  }
  renderLiveWeek(ctx, state, controller);
}

// The live week: each card shows what the day is planned for, an open day shows
// the mockup's dashed slot, and clicking a card cycles what it holds.
function renderLiveWeek(ctx: ViewCtx, state: GameState, controller: ViewCtx["controller"]): void {
  const actions = controller.careerActions();

  DAYS.forEach((day, index) => {
    const dayNumber = index + 1;
    const planned = plannedActionFor(state, dayNumber);
    const action = planned ? actions.find((item) => item.id === planned) : undefined;
    const past = dayNumber < state.day;
    const record = state.weekRecord.find((entry) => entry.day === dayNumber);
    // A day that already happened shows what it ended up being, not the intent.
    const shownId = past ? (record?.ran ?? null) : planned;
    const isBattleSlot = dayNumber === battleDay();
    dayCard(ctx, index, day, {
      shownId,
      label: shownId ? cardLabel(shownId, actions.find((item) => item.id === shownId)?.label) : "LIBRE",
      active: dayNumber === state.day,
      past,
      // Only today's plan can be judged: whether Saturday's battle is
      // affordable depends on the energy you arrive with, so flagging a future
      // day from today's numbers would be a lie.
      warn: Boolean(!past && dayNumber === state.day && planned && action?.disabledReason),
      battleSlot: isBattleSlot,
    });
    if (!past) {
      const x = CARD.x0 + index * CARD.pitch;
      addHitZone(ctx.scene, ctx.layer, x, CARD.y, CARD.w, CARD.h, () => controller.cyclePlanForDay(dayNumber));
    }
  });

  infoPanel(ctx, planningBrief(state, controller));

  // The mockup's primary button is now what the loop needs: live today.
  const planned = todaysPlan(state);
  const lived = dayAlreadyLived(state);
  const label = lived ? "PLAN CUMPLIDO" : planned ? "EJECUTAR DIA" : "DIA SIN PLAN";
  addButton(ctx.scene, ctx.layer, CONTINUE.x, CONTINUE.y, CONTINUE.w, CONTINUE.h, label, () =>
    lived ? controller.setCareerView("base") : controller.runPlannedDay(),
  {
    fill: INFO.fill,
    textColor: lived || !planned ? palette.muted : palette.yellow,
    size: 14,
    selected: Boolean(planned) && !lived,
  });
}

// A finished week, read-only: what each day ended up being and what it paid.
function renderHistoryWeek(ctx: ViewCtx, summary: WeekSummary): void {
  DAYS.forEach((day, index) => {
    const record = summary.days.find((entry) => entry.day === index + 1);
    dayCard(ctx, index, day, {
      shownId: record?.ran ?? null,
      label: record?.ran ? cardLabel(record.ran, undefined) : "LIBRE",
      active: false,
      past: true,
      warn: false,
      battleSlot: index + 1 === battleDay(),
    });
  });
  const body = [
    `Semana ${summary.week} cerrada.`,
    `Plata ${signed(summary.cash)} · Fans ${signed(summary.fans)} · Respeto ${signed(summary.respect)} · XP ${signed(summary.xp)}`,
    summary.battlesWon + summary.battlesLost > 0
      ? `Batallas: ${summary.battlesWon} ganadas, ${summary.battlesLost} perdidas.`
      : "Sin batallas esa semana.",
  ].join("\n");
  infoPanel(ctx, body);
  addButton(ctx.scene, ctx.layer, CONTINUE.x, CONTINUE.y, CONTINUE.w, CONTINUE.h, "VOLVER A HOY", () => {
    historyOffset = 0;
    eventBus.emit("FOCUS_CHANGED", undefined);
  },
  {
    fill: INFO.fill,
    textColor: palette.yellow,
    size: 14,
    selected: true,
  });
}

function signed(value: number): string {
  return `${value >= 0 ? "+" : ""}${value}`;
}

// What the INFORMACION panel says while you plan: the appointment, what is
// still open, and the last thing that happened.
function planningBrief(state: GameState, controller: ViewCtx["controller"]): string {
  const open = openDays(state);
  const appointment = plannedActionFor(state, battleDay()) === "battle";
  const lines = [
    state.lastEvent || currentStage(state).nextHint,
    appointment
      ? `Batalla agendada para ${DAYS[battleDay() - 1]}: llega con energia.`
      : `${DAYS[battleDay() - 1]} es dia de batalla: agendala si quieres competir.`,
    open === 0
      ? "La semana esta completa."
      : `Te quedan ${open} ${open === 1 ? "dia" : "dias"} sin plan (clic en un dia para agendarlo).`,
    ...(todaysPlan(state) && controller.careerActions().find((a) => a.id === todaysPlan(state))?.disabledReason
      ? [`Hoy no te alcanza: ${controller.careerActions().find((a) => a.id === todaysPlan(state))?.disabledReason}`]
      : []),
  ];
  return lines.join("\n");
}

function cardLabel(id: string | undefined, fallback: string | undefined): string {
  if (!id) return "LIBRE";
  return CARD_LABELS[id] ?? actionShortLabel(id, fallback ?? "Libre").toUpperCase();
}

// Centered "◀ SEMANA n ▶". The arrows browse the weekly summaries the save
// keeps (Fase 6): left goes back through finished weeks, right returns toward
// today. An arrow with nothing behind it is drawn dim and gets no hit zone.
function weekHeader(ctx: ViewCtx, week: number, logLength: number, inHistory: boolean): void {
  const label = addDisplayText(
    ctx.scene,
    ctx.layer,
    HEADER.centerX,
    HEADER.centerY,
    `SEMANA ${week}`,
    HEADER.size,
    palette.ink,
  );
  label.setOrigin(0.5, 0.5).setPosition(HEADER.centerX, HEADER.centerY);
  const canGoBack = historyOffset < logLength;
  const canGoForward = historyOffset > 0;
  weekArrow(ctx, HEADER.centerX - HEADER.arrowDx, HEADER.centerY, -1, canGoBack, 1);
  weekArrow(ctx, HEADER.centerX + HEADER.arrowDx, HEADER.centerY, 1, canGoForward, -1);
  if (inHistory) {
    const tag = addText(ctx.scene, ctx.layer, HEADER.centerX, HEADER.centerY + 18, "SEMANA CERRADA", 10, palette.muted);
    tag.setOrigin(0.5, 0.5).setPosition(HEADER.centerX, HEADER.centerY + 18);
  }
}

// One header arrow: dim and inert when there is nothing that way.
function weekArrow(ctx: ViewCtx, cx: number, cy: number, dir: -1 | 1, enabled: boolean, step: number): void {
  chevron(ctx, cx, cy, dir, enabled);
  if (!enabled) return;
  addHitZone(ctx.scene, ctx.layer, cx - 16, cy - 16, 32, 32, () => {
    historyOffset += step;
    eventBus.emit("FOCUS_CHANGED", undefined);
  });
}

// Stepped pixel triangle: dir -1 points left, dir 1 points right.
function chevron(ctx: ViewCtx, cx: number, cy: number, dir: -1 | 1, enabled = false): void {
  const steps = 4;
  const step = Math.floor(HEADER.arrowH / steps);
  for (let i = 0; i < steps; i += 1) {
    const h = HEADER.arrowH - i * step;
    const x = dir === 1 ? cx - 8 + i * 4 : cx + 4 - i * 4;
    rect(ctx, x, cy - Math.floor(h / 2), 4, h, enabled ? palette.ink : "#6c74a8");
  }
}

interface DayCardState {
  // What the card shows: the planned action, what a past day ran, or null when
  // the day is open (the mockup's dashed slot).
  shownId: string | null;
  label: string;
  active: boolean;
  past: boolean;
  // Planned but no longer affordable: flagged while you can still change it.
  warn: boolean;
  battleSlot: boolean;
}

function dayCard(ctx: ViewCtx, index: number, day: string, card: DayCardState): void {
  const { shownId, label, active, past, warn, battleSlot } = card;
  const actionId = shownId ?? "rest";
  const blocked = past;
  const x = CARD.x0 + index * CARD.pitch;
  const cx = x + CARD.w / 2;
  const c = CARD.chamfer;
  chamfered(ctx, x + 3, CARD.y + 4, CARD.w, CARD.h, c, CARD_COLORS.shadow, 0.4);
  // A warning rides on the card's BORDER, not on the slot: the slot's colour is
  // the action's own accent (battle is already red), so a red fill could never
  // mean "you cannot afford this".
  chamfered(
    ctx,
    x,
    CARD.y,
    CARD.w,
    CARD.h,
    c,
    warn ? palette.red : blocked ? CARD_COLORS.borderBlocked : CARD_COLORS.border,
  );
  chamfered(
    ctx,
    x + 2,
    CARD.y + 2,
    CARD.w - 4,
    CARD.h - 4,
    c - 1,
    blocked ? CARD_COLORS.fillBlocked : active ? CARD_COLORS.fillActive : CARD_COLORS.fill,
  );

  const dayText = addDisplayText(ctx.scene, ctx.layer, cx, CARD.dayCenterY, day, 22, blocked ? CARD_COLORS.labelBlocked : palette.ink);
  dayText.setOrigin(0.5, 0.5).setPosition(cx, CARD.dayCenterY);

  const iconKey = shownId ? actionIconKey(actionId) : null;
  const icon = iconKey
    ? addSpriteImage(ctx.scene, ctx.layer, iconKey, cx, CARD.iconCenterY, CARD.iconH, 0.5, 0.5, CARD.iconMaxW)
    : null;
  if (icon) icon.setAlpha(past ? 0.45 : 1);
  else if (shownId) actionIcon(ctx, actionId, cx - 13, CARD.iconCenterY - 13, past ? CARD_COLORS.labelBlocked : actionAccent(actionId));

  const labelText = addText(
    ctx.scene,
    ctx.layer,
    cx,
    CARD.labelCenterY,
    label,
    13,
    blocked ? CARD_COLORS.labelBlocked : palette.ink,
    { align: "center", wordWrap: { width: CARD.w - 14 } },
  );
  labelText.setOrigin(0.5, 0.5).setPosition(cx, CARD.labelCenterY);

  // The mockup's planning slot, now real: dashed while the day is open, filled
  // with a solid bar once something is planned there.
  const slotY = CARD.y + CARD.slotDy;
  if (shownId === null) {
    dashedBox(ctx, x + CARD.slotDx, slotY, CARD.slotW, CARD.slotH, CARD_COLORS.slot);
  } else {
    rect(ctx, x + CARD.slotDx, slotY, CARD.slotW, CARD.slotH, warn ? palette.red : actionAccent(actionId), past ? 0.35 : 0.9);
  }
  // The week's appointment is marked even when nothing is planned on it, so the
  // player can see the fixture before deciding.
  if (battleSlot) rect(ctx, x + CARD.slotDx, slotY - 4, CARD.slotW, 2, palette.yellow, past ? 0.3 : 0.8);

  if (active) cornerBrackets(ctx, x - 1, CARD.y - 1, CARD.w + 2, CARD.h + 2);
}

function infoPanel(ctx: ViewCtx, body: string): void {
  addPanel(ctx.scene, ctx.layer, INFO.x, INFO.y, INFO.w, INFO.h, INFO.fill);
  addDisplayText(ctx.scene, ctx.layer, INFO.x + 19, INFO.y + 15, "INFORMACION", 20, palette.yellow);
  addTextBlock(ctx.scene, ctx.layer, INFO.x + 19, INFO.y + 42, body, 13, palette.ink, INFO.w - 38);
}

// --- Local pixel helpers -------------------------------------------------------

// Chamfered box (rounded pixel corners) as two overlapping rects, so the frame
// stays crisp at 960x540 without anti-aliased curves.
function chamfered(ctx: ViewCtx, x: number, y: number, w: number, h: number, c: number, color: string, alpha = 1): void {
  rect(ctx, x, y + c, w, h - 2 * c, color, alpha);
  rect(ctx, x + c, y, w - 2 * c, h, color, alpha);
}

function dashedBox(ctx: ViewCtx, x: number, y: number, w: number, h: number, color: string): void {
  const dash = 8;
  const gap = 6;
  const t = 2;
  for (let dx = 0; dx < w; dx += dash + gap) {
    const len = Math.min(dash, w - dx);
    rect(ctx, x + dx, y, len, t, color);
    rect(ctx, x + dx, y + h - t, len, t, color);
  }
  for (let dy = 0; dy < h; dy += dash + gap) {
    const len = Math.min(dash, h - dy);
    rect(ctx, x, y + dy, t, len, color);
    rect(ctx, x + w - t, y + dy, t, len, color);
  }
}

// Mockup selection: yellow arms on the four corners of the active card.
function cornerBrackets(ctx: ViewCtx, x: number, y: number, w: number, h: number): void {
  const l = CARD.bracketLen;
  const t = CARD.bracketThickness;
  const arms: [number, number, number, number][] = [
    [x, y, l, t],
    [x, y, t, l],
    [x + w - l, y, l, t],
    [x + w - t, y, t, l],
    [x, y + h - t, l, t],
    [x, y + h - l, t, l],
    [x + w - l, y + h - t, l, t],
    [x + w - t, y + h - l, t, l],
  ];
  arms.forEach(([ax, ay, aw, ah]) => rect(ctx, ax, ay, aw, ah, palette.yellow));
}
