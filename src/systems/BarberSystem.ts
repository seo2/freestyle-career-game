// The barbershop (Fase 10): the place where the modular look changes after
// character creation.
//
// The owner asked for a barbería, and it only makes sense because the MC is a stack
// of layers now — before, `hair` did not exist and the sprite was fixed, so there
// was nothing for a barber to sell.
//
// Pure functions over GameState. No RNG: a haircut is not a gamble.

import type { GameState } from "../core/types";
import { BarberConfig } from "../data/config/BarberConfig";
import { beardStyles, hairColors, hairStyles } from "../data/character";

export type BarberSlot = "hair" | "beard" | "color";

export interface BarberOffer {
  slot: BarberSlot;
  id: string;
  label: string;
  price: number;
  // Already wearing it: the shop says so instead of charging for nothing.
  current: boolean;
  affordable: boolean;
}

function priceFor(slot: BarberSlot): number {
  if (slot === "hair") return BarberConfig.cutPrice;
  if (slot === "beard") return BarberConfig.beardPrice;
  return BarberConfig.colorPrice;
}

// Everything on the wall, with what it costs you today.
export function barberOffers(state: GameState, slot: BarberSlot): BarberOffer[] {
  const price = priceFor(slot);
  if (slot === "hair") {
    return hairStyles.map((piece) => ({
      slot,
      id: piece.id,
      label: piece.label,
      price,
      current: state.hair === piece.id,
      affordable: state.cash >= price,
    }));
  }
  if (slot === "beard") {
    return beardStyles.map((piece) => ({
      slot,
      id: piece.id,
      label: piece.label,
      price,
      current: state.beard === piece.id,
      affordable: state.cash >= price,
    }));
  }
  return hairColors.map((entry) => ({
    slot,
    id: String(entry.id),
    label: entry.label,
    price,
    current: state.hairColor === entry.id,
    affordable: state.cash >= price,
  }));
}

// Buys a change. Returns the lines to show, or null when nothing happened — an
// unaffordable cut is refused rather than half-applied.
export function buyLook(state: GameState, slot: BarberSlot, id: string): string[] | null {
  const offer = barberOffers(state, slot).find((entry) => entry.id === id);
  if (!offer) return null;
  // Already wearing it: free, and the shop says so.
  if (offer.current) return ["Ya andas asi."];
  if (!offer.affordable) return null;

  state.cash -= offer.price;
  if (slot === "hair") state.hair = id;
  else if (slot === "beard") state.beard = id;
  else state.hairColor = Number(id);

  const what = slot === "hair" ? "corte" : slot === "beard" ? "barba" : "color";
  return [`Nuevo ${what}: ${offer.label}. -$${offer.price}.`];
}
