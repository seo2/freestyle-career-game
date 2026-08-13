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
export const rivalRoster: RivalProfile[] = [
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
    stage: "regional",
    eventName: "Regional Sur",
    name: "Killa Metro",
    style: "tecnico y frio",
    archetype: "tecnico",
    flow: 7,
    punchline: 5,
    personality: { agresividad: 3, humor: 1, metrica: 9, frecuenciaDeRiesgo: 3 },
  },
  {
    stage: "nacional",
    eventName: "Final Nacional",
    name: "Rima Royal",
    style: "completo y mediatico",
    archetype: "viral",
    flow: 8,
    punchline: 8,
    personality: { agresividad: 5, humor: 6, metrica: 5, frecuenciaDeRiesgo: 5 },
  },
  {
    stage: "internacional",
    eventName: "Mundial Underground",
    name: "Nova X",
    style: "veloz e impredecible",
    archetype: "humoristico",
    flow: 9,
    punchline: 7,
    personality: { agresividad: 4, humor: 8, metrica: 6, frecuenciaDeRiesgo: 9 },
  },
  {
    stage: "estrella",
    eventName: "Festival Leyenda",
    name: "Icono",
    style: "leyenda con publico propio",
    archetype: "veteranisimo",
    flow: 9,
    punchline: 9,
    personality: { agresividad: 5, humor: 5, metrica: 8, frecuenciaDeRiesgo: 3 },
  },
  {
    stage: "leyenda",
    eventName: "Arena de Leyendas",
    name: "Fenix",
    style: "campeon mundial defendiendo su corona",
    archetype: "campeon",
    flow: 10,
    punchline: 10,
    personality: { agresividad: 7, humor: 6, metrica: 9, frecuenciaDeRiesgo: 6 },
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
