// Career screen: persistent chrome (stage backdrop, top HUD, nav bar, agenda
// strip) plus the "base" view (status strip, dossier, home action dock).
// Non-base views are delegated to ./careerViews. Presentation only — every
// click forwards to GameController commands; layout mirrors the legacy canvas
// renderer (drawBaseCareerView and friends) with baseline-to-top-left y shifts.

import Phaser from "phaser";
import { eventBus } from "../events/EventBus";
import { gameContext } from "../game/context";
import { AssetRegistry, actionIconKey, stageBackdropKey } from "../game/AssetRegistry";
import { palette } from "../ui/palette";
import { addHitZone, addRect, addSoftPanel, addSpriteImage, addText } from "../ui/kit";
import { currentStage, maxEnergy } from "../core/derived";
import { getCareerGoals } from "../systems/ProgressionSystem";
import { formatBlock, formatDuration } from "../systems/CalendarSystem";
import { nextUpgrade, upgradeCost, upgradeLevel } from "../systems/StoreSystem";
import { upgrades } from "../data/upgrades";
import { clamp } from "../utils/math";
import { renderCareerView } from "./careerViews";
import type { CareerGoal, CareerView, GameState } from "../core/types";

const W = 960;
const H = 540;

// Approximate monospace advance per font px; used to ellipsize single lines
// the way legacy drawTextLine did with real canvas metrics.
const MONO_ADVANCE = 0.62;

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

interface NavItem {
  id: CareerView;
  label: string;
  key: string;
  accent: string;
}

// Legacy careerNavItems, labels and hotkeys byte-identical.
const NAV_ITEMS: NavItem[] = [
  { id: "base", label: "Base", key: "B", accent: palette.yellow },
  { id: "calendar", label: "Semana", key: "C", accent: palette.blue },
  { id: "map", label: "Mapa", key: "M", accent: palette.teal },
  { id: "training", label: "Entreno", key: "E", accent: palette.green },
  { id: "social", label: "Redes", key: "R", accent: palette.pink },
  { id: "work", label: "Trabajo", key: "J", accent: "#8fd36c" },
  { id: "shop", label: "Tienda", key: "T", accent: palette.yellow },
  { id: "stats", label: "Stats", key: "S", accent: palette.red },
];

interface DockItem {
  id: string;
  label: string;
  accent: string;
  // Action id in careerActions() this tile represents (for the focus cursor).
  focusId?: string;
  runAction?: string;
  goView?: CareerView;
}

// Legacy drawHomeActionDock items: run an action or jump to a view.
const DOCK_ITEMS: DockItem[] = [
  { id: "rest", label: "Dormir", accent: "#9aa0ad", focusId: "rest", runAction: "rest" },
  { id: "practice", label: "Entrenar", accent: palette.green, focusId: "practice", goView: "training" },
  { id: "write", label: "Escribir", accent: palette.blue, focusId: "write", runAction: "write" },
  { id: "social", label: "Redes", accent: palette.pink, focusId: "social", goView: "social" },
  { id: "map", label: "Mapa", accent: palette.yellow, goView: "map" },
];

