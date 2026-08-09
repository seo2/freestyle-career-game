// Career view 7: redes sociales, rebuilt against its mockup (Fase 4).
//
// Mockup: reference/screens "ChatGPT Image 15 jun 2026, 06_23_15 a.m. (7).png"
// (1672x941). Every measured value below is the mockup pixel times
// 960/1672 = 0.574, and the comments keep the mockup number. Measured geometry:
// one outer panel 26..1646 x 71..897 holding a full-width counter strip
// 56..1614 x 92..176, a tab chip at 56..360 x 197..268, the post list
// 56..956 x 183..868 (rows 56..937, pitch 131, height 118: icon box 100..182,
// label +154, fans chip +575, divider +724, second chip +741) and the preview
// column 976..1614 with the card on top and a big button 1039..1543 x 730..852.
//
// Deliberate deviations from the mockup:
//  * The phone/preview art and the flame icon are pending assets
//    (docs/ASSETS.md), so the card is composed from the pixel-UI kit plus the
//    MC sprites and the stage art; no procedural scenery is drawn.
//  * The mockup's per-row second value is an engagement percentage and the
//    counter strip's second cell is "ENGAGEMENT". Neither exists in our data,
//    and nothing here may invent a number, so both carry fame instead
//    (option.fame per row, state.fame in the strip) — social posts are exactly
//    what grants it.
//  * MENSAJES / NOTIFICACIONES are not implemented, so only the live PUBLICAR
//    tab is drawn rather than two dead controls.
//  * The mockup's big button reads PUBLICAR, but publishing has no target until
//    an option is picked (each row is the real command). That slot carries the
//    exit instead: with the Fase 4 nav bar gone it is the only on-screen way
//    back, and a mouse-only player would otherwise be trapped.
//
// Presentation only: every click forwards a GameController command and every
// number is read from state or from the option data (AGENTS.md).

import { AssetRegistry, stageBackdropKey } from "../../game/AssetRegistry";
import { palette } from "../../ui/palette";
import { addDisplayText, addHitZone, addPanel, addSoftPanel, addSpriteImage, addText } from "../../ui/kit";
import { socialPostOptions } from "../../data/social";
import { momentumMood } from "../../core/derived";
import { formatBlock, formatDuration } from "../../systems/CalendarSystem";
import type { SocialPostOption } from "../../core/types";
import { line, mcFigure, rect } from "./viewKit";
import type { ViewCtx } from "./viewKit";

// Screen chrome shared by the Fase 4 sub-views. Duplicated per view file on
// purpose: views/viewKit.ts is edited by the other Fase 4 screens in parallel,
// so nothing new lands there this pass (consolidation is a follow-up).
const TITLE = { x: 28, y: 92, size: 26 } as const;

const OUTER = { x: 26, y: 124, w: 908, h: 376 } as const; // mockup 26..1646 x 71..897
const STRIP = { x: 38, y: 134, w: 884, h: 42 } as const; // mockup 56..1614 x 92..176
const TAB = { x: 38, y: 182, w: 148, h: 28 } as const; // mockup 56..360 x 197..268
const LIST = { x: 38, y: 210, w: 508, h: 284 } as const; // mockup 56..956
const PREVIEW = { x: 558, y: 182, w: 364, h: 312 } as const; // mockup 976..1614

// Rows: mockup pitch 131 / height 118, scaled and tightened to the panel.
const ROW = {
  x: 52,
  y0: 222,
  w: 480,
  h: 62,
  pitch: 69,
  iconBox: 44, // mockup icon box 82 square
  labelX: 58, // mockup +154
  fansIconX: 322, // mockup +575
  fansValueX: 344, // mockup +626
  dividerX: 396, // mockup +724
  fameIconX: 414, // mockup +741
  fameValueX: 434, // mockup +788
} as const;

// Colours sampled from the mockup rows.
const ROW_COLORS = {
  border: "#272c61",
  fill: "#070e35",
  borderDim: "#141838",
  fillDim: "#05081c",
  iconBorder: "#6f7488",
  iconFill: "#0b0d14",
  textDim: "#6a6f85",
} as const;

