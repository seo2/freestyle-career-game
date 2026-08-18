// The fixed rendering order (spec §28).
//
// This is the single most important invariant in the avatar system, and the spec
// states the reason bluntly: **the player's equipment order must never determine
// rendering order.** Equip a chain after a jacket and the chain still goes over it,
// because the order lives here and not in the act of equipping.
//
// The numbers are the spec's own, kept as a comment so this file can be diffed
// against the document.

import type { Category } from "./types";

// 01..27 exactly as written in the spec.
export const layerOrder = [
  "shadow", //            01
  "back_accessories", //  02
  "back_hair", //         03
  "legs", //              04
  "socks", //             05
  "shoes", //             06
  "body", //              07
  "tattoos_body", //      08
  "bottom", //            09
  "top", //               10
  "jacket", //            11
  "neck", //              12
  "head", //              13
  "ears", //              14
  "face", //              15
  "eyes", //              16
  "eyebrows", //          17
  "nose", //              18
  "mouth", //             19
  "facial_hair", //       20
  "front_hair", //        21
  "glasses", //           22
  "hat", //               23
  "necklace", //          24
  "front_accessories", // 25
  "props", //             26
  "effects", //           27
] as const;

export type LayerId = (typeof layerOrder)[number];

export const layerIndex: Readonly<Record<LayerId, number>> = Object.freeze(
  layerOrder.reduce<Record<string, number>>((acc, id, i) => {
    acc[id] = i;
    return acc;
  }, {}),
);

// An asset declares which layers it paints into. Hair is the interesting case: one
// hairstyle contributes to BOTH back_hair (03, behind the body) and front_hair (21,
// over the face), which is how an afro sits behind the shoulders while its fringe
// covers the forehead. A single hair layer cannot do both.
export const layersForCategory: Readonly<Record<Category, readonly LayerId[]>> = Object.freeze({
  body: ["legs", "body", "neck", "head", "ears"],
  skin: [],
  face: ["face"],
  eyes: ["eyes"],
  eyebrows: ["eyebrows"],
  nose: ["nose"],
  mouth: ["mouth"],
  hair: ["back_hair", "front_hair"],
  facial_hair: ["facial_hair"],
  tattoo: ["tattoos_body"],
  piercing: ["front_accessories"],
  top: ["top"],
  jacket: ["jacket"],
  bottom: ["bottom"],
  socks: ["socks"],
  shoes: ["shoes"],
  hat: ["hat"],
  glasses: ["glasses"],
  jewelry: ["necklace"],
  accessory: ["back_accessories", "front_accessories"],
  prop: ["props"],
  effect: ["effects"],
});

export function sortLayers<T extends { layer: LayerId }>(parts: readonly T[]): T[] {
  // Stable by construction: equal layers keep the order the resolver emitted them,
  // which is what lets one asset paint two shapes into the same layer predictably.
  return [...parts].sort((a, b) => layerIndex[a.layer] - layerIndex[b.layer]);
}
