// The MC's art, drawn as pixel art in text (Fase 10).
//
// The first version of the modular MC described each piece as a list of
// rectangles. That worked, but it could only make rectangles: the figure came out
// blocky next to the game's original render, which is chibi-proportioned, fully
// outlined and shaded in three tones. You cannot hand-author a rounded head as a
// rect list — you author it as pixels.
//
// So every piece is a block of strings, one character per pixel, and
// src/ui/characterDraw.ts turns each row into horizontal runs. That is how pixel
// art is actually drawn: editable in place, diffable, and readable as the thing it
// depicts.
//
// GRID: 32 wide x 72 tall, and every piece is authored against ONE fixed anatomy:
//
//    0..21  head (x5..26, 22 wide — about a third of the figure, which is what
//           gives the original its chibi read; the first grid gave it 14%)
//   22..25  neck
//   26..27  shoulders
//   28..45  torso, with the arms at x4..7 and x24..27
//   46..48  hips
//   49..63  legs (x9..14 and x17..22)
//   64..71  shoes
//
// Writing those bands down is not decoration. The first hand-authored pass gave
// each piece its own offsets and the result had shoes floating below the ankles and
// arms hidden inside the torso — pieces that never agreed on where the body was.
//
// LEGEND (keep this in sync with TONE_CHARS below)
//   .  transparent      o  outline (near-black, closes every silhouette)
//   s  skin             S  skin shadow        l  skin highlight
//   h  hair             H  hair shadow
//   t  top              T  top shadow         w  top highlight (prints, stripes)
//   b  bottom           B  bottom shadow
//   e  shoe             E  shoe shadow
//   m  metal            n  lens (glass)
//
// Rows are trimmed at the edges by the renderer, so a piece only needs to be as
// tall as it is: `y` places its first row on the grid.

import type { ToneKey } from "./character";

export const ART_GRID = { w: 32, h: 72 } as const;

// Character -> tone. Anything not listed is transparent.
export const TONE_CHARS: Record<string, ToneKey> = {
  o: "line",
  s: "skin",
  S: "skinShade",
  l: "skinLight",
  h: "hair",
  H: "hairShade",
  t: "top",
  T: "topShade",
  w: "topLight",
  b: "bottom",
  B: "bottomShade",
  e: "shoe",
  E: "shoeShade",
  m: "metal",
  n: "lens",
};

export interface ArtPiece {
  id: string;
  label: string;
  // Where the block's top-left corner sits on the 32x72 grid.
  x: number;
  y: number;
  rows: string[];
}

// --- the body: head, torso, arms, legs, always drawn -----------------------
// Shading convention throughout: light falls from the upper left, so the right
// third of every form carries the shadow tone and the upper left carries the
// highlight. Keeping that consistent is what makes separately-authored pieces read
// as one figure.
export const bodyArt: ArtPiece = {
  id: "body",
  label: "Cuerpo",
  x: 0,
  y: 0,
  rows: [
    ".........oooooooooooooo.........",
    ".......osssssssssssssSSSo.......",
    "......oslllsssssssssssSSSo......",
    ".....oslllsssssssssssssSSSo.....",
    ".....oslllsssssssssssssSSSo.....",
    "....oslllsssssssssssssssSSSo....",
    "....oslllsssssssssssssssSSSo....",
    "....oslllsssssssssssssssSSSo....",
    "....osssssssssssssssssssSSSo....",
    "....osssssssssssssssssssSSSo....",
    "....osssssssssssssssssssSSSo....",
    "....osssssssssssssssssssSSSo....",
    "....osssssssssssssssssssSSSo....",
    "....osssssssssssssssssssSSSo....",
    ".....osssssssssssssssssSSSo.....",
    ".....osssssssssssssssssSSSo.....",
    "......osssssssssssssssSSSo......",
    ".......osssssssssssssSSSo.......",
    "........osssssssssssSSSo........",
    ".........osssssssssSSSo.........",
    "...........osssssSSSo...........",
    "............oooooooo............",
    ".............oSSSSo.............",
    ".............oSSSSo.............",
    ".............oSSSSo.............",
    ".............oSSSSo.............",
    "......oooooooooooooooooooo......",
    ".....ossssssssssssssSSSSo.......",
    "....ossoossssssssssssSSooSSo....",
    "....ossoossssssssssssSSooSSo....",
    "....ossoossssssssssssSSooSSo....",
    "....ossoossssssssssssSSooSSo....",
    "....ossoossssssssssssSSooSSo....",
    "....ossoossssssssssssSSooSSo....",
    "....ossoossssssssssssSSooSSo....",
    "....ossoossssssssssssSSooSSo....",
    "....ossoossssssssssssSSooSSo....",
    "....ossoossssssssssssSSooSSo....",
    "....ossoossssssssssssSSooSSo....",
    "....ossoossssssssssssSSooSSo....",
    "....ossoossssssssssssSSooSSo....",
    "....ossoossssssssssssSSooSSo....",
    "....ossoossssssssssssSSooSSo....",
    "....ossoossssssssssssSSooSSo....",
    "....ossoossssssssssssSSooSSo....",
    "....ossoossssssssssssSSooSSo....",
    "........ossssssssssssSSo........",
    "........ossssssssssssSSo........",
    "........ossssssssssssSSo........",
    "........osssssSoosssssSo........",
    "........osssssSoosssssSo........",
    "........osssssSoosssssSo........",
    "........osssssSoosssssSo........",
    "........osssssSoosssssSo........",
    "........osssssSoosssssSo........",
    "........osssssSoosssssSo........",
    "........osssssSoosssssSo........",
    "........osssssSoosssssSo........",
    "........osssssSoosssssSo........",
    "........osssssSoosssssSo........",
    "........osssssSoosssssSo........",
    "........osssssSoosssssSo........",
    "........osssssSoosssssSo........",
    "........osssssSoosssssSo........",
    "........oooooooooooooooo........",
  ],
};