export function renderSocial(ctx: ViewCtx): void {
  const state = ctx.controller.state;

  addDisplayText(ctx.scene, ctx.layer, TITLE.x, TITLE.y, "7. REDES SOCIALES", TITLE.size, palette.ink);
  addPanel(ctx.scene, ctx.layer, OUTER.x, OUTER.y, OUTER.w, OUTER.h, "#0a1030");

  counterStrip(ctx, state.fans, state.fame);
  publishTab(ctx);
  addPanel(ctx.scene, ctx.layer, LIST.x, LIST.y, LIST.w, LIST.h, "#070c26");
  socialPostOptions.forEach((option, index) => postRow(ctx, option, index));

  addPanel(ctx.scene, ctx.layer, PREVIEW.x, PREVIEW.y, PREVIEW.w, PREVIEW.h, "#070c26");
  const previewLabel = addText(ctx.scene, ctx.layer, 0, 0, "VISTA PREVIA", 13, palette.muted);
  previewLabel.setOrigin(0.5, 0.5).setPosition(PREVIEW.x + PREVIEW.w / 2, PREVIEW.y + 16);
  previewCard(ctx, 572, 210, 336, 194);
  exitButton(ctx, 594, 416, 288, 50);
  line(ctx, 700, 486, "o presiona ESC", 9, palette.muted, 180);
}

// Full-width counter strip: followers and fame, both straight from state.
function counterStrip(ctx: ViewCtx, fans: number, fame: number): void {
  const { x, y, w, h } = STRIP;
  rect(ctx, x, y, w, h, "#050a20");
  rect(ctx, x, y, w, 1, palette.line);
  rect(ctx, x, y + h - 1, w, 1, ROW_COLORS.border);
  rect(ctx, x + w / 2, y + 5, 1, h - 10, palette.line);

  line(ctx, x + 112, y + 29, "SEGUIDORES", 19, palette.ink, 190);
  addSpriteImage(ctx.scene, ctx.layer, AssetRegistry.icons.resFans.key, x + 288, y + h / 2, 26, 0.5, 0.5, 30);
  line(ctx, x + 314, y + 29, String(fans), 19, palette.blue, 120);

  line(ctx, x + 586, y + 29, "FAMA", 19, palette.ink, 84);
  fameGlyph(ctx, x + 680, y + h / 2, palette.yellow);
  line(ctx, x + 706, y + 29, String(fame), 19, palette.yellow, 120);
}

// Only the live tab is drawn: mensajes/notificaciones do not exist yet, and a
// dead control that looks clickable is worse than no control.
function publishTab(ctx: ViewCtx): void {
  const { x, y, w, h } = TAB;
  rect(ctx, x, y, w, h, palette.borderHi);
  rect(ctx, x + 2, y + 2, w - 4, h - 4, "#2a3480");
  const label = addText(ctx.scene, ctx.layer, 0, 0, "PUBLICAR", 12, palette.ink);
  label.setOrigin(0.5, 0.5).setPosition(x + w / 2, y + h / 2);
}

// One post option. Rows without enough energy are dimmed and carry no hit zone.
function postRow(ctx: ViewCtx, option: SocialPostOption, index: number): void {
  const { controller } = ctx;
  const enabled = controller.state.energy >= option.energy;
  const y = ROW.y0 + index * ROW.pitch;
  const publish = (): void => controller.publishSocialPost(option);

  rect(ctx, ROW.x + 3, y + 3, ROW.w, ROW.h, "#000000", 0.3);
  rect(ctx, ROW.x, y, ROW.w, ROW.h, enabled ? ROW_COLORS.border : ROW_COLORS.borderDim);
  rect(ctx, ROW.x + 2, y + 2, ROW.w - 4, ROW.h - 4, enabled ? ROW_COLORS.fill : ROW_COLORS.fillDim);
  if (enabled) addHitZone(ctx.scene, ctx.layer, ROW.x, y, ROW.w, ROW.h, publish);

  postIcon(ctx, index, ROW.x + 8, y + 9, enabled);
  line(
    ctx,
    ROW.x + ROW.labelX,
    y + 29,
    `${index + 1}. ${option.label.toUpperCase()}`,
    15,
    enabled ? palette.ink : ROW_COLORS.textDim,
    248,
  );
  line(
    ctx,
    ROW.x + ROW.labelX,
    y + 47,
    `-${option.energy} energia · ${formatDuration(option.blocks)}`,
    10,
    palette.muted,
    248,
  );

  const fansIcon = addSpriteImage(
    ctx.scene,
    ctx.layer,
    AssetRegistry.icons.resFans.key,
    ROW.x + ROW.fansIconX,
    y + ROW.h / 2,
    20,
    0.5,
    0.5,
    24,
  );
  if (fansIcon) fansIcon.setAlpha(enabled ? 1 : 0.4);
  line(
    ctx,
    ROW.x + ROW.fansValueX,
    y + 36,
    `+${option.fans}`,
    15,
    enabled ? palette.blue : ROW_COLORS.textDim,
    52,
  );
  rect(ctx, ROW.x + ROW.dividerX, y + 14, 1, ROW.h - 28, palette.line);
  fameGlyph(ctx, ROW.x + ROW.fameIconX, y + ROW.h / 2, enabled ? palette.yellow : ROW_COLORS.textDim);
  line(
    ctx,
    ROW.x + ROW.fameValueX,
    y + 36,
    `+${option.fame}`,
    15,
    enabled ? palette.yellow : ROW_COLORS.textDim,
    44,
  );
}

