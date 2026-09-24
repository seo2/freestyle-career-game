// The career screen's top HUD and the room's pinned goal (split out of
// CareerScene, AGENTS.md 500-line rule). Draws only; the buttons forward
// GameController commands.

import type Phaser from "phaser";
import { gameContext } from "../game/context";
import { AssetRegistry } from "../game/AssetRegistry";
import { palette } from "../ui/palette";
import { addHitZone, addRect, addSpriteImage, addText } from "../ui/kit";
import { maxEnergy } from "../core/derived";
import { formatBlock, formatDay } from "../systems/CalendarSystem";
import { getCareerGoals } from "../systems/ProgressionSystem";
import { CalendarConfig } from "../data/config/CalendarConfig";
import { clamp } from "../utils/math";
import type { GameState } from "../core/types";

// Approximate monospace advance per font px; used to ellipsize single lines
// the way legacy drawTextLine did with real canvas metrics.
const MONO_ADVANCE = 0.62;

// "Where am I going": the next career goal pinned to the room's top-left wall,
// so the player never has to open the map to know what the week is for. Clicking
// it opens the map, where goals live in full.
const GOAL_CHIP = { x: 22, y: 96, w: 262, h: 44, barH: 5 } as const;

// Clock row under the energy bar: weekday + week on the left, the day's three
// blocks as pips on the right (the lit one is now).
const CLOCK = { x: 112, baseline: 81, pipsX: 226, pipW: 18, pipH: 6, pipGap: 4 } as const;

function clipLine(text: string, size: number, maxWidth: number): string {
  const charW = size * MONO_ADVANCE;
  if (text.length * charW <= maxWidth) return text;
  const keep = Math.max(1, Math.floor(maxWidth / charW) - 3);
  return `${text.slice(0, keep).trimEnd()}...`;
}

// Single text line placed by its legacy alphabetic baseline (kit text is
// top-left origin, so we shift up by the font size).
export function baselineText(
  scene: Phaser.Scene,
  layer: Phaser.GameObjects.Container,
  x: number,
  yBaseline: number,
  text: string,
  size: number,
  color: string,
  maxWidth = 0,
): void {
  const content = maxWidth > 0 ? clipLine(text, size, maxWidth) : text;
  addText(scene, layer, x, yBaseline - size, content, size, color);
}