// The face goes on top of the head stack: the glasses are the original
// character's and they are most of what makes him recognisable.
export const faceArt: ArtPiece = {
  id: "face",
  label: "Cara",
  x: 0,
  y: 9,
  rows: [
    "......oooooooo....oooooooo......",
    "......onnnnnnooo..onnnnnno......",
    "......onnnnnnooo..onnnnnno......",
    "......onnnnnno....onnnnnno......",
    "......oooooooo....oooooooo......",
    "................................",
    "..............SS................",
    "..............SS................",
    "................................",
    "............oSSSSSSo............",
    ".............oooooo.............",
  ],
};

// --- hair: what the barbershop sells ---------------------------------------
export const hairArt: ArtPiece[] = [
  {
    id: "rapado",
    label: "Rapado",
    x: 0,
    y: 0,
    rows: [
      ".........oooooooooooooo.........",
      ".......ohhhhhhhhhhhhhHHHo.......",
      "......ohhhhhhhhhhhhhhhHHHo......",
      ".....ohhhhhhhhhhhhhhhhhHHHo.....",
      ".....ohhhhhhhhhhhhhhhhhHHHo.....",
    ],
  },
  {
    id: "corto",
    label: "Corto",
    x: 0,
    y: 0,
    rows: [
      ".........oooooooooooooo.........",
      ".......ohhhhhhhhhhhhhHHHo.......",
      "......ohhhhhhhhhhhhhhhHHHo......",
      ".....ohhhhhhhhhhhhhhhhhHHHo.....",
      ".....ohhhhhhhhhhhhhhhhhHHHo.....",
      "....ohhhhhhhhhhhhhhhhhhhHHHo....",
      "....ohhhhhhhhhhhhhhhhhhhHHHo....",
      "................................",
      "....oh....................ho....",
    ],
  },
  {
    id: "afro",
    label: "Afro",
    x: 0,
    y: 0,
    rows: [
      "..oooooooooooooooooooooooooooo..",
      ".....ohhhhhhhhhhhhhhhhhHHHo.....",
      "....ohhhhhhhhhhhhhhhhhhhHHHo....",
      "...ohhhhhhhhhhhhhhhhhhhhhHHHo...",
      "...ohhhhhhhhhhhhhhhhhhhhhHHHo...",
      "..ohhhhhhhhhhhhhhhhhhhhhhhHHHo..",
      "..ohhhhhhhhhhhhhhhhhhhhhhhHHHo..",
      "..ohhhhhhhhhhhhhhhhhhhhhhhHHHo..",
      "..ohhhhhhhhhhhhhhhhhhhhhhhHHHo..",
    ],
  },
  {
    id: "trenzas",
    label: "Trenzas",
    x: 0,
    y: 0,
    rows: [
      ".........oooooooooooooo.........",
      ".......ohHhHhHhHhHhHhHHHo.......",
      "......ohhhhhhhhhhhhhhhHHHo......",
      ".....ohHhHhHhHhHhHhHhHhHHHo.....",
      ".....ohhhhhhhhhhhhhhhhhHHHo.....",
      "....ohHhHhHhHhHhHhHhHhHhHHHo....",
      "....ohhhhhhhhhhhhhhhhhhhHHHo....",
      "................................",
      "....oh....................ho....",
      "....oh....................ho....",
      "....oh....................ho....",
      "....oh....................ho....",
      "....oh....................ho....",
      "....oh....................ho....",
      "....oh....................ho....",
      "....oh....................ho....",
    ],
  },
  {
    id: "mohicano",
    label: "Mohicano",
    x: 0,
    y: 0,
    rows: [
      ".............oooooo.............",
      "............ohhhhhho............",
      "............ohhhhhho............",
      "...........oohhhhhhoo...........",
    ],
  },
  {
    id: "tapado",
    label: "Pelo largo",
    x: 0,
    y: 0,
    rows: [
      ".........oooooooooooooo.........",
      ".......ohhhhhhhhhhhhhHHHo.......",
      "......ohhhhhhhhhhhhhhhHHHo......",
      ".....ohhhhhhhhhhhhhhhhhHHHo.....",
      ".....ohhhhhhhhhhhhhhhhhHHHo.....",
      "....ohhhhhhhhhhhhhhhhhhhHHHo....",
      "....ohhhhhhhhhhhhhhhhhhhHHHo....",
      "....ohhhhhhhhhhhhhhhhhhhHHHo....",
      "...ohh....................hho...",
      "...ohh....................hho...",
      "...ohh....................hho...",
      "...ohh....................hho...",
      "...ohh....................hho...",
      "...ohh....................hho...",
      "...ohh....................hho...",
      "...ohh....................hho...",
      "...ohh....................hho...",
      "...ohh....................hho...",
      "...ohh....................hho...",
      "...ohh....................hho...",
    ],
  },
];

