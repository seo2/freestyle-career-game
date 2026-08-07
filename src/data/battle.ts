import type { BattleChoice, BattlePrompt } from "../core/types";

export const battleChoices: BattleChoice[] = [
  {
    id: "respuesta",
    label: "Responder",
    stat: "improvisacion",
    detail: "Castiga el ataque del rival.",
  },
  {
    id: "punchline",
    label: "Punchline",
    stat: "punchline",
    detail: "Busca el remate mas fuerte.",
  },
  {
    id: "flow",
    label: "Flow",
    stat: "flow",
    detail: "Gana al publico con ritmo.",
  },
  {
    id: "humor",
    label: "Humor",
    stat: "carisma",
    detail: "Desarma la tension con gracia.",
  },
  {
    id: "tecnica",
    label: "Tecnica",
    stat: "metrica",
    detail: "Juega con estructuras y multis.",
  },
  {
    id: "escena",
    label: "Escena",
    stat: "escena",
    detail: "Domina el escenario y el hype.",
  },
];

export const battlePrompts: BattlePrompt[] = [
  {
    text: "El rival se burla de que eres nuevo en el circuito.",
    best: ["respuesta", "humor"],
  },
  {
    text: "El beat cambia y el publico espera doble tempo.",
    best: ["flow", "tecnica"],
  },
  {
    text: "Te tiran una palabra dificil como estimulo.",
    best: ["tecnica", "punchline"],
  },
  {
    text: "El host prende a la gente y la tarima se calienta.",
    best: ["escena", "flow"],
  },
  {
    text: "El rival ataca tu barrio y tus primeras canciones.",
    best: ["respuesta", "punchline"],
  },
  {
    text: "La ronda va pareja y queda una barra para cerrar.",
    best: ["punchline", "escena"],
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
