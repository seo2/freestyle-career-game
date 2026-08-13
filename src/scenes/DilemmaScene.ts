// The dilemma screen (Fase 7): the loop stops and asks.
//
// The owner's principle is "mismo origen, destinos distintos", so a choice that
// shapes who you become gets a screen of its own instead of a line in the event
// feed. Both options are shown with what they cost as plainly as what they pay —
// the Bible's rule is that neither is the right answer, and hiding a cost would
// break that.
//
// Presentation only: it reads the pending dilemma and sends one command.

import Phaser from "phaser";
import { eventBus } from "../events/EventBus";
import { gameContext } from "../game/context";
import { AssetRegistry, battleBackdropKey } from "../game/AssetRegistry";
import { hex, palette } from "../ui/palette";
import { addHitZone, addRect, addSpriteImage, addText, addTextBlock } from "../ui/kit";
import { DilemmaConfig } from "../data/config/DilemmaConfig";
import { axisLean, findDilemma } from "../systems/DilemmaSystem";
import { BattleDraw, FRAME, HYPE_ORANGE, LABEL_CYAN } from "./battleDraw";
import { Pulse } from "../ui/fx";
import type { DilemmaDef, DilemmaOption, IdentityAxis } from "../core/types";

const W = 960;
const H = 540;

// The question sits high; the two answers fill the bottom half, side by side, so
// the screen reads as a fork and not as a list.
const QUESTION = { x: 96, y: 92, w: 768, h: 116 } as const;
const OPTION = { y: 240, w: 372, h: 214, gap: 24 } as const;

const AXIS_ORDER: IdentityAxis[] = [
  "undergroundComercial",
  "batalleroMusico",
  "soloCrew",
  "autenticoPolemico",
];

export class DilemmaScene extends Phaser.Scene {
  private layer!: Phaser.GameObjects.Container;
  private draw!: BattleDraw;
  private focus = 0;
  private enter = new Pulse(220);
  private keyHandler: ((event: KeyboardEvent) => void) | null = null;

  constructor() {
    super("Dilemma");
  }