// --- beards ----------------------------------------------------------------
export const beardArt: ArtPiece[] = [
  {
    id: "lampino",
    label: "Sin barba",
    x: 0,
    y: 0,
    rows: [
    ],
  },
  {
    id: "candado",
    label: "Candado",
    x: 0,
    y: 20,
    rows: [
      ".............HHHHHH.............",
      "..............HHHH..............",
    ],
  },
  {
    id: "barba",
    label: "Barba",
    x: 0,
    y: 15,
    rows: [
      ".....oHH................HHo.....",
      ".....oHHH..............HHHo.....",
      "......oHHHHH.........HHHHHo.....",
      ".......oHHHHHHHHHHHHHHHHo.......",
      ".........oHHHHHHHHHHHHo.........",
      "...........oHHHHHHHo............",
    ],
  },
  {
    id: "bigote",
    label: "Bigote",
    x: 0,
    y: 20,
    rows: [
      "............HHHHHHHH............",
    ],
  },
];

// --- tops ------------------------------------------------------------------
export const topArt: ArtPiece[] = [
  {
    id: "polera",
    label: "Polera",
    x: 0,
    y: 26,
    rows: [
      "......oooooooooooooooooooo......",
      ".....otttttttttttttTTTTo........",
      "....ottoottttttttttttTTooTTo....",
      "....ottoottttttttttttTTooTTo....",
      "....ottoottttttttttttTTooTTo....",
      "....ottoottttttttttttTTooTTo....",
      "....ottootwwwwwwwwwtTTTooTTo....",
      "....ottoottttttttttttTTooTTo....",
      "....ottoottttttttttttTTooTTo....",
      "....ottootwwwwwwwwwtTTTooTTo....",
      "....ottoottttttttttttTTooTTo....",
      "....ottootwwwwwwwwwtTTTooTTo....",
      "....ottoottttttttttttTTooTTo....",
      "....ottoottttttttttttTTooTTo....",
      "........ottttttttttttTTo........",
      "........ottttttttttttTTo........",
      "........oTTTTTTTTTTTTTTo........",
    ],
  },
  {
    id: "polerontrivio",
    label: "Poleron",
    x: 0,
    y: 26,
    rows: [
      "......oooooooooooooooooooo......",
      ".....otttttttttttttTTTTo........",
      "....ottoottttTTTTttttTTooTTo....",
      "....ottoottttTTTTttttTTooTTo....",
      "....ottoottttttttttttTTooTTo....",
      "....ottoottttttttttttTTooTTo....",
      "....ottoottttttttttttTTooTTo....",
      "....ottoottttttttttttTTooTTo....",
      "....ottoottttttttttttTTooTTo....",
      "....ottoottttttttttttTTooTTo....",
      "....ottoottttttttttttTTooTTo....",
      "....ottoottttttttttttTTooTTo....",
      "....ottoottttttttttttTTooTTo....",
      "....ottoottttttttttttTTooTTo....",
      "........ottttttttttttTTo........",
      "........ottttttttttttTTo........",
      "........ottttttttttttTTo........",
      "........ottttttttttttTTo........",
      "........ottttttttttttTTo........",
      "........ottttttttttttTTo........",
      "........oTTTTTTTTTTTTTTo........",
    ],
  },
  {
    id: "camisa",
    label: "Camisa abierta",
    x: 0,
    y: 26,
    rows: [
      "......oooooooooooooooooooo......",
      ".....otttttttttttttTTTTo........",
      "....ottootttsssssstttTTooTTo....",
      "....ottootttsssssstttTTooTTo....",
      "....ottootttsssssstttTTooTTo....",
      "....ottootttsssssstttTTooTTo....",
      "....ottootttsssssstttTTooTTo....",
      "....ottootttsssssstttTTooTTo....",
      "....ottootttsssssstttTTooTTo....",
      "....ottootttsssssstttTTooTTo....",
      "....ottootttsssssstttTTooTTo....",
      "....ottootttsssssstttTTooTTo....",
      "....ottootttsssssstttTTooTTo....",
      "....ottootttsssssstttTTooTTo....",
      "........otttsssssstttTTo........",
      "........otttsssssstttTTo........",
      "........otttsssssstttTTo........",
      "........otttsssssstttTTo........",
      "........oTTTTTTTTTTTTTTo........",
    ],
  },
  {
    id: "camiseta",
    label: "Camiseta ancha",
    x: 0,
    y: 26,
    rows: [
      "......oooooooooooooooooooo......",
      ".....otttttttttttttTTTTo........",
      "....ottoottttttttttttTTooTTo....",
      "....ottoottttttttttttTTooTTo....",
      "....ottoottttttttttttTTooTTo....",
      "....ottoottttttttttttTTooTTo....",
      "....ottoottttttttttttTTooTTo....",
      "....ottootwwwwwwwwwtTTTooTTo....",
      "....ottootwwwwwwwwwtTTTooTTo....",
      "....ottoottttttttttttTTooTTo....",
      "....ottoottttttttttttTTooTTo....",
      "....ottoottttttttttttTTooTTo....",
      "....ottoottttttttttttTTooTTo....",
      "....ottoottttttttttttTTooTTo....",
      "........ottttttttttttTTo........",
      "........ottttttttttttTTo........",
      "........ottttttttttttTTo........",
      "........ottttttttttttTTo........",
      "........ottttttttttttTTo........",
      "........ottttttttttttTTo........",
      "........oTTTTTTTTTTTTTTo........",
    ],
  },
];

