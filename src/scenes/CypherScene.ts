// The cypher screen (owner decision, 2026-08-13): rapping in a circle with
// friends, as TRAINING. Its own screen, not the battle's — there is no rival
// HUD, no hype meter and no stage rewards. What it shows is what practice
// actually gives you: whether the thing you tried came out, and which stats it
// exercised.
//
// Presentation only: it reads state.cypher and sends controller commands. The
// pixel primitives come from BattleDraw so the two screens speak the same
// visual language without this one pretending to be a battle.

import Phaser from "phaser";
import { eventBus } from "../events/EventBus";
import { gameContext } from "../game/context";
import { AssetRegistry, battleBackdropKey, battleChoiceIconKey } from "../game/AssetRegistry";
import { hex, palette } from "../ui/palette";
import { addHitZone, addRect, addSpriteImage, addText } from "../ui/kit";
import { resourceById } from "../data/battle";
import { statLabels } from "../data/stats";
import { CypherConfig } from "../data/config/CypherConfig";
import { cypherOptions } from "../systems/CypherSystem";
import { BattleDraw, FRAME, HYPE_ORANGE, LABEL_CYAN } from "./battleDraw";
import { EasedValue, Pulse, Shake } from "../ui/fx";
import type { CypherState, CypherTurn } from "../core/types";

const W = 960;
const H = 540;

// The circle: the MC plus the friends taking turns. Feet on the same ground
// plane as the battle performers so the backdrop reads right.
// Three friends at different depths, not four clones of the same sprite: the
// real crowd art is still pending (docs/ASSETS.md), so the circle is suggested
// with scale and dimming instead of pretending to be a crowd.
const CIRCLE = {
  feetY: 250,
  mcX: 300,
  friends: [
    { x: 168, height: 128, alpha: 0.55 },
    { x: 606, height: 112, alpha: 0.42 },
    { x: 792, height: 134, alpha: 0.5 },
  ],
} as const;

// Option cards: three of them, wider than the battle's five.
const CARD = { w: 176, h: 150, gap: 26, top: 300, cursorH: 12 } as const;

// Turn verdict panel, in the band the cards leave free.
const VERDICT = { x: 232, y: 300, w: 496, h: 150 } as const;

