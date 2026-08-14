// Battle content data (gauntlet 9): the Bible's 10 resources and 10 stimuli.
// Pure data — rules that consume it live in src/systems/BattleSystem.ts and
// every tuning number in src/data/config/BattleConfig.ts.

import type { BattleResource, BattleResourceId, BattleStimulus } from "../core/types";

// The 10 battle resources, in Bible order. `stats` feed the roll (averaged so
// multi-stat resources stay comparable), `baseHype` is the card's win hype —
// mockup values where the mockup shows them (Punchline +15, Respuesta +10,
// Humor +8, Ataque +12, Metrica +8), coherent siblings for the rest.
export const battleResources: BattleResource[] = [
  {
    id: "punchline",
    label: "Punchline",
    detail: "Busca el remate mas fuerte.",
    stats: ["punchline"],
    baseHype: 15,
  },
  {
    id: "flow",
    label: "Flow",
    detail: "Gana al publico con ritmo.",
    stats: ["flow"],
    baseHype: 9,
  },
  {
    id: "humor",
    label: "Humor",
    detail: "Desarma la tension con gracia.",
    stats: ["carisma"],
    baseHype: 8,
  },
  {
    id: "ataque",
    label: "Ataque",
    detail: "Presiona directo al rival.",
    stats: ["punchline", "escena"],
    baseHype: 12,
  },
  {
    id: "defensa",
    label: "Defensa",
    detail: "Aguanta el golpe sin perder pie.",
    stats: ["disciplina", "escena"],
    baseHype: 8,
  },
  {
    id: "metrica",
    label: "Metrica",
    detail: "Juega con estructuras y multis.",
    stats: ["metrica"],
    baseHype: 8,
  },
  {
    id: "dobletempo",
    label: "Doble Tempo",
    detail: "Acelera el beat al doble.",
    stats: ["flow", "metrica"],
    baseHype: 11,
  },
  {
    id: "respuesta",
    label: "Respuesta",
    detail: "Castiga el ataque del rival.",
    stats: ["improvisacion"],
    baseHype: 10,
  },
  {
    id: "storytelling",
    label: "Storytelling",
    detail: "Cuenta una historia que pega.",
    stats: ["metrica", "carisma"],
    baseHype: 9,
  },
  {
    id: "improvisacion",
    label: "Improvisacion",
    detail: "Usa lo que hay en la tarima.",
    stats: ["improvisacion", "flow"],
    baseHype: 10,
  },
];

const resourceIndex = new Map(battleResources.map((resource) => [resource.id, resource]));

// Safe lookup for the closed BattleResourceId union (throwing keeps a typo in
// data or a stale save id loud instead of silently wrong).
export function resourceById(id: BattleResourceId): BattleResource {
  const found = resourceIndex.get(id);
  if (!found) throw new Error(`unknown battle resource: ${id}`);
  return found;
}

// The 10 stimuli of the Bible. `label` is the big keyword of the round card;
// `text` the flavor sentence (event copy); `best` the resources the crowd
// rewards on that stimulus (stimulus bonus in BattleSystem).
export const battleStimuli: BattleStimulus[] = [
  {
    id: "barrio",
    label: "Barrio",
    text: "El estimulo apunta a tu barrio y tus calles.",
    best: ["storytelling", "ataque"],
  },
  {
    id: "familia",
    label: "Familia",
    text: "Sale la familia al medio: tocan lo personal.",
    best: ["storytelling", "humor"],
  },
  {
    id: "escuela",
    label: "Escuela",
    text: "Recuerdan tus notas y tus dias de escuela.",
    best: ["humor", "metrica"],
  },
  {
    id: "dinero",
    label: "Dinero",
    text: "El tema es plata: quien la tiene y quien no.",
    best: ["punchline", "ataque"],
  },
  {
    id: "corona",
    label: "Corona",
    text: "La corona esta en juego y todos lo saben.",
    best: ["ataque", "dobletempo"],
  },
  {
    id: "respeto",
    label: "Respeto",
    text: "Piden respeto: el publico mide cada palabra.",
    best: ["respuesta", "defensa"],
  },
  {
    id: "tiempo",
    label: "Tiempo",
    text: "El beat marca el tiempo y exige velocidad.",
    best: ["dobletempo", "flow"],
  },
  {
    id: "rival",
    label: "Rival",
    text: "Todo gira en torno a tu rival y su historial.",
    best: ["respuesta", "ataque"],
  },
  {
    id: "trabajo",
    label: "Trabajo",
    text: "Hablan de trabajo, oficio y sacrificio.",
    best: ["defensa", "storytelling"],
  },
  {
    id: "cultura",
    label: "Cultura",
    text: "La cultura manda: conocimiento y raices.",
    best: ["metrica", "improvisacion"],
  },  {
    id: "hambre",
    label: "Hambre",
    text: "El estimulo es el hambre: lo que se aguanta para llegar.",
    best: ["storytelling", "ataque"],
  },
  {
    id: "envidia",
    label: "Envidia",
    text: "El estimulo es la envidia de los que se quedaron mirando.",
    best: ["punchline", "respuesta"],
  },
  {
    id: "origen",
    label: "Origen",
    text: "El estimulo es de donde vienes y quien te hizo.",
    best: ["storytelling", "flow"],
  },
  {
    id: "noche",
    label: "Noche",
    text: "El estimulo es la noche: lo que pasa cuando se apagan las luces.",
    best: ["improvisacion", "humor"],
  },
  {
    id: "micro",
    label: "Micro",
    text: "El estimulo es el micro mismo: el fierro que te dieron.",
    best: ["metrica", "dobletempo"],
  },
  {
    id: "miedo",
    label: "Miedo",
    text: "El estimulo es el miedo: el que muestras y el que escondes.",
    best: ["defensa", "improvisacion"],
  },

];

// [eventName, rivalName, rivalStyle] per stage index.
export const battleRivals: [string, string, string][] = [
  ["Cypher de pieza", "Nico Cuaderno", "nervioso pero creativo"],
  ["Plaza del barrio", "La Sombra", "agresivo de plaza"],
  ["Regional Sur", "Killa Metro", "tecnico y frio"],
  ["Final Nacional", "Rima Royal", "completo y mediatico"],
  ["Mundial Underground", "Nova X", "veloz e impredecible"],
  ["Festival Leyenda", "Icono", "leyenda con publico propio"],
  ["Arena de Leyendas", "Fenix", "campeon mundial defendiendo su corona"],
];
