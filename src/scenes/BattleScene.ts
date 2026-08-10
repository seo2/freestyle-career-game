// Battle screen, rebuilt in Fase 4 against its mockups
// (reference/screens/06_52_01 a.m. (1).png = round, 06_25_07 a.m. (1).png =
// round result). Geometry is the mockup measured at 1672x941 and scaled by
// 0.574 to the 960x540 canvas.
//
// Layout: HUD (energia + hype per side, RONDA, ESTIMULO) over the live scene,
// two big performers on the ground, and a dock of vertical choice cards that
// float over the backdrop (no opaque panel). After every round the battle
// parks on its round-result beat (battle.pendingResult) and this scene draws
// the mockup's verdict panel until CONTINUAR/Enter advances the match.
// Presentation only: every click and key is a GameController command; numbers
// come from state, BattleConfig, and BattleSystem's read-only helpers.

import Phaser from "phaser";
import { eventBus } from "../events/EventBus";
import { gameContext } from "../game/context";
import { AssetRegistry, battleBackdropKey, battleChoiceIconKey } from "../game/AssetRegistry";
import { hex, palette } from "../ui/palette";
import { addButton, addDisplayText, addHitZone, addRect, addSpriteImage, addText, TEXT_PAD } from "../ui/kit";
import { battleChoices } from "../data/battle";
import { BattleConfig } from "../data/config/BattleConfig";
import { battleEnergyCost, projectedHypeGain } from "../systems/BattleSystem";
import { maxEnergy } from "../core/derived";
import type { BattleChoice, BattleState, GameState, RoundResult } from "../core/types";

const W = 960;
const H = 540;

// Tones the battle mockups use that src/ui/palette.ts does not carry yet.
// (handoff: fold these into the palette as frame / frameDim / label / hype.)
const FRAME = "#878da3";
const FRAME_DIM = "#4e5470";
const LABEL_CYAN = "#6ec6ec";
const HYPE_ORANGE = "#ff9d2f";

// Choice dock: six vertical cards, mockup card proportions (126x169, gap 24)
// centered on the canvas. The mockup shows five; the sixth fits by trimming the
// side margins, never the card or gap sizes.
const CARD_W = 126;
const CARD_H = 169;
const CARD_GAP = 24;
const CARD_TOP = 284;
const CARD_SELECT_PAD = 5;
const CURSOR_H = 12;

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

// Legacy battleStimulusLabel(): big keyword for the stimulus card. The mockup
// prints only this keyword on the battle screen (the full prompt sentence stays
// in state for the result/event text).
function battleStimulusLabel(prompt: string): string {
  if (prompt.includes("barrio") || prompt.includes("canciones")) return "BARRIO";
  if (prompt.includes("beat") || prompt.includes("tempo")) return "TEMPO";
  if (prompt.includes("dificil")) return "PALABRA";
  if (prompt.includes("tarima") || prompt.includes("publico")) return "ESCENA";
  if (prompt.includes("nuevo")) return "NOVATO";
  return "CORONA";
}

