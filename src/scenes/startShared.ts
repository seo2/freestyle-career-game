// Shared presentation helpers for the start-mode screens (MenuScene and
// CreateMcScene): the layered rooftop cover backdrop with its procedural
// fallback, the logo lockup and the legacy pixel-button language. Ported from
// the legacy canvas renderer (drawStartBackdrop / drawLayeredCoverBackdrop /
// drawLogoLockup and friends); layout, coordinates and colors are kept 1:1.

import Phaser from "phaser";
import { AssetRegistry } from "../game/AssetRegistry";
import { palette } from "../ui/palette";
import { addHitZone, addRect, addSpriteImage, addText } from "../ui/kit";

export const CANVAS_W = 960;
export const CANVAS_H = 540;

// Cloud layers drift horizontally; scenes reposition them every frame from
// GameState.animationTime (legacy drawLayeredCoverBackdrop parallax).
export interface CloudRef {
  image: Phaser.GameObjects.Image;
  baseX: number;
}

export interface StartBackdropRefs {
  layered: boolean;
  clouds: CloudRef[];
}

const REQUIRED_COVER_KEYS = [
  AssetRegistry.cover.sky.key,
  AssetRegistry.cover.cityBack.key,
  AssetRegistry.cover.cityFront.key,
  AssetRegistry.cover.rooftopFloor.key,
  AssetRegistry.cover.rooftopFence.key,
];

// Legacy: Math.floor((state.animationTime * 6) % W).
export function cloudDriftOffset(animationTime: number): number {
  return Math.floor((animationTime * 6) % CANVAS_W);
}

// --- Canvas-texture gradients (exact legacy gradient fills) -----------------

function ensureCanvasTexture(scene: Phaser.Scene, key: string, paint: (ctx: CanvasRenderingContext2D) => void): boolean {
  if (scene.textures.exists(key)) return true;
  const texture = scene.textures.createCanvas(key, CANVAS_W, CANVAS_H);
  if (!texture) return false;
  paint(texture.context);
  texture.refresh();
  return true;
}

function addFullScreenTexture(
  scene: Phaser.Scene,
  layer: Phaser.GameObjects.Container,
  key: string,
  paint: (ctx: CanvasRenderingContext2D) => void,
): void {
  if (!ensureCanvasTexture(scene, key, paint)) return;
  const image = scene.add.image(0, 0, key).setOrigin(0, 0);
  layer.add(image);
}

// --- Image placement (legacy drawImageCover / drawCoverImageContain) --------

// Scale-to-cover with a centered crop, top-left anchored at (x, y).
function addCoverImage(
  scene: Phaser.Scene,
  layer: Phaser.GameObjects.Container,
  key: string,
  x: number,
  y: number,
  w: number,
  h: number,
  alpha = 1,
  blendMode?: Phaser.BlendModes,
): Phaser.GameObjects.Image | null {
  if (!scene.textures.exists(key)) return null;
  const frame = scene.textures.getFrame(key);
  if (frame.width <= 0 || frame.height <= 0) return null;
  const sourceRatio = frame.width / frame.height;
  const targetRatio = w / h;
  let sx = 0;
  let sy = 0;
  let sw = frame.width;
  let sh = frame.height;
  if (sourceRatio > targetRatio) {
    sw = frame.height * targetRatio;
    sx = (frame.width - sw) / 2;
  } else if (sourceRatio < targetRatio) {
    sh = frame.width / targetRatio;
    sy = (frame.height - sh) / 2;
  }
  const scaleX = w / sw;
  const scaleY = h / sh;
  const image = scene.add.image(x - sx * scaleX, y - sy * scaleY, key).setOrigin(0, 0);
  image.setScale(scaleX, scaleY);
  if (sx > 0 || sy > 0) image.setCrop(sx, sy, sw, sh);
  image.setAlpha(alpha);
  if (blendMode !== undefined) image.setBlendMode(blendMode);
  layer.add(image);
  return image;
}

// Scale-to-contain, centered inside the (x, y, w, h) box.
function addContainImage(
  scene: Phaser.Scene,
  layer: Phaser.GameObjects.Container,
  key: string,
  x: number,
  y: number,
  w: number,
  h: number,
  alpha = 1,
  blendMode?: Phaser.BlendModes,
): Phaser.GameObjects.Image | null {
  if (!scene.textures.exists(key)) return null;
  const frame = scene.textures.getFrame(key);
  if (frame.width <= 0 || frame.height <= 0) return null;
  const scale = Math.min(w / frame.width, h / frame.height);
  const image = scene.add.image(x + w / 2, y + h / 2, key).setScale(scale).setAlpha(alpha);
  if (blendMode !== undefined) image.setBlendMode(blendMode);
  layer.add(image);
  return image;
}

