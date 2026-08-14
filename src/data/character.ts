// The MC as a stack of layers (Fase 10).
//
// Why this is data and not a sprite: the owner asked for a character that is
// genuinely customizable and MODULAR, so that clothes and accessories bought later
// show up on him. That cannot come from the one flat 101x240 render the project
// had — a paper doll needs its pieces separable, and there is no layered art in
// reference/ to cut them from (its sprite folder is skies, walls and speakers).
//
// So each piece is pixel data on a 24x56 grid — the same proportion as the old
// render — drawn as rectangles by src/ui/characterDraw.ts. At the sizes the MC
// appears (46 to 262 px tall) that reads as chunky pixel art, which is the game's
// register anyway.
//
// This is built to be REPLACED, the same way the synthesized music is: swap a
// piece's `rects` for a sprite key and nothing else in the chain changes.

export const GRID = { w: 24, h: 56 } as const;

// Colour roles. A piece names a role, and the palette resolves it — that is what
// lets one hairstyle work on five skin tones and one jacket in four colourways.
export type ToneKey =
  | "skin"
  | "skinShade"
  | "hair"
  | "hairShade"
  | "top"
  | "topShade"
  | "bottom"
  | "bottomShade"
  | "shoe"
  | "metal"
  | "lens"
  | "line";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  tone: ToneKey;
}

export interface Piece {
  id: string;
  label: string;
  rects: Rect[];
}

// --- skin ------------------------------------------------------------------
// Sampled from the Crear MC mockup's swatch strip, which is where the player
// picks them. Each tone carries its own shade so the shading stays in family
// instead of going grey.
export const skinTones: { id: number; label: string; skin: string; skinShade: string }[] = [
  { id: 1, label: "Claro", skin: "#ecb98c", skinShade: "#c9945f" },
  { id: 2, label: "Trigueno", skin: "#d49765", skinShade: "#a97243" },
  { id: 3, label: "Moreno", skin: "#aa6c42", skinShade: "#82502e" },
  { id: 4, label: "Oscuro", skin: "#693c22", skinShade: "#4d2b17" },
  { id: 5, label: "Muy oscuro", skin: "#3f2617", skinShade: "#2b190e" },
];

// --- the body: always drawn, never chosen ----------------------------------
export const bodyPiece: Piece = {
  id: "body",
  label: "Cuerpo",
  rects: [
    // head
    { x: 8, y: 4, w: 8, h: 8, tone: "skin" },
    { x: 8, y: 10, w: 8, h: 2, tone: "skinShade" },
    // ears
    { x: 7, y: 7, w: 1, h: 2, tone: "skinShade" },
    { x: 16, y: 7, w: 1, h: 2, tone: "skinShade" },
    // neck
    { x: 10, y: 12, w: 4, h: 2, tone: "skinShade" },
    // torso (covered by a top, but there when the top is a vest)
    { x: 8, y: 14, w: 8, h: 12, tone: "skin" },
    // arms
    { x: 5, y: 15, w: 3, h: 11, tone: "skin" },
    { x: 16, y: 15, w: 3, h: 11, tone: "skin" },
    // hands
    { x: 5, y: 26, w: 3, h: 2, tone: "skinShade" },
    { x: 16, y: 26, w: 3, h: 2, tone: "skinShade" },
    // legs
    { x: 9, y: 26, w: 3, h: 16, tone: "skin" },
    { x: 12, y: 26, w: 3, h: 16, tone: "skin" },
  ],
};

// The eyes sit above the hair in z-order so a fringe cannot bury them.
export const facePiece: Piece = {
  id: "face",
  label: "Cara",
  rects: [
    // Brows first: without them the face reads blank whatever the eyes do.
    { x: 9, y: 6, w: 2, h: 1, tone: "hairShade" },
    { x: 13, y: 6, w: 2, h: 1, tone: "hairShade" },
    { x: 9, y: 7, w: 2, h: 2, tone: "line" },
    { x: 13, y: 7, w: 2, h: 2, tone: "line" },
    // A single glint pixel in each eye. Two solid black squares read as a mask.
    { x: 10, y: 7, w: 1, h: 1, tone: "metal" },
    { x: 14, y: 7, w: 1, h: 1, tone: "metal" },
    // Mouth.
    { x: 11, y: 10, w: 3, h: 1, tone: "skinShade" },
  ],
};

