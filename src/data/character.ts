// The MC's palette: what each of his layers is coloured with (Fase 10).
//
// The art itself lives in public/assets/characters/layers/ — slices of the
// original sprite, cut by scripts/build-character-layers.mjs. This file holds the
// COLOURS those slices get repainted with, and nothing else.
//
// Why ramps and not single colours: the sprite is shaded, and shading is what
// makes a round head look round. A layer is recoloured by remapping its own
// luminance onto four values, so the drawing survives and only the hue moves
// (src/ui/characterDraw.ts). One colour per garment would flatten him into a
// cut-out, which is exactly how the three earlier procedural attempts read.
//
// Order inside a ramp is dark to light. The outline is shared and lives here too:
// it belongs to the drawing, not to the shirt, and letting a garment's ramp reach
// it is what put a red halo around the cap on the first attempt.

// Four values, dark to light. Not five: the fifth stop is the shared outline.
export type Ramp = readonly [string, string, string, string];

// Near-black with a hint of the night palette, so the figure is not cut out of
// the screen. Every layer's darkest stop resolves to this.
export const OUTLINE = "#050410";

// --- skin ------------------------------------------------------------------
// Sampled off the Crear MC mockup's swatch strip, which is where the player picks
// them, then extended into four-value ramps against the sprite's own shading.
// Tone 2 IS the source sprite's skin, so a default MC is the original render.
export const skinTones: { id: number; label: string; ramp: Ramp }[] = [
  { id: 1, label: "Claro", ramp: ["#3a1d10", "#9c6641", "#d29a69", "#f4d3b0"] },
  { id: 2, label: "Trigueno", ramp: ["#180e16", "#7e441f", "#b26a36", "#f0d2b8"] },
  { id: 3, label: "Moreno", ramp: ["#22110a", "#653517", "#93522a", "#c99764"] },
  { id: 4, label: "Oscuro", ramp: ["#170b06", "#48250f", "#6d3c1d", "#9c6a42"] },
  { id: 5, label: "Muy oscuro", ramp: ["#100704", "#301907", "#4d2a13", "#71472b"] },
];

// --- hair ------------------------------------------------------------------
// What the barbershop dyes. The hair layer is the rival's drawn quiff scaled to
// the MC's skull, so these ramps repaint real hair rather than tint a shape.
export const hairColors: { id: number; label: string; ramp: Ramp }[] = [
  { id: 1, label: "Negro", ramp: ["#0b0910", "#1b1822", "#2b2634", "#4a4356"] },
  { id: 2, label: "Castano", ramp: ["#34160d", "#4a1e0f", "#532614", "#a07559"] },
  { id: 3, label: "Rubio", ramp: ["#3a2405", "#7d5510", "#b98a22", "#e6c45c"] },
  { id: 4, label: "Platinado", ramp: ["#2c2f3c", "#6d7386", "#a8aebd", "#e4e8f2"] },
  { id: 5, label: "Rojo", ramp: ["#2a0d07", "#66220f", "#9b3a1c", "#cf6a3c"] },
];

// --- what is on his head ---------------------------------------------------
// Two options, because there are two pieces of drawn art: the sprite's own cap and
// the transplanted hair. Six invented haircuts on one dome is the fake variety the
// owner rejected; more cuts are listed as pending in docs/ASSETS.md.
export const headStyles: { id: string; label: string; capped: boolean }[] = [
  { id: "gorra", label: "Con gorra", capped: true },
  { id: "suelto", label: "Al aire", capped: false },
];

// --- what is on his eyes ---------------------------------------------------
// Also two, and also both drawn: the MC's shades, or the rival's open eyes fitted
// to the MC's lens band. Hiding the shades used to leave a face with no eyes,
// because the eyes are painted ON the lenses in the source sprite.
export const eyeStyles: { id: string; label: string; shades: boolean }[] = [
  { id: "lentes", label: "Lentes oscuros", shades: true },
  { id: "descubierto", label: "A cara pelada", shades: false },
];

// --- colourways ------------------------------------------------------------
// `look` picks one. The name matters: this is the MC's fit, not a slider.
export interface Outfit {
  id: number;
  label: string;
  top: Ramp;
  print: Ramp;
  bottom: Ramp;
  shoes: Ramp;
  cap: Ramp;
}

export const outfits: Outfit[] = [
  {
    // The source sprite's own fit, ramp for ramp: black tee with a white print,
    // bright blue shorts, white sneakers, red cap. Keeping it as look 1 is what
    // makes the modular MC read as the same character and not a replacement.
    id: 1,
    label: "Clasica",
    top: ["#06060b", "#0f0f10", "#161515", "#344358"],
    print: ["#616060", "#a6a5a5", "#d7d7d7", "#fcfcfc"],
    bottom: ["#02183f", "#003c93", "#005ecb", "#0074e3"],
    shoes: ["#040409", "#1c1b24", "#949392", "#f5f5f4"],
    cap: ["#2a0522", "#ac080b", "#d41719", "#f9e0df"],
  },
  {
    id: 2,
    label: "Poleron",
    top: ["#1b1636", "#332b57", "#4a3f7a", "#8f7fd0"],
    print: ["#5a4e2a", "#9a8746", "#cbb469", "#f0e0a8"],
    bottom: ["#131318", "#22222a", "#33333d", "#5a5a68"],
    shoes: ["#0f0f14", "#3a3a44", "#8f95a6", "#d8dbe8"],
    cap: ["#141026", "#2a2350", "#4a3f7a", "#b9a6f0"],
  },
  {
    id: 3,
    label: "Camisa",
    top: ["#3a1414", "#6a2a2a", "#8d3a3a", "#c98070"],
    print: ["#4a4438", "#8a8270", "#c4bda6", "#f2ecd8"],
    bottom: ["#151a2c", "#212840", "#2f3a5e", "#54648f"],
    shoes: ["#0c0c10", "#1a1a20", "#3a3a44", "#6e6e7c"],
    cap: ["#1c1210", "#4a2a20", "#7a4636", "#c08a68"],
  },
  {
    id: 4,
    label: "Ancha",
    top: ["#10382a", "#22503c", "#2f6b52", "#6fbf96"],
    print: ["#3c5a4a", "#7aa08c", "#b4d8c4", "#eafaf0"],
    bottom: ["#5c6070", "#8a90a4", "#b8bece", "#e8ebf4"],
    shoes: ["#12120f", "#4a4326", "#8a7c40", "#e0d488"],
    cap: ["#2c2a10", "#6a6420", "#a89a30", "#e8dc78"],
  },
];

// The visor and the glasses do not follow the fit: the visor is black on every cap
// the game draws, and glass is glass. Fixed ramps, so a green outfit cannot dye
// them green.
export const brimRamp: Ramp = ["#010000", "#060505", "#11100f", "#432713"];
export const glassRamp: Ramp = ["#141210", "#565554", "#a3a3a2", "#efefef"];
// Open eyes keep the colour they were drawn with: lash, iris, sclera, glint. Under
// the glass ramp they came out grey, and a grey eye reads as a blind one.
export const eyeRamp: Ramp = ["#101c14", "#36684a", "#c3c7c0", "#f9f7f5"];

export function skinRamp(id: number): Ramp {
  return (skinTones.find((tone) => tone.id === id) ?? skinTones[0]).ramp;
}

export function hairRamp(id: number): Ramp {
  return (hairColors.find((entry) => entry.id === id) ?? hairColors[0]).ramp;
}

export function outfitOf(id: number): Outfit {
  return outfits.find((entry) => entry.id === id) ?? outfits[0];
}
