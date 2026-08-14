// The barbershop (Fase 10): the place where the modular look changes after
// character creation.
//
// The owner asked for a barbería, and it only makes sense because the MC is a
// stack of layers now — before, the sprite was fixed and there was nothing for a
// barber to sell.
//
// What it sells is exactly what the game has drawn art for: what goes on his head
// (the sprite's own cap, or the hair transplanted from the rival), what goes on his
// eyes (his shades, or the rival's open eyes) and the dye on the hair. Six invented
// haircuts and four beards were on this wall in the first pass and none of them had
// art; that fake variety is what the owner rejected. More cuts and any beard at all
// are listed as pending in docs/ASSETS.md.
//
// Pure functions over GameState. No RNG: a haircut is not a gamble.

import type { GameState } from "../core/types";
import { BarberConfig } from "../data/config/BarberConfig";
import { eyeStyles, hairColors, headStyles } from "../data/character";

export type BarberSlot = "hair" | "eyes" | "color";

export interface BarberOffer {
  slot: BarberSlot;
  id: string;
  label: string;
  price: number;
  // Already wearing it: the shop says so instead of charging for nothing.
  current: boolean;
  affordable: boolean;
  // Bought and paid for but invisible — a dye under a cap. Said out loud rather
  // than taking the money and showing nothing.
  hidden: boolean;
}

function priceFor(slot: BarberSlot): number {
  if (slot === "hair") return BarberConfig.cutPrice;
  if (slot === "eyes") return BarberConfig.eyesPrice;
  return BarberConfig.colorPrice;
}

// Everything on the wall, with what it costs you today.
export function barberOffers(state: GameState, slot: BarberSlot): BarberOffer[] {
  const price = priceFor(slot);
  const affordable = state.cash >= price;
  const cappedNow = (headStyles.find((style) => style.id === state.hair) ?? headStyles[0]).capped;

  if (slot === "hair") {
    return headStyles.map((style) => ({
      slot,
      id: style.id,
      label: style.label,
      price,
      current: state.hair === style.id,
      affordable,
      hidden: false,
    }));
  }
  if (slot === "eyes") {
    return eyeStyles.map((style) => ({
      slot,
      id: style.id,
      label: style.label,
      price,
      current: state.eyes === style.id,
      affordable,
      hidden: false,
    }));
  }
  return hairColors.map((entry) => ({
    slot,
    id: String(entry.id),
    label: entry.label,
    price,
    current: state.hairColor === entry.id,
    affordable,
    hidden: cappedNow,
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
  else if (slot === "eyes") state.eyes = id;
  else state.hairColor = Number(id);

  const what = slot === "hair" ? "corte" : slot === "eyes" ? "mirada" : "color";
  const lines = [`Nuevo ${what}: ${offer.label}. -$${offer.price}.`];
  // Paying for a dye you cannot see is the one way this shop could feel like a
  // scam, so it warns instead of staying quiet.
  if (offer.hidden) lines.push("Con la gorra puesta no se te ve el pelo.");
  return lines;
}
