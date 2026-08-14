// Rival roster and the crowd of each event (gauntlet 10: AI Rivals).
//
// Pure data. The rules that read it live in src/systems/BattleSystem.ts and
// every tuning number in src/data/config/BattleConfig.ts.
//
// The Bible gives each rival a personality (agresividad, humor, metrica,
// frecuencia de riesgo) plus their own flow/punchline, and lists 7 archetypes.
// Those four weights are what turn the rival's move from a coin flip into a
// legible opponent: an Agresivo keeps attacking, a Tecnico builds structures,
// and the player can learn to read them.

import type { BattleResourceId, RivalArchetype, RivalProfile, StageId } from "../core/types";

// The 7 archetypes of the Bible. `bias` nudges the resources the archetype is
// known for, on top of the personality weights (both are applied by
// BattleSystem.chooseRivalMove). Values are relative weights, not probabilities.
export const rivalArchetypes: Record<RivalArchetype, { label: string; bias: Partial<Record<BattleResourceId, number>> }> =
  {
    agresivo: { label: "Agresivo", bias: { ataque: 6, punchline: 3, defensa: -2 } },
    tecnico: { label: "Tecnico", bias: { metrica: 6, dobletempo: 4, humor: -2 } },
    humoristico: { label: "Humoristico", bias: { humor: 7, storytelling: 2, ataque: -2 } },
    callejero: { label: "Callejero", bias: { ataque: 3, storytelling: 4, improvisacion: 2 } },
    viral: { label: "Viral", bias: { punchline: 5, humor: 3, metrica: -2 } },
    veteranisimo: { label: "Veteranisimo", bias: { defensa: 5, respuesta: 4, metrica: 2 } },
    campeon: { label: "Campeon Mundial", bias: { punchline: 3, metrica: 3, dobletempo: 3, respuesta: 3 } },
  };

