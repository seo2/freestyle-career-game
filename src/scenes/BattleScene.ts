// Battle screen, rebuilt in Fase 4 against its mockups
// (reference/screens/06_52_01 a.m. (1).png = round, 06_25_07 a.m. (1).png =
// round result). Geometry is the mockup measured at 1672x941 and scaled by
// 0.574 to the 960x540 canvas.
//
// Layout: HUD (energia + hype per side, RONDA, decision timer, ESTIMULO) over
// the live scene, two big performers on the ground, and the round's hand of 5
// vertical resource cards floating over the backdrop (no opaque panel). After
// every round the battle parks on its round-result beat (battle.pendingResult)
// and this scene draws the mockup's verdict panel — now naming the rival's
// resource and any tension note — until CONTINUAR/Enter advances the match.
// Presentation only: every click and key is a GameController command; numbers
// come from state, BattleConfig, and BattleSystem's read-only helpers; the
// hand itself is dealt by BattleSystem (no hand logic here).

import Phaser from "phaser";
import { eventBus } from "../events/EventBus";
import { gameContext } from "../game/context";
import { AssetRegistry, battleBackdropKey, battleChoiceIconKey } from "../game/AssetRegistry";
import { hex, palette } from "../ui/palette";
import { addHitZone, addRect, addSpriteImage, addText } from "../ui/kit";
import { resourceById } from "../data/battle";
import { BattleConfig } from "../data/config/BattleConfig";
import { EasedValue, Pulse, Shake } from "../ui/fx";
import { rivalArchetypes } from "../data/rivals";
import { battleEnergyCost, battleRoundSeconds, projectedHypeGain } from "../systems/BattleSystem";
import { maxEnergy } from "../core/derived";
import type { BattleResource, BattleState, GameState } from "../core/types";
import { BattleDraw, FRAME, FRAME_DIM, HYPE_ORANGE, LABEL_CYAN } from "./battleDraw";

const W = 960;
const H = 540;

// Tones the battle mockups use that src/ui/palette.ts does not carry yet.
// (handoff: fold these into the palette as frame / frameDim / label / hype.)

// Choice dock: the hand of 5 vertical cards, mockup card proportions
// (126x169, gap 24) centered on the canvas — exactly the mockup's five.
const CARD_W = 126;
const CARD_H = 169;
const CARD_GAP = 24;
const CARD_TOP = 284;
const CARD_SELECT_PAD = 5;
const CURSOR_H = 12;

// Decision-timer bar: a discreet countdown right under RONDA n (the mockup
// has no timer, so it borrows the HUD bar language at pocket size, in the
// 13px gap between the RONDA line and the central HYPE label). The fill is
// animated per-frame from battle.timeLeft — frame delta, never tweens, so the
// harness (frozen Date.now) still shows honest progress.
const TIMER_W = 120;
const TIMER_H = 5;
const TIMER_Y = 60;
const TIMER_CX = 483;
// Below this fraction of time left the fill turns red.
const TIMER_ALERT_FRACTION = 0.25;

// Performers: mockup scale and anchors (MC ~186px tall, feet clear of both the
// card dock and the result panels).
const PERFORMER_SCALE = 0.8;
const PERFORMER_FEET_Y = 262;
const MC_X = 150;
const RIVAL_X = 812;

// The stimulus box keeps its size but rides higher on the result screen, where
// the RESULTADO block takes over the middle of the canvas (both mockups).
// Game feel tuning (Fase 5). Presentation-only numbers, so they live with the
// scene that draws them rather than in a gameplay config.
const DEAL_IN_RISE = 26; // px the hand travels up as it is dealt
const SHAKE_PER_HYPE_TAKEN = 0.55; // px of shake per hype point lost
const SHAKE_PER_HYPE_GIVEN = 0.22; // ...and per point landed on the rival
const SHAKE_MAX = 7;
const GLOW_HYPE_FLOOR = 45; // below this the room is cold and the glow is off
const GLOW_MAX_ALPHA = 0.14;
const ROAR_MAX_ALPHA = 0.2;
const ROAR_HYPE_THRESHOLD = 12; // a gain this big is worth a crowd flash