// --- hair: what the barbershop sells ---------------------------------------
export const hairStyles: Piece[] = [
  {
    id: "rapado",
    label: "Rapado",
    rects: [
      { x: 8, y: 3, w: 8, h: 2, tone: "hair" },
      { x: 7, y: 4, w: 1, h: 3, tone: "hairShade" },
      { x: 16, y: 4, w: 1, h: 3, tone: "hairShade" },
    ],
  },
  {
    id: "corto",
    label: "Corto",
    rects: [
      { x: 7, y: 2, w: 10, h: 3, tone: "hair" },
      { x: 7, y: 5, w: 2, h: 2, tone: "hairShade" },
      { x: 15, y: 5, w: 2, h: 2, tone: "hairShade" },
    ],
  },
  {
    id: "afro",
    label: "Afro",
    rects: [
      { x: 6, y: 0, w: 12, h: 5, tone: "hair" },
      { x: 5, y: 2, w: 1, h: 4, tone: "hairShade" },
      { x: 18, y: 2, w: 1, h: 4, tone: "hairShade" },
      { x: 7, y: 5, w: 2, h: 2, tone: "hairShade" },
      { x: 15, y: 5, w: 2, h: 2, tone: "hairShade" },
    ],
  },
  {
    id: "trenzas",
    label: "Trenzas",
    rects: [
      { x: 7, y: 2, w: 10, h: 3, tone: "hair" },
      { x: 7, y: 5, w: 1, h: 8, tone: "hair" },
      { x: 16, y: 5, w: 1, h: 8, tone: "hair" },
      { x: 9, y: 3, w: 1, h: 2, tone: "hairShade" },
      { x: 12, y: 3, w: 1, h: 2, tone: "hairShade" },
      { x: 14, y: 3, w: 1, h: 2, tone: "hairShade" },
    ],
  },
  {
    id: "mohicano",
    label: "Mohicano",
    rects: [
      { x: 11, y: 0, w: 3, h: 5, tone: "hair" },
      { x: 8, y: 3, w: 3, h: 2, tone: "hairShade" },
      { x: 14, y: 3, w: 2, h: 2, tone: "hairShade" },
    ],
  },
  {
    id: "tapado",
    label: "Pelo largo",
    rects: [
      { x: 6, y: 1, w: 12, h: 4, tone: "hair" },
      { x: 6, y: 5, w: 2, h: 9, tone: "hair" },
      { x: 16, y: 5, w: 2, h: 9, tone: "hair" },
      { x: 6, y: 12, w: 2, h: 2, tone: "hairShade" },
      { x: 16, y: 12, w: 2, h: 2, tone: "hairShade" },
    ],
  },
];

// --- beards: the other half of the barbershop -----------------------------
export const beardStyles: Piece[] = [
  { id: "lampino", label: "Sin barba", rects: [] },
  {
    id: "candado",
    label: "Candado",
    rects: [
      { x: 11, y: 11, w: 2, h: 2, tone: "hairShade" },
      { x: 10, y: 10, w: 1, h: 1, tone: "hairShade" },
      { x: 13, y: 10, w: 1, h: 1, tone: "hairShade" },
    ],
  },
  {
    id: "barba",
    label: "Barba",
    rects: [
      { x: 8, y: 9, w: 8, h: 4, tone: "hairShade" },
      { x: 9, y: 13, w: 6, h: 1, tone: "hairShade" },
      { x: 10, y: 8, w: 4, h: 1, tone: "hairShade" },
    ],
  },
  {
    id: "bigote",
    label: "Bigote",
    rects: [{ x: 10, y: 9, w: 4, h: 1, tone: "hairShade" }],
  },
];

