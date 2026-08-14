// The barbershop only means anything because the MC is a stack of layers. These
// tests pin the rules a shop has to get right: it charges, it refuses when the
// wallet is short, and it never takes money for something you are already wearing.

import { describe, expect, it } from "vitest";
import { createNewState } from "../core/state";
import { barberOffers, buyLook } from "./BarberSystem";
import { BarberConfig } from "../data/config/BarberConfig";
import { eyeStyles, headStyles } from "../data/character";
import type { GameState } from "../core/types";

function career(cash = 500): GameState {
  const state = createNewState("Test", 1);
  state.mode = "career";
  state.cash = cash;
  return state;
}

const otherCut = (state: GameState): string =>
  (headStyles.find((style) => style.id !== state.hair) ?? headStyles[0]).id;

describe("what is on the wall", () => {
  it("offers every piece the data has, and marks the one being worn", () => {
    const state = career();
    const offers = barberOffers(state, "hair");
    expect(offers).toHaveLength(headStyles.length);
    expect(offers.filter((offer) => offer.current)).toHaveLength(1);
    expect(offers.find((offer) => offer.current)?.id).toBe(state.hair);
  });

  it("says what is out of reach instead of letting it be clicked", () => {
    const broke = career(0);
    expect(barberOffers(broke, "hair").every((offer) => !offer.affordable)).toBe(true);
  });
});

describe("buying a change", () => {
  it("charges the price and puts it on", () => {
    const state = career();
    const target = otherCut(state);
    const parts = buyLook(state, "hair", target);
    expect(parts?.join(" ")).toContain(String(BarberConfig.cutPrice));
    expect(state.hair).toBe(target);
    expect(state.cash).toBe(500 - BarberConfig.cutPrice);
  });

  it("never charges for what you already have", () => {
    const state = career();
    const parts = buyLook(state, "hair", state.hair);
    expect(state.cash).toBe(500);
    expect(parts?.join(" ")).toContain("Ya andas asi");
  });

  it("refuses outright when the money is short, instead of half-applying", () => {
    const state = career(BarberConfig.cutPrice - 1);
    const before = state.hair;
    expect(buyLook(state, "hair", otherCut(state))).toBeNull();
    expect(state.hair).toBe(before);
    expect(state.cash).toBe(BarberConfig.cutPrice - 1);
  });

  it("ignores a piece that does not exist", () => {
    const state = career();
    expect(buyLook(state, "hair", "no-existe")).toBeNull();
    expect(state.cash).toBe(500);
  });

  it("sells the shades and the dye from their own price lists", () => {
    const state = career();
    const otherEyes = (eyeStyles.find((style) => style.id !== state.eyes) ?? eyeStyles[0]).id;
    buyLook(state, "eyes", otherEyes);
    expect(state.eyes).toBe(otherEyes);
    expect(state.cash).toBe(500 - BarberConfig.eyesPrice);

    const cash = state.cash;
    buyLook(state, "color", "3");
    expect(state.hairColor).toBe(3);
    expect(state.cash).toBe(cash - BarberConfig.colorPrice);
  });

  it("prices dye above a cut above a change of shades", () => {
    // The vain one costs the most, and swapping the shades is the cheap visit.
    expect(BarberConfig.colorPrice).toBeGreaterThan(BarberConfig.cutPrice);
    expect(BarberConfig.cutPrice).toBeGreaterThan(BarberConfig.eyesPrice);
  });

  it("warns that a dye under a cap is money for nothing, before and after the sale", () => {
    // A shop that takes your money and shows you nothing is the one way this could
    // feel like a scam, and the cap is on by default.
    const capped = career();
    expect(capped.hair).toBe("gorra");
    expect(barberOffers(capped, "color").every((offer) => offer.hidden)).toBe(true);
    expect(buyLook(capped, "color", "3")?.join(" ")).toContain("no se te ve el pelo");

    const bare = career();
    bare.hair = "suelto";
    expect(barberOffers(bare, "color").some((offer) => offer.hidden)).toBe(false);
    expect(buyLook(bare, "color", "3")?.join(" ")).not.toContain("no se te ve");
  });
});
