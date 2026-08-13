// The epilogue screen (Fase 7): a chapter closes and the game tells you who you
// became.
//
// Nothing here is canned. Every line comes from what the player actually did —
// the axes they moved, the decisions they made in that stage, the battles and the
// weeks it took — so this screen is a mirror, not a cutscene. A player who never
// leaned anywhere reads that too, which is the honest answer.
//
// Presentation only: it reads the epilogue the system composed and sends one
// command to close it.

import Phaser from "phaser";
import { eventBus } from "../events/EventBus";
import { gameContext } from "../game/context";
import { stageBackdropKey } from "../game/AssetRegistry";
import { hex, palette } from "../ui/palette";
import { addHitZone, addRect, addText, addTextBlock } from "../ui/kit";
import { buildEpilogue, nextStageTitle } from "../systems/EpilogueSystem";
import { BattleDraw, FRAME, HYPE_ORANGE, LABEL_CYAN } from "./battleDraw";
import { EasedValue, Pulse } from "../ui/fx";
import type { Epilogue } from "../systems/EpilogueSystem";

const W = 960;
const H = 540;

const CHAPTER = { x: 60, y: 118, w: 560, h: 268 } as const;
const LEDGER = { x: 644, y: 118, w: 256, h: 268 } as const;
const OPENS = { x: 60, y: 402, w: 840, h: 58 } as const;

export class EpilogueScene extends Phaser.Scene {
  private layer!: Phaser.GameObjects.Container;
  private draw!: BattleDraw;
  private enter = new Pulse(420);
  // The lines arrive one after another: a chapter should be read, not dumped.
  private reveal = new EasedValue(0, 260);
  // Handles to the chapter lines: the reveal has to be applied EVERY FRAME. The
  // first version set the alpha once at draw time, so the lines were drawn
  // invisible and stayed invisible — the same trap as a frozen tween.
  private chapterBlocks: { text: Phaser.GameObjects.Text; appearAt: number }[] = [];
  private keyHandler: ((event: KeyboardEvent) => void) | null = null;

  constructor() {
    super("Epilogue");
  }

  create(): void {
    this.cameras.main.setBackgroundColor(hex(palette.deep));
    this.buildBackdrop();
    this.layer = this.add.container(0, 0);
    this.draw = new BattleDraw(this, this.layer);
    this.enter.restart();
    this.reveal.snap(0);
    this.reveal.target = 1;

    const subs = [
      eventBus.on("STATE_CHANGED", () => this.redraw()),
      eventBus.on("MODE_CHANGED", () => this.redraw()),
    ];
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
    this.layer.setAlpha(this.enter.advance(delta));
    const revealed = this.reveal.advance(delta);
    for (const block of this.chapterBlocks) {
      block.text.setAlpha(Math.max(0, Math.min(1, (revealed - block.appearAt) / 0.28)));
    }
  }

