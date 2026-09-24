// The prologue's words (Fase 12 E). Presentation copy, so it lives as data:
// the opening beat before the battle, and one closing beat per outcome, each
// ending on what the room is for now. `{rival}` is replaced with the prologue
// rival's name (IntroConfig.rivalName).

export interface IntroBeat {
  kicker: string;
  title: string;
  lines: string[];
  button: string;
}

export const introOpening: IntroBeat = {
  kicker: "VIERNES · PLAZA DEL BARRIO",
  title: "TE ANOTARON SIN AVISARTE",
  lines: [
    "Tu primo puso tu nombre en la lista de la batalla.",
    "Hay cuarenta personas mirando, un parlante reventado y {rival} esperándote.",
    "No trajiste nada escrito. Vas a tener que improvisar.",
  ],
  button: "SUBIR A LA TARIMA",
};

export const introSkipLabel = "SALTAR";

export const introClosing: Record<"win" | "loss" | "draw", IntroBeat> = {
  win: {
    kicker: "LA PLAZA GRITO TU NOMBRE",
    title: "LE GANASTE A {rival}",
    lines: [
      "Nadie te conocía y ahora todos quieren verte de nuevo.",
      "{rival} no se va a quedar con esa. Te va a buscar.",
      "Una batalla no es una carrera. En tu pieza empieza lo otro.",
    ],
    button: "A TU PIEZA",
  },
  loss: {
    kicker: "TE QUEDASTE EN BLANCO",
    title: "{rival} SE RIO EN TU CARA",
    lines: [
      "\"Vuelve cuando sepas rimar\", te dijo con el micrófono todavía en la mano.",
      "Esa risa te va a acompañar toda la semana.",
      "En tu pieza hay un cuaderno y un beat. Empieza por ahí.",
    ],
    button: "A TU PIEZA",
  },
  draw: {
    kicker: "REPLICA",
    title: "NI TU NI {rival}",
    lines: [
      "El público no supo a quién darle la batalla, y eso ya es algo.",
      "{rival} te miró distinto al bajar de la tarima.",
      "La próxima no puede quedar pareja. A tu pieza.",
    ],
    button: "A TU PIEZA",
  },
};

// The line waiting in the room, per outcome (or when the prologue was skipped).
export const introRoomEvent: Record<"win" | "loss" | "draw" | "skip", string> = {
  win: "Ganaste tu primera batalla. Ahora hay que sostenerlo: entrena y escribe.",
  loss: "{rival} te ganó en la plaza. Entrena: la revancha llega.",
  draw: "Empataste con {rival}. Entrena para desempatar.",
  skip: "{name} parte rapeando en su pieza.",
};

export function fillIntro(text: string, rival: string, name = ""): string {
  return text.split("{rival}").join(rival).split("{name}").join(name);
}
