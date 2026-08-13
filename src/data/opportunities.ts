// Scheduled opportunities (Fase 6): the offers that land on a specific day of
// the week and are gone if you do not take them.
//
// This is what makes a week irrepeatable. A normal action is always there; an
// opportunity has a date, a price in energy and blocks, and a deadline — so the
// week you get an interview on Wednesday is not the same week as any other.
//
// Pure data. The rules that roll, schedule and expire them live in
// src/systems/OpportunitySystem.ts and every tuning number in
// src/data/config/OpportunityConfig.ts.

import type { StageId } from "../core/types";

export interface OpportunityDef {
  id: string;
  label: string;
  // What the player is being offered, in their own words.
  detail: string;
  // Earliest stage this offer can appear at, so a nobody is not invited to a
  // festival in week one.
  minStage: StageId;
  energyCost: number;
  blocks: number;
  // What taking it pays. Anything omitted is simply not part of the offer.
  cash?: number;
  fans?: number;
  respect?: number;
  fame?: number;
  xp?: number;
  // Momentum swing: some offers are a grind, others light you up.
  momentum: number;
  // The line the summary and the event log use when you take it.
  takenMessage: string;
  // ...and when the day passes without you.
  missedMessage: string;
}

export const opportunities: OpportunityDef[] = [
  {
    id: "entrevista-radio",
    label: "Entrevista en la radio",
    detail: "Una radio del barrio te da diez minutos al aire.",
    minStage: "pieza",
    energyCost: 12,
    blocks: 1,
    fans: 40,
    respect: 4,
    fame: 6,
    xp: 25,
    momentum: 10,
    takenMessage: "Fuiste a la radio: te escucharon en todo el barrio.",
    missedMessage: "Se te paso la entrevista en la radio.",
  },
  {
    id: "cypher-sorpresa",
    label: "Cypher sorpresa",
    detail: "Se armo un cypher en la esquina y te llamaron.",
    minStage: "pieza",
    energyCost: 18,
    blocks: 1,
    respect: 8,
    fans: 25,
    xp: 30,
    momentum: 14,
    takenMessage: "Caiste al cypher y te respetaron.",
    missedMessage: "El cypher se armo sin ti.",
  },
  {
    id: "pega-de-fin-de-semana",
    label: "Pega extra",
    detail: "Un conocido necesita manos por un dia y paga al toque.",
    minStage: "pieza",
    energyCost: 26,
    blocks: 2,
    cash: 120,
    xp: 12,
    momentum: -6,
    takenMessage: "Trabajaste la pega extra: plata en el bolsillo, poco flow.",
    missedMessage: "La pega extra se la dieron a otro.",
  },
  {
    id: "videoclip-crew",
    label: "Videoclip de la crew",
    detail: "La crew graba un video y te quiere en el tema.",
    minStage: "plaza",
    energyCost: 22,
    blocks: 2,
    fans: 180,
    fame: 20,
    respect: 6,
    xp: 45,
    momentum: 12,
    takenMessage: "Grabaste el videoclip con la crew: te vieron nuevas caras.",
    missedMessage: "El videoclip de la crew salio sin ti.",
  },
  {
    id: "sponsor-local",
    label: "Sponsor local",
    detail: "Una tienda de zapatillas quiere tu cara por una semana.",
    minStage: "plaza",
    energyCost: 10,
    blocks: 1,
    cash: 220,
    fans: 60,
    respect: -4,
    fame: 14,
    xp: 15,
    momentum: 4,
    takenMessage: "Firmaste con el sponsor: buena plata, algunos te miran raro.",
    missedMessage: "El sponsor local eligio a otro.",
  },
  {
    id: "entrevista-podcast",
    label: "Podcast grande",
    detail: "Un podcast con publico te invita a hablar de tu carrera.",
    minStage: "regional",
    energyCost: 16,
    blocks: 2,
    fans: 520,
    fame: 45,
    respect: 10,
    xp: 70,
    momentum: 10,
    takenMessage: "Fuiste al podcast: te conocio gente que no te conocia.",
    missedMessage: "El podcast grabo sin ti.",
  },
  {
    id: "colaboracion",
    label: "Colaboracion",
    detail: "Un MC con nombre te ofrece un tema a medias.",
    minStage: "regional",
    energyCost: 28,
    blocks: 2,
    fans: 400,
    respect: 18,
    fame: 30,
    xp: 90,
    momentum: 16,
    takenMessage: "Sacaste el tema en colaboracion: quedo sonando.",
    missedMessage: "La colaboracion no te espero.",
  },
];
