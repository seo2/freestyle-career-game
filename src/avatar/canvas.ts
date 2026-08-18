// The master template every asset is drawn against (spec §7/§8).
//
// The spec's rule is the one that matters: "Artists must NOT manually reposition
// assets to match other assets. Each asset must align to the master avatar
// template." One coordinate space, absolute positions, no offsets — that is the
// whole registration mechanism, and it is why the renderer can compose blindly.
//
// The spec recommends 1000x1600 at 5:8. We author at HALF that — same ratio, same
// proportions, numbers a human can hold in their head. §7 explicitly allows this:
// "The exact dimensions are implementation details and may change, but every asset
// must use the same coordinate system."

export const CANVAS = { w: 500, h: 800 } as const;

// The figure fills 85% of the canvas height (spec §7: 80–90%), and the body is
// distributed HEAD 20% / TORSO 30% / LEGS 40% / SHOES 10% — the spec's own numbers,
// turned into absolute rows so an illustrator has something to snap to.
const FIGURE_TOP = 60;
const FIGURE_H = 680; // 85% of 800

export const ANCHORS = {
  figureTop: FIGURE_TOP,
  crown: FIGURE_TOP, //                        60
  hairline: FIGURE_TOP + 26, //                86
  brow: FIGURE_TOP + 66, //                   126
  eyes: FIGURE_TOP + 80, //                   140
  nose: FIGURE_TOP + 104, //                  164
  mouth: FIGURE_TOP + 122, //                 182
  chin: FIGURE_TOP + 136, //                  196   head = 136 (20%)
  neck: FIGURE_TOP + 136,
  shoulders: FIGURE_TOP + 160, //             220
  chest: FIGURE_TOP + 210, //                 270
  waist: FIGURE_TOP + 300, //                 360
  hip: FIGURE_TOP + 340, //                   400   torso = 204 (30%)
  knee: FIGURE_TOP + 476, //                  536
  ankle: FIGURE_TOP + 612, //                 672   legs = 272 (40%)
  sole: FIGURE_TOP + FIGURE_H, //             740   shoes = 68 (10%)
  centerX: CANVAS.w / 2, //                   250
} as const;

// The light has one direction for the whole figure, and every asset shades against
// this boundary. A per-asset shadow direction is what makes a composed character
// read as stickers instead of a drawing.
export const LIGHT = { shadeFromX: ANCHORS.centerX + 36 } as const;
