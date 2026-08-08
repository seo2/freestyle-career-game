// Store catalogue (mockup "9. TIENDA": tabs EQUIPO/ROPA/BEATS/OTROS, rows with
// icon + name + price, right panel with preview + effect line).
//
// Balance note: stats live on a 1..99 scale (ProgressionConfig.statBounds), so
// the mockup's "+15 a PUNCHLINE" reads as a small real grant (+2). Every number
// lives here — StoreSystem only applies what an item declares.
//
// `grants` feeds the internal upgrade backbone: outfit/studio/home levels keep
// driving maxEnergy, recordCost, battle presence and the action formulas, and
// items are how the player raises them now.

import type { StatKey } from "../core/types";

export type ItemCategory = "equipo" | "ropa" | "beats" | "otros";

export interface ItemGrants {
  outfit?: number;
  studio?: number;
  home?: number;
  stat?: { key: StatKey; amount: number };
}

export interface ItemDef {
  id: string;
  label: string;
  category: ItemCategory;
  price: number;
  description: string;
  // Human one-liner shown in the preview panel ("+2 a Punchline").
  effectLabel: string;
  grants: ItemGrants;
}

// Tab order in the mockup.
export const itemCategories: readonly ItemCategory[] = ["equipo", "ropa", "beats", "otros"];

export const itemCategoryLabels: Record<ItemCategory, string> = {
  equipo: "Equipo",
  ropa: "Ropa",
  beats: "Beats",
  otros: "Otros",
};

export const storeItems: ItemDef[] = [
  // --- EQUIPO (mockup labels and prices, verbatim) ---------------------------
  {
    id: "microfono",
    label: "Microfono",
    category: "equipo",
    price: 150,
    description: "Mejora la calidad de tus grabaciones.",
    effectLabel: "+2 a Punchline",
    grants: { studio: 1, stat: { key: "punchline", amount: 2 } },
  },
  {
    id: "audifonos",
    label: "Audifonos",
    category: "equipo",
    price: 90,
    description: "Te aislan del ruido y te afinan el oido.",
    effectLabel: "+2 a Metrica",
    grants: { stat: { key: "metrica", amount: 2 } },
  },
  {
    id: "interfaz",
    label: "Interfaz",
    category: "equipo",
    price: 200,
    description: "Grabas en la pieza como en un estudio.",
    effectLabel: "+3 a Flow",
    grants: { studio: 1, stat: { key: "flow", amount: 3 } },
  },
  {
    id: "monitores",
    label: "Monitores",
    category: "equipo",
    price: 180,
    description: "Escuchas cada detalle de tu mezcla.",
    effectLabel: "+2 a Flow",
    grants: { studio: 1, stat: { key: "flow", amount: 2 } },
  },

  // --- ROPA -----------------------------------------------------------------
  {
    id: "gorra",
    label: "Gorra roja",
    category: "ropa",
    price: 70,
    description: "El sello visual que la gente te reconoce.",
    effectLabel: "+2 a Escena",
    grants: { outfit: 1, stat: { key: "escena", amount: 2 } },
  },
  {
    id: "zapatillas",
    label: "Zapatillas nuevas",
    category: "ropa",
    price: 120,
    description: "Pisas la plaza con otra actitud.",
    effectLabel: "+2 a Carisma",
    grants: { outfit: 1, stat: { key: "carisma", amount: 2 } },
  },
  {
    id: "chaqueta",
    label: "Chaqueta de tarima",
    category: "ropa",
    price: 160,
    description: "Presencia de escenario en cualquier ronda.",
    effectLabel: "+3 a Escena",
    grants: { outfit: 1, stat: { key: "escena", amount: 3 } },
  },

  // --- BEATS ----------------------------------------------------------------
  {
    id: "beat-boombap",
    label: "Beat boom bap",
    category: "beats",
    price: 80,
    description: "Un clasico para calentar la lengua.",
    effectLabel: "+2 a Flow",
    grants: { stat: { key: "flow", amount: 2 } },
  },
  {
    id: "beat-trap",
    label: "Beat trap",
    category: "beats",
    price: 110,
    description: "Cambios de tiempo para lucir tecnica.",
    effectLabel: "+2 a Impro",
    grants: { stat: { key: "improvisacion", amount: 2 } },
  },
  {
    id: "pack-acapella",
    label: "Pack acapella",
    category: "beats",
    price: 140,
    description: "Entrenas sin red: solo tu voz y el silencio.",
    effectLabel: "+3 a Impro",
    grants: { stat: { key: "improvisacion", amount: 3 } },
  },

  // --- OTROS ----------------------------------------------------------------
  {
    id: "cuaderno",
    label: "Cuaderno de rimas",
    category: "otros",
    price: 60,
    description: "Anotas cada idea antes de que se escape.",
    effectLabel: "+2 a Punchline",
    grants: { stat: { key: "punchline", amount: 2 } },
  },
  {
    id: "mesa",
    label: "Mesa para escribir",
    category: "otros",
    price: 130,
    description: "Un rincon fijo en la pieza para trabajar letras.",
    effectLabel: "+2 a Disciplina",
    grants: { home: 1, stat: { key: "disciplina", amount: 2 } },
  },
  {
    id: "colchon",
    label: "Colchon decente",
    category: "otros",
    price: 150,
    description: "Duermes de verdad y aguantas la semana completa.",
    effectLabel: "+1 a Disciplina",
    grants: { home: 1, stat: { key: "disciplina", amount: 1 } },
  },
];
