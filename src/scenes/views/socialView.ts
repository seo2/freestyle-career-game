// Career view 7: social networks. Presentation only; forwards pointer clicks to
// controller commands. Moved verbatim out of careerViews.ts.

import { palette } from "../../ui/palette";
import { addButton, addHitZone, addPanel } from "../../ui/kit";
import { socialPostOptions } from "../../data/social";
import { formatDuration } from "../../systems/CalendarSystem";
import { clamp } from "../../utils/math";
import type { SocialPostOption } from "../../core/types";
import { line, mcFigure, rect, viewTitle } from "./viewKit";
import type { ViewCtx } from "./viewKit";

export function renderSocial(ctx: ViewCtx): void {
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
  mcFigure(ctx, x + 142, y + 120, 0.72);
  rect(ctx, x + 12, y + h - 34, w - 24, 1, "#2d356d");
  line(ctx, x + 18, y + h - 14, "Nuevo freestyle en la plaza.", 10, palette.ink, w - 36);
}
