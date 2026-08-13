// Drawing kit and result screens for the battle (split out of BattleScene when
// gauntlet 9 pushed that file past the 500-line rule of AGENTS.md).
//
// BattleDraw owns the pixel primitives the battle screens share (centred text,
// chamfered frames, shadowed bars) plus the two result screens of mockup
// 06_25_07: the per-round verdict and the final one. It draws only — every
// number it prints comes from the state it is handed, and the buttons it wires
// go straight to GameController commands.

import type Phaser from "phaser";
import { gameContext } from "../game/context";
import { battleChoiceIconKey } from "../game/AssetRegistry";
import { palette } from "../ui/palette";
import { addButton, addDisplayText, addRect, addSpriteImage, addText, TEXT_PAD } from "../ui/kit";
import { resourceById } from "../data/battle";
import { BattleConfig } from "../data/config/BattleConfig";
import type { BattleResource, BattleState, RoundResult } from "../core/types";

const W = 960;

// Mockup tones the palette does not carry yet (handoff: fold into palette.ts).
export const FRAME = "#878da3";
export const FRAME_DIM = "#4e5470";
export const LABEL_CYAN = "#6ec6ec";
export const HYPE_ORANGE = "#ff9d2f";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export class BattleDraw {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layer: Phaser.GameObjects.Container,
  ) {}

  // Same primitives aimed at another container — the card dock gets its own
  // layer so it can be animated as a group without moving the rest of the HUD.
  withLayer(layer: Phaser.GameObjects.Container): BattleDraw {
    return new BattleDraw(this.scene, layer);
  }

  // Shadowed pixel bar; segmented mode splits orange/yellow like the mockup.
  hudBar(
    x: number,
    y: number,
    w: number,
    h: number,
    value: number,
    max: number,
    color: string,
    segmented = false,
  ): void {
    addRect(this.scene, this.layer, x + 3, y + 3, w, h, "#000000", 0.28);
    addRect(this.scene, this.layer, x, y, w, h, "#060814");
    addRect(this.scene, this.layer, x, y, w, 2, "#ffffff", 0.2);
    addRect(this.scene, this.layer, x, y + h - 2, w, 2, "#03040a");
    const fill = Math.floor((clamp(value, 0, max) / max) * w);
    if (segmented) {
      const orange = Math.min(fill, Math.floor(w * 0.42));
      const yellow = Math.max(0, fill - orange);
      if (orange > 0) addRect(this.scene, this.layer, x, y, orange, h, "#ff771f");
      if (yellow > 0) addRect(this.scene, this.layer, x + orange, y, yellow, h, color);
    } else if (fill > 0) {
      addRect(this.scene, this.layer, x, y, fill, h, color);
      addRect(this.scene, this.layer, x, y, fill, Math.max(2, Math.floor(h * 0.35)), "#ffffff", 0.14);
    }
  }


  // Round verdict per the mockup: TU JUGADA (resource + icon, or PASADA when
  // the timer expired), the big one-word grade with the hype the answer
  // earned, RESPUESTA RIVAL naming the rival's resource with its grade and
  // hype, the tension note when a rule fired, HYPE TOTAL, and CONTINUAR.
  roundResultPanel(battle: BattleState, result: RoundResult): void {
    const played = result.choice ? resourceById(result.choice) : null;
    const playerColor = result.playerHypeDelta > 0 ? palette.green : palette.red;

    this.drawResultSeparator();
    this.drawPlayedPanel(played);

    // Centre box: player verdict + hype delta (mockup rows 275/322/372).
    addRect(this.scene, this.layer, 340, 262, 266, 141, palette.deep, 0.94);
    this.frame(340, 262, 266, 141, FRAME);
    this.centeredDisplayText(473, 274, result.playerVerdict, 32, playerColor);
    this.centeredDisplayText(473, 318, this.signed(result.playerHypeDelta), 44, playerColor);
    this.centeredText(473, 372, "HYPE", 20, HYPE_ORANGE);

    this.drawRivalAnswerPanel(result);
    this.drawTensionNotes(result);
    this.drawHypeTotal(battle.hype);
    addButton(this.scene, this.layer, 390, 492, 180, 26, "Continuar", () => gameContext().controller.advanceBattleRound(), {
      fill: "#11183a",
      size: 13,
    });
  }

  // Rival box: which resource they answered with, their grade and the hype
  // their answer earned.
  private drawRivalAnswerPanel(result: RoundResult): void {
    const rivalPlayed = resourceById(result.rivalChoice);
    addRect(this.scene, this.layer, 642, 262, 184, 141, palette.deep, 0.94);
    this.frame(642, 262, 184, 141, FRAME);
    this.centeredText(734, 271, "RESPUESTA RIVAL", 11, palette.muted);
    // Icon + name read as one centred group: the label shifts right by half
    // the icon block so the pair sits on the panel's centre line, not the text.
    const iconKey = battleChoiceIconKey(rivalPlayed.id);
    const iconBlock = iconKey ? 22 : 0;
    const label = this.fittedCenteredText(
      734 + iconBlock / 2,
      288,
      rivalPlayed.label.toUpperCase(),
      12,
      palette.ink,
      140 - iconBlock,
    );
    if (iconKey) {
      addSpriteImage(this.scene, this.layer, iconKey, label.x - label.width / 2 - 11, 295, 16, 0.5, 0.5, 18);
    }
    this.centeredDisplayText(734, 307, result.rivalVerdict, 20, palette.red);
    this.centeredDisplayText(734, 334, this.signed(result.rivalHypeDelta), 34, palette.red);
    this.centeredText(734, 376, "HYPE", 14, HYPE_ORANGE);
  }

  // Tension-rule notes ("aburres al publico", response bonus, timer expiry):
  // one discreet line between the verdict boxes and the HYPE TOTAL bar.
  private drawTensionNotes(result: RoundResult): void {
    if (result.tensionNotes.length === 0) return;
    this.centeredText(W / 2, 412, result.tensionNotes.join("  "), 11, palette.yellow);
  }

  // "+18" / "-7": hype deltas always carry their sign, like the mockup.
  private signed(value: number): string {
    return `${value >= 0 ? "+" : ""}${value}`;
  }

  // --- Final result (battle over) ----------------------------------------------

  finalResultPanel(battle: BattleState): void {
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
    addButton(this.scene, this.layer, 390, 492, 180, 26, "Continuar", () => gameContext().controller.finishBattle(), {
      fill: "#11183a",
      size: 13,
    });
  }

  // "RESULTADO" between two rules, like the mockup's section divider.
  private drawResultSeparator(): void {
    const label = this.centeredText(W / 2, 239, "RESULTADO", 15, palette.ink);
    const left = label.x + TEXT_PAD;
    const right = left + label.width - TEXT_PAD * 2;
    addRect(this.scene, this.layer, 185, 248, left - 195, 1, FRAME);
    addRect(this.scene, this.layer, right + 10, 248, 773 - (right + 10), 1, FRAME);
    addRect(this.scene, this.layer, 319, 275, 1, 115, FRAME_DIM);
    addRect(this.scene, this.layer, 624, 275, 1, 115, FRAME_DIM);
  }

  // TU JUGADA: the resource the player just used, with its icon — or PASADA
  // when the decision timer expired and no card was played.
  private drawPlayedPanel(played: BattleResource | null): void {
    addRect(this.scene, this.layer, 139, 262, 160, 141, palette.panel, 0.94);
    this.frame(139, 262, 160, 141, FRAME);
    this.centeredText(219, 270, "TU JUGADA:", 12, LABEL_CYAN);
    this.centeredText(219, 294, played ? played.label.toUpperCase() : BattleConfig.timer.passLabel, 16, palette.ink);
    const iconKey = played ? battleChoiceIconKey(played.id) : null;
    if (iconKey) addSpriteImage(this.scene, this.layer, iconKey, 219, 356, 66, 0.5, 0.5, 96);
  }

  // Big verdict word plus the hype the battle swung, in the mockup's centre box.
  private drawVerdictPanel(verdict: string, color: string, hypeDelta: number): void {
    addRect(this.scene, this.layer, 340, 262, 266, 141, palette.deep, 0.94);
    this.frame(340, 262, 266, 141, FRAME);
    this.centeredDisplayText(473, 272, verdict, 38, color);
    this.centeredDisplayText(473, 318, this.signed(hypeDelta), 40, color);
    this.centeredText(473, 372, "HYPE", 20, HYPE_ORANGE);
  }

  // RESPUESTA RIVAL: who answered and how hard they connected that round.
  private drawRivalPanel(battle: BattleState, rivalRoll: number): void {
    addRect(this.scene, this.layer, 642, 262, 184, 141, palette.deep, 0.94);
    this.frame(642, 262, 184, 141, FRAME);
    this.centeredText(734, 272, "RESPUESTA RIVAL", 11, palette.muted);
    this.centeredText(734, 294, battle.rivalName.toUpperCase(), 13, palette.red);
    this.centeredDisplayText(734, 318, String(rivalRoll), 40, palette.red);
    this.centeredText(734, 372, "PUNTOS", 14, HYPE_ORANGE);
  }

  // HYPE TOTAL bar with its N/100 readout.
  private drawHypeTotal(hype: number): void {
    this.centeredText(489, 438, "HYPE TOTAL", 16, palette.ink);
    this.frame(410, 458, 161, 25, FRAME);
    this.hudBar(412, 460, 157, 21, hype, 100, palette.yellow);
    this.valueLine(580, 464, String(Math.floor(hype)), "/100", 13, palette.yellow, palette.ink, "left");
  }

  // --- Text/frame helpers -----------------------------------------------------

  centeredText(cx: number, y: number, content: string, size: number, color: string): Phaser.GameObjects.Text {
    const text = addText(this.scene, this.layer, 0, y, content, size, color);
    text.setX(Math.round(cx - text.width / 2));
    return text;
  }

  // Centered text that shrinks (uniformly) when wider than maxWidth, so long
  // resource names never bleed out of their card or panel.
  fittedCenteredText(
    cx: number,
    y: number,
    content: string,
    size: number,
    color: string,
    maxWidth: number,
  ): Phaser.GameObjects.Text {
    const text = addText(this.scene, this.layer, 0, y, content, size, color);
    if (text.width > maxWidth) text.setScale(maxWidth / text.width);
    text.setX(Math.round(cx - text.displayWidth / 2));
    return text;
  }

  centeredDisplayText(cx: number, y: number, content: string, size: number, color: string): void {
    const text = addDisplayText(this.scene, this.layer, 0, y, content, size, color);
    text.setX(Math.round(cx - text.width / 2));
  }

  // Two-tone value line ("90" + "/100"), anchored left, centred or right.
  valueLine(
    x: number,
    y: number,
    left: string,
    right: string,
    size: number,
    leftColor: string,
    rightColor: string,
    anchor: "left" | "center" | "right",
  ): void {
    const a = addText(this.scene, this.layer, 0, y, left, size, leftColor);
    const b = addText(this.scene, this.layer, 0, y, right, size, rightColor);
    const aWidth = a.width - TEXT_PAD * 2;
    const bWidth = b.width - TEXT_PAD * 2;
    const total = aWidth + bWidth;
    const start = anchor === "center" ? x - total / 2 : anchor === "right" ? x - total : x;
    a.setX(Math.round(start - TEXT_PAD));
    b.setX(Math.round(start + aWidth - TEXT_PAD));
  }

  // Chamfered 2px pixel frame (the mockup's rounded card/panel outline).
  frame(x: number, y: number, w: number, h: number, color: string): void {
    const t = 2;
    const c = 4;
    addRect(this.scene, this.layer, x + c, y, w - c * 2, t, color);
    addRect(this.scene, this.layer, x + c, y + h - t, w - c * 2, t, color);
    addRect(this.scene, this.layer, x, y + c, t, h - c * 2, color);
    addRect(this.scene, this.layer, x + w - t, y + c, t, h - c * 2, color);
    addRect(this.scene, this.layer, x + t, y + t, t, t, color);
    addRect(this.scene, this.layer, x + w - t * 2, y + t, t, t, color);
    addRect(this.scene, this.layer, x + t, y + h - t * 2, t, t, color);
    addRect(this.scene, this.layer, x + w - t * 2, y + h - t * 2, t, t, color);
  }
}