// One rival per stage, in stage order. Names and styles come from the roster
// the battles already used; the archetype matches each style, and flow /
// punchline are the rival's own stats (they feed their roll when they play a
// resource that leans on them).
// Three rivals per stage, not one. With a single opponent per stage the second
// battle of a stage was identical to the first: same name, same archetype, same
// reads. Three means a stage has faces, and — because rivalries persist — the one
// you humiliated last week can be the one waiting for you.
//
// Each stage mixes archetypes on purpose, so learning to read an "agresivo" pays
// off against a different agresivo later, and every stage has at least one
// opponent whose habits you have not seen.
//
// flow/punchline climb with the stage (their sum runs roughly 5 -> 20 across the
// ladder) with variation inside a stage, so the same night can be harder or
// easier depending on who turns up.
export const rivalRoster: RivalProfile[] = [
  // --- Pieza: gente del barrio, todavia sin oficio -------------------------
  {
    stage: "pieza",
    eventName: "Cypher de pieza",
    name: "Nico Cuaderno",
    style: "nervioso pero creativo",
    archetype: "callejero",
    flow: 3,
    punchline: 2,
    personality: { agresividad: 2, humor: 4, metrica: 3, frecuenciaDeRiesgo: 5 },
  },
  {
    stage: "pieza",
    eventName: "Cypher de pieza",
    name: "Tuti",
    style: "puro chiste y cero filtro",
    archetype: "humoristico",
    flow: 2,
    punchline: 3,
    personality: { agresividad: 3, humor: 8, metrica: 1, frecuenciaDeRiesgo: 6 },
  },
  {
    stage: "pieza",
    eventName: "Cypher de pieza",
    name: "El Primo",
    style: "el que rapea desde antes que tu",
    archetype: "veteranisimo",
    flow: 4,
    punchline: 2,
    personality: { agresividad: 4, humor: 3, metrica: 5, frecuenciaDeRiesgo: 2 },
  },

  // --- Plaza: ya hay publico y hay que ganarselo ---------------------------
  {
    stage: "plaza",
    eventName: "Plaza del barrio",
    name: "La Sombra",
    style: "agresivo de plaza",
    archetype: "agresivo",
    flow: 4,
    punchline: 6,
    personality: { agresividad: 8, humor: 2, metrica: 3, frecuenciaDeRiesgo: 6 },
  },
  {
    stage: "plaza",
    eventName: "Plaza del barrio",
    name: "Yeri Cruda",
    style: "cuenta historias que duelen",
    archetype: "callejero",
    flow: 6,
    punchline: 4,
    personality: { agresividad: 5, humor: 4, metrica: 4, frecuenciaDeRiesgo: 4 },
  },
  {
    stage: "plaza",
    eventName: "Plaza del barrio",
    name: "Dos Tiempos",
    style: "se le nota el metronomo",
    archetype: "tecnico",
    flow: 5,
    punchline: 4,
    personality: { agresividad: 3, humor: 2, metrica: 8, frecuenciaDeRiesgo: 3 },
  },

  // --- Regional: oficio de verdad -----------------------------------------
  {
    stage: "regional",
    eventName: "Regional Sur",
    name: "Killa Metro",
    style: "tecnico y frio",
    archetype: "tecnico",
    flow: 7,
    punchline: 5,
    personality: { agresividad: 4, humor: 2, metrica: 9, frecuenciaDeRiesgo: 3 },
  },
  {
    stage: "regional",
    eventName: "Regional Sur",
    name: "Clip",
    style: "vive de los cortes que se hacen virales",
    archetype: "viral",
    flow: 5,
    punchline: 8,
    personality: { agresividad: 6, humor: 6, metrica: 3, frecuenciaDeRiesgo: 8 },
  },
  {
    stage: "regional",
    eventName: "Regional Sur",
    name: "Don Cassette",
    style: "veinte anios arriba de la tarima",
    archetype: "veteranisimo",
    flow: 6,
    punchline: 6,
    personality: { agresividad: 5, humor: 4, metrica: 7, frecuenciaDeRiesgo: 2 },
  },

  // --- Nacional: camaras, contratos y gente que decide por ti --------------
  {
    stage: "nacional",
    eventName: "Liga Nacional",
    name: "Rima Royal",
    style: "campeon defensor",
    archetype: "campeon",
    flow: 8,
    punchline: 8,
    personality: { agresividad: 6, humor: 4, metrica: 7, frecuenciaDeRiesgo: 5 },
  },
  {
    stage: "nacional",
    eventName: "Liga Nacional",
    name: "Bruta",
    style: "entra a matar en la primera",
    archetype: "agresivo",
    flow: 7,
    punchline: 9,
    personality: { agresividad: 9, humor: 2, metrica: 4, frecuenciaDeRiesgo: 7 },
  },
  {
    stage: "nacional",
    eventName: "Liga Nacional",
    name: "Santo",
    style: "el publico lo quiere antes de que abra la boca",
    archetype: "viral",
    flow: 9,
    punchline: 7,
    personality: { agresividad: 4, humor: 7, metrica: 5, frecuenciaDeRiesgo: 7 },
  },

  // --- Internacional: otro idioma, mismo oficio ----------------------------
  {
    stage: "internacional",
    eventName: "Circuito Mundial",
    name: "Nova X",
    style: "estilo internacional",
    archetype: "viral",
    flow: 9,
    punchline: 7,
    personality: { agresividad: 5, humor: 6, metrica: 6, frecuenciaDeRiesgo: 7 },
  },
  {
    stage: "internacional",
    eventName: "Circuito Mundial",
    name: "Kaiser",
    style: "estructura de relojero",
    archetype: "tecnico",
    flow: 8,
    punchline: 8,
    personality: { agresividad: 5, humor: 3, metrica: 9, frecuenciaDeRiesgo: 4 },
  },
  {
    stage: "internacional",
    eventName: "Circuito Mundial",
    name: "Mala Fama",
    style: "viene precedido por lo que dicen de el",
    archetype: "agresivo",
    flow: 7,
    punchline: 9,
    personality: { agresividad: 9, humor: 3, metrica: 5, frecuenciaDeRiesgo: 8 },
  },

  // --- Estrella: festivales, giras y egos ---------------------------------
  {
    stage: "estrella",
    eventName: "Festival",
    name: "Icono",
    style: "estrella global",
    archetype: "campeon",
    flow: 9,
    punchline: 9,
    personality: { agresividad: 6, humor: 5, metrica: 8, frecuenciaDeRiesgo: 6 },
  },
  {
    stage: "estrella",
    eventName: "Festival",
    name: "Vitrina",
    style: "mas marca que MC, y aun asi gana",
    archetype: "viral",
    flow: 8,
    punchline: 10,
    personality: { agresividad: 5, humor: 8, metrica: 5, frecuenciaDeRiesgo: 8 },
  },
  {
    stage: "estrella",
    eventName: "Festival",
    name: "La Maestra",
    style: "le ensenio a media escena",
    archetype: "veteranisimo",
    flow: 10,
    punchline: 8,
    personality: { agresividad: 5, humor: 5, metrica: 9, frecuenciaDeRiesgo: 3 },
  },

  // --- Leyenda: los que ya no tienen nada que probar ----------------------
  {
    stage: "leyenda",
    eventName: "Leyendas",
    name: "Fenix",
    style: "leyenda viva",
    archetype: "campeon",
    flow: 10,
    punchline: 10,
    personality: { agresividad: 7, humor: 5, metrica: 8, frecuenciaDeRiesgo: 6 },
  },
  {
    stage: "leyenda",
    eventName: "Leyendas",
    name: "El Ultimo",
    style: "no pierde desde antes que nacieras",
    archetype: "veteranisimo",
    flow: 10,
    punchline: 9,
    personality: { agresividad: 6, humor: 4, metrica: 10, frecuenciaDeRiesgo: 4 },
  },
  {
    stage: "leyenda",
    eventName: "Leyendas",
    name: "Cronica",
    style: "cada ronda suya es un cuento que ya sabias",
    archetype: "callejero",
    flow: 9,
    punchline: 10,
    personality: { agresividad: 6, humor: 6, metrica: 7, frecuenciaDeRiesgo: 5 },
  },
];


