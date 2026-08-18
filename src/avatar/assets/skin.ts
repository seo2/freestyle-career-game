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

// Ids written out, not built with `skin_0${i + 1}`. §30 says ids are immutable, and
// a generated id does not exist as text anywhere — which broke the pipeline's
// cross-reference check: a rule pointing at skin_01 was reported as dangling because
// the id could not be found in the source. A test guards this now.
const TONES = [
  { id: "skin_01", name: "Muy claro" },
  { id: "skin_02", name: "Claro" },
  { id: "skin_03", name: "Trigueno" },
  { id: "skin_04", name: "Medio" },
  { id: "skin_05", name: "Moreno" },
  { id: "skin_06", name: "Oscuro" },
  { id: "skin_07", name: "Muy oscuro" },
  { id: "skin_08", name: "Palido" },
] as const;

export const skinTonesMeta: readonly ItemMeta[] = TONES.map((tone) => ({
  id: tone.id,
  name: tone.name,
  category: "skin" as const,
  rarity: "common" as const,
  colors: ["skin_primary" as const],
}));

// The palette has to have a value for every tone, or a legal id renders nothing.
if (TONES.length !== SKIN_TONES.length) {
  throw new Error(`tonos de piel: ${TONES.length} ids contra ${SKIN_TONES.length} colores`);
}

// `skin_03` → 2. Unknown ids fall back to the middle of the palette rather than
// throwing: a save that references a retired tone should still open.
export function skinIndexOf(id: string | null | undefined): number {
  const found = skinTonesMeta.findIndex((tone) => tone.id === id);
  return found >= 0 ? found : 2;
}
