// Shared presentation helpers for the start-mode screens (MenuScene and
// CreateMcScene): the rooftop cover backdrop, the framed portrait used by Crear
// MC, the logo lockup, the MC figure and the rounded pixel-button language both
// screens are built from.
//
// Geometry here is measured off the Fase 4 mockups (1672x941 -> 960x540, factor
// 0.5742): reference/screens/ChatGPT Image 15 jun 2026, 06_23_13 a.m. (1).png
// (menu) and ...06_29_41 a.m. (1).png (Crear MC). Callers pass canvas-space
// rects; nothing in here reads GameState.
//
// The cover art (public/assets/main-menu) ships as opaque RGB layers whose
// "empty" filler is black or near-black navy, so it needs real transparency to
// stack. Phaser 4's WebGL renderer has no LIGHTEN game-object blend mode (it
// silently falls back to NORMAL), which used to leave the menu showing nothing
// but the fence layer plus a black box around every prop. Each source is
// therefore colour-keyed once into a cached canvas texture (filler -> alpha 0)
// and the whole stack is composited into one canvas image per screen.

import Phaser from "phaser";
import { AssetRegistry } from "../game/AssetRegistry";
import { hex, palette } from "../ui/palette";
import { addHitZone, addRect, addSpriteImage, addText, displayStyle, textStyle } from "../ui/kit";

export const CANVAS_W = 960;
export const CANVAS_H = 540;

const cover = AssetRegistry.cover;

// --- Canvas-texture painting -------------------------------------------------

function ensureCanvasTexture(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  paint: (ctx: CanvasRenderingContext2D) => void,
): boolean {
  if (scene.textures.exists(key)) return true;
  const texture = scene.textures.createCanvas(key, w, h);
  if (!texture) return false;
  paint(texture.context);
  texture.refresh();
  return true;
}

function addTextureImage(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, key: string, x: number, y: number): void {
  const image = scene.add.image(x, y, key).setOrigin(0, 0);
  layer.add(image);
}

function textureSize(scene: Phaser.Scene, key: string): { source: CanvasImageSource; w: number; h: number } | null {
  if (!scene.textures.exists(key)) return null;
  const frame = scene.textures.getFrame(key);
  if (!frame || frame.width <= 0 || frame.height <= 0) return null;
  const source = scene.textures.get(key).getSourceImage() as unknown as CanvasImageSource;
  return source ? { source, w: frame.width, h: frame.height } : null;
}

// Every cover layer's filler pixels have red+green at (or below) a couple of
// units while all real content (lit windows, fence rails, neon, concrete) is
// well above it, so red+green is the key channel. Cached as its own canvas
// texture: the keying cost is paid once per source, not once per screen.
const DEFAULT_KEY_LEVEL = 4;

function keyedSource(
  scene: Phaser.Scene,
  key: string,
  level: number,
): { source: CanvasImageSource; w: number; h: number } | null {
  const base = textureSize(scene, key);
  if (!base) return null;
  const keyedKey = `keyed-${key}-${level}`;
  const ok = ensureCanvasTexture(scene, keyedKey, base.w, base.h, (ctx) => {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(base.source, 0, 0);
    const image = ctx.getImageData(0, 0, base.w, base.h);
    const px = image.data;
    for (let i = 0; i < px.length; i += 4) {
      if (px[i] + px[i + 1] <= level) px[i + 3] = 0;
    }
    ctx.putImageData(image, 0, 0);
  });
  return ok ? textureSize(scene, keyedKey) : base;
}

// Scale-to-cover crop of a source, expressed in source pixels.
function coverCrop(w: number, h: number, sourceW: number, sourceH: number): [number, number, number, number] {
  const sourceRatio = sourceW / sourceH;
  const targetRatio = w / h;
  if (sourceRatio > targetRatio) {
    const sw = sourceH * targetRatio;
    return [(sourceW - sw) / 2, 0, sw, sourceH];
  }
  if (sourceRatio < targetRatio) {
    const sh = sourceW / targetRatio;
    return [0, (sourceH - sh) / 2, sourceW, sh];
  }
  return [0, 0, sourceW, sourceH];
}

