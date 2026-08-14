// Career view: the barbería (Fase 10).
//
// It exists because the MC is a stack of layers now. Before this his look was one
// fixed sprite, so there was nothing a barber could sell — and the "aspecto" the
// player picked at creation was a label with no picture behind it.
//
// The screen is built around the mirror: the MC stands on the left at the size he
// appears nowhere else, because the whole point of the room is looking at yourself.
// Three columns of chairs on the right — corte, barba, color — each showing its
// price and marking what you are already wearing.
//
// Read-only apart from the purchase command it sends.

import { palette } from "../../ui/palette";
import { addHitZone, addPanel, addText, addDisplayText } from "../../ui/kit";
import { drawCharacter, describeLook, lookOf } from "../../ui/characterDraw";
import { barberOffers, type BarberOffer, type BarberSlot } from "../../systems/BarberSystem";
import { line, rect } from "./viewKit";
import type { ViewCtx } from "./viewKit";

const TITLE = { x: 28, y: 92, size: 26 } as const;
const MIRROR = { x: 26, y: 124, w: 268, h: 354 } as const;
const COLUMNS: { slot: BarberSlot; title: string; x: number; w: number }[] = [
  { slot: "hair", title: "CORTE", x: 306, w: 208 },
  { slot: "beard", title: "BARBA", x: 524, w: 190 },
  { slot: "color", title: "COLOR", x: 724, w: 210 },
];
const FOOTER = { x: 26, y: 486, w: 908, h: 40 } as const;

const CARD = { border: "#272c61", fill: "#070e35", dim: "#6a6f85" } as const;

export function renderBarber(ctx: ViewCtx): void {
  addDisplayText(ctx.scene, ctx.layer, TITLE.x, TITLE.y, "15. BARBERIA", TITLE.size, palette.ink);
  const cash = ctx.controller.state.cash;
  const wallet = addText(ctx.scene, ctx.layer, 0, TITLE.y + 6, `$${cash}`, 16, palette.green ?? palette.teal);
  wallet.setX(Math.round(934 - wallet.width));

  addPanel(ctx.scene, ctx.layer, MIRROR.x, MIRROR.y, MIRROR.w, MIRROR.h, "#0a1030");
  mirror(ctx);

  for (const column of COLUMNS) chairs(ctx, column);
  footerBar(ctx);
}

// The mirror: him, big, and what he is wearing in words underneath.
function mirror(ctx: ViewCtx): void {
  const state = ctx.controller.state;
  columnHeader(ctx, MIRROR.x, MIRROR.y, MIRROR.w, "EL ESPEJO");
  // Glass: a lighter well so the figure reads against it, with a frame.
  rect(ctx, MIRROR.x + 22, MIRROR.y + 36, MIRROR.w - 44, 262, "#141b45");
  rect(ctx, MIRROR.x + 22, MIRROR.y + 36, MIRROR.w - 44, 2, palette.borderHi);
  drawCharacter(ctx.scene, ctx.layer, MIRROR.x + MIRROR.w / 2, MIRROR.y + 294, 240, lookOf(state));
  line(ctx, MIRROR.x + 14, MIRROR.y + MIRROR.h - 16, describeLook(lookOf(state)), 10, palette.muted, MIRROR.w - 28);
}

function chairs(ctx: ViewCtx, column: { slot: BarberSlot; title: string; x: number; w: number }): void {
  const offers = barberOffers(ctx.controller.state, column.slot);
  addPanel(ctx.scene, ctx.layer, column.x, MIRROR.y, column.w, MIRROR.h, "#0a1030");
  columnHeader(ctx, column.x, MIRROR.y, column.w, column.title);
  offers.forEach((offer, index) => chair(ctx, column, offer, index));
}

function chair(
  ctx: ViewCtx,
  column: { slot: BarberSlot; x: number; w: number },
  offer: BarberOffer,
  index: number,
): void {
  const y = MIRROR.y + 36 + index * 42;
  const x = column.x + 10;
  const w = column.w - 20;
  // What you are wearing is marked, not hidden: a shop that lets you buy what you
  // already have is a shop that took your money for nothing.
  const canBuy = !offer.current && offer.affordable;
  rect(ctx, x, y, w, 34, offer.current ? "#141b45" : CARD.fill);
  rect(ctx, x, y, 3, 34, offer.current ? palette.yellow : canBuy ? palette.teal : CARD.border);
  line(ctx, x + 12, y + 14, offer.label, 11, offer.current ? palette.yellow : palette.ink, w - 60);
  const tag = offer.current ? "PUESTO" : `$${offer.price}`;
  const price = addText(
    ctx.scene,
    ctx.layer,
    0,
    y + 4,
    tag,
    10,
    offer.current ? palette.muted : offer.affordable ? palette.teal : palette.red,
  );
  price.setX(Math.round(x + w - 10 - price.width));
  if (!offer.current && !offer.affordable) {
    line(ctx, x + 12, y + 27, "No te alcanza.", 9, palette.red, w - 20);
  }
  if (canBuy) {
    addHitZone(ctx.scene, ctx.layer, x, y, w, 34, () => ctx.controller.buyLook(column.slot, offer.id));
  }
}

function columnHeader(ctx: ViewCtx, x: number, y: number, w: number, label: string): void {
  rect(ctx, x, y, w, 26, "#050a20");
  rect(ctx, x, y, w, 1, palette.line);
  rect(ctx, x, y + 25, w, 1, CARD.border);
  const text = addText(ctx.scene, ctx.layer, 0, 0, label, 11, palette.muted);
  text.setOrigin(0.5, 0.5).setPosition(x + w / 2, y + 13);
}

function footerBar(ctx: ViewCtx): void {
  rect(ctx, FOOTER.x, FOOTER.y, FOOTER.w, FOOTER.h, "#050a20");
  rect(ctx, FOOTER.x, FOOTER.y, FOOTER.w, 1, palette.line);
  line(ctx, 38, 506, "Un corte se paga y se nota: el MC que ves aca es el que sale a la plaza.", 10, palette.muted, 720);
  backChip(ctx, 790, 493, 128, 26);
}

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
