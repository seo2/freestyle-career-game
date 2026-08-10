// Career view 9: TIENDA, rebuilt against its mockup
// (reference/screens "ChatGPT Image 15 jun 2026, 06_43_47 a.m. (1).png": four
// category tabs over the item rows on the left, preview + description panels on
// the right). It sells the catalogue items of src/data/items.ts — the three
// abstract upgrades (outfit/estudio/base) are gone from the UI; StoreSystem
// still raises those levels internally through each item's grants.
//
// Presentation only (AGENTS.md): reads come from StoreSystem, the single command
// is controller.buyItem(id), and nothing here touches cash or the inventory.
// The active tab and the row cursor are presentation state, so they live in
// module-local variables instead of GameState.
//
// Geometry: the mockup is 1672x941 and the canvas is 960x540 (factor 0.574), so
// every constant below is the measured mockup pixel times 0.574 — horizontally
// verbatim. Vertically the screen is compressed into the 92..518 band, because
// CareerScene keeps drawing the career HUD over y 10..86 on every sub-view and
// the mockup's own header has to land under it.

import type Phaser from "phaser";
import { eventBus } from "../../events/EventBus";
import { AssetRegistry } from "../../game/AssetRegistry";
import { palette } from "../../ui/palette";
import { addButton, addDisplayText, addHitZone, addPanel, addSpriteImage, addText } from "../../ui/kit";
import { clamp } from "../../utils/math";
import { itemCategories, itemCategoryLabels } from "../../data/items";
import type { ItemCategory, ItemDef } from "../../data/items";
import {
  canAffordItem,
  findItem,
  isOwned,
  itemPrice,
  itemsByCategory,
  missingCash,
  recommendedItem,
} from "../../systems/StoreSystem";
import { line, rect } from "./viewKit";
import type { ViewCtx } from "./viewKit";

// Header: title 46..310 x 35..75, "DINERO" at 1294, value right edge 1596.
const HEAD = {
  titleX: 26,
  titleY: 98,
  titleSize: 26,
  cashLabelX: 743,
  cashValueRight: 920,
  cashCenterY: 110,
  cashLabelSize: 15,
  cashValueSize: 19,
} as const;

// One frame around both halves (33..1638 x 107..898) with a vertical rule at
// 988..995 splitting list from preview.
const FRAME = { x: 19, y: 132, w: 922, h: 386 } as const;
const DIVIDER = { x: 567, y: 142, w: 4, h: 366 } as const;

// Tabs 85..940 wide (4 tabs, ~10px gaps) x 141..217.
const TAB = { x0: 49, w: 118, gap: 6, y: 148, h: 38, size: 16 } as const;

// Item list panel 63..967 x 210..865; rows 92..940, 122 tall on a 140 pitch.
const LIST = { x: 36, y: 186, w: 519, h: 318 } as const;
const ROW = {
  x: 53,
  y0: 204,
  w: 487,
  h: 62,
  pitch: 72,
  cursorX: 37,
  cursorW: 12,
  cursorH: 18,
  iconCx: 100,
  iconH: 42,
  iconMaxW: 52,
  ruleX: 145,
  ruleDy: 10,
  labelX: 163,
  labelSize: 20,
  labelMaxW: 185,
  priceX: 358,
  priceSize: 19,
  cartCx: 505,
  cartW: 46,
  cartH: 36,
} as const;

// Row colours sampled from the mockup (white frame over 19,22,88 when selected,
// 18,20,80 over 5,8,50 otherwise).
const ROW_COLORS = {
  shadow: "#00040f",
  border: "#242c68",
  borderSelected: "#e8ebff",
  fill: "#050f38",
  fillSelected: "#131654",
  rule: "#2b3474",
  slotFill: "#00081c",
  well: "#151d4a",
  tabActiveBorder: "#5565f9",
  tabActiveFill: "#22239a",
  tabBorder: "#23206b",
  tabFill: "#0a0d39",
  buttonFill: "#1a2145",
  buttonFillSelected: "#25317a",
  dimInk: "#6f7495",
  dimFill: "#070a1e",
} as const;

// Right column: preview 1020..1610 x 148..566, description 1020..1610 x
// 584..857 with a dotted rule at 661.
const PREVIEW = { x: 586, y: 148, w: 338, h: 196, wellDx: 16, wellDy: 16 } as const;
const DESC = {
  x: 586,
  y: 354,
  w: 338,
  h: 150,
  nameY: 364,
  nameSize: 24,
  ruleY: 392,
  bodyX: 610,
  bodyY: 404,
  bodySize: 13,
  bodyWrap: 250,
  lineSpacing: 6,
  effectY: 448,
  statusY: 474,
} as const;