// --- clothes: what the shop sells ------------------------------------------
export const tops: Piece[] = [
  {
    id: "polera",
    label: "Polera",
    rects: [
      { x: 8, y: 14, w: 8, h: 10, tone: "top" },
      { x: 5, y: 15, w: 3, h: 4, tone: "top" },
      { x: 16, y: 15, w: 3, h: 4, tone: "top" },
      { x: 8, y: 22, w: 8, h: 2, tone: "topShade" },
    ],
  },
  {
    id: "polerontrivio",
    label: "Poleron",
    rects: [
      { x: 7, y: 13, w: 10, h: 13, tone: "top" },
      { x: 5, y: 15, w: 3, h: 11, tone: "top" },
      { x: 16, y: 15, w: 3, h: 11, tone: "top" },
      { x: 10, y: 13, w: 4, h: 2, tone: "topShade" },
      { x: 7, y: 24, w: 10, h: 2, tone: "topShade" },
    ],
  },
  {
    id: "camisa",
    label: "Camisa abierta",
    rects: [
      { x: 7, y: 14, w: 3, h: 12, tone: "top" },
      { x: 14, y: 14, w: 3, h: 12, tone: "top" },
      { x: 5, y: 15, w: 3, h: 11, tone: "top" },
      { x: 16, y: 15, w: 3, h: 11, tone: "top" },
      { x: 7, y: 24, w: 3, h: 2, tone: "topShade" },
      { x: 14, y: 24, w: 3, h: 2, tone: "topShade" },
    ],
  },
  {
    id: "camiseta",
    label: "Camiseta ancha",
    rects: [
      { x: 7, y: 14, w: 10, h: 13, tone: "top" },
      { x: 5, y: 15, w: 2, h: 5, tone: "top" },
      { x: 17, y: 15, w: 2, h: 5, tone: "top" },
      { x: 7, y: 25, w: 10, h: 2, tone: "topShade" },
      { x: 10, y: 16, w: 4, h: 4, tone: "topShade" },
    ],
  },
];

export const bottoms: Piece[] = [
  {
    id: "jeans",
    label: "Jeans",
    // Widths chosen so the two legs MEET: at 3 wide starting at x8 and x13 they
    // left a two-pixel gap where the body's skin showed through between them.
    rects: [
      { x: 8, y: 26, w: 8, h: 3, tone: "bottom" },
      { x: 8, y: 29, w: 4, h: 13, tone: "bottom" },
      { x: 12, y: 29, w: 4, h: 13, tone: "bottom" },
      { x: 11, y: 29, w: 2, h: 13, tone: "bottomShade" },
      { x: 8, y: 40, w: 4, h: 2, tone: "bottomShade" },
      { x: 12, y: 40, w: 4, h: 2, tone: "bottomShade" },
    ],
  },
  {
    id: "buzo",
    label: "Buzo",
    rects: [
      { x: 7, y: 26, w: 10, h: 4, tone: "bottom" },
      { x: 7, y: 30, w: 5, h: 12, tone: "bottom" },
      { x: 12, y: 30, w: 5, h: 12, tone: "bottom" },
      { x: 11, y: 30, w: 2, h: 12, tone: "bottomShade" },
      { x: 7, y: 38, w: 5, h: 2, tone: "bottomShade" },
      { x: 12, y: 38, w: 5, h: 2, tone: "bottomShade" },
    ],
  },
  {
    id: "short",
    label: "Short",
    rects: [
      { x: 8, y: 26, w: 8, h: 3, tone: "bottom" },
      { x: 8, y: 29, w: 4, h: 6, tone: "bottom" },
      { x: 12, y: 29, w: 4, h: 6, tone: "bottom" },
      { x: 11, y: 29, w: 2, h: 6, tone: "bottomShade" },
      { x: 8, y: 33, w: 4, h: 2, tone: "bottomShade" },
      { x: 12, y: 33, w: 4, h: 2, tone: "bottomShade" },
    ],
  },
];

