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
import {
  GRID,
  beardStyles,
  bodyPiece,
  bottoms,
  defaultShoes,
  facePiece,
  hairColors,
  hairStyles,
  outfits,
  skinTones,
  tops,
  wearables,
  type Piece,
  type Rect,
  type ToneKey,
} from "../data/character";
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
    hair: hair.hair,
    hairShade: hair.hairShade,
    top: outfit.colors.top,
    topShade: outfit.colors.topShade,
    bottom: outfit.colors.bottom,
    bottomShade: outfit.colors.bottomShade,
    shoe: outfit.colors.shoe,
    metal: "#b8bccd",
    lens: "#0f1220",
    line: "#12131c",
  };
}

// The stack, bottom to top. Anything the player bought lands above the clothes.
function layers(look: CharacterLook): Piece[] {
  const outfit = outfits.find((entry) => entry.id === look.look) ?? outfits[0];
  const stack: Piece[] = [bodyPiece];

  const bottom = bottoms.find((piece) => piece.id === outfit.bottom);
  if (bottom) stack.push(bottom);
  const top = tops.find((piece) => piece.id === outfit.top);
  if (top) stack.push(top);

  // Shoes: the bought pair replaces the default, rather than stacking on it.
  stack.push(look.items.includes("zapatillas") ? wearables.zapatillas : defaultShoes);
  // A jacket goes over the top, and only if he owns one.
  if (look.items.includes("chaqueta")) stack.push(wearables.chaqueta);

  const beard = beardStyles.find((piece) => piece.id === look.beard);
  if (beard) stack.push(beard);
  stack.push(facePiece);
  // A cap hides the hair, so the hair is skipped when he is wearing one.
  const wearingCap = look.items.includes("gorra");
  if (!wearingCap) {
    const hair = hairStyles.find((piece) => piece.id === look.hair);
    if (hair) stack.push(hair);
  } else {
    stack.push(wearables.gorra);
  }
  if (look.items.includes("audifonos")) stack.push(wearables.audifonos);
  if (look.items.includes("microfono")) stack.push(wearables.microfono);
  return stack;
}

// The ids of the layers a look resolves to, bottom to top. Exported so the
// modularity can be TESTED — "buying a cap puts a cap on him" is the whole point
// of the model, and it should not be something only a screenshot can confirm.
export function layerIdsFor(look: CharacterLook): string[] {
  return layers(look).map((piece) => piece.id);
}

// Draws him with his feet at (x, feetY), `height` px tall. The grid is 24x56, so
// one grid unit is height/56 and the figure is 24 units wide.
export function drawCharacter(
  scene: Phaser.Scene,
  layer: Phaser.GameObjects.Container,
  x: number,
  feetY: number,
  height: number,
  look: CharacterLook,
): void {
  const unit = height / GRID.h;
  const left = x - (GRID.w * unit) / 2;
  const top = feetY - height;
  const tones = palette(look);

  // Ground shadow first, so he stands on something.
  addRect(scene, layer, Math.round(x - 9 * unit), Math.round(feetY - unit), Math.round(18 * unit), Math.round(2 * unit), "#05070f", 0.5);

  const put = (rect: Rect): void => {
    // Rounded to whole device pixels: a fractional rect on a pixel-art figure
    // shows up as a seam between layers.
    const rx = Math.round(left + rect.x * unit);
    const ry = Math.round(top + rect.y * unit);
    const rw = Math.max(1, Math.round(rect.w * unit));
    const rh = Math.max(1, Math.round(rect.h * unit));
    addRect(scene, layer, rx, ry, rw, rh, tones[rect.tone]);
  };

  for (const piece of layers(look)) for (const rect of piece.rects) put(rect);
}

// What the player is wearing, in words, for the Crear MC and barbershop readouts.
export function describeLook(look: CharacterLook): string {
  const outfit = outfits.find((entry) => entry.id === look.look) ?? outfits[0];
  const hair = look.items.includes("gorra")
    ? "con gorra"
    : (hairStyles.find((piece) => piece.id === look.hair)?.label.toLowerCase() ?? "");
  const beard = beardStyles.find((piece) => piece.id === look.beard);
  const beardText = beard && beard.rects.length > 0 ? `, ${beard.label.toLowerCase()}` : "";
  return `${outfit.label}, ${hair}${beardText}`;
}
