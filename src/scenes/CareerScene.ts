// Career screen: the room, rebuilt against its mockups (Fase 4).
//
// Mockup navigation model (reference/screens "06_34_33 a.m. (1)" = humble pieza,
// "06_34_34 a.m. (5)" = same room late in the career): the room is only HUD +
// scenery + one big five-tile action dock. No persistent nav bar, no dossier or
// event panel over the art — career goals live in the map screen, and the last
// event arrives as a transient notice that fades out. Only the scenery changes
// between the two mockups, so everything here is stage-independent chrome.
//
// Non-base views are delegated to ./careerViews. Presentation only: pointer and
// keyboard both go through the InputRouter dock slots / GameController commands.

import Phaser from "phaser";
import { eventBus } from "../events/EventBus";
import { gameContext } from "../game/context";
import { AssetRegistry, stageBackdropKey } from "../game/AssetRegistry";
import { careerDockSlots } from "../game/InputRouter";
import type { CareerDockSlot } from "../game/InputRouter";
import { palette } from "../ui/palette";
import { addDisplayText, addHitZone, addRect, addSpriteImage, addText } from "../ui/kit";
import { maxEnergy } from "../core/derived";
import { formatBlock, formatDuration } from "../systems/CalendarSystem";
import { clamp } from "../utils/math";
import { renderCareerView } from "./careerViews";
import type { CareerActionInfo, CareerView, GameState } from "../core/types";

const W = 960;
const H = 540;

// Approximate monospace advance per font px; used to ellipsize single lines
// the way legacy drawTextLine did with real canvas metrics.
const MONO_ADVANCE = 0.62;

// The room mockups are 1672x941, so every measured value below is the mockup
// pixel times 960/1672 = 0.574 (the comments keep the mockup number).
const DOCK = {
  bandY: 418, // mockup 727: the room art stops, the dock band starts
  y: 427, // mockup 743
  h: 95, // mockup 743..910
  x0: 32, // mockup 56
  tileW: 160, // mockup ~276
  gap: 21, // mockup ~40 (5 tiles + 4 gaps span 32..916)
  iconCenterY: 461, // mockup 803
  iconHeight: 52, // mockup icon boxes are 59..88 tall (sources are 64px tall)
  iconMaxWidth: 68, // keeps the wide dumbbell at the same visual weight
  labelCenterY: 502, // mockup label rows 864..887
  labelSize: 24, // display face renders at 0.7x -> ~17px caps (mockup 24)
} as const;

// Dock colours sampled from the mockup tiles, plus the unavailable-action dim
// (the mockups only show enabled tiles, so this is our own quiet state).
const TILE = {
  band: "#040e2e",
  outline: "#01040c",
  border: "#333a78",
  fill: "#08112e",
  fillFocus: "#0f1834",
  labelBlocked: "#6f7495",
  iconBlockedAlpha: 0.4,
} as const;

// Transient event notice: slim strip at the bottom of the scenery, above the
// dock, never a permanent panel over the art.
const NOTICE = {
  x: 32,
  y: 380,
  w: 884,
  h: 30,
  holdMs: 2600,
  fadeMs: 700,
} as const;

// Agenda strip (timeFx) sits directly above the notice slot so the two can be
// on screen together without ever stacking.
const AGENDA = { x: 406, y: 344, w: 510, h: 28 } as const;

// Screen bezel: the mockups frame every screen with a bright pixel line
// (mockup 12..15 -> 7..9) over a dark navy margin.
const BEZEL = { margin: 7, thickness: 2, edge: "#000b24" } as const;

function clipLine(text: string, size: number, maxWidth: number): string {
  const charW = size * MONO_ADVANCE;
  if (text.length * charW <= maxWidth) return text;
  const keep = Math.max(1, Math.floor(maxWidth / charW) - 3);
  return `${text.slice(0, keep).trimEnd()}...`;
}

