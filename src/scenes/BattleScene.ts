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
import { addButton, addDisplayText, addHitZone, addRect, addSpriteImage, addText, TEXT_PAD } from "../ui/kit";
import { resourceById } from "../data/battle";
import { rivalArchetypes } from "../data/rivals";
import { BattleConfig } from "../data/config/BattleConfig";
import { battleEnergyCost, battleRoundSeconds, projectedHypeGain } from "../systems/BattleSystem";
import { maxEnergy } from "../core/derived";
import type { BattleResource, BattleState, GameState, RoundResult } from "../core/types";

const W = 960;
const H = 540;

// Tones the battle mockups use that src/ui/palette.ts does not carry yet.
// (handoff: fold these into the palette as frame / frameDim / label / hype.)
const FRAME = "#878da3";
const FRAME_DIM = "#4e5470";
const LABEL_CYAN = "#6ec6ec";
const HYPE_ORANGE = "#ff9d2f";

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

    this.layer = this.add.container(0, 0);
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
  }

  private redraw(): void {
    this.layer.removeAll(true);
    this.timerFill = null;
    const { controller, input } = gameContext();
    const battle = controller.state.battle;
    if (!battle) return;

    this.drawStageHud(battle);
    if (battle.finished) {
      this.drawResultPanel(battle);
    } else if (battle.pendingResult) {
      this.drawRoundResultPanel(battle, battle.pendingResult);
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
    this.addCenteredText(134, 33, "TU", 18, palette.ink);
    this.addCenteredText(824, 33, "RIVAL", 18, palette.ink);
    // Who you are facing and what this room rewards (gauntlet 10): both come
    // from state, so the player can read the rival and play to the crowd
    // instead of guessing.
    this.addCenteredText(824, 52, rivalArchetypes[battle.rivalArchetype].label.toUpperCase(), 11, palette.muted);
    this.drawHudSide(202, 42, state.energy, maxEnergy(state), battle.hype);
    this.drawHudSide(600, 42, battle.rivalEnergy, battle.rivalEnergyMax, battle.rivalHype);
    this.addCenteredDisplayText(483, 29, `RONDA ${battle.round}`, 26, palette.ink);
    this.addCenteredText(483, 68, "HYPE", 17, HYPE_ORANGE);
    this.drawHudBar(390, 88, 188, 14, battle.hype, 100, palette.yellow, true);
    const onResultScreen = battle.finished || battle.pendingResult !== null;
    if (!onResultScreen) this.drawDecisionTimer(battle);
    this.drawStimulus(battle, onResultScreen ? STIMULUS_TOP_RESULT : STIMULUS_TOP_ROUND);
    // The crowd's taste rides just under the card dock, where the round screen
    // has room; the verdict beat needs that band for its panels.
    if (!onResultScreen) this.addCenteredText(W / 2, CARD_TOP + CARD_H + 60, battle.crowdLine, 11, LABEL_CYAN);
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
    this.addCenteredText(483, top - 23, "ESTIMULO", 16, palette.ink);
    addRect(this, this.layer, 338, top, 290, 71, palette.deep, 0.9);
    this.drawFrame(338, top, 290, 71, FRAME);
    this.addCenteredDisplayText(483, top + 18, battle.prompt.label.toUpperCase(), 37, palette.yellow);
  }

  // ENERGIA value + bar and the HYPE bar for one performer.
  private drawHudSide(x: number, y: number, energy: number, maxEnergyValue: number, hype: number): void {
    addText(this, this.layer, x, y - 12, "ENERGIA", 12, palette.ink);
    this.addValueLine(x + 164, y - 5, `${Math.floor(energy)}`, `/${maxEnergyValue}`, 12, palette.green, palette.ink, "right");
    this.drawHudBar(x, y + 14, 166, 13, energy, maxEnergyValue, palette.green);
    addText(this, this.layer, x, y + 27, "HYPE", 14, HYPE_ORANGE);
    this.drawHudBar(x, y + 46, 166, 13, hype, 100, palette.yellow, true);
  }

  // Shadowed pixel bar; segmented mode splits orange/yellow like the mockup.
  private drawHudBar(
    x: number,
    y: number,
    w: number,
    h: number,
    value: number,
    max: number,
    color: string,
    segmented = false,
  ): void {
    addRect(this, this.layer, x + 3, y + 3, w, h, "#000000", 0.28);
    addRect(this, this.layer, x, y, w, h, "#060814");
    addRect(this, this.layer, x, y, w, 2, "#ffffff", 0.2);
    addRect(this, this.layer, x, y + h - 2, w, 2, "#03040a");
    const fill = Math.floor((clamp(value, 0, max) / max) * w);
    if (segmented) {
      const orange = Math.min(fill, Math.floor(w * 0.42));
      const yellow = Math.max(0, fill - orange);
      if (orange > 0) addRect(this, this.layer, x, y, orange, h, "#ff771f");
      if (yellow > 0) addRect(this, this.layer, x + orange, y, yellow, h, color);
    } else if (fill > 0) {
      addRect(this, this.layer, x, y, fill, h, color);
      addRect(this, this.layer, x, y, fill, Math.max(2, Math.floor(h * 0.35)), "#ffffff", 0.14);
    }
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
    hand.forEach((resource, index) => {
      this.drawChoiceCard(
        resource,
        this.cardX(index, hand.length),
        projectedHypeGain(battle, resource),
        index === battleFocus,
      );
    });
    this.addValueLine(
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
  private drawChoiceCard(choice: BattleResource, x: number, hype: number, focused: boolean): void {
    const y = CARD_TOP;
    const cx = x + CARD_W / 2;
    addRect(this, this.layer, x + 3, y + 4, CARD_W, CARD_H, "#000000", 0.34);
    if (focused) {
      const pad = CARD_SELECT_PAD;
      addRect(this, this.layer, x - pad, y - pad, CARD_W + pad * 2, CARD_H + pad * 2, palette.deep, 0.94);
      this.drawFrame(x - pad, y - pad, CARD_W + pad * 2, CARD_H + pad * 2, palette.yellow);
      this.drawCursor(cx, y - 3);
    }
    addRect(this, this.layer, x, y, CARD_W, CARD_H, palette.deep, 0.94);
    this.drawFrame(x, y, CARD_W, CARD_H, focused ? palette.yellow : FRAME);
    // Long resource names (IMPROVISACION, STORYTELLING) shrink to the card.
    this.addFittedCenteredText(cx, y + 17, choice.label.toUpperCase(), 15, palette.ink, CARD_W - 10);
    const iconKey = battleChoiceIconKey(choice.id);
    const icon = iconKey ? addSpriteImage(this, this.layer, iconKey, cx, y + 72, 50, 0.5, 0.5, 52) : null;
    // Four of the ten resources have no cut icon yet (docs/ASSETS.md): a dashed
    // frame reads as "pending art", the way the shop's preview slot does, so a
    // missing sprite can never be mistaken for a broken card.
    if (!icon) this.drawPendingIconSlot(cx, y + 72);
    this.addCenteredDisplayText(cx, y + 110, `+${hype}`, 30, palette.ink);
    this.addCenteredText(cx, y + 142, "HYPE", 13, HYPE_ORANGE);
    addHitZone(this, this.layer, x, y, CARD_W, CARD_H, () => gameContext().controller.resolveBattle(choice));
  }

  // Dashed placeholder for a battle resource whose icon is still pending.
  private drawPendingIconSlot(cx: number, cy: number): void {
    const w = 44;
    const h = 44;
    const x = cx - w / 2;
    const y = cy - h / 2;
    const dash = 4;
    for (let dx = 0; dx < w; dx += dash * 2) {
      const run = Math.min(dash, w - dx);
      addRect(this, this.layer, x + dx, y, run, 1, FRAME_DIM);
      addRect(this, this.layer, x + dx, y + h - 1, run, 1, FRAME_DIM);
    }
    for (let dy = 0; dy < h; dy += dash * 2) {
      const run = Math.min(dash, h - dy);
      addRect(this, this.layer, x, y + dy, 1, run, FRAME_DIM);
      addRect(this, this.layer, x + w - 1, y + dy, 1, run, FRAME_DIM);
    }
  }

  // Selection cursor: yellow triangle pointing down at the focused card.
  private drawCursor(cx: number, bottom: number): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(hex(palette.yellow), 1);
    graphics.fillTriangle(cx - 11, bottom - CURSOR_H, cx + 11, bottom - CURSOR_H, cx, bottom);
    this.layer.add(graphics);
  }

  // --- Round result beat (mockup 06_25_07: verdict after EVERY round) ---------

  // Round verdict per the mockup: TU JUGADA (resource + icon, or PASADA when
  // the timer expired), the big one-word grade with the hype the answer
  // earned, RESPUESTA RIVAL naming the rival's resource with its grade and
  // hype, the tension note when a rule fired, HYPE TOTAL, and CONTINUAR.
  private drawRoundResultPanel(battle: BattleState, result: RoundResult): void {
    const played = result.choice ? resourceById(result.choice) : null;
    const playerColor = result.playerHypeDelta > 0 ? palette.green : palette.red;

    this.drawResultSeparator();
    this.drawPlayedPanel(played);

    // Centre box: player verdict + hype delta (mockup rows 275/322/372).
    addRect(this, this.layer, 340, 262, 266, 141, palette.deep, 0.94);
    this.drawFrame(340, 262, 266, 141, FRAME);
    this.addCenteredDisplayText(473, 274, result.playerVerdict, 32, playerColor);
    this.addCenteredDisplayText(473, 318, this.signed(result.playerHypeDelta), 44, playerColor);
    this.addCenteredText(473, 372, "HYPE", 20, HYPE_ORANGE);

    this.drawRivalAnswerPanel(result);
    this.drawTensionNotes(result);
    this.drawHypeTotal(battle.hype);
    addButton(this, this.layer, 390, 492, 180, 26, "Continuar", () => gameContext().controller.advanceBattleRound(), {
      fill: "#11183a",
      size: 13,
    });
  }

  // Rival box: which resource they answered with, their grade and the hype
  // their answer earned.
  private drawRivalAnswerPanel(result: RoundResult): void {
    const rivalPlayed = resourceById(result.rivalChoice);
    addRect(this, this.layer, 642, 262, 184, 141, palette.deep, 0.94);
    this.drawFrame(642, 262, 184, 141, FRAME);
    this.addCenteredText(734, 271, "RESPUESTA RIVAL", 11, palette.muted);
    // Icon + name read as one centred group: the label shifts right by half
    // the icon block so the pair sits on the panel's centre line, not the text.
    const iconKey = battleChoiceIconKey(rivalPlayed.id);
    const iconBlock = iconKey ? 22 : 0;
    const label = this.addFittedCenteredText(
      734 + iconBlock / 2,
      288,
      rivalPlayed.label.toUpperCase(),
      12,
      palette.ink,
      140 - iconBlock,
    );
    if (iconKey) {
      addSpriteImage(this, this.layer, iconKey, label.x - label.width / 2 - 11, 295, 16, 0.5, 0.5, 18);
    }
    this.addCenteredDisplayText(734, 307, result.rivalVerdict, 20, palette.red);
    this.addCenteredDisplayText(734, 334, this.signed(result.rivalHypeDelta), 34, palette.red);
    this.addCenteredText(734, 376, "HYPE", 14, HYPE_ORANGE);
  }

  // Tension-rule notes ("aburres al publico", response bonus, timer expiry):
  // one discreet line between the verdict boxes and the HYPE TOTAL bar.
  private drawTensionNotes(result: RoundResult): void {
    if (result.tensionNotes.length === 0) return;
    this.addCenteredText(W / 2, 412, result.tensionNotes.join("  "), 11, palette.yellow);
  }

  // "+18" / "-7": hype deltas always carry their sign, like the mockup.
  private signed(value: number): string {
    return `${value >= 0 ? "+" : ""}${value}`;
  }

  // --- Final result (battle over) ----------------------------------------------

  private drawResultPanel(battle: BattleState): void {
    const last = battle.results[battle.results.length - 1];
    const played = last?.choice ? resourceById(last.choice) : null;
    const verdict = battle.result === "win" ? "GANASTE" : battle.result === "draw" ? "REPLICA" : "DERROTA";
    const color = battle.result === "win" ? palette.green : battle.result === "draw" ? palette.teal : palette.red;
    const hypeDelta = battle.hype - BattleConfig.rounds.openingHype;

    this.drawResultSeparator();
    this.drawPlayedPanel(played);
    this.drawVerdictPanel(verdict, color, hypeDelta);
    this.drawRivalPanel(battle, last?.rival ?? 0);
    this.drawHypeTotal(battle.hype);
    addButton(this, this.layer, 390, 492, 180, 26, "Continuar", () => gameContext().controller.finishBattle(), {
      fill: "#11183a",
      size: 13,
    });
  }

  // "RESULTADO" between two rules, like the mockup's section divider.
  private drawResultSeparator(): void {
    const label = this.addCenteredText(W / 2, 239, "RESULTADO", 15, palette.ink);
    const left = label.x + TEXT_PAD;
    const right = left + label.width - TEXT_PAD * 2;
    addRect(this, this.layer, 185, 248, left - 195, 1, FRAME);
    addRect(this, this.layer, right + 10, 248, 773 - (right + 10), 1, FRAME);
    addRect(this, this.layer, 319, 275, 1, 115, FRAME_DIM);
    addRect(this, this.layer, 624, 275, 1, 115, FRAME_DIM);
  }

  // TU JUGADA: the resource the player just used, with its icon — or PASADA
  // when the decision timer expired and no card was played.
  private drawPlayedPanel(played: BattleResource | null): void {
    addRect(this, this.layer, 139, 262, 160, 141, palette.panel, 0.94);
    this.drawFrame(139, 262, 160, 141, FRAME);
    this.addCenteredText(219, 270, "TU JUGADA:", 12, LABEL_CYAN);
    this.addCenteredText(219, 294, played ? played.label.toUpperCase() : BattleConfig.timer.passLabel, 16, palette.ink);
    const iconKey = played ? battleChoiceIconKey(played.id) : null;
    if (iconKey) addSpriteImage(this, this.layer, iconKey, 219, 356, 66, 0.5, 0.5, 96);
  }

  // Big verdict word plus the hype the battle swung, in the mockup's centre box.
  private drawVerdictPanel(verdict: string, color: string, hypeDelta: number): void {
    addRect(this, this.layer, 340, 262, 266, 141, palette.deep, 0.94);
    this.drawFrame(340, 262, 266, 141, FRAME);
    this.addCenteredDisplayText(473, 272, verdict, 38, color);
    this.addCenteredDisplayText(473, 318, this.signed(hypeDelta), 40, color);
    this.addCenteredText(473, 372, "HYPE", 20, HYPE_ORANGE);
  }

  // RESPUESTA RIVAL: who answered and how hard they connected that round.
  private drawRivalPanel(battle: BattleState, rivalRoll: number): void {
    addRect(this, this.layer, 642, 262, 184, 141, palette.deep, 0.94);
    this.drawFrame(642, 262, 184, 141, FRAME);
    this.addCenteredText(734, 272, "RESPUESTA RIVAL", 11, palette.muted);
    this.addCenteredText(734, 294, battle.rivalName.toUpperCase(), 13, palette.red);
    this.addCenteredDisplayText(734, 318, String(rivalRoll), 40, palette.red);
    this.addCenteredText(734, 372, "PUNTOS", 14, HYPE_ORANGE);
  }

  // HYPE TOTAL bar with its N/100 readout.
  private drawHypeTotal(hype: number): void {
    this.addCenteredText(489, 438, "HYPE TOTAL", 16, palette.ink);
    this.drawFrame(410, 458, 161, 25, FRAME);
    this.drawHudBar(412, 460, 157, 21, hype, 100, palette.yellow);
    this.addValueLine(580, 464, String(Math.floor(hype)), "/100", 13, palette.yellow, palette.ink, "left");
  }

  // --- Text/frame helpers -----------------------------------------------------

  private addCenteredText(cx: number, y: number, content: string, size: number, color: string): Phaser.GameObjects.Text {
    const text = addText(this, this.layer, 0, y, content, size, color);
    text.setX(Math.round(cx - text.width / 2));
    return text;
  }

  // Centered text that shrinks (uniformly) when wider than maxWidth, so long
  // resource names never bleed out of their card or panel.
  private addFittedCenteredText(
    cx: number,
    y: number,
    content: string,
    size: number,
    color: string,
    maxWidth: number,
  ): Phaser.GameObjects.Text {
    const text = addText(this, this.layer, 0, y, content, size, color);
    if (text.width > maxWidth) text.setScale(maxWidth / text.width);
    text.setX(Math.round(cx - text.displayWidth / 2));
    return text;
  }

  private addCenteredDisplayText(cx: number, y: number, content: string, size: number, color: string): void {
    const text = addDisplayText(this, this.layer, 0, y, content, size, color);
    text.setX(Math.round(cx - text.width / 2));
  }

  // Two-tone value line ("90" + "/100"), anchored left, centred or right.
  private addValueLine(
    x: number,
    y: number,
    left: string,
    right: string,
    size: number,
    leftColor: string,
    rightColor: string,
    anchor: "left" | "center" | "right",
  ): void {
    const a = addText(this, this.layer, 0, y, left, size, leftColor);
    const b = addText(this, this.layer, 0, y, right, size, rightColor);
    const aWidth = a.width - TEXT_PAD * 2;
    const bWidth = b.width - TEXT_PAD * 2;
    const total = aWidth + bWidth;
    const start = anchor === "center" ? x - total / 2 : anchor === "right" ? x - total : x;
    a.setX(Math.round(start - TEXT_PAD));
    b.setX(Math.round(start + aWidth - TEXT_PAD));
  }

  // Chamfered 2px pixel frame (the mockup's rounded card/panel outline).
  private drawFrame(x: number, y: number, w: number, h: number, color: string): void {
    const t = 2;
    const c = 4;
    addRect(this, this.layer, x + c, y, w - c * 2, t, color);
    addRect(this, this.layer, x + c, y + h - t, w - c * 2, t, color);
    addRect(this, this.layer, x, y + c, t, h - c * 2, color);
    addRect(this, this.layer, x + w - t, y + c, t, h - c * 2, color);
    addRect(this, this.layer, x + t, y + t, t, t, color);
    addRect(this, this.layer, x + w - t * 2, y + t, t, t, color);
    addRect(this, this.layer, x + t, y + h - t * 2, t, t, color);
    addRect(this, this.layer, x + w - t * 2, y + h - t * 2, t, t, color);
  }
}