// Per-option pictogram from the icons already cut (docs/ASSETS.md); the
// mockup's clapper/camera/frame art is still pending.
const postIconKeys = [
  AssetRegistry.icons.battlePunchline.key,
  AssetRegistry.icons.actionSocial.key,
  AssetRegistry.icons.battleRespuesta.key,
  AssetRegistry.icons.battleHumor.key,
];

function postIcon(ctx: ViewCtx, index: number, x: number, y: number, enabled: boolean): void {
  const size = ROW.iconBox;
  rect(ctx, x, y, size, size, enabled ? ROW_COLORS.iconBorder : ROW_COLORS.borderDim);
  rect(ctx, x + 2, y + 2, size - 4, size - 4, ROW_COLORS.iconFill);
  const key = postIconKeys[index % postIconKeys.length];
  const icon = addSpriteImage(
    ctx.scene,
    ctx.layer,
    key,
    x + size / 2,
    y + size / 2,
    size - 10,
    0.5,
    0.5,
    size - 8,
  );
  if (icon) icon.setAlpha(enabled ? 1 : 0.4);
  else rect(ctx, x + 10, y + 10, size - 20, size - 20, palette.pink, enabled ? 1 : 0.4);
}

// Post card: the profile header, the MC on the stage art of the current stage,
// the last career beat as the caption and the real momentum reading. No
// like/comment counters — those numbers do not exist in GameState.
function previewCard(ctx: ViewCtx, x: number, y: number, w: number, h: number): void {
  const state = ctx.controller.state;
  rect(ctx, x, y, w, h, ROW_COLORS.border);
  rect(ctx, x + 2, y + 2, w - 4, h - 4, "#0b0f28");

  if (!addSpriteImage(ctx.scene, ctx.layer, AssetRegistry.characters.mcBust.key, x + 30, y + 26, 32)) {
    line(ctx, x + 24, y + 32, (state.playerName.trim() || "MC").charAt(0).toUpperCase(), 18, palette.yellow);
  }
  line(ctx, x + 54, y + 24, state.playerName, 13, palette.ink, 180);
  line(
    ctx,
    x + 54,
    y + 38,
    `SEM ${state.week}.${state.day} · ${formatBlock(state.block)}`,
    9,
    palette.muted,
    180,
  );

  const imageY = y + 46;
  const imageH = 96;
  rect(ctx, x + 8, imageY, w - 16, imageH, "#04061a");
  coverImage(ctx, stageBackdropKey(state.stage), x + 8, imageY, w - 16, imageH);
  mcFigure(ctx, x + w / 2, imageY + imageH - 26, 0.78);

  line(ctx, x + 12, imageY + imageH + 18, state.lastEvent, 10, palette.ink, w - 24);
  addSoftPanel(ctx.scene, ctx.layer, x + 8, y + h - 28, w - 16, 22);
  line(ctx, x + 20, y + h - 12, `RITMO ${state.momentum}`, 10, palette.teal, 110);
  line(ctx, x + 128, y + h - 12, momentumMood(state), 10, palette.muted, 120);
}

// Backdrop art scaled to cover a box and cropped to it, so the post image reads
// as full-bleed instead of a letterboxed thumbnail (addSpriteImage alone only
// ever contains).
function coverImage(ctx: ViewCtx, key: string, x: number, y: number, w: number, h: number): void {
  const image = addSpriteImage(ctx.scene, ctx.layer, key, x + w / 2, y + h / 2, h, 0.5, 0.5);
  if (!image || image.width <= 0 || image.height <= 0) return;
  const scale = Math.max(w / image.width, h / image.height);
  image.setScale(scale);
  image.setCrop((image.width - w / scale) / 2, (image.height - h / scale) / 2, w / scale, h / scale);
}

// No star/flame icon has been cut yet (docs/ASSETS.md), so fame is marked with
// a plump four-point pixel star composed from kit rects.
function fameGlyph(ctx: ViewCtx, cx: number, cy: number, color: string): void {
  rect(ctx, cx - 2, cy - 10, 4, 20, color);
  rect(ctx, cx - 10, cy - 2, 20, 4, color);
  rect(ctx, cx - 4, cy - 6, 8, 12, color);
  rect(ctx, cx - 6, cy - 4, 12, 8, color);
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
