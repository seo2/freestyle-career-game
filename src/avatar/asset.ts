// What an asset IS, at runtime.
//
// The spec (§42) wants SVG assets on disk, authored in Figma and exported. That is
// the production pipeline. For the MVP (§61: "do not spend time producing hundreds
// of assets before the renderer is proven") an asset is a FUNCTION that returns SVG
// markup per layer — which is the same contract a loaded file satisfies, so
// swapping in exported files later changes this file and nothing else.
//
// The important part is the contract, not where the markup comes from:
//
//   * an asset paints into one or more of the 27 fixed layers, by name;
//   * it receives resolved colours and the body's measurements, never the config;
//   * it is pure — same input, same markup (§78: deterministic).

import type { LayerId } from "./layers";
import type { ItemMeta } from "./types";

// Measurements an asset needs to fit the body it is worn on. A top has to know how
// wide the torso is, or a heavy build wears a shirt cut for a slim one.
export interface BodyMetrics {
  // Torso width at the shoulders, and at the waist.
  shoulderW: number;
  waistW: number;
  // Vertical offset applied to the whole figure by this build (a tall body starts
  // higher). Assets add it to the anchors rather than hard-coding rows.
  lift: number;
  legW: number;
  headW: number;
  headH: number;
  // Corner radius of the head, which is what makes a face shape read as round or
  // angular without redrawing every hat.
  headR: string;
}

// Colours already resolved to hex. An asset never sees an index or a palette.
export interface DrawColors {
  skin: string;
  skinShade: string;
  hair: string;
  hairShade: string;
  fabric: string;
  fabricShade: string;
  fabric2: string;
  metal: string;
  accent: string;
  ink: string;
}

export interface DrawContext {
  body: BodyMetrics;
  colors: DrawColors;
  // Absolute rows from the master template, already shifted by the body's lift.
  y: Readonly<Record<string, number>>;
  cx: number;
}

// Markup per layer. A key absent means the asset paints nothing there.
export type DrawResult = Partial<Record<LayerId, string>>;

export interface Asset {
  meta: ItemMeta;
  draw: (ctx: DrawContext) => DrawResult;
}
