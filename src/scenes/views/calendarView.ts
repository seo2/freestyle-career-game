// Career view 4: weekly calendar. Presentation only; forwards pointer clicks
// to controller commands. Moved verbatim out of careerViews.ts.

import { actionIconKey } from "../../game/AssetRegistry";
import { palette } from "../../ui/palette";
import { addButton, addHitZone, addSoftPanel, addSpriteImage, addTextBlock } from "../../ui/kit";
import { calendarActionIds } from "../../data/actions";
import { formatDuration } from "../../systems/CalendarSystem";
import { actionAccent, actionIcon, actionShortLabel, line, rect, viewTitle } from "./viewKit";
import type { ViewCtx } from "./viewKit";

export function renderCalendar(ctx: ViewCtx): void {
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
    // Sprite pictogram for the day's action; procedural glyph as fallback.
    const iconId = action?.id ?? "rest";
    const iconKey = actionIconKey(iconId);
    const iconImage = iconKey ? addSpriteImage(ctx.scene, ctx.layer, iconKey, x + 60, y + 71, 32, 0.5, 0.5, 34) : null;
    if (iconImage) iconImage.setAlpha(disabled ? 0.5 : 1);
    else actionIcon(ctx, iconId, x + 47, y + 58, disabled ? "#555b6d" : actionAccent(iconId));
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
