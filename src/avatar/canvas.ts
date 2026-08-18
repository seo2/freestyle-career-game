// The master template every asset is drawn against (spec §7/§8).
//
// The spec's rule is the one that matters: "Artists must NOT manually reposition
// assets to match other assets. Each asset must align to the master avatar
// template." One coordinate space, absolute positions, no offsets — that is the
// whole registration mechanism, and it is why the renderer can compose blindly.
//
// The numbers live in canvas.json, NOT here, because the pipeline scripts read the
// same file to generate the Figma template and to validate imported art. If they
// were duplicated in a .ts and a .mjs they would drift, and the first symptom would
// be a hat that sits 4px too high in one build.

import data from "./canvas.json";

export const CANVAS = { w: data.canvas.w, h: data.canvas.h } as const;

// The spec recommends 1000x1600 at 5:8. We author at HALF that — same ratio, same
// proportions, numbers a human can hold in their head. §7 explicitly allows it:
// "The exact dimensions are implementation details and may change, but every asset
// must use the same coordinate system."
export const ANCHORS = {
  figureTop: data.figure.top,
  ...data.anchors,
  centerX: data.centerX,
} as const;

export const LIGHT = { shadeFromX: data.light.shadeFromX } as const;

// Which build the art is authored against. Other builds are reached by transform
// (see the renderer), which is an approximation the QA checklist flags.
export const DEFAULT_BODY = data.defaultBody;
