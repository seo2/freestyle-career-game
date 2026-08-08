// Create-MC screen (mode "start" without a save, or after "Nueva carrera"):
// name entry panel over the rooftop cover backdrop (legacy drawCreateMcScreen).
// Presentation only — typing/Backspace/Enter are handled globally by the
// InputRouter; pointer clicks forward to GameController commands.

import Phaser from "phaser";
import type { GameState } from "../core/types";
import { eventBus } from "../events/EventBus";
import { gameContext } from "../game/context";
import { palette } from "../ui/palette";
import { addPanel, addRect, addText } from "../ui/kit";
import {
  CANVAS_W,
  addLogoLockup,
  addMcFigure,
  addStartButton,
  buildStartBackdrop,
  cloudDriftOffset,
  type CloudRef,
} from "./startShared";

// Legacy drawInputBox value: current name (or the default) plus a cursor that
// blinks with animationTime.
function nameFieldText(state: GameState): string {
  const cursor = Math.floor(state.animationTime * 2) % 2 === 0 ? "_" : "";
  return `${state.inputName || "MC Barrio"}${cursor}`;
}

export class CreateMcScene extends Phaser.Scene {
  private layer!: Phaser.GameObjects.Container;
  private clouds: CloudRef[] = [];
  private nameText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super("CreateMc");
  }

  create(): void {
    const backdrop = this.add.container(0, 0);
    this.clouds = buildStartBackdrop(this, backdrop).clouds;
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
    // Blinking input cursor follows animationTime without a full redraw.
    if (this.nameText && this.nameText.active) {
      const next = nameFieldText(controller.state);
      if (this.nameText.text !== next) this.nameText.setText(next);
    }
  }

  private redraw(): void {
    const { controller } = gameContext();
    const layer = this.layer;
    this.nameText = null;
    layer.removeAll(true);
    addText(this, layer, 44, 40, "2. Crear MC", 30, palette.ink);
    addPanel(this, layer, 38, 94, 884, 382);
    addLogoLockup(this, layer, 126, 128, 0.68);
    addMcFigure(this, layer, 254, 356, 1.82, 150);
    addRect(this, layer, 409, 112, 3, 334, palette.borderLo);
    addText(this, layer, 500, 141, "Nombre", 15, palette.ink);
    this.nameText = this.addInputBox(640, 130, 214, 42, nameFieldText(controller.state));
    this.addMenuField("Apodo", "Freestyler", 500, 202);
    this.addMenuField("Aspecto", "01", 500, 250);
    this.addMenuField("Color piel", "01", 500, 298);
    this.addMenuField("Voz", "01", 500, 346);
    this.addMenuField("Dificultad", "Normal", 500, 394);
    addStartButton(this, layer, 520, 430, 292, 42, "Comenzar", () => controller.startCareerFromMenu());
    if (controller.hasSave()) {
      addStartButton(this, layer, 762, 40, 118, 36, "Volver", () => controller.loadSavedIntoDraft());
    } else {
      addText(this, layer, 44, 496, "Escribe tu nombre y presiona Enter.", 12, palette.muted);
    }
  }

  // Legacy drawInputBox: dark field, yellow top edge, blinking underscore.
  private addInputBox(x: number, y: number, w: number, h: number, value: string): Phaser.GameObjects.Text {
    const layer = this.layer;
    addRect(this, layer, x, y, w, h, "#0e0f12");
    addRect(this, layer, x, y, w, 3, palette.yellow);
    addRect(this, layer, x, y + h - 3, w, 3, palette.line);
    return addText(this, layer, x + 14, y + 10, value, 18, palette.ink);
  }

  // Legacy drawMenuField: label plus boxed value framed by decorative arrows.
  private addMenuField(label: string, value: string, x: number, y: number): void {
    const layer = this.layer;
    addText(this, layer, x, y + 3, label, 15, palette.ink);
    addRect(this, layer, x + 140, y, 214, 34, "#0a0e25");
    addRect(this, layer, x + 140, y, 214, 3, palette.borderHi);
    addText(this, layer, x + 178, y + 9, value, 14, palette.ink);
    addText(this, layer, x + 154, y + 9, "<", 14, palette.ink);
    addText(this, layer, x + 326, y + 9, ">", 14, palette.ink);
  }
}