// --- bottoms ---------------------------------------------------------------
export const bottomArt: ArtPiece[] = [
  {
    id: "jeans",
    label: "Jeans",
    x: 0,
    y: 45,
    rows: [
      "........oooooooooooooooo........",
      "........obbbbbbbbbbbbBBo........",
      "........obbbbbbbbbbbbBBo........",
      "........obbbbbBoobbbbbBo........",
      "........obbbbbBoobbbbbBo........",
      "........obbbbbBoobbbbbBo........",
      "........obbbbbBoobbbbbBo........",
      "........obbbbbBoobbbbbBo........",
      "........obbbbbBoobbbbbBo........",
      "........obbbbbBoobbbbbBo........",
      "........obbbbbBoobbbbbBo........",
      "........obbbbbBoobbbbbBo........",
      "........obbbbbBoobbbbbBo........",
      "........obbbbbBoobbbbbBo........",
      "........obbbbbBoobbbbbBo........",
      "........obbbbbBoobbbbbBo........",
      "........oBBBBBBooBBBBBBo........",
      "........oooooo.oooooooo.........",
    ],
  },
  {
    id: "buzo",
    label: "Buzo",
    x: 0,
    y: 45,
    rows: [
      "........oooooooooooooooo........",
      "........obbbbbbbbbbbbBBo........",
      "........obbbbbbbbbbbbBBo........",
      "........obbbbbwwbbbbbBBo........",
      "........obbbbbBoobbbbbBo........",
      "........obbbbbBoobbbbbBo........",
      "........obbbbbBoobbbbbBo........",
      "........obbbbbBoobbbbbBo........",
      "........obbbbbBoobbbbbBo........",
      "........obbbbbBoobbbbbBo........",
      "........obbbbbBoobbbbbBo........",
      "........obbbbbBoobbbbbBo........",
      "........obbbbbBoobbbbbBo........",
      "........obbbbbBoobbbbbBo........",
      "........obbbbbBoobbbbbBo........",
      "........obbbbbBoobbbbbBo........",
      "........obbbbbBoobbbbbBo........",
      "........oBBBBBBooBBBBBBo........",
      "........oooooo.oooooooo.........",
    ],
  },
  {
    id: "short",
    label: "Short",
    x: 0,
    y: 45,
    rows: [
      "........oooooooooooooooo........",
      "........obbbbbbbbbbbbBBo........",
      "........obbbbbbbbbbbbBBo........",
      "........obbbbbwwbbbbbBBo........",
      "........obbbbbBoobbbbbBo........",
      "........obbbbbBoobbbbbBo........",
      "........obbbbbBoobbbbbBo........",
      "........obbbbbBoobbbbbBo........",
      "........obbbbbBoobbbbbBo........",
      "........oBBBBBBooBBBBBBo........",
      "........oooooo.oooooooo.........",
    ],
  },
];