const PROGRESS = { cx: 480, y: 106, dotR: 6, gap: 24 } as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export class CypherScene extends Phaser.Scene {
  private layer!: Phaser.GameObjects.Container;
  private draw!: BattleDraw;
  private focus = 0;
  // Game feel, frame-delta driven like everywhere else (never Phaser tweens:
  // the capture harness freezes Date.now).
  private dealIn = new Pulse(180);
  private shake = new Shake(200, 30);
  private glow = new EasedValue(0, 140);
  private cardLayer: Phaser.GameObjects.Container | null = null;
  private lastSeenTurn = 0;
  private lastSeenThrows = 0;
  private keyHandler: ((event: KeyboardEvent) => void) | null = null;

  constructor() {
    super("Cypher");
  }

  create(): void {
    this.cameras.main.setBackgroundColor(hex(palette.deep));
    this.buildBackdrop();
    this.layer = this.add.container(0, 0);
    this.draw = new BattleDraw(this, this.layer);
    this.focus = 0;
    this.lastSeenTurn = 0;
    this.lastSeenThrows = 0;

    const subs = [
      eventBus.on("STATE_CHANGED", () => this.redraw()),
      eventBus.on("MODE_CHANGED", () => this.redraw()),
    ];
    // The cypher owns its keys: the global router deals with career and battle,
    // and a screen this small should not need a branch there. It listens in the
    // CAPTURE phase and stops propagation, because preventDefault alone still
    // lets InputRouter (bubble, on window) see the same key — which made the
    // Enter that closes the circle also fire the room's DORMIR tile.
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
    if (this.cardLayer) {
      const progress = this.dealIn.advance(delta);
      this.cardLayer.setY(Math.round((1 - progress) * 18));
      this.cardLayer.setAlpha(progress);
    }
    const offset = this.shake.advance(delta);
    this.cameras.main.setScroll(offset.x, offset.y);
    this.glow.advance(delta);
  }

  // --- Input (arrows / digits / Enter) ----------------------------------------

  private handleKey(event: KeyboardEvent): void {
    const { controller } = gameContext();
    const cypher = controller.state.cypher;
    if (controller.state.mode !== "cypher" || !cypher) return;
    const confirm = event.key === "Enter" || event.code === "Space";

    if (cypher.finished) {
      if (confirm) {
        controller.finishCypher();
        this.claim(event);
      }
      return;
    }
    if (cypher.pending) {
      if (confirm) {
        controller.advanceCypherTurn();
        this.claim(event);
      }
      return;
    }
    const options = cypherOptions(controller.state);
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      this.focus = clamp(this.focus + 1, 0, options.length - 1);
      this.redraw();
      this.claim(event);
      return;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      this.focus = clamp(this.focus - 1, 0, options.length - 1);
      this.redraw();
      this.claim(event);
      return;
    }
    const digit = Number(event.key);
    if (Number.isInteger(digit) && digit >= 1 && digit <= options.length) {
      controller.throwCypher(options[digit - 1]);
      this.claim(event);
      return;
    }
    if (confirm && options[this.focus]) {
      controller.throwCypher(options[this.focus]);
      this.claim(event);
    }
  }

  // A key this screen handled is a key nobody else gets: the global router also
  // listens on window, so stopping propagation is what keeps the room's dock
  // from acting on the same press.
  private claim(event: KeyboardEvent): void {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }

  // --- Drawing -----------------------------------------------------------------

  private redraw(): void {
    const { controller } = gameContext();
    const cypher = controller.state.cypher;
    this.layer.removeAll(true);
    this.cardLayer = null;
    if (!cypher) return;
    this.syncFeel(cypher);

    this.drawHud(cypher);
    if (cypher.finished) this.drawClosing(cypher);
    else if (cypher.pending) this.drawTurnVerdict(cypher.pending);
    else this.drawOptions();
  }

  private syncFeel(cypher: CypherState): void {
    if (cypher.turn !== this.lastSeenTurn) {
      this.lastSeenTurn = cypher.turn;
      this.dealIn.restart();
      this.focus = 0;
    }
    if (cypher.turns.length !== this.lastSeenThrows) {
      this.lastSeenThrows = cypher.turns.length;
      const last = cypher.turns[cypher.turns.length - 1];
      // A clean turn lifts the circle; a fumbled one is the one that stings.
      if (last?.kind === "weak") this.shake.kick(4);
      this.glow.target = last?.kind === "great" ? 1 : 0;
    }
  }

  private buildBackdrop(): void {
    const backdrop = this.add.container(0, 0);
    const key = battleBackdropKey(gameContext().controller.state.stage);
    if (this.textures.exists(key)) {
      const image = this.add.image(W / 2, H / 2, key);
      const source = this.textures.get(key).getSourceImage();
      const scale = Math.max(W / source.width, H / source.height);
      image.setScale(scale);
      backdrop.add(image);
    }
    // A cypher happens at night in a circle: the scene is dimmed so the cards
    // and the verdict carry the screen.
    const scrim = this.add.rectangle(W / 2, H / 2, W, H, hex("#050914"), 1).setAlpha(0.45);
    backdrop.add(scrim);
    this.addCircle(backdrop);
  }

  // The circle itself: the MC and the friends taking turns around him.
  private addCircle(layer: Phaser.GameObjects.Container): void {
    const mcKey = AssetRegistry.characters.mcIdle.key;
    const rivalKey = AssetRegistry.characters.rivalIdle.key;
    for (const friendSpot of CIRCLE.friends) {
      if (!this.textures.exists(rivalKey)) break;
      const friend = addSpriteImage(this, layer, rivalKey, friendSpot.x, CIRCLE.feetY, friendSpot.height, 0.5, 1);
      // The friends are backdrop, not opponents: dimmed and smaller.
      friend?.setAlpha(friendSpot.alpha);
    }
    if (this.textures.exists(mcKey)) {
      addSpriteImage(this, layer, mcKey, CIRCLE.mcX, CIRCLE.feetY + 6, 150, 0.5, 1);
    }
  }

  private drawHud(cypher: CypherState): void {
    addRect(this, this.layer, 14, 14, W - 28, 4, "#303979");
    addRect(this, this.layer, 14, H - 18, W - 28, 4, "#202761");
    addRect(this, this.layer, 14, 14, 4, H - 28, "#5660b5");
    addRect(this, this.layer, W - 18, 14, 4, H - 28, "#1b2258");

    this.draw.centeredDisplayText(W / 2, 34, "CYPHER", 30, palette.yellow);
    this.draw.centeredText(W / 2, 72, "PRACTICAS EL RECURSO QUE ELIJAS", 13, LABEL_CYAN);
    // Turn dots, so the circle's length is visible without a number.
    const total = cypher.maxTurns;
    const startX = PROGRESS.cx - ((total - 1) * PROGRESS.gap) / 2;
    for (let i = 0; i < total; i += 1) {
      const done = i < cypher.turns.length;
      const current = i === cypher.turn - 1 && !cypher.finished;
      const x = Math.round(startX + i * PROGRESS.gap);
      addRect(
        this,
        this.layer,
        x - PROGRESS.dotR,
        PROGRESS.y - PROGRESS.dotR,
        PROGRESS.dotR * 2,
        PROGRESS.dotR * 2,
        current ? palette.yellow : done ? palette.teal : "#2b3160",
      );
    }
    const state = gameContext().controller.state;
    this.draw.valueLine(
      W / 2,
      140,
      "ENERGIA ",
      `${Math.floor(state.energy)}`,
      13,
      palette.ink,
      palette.green,
      "center",
    );
  }

  // Three option cards: name, icon, and the stats this resource exercises —
  // which is the whole point of a cypher being training.
  private drawOptions(): void {
    const options = cypherOptions(gameContext().controller.state);
    this.cardLayer = this.add.container(0, 0);
    this.layer.add(this.cardLayer);
    const draw = this.draw.withLayer(this.cardLayer);
    const total = options.length * CARD.w + (options.length - 1) * CARD.gap;
    const startX = Math.round((W - total) / 2);
    options.forEach((resource, index) => {
      const x = startX + index * (CARD.w + CARD.gap);
      const cx = x + CARD.w / 2;
      const focused = index === this.focus;
      const layer = this.cardLayer;
      if (!layer) return;
      addRect(this, layer, x + 3, CARD.top + 4, CARD.w, CARD.h, "#000000", 0.34);
      addRect(this, layer, x, CARD.top, CARD.w, CARD.h, palette.deep, 0.94);
      draw.frame(x, CARD.top, CARD.w, CARD.h, focused ? palette.yellow : FRAME);
      draw.fittedCenteredText(cx, CARD.top + 16, resource.label.toUpperCase(), 15, palette.ink, CARD.w - 14);
      const iconKey = battleChoiceIconKey(resource.id);
      if (iconKey) addSpriteImage(this, layer, iconKey, cx, CARD.top + 68, 46, 0.5, 0.5, 52);
      // What it trains, named: the reason to pick this card over that one.
      const trains = resource.stats.map((stat) => statLabels[stat]).join(" + ");
      draw.centeredText(cx, CARD.top + 106, "ENTRENA", 11, palette.muted);
      draw.fittedCenteredText(cx, CARD.top + 120, trains.toUpperCase(), 13, palette.teal, CARD.w - 16);
      // The digit shortcut sits in the corner, where it cannot collide with the
      // line that says what the card trains.
      addText(this, layer, x + 9, CARD.top + 8, `${index + 1}`, 11, palette.muted);
      addHitZone(this, layer, x, CARD.top, CARD.w, CARD.h, () =>
        gameContext().controller.throwCypher(resource),
      );
      if (focused) this.drawCursor(layer, cx, CARD.top - 4);
    });
  }

  private drawCursor(layer: Phaser.GameObjects.Container, cx: number, bottom: number): void {
    const steps = 4;
    const step = Math.max(1, Math.floor(CARD.cursorH / steps));
    for (let i = 0; i < steps; i += 1) {
      const w = 20 - i * 5;
      addRect(this, layer, Math.round(cx - w / 2), bottom - CARD.cursorH + i * step, w, step, palette.yellow);
    }
  }

  // What came out, and what it taught. No rival number: the score is yours.
  private drawTurnVerdict(turn: CypherTurn): void {
    const resource = resourceById(turn.choice);
    const color = turn.kind === "great" ? palette.green : turn.kind === "good" ? palette.teal : palette.red;
    addRect(this, this.layer, VERDICT.x, VERDICT.y, VERDICT.w, VERDICT.h, palette.deep, 0.94);
    this.draw.frame(VERDICT.x, VERDICT.y, VERDICT.w, VERDICT.h, FRAME);
    this.draw.centeredText(W / 2, VERDICT.y + 14, `TIRASTE ${resource.label.toUpperCase()}`, 13, LABEL_CYAN);
    this.draw.centeredDisplayText(W / 2, VERDICT.y + 36, turn.verdict, 34, color);
    const learned = turn.learned.map((gain) => `+${gain.amount} ${gain.label}`).join("  ");
    this.draw.centeredText(W / 2, VERDICT.y + 88, learned, 15, palette.yellow);
    if (turn.repeated) {
      this.draw.centeredText(W / 2, VERDICT.y + 110, "Repetido: el circulo aprende menos.", 11, palette.muted);
    }
    this.draw.centeredText(W / 2, VERDICT.y + 130, "ENTER PARA SEGUIR", 12, HYPE_ORANGE);
  }

  // Closing the circle: the totals, then back to the room.
  private drawClosing(cypher: CypherState): void {
    const totals = new Map<string, number>();
    for (const turn of cypher.turns) {
      for (const gain of turn.learned) {
        totals.set(gain.label, (totals.get(gain.label) ?? 0) + gain.amount);
      }
    }
    const good = cypher.turns.filter((turn) => turn.kind !== "weak").length;
    addRect(this, this.layer, VERDICT.x, VERDICT.y, VERDICT.w, VERDICT.h, palette.deep, 0.94);
    this.draw.frame(VERDICT.x, VERDICT.y, VERDICT.w, VERDICT.h, FRAME);
    this.draw.centeredDisplayText(W / 2, VERDICT.y + 12, "SE CERRO EL CIRCULO", 24, palette.yellow);
    this.draw.centeredText(W / 2, VERDICT.y + 48, `${good} de ${cypher.turns.length} te salieron`, 15, palette.ink);
    const learned = [...totals.entries()].map(([label, amount]) => `+${amount} ${label}`).join("   ");
    this.draw.centeredText(W / 2, VERDICT.y + 76, learned || "Sin ganancias", 15, palette.teal);
    this.draw.centeredText(W / 2, VERDICT.y + 104, `Cuesta ${CypherConfig.entry.energyCost} energia y 1 bloque.`, 11, palette.muted);
    this.draw.centeredText(W / 2, VERDICT.y + 130, "ENTER PARA VOLVER A LA PIEZA", 12, HYPE_ORANGE);
    addHitZone(this, this.layer, VERDICT.x, VERDICT.y + 120, VERDICT.w, 28, () =>
      gameContext().controller.finishCypher(),
    );
  }
}