// --- Backdrop (legacy drawStartBackdrop) ------------------------------------

export function buildStartBackdrop(scene: Phaser.Scene, layer: Phaser.GameObjects.Container): StartBackdropRefs {
  if (REQUIRED_COVER_KEYS.every((key) => scene.textures.exists(key))) {
    return buildLayeredCover(scene, layer);
  }
  buildFallbackBackdrop(scene, layer);
  return { layered: false, clouds: [] };
}

// Legacy drawLayeredCoverBackdrop: sky, drifting clouds, city and rooftop
// layers, neon/graffiti/speaker props, radial shade and pixel frame.
function buildLayeredCover(scene: Phaser.Scene, layer: Phaser.GameObjects.Container): StartBackdropRefs {
  const cover = AssetRegistry.cover;
  addCoverImage(scene, layer, cover.sky.key, 0, 0, CANVAS_W, CANVAS_H);

  const clouds: CloudRef[] = [];
  for (const alpha of [0.48, 0.26]) {
    const image = addCoverImage(scene, layer, cover.clouds.key, 0, 0, CANVAS_W, CANVAS_H, alpha, Phaser.BlendModes.SCREEN);
    if (image) clouds.push({ image, baseX: image.x });
  }

  // Legacy composited these with "lighten"; WebGL falls back to normal
  // blending, which reads the same at these alpha levels.
  const lighten = Phaser.BlendModes.LIGHTEN;
  addCoverImage(scene, layer, cover.cityBack.key, 0, 0, CANVAS_W, CANVAS_H, 0.95, lighten);
  addCoverImage(scene, layer, cover.cityFront.key, 0, 0, CANVAS_W, CANVAS_H, 0.92, lighten);
  addCoverImage(scene, layer, cover.rooftopFloor.key, 0, 0, CANVAS_W, CANVAS_H, 0.95, lighten);
  addCoverImage(scene, layer, cover.rooftopFence.key, 0, 0, CANVAS_W, CANVAS_H, 1, lighten);
  addContainImage(scene, layer, cover.neonRap.key, 28, 190, 156, 254, 0.76, lighten);
  addContainImage(scene, layer, cover.graffitiFreestyle.key, 782, 172, 170, 280, 0.7, lighten);
  addContainImage(scene, layer, cover.speakerLeft.key, 12, 308, 100, 158, 0.98, lighten);
  addContainImage(scene, layer, cover.speakerRight.key, 852, 308, 100, 158, 0.98, lighten);

  addFullScreenTexture(scene, layer, "tex-cover-radial-shade", (ctx) => {
    const shade = ctx.createRadialGradient(CANVAS_W * 0.5, CANVAS_H * 0.48, 120, CANVAS_W * 0.5, CANVAS_H * 0.54, 600);
    shade.addColorStop(0, "rgba(4,8,36,0.04)");
    shade.addColorStop(0.72, "rgba(4,7,25,0.2)");
    shade.addColorStop(1, "rgba(2,4,14,0.72)");
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  });
  addRect(scene, layer, 14, 14, CANVAS_W - 28, 4, palette.borderHi);
  addRect(scene, layer, 14, CANVAS_H - 18, CANVAS_W - 28, 4, palette.borderLo);
  addRect(scene, layer, 14, 14, 4, CANVAS_H - 28, palette.borderHi);
  addRect(scene, layer, CANVAS_W - 18, 14, 4, CANVAS_H - 28, palette.borderLo);
  return { layered: true, clouds };
}