interface CoverLayer {
  key: string;
  alpha: number;
  // Skips the colour key (used for the base sky, which is meant to be opaque).
  opaque?: boolean;
  keyLevel?: number;
  // Shifts the layer down inside the target rect (clipped at the bottom). The
  // Crear MC portrait uses it to push the rooftop below the logo.
  offsetY?: number;
}

// Scale-to-cover paint of one layer, centred horizontally like the legacy
// drawImageCover.
function paintCoverLayer(ctx: CanvasRenderingContext2D, scene: Phaser.Scene, w: number, h: number, layer: CoverLayer): void {
  const source = layer.opaque
    ? textureSize(scene, layer.key)
    : keyedSource(scene, layer.key, layer.keyLevel ?? DEFAULT_KEY_LEVEL);
  if (!source) return;
  const [sx, sy, sw, sh] = coverCrop(w, h, source.w, source.h);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = layer.alpha;
  ctx.globalCompositeOperation = "source-over";
  ctx.drawImage(source.source, sx, sy, sw, sh, 0, layer.offsetY ?? 0, w, h);
  ctx.restore();
}

interface CoverProp {
  key: string;
  x: number;
  y: number;
  w: number;
  h: number;
  alpha: number;
}

// Scale-to-contain paint of a prop, centred in its box (legacy drawCoverImageContain).
function paintProp(ctx: CanvasRenderingContext2D, scene: Phaser.Scene, prop: CoverProp): void {
  const source = keyedSource(scene, prop.key, DEFAULT_KEY_LEVEL);
  if (!source) return;
  const scale = Math.min(prop.w / source.w, prop.h / source.h);
  const dw = source.w * scale;
  const dh = source.h * scale;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = prop.alpha;
  ctx.globalCompositeOperation = "source-over";
  ctx.drawImage(source.source, prop.x + (prop.w - dw) / 2, prop.y + (prop.h - dh) / 2, dw, dh);
  ctx.restore();
}

function paintNightSky(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, "#060932");
  gradient.addColorStop(0.52, "#07134a");
  gradient.addColorStop(1, "#080b24");
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
}

// --- Menu backdrop -----------------------------------------------------------

const MENU_PROPS: readonly CoverProp[] = [
  // Mockup: the RAP neon sits at x 88..141 / y 174..246, the graffiti wall hugs
  // the right edge, and the cabinets stand at x 12..82 / 878..948, y 308..442.
  { key: cover.neonRap.key, x: 84, y: 164, w: 66, h: 88, alpha: 0.9 },
  { key: cover.graffitiFreestyle.key, x: 800, y: 176, w: 152, h: 250, alpha: 0.8 },
  { key: cover.speakerLeft.key, x: 6, y: 304, w: 96, h: 140, alpha: 1 },
  { key: cover.speakerRight.key, x: 858, y: 304, w: 96, h: 140, alpha: 1 },
];

export function buildMenuBackdrop(scene: Phaser.Scene, layer: Phaser.GameObjects.Container): void {
  const key = "tex-menu-cover";
  const painted = ensureCanvasTexture(scene, key, CANVAS_W, CANVAS_H, (ctx) => {
    paintNightSky(ctx, CANVAS_W, CANVAS_H);
    const layers: CoverLayer[] = [
      { key: cover.sky.key, alpha: 1, opaque: true },
      { key: cover.clouds.key, alpha: 0.55, keyLevel: 8 },
      { key: cover.cityBack.key, alpha: 0.95 },
      { key: cover.cityFront.key, alpha: 0.96 },
      { key: cover.rooftopFloor.key, alpha: 1 },
      { key: cover.rooftopFence.key, alpha: 1 },
    ];
    layers.forEach((entry) => paintCoverLayer(ctx, scene, CANVAS_W, CANVAS_H, entry));
    MENU_PROPS.forEach((prop) => paintProp(ctx, scene, prop));
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    // Legacy radial shade plus the menu's top/bottom shade, so the logo and the
    // button column keep their contrast.
    const radial = ctx.createRadialGradient(CANVAS_W * 0.5, CANVAS_H * 0.48, 120, CANVAS_W * 0.5, CANVAS_H * 0.54, 600);
    radial.addColorStop(0, "rgba(4,8,36,0.04)");
    radial.addColorStop(0.72, "rgba(4,7,25,0.24)");
    radial.addColorStop(1, "rgba(2,4,14,0.72)");
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    const vertical = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    vertical.addColorStop(0, "rgba(2,4,22,0.24)");
    vertical.addColorStop(0.36, "rgba(2,4,22,0.0)");
    vertical.addColorStop(1, "rgba(2,4,22,0.2)");
    ctx.fillStyle = vertical;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  });
  if (painted) addTextureImage(scene, layer, key, 0, 0);
  else buildFallbackBackdrop(scene, layer);
  addScreenPixelBorder(scene, layer);
}

