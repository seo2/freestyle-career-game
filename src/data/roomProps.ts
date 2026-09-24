// What the pieza earns over a career (Fase 12 C). The owner's rule: the room
// changes with what the player BUYS and ACHIEVES. Every prop names its unlock;
// RoomSystem decides which are earned and the scene only draws them.
//
// Positions are pixels on the 960x540 pieza (bottom-centre anchor unless
// `anchor: "center"`), measured against public/assets/scenes/pieza-home-studio-v1.png.
// The HUD covers y < 86 and the goal chip x 22..284 x 96..140, so nothing sits
// there. Framed achievements hang OVER the room's existing posters on purpose:
// the poster being replaced by a gold disc is the story.
//
// `art` is resolved to a texture by AssetRegistry.roomPropKey: achievement art
// is cut from the advanced-room mockup (scripts/build-room-props.mjs); bought
// items reuse their store icon at object scale until dedicated room art exists
// (docs/ASSETS.md).

import type { StatKey } from "../core/types";

export type RoomUnlock =
  | { kind: "item"; id: string }
  | { kind: "release"; id: string }
  | { kind: "fans"; min: number }
  | { kind: "wins"; min: number }
  | { kind: "rank"; stat: StatKey; min: number };

export interface RoomPropDef {
  id: string;
  // Shown on the "TU PIEZA CAMBIO" ribbon the moment it appears.
  label: string;
  art: string;
  x: number;
  y: number;
  // Display height in pixels; width follows the art's aspect.
  h: number;
  anchor?: "bottom" | "center";
  // Light-emitting art (the neon) is drawn additively so its dark backing drops out.
  glow?: boolean;
  unlock: RoomUnlock;
}

export const roomProps: RoomPropDef[] = [
  // --- Achievements (art cut from the advanced-room mockup) ------------------
  { id: "rap-to-win", label: "Afiche RAP TO WIN", art: "rap-to-win", x: 851, y: 140, h: 74, anchor: "center", unlock: { kind: "wins", min: 1 } },
  { id: "trofeos", label: "Trofeos", art: "trofeos", x: 604, y: 195, h: 28, unlock: { kind: "wins", min: 5 } },
  { id: "neon-foco", label: "Neon FOCO DISCIPLINA LEGADO", art: "neon-foco", x: 438, y: 116, h: 44, anchor: "center", glow: true, unlock: { kind: "rank", stat: "disciplina", min: 5 } },
  { id: "disco-oro", label: "Disco de oro", art: "disco-oro", x: 330, y: 128, h: 62, anchor: "center", unlock: { kind: "release", id: "disco" } },
  { id: "placa-100k", label: "Placa 100.000", art: "placa-100k", x: 738, y: 116, h: 50, anchor: "center", unlock: { kind: "fans", min: 100000 } },
  // --- Purchases (store icons at object scale) --------------------------------
  { id: "microfono", label: "Microfono", art: "item:microfono", x: 458, y: 194, h: 22, unlock: { kind: "item", id: "microfono" } },
  { id: "audifonos", label: "Audifonos", art: "item:audifonos", x: 284, y: 160, h: 18, unlock: { kind: "item", id: "audifonos" } },
  { id: "cuaderno", label: "Cuaderno de rimas", art: "item:cuaderno", x: 330, y: 214, h: 14, unlock: { kind: "item", id: "cuaderno" } },
  { id: "chaqueta", label: "Chaqueta de tarima", art: "item:chaqueta", x: 185, y: 178, h: 40, unlock: { kind: "item", id: "chaqueta" } },
  { id: "zapatillas", label: "Zapatillas nuevas", art: "item:zapatillas", x: 736, y: 376, h: 22, unlock: { kind: "item", id: "zapatillas" } },
];