  create(): void {
    this.cameras.main.setBackgroundColor(hex(palette.deep));
    this.buildBackdrop();
    this.layer = this.add.container(0, 0);
    this.draw = new BattleDraw(this, this.layer);
    this.focus = 0;
    this.enter.restart();

    const subs = [
      eventBus.on("STATE_CHANGED", () => this.redraw()),
      eventBus.on("MODE_CHANGED", () => this.redraw()),
    ];
    // Same pattern as the cypher: capture phase and stop propagation, or the
    // global router acts on the very key that answered the dilemma.
    this.keyHandler = (event: KeyboardEvent) => this.handleKey(event);
    window.addEventListener("keydown", this.keyHandler, true);
    this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
      subs.forEach((off) => off());
      if (this.keyHandler) window.removeEventListener("keydown", this.keyHandler, true);
      this.keyHandler = null;
    });
    this.redraw();
  }

  update(_time: number, delta: number): void {
    gameContext().controller.update(delta / 1000);
    // The question fades in: a decision should not appear mid-blink.
    const progress = this.enter.advance(delta);
    this.layer.setAlpha(progress);
  }

  private handleKey(event: KeyboardEvent): void {
    const { controller } = gameContext();
    if (controller.state.mode !== "dilemma") return;
    const dilemma = this.current();
    if (!dilemma) return;
    const confirm = event.key === "Enter" || event.code === "Space";

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      this.focus = Math.min(this.focus + 1, dilemma.options.length - 1);
      this.redraw();
      this.claim(event);
      return;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      this.focus = Math.max(this.focus - 1, 0);
      this.redraw();
      this.claim(event);
      return;
    }
    const digit = Number(event.key);
    if (Number.isInteger(digit) && digit >= 1 && digit <= dilemma.options.length) {
      controller.answerDilemma(dilemma.options[digit - 1].id);
      this.claim(event);
      return;
    }
    if (confirm) {
      controller.answerDilemma(dilemma.options[this.focus].id);
      this.claim(event);
    }
  }

  // A key this screen answered is a key nobody else gets.
  private claim(event: KeyboardEvent): void {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }

  private current(): DilemmaDef | null {
    const id = gameContext().controller.state.pendingDilemma;
    return id ? findDilemma(id) : null;
  }

  private buildBackdrop(): void {
    const key = battleBackdropKey(gameContext().controller.state.stage);
    if (this.textures.exists(key)) {
      const image = this.add.image(W / 2, H / 2, key);
      const source = this.textures.get(key).getSourceImage();
      image.setScale(Math.max(W / source.width, H / source.height));
    }
    // Heavier scrim than the cypher: here the words are the screen.
    this.add.rectangle(W / 2, H / 2, W, H, hex("#04060f"), 1).setAlpha(0.72);
    const bust = AssetRegistry.characters.mcBust.key;
    if (this.textures.exists(bust)) {
      const container = this.add.container(0, 0);
      addSpriteImage(this, container, bust, 74, 60, 74);
    }
  }

  private redraw(): void {
    this.layer.removeAll(true);
    const dilemma = this.current();
    if (!dilemma) return;

    addRect(this, this.layer, 14, 14, W - 28, 4, "#303979");
    addRect(this, this.layer, 14, H - 18, W - 28, 4, "#202761");
    addRect(this, this.layer, 14, 14, 4, H - 28, "#5660b5");
    addRect(this, this.layer, W - 18, 14, 4, H - 28, "#1b2258");

    this.draw.centeredText(W / 2, 40, "TIENES QUE DECIDIR", 14, HYPE_ORANGE);
    this.draw.centeredDisplayText(W / 2, 56, dilemma.title.toUpperCase(), 22, palette.yellow);

    addRect(this, this.layer, QUESTION.x, QUESTION.y, QUESTION.w, QUESTION.h, palette.deep, 0.9);
    this.draw.frame(QUESTION.x, QUESTION.y, QUESTION.w, QUESTION.h, FRAME);
    addTextBlock(this, this.layer, QUESTION.x + 20, QUESTION.y + 18, dilemma.text, 15, palette.ink, QUESTION.w - 40);

    const total = dilemma.options.length * OPTION.w + (dilemma.options.length - 1) * OPTION.gap;
    const startX = Math.round((W - total) / 2);
    dilemma.options.forEach((option, index) => {
      this.drawOption(option, startX + index * (OPTION.w + OPTION.gap), index === this.focus, index);
    });

    this.draw.centeredText(W / 2, H - 42, "NO HAY RESPUESTA CORRECTA: LO QUE ELIJAS TE VA DEFINIENDO", 11, palette.muted);
  }

  // One side of the fork: what it does, what it costs, and which way it moves
  // you. The axis line is the honest part — it says who you become, not just
  // what you get.
  private drawOption(option: DilemmaOption, x: number, focused: boolean, index: number): void {
    addRect(this, this.layer, x + 3, OPTION.y + 4, OPTION.w, OPTION.h, "#000000", 0.34);
    addRect(this, this.layer, x, OPTION.y, OPTION.w, OPTION.h, palette.panel, 0.94);
    this.draw.frame(x, OPTION.y, OPTION.w, OPTION.h, focused ? palette.yellow : FRAME);
    addText(this, this.layer, x + 12, OPTION.y + 10, `${index + 1}`, 11, palette.muted);
    this.draw.fittedCenteredText(
      x + OPTION.w / 2,
      OPTION.y + 24,
      option.label.toUpperCase(),
      17,
      focused ? palette.yellow : palette.ink,
      OPTION.w - 32,
    );
    addTextBlock(this, this.layer, x + 16, OPTION.y + 54, option.detail, 13, palette.ink, OPTION.w - 32);

    // The price and the payoff, in the same list and the same size: hiding the
    // cost would make one side look like the right answer.
    const effects = this.effectLines(option);
    effects.forEach((line, row) => {
      addText(this, this.layer, x + 16, OPTION.y + 116 + row * 16, line.text, 12, line.color);
    });

    // The label already carries the direction, so the number is a magnitude:
    // "Batallero -6" read as a penalty when it actually means moving toward it.
    const axisLines = (Object.entries(option.axes) as [IdentityAxis, number][]).map(([axis, delta]) => {
      const labels = DilemmaConfig.axes.labels[axis];
      return `${delta > 0 ? labels.high : labels.low} +${Math.abs(delta)}`;
    });
    if (axisLines.length > 0) {
      addText(this, this.layer, x + 16, OPTION.y + OPTION.h - 44, "TE MUEVE HACIA", 10, palette.muted);
      addTextBlock(
        this,
        this.layer,
        x + 16,
        OPTION.y + OPTION.h - 30,
        axisLines.join("  ·  "),
        12,
        LABEL_CYAN,
        OPTION.w - 32,
      );
    }
    addHitZone(this, this.layer, x, OPTION.y, OPTION.w, OPTION.h, () =>
      gameContext().controller.answerDilemma(option.id),
    );
  }

  // Resource effects as text, green for what you gain and red for what it takes.
  private effectLines(option: DilemmaOption): { text: string; color: string }[] {
    const rows: { text: string; color: string }[] = [];
    const push = (value: number | undefined, label: string): void => {
      if (!value) return;
      rows.push({
        text: `${value > 0 ? "+" : ""}${value} ${label}`,
        color: value > 0 ? palette.green : palette.red,
      });
    };
    push(option.cash, "plata");
    push(option.fans, "fans");
    push(option.respect, "respeto");
    push(option.fame, "fama");
    push(option.health, "salud");
    push(option.energy, "energia");
    push(option.momentum, "impulso");
    return rows;
  }

  // The identity readout the stats screen also uses, kept here so the player can
  // see where they already lean while deciding.
  static leanLabel(axes: Parameters<typeof axisLean>[0], axis: IdentityAxis): string {
    const lean = axisLean(axes, axis);
    return lean.label;
  }

  static axisOrder(): IdentityAxis[] {
    return AXIS_ORDER;
  }
}
