// Battle screen: stage backdrop, HUD (energy/hype per side, round, stimulus),
// 3x2 decision grid and the result panel. Presentation only — every click is
// forwarded to GameController commands; layout mirrors the legacy canvas
// renderer (drawBattleScreen and friends) with baseline-to-top-left y shifts.

import Phaser from "phaser";
import { eventBus } from "../events/EventBus";
import { gameContext } from "../game/context";
import { stageBackdropKey } from "../game/AssetRegistry";
import { hex, palette } from "../ui/palette";
import {
  addButton,
  addHitZone,
  addRect,
  addPanel,
  addSoftPanel,
  addText,
  addTextBlock,
} from "../ui/kit";
import { battleChoices } from "../data/battle";
import { statLabels } from "../data/stats";
import { maxEnergy } from "../core/derived";
import type { BattleChoice, BattleState, StatKey } from "../core/types";

const W = 960;
const H = 540;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Legacy statColor(): accent per stat for the choice cards.
function statColor(stat: StatKey): string {
  switch (stat) {
    case "flow":
      return palette.teal;
    case "punchline":
      return palette.red;
    case "metrica":
      return palette.blue;
    case "improvisacion":
      return palette.yellow;
    case "escena":
      return palette.pink;
    case "carisma":
      return palette.green;
    case "disciplina":
      return palette.ink;
  }
}

// Legacy battleStimulusLabel(): big keyword for the stimulus card.
function battleStimulusLabel(prompt: string): string {
  if (prompt.includes("barrio") || prompt.includes("canciones")) return "BARRIO";
  if (prompt.includes("beat") || prompt.includes("tempo")) return "TEMPO";
  if (prompt.includes("dificil")) return "PALABRA";
  if (prompt.includes("tarima") || prompt.includes("publico")) return "ESCENA";
  if (prompt.includes("nuevo")) return "NOVATO";
  return "CORONA";
}

// Legacy lastBattleNote(): closing note shown in the result panel.
function lastBattleNote(battle: BattleState): string {
  const last = battle.results[battle.results.length - 1];
  if (!last) return "La batalla termino.";
  if (battle.result === "win") return "La ultima ronda prende al publico y te llevas el evento.";
  if (battle.result === "draw") return "El publico queda dividido, pero tu nombre empieza a circular.";
  return "No alcanzo esta vez, pero sumaste experiencia real de tarima.";
}

export class BattleScene extends Phaser.Scene {
  private layer!: Phaser.GameObjects.Container;

  constructor() {
    super("Battle");
  }