// The mockup has no back control (the removed nav bar used to be the way out),
// so this screen puts one in the free middle of its header: a mouse-only player
// must never be trapped in a sub-view.
const BACK = { x: 560, y: 96, w: 142, h: 34 } as const;

// Item icons cut so far (docs/ASSETS.md): the microphone and the headphones came
// straight out of this mockup's own rows, the notebook and the bed out of the
// room dock. Everything else is a pending asset and falls back to the neutral
// framed slot — no improvised shapes (project rule 2).
const ITEM_ICON_KEYS: Record<string, string> = {
  microfono: AssetRegistry.icons.battlePunchline.key,
  audifonos: AssetRegistry.icons.battleFlow.key,
  cuaderno: AssetRegistry.icons.actionWrite.key,
  colchon: AssetRegistry.icons.actionRest.key,
};

// Approximate advance per font px of the body monospace stack (same constant
// CareerScene uses to fit single lines).
const MONO_ADVANCE = 0.62;

// Active tab + the row cursor per tab. Presentation state only.
let activeCategory: ItemCategory = itemCategories[0];

// The number keys must buy the row the player is looking at, so InputRouter
// reads the visible rows of the active tab from here instead of guessing.
export function visibleShopItems(): ItemDef[] {
  return itemsByCategory(activeCategory);
}
const selectedByCategory = new Map<ItemCategory, string>();

export function renderShop(ctx: ViewCtx): void {
  const state = ctx.controller.state;
  const items = visibleItems();
  const selected = selectedItem(items);

  bindShopKeys(ctx);
  header(ctx, state.cash);
  addPanel(ctx.scene, ctx.layer, FRAME.x, FRAME.y, FRAME.w, FRAME.h);
  rect(ctx, DIVIDER.x, DIVIDER.y, DIVIDER.w, DIVIDER.h, palette.line);
  tabs(ctx);
  addPanel(ctx.scene, ctx.layer, LIST.x, LIST.y, LIST.w, LIST.h);
  const recommended = recommendedItem(state);
  items.forEach((item, index) =>
    itemRow(ctx, item, index, item.id === selected?.id, item.id === recommended?.id),
  );
  previewPanel(ctx, selected);
  descriptionPanel(ctx, selected);
  addButton(ctx.scene, ctx.layer, BACK.x, BACK.y, BACK.w, BACK.h, "VOLVER", () => ctx.controller.setCareerView("base"), {
    fill: "#050e2d",
    textColor: palette.yellow,
    size: 14,
    selected: true,
  });
}

// Rows that fit the list panel, derived from the geometry so the panel can never
// be overflowed by a longer category.
function visibleItems(): ItemDef[] {
  const rowsThatFit = Math.floor((LIST.y + LIST.h - ROW.y0) / ROW.pitch);
  return itemsByCategory(activeCategory).slice(0, rowsThatFit);
}

function selectedItem(items: ItemDef[]): ItemDef | null {
  const stored = selectedByCategory.get(activeCategory);
  const found = stored ? findItem(stored) : null;
  if (found && items.some((item) => item.id === found.id)) return found;
  return items[0] ?? null;
}

function setCategory(category: ItemCategory): void {
  if (activeCategory === category) return;
  activeCategory = category;
  redraw();
}

function selectItem(item: ItemDef): void {
  if (selectedByCategory.get(activeCategory) === item.id) return;
  selectedByCategory.set(activeCategory, item.id);
  redraw();
}

// FOCUS_CHANGED is the bus event CareerScene already redraws on for cursor
// moves; the view never emits state changes.
function redraw(): void {
  eventBus.emit("FOCUS_CHANGED", undefined);
}

// --- Keyboard row cursor ---------------------------------------------------------

// Fase 4 debt: arrows and Enter did nothing here. The global InputRouter owns
// the letter/digit hotkeys and preventDefaults Enter/Space while a sub-view is
// open, so Phaser's keyboard plugin never sees them. Same solution as
// mapView.bindNodeKeys: one window-level keydown listener bound per scene
// life, dropped on scene SHUTDOWN ("shutdown" is Phaser.Scenes.Events.SHUTDOWN,
// kept as a string to avoid a value import), that no-ops unless the shop is
// the open career view. The cursor clamps at both ends, like the room dock.
let boundScene: Phaser.Scene | null = null;

