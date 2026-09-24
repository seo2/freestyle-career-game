// The pieza as a living place (Fase 12 B/C): the MC's idle, the light of the
// hour, the lamps, and the props the career has earned. Split out of
// CareerScene (AGENTS.md 500-line rule). Presentation only; every curve is a
// pure function of the scene clock (src/ui/feedback.ts).

import Phaser from "phaser";
import { AssetRegistry, roomPropKey } from "../game/AssetRegistry";
import { hex as hexColor, palette } from "../ui/palette";
import { addRect, addSpriteImage } from "../ui/kit";
import { flicker, idlePose } from "../ui/feedback";
import { earnedRoomProps } from "../systems/RoomSystem";
import type { GameState } from "../core/types";

const W = 960;

// The MC stands with feet on this line; idlePose nods and breathes around it.
const MC_FEET_Y = 312;

// Time-of-day over the room art (which is painted at night): morning warms and
// lifts it, afternoon goes amber, night stays deep. The window glass gets its
// own sky so the city outside agrees with the clock.
const DAYLIGHT = [
  { color: "#ffe3b3", alpha: 0.15, add: true, sky: "#9cc6ff", skyAlpha: 0.6 },
  { color: "#ff9a4a", alpha: 0.1, add: true, sky: "#ff9d5c", skyAlpha: 0.42 },
  { color: "#070c30", alpha: 0.2, add: false, sky: "", skyAlpha: 0 },
] as const;
const ROOM_WINDOW = { x: 512, y: 90, w: 175, h: 84 } as const;

// Light sources painted into the pieza backdrop (pixel positions measured on
// the 960x540 room). Each glows and flickers on its own seed; they only apply
// to that backdrop, since other stages have their own art.
const ROOM_LAMPS = [
  { x: 253, y: 192, r: 34, color: "#ffd27a", seed: 1 },
  { x: 793, y: 128, r: 26, color: "#ffe2a0", seed: 3 },
  { x: 811, y: 304, r: 38, color: "#ffcf73", seed: 4 },
  { x: 343, y: 165, r: 30, color: "#6fd2ff", seed: 5 },
] as const;


export class RoomLife {
  private mcImage: Phaser.GameObjects.Image | null = null;
  private mcScale = 1;
  private lampGlows: { glow: Phaser.GameObjects.Arc; halo: Phaser.GameObjects.Arc; seed: number }[] = [];
  private lampStrength = 1;
  // Scene clock for the idle animations, advanced by the frame delta only.
  private clockMs = 0;

  constructor(private readonly scene: Phaser.Scene) {}

  // The room layer was cleared: forget handles into it.
  reset(): void {
    this.mcImage = null;
    this.lampGlows = [];
  }

  // Standing MC sprite, feet on the legacy floor line (y=312). Falls back to
  // the compact placeholder rects when the texture is missing.
  drawMc(layer: Phaser.GameObjects.Container, hasBackdrop: boolean): void {
    const cx = hasBackdrop ? 392 : 284;
    const image = addSpriteImage(this.scene, layer, AssetRegistry.characters.mcIdle.key, cx, MC_FEET_Y, 120, 0.5, 1);
    if (image) {
      this.mcImage = image;
      this.mcScale = image.scaleX;
      this.animate();
      return;
    }
    addRect(this.scene, layer, cx - 12, 276, 24, 36, "#111318");
    addRect(this.scene, layer, cx - 12, 268, 24, 8, palette.red);
  }

  // Tint for the current block, plus the lamps when this is the pieza art.
  drawLight(layer: Phaser.GameObjects.Container, state: GameState, isPieza: boolean, roomBottom: number): void {
    const light = DAYLIGHT[state.block] ?? DAYLIGHT[DAYLIGHT.length - 1];
    if (isPieza && light.sky) {
      const sky = this.scene.add.rectangle(ROOM_WINDOW.x, ROOM_WINDOW.y, ROOM_WINDOW.w, ROOM_WINDOW.h, hexColor(light.sky), light.skyAlpha);
      sky.setOrigin(0, 0).setBlendMode(Phaser.BlendModes.ADD);
      layer.add(sky);
    }
    const tint = this.scene.add.rectangle(0, 0, W, roomBottom, hexColor(light.color), light.alpha).setOrigin(0, 0);
    if (light.add) tint.setBlendMode(Phaser.BlendModes.ADD);
    layer.add(tint);
    if (!isPieza) return;
    // Lamps matter at night; by day they are nearly invisible against the sun.
    const strength = state.block === 2 ? 1 : 0.35;
    for (const lamp of ROOM_LAMPS) {
      const halo = this.scene.add.circle(lamp.x, lamp.y, lamp.r * 1.8, hexColor(lamp.color), 0.05 * strength);
      const glow = this.scene.add.circle(lamp.x, lamp.y, lamp.r, hexColor(lamp.color), 0.12 * strength);
      halo.setBlendMode(Phaser.BlendModes.ADD);
      glow.setBlendMode(Phaser.BlendModes.ADD);
      // Into the room layer, before the MC and the HUD are drawn: light sits
      // on the scenery, never on top of text.
      layer.add([halo, glow]);
      this.lampGlows.push({ glow, halo, seed: lamp.seed });
    }
    this.lampStrength = strength;
  }

  // What the career has earned, hung and set down in the room. Drawn after the
  // backdrop and before the light, so the hour's tint falls on the props too.
  drawProps(layer: Phaser.GameObjects.Container, state: GameState): void {
    for (const prop of earnedRoomProps(state)) {
      const key = roomPropKey(prop.art);
      if (!key) continue;
      const originY = prop.anchor === "center" ? 0.5 : 1;
      const image = addSpriteImage(this.scene, layer, key, prop.x, prop.y, prop.h, 0.5, originY);
      if (image && prop.glow) image.setBlendMode(Phaser.BlendModes.ADD);
    }
  }

  // Per-frame life for the room: the MC's idle and the lamps' flicker. Both are
  // pure functions of the scene clock, so a paused frame and a live one agree.
  animate(deltaMs = 0): void {
    this.clockMs += deltaMs;
    if (this.mcImage) {
      const pose = idlePose(this.clockMs);
      this.mcImage.setY(MC_FEET_Y - pose.dy);
      this.mcImage.setScale(this.mcScale, this.mcScale * pose.scaleY);
    }
    const strength = this.lampStrength;
    for (const lamp of this.lampGlows) {
      const f = flicker(this.clockMs, lamp.seed);
      lamp.glow.setAlpha((0.08 + 0.1 * f) * strength);
      lamp.halo.setAlpha((0.03 + 0.04 * f) * strength);
    }
  }
}