  create(): void {
    this.cameras.main.setBackgroundColor(hex(palette.deep));
    this.buildBackdrop();
    this.addPerformer(160, 302, "mc");
    this.addPerformer(804, 302, "rival");

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
    } else {
      this.drawDecisionPanel(battle, input.battleFocus);
    }
  }

  // --- Static backdrop --------------------------------------------------------

  private buildBackdrop(): void {
    const backdrop = this.add.container(0, 0);
    const key = stageBackdropKey(gameContext().controller.state.stage);
    if (this.textures.exists(key)) {
      const image = this.add.image(W / 2, H / 2, key);
      image.setScale(Math.max(W / image.width, H / image.height));
      backdrop.add(image);
      // Scrim bands approximating the legacy night gradient shade.
      addRect(this, backdrop, 0, 0, W, Math.floor(H * 0.32), "#04071c", 0.4);
      addRect(this, backdrop, 0, Math.floor(H * 0.32), W, Math.floor(H * 0.32), "#0a1136", 0.2);
      addRect(this, backdrop, 0, Math.floor(H * 0.64), W, H - Math.floor(H * 0.64), "#040612", 0.44);
      addRect(this, backdrop, 0, 0, W, H, "#121a52", 0.12);
    } else {
      addRect(this, backdrop, 0, 0, W, H, palette.deep);
    }
  }

  // Compact placeholder performers (real sprites arrive in Fase 3): a 28x44
  // rounded body with a cap and a mic dot, bobbing gently in place.
  private addPerformer(x: number, y: number, variant: "mc" | "rival"): void {
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
    container.setScale(1.62);
    this.tweens.add({
      targets: container,
      y: y - 4,
      duration: variant === "mc" ? 620 : 700,
      delay: variant === "mc" ? 0 : 180,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  // --- HUD (legacy drawBattleStageHud) -----------------------------------------

  private drawStageHud(battle: BattleState): void {
    const state = gameContext().controller.state;
    this.drawScreenPixelBorder();
    addText(this, this.layer, 78, 30, "TU", 24, palette.ink);
    addText(this, this.layer, 792, 30, "RIVAL", 24, palette.ink);
    this.drawHudSide(202, 42, state.energy, maxEnergy(state), battle.hype, false);
    this.drawHudSide(600, 42, 70 + battle.rivalPower * 2, 100, Math.max(20, 100 - battle.hype / 2), true);
    this.addLineText(396, 25, `RONDA ${battle.round}`, 30, palette.ink, 180);
    addText(this, this.layer, 452, 75, "HYPE", 17, "#ff9d2f");
    this.drawHudBar(390, 104, 188, 15, battle.hype, 100, palette.yellow, true);
    addSoftPanel(this, this.layer, 338, 144, 284, 88);
    addText(this, this.layer, 418, 154, "ESTIMULO", 16, palette.ink);
    this.addLineText(388, 178, battleStimulusLabel(battle.prompt.text), 36, palette.yellow, 204);
  }

  // Legacy drawBattleHudSide: ENERGIA value + bar, HYPE bar per performer.
  private drawHudSide(
    x: number,
    y: number,
    energy: number,
    maxEnergyValue: number,
    hype: number,
    alignRight: boolean,
  ): void {
    const valueX = alignRight ? x + 126 : x + 134;
    addText(this, this.layer, x, y - 12, "ENERGIA", 12, palette.ink);
    this.addLineText(valueX, y - 12, `${Math.floor(energy)}/${maxEnergyValue}`, 12, palette.ink, 68);
    this.drawHudBar(x, y + 14, 166, 13, energy, maxEnergyValue, palette.green);
    addText(this, this.layer, x, y + 30, "HYPE", 16, "#ff9d2f");
    this.drawHudBar(x, y + 60, 166, 13, hype, 100, palette.yellow, true);
  }

  // Legacy drawHudBar: shadowed pixel bar; segmented mode splits orange/yellow.
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

  // Legacy drawScreenPixelBorder: thin frame around the battle screen.
  private drawScreenPixelBorder(): void {
    addRect(this, this.layer, 14, 14, W - 28, 4, "#303979");
    addRect(this, this.layer, 14, H - 18, W - 28, 4, "#202761");
    addRect(this, this.layer, 14, 14, 4, H - 28, "#5660b5");
    addRect(this, this.layer, W - 18, 14, 4, H - 28, "#1b2258");
    addRect(this, this.layer, 18, 18, W - 36, 2, "#ffffff", 0.11);
  }

  // --- Decision panel (legacy drawBattleDecisionPanel) --------------------------

  private drawDecisionPanel(battle: BattleState, battleFocus: number): void {
    addSoftPanel(this, this.layer, 40, 324, 880, 198);
    addTextBlock(this, this.layer, 68, 339, battle.prompt.text, 15, palette.ink, 820);
    battleChoices.forEach((choice, index) => {
      const x = 68 + (index % 3) * 284;
      const y = 388 + Math.floor(index / 3) * 58;
      const boosted = battle.prompt.best.includes(choice.id);
      this.drawChoiceCard(choice, index, x, y, 256, 48, boosted, index === battleFocus);
    });
  }

  // Legacy drawBattleChoiceCard: hotkey + label, stat hint, boosted/focus marks.
  private drawChoiceCard(
    choice: BattleChoice,
    index: number,
    x: number,
    y: number,
    w: number,
    h: number,
    boosted: boolean,
    focused: boolean,
  ): void {
    const accent = boosted ? palette.teal : statColor(choice.stat);
    const fill = focused ? "#303945" : boosted ? "#1d332f" : "#15171d";
    addRect(this, this.layer, x + 3, y + 3, w, h, "#000000", 0.24);
    addRect(this, this.layer, x, y, w, h, fill);
    addRect(this, this.layer, x, y, w, 3, accent);
    this.addLineText(x + 12, y + 7, `${index + 1}. ${choice.label}`, 13, palette.ink, 122);
    this.addLineText(
      x + 144,
      y + 10,
      boosted ? "lectura buena" : statLabels[choice.stat],
      10,
      boosted ? palette.teal : palette.muted,
      92,
    );
    if (focused) addRect(this, this.layer, x + w - 8, y + 9, 4, h - 18, palette.yellow);
    addHitZone(this, this.layer, x, y, w, h, () => gameContext().controller.resolveBattle(choice));
  }

  // --- Result panel (legacy drawBattleResultPanel) -------------------------------

  private drawResultPanel(battle: BattleState): void {
    const label = battle.result === "win" ? "Ganaste" : battle.result === "draw" ? "Replica" : "Derrota";
    const color = battle.result === "win" ? palette.yellow : battle.result === "draw" ? palette.teal : palette.red;
    addSoftPanel(this, this.layer, 104, 322, 752, 176);
    this.addLineText(380, 328, label, 34, color, 220);
    addPanel(this, this.layer, 148, 382, 176, 58);
    this.addLineText(174, 394, "Tu puntaje", 12, palette.muted, 120);
    this.addLineText(210, 408, String(battle.playerScore * 32 + battle.hype), 22, palette.yellow, 80);
    addPanel(this, this.layer, 382, 382, 176, 58);
    this.addLineText(430, 394, "Rival", 12, palette.muted, 80);
    this.addLineText(444, 408, String(battle.rivalScore * 32 + Math.floor((100 - battle.hype) / 2)), 22, palette.ink, 80);
    addTextBlock(this, this.layer, 604, 389, lastBattleNote(battle), 13, palette.ink, 200);
    addButton(this, this.layer, 384, 454, 192, 38, "Continuar", () => gameContext().controller.finishBattle(), {
      fill: "#11183a",
      size: 13,
    });
  }

  // Legacy drawTextLine: single line clamped to maxWidth with ellipsis.
  private addLineText(x: number, y: number, content: string, size: number, color: string, maxWidth: number): void {
    const text = addText(this, this.layer, x, y, content, size, color);
    if (text.width <= maxWidth) return;
    let trimmed = content;
    while (trimmed.length > 1 && text.width > maxWidth) {
      trimmed = trimmed.slice(0, -1);
      text.setText(`${trimmed.trimEnd()}...`);
    }
  }
}