// Legacy procedural night-city fallback (used while cover art is missing).
function buildFallbackBackdrop(scene: Phaser.Scene, layer: Phaser.GameObjects.Container): void {
  const key = "tex-start-fallback-sky";
  if (ensureCanvasTexture(scene, key, CANVAS_W, CANVAS_H, (ctx) => paintNightSky(ctx, CANVAS_W, CANVAS_H))) {
    addTextureImage(scene, layer, key, 0, 0);
  }
  for (let i = 0; i < 14; i += 1) {
    const x = 18 + i * 70;
    const h = 42 + ((i * 19) % 94);
    addRect(scene, layer, x, 248 - h, 42 + (i % 3) * 15, h, "#071132");
    for (let win = 0; win < 4; win += 1) {
      addRect(scene, layer, x + 8 + win * 12, 238 - h + ((i + win) % 5) * 16, 4, 6, win % 2 ? "#6aa7ff" : "#e1b84a");
    }
  }
  addRect(scene, layer, 0, 386, CANVAS_W, 154, "#101638");
  addText(scene, layer, 96, 248, "RAP", 24, palette.pink);
  addText(scene, layer, 748, 258, "vive el freestyle", 18, palette.blue);
}

// Legacy drawScreenPixelBorder.
function addScreenPixelBorder(scene: Phaser.Scene, layer: Phaser.GameObjects.Container): void {
  addRect(scene, layer, 14, 14, CANVAS_W - 28, 4, "#303979");
  addRect(scene, layer, 14, CANVAS_H - 18, CANVAS_W - 28, 4, "#202761");
  addRect(scene, layer, 14, 14, 4, CANVAS_H - 28, "#5660b5");
  addRect(scene, layer, CANVAS_W - 18, 14, 4, CANVAS_H - 28, "#1b2258");
  addRect(scene, layer, 18, 18, CANVAS_W - 36, 2, "#ffffff", 0.11);
}

// --- Crear MC portrait ------------------------------------------------------

// The mockup frames the MC in a tall window on the left half showing the same
// rooftop art. The city/floor/fence layers are pushed down so the skyline sits
// behind the MC's chest and the logo gets open sky above it, matching the
// mockup's fence line (base y ~355) and rooftop horizon (y ~300).
const PORTRAIT_ROOFTOP_SHIFT = 44;

export function addPortraitBackdrop(
  scene: Phaser.Scene,
  layer: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const key = `tex-portrait-${w}x${h}`;
  const painted = ensureCanvasTexture(scene, key, w, h, (ctx) => {
    paintNightSky(ctx, w, h);
    const layers: CoverLayer[] = [
      { key: cover.sky.key, alpha: 1, opaque: true },
      { key: cover.clouds.key, alpha: 0.5, keyLevel: 8 },
      { key: cover.cityBack.key, alpha: 0.95, offsetY: PORTRAIT_ROOFTOP_SHIFT },
      { key: cover.cityFront.key, alpha: 0.96, offsetY: PORTRAIT_ROOFTOP_SHIFT },
      { key: cover.rooftopFloor.key, alpha: 1, offsetY: PORTRAIT_ROOFTOP_SHIFT },
      { key: cover.rooftopFence.key, alpha: 1, offsetY: PORTRAIT_ROOFTOP_SHIFT },
    ];
    layers.forEach((entry) => paintCoverLayer(ctx, scene, w, h, entry));
    // Soft vignette so the logo (top) and the MC (bottom) stay readable.
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    const shade = ctx.createLinearGradient(0, 0, 0, h);
    shade.addColorStop(0, "rgba(2,4,20,0.4)");
    shade.addColorStop(0.36, "rgba(2,4,20,0.04)");
    shade.addColorStop(1, "rgba(2,4,20,0.3)");
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, w, h);
  });
  if (painted) addTextureImage(scene, layer, key, x, y);
}

