// Skin tones (spec §10).
//
// The spec is explicit: "Do not create independent duplicated assets for each skin
// tone unless technically necessary." So a tone is NOT an asset — it draws nothing.
// It is an item with metadata (so the creator can list it with a name, and so the
// economy could in principle gate one) that resolves to a palette index.
//
// §3 puts likeness first, which is why every tone is free and none is level-gated:
// the game never charges the player for looking like themselves.

import { SKIN_TONES } from "../palettes";
import type { ItemMeta } from "../types";

const NAMES = [
  "Muy claro",
  "Claro",
  "Trigueno",
  "Medio",
  "Moreno",
  "Oscuro",
  "Muy oscuro",
  "Palido",
] as const;

export const skinTonesMeta: readonly ItemMeta[] = SKIN_TONES.map((_, i) => ({
  id: `skin_0${i + 1}`,
  name: NAMES[i],
  category: "skin" as const,
  rarity: "common" as const,
  colors: ["skin_primary" as const],
}));

// `skin_03` → 2. Unknown ids fall back to the middle of the palette rather than
// throwing: a save that references a retired tone should still open.
export function skinIndexOf(id: string | null | undefined): number {
  const found = skinTonesMeta.findIndex((tone) => tone.id === id);
  return found >= 0 ? found : 2;
}