export class BattleScene extends Phaser.Scene {
  private layer!: Phaser.GameObjects.Container;

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
    gameContext().controller.update(delta / 1000);
  }

  private redraw(): void {
    this.layer.removeAll(true);
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
    this.drawHudSide(202, 42, state.energy, maxEnergy(state), battle.hype);
    this.drawHudSide(600, 42, battle.rivalEnergy, battle.rivalEnergyMax, battle.rivalHype);
    this.addCenteredDisplayText(483, 29, `RONDA ${battle.round}`, 26, palette.ink);
    this.addCenteredText(483, 68, "HYPE", 17, HYPE_ORANGE);
    this.drawHudBar(390, 88, 188, 14, battle.hype, 100, palette.yellow, true);
    const onResultScreen = battle.finished || battle.pendingResult !== null;
    this.drawStimulus(battle, onResultScreen ? STIMULUS_TOP_RESULT : STIMULUS_TOP_ROUND);
  }

  // ESTIMULO label + framed keyword box (mockup: no prompt sentence here).
  private drawStimulus(battle: BattleState, top: number): void {
    this.addCenteredText(483, top - 23, "ESTIMULO", 16, palette.ink);
    addRect(this, this.layer, 338, top, 290, 71, palette.deep, 0.9);
    this.drawFrame(338, top, 290, 71, FRAME);
    this.addCenteredDisplayText(483, top + 18, battleStimulusLabel(battle.prompt.text), 37, palette.yellow);
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

  // --- Choice dock ------------------------------------------------------------

  private cardX(index: number): number {
    const count = battleChoices.length;
    const total = count * CARD_W + (count - 1) * CARD_GAP;
    return Math.round((W - total) / 2) + index * (CARD_W + CARD_GAP);
  }

  private drawChoiceDock(battle: BattleState, battleFocus: number, state: GameState): void {
    battleChoices.forEach((choice, index) => {
      this.drawChoiceCard(choice, this.cardX(index), projectedHypeGain(battle, choice), index === battleFocus);
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
  private drawChoiceCard(choice: BattleChoice, x: number, hype: number, focused: boolean): void {
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
    this.addCenteredText(cx, y + 17, choice.label.toUpperCase(), 15, palette.ink);
    const iconKey = battleChoiceIconKey(choice.id);
    const icon = iconKey ? addSpriteImage(this, this.layer, iconKey, cx, y + 72, 50, 0.5, 0.5, 52) : null;
    if (!icon) addRect(this, this.layer, cx - 14, y + 65, 28, 14, FRAME_DIM);
    this.addCenteredDisplayText(cx, y + 110, `+${hype}`, 30, palette.ink);
    this.addCenteredText(cx, y + 142, "HYPE", 13, HYPE_ORANGE);
    addHitZone(this, this.layer, x, y, CARD_W, CARD_H, () => gameContext().controller.resolveBattle(choice));
  }

  // Selection cursor: yellow triangle pointing down at the focused card.
  private drawCursor(cx: number, bottom: number): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(hex(palette.yellow), 1);
    graphics.fillTriangle(cx - 11, bottom - CURSOR_H, cx + 11, bottom - CURSOR_H, cx, bottom);
    this.layer.add(graphics);
  }

  // --- Round result beat (mockup 06_25_07: verdict after EVERY round) ---------

  // Round verdict per the mockup: TU JUGADA (choice + icon), the big one-word
  // grade with the hype the answer earned, RESPUESTA RIVAL with the rival's
  // grade and hype, HYPE TOTAL, and CONTINUAR to advance the match.
  private drawRoundResultPanel(battle: BattleState, result: RoundResult): void {
    const played = battleChoices.find((choice) => choice.id === result.choice) ?? battleChoices[0];
    const playerColor = result.playerHypeDelta > 0 ? palette.green : palette.red;

    this.drawResultSeparator();
    this.drawPlayedPanel(played);

    // Centre box: player verdict + hype delta (mockup rows 275/322/372).
    addRect(this, this.layer, 340, 262, 266, 141, palette.deep, 0.94);
    this.drawFrame(340, 262, 266, 141, FRAME);
    this.addCenteredDisplayText(473, 274, result.playerVerdict, 32, playerColor);
    this.addCenteredDisplayText(473, 318, this.signed(result.playerHypeDelta), 44, playerColor);
    this.addCenteredText(473, 372, "HYPE", 20, HYPE_ORANGE);

    // Rival box: their grade and the hype their answer earned (rows 303/336/377).
    addRect(this, this.layer, 642, 262, 184, 141, palette.deep, 0.94);
    this.drawFrame(642, 262, 184, 141, FRAME);
    this.addCenteredText(734, 272, "RESPUESTA RIVAL", 11, palette.muted);
    this.addCenteredDisplayText(734, 301, result.rivalVerdict, 24, palette.red);
    this.addCenteredDisplayText(734, 334, this.signed(result.rivalHypeDelta), 40, palette.red);
    this.addCenteredText(734, 375, "HYPE", 14, HYPE_ORANGE);

    this.drawHypeTotal(battle.hype);
    addButton(this, this.layer, 390, 492, 180, 26, "Continuar", () => gameContext().controller.advanceBattleRound(), {
      fill: "#11183a",
      size: 13,
    });
  }

  // "+18" / "-7": hype deltas always carry their sign, like the mockup.
  private signed(value: number): string {
    return `${value >= 0 ? "+" : ""}${value}`;
  }

  // --- Final result (battle over) ----------------------------------------------

  private drawResultPanel(battle: BattleState): void {
    const last = battle.results[battle.results.length - 1];
    const played = battleChoices.find((choice) => choice.id === last?.choice) ?? battleChoices[0];
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

  // TU JUGADA: the choice the player just used, with its icon.
  private drawPlayedPanel(played: BattleChoice): void {
    addRect(this, this.layer, 139, 262, 160, 141, palette.panel, 0.94);
    this.drawFrame(139, 262, 160, 141, FRAME);
    this.addCenteredText(219, 270, "TU JUGADA:", 12, LABEL_CYAN);
    this.addCenteredText(219, 294, played.label.toUpperCase(), 16, palette.ink);
    const iconKey = battleChoiceIconKey(played.id);
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