// Legacy procedural night-city fallback (used while cover art is missing).
function buildFallbackBackdrop(scene: Phaser.Scene, layer: Phaser.GameObjects.Container): void {
  addFullScreenTexture(scene, layer, "tex-start-fallback-sky", (ctx) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    gradient.addColorStop(0, "#060932");
    gradient.addColorStop(0.52, "#07134a");
    gradient.addColorStop(1, "#080b24");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  });
  addRect(scene, layer, 14, 14, CANVAS_W - 28, CANVAS_H - 28, "#0e1340", 0.52);
  addRect(scene, layer, 18, 18, CANVAS_W - 36, 4, palette.borderHi);
  addRect(scene, layer, 18, CANVAS_H - 22, CANVAS_W - 36, 4, palette.borderLo);
  for (let i = 0; i < 14; i += 1) {
    const x = 18 + i * 70;
    const h = 42 + ((i * 19) % 94);
    addRect(scene, layer, x, 248 - h, 42 + (i % 3) * 15, h, "#071132");
    for (let win = 0; win < 4; win += 1) {
      addRect(scene, layer, x + 8 + win * 12, 238 - h + ((i + win) % 5) * 16, 4, 6, win % 2 ? "#6aa7ff" : "#e1b84a");
    }
  }
  addRect(scene, layer, 0, 386, CANVAS_W, 154, "#101638");
  const streaks = scene.add.graphics();
  streaks.lineStyle(1, 0xffffff, 0.06);
  for (let i = 0; i < 11; i += 1) {
    streaks.lineBetween(0, 402 + i * 13, CANVAS_W, 390 + i * 11);
  }
  layer.add(streaks);
  addFallbackSpeaker(scene, layer, AssetRegistry.cover.speakerLeft.key, 52, 334);
  addFallbackSpeaker(scene, layer, AssetRegistry.cover.speakerRight.key, 838, 334);
  addText(scene, layer, 96, 248, "RAP", 24, palette.pink);
  addText(scene, layer, 748, 258, "vive el freestyle", 18, palette.blue);
}

// Speaker prop for the fallback backdrop: cover sprite when present, plain
// dark cabinet otherwise (legacy drawSpeakerStack footprint at scale 0.8).
function addFallbackSpeaker(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, key: string, x: number, y: number): void {
  if (addContainImage(scene, layer, key, x, y, 66, 86)) return;
  addRect(scene, layer, x, y, 66, 86, "#171a20");
  addRect(scene, layer, x + 11, y + 13, 40, 34, "#0d0e12");
  addRect(scene, layer, x + 18, y + 56, 27, 16, "#0d0e12");
}

// --- Main menu overlay (legacy drawMainMenuOverlay) --------------------------

export function addMenuOverlay(scene: Phaser.Scene, layer: Phaser.GameObjects.Container): void {
  addFullScreenTexture(scene, layer, "tex-menu-top-shade", (ctx) => {
    const topShade = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    topShade.addColorStop(0, "rgba(2,4,22,0.1)");
    topShade.addColorStop(0.36, "rgba(2,4,22,0.0)");
    topShade.addColorStop(1, "rgba(2,4,22,0.18)");
    ctx.fillStyle = topShade;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  });
  addMenuSpeakerStack(scene, layer, 20, 318, false);
  addMenuSpeakerStack(scene, layer, 866, 318, true);
  addScreenPixelBorder(scene, layer);
}

// Cover speaker sprites stand in for the legacy procedural stacks
// (drawMainMenuSpeakerStack), keeping the stack footprint incl. side panel.
function addMenuSpeakerStack(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, x: number, y: number, mirror: boolean): void {
  addRect(scene, layer, x + (mirror ? -10 : 10), y + 10, 78, 126, "#000000", 0.42);
  const key = mirror ? AssetRegistry.cover.speakerRight.key : AssetRegistry.cover.speakerLeft.key;
  if (addContainImage(scene, layer, key, mirror ? x - 14 : x, y, 86, 132, 0.98)) return;
  addRect(scene, layer, x, y, 72, 132, "#050812");
  addRect(scene, layer, x + (mirror ? -14 : 72), y + 14, 14, 112, "#151a28");
  addRect(scene, layer, x + (mirror ? -14 : 72), y + 14, 14, 14, "#262c42");
}

// Legacy drawScreenPixelBorder.
function addScreenPixelBorder(scene: Phaser.Scene, layer: Phaser.GameObjects.Container): void {
  addRect(scene, layer, 14, 14, CANVAS_W - 28, 4, "#303979");
  addRect(scene, layer, 14, CANVAS_H - 18, CANVAS_W - 28, 4, "#202761");
  addRect(scene, layer, 14, 14, 4, CANVAS_H - 28, "#5660b5");
  addRect(scene, layer, CANVAS_W - 18, 14, 4, CANVAS_H - 28, "#1b2258");
  addRect(scene, layer, 18, 18, CANVAS_W - 36, 2, "#ffffff", 0.11);
}

