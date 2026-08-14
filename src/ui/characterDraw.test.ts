// The MC is a stack of layers so that what the player picks and what the player
// BUYS both show up on him. These tests pin that stack, because the alternative is
// a screenshot — and a screenshot cannot say why a layer is missing.

import { describe, expect, it } from "vitest";
import { createNewState } from "../core/state";
import { describeLook, layerIdsFor, lookOf } from "./characterDraw";
import { outfits } from "../data/character";
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

  it("keeps the face above the hair, so a fringe cannot bury the eyes", () => {
    const state = mc();
    state.hair = "tapado";
    const ids = layerIdsFor(lookOf(state));
    expect(ids.indexOf("face")).toBeLessThan(ids.indexOf("tapado"));
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
