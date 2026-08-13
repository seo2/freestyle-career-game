// Bonds and rivalry flavour (Fase 7). Pure data; the rules that read it live in
// src/systems/RelationshipSystem.ts and every number in
// src/data/config/RelationshipConfig.ts.
//
// The Bible lists eight relationships (familia, crew, productores, managers,
// sellos, marcas, fans, rivales). Fans already exist as a resource and the
// industry ones need contracts to mean anything, so this is the basic pair the
// plan asks for: the two people who are there before anyone knows your name.

import type { BondId, IdentityAxis } from "../core/types";

export interface BondDef {
  id: BondId;
  label: string;
  // What the stats screen says the bond IS, in one line.
  blurb: string;
  // Where it starts. Family is already there when the career begins; the crew is
  // something you build, so it starts lower.
  start: number;
  // Actions that count as showing up, and how much each is worth. An action not
  // listed here does nothing for this bond — which is the cost of a busy week.
  fedBy: Partial<Record<string, number>>;
  // The identity axis that pulls this bond along: choosing the crew in a dilemma
  // should warm the crew, not just move a slider.
  axis?: { axis: IdentityAxis; towards: "low" | "high"; weight: number };
  // How the bond reads at each temperature.
  warmLine: string;
  coldLine: string;
}

export const bondDefs: BondDef[] = [
  {
    id: "familia",
    label: "Familia",
    blurb: "La casa donde llegas a dormir.",
    start: 62,
    // Resting is the only thing that happens at home, and that is the point:
    // the week where you never rest is the week nobody sees you.
    fedBy: { rest: 11 },
    warmLine: "En la casa te esperan despierta.",
    coldLine: "En la casa ya no preguntan como te fue.",
  },
  {
    id: "crew",
    label: "Crew",
    blurb: "Los que rapean contigo cuando nadie mira.",
    start: 40,
    // The cypher is training AND it is the crew: that is where the bond lives.
    // Posting counts for less — it is talking to everyone, not to them.
    fedBy: { cypher: 13, social: 4 },
    axis: { axis: "soloCrew", towards: "high", weight: 0.35 },
    warmLine: "Tu crew llega antes que tu a cada fecha.",
    coldLine: "Tu crew dejo de avisarte de las fechas.",
  },
];

// What the battle intro says about a rival who remembers you. Ordered from the
// hottest grudge down; the first whose `from` the heat clears is the one read.
export const rivalryLines: { from: number; line: string }[] = [
  { from: 75, line: "Te odia. Vino a cobrar." },
  { from: 50, line: "Viene por la revancha." },
  { from: 20, line: "Te tiene ganas." },
];
