import type { StageDef } from "../core/types";

export const stages: StageDef[] = [
  {
    id: "pieza",
    title: "Pieza",
    place: "Pieza / cypher con amigos",
    nextHint: "Nivel 5, 140 fans y 45 de respeto para salir a la plaza.",
    minLevel: 1,
    minFans: 0,
    minRespect: 0,
    minFame: 0,
  },
  {
    // Plaza is the first arc's gate, so it is tuned to the closing criterion in
    // docs/PLAN.md: about five in-game weeks, which is what it takes for three
    // dilemmas to land (they cap at one per week and none fire in week 1). The
    // old gate — level 2 and 8 respect — was cleared by a single Saturday
    // battle, so a run reached Plaza in week 1 and the epilogue read "Sin
    // definir" because the player had not decided anything yet.
    id: "plaza",
    title: "Plaza",
    place: "Competencias de plaza",
    nextHint: "Nivel 9, 600 fans y 120 de respeto abren el regional.",
    minLevel: 5,
    minFans: 140,
    minRespect: 45,
    minFame: 0,
  },
  {
    id: "regional",
    title: "Regional",
    place: "Escenarios regionales",
    nextHint: "Nivel 13, 2000 fans y 300 de fama abren lo nacional.",
    minLevel: 9,
    minFans: 600,
    minRespect: 120,
    minFame: 40,
  },
  {
    id: "nacional",
    title: "Nacional",
    place: "Liga nacional",
    nextHint: "Nivel 17, 6000 fans y 1200 de fama abren lo internacional.",
    minLevel: 13,
    minFans: 2000,
    minRespect: 220,
    minFame: 300,
  },
  {
    id: "internacional",
    title: "Internacional",
    place: "Circuito mundial",
    nextHint: "Nivel 22, 15000 fans y 4000 de fama abren el estrellato.",
    minLevel: 17,
    minFans: 6000,
    minRespect: 400,
    minFame: 1200,
  },
  {
    id: "estrella",
    title: "Estrella",
    place: "Festivales y giras",
    nextHint: "Nivel 28, 40000 fans y 12000 de fama abren la leyenda.",
    minLevel: 22,
    minFans: 15000,
    minRespect: 700,
    minFame: 4000,
  },
  {
    id: "leyenda",
    title: "Leyenda",
    place: "Legado mundial",
    nextHint: "Construye legado, crew y sello propio.",
    minLevel: 28,
    minFans: 40000,
    minRespect: 1200,
    minFame: 12000,
  },
];