// --- shoes -----------------------------------------------------------------
export const shoeArt: Record<string, ArtPiece> = {
  zapatos: {
    id: "zapatos",
    label: "Zapatos",
    x: 0,
    y: 63,
    rows: [
      "........oooooo...oooooo.........",
      ".......oeeeeeeo.oeeeeeeo........",
      "......oeeeeeeeo.oeeeeeeeo.......",
      "......oEEEEEEEo.oEEEEEEEo.......",
      "......ooooooooo.ooooooooo.......",
    ],
  },
  zapatillas: {
    id: "zapatillas",
    label: "Zapatillas",
    x: 0,
    y: 61,
    rows: [
      ".........oooo.....oooo..........",
      "........oeeeeo...oeeeeo.........",
      ".......oeeeeeeo.oeeeeeeo........",
      "......oeeoeeeeooeeoeeeeo........",
      ".....oeeeeeeeeEoeeeeeeeeEo......",
      ".....oeeeeeeeeEoeeeeeeeeEo......",
      ".....ooooooooooooooooooooo......",
    ],
  },
};

// --- worn accessories, keyed by the shop item id --------------------------
export const wearableArt: Record<string, ArtPiece> = {
  gorra: {
    id: "gorra",
    label: "Gorra",
    x: 0,
    y: 0,
    rows: [
      ".........oooooooooooooo.........",
      ".......otttttttttttttTTTo.......",
      "......otttttttttttttttTTTo......",
      ".....ottttwwwwtttTTTTTTT..o.....",
      ".....otttttttttttttttttTTTo.....",
      "....otttttttttttttttttttTTTo....",
      "....otttttttttttttttttttTTTo....",
      "..oooooooooooooooooooooooooooo..",
      ".oooooooooooooooooooooooooooooo.",
      "..oooooooooooooooooooooooooooo..",
    ],
  },
  chaqueta: {
    id: "chaqueta",
    label: "Chaqueta",
    x: 0,
    y: 26,
    rows: [
      "......oooooooooooooooooooo......",
      ".....otttttttttttttTTTTo........",
      "....ottoottttttttttttTTooTTo....",
      "....ottoottttttttttttTTooTTo....",
      "....ottoottttttttttttTTooTTo....",
      "....ottoottttttttttttTTooTTo....",
      "....ottoottttttttttttTTooTTo....",
      "....ottoottttttttttttTTooTTo....",
      "....ottoottttttttttttTTooTTo....",
      "....ottoottttttttttttTTooTTo....",
      "....ottoottttttttttttTTooTTo....",
      "....ottoottttttttttttTTooTTo....",
      "....ottoottttttttttttTTooTTo....",
      "....ottoottttttttttttTTooTTo....",
      "........ottttttttttttTTo........",
      "........ottttttttttttTTo........",
      "........ottttttttttttTTo........",
      "........ottttttttttttTTo........",
      "........ottttttttttttTTo........",
      "........ottttttttttttTTo........",
      "........ottttttttttttTTo........",
      "........ottttttttttttTTo........",
      "........oTTTTTTTTTTTTTTo........",
    ],
  },
  audifonos: {
    id: "audifonos",
    label: "Audifonos",
    x: 0,
    y: 4,
    rows: [
      "......ommmmmmmmmmmmmmmmmmmo.....",
      "......o...................o.....",
      "....ommo.................ommo...",
      "....ommmo...............ommmo...",
      "....ommmo...............ommmo...",
      "....ommmo...............ommmo...",
      "....oooo................oooo....",
    ],
  },
  microfono: {
    id: "microfono",
    label: "Microfono",
    x: 0,
    y: 34,
    rows: [
      "...........................oo...",
      "..........................ommo..",
      "..........................ommo..",
      "...........................oo...",
      "...........................mm...",
      "...........................mm...",
      "...........................mm...",
    ],
  },
};
