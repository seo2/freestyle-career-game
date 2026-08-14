// Composites the MC from his layers (Fase 10).
//
// One entry point, used by every screen that shows him, so the character the
// player built in Crear MC is the same one who stands in the room, on the map and
// in the stats panel. Before this each screen drew the same flat sprite and the
// five skin tones and four looks the game stored changed nothing at all.
//
// Presentation only: it reads the state and draws. The z-order is the whole trick —
// clothes over body, hair over head, bought accessories over clothes.

import type Phaser from "phaser";
import { addRect } from "./kit";
import { hairColors, outfits, skinTones, type ToneKey } from "../data/character";
import {
  ART_GRID,
  TONE_CHARS,
  beardArt,
  bodyArt,
  bottomArt,
  faceArt,
  hairArt,
  shoeArt,
  topArt,
  wearableArt,
  type ArtPiece,
} from "../data/characterArt";
import type { GameState } from "../core/types";

export interface CharacterLook {
  skin: number;
  look: number;
  hair: string;
  hairColor: number;
  beard: string;
  // Item ids owned. An accessory shows up because it was bought, which is the
  // point of the whole layered model.
  items: readonly string[];
}

// Reads a look out of the live state, so callers never assemble it by hand.
export function lookOf(state: GameState): CharacterLook {
  return {
    skin: state.skin,
    look: state.look,
    hair: state.hair,
    hairColor: state.hairColor,
    beard: state.beard,
    items: state.items,
  };
}

function palette(look: CharacterLook): Record<ToneKey, string> {
  const skin = skinTones.find((tone) => tone.id === look.skin) ?? skinTones[0];
  const outfit = outfits.find((entry) => entry.id === look.look) ?? outfits[0];
  const hair = hairColors.find((entry) => entry.id === look.hairColor) ?? hairColors[0];
  return {
    skin: skin.skin,
    skinShade: skin.skinShade,
    skinLight: skin.skinLight,
    hair: hair.hair,
    hairShade: hair.hairShade,
    top: outfit.colors.top,
    topShade: outfit.colors.topShade,
    topLight: outfit.colors.topLight,
    bottom: outfit.colors.bottom,
    bottomShade: outfit.colors.bottomShade,
    shoe: outfit.colors.shoe,
    shoeShade: outfit.colors.shoeShade,
    metal: "#c2c7d6",
    // The lenses read as glass: a pale fill with the frame drawn in outline.
    lens: "#eef1fa",
    // Not pure black. A near-black with a hint of the night palette keeps the
    // figure from looking cut out of the screen.
    line: "#0d0e17",
  };
}

// The stack, bottom to top. Anything the player bought lands above the clothes.
function layers(look: CharacterLook): ArtPiece[] {
  const outfit = outfits.find((entry) => entry.id === look.look) ?? outfits[0];
  const stack: ArtPiece[] = [bodyArt];

  const bottom = bottomArt.find((piece) => piece.id === outfit.bottom);
  if (bottom) stack.push(bottom);
  const top = topArt.find((piece) => piece.id === outfit.top);
  if (top) stack.push(top);

  // Shoes: the bought pair replaces the default rather than stacking on it.
  stack.push(look.items.includes("zapatillas") ? shoeArt.zapatillas : shoeArt.zapatos);
  // A jacket goes over the top, and only if he owns one.
  if (look.items.includes("chaqueta")) stack.push(wearableArt.chaqueta);

  const beard = beardArt.find((piece) => piece.id === look.beard);
  if (beard && beard.rows.length > 0) stack.push(beard);
  // A cap hides the hair, so the hair is skipped when he is wearing one.
  if (look.items.includes("gorra")) {
    stack.push(wearableArt.gorra);
  } else {
    const hair = hairArt.find((piece) => piece.id === look.hair);
    if (hair) stack.push(hair);
  }
  // The face goes on LAST of the head layers: no fringe and no cap brim may bury
  // the eyes, which is the one thing that makes him a person and not a shape.
  stack.push(faceArt);
  if (look.items.includes("audifonos")) stack.push(wearableArt.audifonos);
  if (look.items.includes("microfono")) stack.push(wearableArt.microfono);
  return stack;
}

// The ids of the layers a look resolves to, bottom to top. Exported so the
// modularity can be TESTED — "buying a cap puts a cap on him" is the whole point
// of the model, and it should not be something only a screenshot can confirm.
export function layerIdsFor(look: CharacterLook): string[] {
  return layers(look).map((piece) => piece.id);
}

// Draws him with his feet at (x, feetY), `height` px tall.
//
// Each art row becomes horizontal RUNS of the same tone rather than one rect per
// pixel: a 32x72 figure is 2304 cells, and one Phaser rectangle per cell would be
// thousands of game objects per redraw for no visual difference.
export function drawCharacter(
  scene: Phaser.Scene,
  layer: Phaser.GameObjects.Container,
  x: number,
  feetY: number,
  height: number,
  look: CharacterLook,
): void {
  const unit = height / ART_GRID.h;
  const left = x - (ART_GRID.w * unit) / 2;
  const top = feetY - height;
  const tones = palette(look);

  // Ground shadow first, so he stands on something.
  addRect(
    scene,
    layer,
    Math.round(x - 9 * unit),
    Math.round(feetY - 1.5 * unit),
    Math.round(18 * unit),
    Math.max(1, Math.round(2 * unit)),
    "#05070f",
    0.45,
  );

  for (const piece of layers(look)) {
    piece.rows.forEach((row, rowIndex) => {
      const gy = piece.y + rowIndex;
      let runStart = -1;
      let runTone: ToneKey | null = null;
      // One past the end so a run that reaches the last column still flushes.
      for (let col = 0; col <= row.length; col += 1) {
        const tone: ToneKey | null = col < row.length ? (TONE_CHARS[row[col]] ?? null) : null;
        if (tone === runTone) continue;
        if (runTone !== null && runStart >= 0) {
          const rx = Math.round(left + (piece.x + runStart) * unit);
          const rw = Math.max(1, Math.round((col - runStart) * unit));
          const ry = Math.round(top + gy * unit);
          const rh = Math.max(1, Math.round(unit));
          addRect(scene, layer, rx, ry, rw, rh, tones[runTone]);
        }
        runTone = tone;
        runStart = col;
      }
    });
  }
}

// What the player is wearing, in words, for the Crear MC and barbershop readouts.
export function describeLook(look: CharacterLook): string {
  const outfit = outfits.find((entry) => entry.id === look.look) ?? outfits[0];
  const hair = look.items.includes("gorra")
    ? "con gorra"
    : (hairArt.find((piece) => piece.id === look.hair)?.label.toLowerCase() ?? "");
  const beard = beardArt.find((piece) => piece.id === look.beard);
  const beardText = beard && beard.rows.length > 0 ? `, ${beard.label.toLowerCase()}` : "";
  return `${outfit.label}, ${hair}${beardText}`;
}