function bindShopKeys(ctx: ViewCtx): void {
  if (boundScene === ctx.scene) return;
  boundScene = ctx.scene;
  const { controller } = ctx;
  // Same module-local selection the row clicks drive, so ▶ and the preview
  // panel follow; selectItem/setCategory emit the click path's FOCUS_CHANGED.
  const moveRow = (dir: 1 | -1): void => {
    const items = visibleItems();
    const current = selectedItem(items);
    const index = current ? items.findIndex((item) => item.id === current.id) : 0;
    const next = items[clamp(index + dir, 0, items.length - 1)];
    if (next) selectItem(next);
  };
  const moveTab = (dir: 1 | -1): void => {
    const index = itemCategories.indexOf(activeCategory);
    const next = itemCategories[clamp(index + dir, 0, itemCategories.length - 1)];
    if (next) setCategory(next);
  };
  // Exactly the row's own buy control: owned rows have none and unaffordable
  // rows draw it disabled, so Enter respects the same two gates and no-ops.
  const buySelected = (): void => {
    const state = controller.state;
    const item = selectedItem(visibleItems());
    if (!item || isOwned(state, item.id) || !canAffordItem(state, item)) return;
    controller.buyItem(item.id);
  };
  const onKey = (event: KeyboardEvent): void => {
    if (controller.state.mode !== "career" || controller.careerView !== "shop") return;
    if (event.key === "ArrowDown") moveRow(1);
    else if (event.key === "ArrowUp") moveRow(-1);
    else if (event.key === "ArrowRight") moveTab(1);
    else if (event.key === "ArrowLeft") moveTab(-1);
    else if (event.key === "Enter" || event.code === "Space") buySelected();
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
  addDisplayText(ctx.scene, ctx.layer, HEAD.titleX, HEAD.titleY, "9. TIENDA", HEAD.titleSize, palette.ink);
  const label = addText(ctx.scene, ctx.layer, HEAD.cashLabelX, HEAD.cashCenterY, "DINERO", HEAD.cashLabelSize, palette.ink);
  label.setOrigin(0, 0.5).setPosition(HEAD.cashLabelX, HEAD.cashCenterY);
  const value = addText(ctx.scene, ctx.layer, 0, HEAD.cashCenterY, `$ ${cash}`, HEAD.cashValueSize, palette.green);
  value.setOrigin(1, 0.5).setPosition(HEAD.cashValueRight, HEAD.cashCenterY);
}

function tabs(ctx: ViewCtx): void {
  itemCategories.forEach((category, index) => {
    const x = TAB.x0 + index * (TAB.w + TAB.gap);
    const active = category === activeCategory;
    rect(ctx, x, TAB.y, TAB.w, TAB.h, active ? ROW_COLORS.tabActiveBorder : ROW_COLORS.tabBorder);
    rect(ctx, x + 2, TAB.y + 2, TAB.w - 4, TAB.h - 2, active ? ROW_COLORS.tabActiveFill : ROW_COLORS.tabFill);
    const label = addText(
      ctx.scene,
      ctx.layer,
      x + TAB.w / 2,
      TAB.y + TAB.h / 2,
      itemCategoryLabels[category].toUpperCase(),
      TAB.size,
      active ? palette.ink : palette.muted,
    );
    label.setOrigin(0.5, 0.5).setPosition(x + TAB.w / 2, TAB.y + TAB.h / 2);
    addHitZone(ctx.scene, ctx.layer, x, TAB.y, TAB.w, TAB.h, () => setCategory(category));
  });
}

function itemRow(ctx: ViewCtx, item: ItemDef, index: number, selected: boolean, recommended: boolean): void {
  const { controller } = ctx;
  const state = controller.state;
  const owned = isOwned(state, item.id);
  const affordable = canAffordItem(state, item);
  const dim = !owned && !affordable;
  const y = ROW.y0 + index * ROW.pitch;
  const cy = y + ROW.h / 2;

  rect(ctx, ROW.x + 3, y + 3, ROW.w, ROW.h, ROW_COLORS.shadow, 0.45);
  rect(ctx, ROW.x, y, ROW.w, ROW.h, selected ? ROW_COLORS.borderSelected : ROW_COLORS.border);
  rect(ctx, ROW.x + 2, y + 2, ROW.w - 4, ROW.h - 4, dim ? ROW_COLORS.dimFill : selected ? ROW_COLORS.fillSelected : ROW_COLORS.fill);
  addHitZone(ctx.scene, ctx.layer, ROW.x, y, ROW.w, ROW.h, () => selectItem(item));
  if (selected) cursor(ctx, cy);
  // Digit affordance: InputRouter's number keys buy visibleShopItems()[n-1],
  // which was invisible because no row printed its index. The mockup has no
  // numbers, so it stays a small muted digit tucked before the icon.
  line(ctx, ROW.x + 8, cy + 5, String(index + 1), 10, ROW_COLORS.dimInk);
  // Cheapest thing the player can actually pay for right now (StoreSystem's own
  // recommendation, the U hotkey target).
  if (recommended && !owned) rect(ctx, ROW.x + 4, y + 8, 4, ROW.h - 16, palette.yellow);

  itemIcon(ctx, item, cy, dim);
  rect(ctx, ROW.ruleX, y + ROW.ruleDy, 2, ROW.h - 2 * ROW.ruleDy, ROW_COLORS.rule);
  const ink = dim ? ROW_COLORS.dimInk : palette.ink;
  const text = item.label.toUpperCase();
  // Long names (CHAQUETA DE TARIMA) step down instead of running into the price
  // column, so no row can ever print two overlapping strings.
  const labelSize = Math.min(ROW.labelSize, Math.floor(ROW.labelMaxW / (text.length * MONO_ADVANCE)));
  const label = addText(ctx.scene, ctx.layer, ROW.labelX, cy, text, labelSize, ink);
  label.setOrigin(0, 0.5).setPosition(ROW.labelX, cy);
  const price = addText(
    ctx.scene,
    ctx.layer,
    ROW.priceX,
    cy,
    `$ ${itemPrice(item)}`,
    ROW.priceSize,
    dim ? ROW_COLORS.dimInk : palette.green,
  );
  price.setOrigin(0, 0.5).setPosition(ROW.priceX, cy);

  if (owned) {
    const tag = addText(ctx.scene, ctx.layer, ROW.cartCx, cy, "COMPRADO", 11, palette.teal);
    tag.setOrigin(0.5, 0.5).setPosition(ROW.cartCx, cy);
    return;
  }
  // Cart affordance: the cart glyph itself is a pending asset, so the buy
  // control reuses the "+" the sibling TRABAJO mockup already uses.
  addButton(
    ctx.scene,
    ctx.layer,
    ROW.cartCx - ROW.cartW / 2,
    cy - ROW.cartH / 2,
    ROW.cartW,
    ROW.cartH,
    "+",
    () => controller.buyItem(item.id),
    { fill: selected ? ROW_COLORS.buttonFillSelected : ROW_COLORS.buttonFill, size: 18, disabled: !affordable, selected },
  );
}

// Mockup row cursor: a stepped ▶ sitting on the list panel's left frame.
function cursor(ctx: ViewCtx, cy: number): void {
  const slice = 2;
  const steps = Math.floor(ROW.cursorW / slice);
  for (let i = 0; i < steps; i += 1) {
    const h = ROW.cursorH - Math.round((i / steps) * ROW.cursorH);
    if (h <= 0) return;
    rect(ctx, ROW.cursorX + i * slice, cy - Math.floor(h / 2), slice, h, palette.ink);
  }
}

// Item icon, or the neutral framed slot when the sprite is still pending.
function itemIcon(ctx: ViewCtx, item: ItemDef, cy: number, dim: boolean): void {
  const key = ITEM_ICON_KEYS[item.id];
  const icon = key ? addSpriteImage(ctx.scene, ctx.layer, key, ROW.iconCx, cy, ROW.iconH, 0.5, 0.5, ROW.iconMaxW) : null;
  if (icon) {
    if (dim) icon.setAlpha(0.4);
    return;
  }
  slot(ctx, ROW.iconCx - ROW.iconMaxW / 2, cy - ROW.iconH / 2, ROW.iconMaxW, ROW.iconH, item.label, dim);
}

// Neutral framed placeholder for a pending sprite: frame, well and monogram.
function slot(ctx: ViewCtx, x: number, y: number, w: number, h: number, label: string, dim: boolean): void {
  rect(ctx, x, y, w, h, dim ? ROW_COLORS.border : ROW_COLORS.rule);
  rect(ctx, x + 2, y + 2, w - 4, h - 4, ROW_COLORS.slotFill);
  const glyph = addText(
    ctx.scene,
    ctx.layer,
    x + w / 2,
    y + h / 2,
    label.charAt(0).toUpperCase(),
    Math.round(h * 0.5),
    dim ? ROW_COLORS.dimInk : palette.yellow,
  );
  glyph.setOrigin(0.5, 0.5).setPosition(x + w / 2, y + h / 2);
}

function previewPanel(ctx: ViewCtx, item: ItemDef | null): void {
  addPanel(ctx.scene, ctx.layer, PREVIEW.x, PREVIEW.y, PREVIEW.w, PREVIEW.h);
  const wx = PREVIEW.x + PREVIEW.wellDx;
  const wy = PREVIEW.y + PREVIEW.wellDy;
  const ww = PREVIEW.w - 2 * PREVIEW.wellDx;
  const wh = PREVIEW.h - 2 * PREVIEW.wellDy;
  rect(ctx, wx, wy, ww, wh, ROW_COLORS.well);
  rect(ctx, wx, wy, ww, 2, ROW_COLORS.rule);
  if (!item) return;
  const key = ITEM_ICON_KEYS[item.id];
  const cx = wx + ww / 2;
  const cy = wy + wh / 2;
  // Preview art is a pending asset: the cut icon stands in at display size, and
  // items without art get the neutral framed slot.
  if (key && addSpriteImage(ctx.scene, ctx.layer, key, cx, cy, Math.round(wh * 0.66), 0.5, 0.5, ww - 40)) return;
  slot(ctx, cx - 48, cy - 48, 96, 96, item.label, false);
  // Dashed frame: the same "nothing here yet" language the calendar mockup uses
  // for its empty planning slots, so a missing sprite never reads as a bug.
  dashedFrame(ctx, cx - 60, cy - 60, 120, 120, ROW_COLORS.rule);
}

function descriptionPanel(ctx: ViewCtx, item: ItemDef | null): void {
  addPanel(ctx.scene, ctx.layer, DESC.x, DESC.y, DESC.w, DESC.h);
  const cx = DESC.x + DESC.w / 2;
  if (!item) {
    const empty = addText(ctx.scene, ctx.layer, cx, DESC.y + DESC.h / 2, "Nada por ahora", 14, palette.muted);
    empty.setOrigin(0.5, 0.5).setPosition(cx, DESC.y + DESC.h / 2);
    return;
  }
  const name = addDisplayText(ctx.scene, ctx.layer, cx, DESC.nameY, item.label.toUpperCase(), DESC.nameSize, palette.yellow);
  name.setOrigin(0.5, 0).setPosition(cx, DESC.nameY);
  dottedRule(ctx, DESC.bodyX, DESC.ruleY, DESC.w - 2 * (DESC.bodyX - DESC.x));
  addText(ctx.scene, ctx.layer, DESC.bodyX, DESC.bodyY, item.description, DESC.bodySize, palette.ink, {
    wordWrap: { width: DESC.bodyWrap, useAdvancedWrap: true },
    lineSpacing: DESC.lineSpacing,
  });
  effectLine(ctx, item.effectLabel);
  statusLine(ctx, item);
}

// "+2 a PUNCHLINE": amount in green, the stat in blue, exactly as the mockup
// colours it.
function effectLine(ctx: ViewCtx, effectLabel: string): void {
  const separator = " a ";
  const cut = effectLabel.indexOf(separator);
  if (cut < 0) {
    line(ctx, DESC.bodyX, DESC.effectY + DESC.bodySize, effectLabel, DESC.bodySize, palette.green, DESC.bodyWrap);
    return;
  }
  const amount = addText(
    ctx.scene,
    ctx.layer,
    DESC.bodyX,
    DESC.effectY,
    effectLabel.slice(0, cut),
    DESC.bodySize,
    palette.green,
  );
  const joiner = addText(
    ctx.scene,
    ctx.layer,
    DESC.bodyX + amount.width,
    DESC.effectY,
    " a ",
    DESC.bodySize,
    palette.muted,
  );
  addText(
    ctx.scene,
    ctx.layer,
    DESC.bodyX + amount.width + joiner.width,
    DESC.effectY,
    effectLabel.slice(cut + separator.length).toUpperCase(),
    DESC.bodySize,
    palette.blue,
  );
}

function statusLine(ctx: ViewCtx, item: ItemDef): void {
  const state = ctx.controller.state;
  if (isOwned(state, item.id)) {
    line(ctx, DESC.bodyX, DESC.statusY + 12, "Ya lo tienes.", 12, palette.teal, DESC.bodyWrap);
    return;
  }
  const missing = missingCash(state, item);
  if (missing > 0) {
    line(ctx, DESC.bodyX, DESC.statusY + 12, `Faltan $${missing}.`, 12, palette.red, DESC.bodyWrap);
    return;
  }
  line(ctx, DESC.bodyX, DESC.statusY + 12, `Puedes comprarlo por $${itemPrice(item)}.`, 12, palette.muted, DESC.bodyWrap);
}

function dashedFrame(ctx: ViewCtx, x: number, y: number, w: number, h: number, color: string): void {
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

function dottedRule(ctx: ViewCtx, x: number, y: number, w: number): void {
  const dash = 6;
  const gap = 5;
  for (let dx = 0; dx < w; dx += dash + gap) {
    rect(ctx, x + dx, y, Math.min(dash, w - dx), 2, ROW_COLORS.rule);
  }
}