// --- accessories: what OWNING an item puts on him -------------------------
// Keyed by the shop item id, so buying it is what equips it (src/data/items.ts).
export const wearables: Record<string, Piece> = {
  gorra: {
    id: "gorra",
    label: "Gorra",
    rects: [
      { x: 7, y: 2, w: 10, h: 3, tone: "top" },
      { x: 7, y: 5, w: 10, h: 1, tone: "topShade" },
      { x: 16, y: 4, w: 4, h: 2, tone: "top" },
      { x: 11, y: 2, w: 2, h: 1, tone: "topShade" },
    ],
  },
  chaqueta: {
    id: "chaqueta",
    label: "Chaqueta",
    rects: [
      { x: 6, y: 13, w: 12, h: 14, tone: "topShade" },
      { x: 4, y: 15, w: 3, h: 12, tone: "topShade" },
      { x: 17, y: 15, w: 3, h: 12, tone: "topShade" },
      { x: 11, y: 14, w: 2, h: 12, tone: "top" },
      { x: 6, y: 25, w: 12, h: 2, tone: "line" },
    ],
  },
  zapatillas: {
    id: "zapatillas",
    label: "Zapatillas",
    rects: [
      { x: 7, y: 42, w: 5, h: 4, tone: "shoe" },
      { x: 12, y: 42, w: 5, h: 4, tone: "shoe" },
      { x: 7, y: 45, w: 5, h: 1, tone: "line" },
      { x: 12, y: 45, w: 5, h: 1, tone: "line" },
    ],
  },
  audifonos: {
    id: "audifonos",
    label: "Audifonos",
    rects: [
      { x: 6, y: 5, w: 2, h: 4, tone: "metal" },
      { x: 16, y: 5, w: 2, h: 4, tone: "metal" },
      { x: 8, y: 2, w: 8, h: 1, tone: "metal" },
    ],
  },
  microfono: {
    id: "microfono",
    label: "Microfono",
    rects: [
      { x: 19, y: 20, w: 2, h: 5, tone: "metal" },
      { x: 19, y: 18, w: 2, h: 2, tone: "line" },
    ],
  },
};

// Shoes are always on, so bare feet never happen; buying zapatillas replaces them.
export const defaultShoes: Piece = {
  id: "zapatos",
  label: "Zapatos",
  rects: [
    { x: 8, y: 42, w: 4, h: 3, tone: "line" },
    { x: 12, y: 42, w: 4, h: 3, tone: "line" },
  ],
};

// --- colourways ------------------------------------------------------------
// `look` picks one. The name matters: this is the MC's fit, not a slider.
export const outfits: {
  id: number;
  label: string;
  top: string;
  bottom: string;
  colors: { top: string; topShade: string; bottom: string; bottomShade: string; shoe: string };
}[] = [
  {
    id: 1,
    label: "Calle",
    top: "polera",
    bottom: "jeans",
    colors: { top: "#d8dbe8", topShade: "#9aa0b8", bottom: "#33406e", bottomShade: "#232c4e", shoe: "#e4e7f2" },
  },
  {
    id: 2,
    label: "Poleron",
    top: "polerontrivio",
    bottom: "buzo",
    colors: { top: "#4a3f7a", topShade: "#332b57", bottom: "#2a2a33", bottomShade: "#1c1c22", shoe: "#c8ccd8" },
  },
  {
    id: 3,
    label: "Camisa",
    top: "camisa",
    bottom: "jeans",
    colors: { top: "#8d3a3a", topShade: "#6a2a2a", bottom: "#2f3a5e", bottomShade: "#212840", shoe: "#2b2b33" },
  },
  {
    id: 4,
    label: "Ancha",
    top: "camiseta",
    bottom: "short",
    colors: { top: "#2f6b52", topShade: "#22503c", bottom: "#d8dbe8", bottomShade: "#a3a9bd", shoe: "#e4e7f2" },
  },
];

// Hair colour follows the skin tone by default, so nobody starts out looking
// dyed; the barbershop is where that changes.
export const hairColors: { id: number; label: string; hair: string; hairShade: string }[] = [
  { id: 1, label: "Negro", hair: "#221c1c", hairShade: "#141010" },
  { id: 2, label: "Castano", hair: "#4a2f1d", hairShade: "#301d11" },
  { id: 3, label: "Rubio", hair: "#c9a24a", hairShade: "#9c7a2f" },
  { id: 4, label: "Platinado", hair: "#d8dbe8", hairShade: "#9aa0b8" },
  { id: 5, label: "Rojo", hair: "#8d3a2a", hairShade: "#6a271b" },
];
