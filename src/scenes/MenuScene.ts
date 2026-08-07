// Main menu (mode "start" with a save present, not drafting a new career):
// layered rooftop cover, logo lockup and the vertical menu button column
// (legacy drawMainMenuScreen). Presentation only — pointer clicks forward to
// GameController commands; keyboard is handled globally by the InputRouter.

import Phaser from "phaser";
import { eventBus } from "../events/EventBus";
import { gameContext } from "../game/context";
import { palette } from "../ui/palette";
import { addHitZone, addRect, addText } from "../ui/kit";
import {
  CANVAS_W,
  addLogoLockup,
  addMcPlaceholder,
  addMenuOverlay,
  buildStartBackdrop,
  cloudDriftOffset,
  type CloudRef,
} from "./startShared";

export class MenuScene extends Phaser.Scene {
  private layer!: Phaser.GameObjects.Container;
  private clouds: CloudRef[] = [];

  constructor() {
    super("Menu");
  }

  create(): void {
    const backdrop = this.add.container(0, 0);
    this.clouds = buildStartBackdrop(this, backdrop).clouds;
    addMenuOverlay(this, backdrop);
    this.layer = this.add.container(0, 0);
    const subs = [
      eventBus.on("STATE_CHANGED", () => this.redraw()),
      eventBus.on("FOCUS_CHANGED", () => this.redraw()),
      eventBus.on("MODE_CHANGED", () => this.redraw()),
    ];
    this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => subs.forEach((unsubscribe) => unsubscribe()));
    this.redraw();
  }

  update(_time: number, delta: number): void {
    const { controller } = gameContext();
    controller.update(delta / 1000);
    // Legacy cloud parallax: front copy at -drift, echo copy one canvas ahead.
    const drift = cloudDriftOffset(controller.state.animationTime);
    this.clouds.forEach((cloud, index) => {
      cloud.image.x = cloud.baseX + (index === 0 ? -drift : CANVAS_W - drift);
    });
  }

  private redraw(): void {
    const { controller } = gameContext();
    this.layer.removeAll(true);
    addLogoLockup(this, this.layer, 244, 44, 1.9);
    addMcPlaceholder(this, this.layer, 292, 432, 2.05);
    this.menuButton(368, 224, "NUEVA CARRERA", () => controller.newCareerDraft(), true);
    this.menuButton(368, 278, "CARGAR PARTIDA", () => controller.continueCareer());
    // The legacy options/credits/exit entries only pushed an informational
    // event message; the controller exposes no such command yet, so these
    // render with the legacy look but stay inert.
    this.menuButton(368, 332, "OPCIONES", () => {});
    this.menuButton(368, 386, "CREDITOS", () => {});
    this.menuButton(368, 440, "SALIR", () => {});
    addText(this, this.layer, 32, 492, "v0.1.0", 18, "#9aaedb");
    addText(this, this.layer, 810, 480, "♪", 30, "#b8c9ef");
    addText(this, this.layer, 842, 490, "MUSICA: SI", 18, "#b8c9ef");
  }

  // Legacy drawMainMenuButton: 300x44 pixel button with yellow edges and a
  // chevron cursor on the selected entry.
  private menuButton(x: number, y: number, label: string, onClick: () => void, selected = false): void {
    const layer = this.layer;
    const w = 300;
    const h = 44;
    addRect(this, layer, x + 5, y + 6, w, h, "#000000", 0.45);
    addRect(this, layer, x, y, w, h, selected ? "#171d4a" : "#101636");
    addRect(this, layer, x, y, w, 3, selected ? palette.yellow : "#5159aa");
    addRect(this, layer, x, y + h - 3, w, 3, selected ? palette.yellow : "#252a70");
    addRect(this, layer, x, y, 3, h, selected ? palette.yellow : "#5c62b5");
    addRect(this, layer, x + w - 3, y, 3, h, selected ? palette.yellow : "#242967");
    addText(this, layer, x + 48, y + 6, label, 24, selected ? palette.yellow : palette.ink);
    if (selected) {
      addRect(this, layer, x - 24, y + 13, 9, 18, palette.yellow);
      addRect(this, layer, x - 15, y + 17, 7, 10, palette.yellow);
      addRect(this, layer, x - 8, y + 20, 5, 4, palette.yellow);
    }
    addHitZone(this, layer, x, y, w, h, onClick);
  }
}
