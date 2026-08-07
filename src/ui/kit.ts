// Shared pixel-UI building blocks for scenes. Everything draws into a given
// container so scenes can rebuild their dynamic layer on STATE_CHANGED (the
// immediate-mode pattern the legacy canvas used, adapted to Phaser).

import Phaser from "phaser";
import { hex, palette } from "./palette";

export const FONT_FAMILY =
  'ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

export function textStyle(
  size: number,
  color: string,
  extra: Partial<Phaser.Types.GameObjects.Text.TextStyle> = {},
): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: FONT_FAMILY,
    fontSize: `${size}px`,
    color,
    resolution: 2,
    ...extra,
  };
}

export function addText(
  scene: Phaser.Scene,
  layer: Phaser.GameObjects.Container,
  x: number,
  y: number,
  content: string,
  size: number,
  color: string,
  extra: Partial<Phaser.Types.GameObjects.Text.TextStyle> = {},
): Phaser.GameObjects.Text {
  const text = scene.add.text(x, y, content, textStyle(size, color, extra));
  layer.add(text);
  return text;
}

// Wrapped text constrained to a width (legacy drawTextBlock equivalent).
export function addTextBlock(
  scene: Phaser.Scene,
  layer: Phaser.GameObjects.Container,
  x: number,
  y: number,
  content: string,
  size: number,
  color: string,
  width: number,
): Phaser.GameObjects.Text {
  return addText(scene, layer, x, y, content, size, color, {
    wordWrap: { width, useAdvancedWrap: true },
  });
}

export function addRect(
  scene: Phaser.Scene,
  layer: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  alpha = 1,
): Phaser.GameObjects.Rectangle {
  const rect = scene.add.rectangle(x, y, w, h, hex(color), alpha).setOrigin(0, 0);
  layer.add(rect);
  return rect;
}

// Double-border pixel panel (legacy drawPanel / drawHudFrame language).
export function addPanel(
  scene: Phaser.Scene,
  layer: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string = palette.panel,
): void {
  addRect(scene, layer, x - 2, y - 2, w + 4, h + 4, palette.borderLo);
  addRect(scene, layer, x, y, w, h, fill);
  addRect(scene, layer, x, y, w, 2, palette.borderHi);
  addRect(scene, layer, x, y, 2, h, palette.borderHi);
}

export function addSoftPanel(
  scene: Phaser.Scene,
  layer: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  h: number,
  fill = "rgba(10,14,34,0.9)",
): void {
  // Soft panel: single subtle border, translucent fill.
  const alphaFill = fill.startsWith("rgba") ? 0.9 : 1;
  addRect(scene, layer, x, y, w, h, palette.deep, alphaFill);
  addRect(scene, layer, x, y, w, 1, palette.line);
  addRect(scene, layer, x, y + h - 1, w, 1, palette.borderLo);
}

export function addMeter(
  scene: Phaser.Scene,
  layer: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  h: number,
  value: number,
  max: number,
  color: string,
): void {
  addRect(scene, layer, x, y, w, h, "#0d0f13");
  const ratio = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  if (ratio > 0) addRect(scene, layer, x + 1, y + 1, Math.max(1, Math.floor((w - 2) * ratio)), h - 2, color);
}

export interface ButtonOptions {
  fill?: string;
  textColor?: string;
  size?: number;
  selected?: boolean;
  disabled?: boolean;
}

// Interactive pixel button (legacy button() + selection cursor language).
export function addButton(
  scene: Phaser.Scene,
  layer: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  onClick: () => void,
  options: ButtonOptions = {},
): void {
  const { fill = "#1a2145", textColor = palette.ink, size = 14, selected = false, disabled = false } = options;
  addRect(scene, layer, x - 2, y - 2, w + 4, h + 4, selected ? palette.yellow : palette.borderLo);
  const body = addRect(scene, layer, x, y, w, h, disabled ? "#141827" : fill);
  const text = scene.add
    .text(x + w / 2, y + h / 2, label, textStyle(size, disabled ? "#6a6f85" : textColor))
    .setOrigin(0.5);
  layer.add(text);
  if (!disabled) {
    body.setInteractive({ useHandCursor: true });
    body.on("pointerdown", onClick);
  }
}

// Invisible interactive zone over custom-drawn content (legacy zones[]).
export function addHitZone(
  scene: Phaser.Scene,
  layer: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  h: number,
  onClick: () => void,
): void {
  const zone = scene.add.zone(x, y, w, h).setOrigin(0, 0);
  zone.setInteractive({ useHandCursor: true });
  zone.on("pointerdown", onClick);
  layer.add(zone);
}
