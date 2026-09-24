// The prologue (Fase 12 E): the career's first minute is on a stage, not in a
// bedroom.
//
// Two beats around one real battle. Before it: the plaza, the crowd, the rival
// already waiting, and why you are up there (you were signed up without being
// asked). After it: what the plaza made of you, and what the room is for now.
// The battle between them is the ordinary Battle scene with state.battle.intro
// set, so the spectacle is the same one the rest of the career gets.
//
// Presentation only: the words are data (src/data/intro.ts), every button is a
// GameController command, and the keys are claimed here like the other
// own-screen modes (Enter plays / closes, Esc skips).

import Phaser from "phaser";
import { eventBus } from "../events/EventBus";
import { gameContext } from "../game/context";
import { battleBackdropKey } from "../game/AssetRegistry";
import { hex, palette } from "../ui/palette";
import { addButton, addDisplayText, addRect, addText } from "../ui/kit";
import { EasedValue, Pulse } from "../ui/fx";
import { fillIntro, introClosing, introOpening, introSkipLabel } from "../data/intro";
import type { IntroBeat } from "../data/intro";
import { IntroConfig } from "../data/config/IntroConfig";
import { BattleSpectacle } from "./battleSpectacle";
import { BattleDraw, FRAME } from "./battleDraw";

const W = 960;
const H = 540;

const PANEL = { x: 246, y: 108, w: 468, h: 276 } as const;
const PRIMARY = { x: 330, y: 398, w: 300, h: 40 } as const;
const SKIP = { x: 646, y: 404, w: 96, h: 28 } as const;
// The crowd before the battle: curious, not yet on your side.
const CROWD_WAITING_HYPE = 55;

export class IntroScene extends Phaser.Scene {
  private layer!: Phaser.GameObjects.Container;
  private draw!: BattleDraw;
  private spectacle!: BattleSpectacle;
  private enter = new Pulse(420);
  // Lines arrive one after another, like the epilogue: a beat is read.
  private reveal = new EasedValue(0, 320);
  private lines: { text: Phaser.GameObjects.Text; appearAt: number }[] = [];
  private keyHandler: ((event: KeyboardEvent) => void) | null = null;

  constructor() {
    super("Intro");
  }

  create(): void {
    this.cameras.main.setBackgroundColor(hex(palette.deep));
    const key = battleBackdropKey(gameContext().controller.state.stage);
    if (this.textures.exists(key)) {
      const image = this.add.image(W / 2, H / 2, key);
      image.setScale(Math.max(W / image.width, H / image.height));
    }
    this.add.rectangle(W / 2, H / 2, W, H, hex("#050818"), 1).setAlpha(0.42);
    this.spectacle = new BattleSpectacle(this);
    this.spectacle.buildPerformers();
    this.spectacle.buildCrowd();
    this.layer = this.add.container(0, 0);
    this.spectacle.raiseShouts();
    this.draw = new BattleDraw(this, this.layer);

    // Back from the battle: the room reacts to how it went.
    const outcome = gameContext().controller.introOutcome;
    if (outcome) this.spectacle.onFinal(outcome === "win");

    const subs = [
      eventBus.on("STATE_CHANGED", () => this.redraw()),
      eventBus.on("FOCUS_CHANGED", () => this.redraw()),
    ];
    this.keyHandler = (event: KeyboardEvent) => this.handleKey(event);
    window.addEventListener("keydown", this.keyHandler, true);
    this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
      subs.forEach((off) => off());
      if (this.keyHandler) window.removeEventListener("keydown", this.keyHandler, true);
      this.keyHandler = null;
    });
    this.enter.restart();
    this.reveal.snap(0);
    this.reveal.target = 1;
    this.redraw();
  }

  update(_time: number, delta: number): void {
    gameContext().controller.update(delta / 1000);
    this.spectacle.update(delta, CROWD_WAITING_HYPE);
    this.layer.setAlpha(this.enter.advance(delta));
    const revealed = this.reveal.advance(delta);
    for (const line of this.lines) {
      line.text.setAlpha(Math.max(0, Math.min(1, (revealed - line.appearAt) / 0.3)));
    }
  }

  private handleKey(event: KeyboardEvent): void {
    const { controller } = gameContext();
    if (controller.state.mode !== "intro") return;
    const confirm = event.key === "Enter" || event.code === "Space";
    if (confirm) this.primary();
    else if (event.key === "Escape") controller.closeIntro();
    else return;
    // The global router must not also act on the key that moved this screen.
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }

  // Before the battle: take the stage. After it: go home.
  private primary(): void {
    const { controller } = gameContext();
    if (controller.introOutcome) controller.closeIntro();
    else controller.startIntroBattle();
  }

  private beat(): IntroBeat {
    const outcome = gameContext().controller.introOutcome;
    return outcome ? introClosing[outcome] : introOpening;
  }

  private redraw(): void {
    this.layer.removeAll(true);
    this.lines = [];
    const { controller } = gameContext();
    if (controller.state.mode !== "intro") return;
    const beat = this.beat();
    const rival = IntroConfig.rivalName;
    const after = controller.introOutcome !== null;

    const { x, y, w, h } = PANEL;
    addRect(this, this.layer, x + 4, y + 5, w, h, "#000000", 0.4);
    addRect(this, this.layer, x, y, w, h, palette.deep, 0.93);
    this.draw.frame(x, y, w, h, FRAME);
    addRect(this, this.layer, x, y, w, 3, palette.yellow);

    this.draw.centeredText(W / 2, y + 20, fillIntro(beat.kicker, rival).toUpperCase(), 12, palette.yellow);
    const title = addDisplayText(this, this.layer, W / 2, y + 62, fillIntro(beat.title, rival).toUpperCase(), 26, palette.ink);
    if (title.width > w - 32) title.setScale((w - 32) / title.width);
    title.setOrigin(0.5, 0.5).setPosition(W / 2, y + 62);

    // Stacked by their real height, so a one-line beat and a wrapped one keep
    // the same gap between them.
    let cursor = y + 100;
    beat.lines.forEach((content, index) => {
      const text = addText(this, this.layer, x + 30, cursor, fillIntro(content, rival, controller.state.playerName), 13, palette.ink, {
        wordWrap: { width: w - 60, useAdvancedWrap: true },
        lineSpacing: 3,
      });
      cursor += text.height + 12;
      text.setAlpha(0);
      this.lines.push({ text, appearAt: index * 0.3 });
    });

    addButton(this, this.layer, PRIMARY.x, PRIMARY.y, PRIMARY.w, PRIMARY.h, beat.button, () => this.primary(), {
      fill: "#11183a",
      textColor: palette.yellow,
      size: 16,
      selected: true,
    });
    if (!after) {
      addButton(this, this.layer, SKIP.x, SKIP.y, SKIP.w, SKIP.h, introSkipLabel, () => controller.closeIntro(), {
        fill: "#0a0f28",
        textColor: palette.muted,
        size: 11,
      });
    }
    const hint = after ? "Enter para seguir" : "Enter para subir · Esc para saltar";
    this.draw.centeredText(W / 2, PRIMARY.y + PRIMARY.h + 8, hint, 10, palette.muted);
  }
}