// Legacy formatHudNumber: thousands separated with dots.
function formatHudNumber(value: number): string {
  return String(Math.floor(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export class CareerScene extends Phaser.Scene {
  private layer!: Phaser.GameObjects.Container;
  private fxLayer!: Phaser.GameObjects.Container;

  constructor() {
    super("Career");
  }

  create(): void {
    this.layer = this.add.container(0, 0);
    this.fxLayer = this.add.container(0, 0);
    const subs = [
      eventBus.on("STATE_CHANGED", () => this.redraw()),
      eventBus.on("FOCUS_CHANGED", () => this.redraw()),
      eventBus.on("CAREER_VIEW_CHANGED", () => this.redraw()),
    ];
    this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => subs.forEach((u) => u()));
    this.redraw();
  }

  update(_time: number, delta: number): void {
    gameContext().controller.update(delta / 1000);
    this.updateTimeFx();
  }

  private redraw(): void {
    const { controller } = gameContext();
    const state = controller.state;
    const view = controller.careerView;
    this.layer.removeAll(true);

    if (view === "base") {
      const hasBackdrop = this.drawStageBackdrop(state);
      this.drawSceneFrame(state, hasBackdrop);
      this.drawMcFigure(hasBackdrop);
      this.drawHeader(state);
      this.drawStatusStrip(state);
      this.drawDossier(684, 92, 228, 232, state);
      this.drawHomeActionDock();
    } else {
      this.drawInterfaceBackdrop();
      this.drawHeader(state);
      renderCareerView(this, this.layer, view);
    }
    this.drawNavBar(view);
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
    // Legacy drawGeneratedBackdrop shade gradient, approximated with bands.
    addRect(this, this.layer, 0, 0, W, 172, "#04071c", 0.45);
    addRect(this, this.layer, 0, 172, W, 172, "#0a1136", 0.2);
    addRect(this, this.layer, 0, 344, W, 100, "#080c24", 0.16);
    addRect(this, this.layer, 0, 444, W, 96, "#040612", 0.6);
    addRect(this, this.layer, 0, 0, W, H, "#121a52", 0.12);
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

  // Legacy drawCareerSceneFrame: stage place label over the floor line.
  private drawSceneFrame(state: GameState, hasBackdrop: boolean): void {
    const place = currentStage(state).place;
    if (hasBackdrop) {
      addRect(this, this.layer, 52, 306, 248, 20, "#090b0e", 0.54);
      addRect(this, this.layer, 52, 322, 248, 3, palette.yellow);
      baselineText(this, this.layer, 64, 320, place, 11, palette.ink, 220);
      return;
    }
    addRect(this, this.layer, 54, 308, 166, 4, palette.yellow);
    baselineText(this, this.layer, 56, 302, place, 11, palette.muted, 230);
  }

  // Standing MC sprite, feet on the legacy floor line (y=312). Falls back to
  // the compact placeholder rects when the texture is missing.
  private drawMcFigure(hasBackdrop: boolean): void {
    const cx = hasBackdrop ? 392 : 284;
    if (addSpriteImage(this, this.layer, AssetRegistry.characters.mcIdle.key, cx, 312, 120, 0.5, 1)) return;
    addRect(this, this.layer, cx - 12, 276, 24, 36, "#111318");
    addRect(this, this.layer, cx - 12, 268, 24, 8, palette.red);
  }

  // --- Top HUD ----------------------------------------------------------------

  private drawHeader(state: GameState): void {
    this.drawHudFrame(12, 10, 936, 76);
    // Bust well: MC bust sprite centered inside; placeholder initial fallback.
    addRect(this, this.layer, 28, 18, 62, 60, "#070b1e");
    addRect(this, this.layer, 28, 18, 62, 4, palette.yellow);
    addRect(this, this.layer, 28, 74, 62, 3, "#050715");
    if (!addSpriteImage(this, this.layer, AssetRegistry.characters.mcBust.key, 59, 48, 52)) {
      const initial = (state.playerName.trim() || "MC").charAt(0).toUpperCase();
      addText(this, this.layer, 59, 48, initial, 26, palette.yellow).setOrigin(0.5);
    }

    baselineText(this, this.layer, 112, 34, "ENERGIA", 16, palette.ink);
    baselineText(this, this.layer, 270, 35, `${state.energy}/${maxEnergy(state)}`, 16, palette.ink, 86);
    this.drawHudBar(112, 54, 230, 15, state.energy, maxEnergy(state), palette.green);
    baselineText(
      this,
      this.layer,
      112,
      78,
      `SEM ${state.week}.${state.day}  ${formatBlock(state.block)}`,
      10,
      palette.muted,
      150,
    );

    this.drawResourceCard(362, 22, 138, 54, "cash", "", formatHudNumber(state.cash), palette.green);
    this.drawResourceCard(516, 22, 224, 54, "fans", "FANS", formatHudNumber(state.fans), palette.blue);
    this.drawResourceCard(758, 22, 174, 54, "respect", "RESPETO", formatHudNumber(state.respect), "#7b63cc");
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

  // --- Base view --------------------------------------------------------------

  // Legacy drawBaseStatusStrip (the agenda strip is a separate fx layer).
  private drawStatusStrip(state: GameState): void {
    addSoftPanel(this, this.layer, 44, 326, 590, 44);
    baselineText(this, this.layer, 64, 352, state.lastEvent, 11, palette.ink, 540);
  }

  // Legacy drawCareerDossier: stage summary, goals, setup/upgrade shortcut.
  private drawDossier(x: number, y: number, w: number, h: number, state: GameState): void {
    const stage = currentStage(state);
    addSoftPanel(this, this.layer, x, y, w, h);
    baselineText(this, this.layer, x + 18, y + 32, "Carrera", 18, palette.ink);
    baselineText(this, this.layer, x + w - 88, y + 32, stage.title, 15, palette.yellow, 68);
    baselineText(this, this.layer, x + 18, y + 58, stage.place, 12, palette.muted, w - 36);

    addRect(this, this.layer, x + 18, y + 74, w - 36, 1, "#333842");
    baselineText(this, this.layer, x + 18, y + 94, "Objetivos", 12, palette.teal);
    getCareerGoals(state)
      .slice(0, 2)
      .forEach((goal, index) => this.drawGoalRow(x + 18, y + 108 + index * 34, w - 36, goal));

    addRect(this, this.layer, x + 18, y + 174, w - 36, 1, "#333842");
    this.drawSetupUpgrade(x + 18, y + 190, w - 36, state);
  }

  private drawGoalRow(x: number, y: number, w: number, goal: CareerGoal): void {
    baselineText(this, this.layer, x, y, goal.label, 11, palette.ink, w);
    baselineText(this, this.layer, x, y + 13, goal.detail, 9, palette.muted, w);
    addRect(this, this.layer, x, y + 19, w, 6, "#08090c", 0.92);
    const fill = Math.floor((clamp(goal.value, 0, goal.max) / goal.max) * w);
    if (fill > 0) addRect(this, this.layer, x, y + 19, fill, 6, goal.color);
  }

  // Legacy drawSetupUpgrade: setup levels, per-upgrade dots and the U-hotkey
  // recommended-upgrade button.
  private drawSetupUpgrade(x: number, y: number, w: number, state: GameState): void {
    const next = nextUpgrade(state);
    const setupText = `Setup ${state.outfitLevel}/${state.studioLevel}/${state.homeLevel}`;
    baselineText(this, this.layer, x, y, setupText, 11, palette.muted, 86);
    upgrades.forEach((upgrade, index) => {
      const level = upgradeLevel(state, upgrade.key);
      const dotX = x + 94 + index * 36;
      for (let i = 0; i < upgrade.maxLevel; i += 1) {
        addRect(this, this.layer, dotX + i * 8, y - 8, 6, 6, i < level ? upgrade.color : "#343843");
      }
    });

    const buttonY = y + 12;
    const cost = next ? upgradeCost(next, upgradeLevel(state, next.key)) : 0;
    const disabled = !next || state.cash < cost;
    const label = next ? `U ${next.shortLabel} $${cost}` : "Setup max";
    addRect(this, this.layer, x + 2, buttonY + 2, w, 26, "#000000", 0.24);
    addRect(this, this.layer, x, buttonY, w, 26, disabled ? "#12141a" : "#232a32", disabled ? 0.72 : 0.96);
    addRect(this, this.layer, x, buttonY, 4, 26, next ? next.color : palette.muted);
    baselineText(this, this.layer, x + 12, buttonY + 17, label, 11, disabled ? "#72757d" : palette.ink, 92);
    baselineText(
      this,
      this.layer,
      x + 112,
      buttonY + 17,
      next?.effect ?? "Todo listo",
      9,
      disabled ? "#676a71" : palette.muted,
      w - 120,
    );
    if (!disabled) {
      addHitZone(this, this.layer, x, buttonY, w, 26, () => gameContext().controller.buyRecommendedUpgrade());
    }
  }

  // Legacy drawHomeActionDock: five big tiles; the keyboard action cursor is
  // shown as a yellow ring on the tile whose action is focused.
  private drawHomeActionDock(): void {
    const { controller, input } = gameContext();
    const focusedId = controller.careerActions()[input.actionFocus]?.id;
    const x0 = 44;
    const y = 386;
    const w = 168;
    const h = 78;
    DOCK_ITEMS.forEach((item, index) => {
      const x = x0 + index * 178;
      const selected = item.focusId !== undefined && item.focusId === focusedId;
      addRect(this, this.layer, x + 4, y + 4, w, h, "#000000", 0.32);
      if (selected) addRect(this, this.layer, x - 2, y - 2, w + 4, h + 4, palette.yellow);
      addRect(this, this.layer, x, y, w, h, "#111836");
      addRect(this, this.layer, x, y, w, 3, item.accent);
      // Sprite pictogram in the tile's icon slot; drawn block as fallback.
      const iconKey = item.id === "map" ? AssetRegistry.icons.actionExit.key : actionIconKey(item.id);
      if (!iconKey || !addSpriteImage(this, this.layer, iconKey, x + 33, y + 35, 32, 0.5, 0.5, 34)) {
        addRect(this, this.layer, x + 18, y + 20, 30, 30, item.accent);
        addRect(this, this.layer, x + 22, y + 24, 22, 22, "#0b1026");
      }
      baselineText(this, this.layer, x + 58, y + 46, item.label, 16, palette.ink, 92);
      addHitZone(this, this.layer, x, y, w, h, () => {
        if (item.runAction) gameContext().controller.runCareerAction(item.runAction);
        else if (item.goView) gameContext().controller.setCareerView(item.goView);
      });
    });
  }

  // --- Nav bar -----------------------------------------------------------------

  // Legacy drawCareerNavBar: eight tabs, active one highlighted.
  private drawNavBar(view: CareerView): void {
    const y = 486;
    const x0 = 20;
    const w = 108;
    const h = 38;
    NAV_ITEMS.forEach((item, index) => {
      const x = x0 + index * 115;
      const active = item.id === view;
      addRect(this, this.layer, x + 3, y + 3, w, h, "#000000", 0.28);
      addRect(this, this.layer, x, y, w, h, active ? "#273064" : "#0c1230");
      addRect(this, this.layer, x, y, w, 3, active ? item.accent : "#2d356d");
      baselineText(this, this.layer, x + 10, y + 23, item.key, 11, item.accent, 18);
      baselineText(this, this.layer, x + 32, y + 24, item.label, 11, palette.ink, 66);
      addHitZone(this, this.layer, x, y, w, h, () => gameContext().controller.setCareerView(item.id));
    });
  }

  // --- Agenda strip (timeFx) -----------------------------------------------------

  // Legacy drawTimeAdvanceFx: rebuilt every frame while the controller's fx is
  // live, on its own layer so the eased progress animates without a full
  // redraw. Only shown over the base view, like the legacy status strip.
  private updateTimeFx(): void {
    const { controller } = gameContext();
    const fx = controller.timeFx;
    this.fxLayer.removeAll(true);
    if (!fx || controller.careerView !== "base") return;

    const progress = clamp(fx.elapsed / fx.duration, 0, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const x = 382;
    const y = 350;
    const w = 510;
    addRect(this, this.fxLayer, x, y, w, 28, "#12141a", 0.94);
    addRect(this, this.fxLayer, x, y, 4, 28, palette.yellow);
    baselineText(
      this,
      this.fxLayer,
      x + 14,
      y + 18,
      `Paso ${formatDuration(fx.blocks)} · ${fx.label}`,
      11,
      palette.ink,
      232,
    );
    baselineText(
      this,
      this.fxLayer,
      x + 260,
      y + 18,
      `${formatBlock(fx.fromBlock)} -> ${formatBlock(fx.toBlock)}`,
      10,
      palette.muted,
    );
    addRect(this, this.fxLayer, x + 358, y + 11, 110, 6, "#0d0f13");
    const fill = Math.floor(110 * eased);
    if (fill > 0) addRect(this, this.fxLayer, x + 358, y + 11, fill, 6, palette.yellow);
    addRect(this, this.fxLayer, x + 358 + fill - 2, y + 7, 5, 14, palette.teal);
    if (fx.daysPassed > 0) {
      baselineText(this, this.fxLayer, x + 474, y + 18, `+${fx.daysPassed} dia`, 10, palette.yellow);
    }
  }
}