// Single text line placed by its legacy alphabetic baseline (kit text is
// top-left origin, so we shift up by the font size).
function baselineText(
  scene: Phaser.Scene,
  layer: Phaser.GameObjects.Container,
  x: number,
  yBaseline: number,
  text: string,
  size: number,
  color: string,
  maxWidth = 0,
): void {
  const content = maxWidth > 0 ? clipLine(text, size, maxWidth) : text;
  addText(scene, layer, x, yBaseline - size, content, size, color);
}

interface DockVisual {
  label: string;
  iconKey: string;
}

// Presentation for each dock slot. Behaviour (action vs view) lives in
// careerDockSlots so the keyboard cursor and the tiles can never drift apart.
const DOCK_VISUALS: Record<string, DockVisual> = {
  rest: { label: "DORMIR", iconKey: AssetRegistry.icons.actionRest.key },
  train: { label: "ENTRENAR", iconKey: AssetRegistry.icons.actionTrain.key },
  write: { label: "ESCRIBIR", iconKey: AssetRegistry.icons.actionWrite.key },
  social: { label: "REDES", iconKey: AssetRegistry.icons.actionSocial.key },
  exit: { label: "SALIR", iconKey: AssetRegistry.icons.actionExit.key },
};

// Legacy formatHudNumber: thousands separated with dots.
function formatHudNumber(value: number): string {
  return String(Math.floor(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// A dock slot that runs an action is blocked when that action is unavailable
// (e.g. no energy left to write); view slots are always open.
function slotBlockedReason(slot: CareerDockSlot, actions: CareerActionInfo[]): string | undefined {
  if (!slot.actionId) return undefined;
  return actions.find((action) => action.id === slot.actionId)?.disabledReason;
}

export class CareerScene extends Phaser.Scene {
  private layer!: Phaser.GameObjects.Container;
  private noticeLayer!: Phaser.GameObjects.Container;
  private fxLayer!: Phaser.GameObjects.Container;
  // Event text currently shown by the notice; "" forces a re-show.
  private noticeText = "";
  // Milliseconds the current notice has been on screen (hold + fade).
  private noticeAge = 0;

  constructor() {
    super("Career");
  }

  create(): void {
    this.layer = this.add.container(0, 0);
    this.noticeLayer = this.add.container(0, 0);
    this.fxLayer = this.add.container(0, 0);
    // Re-entering the room (e.g. back from a battle) shows the pending event.
    this.noticeText = "";
    const subs = [
      eventBus.on("STATE_CHANGED", () => this.redraw()),
      eventBus.on("FOCUS_CHANGED", () => this.redraw()),
      eventBus.on("CAREER_VIEW_CHANGED", () => this.redraw()),
      // Repeating an action can produce the very same event text; the time jump
      // is the reliable "something happened" signal for the notice.
      eventBus.on("TIME_ADVANCED", () => {
        this.noticeText = "";
      }),
    ];
    this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => subs.forEach((u) => u()));
    this.redraw();
  }

  update(_time: number, delta: number): void {
    gameContext().controller.update(delta / 1000);
    this.updateTimeFx();
    this.fadeNotice(delta);
  }

  private redraw(): void {
    const { controller } = gameContext();
    const state = controller.state;
    const view = controller.careerView;
    this.layer.removeAll(true);

    if (view === "base") {
      const hasBackdrop = this.drawStageBackdrop(state);
      this.drawMcFigure(hasBackdrop);
      this.drawDock();
      this.drawBezel();
      this.drawHeader(state);
    } else {
      this.drawInterfaceBackdrop();
      this.drawHeader(state);
      renderCareerView(this, this.layer, view);
    }
    this.updateNotice(state, view);
  }

  // --- Backdrops ------------------------------------------------------------

  // Stage art scaled cover-style plus the legacy readability scrim bands.
  private drawStageBackdrop(state: GameState): boolean {
    const key = stageBackdropKey(state.stage);
    if (!this.textures.exists(key)) {
      addRect(this, this.layer, 0, 0, W, H, palette.deep);
      return false;
    }
    const image = this.add.image(W / 2, H / 2, key);
    image.setScale(Math.max(W / image.width, H / image.height));
    this.layer.add(image);
    // Scrim bands: with the panels gone the room can breathe, so only the strip
    // under the HUD and the very bottom keep their darkening.
    addRect(this, this.layer, 0, 0, W, 96, "#04071c", 0.42);
    addRect(this, this.layer, 0, 96, W, 120, "#0a1136", 0.12);
    addRect(this, this.layer, 0, 0, W, H, "#121a52", 0.08);
    return true;
  }

  // Legacy drawInterfaceBackdrop: night gradient, inner frame, static dots.
  private drawInterfaceBackdrop(): void {
    addRect(this, this.layer, 0, 0, W, H, "#070b22");
    addRect(this, this.layer, 0, 150, W, 90, "#091030");
    addRect(this, this.layer, 0, 240, W, 120, "#0b1238");
    addRect(this, this.layer, 0, 360, W, 100, "#0a0f2e");
    addRect(this, this.layer, 0, 460, W, 80, "#080b1e");
    addRect(this, this.layer, 10, 8, W - 20, H - 16, "#262b65", 0.42);
    addRect(this, this.layer, 14, 12, W - 28, H - 24, "#040612", 0.32);
    for (let i = 0; i < 80; i += 1) {
      const x = (i * 73) % W;
      const y = 26 + ((i * 41) % 438);
      const size = i % 7 === 0 ? 3 : 2;
      addRect(this, this.layer, x, y, size, size, i % 5 === 0 ? "#39427f" : "#1a2257");
    }
  }

  // Standing MC sprite, feet on the legacy floor line (y=312). Falls back to
  // the compact placeholder rects when the texture is missing.
  private drawMcFigure(hasBackdrop: boolean): void {
    const cx = hasBackdrop ? 392 : 284;
    if (addSpriteImage(this, this.layer, AssetRegistry.characters.mcIdle.key, cx, 312, 120, 0.5, 1)) return;
    addRect(this, this.layer, cx - 12, 276, 24, 36, "#111318");
    addRect(this, this.layer, cx - 12, 268, 24, 8, palette.red);
  }

  // Mockup screen bezel: dark navy margin plus a bright pixel line, so the room
  // art reads as a framed window instead of bleeding off the edges.
  private drawBezel(): void {
    const { margin: m, thickness: t, edge } = BEZEL;
    addRect(this, this.layer, 0, 0, W, m, edge);
    addRect(this, this.layer, 0, H - m, W, m, edge);
    addRect(this, this.layer, 0, 0, m, H, edge);
    addRect(this, this.layer, W - m, 0, m, H, edge);
    addRect(this, this.layer, m, m, W - 2 * m, t, TILE.border);
    addRect(this, this.layer, m, H - m - t, W - 2 * m, t, TILE.border);
    addRect(this, this.layer, m, m, t, H - 2 * m, TILE.border);
    addRect(this, this.layer, W - m - t, m, t, H - 2 * m, TILE.border);
  }

  // --- Top HUD ----------------------------------------------------------------

  private drawHeader(state: GameState): void {
    this.drawHudFrame(12, 10, 936, 76);
    // MC bust: the mockup sits it straight on the HUD band (no well box) at
    // roughly 105 mockup px tall; placeholder initial fallback.
    if (!addSpriteImage(this, this.layer, AssetRegistry.characters.mcBust.key, 58, 49, 60)) {
      const initial = (state.playerName.trim() || "MC").charAt(0).toUpperCase();
      addText(this, this.layer, 58, 49, initial, 26, palette.yellow).setOrigin(0.5);
    }

    // Mockup stacks label + value on one line (baseline ~44) over the bar.
    baselineText(this, this.layer, 112, 42, "ENERGIA", 16, palette.ink);
    baselineText(this, this.layer, 270, 42, `${state.energy}/${maxEnergy(state)}`, 16, palette.ink, 86);
    this.drawHudBar(112, 52, 230, 15, state.energy, maxEnergy(state), palette.green);
    baselineText(
      this,
      this.layer,
      112,
      81,
      `SEM ${state.week}.${state.day}  ${formatBlock(state.block)}`,
      10,
      palette.muted,
      150,
    );

    this.drawResourceCard(362, 22, 138, 54, "cash", "", formatHudNumber(state.cash), palette.green);
    this.drawResourceCard(516, 22, 224, 54, "fans", "FANS", formatHudNumber(state.fans), palette.blue);
    this.drawResourceCard(756, 22, 180, 54, "respect", "RESPETO", formatHudNumber(state.respect), "#7b63cc");
  }

  // Legacy drawHudFrame: layered pixel frame with sheen.
  private drawHudFrame(x: number, y: number, w: number, h: number): void {
    addRect(this, this.layer, x + 5, y + 5, w, h, "#000000", 0.38);
    addRect(this, this.layer, x, y, w, h, "#060b27");
    addRect(this, this.layer, x + 3, y + 3, w - 6, h - 6, "#0b1234");
    addRect(this, this.layer, x, y, w, 3, "#2e377f");
    addRect(this, this.layer, x, y + h - 3, w, 3, "#262e6e");
    addRect(this, this.layer, x, y, 3, h, "#5660b5");
    addRect(this, this.layer, x + w - 3, y, 3, h, "#1b2258");
    addRect(this, this.layer, x + 7, y + 7, w - 14, 2, "#ffffff", 0.14);
  }

  // Legacy drawHudBar (non-segmented variant).
  private drawHudBar(x: number, y: number, w: number, h: number, value: number, max: number, color: string): void {
    addRect(this, this.layer, x + 3, y + 3, w, h, "#000000", 0.28);
    addRect(this, this.layer, x, y, w, h, "#060814");
    addRect(this, this.layer, x, y, w, 2, "#ffffff", 0.2);
    addRect(this, this.layer, x, y + h - 2, w, 2, "#03040a");
    const fill = Math.floor((clamp(value, 0, max) / max) * w);
    if (fill > 0) {
      addRect(this, this.layer, x, y, fill, h, color);
      addRect(this, this.layer, x, y, fill, Math.max(2, Math.floor(h * 0.35)), "#ffffff", 0.14);
    }
  }

  // Legacy drawHudResourceCard with simplified rect/glyph icons.
  private drawResourceCard(
    x: number,
    y: number,
    w: number,
    h: number,
    icon: "cash" | "fans" | "respect",
    label: string,
    value: string,
    color: string,
  ): void {
    addRect(this, this.layer, x + 4, y + 4, w, h, "#000000", 0.32);
    addRect(this, this.layer, x, y, w, h, "#07102d");
    addRect(this, this.layer, x, y, w, 3, "#343d86");
    addRect(this, this.layer, x, y + h - 3, w, 3, "#111744");
    addRect(this, this.layer, x, y, 3, h, "#5660b5");
    addRect(this, this.layer, x + w - 3, y, 3, h, "#1c2359");

    const resIconKeys = {
      cash: AssetRegistry.icons.resCash.key,
      fans: AssetRegistry.icons.resFans.key,
      respect: AssetRegistry.icons.resRespect.key,
    } as const;
    if (addSpriteImage(this, this.layer, resIconKeys[icon], x + 34, y + 27, 32, 0.5, 0.5, 32)) {
      // Sprite icon drawn; skip the procedural glyph fallback below.
    } else if (icon === "cash") {
      baselineText(this, this.layer, x + 12, y + 40, "$", 36, color);
      addRect(this, this.layer, x + 34, y + 5, 3, 40, "#1d6f3c");
    } else if (icon === "fans") {
      addRect(this, this.layer, x + 29, y + 9, 12, 12, color);
      addRect(this, this.layer, x + 27, y + 23, 16, 14, color);
      addRect(this, this.layer, x + 13, y + 17, 10, 10, "#4776df");
      addRect(this, this.layer, x + 10, y + 28, 14, 10, "#4776df");
      addRect(this, this.layer, x + 47, y + 17, 10, 10, "#4776df");
      addRect(this, this.layer, x + 46, y + 28, 14, 10, "#4776df");
    } else {
      addRect(this, this.layer, x + 27, y + 5, 8, 20, color);
      addRect(this, this.layer, x + 36, y + 7, 8, 18, color);
      addRect(this, this.layer, x + 45, y + 11, 8, 16, color);
      addRect(this, this.layer, x + 20, y + 15, 10, 16, color);
      addRect(this, this.layer, x + 24, y + 25, 28, 18, color);
      addRect(this, this.layer, x + 32, y + 41, 18, 8, "#4b3c88");
      addRect(this, this.layer, x + 16, y + 22, 9, 6, "#4b3c88");
    }

    if (label) {
      baselineText(this, this.layer, x + 72, y + 25, label, 16, palette.ink);
      baselineText(this, this.layer, x + 72, y + 48, value, 20, palette.ink, w - 84);
    } else {
      baselineText(this, this.layer, x + 66, y + 40, value, 22, palette.ink, w - 68);
    }
  }

  // --- Action dock ------------------------------------------------------------

  // Mockup dock: five large tiles, each a big icon centered above an uppercase
  // label, evenly spread across the full width. The focused tile (keyboard or
  // last pointer target) gets the mockup's bright frame.
  private drawDock(): void {
    const { controller, input } = gameContext();
    // Band behind the tiles: the room art stops here in the mockup, so the gaps
    // between tiles read as chrome instead of scenery.
    addRect(this, this.layer, 0, DOCK.bandY, W, H - DOCK.bandY, TILE.band);
    const actions = controller.careerActions();
    careerDockSlots.forEach((slot, index) => {
      const visual = DOCK_VISUALS[slot.id];
      if (!visual) return;
      const x = DOCK.x0 + index * (DOCK.tileW + DOCK.gap);
      const blocked = slotBlockedReason(slot, actions) !== undefined;
      this.drawDockTile(x, visual, index === input.actionFocus, blocked);
      if (!blocked) {
        addHitZone(this, this.layer, x, DOCK.y, DOCK.tileW, DOCK.h, () =>
          gameContext().input.activateDockSlot(index),
        );
      }
    });
  }

  private drawDockTile(x: number, visual: DockVisual, focused: boolean, blocked: boolean): void {
    this.drawTileFrame(x, DOCK.y, DOCK.tileW, DOCK.h, focused);
    const cx = x + DOCK.tileW / 2;
    const icon = addSpriteImage(
      this,
      this.layer,
      visual.iconKey,
      cx,
      DOCK.iconCenterY,
      DOCK.iconHeight,
      0.5,
      0.5,
      DOCK.iconMaxWidth,
    );
    if (icon) {
      if (blocked) icon.setAlpha(TILE.iconBlockedAlpha);
    } else {
      // No icon cut yet: a plain block keeps the tile readable (Fase 3 rule).
      addRect(this, this.layer, cx - 20, DOCK.iconCenterY - 20, 40, 40, blocked ? TILE.labelBlocked : TILE.border);
    }
    const label = addDisplayText(
      this,
      this.layer,
      cx,
      DOCK.labelCenterY,
      visual.label,
      DOCK.labelSize,
      blocked ? TILE.labelBlocked : palette.ink,
    );
    label.setOrigin(0.5, 0.5).setPosition(cx, DOCK.labelCenterY);
  }

  // Chamfered box (rounded pixel corners) drawn as two overlapping rects, so
  // the frame stays crisp at 960x540 without anti-aliased curves.
  private fillChamfered(x: number, y: number, w: number, h: number, c: number, color: string): void {
    addRect(this, this.layer, x, y + c, w, h - 2 * c, color);
    addRect(this, this.layer, x + c, y, w - 2 * c, h, color);
  }

  // Mockup tile frame: near-black outline, 2px bright border, dark navy fill.
  // Focus swaps the border to ink and lifts the fill (mockup "(5)" ESCRIBIR).
  private drawTileFrame(x: number, y: number, w: number, h: number, focused: boolean): void {
    this.fillChamfered(x - 2, y - 2, w + 4, h + 4, 8, TILE.outline);
    this.fillChamfered(x, y, w, h, 7, focused ? palette.ink : TILE.border);
    this.fillChamfered(x + 2, y + 2, w - 4, h - 4, 6, focused ? TILE.fillFocus : TILE.fill);
  }

  // --- Transient event notice --------------------------------------------------

  // The last event never gets a permanent panel over the art: it shows as a
  // slim strip at the bottom of the scenery and fades out on its own.
  private updateNotice(state: GameState, view: CareerView): void {
    this.noticeLayer.setVisible(view === "base");
    if (state.lastEvent === this.noticeText) return;
    this.noticeText = state.lastEvent;
    this.noticeLayer.removeAll(true);
    this.noticeLayer.setAlpha(1);
    this.noticeAge = 0;
    if (!state.lastEvent) return;
    addRect(this, this.noticeLayer, NOTICE.x, NOTICE.y, NOTICE.w, NOTICE.h, "#04081c", 0.92);
    addRect(this, this.noticeLayer, NOTICE.x, NOTICE.y, NOTICE.w, 1, TILE.border);
    addRect(this, this.noticeLayer, NOTICE.x, NOTICE.y + NOTICE.h - 1, NOTICE.w, 1, TILE.outline);
    addRect(this, this.noticeLayer, NOTICE.x, NOTICE.y, 4, NOTICE.h, palette.yellow);
    baselineText(
      this,
      this.noticeLayer,
      NOTICE.x + 16,
      NOTICE.y + 20,
      state.lastEvent,
      12,
      palette.ink,
      NOTICE.w - 32,
    );
  }

  // Hold, then fade to nothing. Driven by the frame delta instead of a Phaser
  // tween on purpose: Phaser 4's TweenManager derives its own delta from
  // Date.now(), which the deterministic capture/trace harness freezes, and a
  // notice that never fades would be exactly the permanent panel over the art
  // that the mockup removes.
  private fadeNotice(deltaMs: number): void {
    if (this.noticeLayer.length === 0) return;
    this.noticeAge += deltaMs;
    const fading = this.noticeAge - NOTICE.holdMs;
    if (fading <= 0) return;
    const alpha = clamp(1 - fading / NOTICE.fadeMs, 0, 1);
    this.noticeLayer.setAlpha(alpha);
    if (alpha <= 0) this.noticeLayer.removeAll(true);
  }

  // --- Agenda strip (timeFx) -----------------------------------------------------

  // Legacy drawTimeAdvanceFx: rebuilt every frame while the controller's fx is
  // live, on its own layer so the eased progress animates without a full
  // redraw. Sits above the notice slot, so the two never stack.
  private updateTimeFx(): void {
    const { controller } = gameContext();
    const fx = controller.timeFx;
    this.fxLayer.removeAll(true);
    if (!fx || controller.careerView !== "base") return;

    const progress = clamp(fx.elapsed / fx.duration, 0, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const { x, y, w, h } = AGENDA;
    addRect(this, this.fxLayer, x, y, w, h, "#04081c", 0.94);
    addRect(this, this.fxLayer, x, y, 4, h, palette.yellow);
    baselineText(this, this.fxLayer, x + 14, y + 18, `Paso ${formatDuration(fx.blocks)} · ${fx.label}`, 11, palette.ink, 232);
    baselineText(this, this.fxLayer, x + 260, y + 18, `${formatBlock(fx.fromBlock)} -> ${formatBlock(fx.toBlock)}`, 10, palette.muted);
    addRect(this, this.fxLayer, x + 358, y + 11, 110, 6, "#0d0f13");
    const fill = Math.floor(110 * eased);
    if (fill > 0) addRect(this, this.fxLayer, x + 358, y + 11, fill, 6, palette.yellow);
    addRect(this, this.fxLayer, x + 358 + fill - 2, y + 7, 5, 14, palette.teal);
    if (fx.daysPassed > 0) {
      baselineText(this, this.fxLayer, x + 474, y + 18, `+${fx.daysPassed} dia`, 10, palette.yellow);
    }
  }
}