  private handleKey(event: KeyboardEvent): void {
    const { controller } = gameContext();
    if (controller.state.mode !== "epilogue") return;
    if (event.key === "Enter" || event.code === "Space" || event.key === "Escape") {
      controller.closeEpilogue();
      // Same claim as the other own-screen modes: the global router must not act
      // on the key that closed this one.
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
  }

  private current(): Epilogue | null {
    const state = gameContext().controller.state;
    return state.pendingEpilogue ? buildEpilogue(state, state.pendingEpilogue) : null;
  }

  private buildBackdrop(): void {
    const state = gameContext().controller.state;
    // The backdrop is the stage you are walking INTO: the chapter closes looking
    // forward.
    const key = stageBackdropKey(state.stage);
    if (this.textures.exists(key)) {
      const image = this.add.image(W / 2, H / 2, key);
      const source = this.textures.get(key).getSourceImage();
      image.setScale(Math.max(W / source.width, H / source.height));
    }
    this.add.rectangle(W / 2, H / 2, W, H, hex("#04060f"), 1).setAlpha(0.76);
    // No MC sprite here: it sat behind the ledger panel and this screen is
    // words. The backdrop of the stage being entered carries the mood.
  }

  private redraw(): void {
    this.layer.removeAll(true);
    this.chapterBlocks = [];
    const epilogue = this.current();
    if (!epilogue) return;

    addRect(this, this.layer, 14, 14, W - 28, 4, "#303979");
    addRect(this, this.layer, 14, H - 18, W - 28, 4, "#202761");
    addRect(this, this.layer, 14, 14, 4, H - 28, "#5660b5");
    addRect(this, this.layer, W - 18, 14, 4, H - 28, "#1b2258");

    this.draw.centeredText(W / 2, 46, "CIERRE DE CAPITULO", 13, HYPE_ORANGE);
    this.draw.centeredDisplayText(W / 2, 62, epilogue.title.toUpperCase(), 26, palette.yellow);

    this.drawChapter(epilogue);
    this.drawLedger(epilogue);

    addRect(this, this.layer, OPENS.x, OPENS.y, OPENS.w, OPENS.h, palette.deep, 0.9);
    this.draw.frame(OPENS.x, OPENS.y, OPENS.w, OPENS.h, FRAME);
    addText(this, this.layer, OPENS.x + 16, OPENS.y + 10, "LO QUE SE ABRE", 10, palette.muted);
    addTextBlock(this, this.layer, OPENS.x + 16, OPENS.y + 26, epilogue.opens, 13, palette.ink, OPENS.w - 32);

    this.draw.centeredText(W / 2, H - 36, "ENTER PARA SEGUIR", 12, HYPE_ORANGE);
    addHitZone(this, this.layer, 0, H - 52, W, 40, () => gameContext().controller.closeEpilogue());
  }

  // The chapter itself: the opening, what each lean says about it, and the
  // emerging profile when the axes point somewhere clearly enough.
  private drawChapter(epilogue: Epilogue): void {
    addRect(this, this.layer, CHAPTER.x, CHAPTER.y, CHAPTER.w, CHAPTER.h, palette.deep, 0.9);
    this.draw.frame(CHAPTER.x, CHAPTER.y, CHAPTER.w, CHAPTER.h, FRAME);
    addTextBlock(this, this.layer, CHAPTER.x + 18, CHAPTER.y + 16, epilogue.opening, 14, palette.ink, CHAPTER.w - 36);

    // Lines fade in with the reveal, so the chapter reads instead of landing all
    // at once (frame-delta driven: no tweens, the harness freezes Date.now).
    let y = CHAPTER.y + 62;
    this.chapterBlocks = [];
    epilogue.chapterLines.slice(0, 3).forEach((sentence, index) => {
      const block = addTextBlock(this, this.layer, CHAPTER.x + 18, y, sentence, 13, LABEL_CYAN, CHAPTER.w - 36);
      this.chapterBlocks.push({ text: block, appearAt: index * 0.28 });
      // Advance by what the wrapped text actually measured, so two-line and
      // three-line sentences cannot overlap the next one.
      y += block.height + 10;
    });

    if (epilogue.destiny) {
      const boxY = CHAPTER.y + CHAPTER.h - 54;
      addRect(this, this.layer, CHAPTER.x + 14, boxY, CHAPTER.w - 28, 40, "#101a3f", 0.95);
      this.draw.frame(CHAPTER.x + 14, boxY, CHAPTER.w - 28, 40, palette.yellow);
      addText(this, this.layer, CHAPTER.x + 26, boxY + 8, epilogue.destiny.label.toUpperCase(), 12, palette.yellow);
      addText(this, this.layer, CHAPTER.x + 26, boxY + 24, epilogue.destiny.line, 11, palette.ink);
    }
  }

  // What the chapter cost: weeks, battles and the decisions that shaped it. The
  // decisions are listed by what the player CHOSE, because that is what they did.
  private drawLedger(epilogue: Epilogue): void {
    addRect(this, this.layer, LEDGER.x, LEDGER.y, LEDGER.w, LEDGER.h, palette.deep, 0.9);
    this.draw.frame(LEDGER.x, LEDGER.y, LEDGER.w, LEDGER.h, FRAME);
    addText(this, this.layer, LEDGER.x + 14, LEDGER.y + 12, "ESTE CAPITULO", 10, palette.muted);

    const rows = [
      { label: "Semanas", value: `${epilogue.weeks}` },
      { label: "Batallas ganadas", value: `${epilogue.battlesWon}` },
      { label: "Batallas perdidas", value: `${epilogue.battlesLost}` },
      { label: "Decisiones", value: `${epilogue.decisions.length}` },
    ];
    rows.forEach((row, index) => {
      const y = LEDGER.y + 34 + index * 20;
      addText(this, this.layer, LEDGER.x + 14, y, row.label, 12, palette.ink);
      const value = addText(this, this.layer, 0, y, row.value, 12, palette.yellow);
      value.setX(Math.round(LEDGER.x + LEDGER.w - 14 - value.width));
    });

    addText(this, this.layer, LEDGER.x + 14, LEDGER.y + 124, "LO QUE ELEGISTE", 10, palette.muted);
    const decisions = [...epilogue.decisions].reverse().slice(0, 5);
    if (decisions.length === 0) {
      addText(this, this.layer, LEDGER.x + 14, LEDGER.y + 142, "Nada grande te toco decidir.", 11, palette.muted);
      return;
    }
    decisions.forEach((decision, index) => {
      const y = LEDGER.y + 142 + index * 22;
      addText(this, this.layer, LEDGER.x + 14, y, `S${decision.week}`, 10, palette.muted);
      const label = addText(this, this.layer, LEDGER.x + 40, y, decision.choice, 11, palette.teal, {
        wordWrap: { width: LEDGER.w - 56 },
      });
      label.setCrop(0, 0, LEDGER.w - 56, 14);
    });
  }

  // Kept for the footer: where the player is heading.
  static heading(): string {
    return nextStageTitle(gameContext().controller.state);
  }
}