// --- Logo lockup (legacy drawLogoLockup / drawLogoSprite) --------------------

export function addLogoLockup(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, x: number, y: number, scale: number): void {
  const key = AssetRegistry.cover.logo.key;
  if (scene.textures.exists(key)) {
    const frame = scene.textures.getFrame(key);
    if (frame.width > 0 && frame.height > 0) {
      const width = 266 * scale;
      const height = width * (frame.height / frame.width);
      addRect(scene, layer, x + 16 * scale, y + 24 * scale, width - 34 * scale, height - 28 * scale, "#000000", 0.24);
      const image = scene.add.image(x - 16 * scale, y - 6 * scale, key).setOrigin(0, 0);
      image.setDisplaySize(width, height);
      layer.add(image);
      return;
    }
  }
  addRect(scene, layer, x + 12 * scale, y + 34 * scale, 236 * scale, 24 * scale, "#000000", 0.46);
  addText(scene, layer, x + 4 * scale, y + 10 * scale, "FREESTYLE", 38 * scale, "#0a0c18");
  addText(scene, layer, x, y + 6 * scale, "FREESTYLE", 38 * scale, "#f7f6ef");
  addText(scene, layer, x + 78 * scale, y + 55 * scale, "GAME", 27 * scale, "#0a0c18");
  addText(scene, layer, x + 74 * scale, y + 51 * scale, "GAME", 27 * scale, palette.yellow);
  addRect(scene, layer, x + 8 * scale, y + 92 * scale, 208 * scale, 4 * scale, palette.red);
  addRect(scene, layer, x + 84 * scale, y + 102 * scale, 126 * scale, 3 * scale, palette.blue);
}

// --- Player figure --------------------------------------------------------------

// MC where the legacy screens drew drawMc(x, y, s): the idle sprite with feet
// on the legacy foot line (y + 22*scale), scaled to spriteHeight. The compact
// 8-rect pixel placeholder stays as the missing-texture fallback.
export function addMcFigure(
  scene: Phaser.Scene,
  layer: Phaser.GameObjects.Container,
  x: number,
  y: number,
  scale: number,
  spriteHeight = Math.round(79 * scale),
): void {
  const px = (dx: number, dy: number, w: number, h: number, color: string, alpha = 1): void => {
    addRect(scene, layer, x + dx * scale, y + dy * scale, w * scale, h * scale, color, alpha);
  };
  // Real sprite: narrow contact shadow drawn first so it sits under the shoes.
  // The wider slab is only for the block placeholder (bigger silhouette).
  const feetY = y + 22 * scale;
  if (scene.textures.exists(AssetRegistry.characters.mcIdle.key)) {
    addRect(scene, layer, x - 15 * scale, feetY - 3 * scale, 30 * scale, 4 * scale, "#000000", 0.3);
    addSpriteImage(scene, layer, AssetRegistry.characters.mcIdle.key, x, feetY, spriteHeight, 0.5, 1);
    return;
  }
  px(-30, 20, 60, 7, "#000000", 0.25);
  px(-11, -57, 22, 6, palette.red);
  px(-9, -51, 18, 16, "#f0bd82");
  px(-13, -35, 26, 31, palette.teal);
  px(-11, -4, 9, 22, palette.blue);
  px(2, -4, 9, 22, palette.blue);
  px(-12, 18, 11, 4, palette.ink);
  px(1, 18, 11, 4, palette.ink);
}

// --- Legacy button() (dark pixel button, yellow top edge, left-aligned label) --

export function addStartButton(
  scene: Phaser.Scene,
  layer: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  onClick: () => void,
): void {
  addRect(scene, layer, x + 4, y + 5, w, h, "#000000", 0.34);
  addRect(scene, layer, x, y, w, h, "#11183a");
  addRect(scene, layer, x, y, w, 3, palette.yellow);
  addRect(scene, layer, x, y + h - 3, w, 3, "#080b1a");
  addRect(scene, layer, x, y, 3, h, palette.borderHi);
  addRect(scene, layer, x + w - 3, y, 3, h, "#141936");
  addText(scene, layer, x + 12, y + Math.floor(h / 2) - 8, label, 13, palette.ink);
  addHitZone(scene, layer, x, y, w, h, onClick);
}