// What each event's crowd rewards and what leaves it cold (Bible: "publico /
// jueces que valoran distinto segun el evento"). `loves` multiplies the hype a
// won round awards, `colds` shaves it — a plaza wants blood, a national final
// wants craft. `line` is the honest one-liner the battle screen shows so the
// player can play to the room instead of guessing.
export interface CrowdTaste {
  loves: BattleResourceId[];
  colds: BattleResourceId[];
  line: string;
}

export const crowdByStage: Record<StageId, CrowdTaste> = {
  pieza: {
    loves: ["improvisacion", "humor"],
    colds: ["metrica"],
    line: "Cuatro amigos en la pieza: quieren chispa, no tecnica.",
  },
  plaza: {
    loves: ["ataque", "punchline"],
    colds: ["defensa"],
    line: "La plaza pide sangre: premia el ataque y el remate.",
  },
  regional: {
    loves: ["metrica", "dobletempo"],
    colds: ["humor"],
    line: "Jurado regional: mide estructura y doble tempo.",
  },
  nacional: {
    loves: ["punchline", "storytelling"],
    colds: ["improvisacion"],
    line: "Final nacional: se recuerda el remate y la historia.",
  },
  internacional: {
    loves: ["dobletempo", "flow"],
    colds: ["defensa"],
    line: "Publico internacional: se rinde ante el flow y la velocidad.",
  },
  estrella: {
    loves: ["storytelling", "respuesta"],
    colds: ["humor"],
    line: "Festival: quieren historia y respuesta fina.",
  },
  leyenda: {
    loves: ["respuesta", "punchline", "metrica"],
    colds: [],
    line: "Arena de leyendas: aqui todo cuenta y nada se perdona.",
  },
};
