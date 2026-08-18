// How the creator GROUPS the avatar system's categories (spec §57).
//
// This file is the clearest example of §79's Golden Rule: grouping is a UI opinion,
// so it lives in the creator and not in the system. The registry has 19 categories;
// the design's left rail shows 12 panels. Neither is wrong — they answer different
// questions, and keeping them apart means re-organising the creator never touches
// an asset.

import type { Category, ColorToken } from "../types";

export interface Panel {
  n: string;
  label: string;
  hint: string;
  // Registry categories this panel edits, in the order the option grid lists them.
  categories: Category[];
  // The palette shown above the options, if this panel recolours anything.
  palette?: { token: ColorToken; label: string };
  // Slots the player may empty. Appearance slots are absent on purpose: an avatar
  // with no eyes is not a look.
  clearable?: Category[];
}

export const panels: readonly Panel[] = [
  {
    n: "01",
    label: "Cuerpo y piel",
    hint: "Complexion y tono. Todo gratis: el parecido fisico nunca se cobra.",
    categories: ["body", "skin"],
    palette: { token: "skin_primary", label: "TONO DE PIEL" },
  },
  {
    n: "02",
    label: "Rostro",
    hint: "La estructura de la cara. Es la palanca que mas cambia el parecido.",
    categories: ["face"],
  },
  {
    n: "03",
    label: "Mirada",
    hint: "Ojos y cejas. Juntos dan la actitud antes que cualquier prenda.",
    categories: ["eyes", "eyebrows"],
  },
  {
    n: "04",
    label: "Rasgos",
    hint: "Nariz y boca. La boca rapeando se usa en batalla.",
    categories: ["nose", "mouth"],
  },
  {
    n: "05",
    label: "Pelo y barba",
    hint: "Cortes de barrio gratis; el tinte y los estilos de estilista llegan con la fama.",
    categories: ["hair", "facial_hair"],
    palette: { token: "hair_primary", label: "COLOR DE PELO" },
    clearable: ["hair", "facial_hair"],
  },
  {
    n: "06",
    label: "Ropa superior",
    hint: "Empiezas con lo que hay en la pieza. Las marcas se compran o se ganan.",
    categories: ["top", "jacket"],
    palette: { token: "fabric_primary", label: "COLOR DE PRENDA" },
    clearable: ["jacket"],
  },
  {
    n: "07",
    label: "Pantalones",
    hint: "El corte cambia la silueta completa del avatar.",
    categories: ["bottom"],
    palette: { token: "fabric_primary", label: "COLOR DE PRENDA" },
  },
  {
    n: "08",
    label: "Zapatillas",
    hint: "La pieza mas mirada del juego. Tambien la mas cara.",
    categories: ["shoes"],
    palette: { token: "fabric_primary", label: "COLOR DE ZAPATILLA" },
  },
  {
    n: "09",
    label: "Gorros",
    hint: "Cambia la lectura del personaje mas rapido que cualquier otra capa.",
    categories: ["hat"],
    palette: { token: "fabric_primary", label: "COLOR" },
    clearable: ["hat"],
  },
  {
    n: "10",
    label: "Lentes",
    hint: "Se ven en cada primer plano. Sacartelos deja la cara al aire, no un hueco.",
    categories: ["glasses"],
    clearable: ["glasses"],
  },
  {
    n: "11",
    label: "Joyas",
    hint: "El termometro de estatus. Nada de esto existe al empezar.",
    categories: ["jewelry", "piercing"],
    palette: { token: "metal_primary", label: "METAL" },
    clearable: ["jewelry", "piercing"],
  },
  {
    n: "12",
    label: "Tatuajes y props",
    hint: "Se acumulan con la carrera. Los del rostro solo cuando ya eres alguien.",
    categories: ["tattoo", "prop"],
    clearable: ["tattoo", "prop"],
  },
];