// --- Logo lockup (legacy drawLogoLockup / drawLogoSprite) --------------------

export interface LogoOptions {
  // Top-left of the lockup and its display width; height follows the art.
  x: number;
  y: number;
  width: number;
  alpha?: number;
  // Multiplied over the art: the Crear MC mockup shows the logo as a blue
  // "sky graffiti" watermark rather than the full-colour menu lockup.
  tint?: number;
}

export function addLogoLockup(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, options: LogoOptions): void {
  const { x, y, width, alpha = 1, tint } = options;
  const source = textureSize(scene, cover.logo.key);
  if (source) {
    const height = Math.round(width * (source.h / source.w));
    const image = scene.add.image(Math.round(x), Math.round(y), cover.logo.key).setOrigin(0, 0);
    image.setDisplaySize(width, height);
    image.setAlpha(alpha);
    if (tint !== undefined) image.setTint(tint);
    layer.add(image);
    return;
  }
  // Procedural fallback keeps the proportions of the art (620x272).
  const s = width / 266;
  addRect(scene, layer, x + 12 * s, y + 34 * s, 236 * s, 24 * s, "#000000", 0.46);
  addText(scene, layer, x + 4 * s, y + 10 * s, "FREESTYLE", 38 * s, "#0a0c18");
  addText(scene, layer, x, y + 6 * s, "FREESTYLE", 38 * s, "#f7f6ef");
  addText(scene, layer, x + 78 * s, y + 55 * s, "GAME", 27 * s, "#0a0c18");
  addText(scene, layer, x + 74 * s, y + 51 * s, "GAME", 27 * s, palette.yellow);
  addRect(scene, layer, x + 8 * s, y + 92 * s, 208 * s, 4 * s, palette.red);
  addRect(scene, layer, x + 84 * s, y + 102 * s, 126 * s, 3 * s, palette.blue);
}

// --- Player figure ----------------------------------------------------------

export interface McFigureOptions {
  centerX: number;
  // Ground line the shoes rest on.
  feetY: number;
  height: number;
  shadowWidth?: number;
}

// Both mockups stand the MC on an elliptical shadow platform (Crear MC: 262px
// tall, feet at y 434; menu: 168px tall, feet at y 441). The compact pixel
// figure stays as the missing-texture fallback.
export function addMcFigure(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, options: McFigureOptions): void {
  const { centerX, feetY, height } = options;
  const shadowW = options.shadowWidth ?? Math.round(height * 0.59);
  const shadow = scene.add.graphics();
  shadow.fillStyle(hex("#03061a"), 0.62);
  shadow.fillEllipse(centerX, feetY - 3, shadowW, Math.max(7, Math.round(shadowW * 0.15)));
  layer.add(shadow);
  if (addSpriteImage(scene, layer, AssetRegistry.characters.mcIdle.key, centerX, feetY, height, 0.5, 1)) return;
  // Legacy block placeholder, expressed relative to the ground line.
  const s = height / 79;
  const px = (dx: number, dy: number, w: number, h: number, color: string): void => {
    addRect(scene, layer, Math.round(centerX + dx * s), Math.round(feetY + dy * s), Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s)), color);
  };
  px(-11, -79, 22, 6, palette.red);
  px(-9, -73, 18, 16, "#f0bd82");
  px(-13, -57, 26, 31, palette.teal);
  px(-11, -26, 9, 22, palette.blue);
  px(2, -26, 9, 22, palette.blue);
  px(-12, -4, 11, 4, palette.ink);
  px(1, -4, 11, 4, palette.ink);
}

// --- Rounded pixel chrome ---------------------------------------------------

export interface RoundedPanelOptions {
  fill: string;
  border: string;
  radius?: number;
  lineWidth?: number;
  // Second, dimmer stroke inset from the first (the project's double-border
  // panel language, docs/PANTALLAS.md).
  innerBorder?: string;
  fillAlpha?: number;
}

