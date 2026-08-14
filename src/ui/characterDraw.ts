// Composites the MC out of slices of his own sprite (Fase 10).
//
// One entry point, used by every screen that shows him, so the character the
// player built in Crear MC is the same one who stands in the room, on the map and
// in the stats panel.
//
// How it works, and why this shape:
//
//   The art is public/assets/characters/layers/*.png — the ORIGINAL sprite cut
//   into materials by scripts/build-character-layers.mjs. A layer is recoloured by
//   remapping its own luminance onto a four-value ramp between the stops measured
//   for it (src/data/characterLayers.ts), which moves the hue and keeps the
//   artist's shading. That is the whole trick: the style is not imitated, it is
//   the same pixels.
//
//   The result is baked into a CANVAS TEXTURE keyed by the look, not drawn as
//   rectangles. The earlier procedural MC emitted one rect per pixel run and a
//   101x240 figure is 24240 cells; at that size the run-length trick still cost
//   thousands of game objects per redraw. A texture is one game object, and it is
//   cached, so a look is only composited the first time it appears.
//
// Presentation only: it reads the state and draws.

import type Phaser from "phaser";
import { addRect } from "./kit";
import {
  OUTLINE,
  brimRamp,
  eyeRamp,
  eyeStyles,
  glassRamp,
  hairColors,
  hairRamp,
  headStyles,
  outfitOf,
  skinRamp,
  type Ramp,
} from "../data/character";
import { LAYER_SIZE, layerById, layerOrder, type LayerId } from "../data/characterLayers";
import { AssetRegistry, characterLayerKey } from "../game/AssetRegistry";
import type { GameState } from "../core/types";

export interface CharacterLook {
  skin: number;
  look: number;
  // What is on his head and on his eyes: "gorra"/"suelto" and
  // "lentes"/"descubierto". Both are drawn art, not toggles over a blank face.
  hair: string;
  hairColor: number;
  eyes: string;
  // Item ids owned, for accessories that have art.
  items: readonly string[];
}

// Reads a look out of the live state, so callers never assemble it by hand.
export function lookOf(state: GameState): CharacterLook {
  return {
    skin: state.skin,
    look: state.look,
    hair: state.hair,
    hairColor: state.hairColor,
    eyes: state.eyes,
    items: state.items,
  };
}

const capped = (look: CharacterLook): boolean =>
  (headStyles.find((style) => style.id === look.hair) ?? headStyles[0]).capped;

const wearsShades = (look: CharacterLook): boolean =>
  (eyeStyles.find((style) => style.id === look.eyes) ?? eyeStyles[0]).shades;

// Which layers a look resolves to, bottom to top. Exported so the modularity can
// be TESTED — "taking the cap off shows hair" and "taking the shades off still
// leaves eyes" are the whole point of the model, and neither should be something
// only a screenshot can confirm.
export function layerIdsFor(look: CharacterLook): LayerId[] {
  const hat = capped(look);
  const shades = wearsShades(look);
  return layerOrder.filter((id) => {
    if (id === "hair") return !hat;
    if (id === "cap" || id === "brim") return hat;
    if (id === "lens" || id === "frame") return shades;
    if (id === "eyesOpen") return !shades;
    return true;
  });
}

// The four colours a layer is repainted with, by its role. The outline is prepended
// because it is shared: it belongs to the drawing, not to the shirt.
function rampFor(look: CharacterLook, id: LayerId): string[] {
  const outfit = outfitOf(look.look);
  const role = layerById(id).role;
  const ramp: Ramp =
    role === "skin"
      ? skinRamp(look.skin)
      : role === "hair"
        ? hairRamp(look.hairColor)
        : role === "top"
          ? outfit.top
          : role === "print"
            ? outfit.print
            : role === "bottom"
              ? outfit.bottom
              : role === "shoes"
                ? outfit.shoes
                : role === "cap"
                  ? outfit.cap
                  : role === "brim"
                    ? brimRamp
                    : role === "eye"
                      ? eyeRamp
                      : glassRamp;
  return [OUTLINE, ...ramp];
}

