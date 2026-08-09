// Main menu (mode "start" with a save present, not drafting a new career):
// layered rooftop cover, logo lockup and the vertical menu column. Geometry is
// measured off reference/screens/ChatGPT Image 15 jun 2026, 06_23_13 a.m.
// (1).png (mockup 1672x941 * 0.5742 -> 960x540).
//
// Presentation only — pointer clicks forward to GameController commands;
// keyboard is handled globally by the InputRouter (its menuFocus cursor decides what Enter does).

import Phaser from "phaser";
import { eventBus } from "../events/EventBus";
import { gameContext } from "../game/context";
import { palette } from "../ui/palette";
import {
  addAnchoredText,
  addLogoLockup,
  addMcFigure,
  addPillButton,
  addPixelTriangle,
  buildMenuBackdrop,
} from "./startShared";

const LOGO = { x: 252, y: 26, width: 418 } as const;
const BUTTON = { x: 367, w: 292, h: 45, top: 220, pitch: 52.7 } as const;
const CURSOR_X = 356;
const MC = { centerX: 280, feetY: 441, height: 168 } as const;

interface MenuEntry {
  label: string;
  onClick: () => void;
  inert?: boolean;
}

export class MenuScene extends Phaser.Scene {
  private layer!: Phaser.GameObjects.Container;

  constructor() {
    super("Menu");
  }

  create(): void {
    const backdrop = this.add.container(0, 0);
    buildMenuBackdrop(this, backdrop);
    this.layer = this.add.container(0, 0);
    const subs = [
      eventBus.on("STATE_CHANGED", () => this.redraw()),
      eventBus.on("FOCUS_CHANGED", () => this.redraw()),
      eventBus.on("MODE_CHANGED", () => this.redraw()),
    ];
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => subs.forEach((unsubscribe) => unsubscribe()));
    this.redraw();
  }

  update(_time: number, delta: number): void {
    // The backdrop is a single composited image now (see startShared), so the
    // scene only has to keep animationTime running for the shared clock.
    gameContext().controller.update(delta / 1000);
  }

  private redraw(): void {
    const { controller } = gameContext();
    this.layer.removeAll(true);
    addLogoLockup(this, this.layer, LOGO);
    addMcFigure(this, this.layer, MC);
    // The legacy options/credits/exit entries only pushed an informational
    // message; the controller exposes no such command yet, so these render with
    // the mockup look but stay inert (see handoff).
    const entries: MenuEntry[] = [
      { label: "NUEVA CARRERA", onClick: () => controller.newCareerDraft() },
      { label: "CARGAR PARTIDA", onClick: () => controller.continueCareer() },
      // No controller command exists for these yet, so they are drawn quiet
      // and unselectable instead of looking identical to the live entries
      // (a pill that does nothing is a lie). Tracked in docs/PLAN.md.
      { label: "OPCIONES", onClick: () => {}, inert: true },
      { label: "CREDITOS", onClick: () => {}, inert: true },
      { label: "SALIR", onClick: () => {}, inert: true },
    ];
    const focus = gameContext().input.menuFocus;
    entries.forEach((entry, index) => this.menuButton(entry, index, index === focus));
    addAnchoredText(this, this.layer, 33, 502, "v0.1.0", 16, "#9aaedb", 0);
    addAnchoredText(this, this.layer, 812, 499, "♪", 22, "#b8c9ef", 0);
    addAnchoredText(this, this.layer, 830, 500, "MUSICA: SI", 16, "#b8c9ef", 0);
  }

  private menuButton(entry: MenuEntry, index: number, selected: boolean): void {
    const y = BUTTON.top + Math.round(index * BUTTON.pitch);
    addPillButton(this, this.layer, BUTTON.x, y, BUTTON.w, BUTTON.h, entry.label, entry.onClick, {
      inert: entry.inert === true,
      size: 25,
      selected,
      radius: 8,
    });
    // Mockup: a solid 22x30 triangle tucked against the selected entry.
    if (selected) addPixelTriangle(this, this.layer, CURSOR_X, y + BUTTON.h / 2, 22, 30, "right", palette.yellow);
  }
}
