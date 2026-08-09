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
import { calendarActionIds } from "../../data/actions";
import { currentStage } from "../../core/derived";
import { actionAccent, actionIcon, actionShortLabel, line, rect } from "./viewKit";
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

const SLOT_HINT = "Las ranuras punteadas quedan para programar la semana.";

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

export function renderCalendar(ctx: ViewCtx): void {
  const { controller } = ctx;
  const state = controller.state;
  const actions = controller.careerActions();

  weekHeader(ctx, state.week);

  DAYS.forEach((day, index) => {
    const action = actions.find((item) => item.id === calendarActionIds[index]);
    const blocked = !action || Boolean(action.disabledReason);
    dayCard(ctx, index, day, action?.id ?? "rest", cardLabel(action?.id, action?.label), index + 1 === state.day, blocked);
    if (action && !blocked) {
      const x = CARD.x0 + index * CARD.pitch;
      addHitZone(ctx.scene, ctx.layer, x, CARD.y, CARD.w, CARD.h, () => controller.runCareerAction(action.id));
    }
  });

  infoPanel(ctx, state.lastEvent || currentStage(state).nextHint);

  // This screen's back affordance (the mockup's CONTINUAR): returns to the room.
  addButton(ctx.scene, ctx.layer, CONTINUE.x, CONTINUE.y, CONTINUE.w, CONTINUE.h, "CONTINUAR", () =>
    controller.setCareerView("base"),
  {
    fill: INFO.fill,
    textColor: palette.yellow,
    size: 14,
    selected: true,
  });
}

function cardLabel(id: string | undefined, fallback: string | undefined): string {
  if (!id) return "LIBRE";
  return CARD_LABELS[id] ?? actionShortLabel(id, fallback ?? "Libre").toUpperCase();
}

// Centered "◀ SEMANA n ▶". Week navigation has no system behind it yet, so the
// arrows are drawn dim and carry no hit zone (nothing here pretends to work).
function weekHeader(ctx: ViewCtx, week: number): void {
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
  chevron(ctx, HEADER.centerX - HEADER.arrowDx, HEADER.centerY, -1);
  chevron(ctx, HEADER.centerX + HEADER.arrowDx, HEADER.centerY, 1);
}

// Stepped pixel triangle: dir -1 points left, dir 1 points right.
function chevron(ctx: ViewCtx, cx: number, cy: number, dir: -1 | 1): void {
  const steps = 4;
  const step = Math.floor(HEADER.arrowH / steps);
  for (let i = 0; i < steps; i += 1) {
    const h = HEADER.arrowH - i * step;
    const x = dir === 1 ? cx - 8 + i * 4 : cx + 4 - i * 4;
    rect(ctx, x, cy - Math.floor(h / 2), 4, h, "#6c74a8");
  }
}

function dayCard(
  ctx: ViewCtx,
  index: number,
  day: string,
  actionId: string,
  label: string,
  active: boolean,
  blocked: boolean,
): void {
  const x = CARD.x0 + index * CARD.pitch;
  const cx = x + CARD.w / 2;
  const c = CARD.chamfer;
  chamfered(ctx, x + 3, CARD.y + 4, CARD.w, CARD.h, c, CARD_COLORS.shadow, 0.4);
  chamfered(ctx, x, CARD.y, CARD.w, CARD.h, c, blocked ? CARD_COLORS.borderBlocked : CARD_COLORS.border);
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

  const iconKey = actionIconKey(actionId);
  const icon = iconKey
    ? addSpriteImage(ctx.scene, ctx.layer, iconKey, cx, CARD.iconCenterY, CARD.iconH, 0.5, 0.5, CARD.iconMaxW)
    : null;
  if (icon) icon.setAlpha(blocked ? 0.45 : 1);
  else actionIcon(ctx, actionId, cx - 13, CARD.iconCenterY - 13, blocked ? CARD_COLORS.labelBlocked : actionAccent(actionId));

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

  // Empty planning slot: weekly planning is a later gauntlet, so the frame is
  // drawn exactly as the mockup shows it and stays empty.
  dashedBox(ctx, x + CARD.slotDx, CARD.y + CARD.slotDy, CARD.slotW, CARD.slotH, CARD_COLORS.slot);

  if (active) cornerBrackets(ctx, x - 1, CARD.y - 1, CARD.w + 2, CARD.h + 2);
}

function infoPanel(ctx: ViewCtx, body: string): void {
  addPanel(ctx.scene, ctx.layer, INFO.x, INFO.y, INFO.w, INFO.h, INFO.fill);
  addDisplayText(ctx.scene, ctx.layer, INFO.x + 19, INFO.y + 15, "INFORMACION", 20, palette.yellow);
  addTextBlock(ctx.scene, ctx.layer, INFO.x + 19, INFO.y + 42, body, 13, palette.ink, INFO.w - 38);
  line(ctx, INFO.x + 19, INFO.y + INFO.h - 10, SLOT_HINT, 9, palette.muted, INFO.w - 38);
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
