// The MC is a stack of layers so that what the player picks and what the player
// BUYS both show up on him. These tests pin that stack, because the alternative is
// a screenshot — and a screenshot cannot say why a layer is missing.

import { describe, expect, it } from "vitest";
import { createNewState } from "../core/state";
import { describeLook, layerIdsFor, lookOf } from "./characterDraw";
import { outfits } from "../data/character";
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
} from "../data/characterArt";
import type { GameState } from "../core/types";

function mc(items: string[] = []): GameState {
  const state = createNewState("Test", 1);
  state.mode = "career";
  state.items = items;
  return state;
}

describe("the layer stack", () => {
  it("always has a body, a face and something on his feet", () => {
    const ids = layerIdsFor(lookOf(mc()));
    expect(ids).toContain("body");
    expect(ids).toContain("face");
    // Bare feet never happen: the default shoes stand in until a pair is bought.
    expect(ids.some((id) => id === "zapatos" || id === "zapatillas")).toBe(true);
  });

  it("dresses him in the outfit his `look` names", () => {
    for (const outfit of outfits) {
      const state = mc();
      state.look = outfit.id;
      const ids = layerIdsFor(lookOf(state));
      expect(ids).toContain(outfit.top);
      expect(ids).toContain(outfit.bottom);
    }
  });

  it("puts clothes OVER the body, not under it", () => {
    const ids = layerIdsFor(lookOf(mc()));
    expect(ids.indexOf("body")).toBeLessThan(ids.indexOf("polera"));
  });

  it("draws the face LAST of the head, so no fringe and no cap brim buries the eyes", () => {
    // This test used to assert the opposite, and it was wrong: with the face pushed
    // before the hair, the hair drew on top of it — the exact thing the comment
    // claimed to prevent. Painting order is the whole contract of a paper doll.
    const fringe = mc();
    fringe.hair = "tapado";
    const ids = layerIdsFor(lookOf(fringe));
    expect(ids.indexOf("face")).toBeGreaterThan(ids.indexOf("tapado"));

    const capped = layerIdsFor(lookOf(mc(["gorra"])));
    expect(capped.indexOf("face")).toBeGreaterThan(capped.indexOf("gorra"));
  });
});

describe("what he owns is what he wears", () => {
  it("puts on a cap once it is bought, and only then", () => {
    expect(layerIdsFor(lookOf(mc()))).not.toContain("gorra");
    expect(layerIdsFor(lookOf(mc(["gorra"])))).toContain("gorra");
  });

  it("hides the hair under the cap instead of drawing both", () => {
    const bare = layerIdsFor(lookOf(mc()));
    const capped = layerIdsFor(lookOf(mc(["gorra"])));
    expect(bare).toContain("corto");
    expect(capped).not.toContain("corto");
    expect(describeLook(lookOf(mc(["gorra"])))).toContain("con gorra");
  });

  it("replaces the default shoes with the bought pair rather than stacking them", () => {
    const ids = layerIdsFor(lookOf(mc(["zapatillas"])));
    expect(ids).toContain("zapatillas");
    expect(ids).not.toContain("zapatos");
  });

  it("wears a jacket over the top, and a mic and headphones over everything", () => {
    const ids = layerIdsFor(lookOf(mc(["chaqueta", "audifonos", "microfono"])));
    expect(ids.indexOf("polera")).toBeLessThan(ids.indexOf("chaqueta"));
    expect(ids).toContain("audifonos");
    expect(ids).toContain("microfono");
  });

  it("ignores items that are not something you can wear", () => {
    // Buying a notebook or a beat must not change how he looks.
    const plain = layerIdsFor(lookOf(mc()));
    expect(layerIdsFor(lookOf(mc(["cuaderno", "beat-trap", "mesa"])))).toEqual(plain);
  });
});

// The art is hand-authored pixel art in text, so it has exactly two failure modes
// and both are invisible until something looks wrong on screen: a row one character
// short, and a look-alike character typed by accident (a Cyrillic "о" for an "o").
// Authoring the first version produced 113 of the former and 4 of the latter.
describe("the art itself", () => {
  const pieces = [
    bodyArt,
      faceArt,
    ...hairArt,
    ...beardArt,
    ...topArt,
    ...bottomArt,
    ...Object.values(shoeArt),
    ...Object.values(wearableArt),
  ];

  it("gives every row exactly the grid's width", () => {
    for (const piece of pieces) {
      for (const [index, row] of piece.rows.entries()) {
        expect(row.length, `${piece.id} fila ${index}`).toBe(ART_GRID.w);
      }
    }
  });

  it("uses only characters the legend defines", () => {
    const legal = new Set([".", ...Object.keys(TONE_CHARS)]);
    for (const piece of pieces) {
      for (const [index, row] of piece.rows.entries()) {
        const offenders = [...new Set(row.split(""))].filter((ch) => !legal.has(ch));
        expect(offenders, `${piece.id} fila ${index}`).toEqual([]);
      }
    }
  });

  it("keeps every piece inside the grid", () => {
    for (const piece of pieces) {
      expect(piece.y + piece.rows.length, piece.id).toBeLessThanOrEqual(ART_GRID.h);
      expect(piece.x, piece.id).toBeGreaterThanOrEqual(0);
    }
  });

  it("outlines every piece that defines a silhouette", () => {
    // Not every piece: a goatee or a moustache sits INSIDE an already-outlined
    // head, and giving it its own outline makes it read as a sticker. The rule is
    // about the shapes that own an edge against the background.
    const silhouettes = [
      bodyArt,
          ...hairArt,
      ...topArt,
      ...bottomArt,
      ...Object.values(shoeArt),
      ...Object.values(wearableArt),
    ];
    for (const piece of silhouettes) {
      if (piece.rows.length === 0) continue;
      expect(piece.rows.join("").includes("o"), String(piece.id)).toBe(true);
    }
  });
});
