// The music career's own milestones (Fase 10).
//
// Recording used to be a counter and nothing else: a measured route reached 101
// songs in twenty weeks and the game never said a word about any of them. If a
// player can become a famous rap artist instead of a battler — the owner's request
// — that road needs the same thing the battle ladder has: named steps you can see
// coming and feel arriving.
//
// Pure data. The rule that reads it lives in src/systems/ReleaseSystem.ts.

export interface ReleaseDef {
  id: string;
  // Songs recorded to reach it.
  songs: number;
  label: string;
  // What the game says when it lands. Written to sound like the scene, not like
  // an achievement toast.
  line: string;
  // Fame it adds on top of the song's own reward. A release is the moment people
  // outside your circle hear your name.
  fame: number;
  // Fans it brings with it.
  fans: number;
}

export const releases: ReleaseDef[] = [
  {
    id: "sencillo",
    songs: 1,
    label: "Primer sencillo",
    line: "Subiste tu primer tema. Ya no eres solo el que improvisa.",
    fame: 8,
    fans: 40,
  },
  {
    id: "ep",
    songs: 4,
    label: "EP",
    line: "Cuatro temas juntos: eso ya es un EP, y la gente lo escucha completo.",
    fame: 30,
    fans: 180,
  },
  {
    id: "disco",
    songs: 10,
    label: "Disco",
    line: "Diez temas. Tienes un disco, y un disco es algo que te sobrevive.",
    fame: 90,
    fans: 700,
  },
  {
    id: "gira",
    songs: 18,
    label: "Gira",
    line: "Con este material se sale de gira. Te van a pedir fechas en otras ciudades.",
    fame: 200,
    fans: 1800,
  },
  {
    id: "sello",
    songs: 30,
    label: "Sello propio",
    line: "Ya no firmas con nadie: firmas a otros. El sello es tuyo.",
    fame: 500,
    fans: 4000,
  },
];

// The release a given song count has just unlocked, if any.
export function releaseAt(songs: number): ReleaseDef | undefined {
  return releases.find((release) => release.songs === songs);
}

// The next one to aim for, for the goals panel.
export function nextRelease(songs: number): ReleaseDef | undefined {
  return releases.find((release) => release.songs > songs);
}