export function addRoundedPanel(
  scene: Phaser.Scene,
  layer: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  h: number,
  options: RoundedPanelOptions,
): void {
  const { fill, border, radius = 8, lineWidth = 2, innerBorder, fillAlpha = 1 } = options;
  const g = scene.add.graphics();
  g.fillStyle(hex(fill), fillAlpha);
  g.fillRoundedRect(x, y, w, h, radius);
  if (innerBorder) {
    const inset = lineWidth + 2;
    g.lineStyle(1, hex(innerBorder), 1);
    g.strokeRoundedRect(x + inset, y + inset, w - 2 * inset, h - 2 * inset, Math.max(2, radius - 3));
  }
  g.lineStyle(lineWidth, hex(border), 1);
  g.strokeRoundedRect(x, y, w, h, radius);
  layer.add(g);
}

// Solid pixel triangle built from stepped columns, so selector arrows and the
// menu cursor stay crisp instead of relying on "<" / ">" glyphs.
export function addPixelTriangle(
  scene: Phaser.Scene,
  layer: Phaser.GameObjects.Container,
  centerX: number,
  centerY: number,
  w: number,
  h: number,
  direction: "left" | "right",
  color: string,
): void {
  const steps = Math.max(3, Math.round(w / 3));
  const stepW = w / steps;
  const left = centerX - w / 2;
  for (let i = 0; i < steps; i += 1) {
    const colH = Math.max(2, Math.round(h * (1 - i / steps)));
    const colX = direction === "right" ? left + i * stepW : left + w - (i + 1) * stepW;
    addRect(scene, layer, Math.round(colX), Math.round(centerY - colH / 2), Math.ceil(stepW), colH, color);
  }
}

export interface PillButtonOptions {
  /** Rendered quiet and non-interactive: no command exists for it yet. */
  inert?: boolean;
  fill?: string;
  border?: string;
  textColor?: string;
  size?: number;
  // Arcade face (Press Start 2P) for large calls to action.
  display?: boolean;
  selected?: boolean;
  radius?: number;
}

// Rounded pixel button with a centred label and a drop shadow — the shape both
// mockups use for menu entries and for COMENZAR.
export function addPillButton(
  scene: Phaser.Scene,
  layer: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  onClick: () => void,
  options: PillButtonOptions = {},
): void {
  const {
    fill = "#090c2a",
    border = "#5f66c4",
    textColor = palette.ink,
    size = 20,
    display = false,
    selected = false,
    radius = 8,
    inert = false,
  } = options;
  const shadow = scene.add.graphics();
  shadow.fillStyle(hex("#000000"), 0.38);
  shadow.fillRoundedRect(x + 4, y + 5, w, h, radius);
  layer.add(shadow);
  addRoundedPanel(scene, layer, x, y, w, h, {
    fill: inert ? "#070a1e" : fill,
    border: selected ? palette.yellow : inert ? "#2d3360" : border,
    radius,
    lineWidth: selected ? 3 : 2,
  });
  const color = selected ? palette.yellow : inert ? "#5b6088" : textColor;
  const style = display ? displayStyle(size, color) : textStyle(size, color);
  const text = scene.add.text(x + w / 2, y + h / 2, label, style).setOrigin(0.5, 0.5);
  layer.add(text);
  // An inert entry gets no hit zone: it must not answer a click at all.
  if (!inert) addHitZone(scene, layer, x, y, w, h, onClick);
}

// Text anchored by origin instead of top-left; kit's addText compensates for
// TEXT_PAD only in the origin (0, 0) case, and these screens centre everything.
export function addAnchoredText(
  scene: Phaser.Scene,
  layer: Phaser.GameObjects.Container,
  x: number,
  y: number,
  content: string,
  size: number,
  color: string,
  originX = 0.5,
  display = false,
): Phaser.GameObjects.Text {
  const style = display ? displayStyle(size, color) : textStyle(size, color);
  const text = scene.add.text(x, y, content, style).setOrigin(originX, 0.5);
  layer.add(text);
  return text;
}