const channels = (hex: string): [number, number, number] => {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

// Rec. 709 luminance, the same weights the build script measured the stops with.
// They have to agree or every pixel lands in the wrong ramp segment.
const luminance = (r: number, g: number, b: number): number => 0.2126 * r + 0.7152 * g + 0.0722 * b;

// Repaints one layer's pixels in place: find the stop segment this pixel's
// luminance falls in, then lerp between that pair of ramp colours. Alpha is left
// alone, which is what keeps the sprite's anti-aliased edges intact — the source
// is a resampled render with 7451 colours, and quantizing it to four flat values
// put a hard fringe around everything.
function repaint(data: Uint8ClampedArray, stops: readonly number[], ramp: readonly string[]): void {
  const rgb = ramp.map(channels);
  const last = stops.length - 2;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const value = luminance(data[i], data[i + 1], data[i + 2]);
    let seg = 0;
    while (seg < last && value > stops[seg + 1]) seg += 1;
    const span = stops[seg + 1] - stops[seg];
    const t = span <= 0 ? 0 : Math.min(1, Math.max(0, (value - stops[seg]) / span));
    const lo = rgb[seg];
    const hi = rgb[seg + 1];
    data[i] = lo[0] + (hi[0] - lo[0]) * t;
    data[i + 1] = lo[1] + (hi[1] - lo[1]) * t;
    data[i + 2] = lo[2] + (hi[2] - lo[2]) * t;
  }
}

// A look's identity, so the same look reuses its texture instead of recompositing
// on every redraw. Every field that changes a pixel is in here and nothing else.
function signature(look: CharacterLook): string {
  const worn = ["zapatillas", "chaqueta", "audifonos"].filter((id) => look.items.includes(id));
  return [look.skin, look.look, look.hair, look.hairColor, look.eyes, worn.join("+")].join("-");
}

// Builds (or reuses) the composited texture. Returns the flat sprite's key if the
// canvas is unavailable, so a failure here shows the original MC rather than
// nothing at all.
function textureFor(scene: Phaser.Scene, look: CharacterLook): string {
  const key = `mc-look-${signature(look)}`;
  if (scene.textures.exists(key)) return key;

  const { w, h } = LAYER_SIZE;
  const scratch = document.createElement("canvas");
  scratch.width = w;
  scratch.height = h;
  const from = scratch.getContext("2d", { willReadFrequently: true });
  const canvas = scene.textures.createCanvas(key, w, h);
  const to = canvas?.getContext();
  if (!from || !canvas || !to) return AssetRegistry.characters.mcIdle.key;

  for (const id of layerIdsFor(look)) {
    const source = scene.textures.get(characterLayerKey(id)).getSourceImage();
    from.clearRect(0, 0, w, h);
    from.drawImage(source as CanvasImageSource, 0, 0);
    const image = from.getImageData(0, 0, w, h);
    const layer = layerById(id);
    repaint(image.data, layer.stops, rampFor(look, id));
    from.putImageData(image, 0, 0);
    to.drawImage(scratch, 0, 0);
  }
  canvas.refresh();
  return key;
}

// Draws him with his feet at (x, feetY), `height` px tall.
export function drawCharacter(
  scene: Phaser.Scene,
  layer: Phaser.GameObjects.Container,
  x: number,
  feetY: number,
  height: number,
  look: CharacterLook,
): void {
  const unit = height / LAYER_SIZE.h;

  // Ground shadow first, so he stands on something.
  addRect(
    scene,
    layer,
    Math.round(x - 26 * unit),
    Math.round(feetY - 4 * unit),
    Math.round(52 * unit),
    Math.max(1, Math.round(5 * unit)),
    "#05070f",
    0.45,
  );

  const image = scene.add.image(Math.round(x), Math.round(feetY), textureFor(scene, look));
  image.setOrigin(0.5, 1);
  image.setDisplaySize(Math.round(LAYER_SIZE.w * unit), Math.round(height));
  layer.add(image);
}

// What the player is wearing, in words, for the Crear MC and barbershop readouts.
export function describeLook(look: CharacterLook): string {
  const outfit = outfitOf(look.look);
  const head = headStyles.find((style) => style.id === look.hair) ?? headStyles[0];
  const eyes = eyeStyles.find((style) => style.id === look.eyes) ?? eyeStyles[0];
  // The dye only shows when the cap is off, and saying so beats letting the player
  // pay for a colour nobody can see.
  const color = hairColors.find((entry) => entry.id === look.hairColor) ?? hairColors[0];
  const hairText = head.capped ? head.label.toLowerCase() : `pelo ${color.label.toLowerCase()}`;
  return `${outfit.label}, ${hairText}, ${eyes.label.toLowerCase()}`;
}