// Legacy formatHudNumber: thousands separated with dots.
function formatHudNumber(value: number): string {
  return String(Math.floor(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}


export class CareerHud {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layer: Phaser.GameObjects.Container,
  ) {}

  drawHeader(state: GameState): void {
    this.drawHudFrame(12, 10, 936, 76);
    // MC bust: the mockup sits it straight on the HUD band (no well box) at
    // roughly 105 mockup px tall; placeholder initial fallback.
    if (!addSpriteImage(this.scene, this.layer, AssetRegistry.characters.mcBust.key, 58, 49, 60)) {
      const initial = (state.playerName.trim() || "MC").charAt(0).toUpperCase();
      addText(this.scene, this.layer, 58, 49, initial, 26, palette.yellow).setOrigin(0.5);
    }
    // The portrait is the character sheet's door, as in most RPGs.
    addHitZone(this.scene, this.layer, 22, 14, 74, 70, () => gameContext().controller.setCareerView("stats"));

    // Mockup stacks label + value on one line (baseline ~44) over the bar.
    baselineText(this.scene, this.layer, 112, 42, "ENERGIA", 16, palette.ink);
    baselineText(this.scene, this.layer, 270, 42, `${state.energy}/${maxEnergy(state)}`, 16, palette.ink, 86);
    this.drawHudBar(112, 52, 230, 15, state.energy, maxEnergy(state), palette.green);
    this.drawClock(state);

    this.drawResourceCard(362, 22, 138, 54, "cash", "", formatHudNumber(state.cash), palette.green);
    this.drawResourceCard(516, 22, 224, 54, "fans", "FANS", formatHudNumber(state.fans), palette.blue);
    this.drawResourceCard(756, 22, 142, 54, "respect", "RESPETO", formatHudNumber(state.respect), "#7b63cc");
    // The calendar mockup (06_23_14 (4)) carries two icon buttons at the top
    // right; they are also the only POINTER entry to the calendar and the stats
    // screens, which the removed tab bar used to provide (project rule 5: the
    // game must be fully playable with the mouse alone).
    this.drawHudIconButton(904, 20, "calendar");
    this.drawHudIconButton(904, 50, "stats");
  }

  // "LUN · SEM 1" plus three pips for Mañana/Tarde/Noche: how much of today is
  // left reads at a glance instead of from a word.
  private drawClock(state: GameState): void {
    baselineText(this.scene, this.layer, CLOCK.x, CLOCK.baseline, `${formatDay(state.day)} · SEM ${state.week}`, 10, palette.ink, 140);
    const blocks = CalendarConfig.clock.blocksPerDay;
    for (let i = 0; i < blocks; i += 1) {
      const x = CLOCK.pipsX + i * (CLOCK.pipW + CLOCK.pipGap);
      const color = i === state.block ? palette.yellow : i < state.block ? "#2a3170" : "#4a5299";
      addRect(this.scene, this.layer, x, CLOCK.baseline - 8, CLOCK.pipW, CLOCK.pipH, color);
    }
    baselineText(
      this.scene,
      this.layer,
      CLOCK.pipsX + blocks * (CLOCK.pipW + CLOCK.pipGap) + 2,
      CLOCK.baseline,
      formatBlock(state.block).toUpperCase(),
      10,
      palette.yellow,
    );
  }

  // Pinned next goal: label, one line of what is missing, and a thin progress
  // bar in the goal's own colour.
  drawGoalChip(state: GameState): void {
    const goal = getCareerGoals(state)[0];
    if (!goal) return;
    const { x, y, w, h, barH } = GOAL_CHIP;
    addRect(this.scene, this.layer, x + 3, y + 3, w, h, "#000000", 0.35);
    addRect(this.scene, this.layer, x, y, w, h, "#060b27", 0.9);
    addRect(this.scene, this.layer, x, y, 3, h, palette.yellow);
    baselineText(this.scene, this.layer, x + 12, y + 14, "SIGUIENTE META", 9, palette.yellow);
    baselineText(this.scene, this.layer, x + 108, y + 14, goal.detail, 9, palette.muted, w - 116);
    baselineText(this.scene, this.layer, x + 12, y + 31, goal.label.toUpperCase(), 13, palette.ink, w - 24);
    const barW = w - 24;
    addRect(this.scene, this.layer, x + 12, y + h - barH - 5, barW, barH, "#0d1030");
    const fill = Math.floor((clamp(goal.value, 0, goal.max) / Math.max(1, goal.max)) * barW);
    if (fill > 0) addRect(this.scene, this.layer, x + 12, y + h - barH - 5, fill, barH, goal.color);
    addHitZone(this.scene, this.layer, x, y, w, h, () => gameContext().controller.setCareerView("map"));
  }

  // Legacy drawHudFrame: layered pixel frame with sheen.
  private drawHudFrame(x: number, y: number, w: number, h: number): void {
    addRect(this.scene, this.layer, x + 5, y + 5, w, h, "#000000", 0.38);
    addRect(this.scene, this.layer, x, y, w, h, "#060b27");
    addRect(this.scene, this.layer, x + 3, y + 3, w - 6, h - 6, "#0b1234");
    addRect(this.scene, this.layer, x, y, w, 3, "#2e377f");
    addRect(this.scene, this.layer, x, y + h - 3, w, 3, "#262e6e");
    addRect(this.scene, this.layer, x, y, 3, h, "#5660b5");
    addRect(this.scene, this.layer, x + w - 3, y, 3, h, "#1b2258");
    addRect(this.scene, this.layer, x + 7, y + 7, w - 14, 2, "#ffffff", 0.14);
  }

  // Legacy drawHudBar (non-segmented variant).
  private drawHudBar(x: number, y: number, w: number, h: number, value: number, max: number, color: string): void {
    addRect(this.scene, this.layer, x + 3, y + 3, w, h, "#000000", 0.28);
    addRect(this.scene, this.layer, x, y, w, h, "#060814");
    addRect(this.scene, this.layer, x, y, w, 2, "#ffffff", 0.2);
    addRect(this.scene, this.layer, x, y + h - 2, w, 2, "#03040a");
    const fill = Math.floor((clamp(value, 0, max) / max) * w);
    if (fill > 0) {
      addRect(this.scene, this.layer, x, y, fill, h, color);
      addRect(this.scene, this.layer, x, y, fill, Math.max(2, Math.floor(h * 0.35)), "#ffffff", 0.14);
    }
  }

  // Legacy drawHudResourceCard with simplified rect/glyph icons.
  // Small square HUD button: pixel frame + short caption, opens a career view.
  // The calendar glyph is the mockup's own; stats reuses the rising-bars mark
  // the stats screen draws beside every metric, so the button looks like what
  // it opens.
  private drawHudIconButton(x: number, y: number, view: "calendar" | "stats"): void {
    const active = gameContext().controller.careerView === view;
    addRect(this.scene, this.layer, x - 1, y - 1, 34, 28, active ? palette.yellow : "#333a78");
    addRect(this.scene, this.layer, x, y, 32, 26, active ? "#1b2555" : "#0b1230");
    if (view === "calendar") {
      if (!addSpriteImage(this.scene, this.layer, AssetRegistry.icons.uiCalendar.key, x + 16, y + 13, 20, 0.5, 0.5, 22)) {
        addText(this.scene, this.layer, x + 16, y + 13, "CAL", 10, palette.ink).setOrigin(0.5);
      }
    } else {
      const bars = [7, 12, 17];
      bars.forEach((bh, i) => addRect(this.scene, this.layer, x + 7 + i * 7, y + 21 - bh, 5, bh, i === 2 ? palette.yellow : "#8e97e6"));
    }
    addHitZone(this.scene, this.layer, x, y, 32, 26, () => gameContext().controller.setCareerView(view));
  }

  private drawResourceCard(
    x: number,
    y: number,
    w: number,
    h: number,
    icon: "cash" | "fans" | "respect",
    label: string,
    value: string,
    color: string,
  ): void {
    addRect(this.scene, this.layer, x + 4, y + 4, w, h, "#000000", 0.32);
    addRect(this.scene, this.layer, x, y, w, h, "#07102d");
    addRect(this.scene, this.layer, x, y, w, 3, "#343d86");
    addRect(this.scene, this.layer, x, y + h - 3, w, 3, "#111744");
    addRect(this.scene, this.layer, x, y, 3, h, "#5660b5");
    addRect(this.scene, this.layer, x + w - 3, y, 3, h, "#1c2359");

    const resIconKeys = {
      cash: AssetRegistry.icons.resCash.key,
      fans: AssetRegistry.icons.resFans.key,
      respect: AssetRegistry.icons.resRespect.key,
    } as const;
    if (addSpriteImage(this.scene, this.layer, resIconKeys[icon], x + 34, y + 27, 32, 0.5, 0.5, 32)) {
      // Sprite icon drawn; skip the procedural glyph fallback below.
    } else if (icon === "cash") {
      baselineText(this.scene, this.layer, x + 12, y + 40, "$", 36, color);
      addRect(this.scene, this.layer, x + 34, y + 5, 3, 40, "#1d6f3c");
    } else if (icon === "fans") {
      addRect(this.scene, this.layer, x + 29, y + 9, 12, 12, color);
      addRect(this.scene, this.layer, x + 27, y + 23, 16, 14, color);
      addRect(this.scene, this.layer, x + 13, y + 17, 10, 10, "#4776df");
      addRect(this.scene, this.layer, x + 10, y + 28, 14, 10, "#4776df");
      addRect(this.scene, this.layer, x + 47, y + 17, 10, 10, "#4776df");
      addRect(this.scene, this.layer, x + 46, y + 28, 14, 10, "#4776df");
    } else {
      addRect(this.scene, this.layer, x + 27, y + 5, 8, 20, color);
      addRect(this.scene, this.layer, x + 36, y + 7, 8, 18, color);
      addRect(this.scene, this.layer, x + 45, y + 11, 8, 16, color);
      addRect(this.scene, this.layer, x + 20, y + 15, 10, 16, color);
      addRect(this.scene, this.layer, x + 24, y + 25, 28, 18, color);
      addRect(this.scene, this.layer, x + 32, y + 41, 18, 8, "#4b3c88");
      addRect(this.scene, this.layer, x + 16, y + 22, 9, 6, "#4b3c88");
    }

    if (label) {
      baselineText(this.scene, this.layer, x + 72, y + 25, label, 16, palette.ink);
      baselineText(this.scene, this.layer, x + 72, y + 48, value, 20, palette.ink, w - 84);
    } else {
      baselineText(this.scene, this.layer, x + 66, y + 40, value, 22, palette.ink, w - 68);
    }
  }

}