const STIMULUS_TOP_ROUND = 215;
const STIMULUS_TOP_RESULT = 152;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export class BattleScene extends Phaser.Scene {
  private layer!: Phaser.GameObjects.Container;
  // Live handle to the timer bar's fill so update() can animate it with the
  // frame delta between redraws (null whenever no card choice is on screen).
  private timerFill: Phaser.GameObjects.Rectangle | null = null;
  // Pixel primitives and the two result screens live in BattleDraw so this
  // scene stays under the 500-line rule.
  private draw!: BattleDraw;
  // Game feel (Fase 5): everything below animates on the FRAME DELTA, never on
  // a Phaser tween — the capture harness freezes Date.now and the TweenManager
  // reads it, so a tween-driven effect would be invisible to verification.
  // The dealt hand slides up into place when a round begins.
  private cardLayer: Phaser.GameObjects.Container | null = null;
  private dealIn = new Pulse(200);
  // Hype meters chase their value instead of snapping, so a won round reads as
  // the crowd moving rather than a number teleporting.
  private playerHype = new EasedValue(BattleConfig.rounds.openingHype);
  private rivalHype = new EasedValue(BattleConfig.rounds.openingHype);
  // Impact: the screen takes the hit when a round lands.
  private shake = new Shake();
  // The room answers the hype: warmth follows the meter and a roar flashes on
  // a big gain. The crowd SPRITE is still pending art (docs/ASSETS.md) — this
  // animates the light of the existing backdrop, it does not fake a crowd.
  private stageGlow: Phaser.GameObjects.Rectangle | null = null;
  private roar = new Pulse(320);
  // Round we last drew, to detect a new round (deal the hand in) and a new
  // verdict (kick the shake) without re-firing on every unrelated redraw.
  private lastSeenRound = 0;
  private lastSeenResults = 0;

  constructor() {
    super("Battle");
  }

  create(): void {
    this.cameras.main.setBackgroundColor(hex(palette.deep));
    this.buildBackdrop();
    // Both performers stand on the same ground plane of the plaza backdrop,
    // clear of the props on the terrace and of the card dock below.
    this.addPerformer(MC_X, PERFORMER_FEET_Y, "mc");
    this.addPerformer(RIVAL_X, PERFORMER_FEET_Y, "rival");

    // Warm light over the scene that follows the hype (added before the UI
    // layer so it tints the stage, never the text).
    // fillAlpha stays 1 and the object alpha carries the animation: a rectangle
    // built with fillAlpha 0 multiplies any later setAlpha to nothing, which is
    // exactly how this effect was invisible the first time.
    this.stageGlow = this.add.rectangle(W / 2, H / 2, W, H, hex("#ff8a2b"), 1).setAlpha(0);
    this.layer = this.add.container(0, 0);
    this.draw = new BattleDraw(this, this.layer);
    const subs = [
      eventBus.on("STATE_CHANGED", () => this.redraw()),
      eventBus.on("FOCUS_CHANGED", () => this.redraw()),
      eventBus.on("BATTLE_STARTED", () => this.redraw()),
      eventBus.on("BATTLE_FINISHED", () => this.redraw()),
    ];
    this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => subs.forEach((u) => u()));
    this.redraw();
  }

  update(_time: number, delta: number): void {
    const controller = gameContext().controller;
    controller.update(delta / 1000);
    // Countdown bar follows battle.timeLeft every frame (the controller ticks
    // it); everything else redraws only on events.
    const battle = controller.state.battle;
    if (battle && !battle.finished && !battle.pendingResult) this.updateTimerFill(battle);
    this.advanceFeel(delta, battle);
  }

  // --- Game feel ---------------------------------------------------------------

  // One place advances every effect, so a frozen or jittery frame can only ever
  // be diagnosed here.
  private advanceFeel(delta: number, battle: BattleState | null): void {
    const beforePlayer = this.playerHype.value;
    const beforeRival = this.rivalHype.value;
    const player = this.playerHype.advance(delta);
    const rival = this.rivalHype.advance(delta);
    // The hype bars keep the mockup's segmented fill, which cannot simply be
    // scaled, so the HUD is redrawn while the eased values settle (a few frames
    // per round) instead of holding handles to the segments.
    const settling = player !== beforePlayer || rival !== beforeRival;

    // The hand slides up and fades in as it is dealt.
    if (this.cardLayer) {
      const progress = this.dealIn.advance(delta);
      this.cardLayer.setY(Math.round((1 - progress) * DEAL_IN_RISE));
      this.cardLayer.setAlpha(progress);
    }

    const offset = this.shake.advance(delta);
    this.cameras.main.setScroll(offset.x, offset.y);

    if (this.stageGlow) {
      // Base warmth from the hype the crowd is at, plus the roar flash on top.
      const warmth = battle ? clamp((player - GLOW_HYPE_FLOOR) / (100 - GLOW_HYPE_FLOOR), 0, 1) : 0;
      const flash = 1 - this.roar.advance(delta);
      this.stageGlow.setAlpha(warmth * GLOW_MAX_ALPHA + flash * ROAR_MAX_ALPHA);
    }

    if (settling) this.redraw();
  }

  // Reads the battle for the two moments worth feeling: a new round (deal the
  // hand in) and a fresh verdict (shake, and roar when the crowd got what it
  // wanted). Everything else is just the meters chasing their target.
  private syncFeel(battle: BattleState): void {
    this.playerHype.target = battle.hype;
    this.rivalHype.target = battle.rivalHype;
    if (battle.round !== this.lastSeenRound) {
      this.lastSeenRound = battle.round;
      this.dealIn.restart();
    }
    if (battle.results.length !== this.lastSeenResults) {
      this.lastSeenResults = battle.results.length;
      const last = battle.results[battle.results.length - 1];
      if (last) {
        // Losing the round hits harder than winning it: the shake is the
        // punchline landing on you, scaled by how much hype moved.
        const swing = Math.abs(last.playerHypeDelta);
        const took = last.playerHypeDelta < 0;
        this.shake.kick(clamp(swing * (took ? SHAKE_PER_HYPE_TAKEN : SHAKE_PER_HYPE_GIVEN), 0, SHAKE_MAX));
        if (!took && swing >= ROAR_HYPE_THRESHOLD) this.roar.restart();
      }
    }
  }

  private redraw(): void {
    this.layer.removeAll(true);
    this.timerFill = null;
    this.cardLayer = null;
    const { controller, input } = gameContext();
    const battle = controller.state.battle;
    if (!battle) return;
    this.syncFeel(battle);

    this.drawStageHud(battle);
    if (battle.finished) {
      this.draw.finalResultPanel(battle);
    } else if (battle.pendingResult) {
      this.draw.roundResultPanel(battle, battle.pendingResult);
    } else {
      this.drawChoiceDock(battle, input.battleFocus, controller.state);
    }
  }

  // --- Static backdrop --------------------------------------------------------

  private buildBackdrop(): void {
    const backdrop = this.add.container(0, 0);
    const key = battleBackdropKey(gameContext().controller.state.stage);
    if (this.textures.exists(key)) {
      const image = this.add.image(W / 2, H / 2, key);
      image.setScale(Math.max(W / image.width, H / image.height));
      backdrop.add(image);
      // Scrim bands approximating the mockup's night shade; the lower band also
      // keeps the floating cards readable over the bright pavement.
      addRect(this, backdrop, 0, 0, W, Math.floor(H * 0.32), "#04071c", 0.4);
      addRect(this, backdrop, 0, Math.floor(H * 0.32), W, Math.floor(H * 0.32), "#0a1136", 0.2);
      addRect(this, backdrop, 0, Math.floor(H * 0.64), W, H - Math.floor(H * 0.64), "#040612", 0.44);
      addRect(this, backdrop, 0, 0, W, H, "#121a52", 0.12);
    } else {
      addRect(this, backdrop, 0, 0, W, H, palette.deep);
    }
  }

  // Performer sprites (MC left, rival right), feet on the ground anchor and
  // bobbing gently in place. Falls back to the compact placeholder figure when
  // the texture is missing.
  private addPerformer(x: number, y: number, variant: "mc" | "rival"): void {
    const key = variant === "mc" ? AssetRegistry.characters.mcIdle.key : AssetRegistry.characters.rivalIdle.key;
    if (this.textures.exists(key)) {
      const image = this.add.image(x, y, key).setOrigin(0.5, 1);
      image.setScale(PERFORMER_SCALE);
      this.addIdleBob(image, y, variant);
      return;
    }
    const container = this.add.container(x, y);
    const graphics = this.add.graphics();
    const bodyColor = variant === "mc" ? hex(palette.teal) : hex(palette.pink);
    const capColor = variant === "mc" ? hex(palette.red) : hex(palette.blue);
    graphics.fillStyle(hex("#08090d"), 1);
    graphics.fillRoundedRect(-16, -24, 32, 48, 6);
    graphics.fillStyle(bodyColor, 1);
    graphics.fillRoundedRect(-14, -22, 28, 44, 5);
    graphics.fillStyle(capColor, 1);
    graphics.fillRoundedRect(-12, -28, 24, 8, 3);
    const micX = variant === "mc" ? 18 : -18;
    graphics.fillStyle(hex("#15171d"), 1);
    graphics.fillCircle(micX, -2, 4);
    graphics.fillStyle(hex(palette.ink), 1);
    graphics.fillCircle(micX, -2, 2);
    container.add(graphics);
    container.setScale(3.2);
    this.addIdleBob(container, y, variant);
  }

  // Idle bob: 4px sine wave, rival slightly slower and offset.
  private addIdleBob(
    target: Phaser.GameObjects.Image | Phaser.GameObjects.Container,
    y: number,
    variant: "mc" | "rival",
  ): void {
    this.tweens.add({
      targets: target,
      y: y - 4,
      duration: variant === "mc" ? 620 : 700,
      delay: variant === "mc" ? 0 : 180,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  // --- HUD --------------------------------------------------------------------

  private drawStageHud(battle: BattleState): void {
    const state = gameContext().controller.state;
    this.drawScreenPixelBorder();
    this.draw.centeredText(134, 33, "TU", 18, palette.ink);
    this.draw.centeredText(824, 33, "RIVAL", 18, palette.ink);
    // Who you are facing and what this room rewards (gauntlet 10): both come
    // from state, so the player can read the rival and play to the crowd
    // instead of guessing.
    this.draw.centeredText(824, 52, rivalArchetypes[battle.rivalArchetype].label.toUpperCase(), 11, palette.muted);
    this.drawHudSide(202, 42, state.energy, maxEnergy(state), this.playerHype.value);
    this.drawHudSide(600, 42, battle.rivalEnergy, battle.rivalEnergyMax, this.rivalHype.value);
    this.draw.centeredDisplayText(483, 29, `RONDA ${battle.round}`, 26, palette.ink);
    this.draw.centeredText(483, 68, "HYPE", 17, HYPE_ORANGE);
    this.draw.hudBar(390, 88, 188, 14, this.playerHype.value, 100, palette.yellow, true);
    const onResultScreen = battle.finished || battle.pendingResult !== null;
    if (!onResultScreen) this.drawDecisionTimer(battle);
    this.drawStimulus(battle, onResultScreen ? STIMULUS_TOP_RESULT : STIMULUS_TOP_ROUND);
    // The crowd's taste rides just under the card dock, where the round screen
    // has room; the verdict beat needs that band for its panels.
    if (!onResultScreen) this.draw.centeredText(W / 2, CARD_TOP + CARD_H + 60, battle.crowdLine, 11, LABEL_CYAN);
  }

  // Discreet countdown bar under RONDA n. Only exists while choosing a card
  // (the timer pauses on the verdict beats, so the bar leaves with the cards).
  private drawDecisionTimer(battle: BattleState): void {
    const x = Math.round(TIMER_CX - TIMER_W / 2);
    addRect(this, this.layer, x + 1, TIMER_Y + 1, TIMER_W, TIMER_H, "#000000", 0.3);
    addRect(this, this.layer, x, TIMER_Y, TIMER_W, TIMER_H, "#060814");
    this.timerFill = addRect(this, this.layer, x, TIMER_Y, TIMER_W, TIMER_H, palette.yellow);
    this.updateTimerFill(battle);
  }

  // Frame-delta animation of the countdown fill (harness-safe: no tweens).
  private updateTimerFill(battle: BattleState): void {
    if (!this.timerFill) return;
    const total = battleRoundSeconds(gameContext().controller.state);
    const fraction = total > 0 ? clamp(battle.timeLeft / total, 0, 1) : 0;
    this.timerFill.setScale(fraction, 1);
    this.timerFill.setFillStyle(hex(fraction <= TIMER_ALERT_FRACTION ? palette.red : palette.yellow));
  }

  // ESTIMULO label + framed keyword box (mockup: no prompt sentence here).
  private drawStimulus(battle: BattleState, top: number): void {
    this.draw.centeredText(483, top - 23, "ESTIMULO", 16, palette.ink);
    addRect(this, this.layer, 338, top, 290, 71, palette.deep, 0.9);
    this.draw.frame(338, top, 290, 71, FRAME);
    this.draw.centeredDisplayText(483, top + 18, battle.prompt.label.toUpperCase(), 37, palette.yellow);
  }

  // ENERGIA value + bar and the HYPE bar for one performer.
  private drawHudSide(x: number, y: number, energy: number, maxEnergyValue: number, hype: number): void {
    addText(this, this.layer, x, y - 12, "ENERGIA", 12, palette.ink);
    this.draw.valueLine(x + 164, y - 5, `${Math.floor(energy)}`, `/${maxEnergyValue}`, 12, palette.green, palette.ink, "right");
    this.draw.hudBar(x, y + 14, 166, 13, energy, maxEnergyValue, palette.green);
    addText(this, this.layer, x, y + 27, "HYPE", 14, HYPE_ORANGE);
    this.draw.hudBar(x, y + 46, 166, 13, hype, 100, palette.yellow, true);
  }


  // Thin frame around the battle screen.
  private drawScreenPixelBorder(): void {
    addRect(this, this.layer, 14, 14, W - 28, 4, "#303979");
    addRect(this, this.layer, 14, H - 18, W - 28, 4, "#202761");
    addRect(this, this.layer, 14, 14, 4, H - 28, "#5660b5");
    addRect(this, this.layer, W - 18, 14, 4, H - 28, "#1b2258");
    addRect(this, this.layer, 18, 18, W - 36, 2, "#ffffff", 0.11);
  }

  // --- Choice dock (the dealt hand of 5) ---------------------------------------

  private cardX(index: number, count: number): number {
    const total = count * CARD_W + (count - 1) * CARD_GAP;
    return Math.round((W - total) / 2) + index * (CARD_W + CARD_GAP);
  }

  private drawChoiceDock(battle: BattleState, battleFocus: number, state: GameState): void {
    const hand = battle.hand.map((id) => resourceById(id));
    // The dock lives in its own container so the hand can slide up and fade in
    // as a group when a round is dealt (advanceFeel moves it).
    this.cardLayer = this.add.container(0, 0);
    this.layer.add(this.cardLayer);
    const cardDraw = this.draw.withLayer(this.cardLayer);
    hand.forEach((resource, index) => {
      this.drawChoiceCard(
        cardDraw,
        this.cardLayer!,
        resource,
        this.cardX(index, hand.length),
        projectedHypeGain(battle, resource),
        index === battleFocus,
      );
    });
    this.draw.valueLine(
      W / 2,
      CARD_TOP + CARD_H + 42,
      "COSTO ENERGIA: ",
      String(battleEnergyCost(state)),
      15,
      LABEL_CYAN,
      palette.ink,
      "center",
    );
  }

  // Vertical card: name on top, big icon, projected hype in large type, HYPE
  // caption. Selected card gets the yellow ring plus the cursor above it.
  private drawChoiceCard(
    draw: BattleDraw,
    layer: Phaser.GameObjects.Container,
    choice: BattleResource,
    x: number,
    hype: number,
    focused: boolean,
  ): void {
    const y = CARD_TOP;
    const cx = x + CARD_W / 2;
    addRect(this, layer, x + 3, y + 4, CARD_W, CARD_H, "#000000", 0.34);
    if (focused) {
      const pad = CARD_SELECT_PAD;
      addRect(this, layer, x - pad, y - pad, CARD_W + pad * 2, CARD_H + pad * 2, palette.deep, 0.94);
      draw.frame(x - pad, y - pad, CARD_W + pad * 2, CARD_H + pad * 2, palette.yellow);
      this.drawCursor(layer, cx, y - 3);
    }
    addRect(this, layer, x, y, CARD_W, CARD_H, palette.deep, 0.94);
    draw.frame(x, y, CARD_W, CARD_H, focused ? palette.yellow : FRAME);
    // Long resource names (IMPROVISACION, STORYTELLING) shrink to the card.
    draw.fittedCenteredText(cx, y + 17, choice.label.toUpperCase(), 15, palette.ink, CARD_W - 10);
    const iconKey = battleChoiceIconKey(choice.id);
    const icon = iconKey ? addSpriteImage(this, layer, iconKey, cx, y + 72, 50, 0.5, 0.5, 52) : null;
    // Four of the ten resources have no cut icon yet (docs/ASSETS.md): a dashed
    // frame reads as "pending art", the way the shop's preview slot does, so a
    // missing sprite can never be mistaken for a broken card.
    if (!icon) this.drawPendingIconSlot(layer, cx, y + 72);
    draw.centeredDisplayText(cx, y + 110, `+${hype}`, 30, palette.ink);
    draw.centeredText(cx, y + 142, "HYPE", 13, HYPE_ORANGE);
    addHitZone(this, layer, x, y, CARD_W, CARD_H, () => gameContext().controller.resolveBattle(choice));
  }

  // Dashed placeholder for a battle resource whose icon is still pending.
  private drawPendingIconSlot(layer: Phaser.GameObjects.Container, cx: number, cy: number): void {
    const w = 44;
    const h = 44;
    const x = cx - w / 2;
    const y = cy - h / 2;
    const dash = 4;
    for (let dx = 0; dx < w; dx += dash * 2) {
      const run = Math.min(dash, w - dx);
      addRect(this, layer, x + dx, y, run, 1, FRAME_DIM);
      addRect(this, layer, x + dx, y + h - 1, run, 1, FRAME_DIM);
    }
    for (let dy = 0; dy < h; dy += dash * 2) {
      const run = Math.min(dash, h - dy);
      addRect(this, layer, x, y + dy, 1, run, FRAME_DIM);
      addRect(this, layer, x + w - 1, y + dy, 1, run, FRAME_DIM);
    }
  }

  // Selection cursor: yellow triangle pointing down at the focused card.
  private drawCursor(layer: Phaser.GameObjects.Container, cx: number, bottom: number): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(hex(palette.yellow), 1);
    graphics.fillTriangle(cx - 11, bottom - CURSOR_H, cx + 11, bottom - CURSOR_H, cx, bottom);
    this.layer.add(graphics);
  }

  // --- Round result beat (mockup 06_25_07: verdict after EVERY round) ---------
}
