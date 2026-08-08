// Career view 9: shop. Presentation only; forwards pointer clicks to controller
// commands. Mic stand and speaker stacks are still block placeholders
// (docs/ASSETS.md > Pendientes). Moved verbatim out of careerViews.ts.

import { palette } from "../../ui/palette";
import { addButton, addHitZone, addPanel, addTextBlock } from "../../ui/kit";
import { upgrades } from "../../data/upgrades";
import { nextUpgrade, upgradeCost, upgradeLevel } from "../../systems/StoreSystem";
import type { UpgradeDef } from "../../core/types";
import { line, rect, viewTitle } from "./viewKit";
import type { ViewCtx } from "./viewKit";

export function renderShop(ctx: ViewCtx): void {
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
