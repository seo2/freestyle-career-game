// Semantic colour tokens (spec §43) and the palettes they resolve to.
//
// §44 is the rule that shapes this file: "do not create duplicate assets only
// because of colour." One asset exposes tokens; the palette supplies the values.
// Four sneaker PNGs in four colours is exactly what this avoids.
//
// A config stores the palette INDEX, not the hex (see ColorChoices), so a palette
// can be retuned later without rewriting anyone's save.

import type { ColorToken } from "./types";

// Ink is shared by the whole figure. A single outline value is what makes separate
// assets read as one drawing.
export const INK = "#12100F";

// Skin tones from the Creador de Avatar design, eight of them (spec §10 asks for 8).
export const SKIN_TONES = [
  "#F6D6B4",
  "#E8B489",
  "#CE9364",
  "#AE7248",
  "#8A5533",
  "#653A22",
  "#432418",
  "#F2E2CE",
] as const;

// Hair, eight (spec §17). The last is a dyed colour, which the spec says arrives
// with the career rather than at creation.
export const HAIR_COLORS = [
  "#151210",
  "#3A2415",
  "#69431F",
  "#A97B3C",
  "#DCB96C",
  "#9A948C",
  "#EDE7DD",
  "#00E5FF",
] as const;

// Garment colours, ten, from the design's CLOTH array.
export const FABRIC_COLORS = [
  "#F5EFE3",
  "#12100F",
  "#00E5FF",
  "#C6F135",
  "#FF5C1F",
  "#FF2D8B",
  "#8B5CF6",
  "#2B5FD9",
  "#A81232",
  "#FFC300",
] as const;

export const METAL_COLORS = ["#FFC300", "#D8D8D8", "#00E5FF", "#C6F135"] as const;

export const paletteFor: Readonly<Record<ColorToken, readonly string[]>> = Object.freeze({
  skin_primary: SKIN_TONES,
  skin_shadow: SKIN_TONES,
  hair_primary: HAIR_COLORS,
  hair_secondary: HAIR_COLORS,
  fabric_primary: FABRIC_COLORS,
  fabric_secondary: FABRIC_COLORS,
  metal_primary: METAL_COLORS,
  accent_primary: FABRIC_COLORS,
  ink: [INK],
});

// Darken toward ink for the single shade value each material gets. Computed rather
// than authored: with flat vector art a derived shade is indistinguishable from a
// hand-picked one, and it means an item declares ONE colour instead of a ramp.
export function shade(hex: string, amount = 0.26): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const target = Number.parseInt(INK.slice(1), 16);
  const mix = (shift: number): number => {
    const a = (n >> shift) & 255;
    const b = (target >> shift) & 255;
    return Math.round(a + (b - a) * amount);
  };
  const out = (mix(16) << 16) | (mix(8) << 8) | mix(0);
  return `#${out.toString(16).padStart(6, "0")}`;
}

// Resolves a token to a hex, falling back to the palette's first entry so a missing
// choice renders a valid avatar instead of nothing. §78 wants determinism, and
// "undefined means index 0" is deterministic.
export function colorOf(token: ColorToken, index: number | undefined): string {
  const palette = paletteFor[token];
  if (palette.length === 0) return INK;
  const i = index ?? 0;
  return palette[((i % palette.length) + palette.length) % palette.length];
}
