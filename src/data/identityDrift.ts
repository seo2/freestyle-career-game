// How the way you spend your weeks shapes who you become (Fase 10).
//
// Until now the identity axes moved ONLY when a dilemma was answered, and that had
// a consequence nobody had measured: a player who recorded a hundred songs and
// never battled ended up with exactly the same identity as one who battled every
// weekend. The destiny — "Productor", "Estrella", "Campeon de batallas" — was
// decided by three answers, while twenty-one blocks a week counted for nothing.
//
// So every action nudges the axes a little. The weights are small next to a dilemma
// (which moves 6 to 22) because a single choice under pressure should still feel
// bigger than one afternoon; but across a career the sum outweighs them, which is
// the point: what you DO is who you are.
//
// Pure data. The rule that applies it lives in src/systems/DilemmaSystem.ts
// (driftFromAction) and the bounds in DilemmaConfig.

import type { IdentityAxis } from "../core/types";

// Positive moves an axis towards its "high" end (comercial, musico, crew,
// polemico); negative towards the "low" end (underground, batallero, solitario,
// autentico).
export const identityDrift: Record<string, Partial<Record<IdentityAxis, number>>> = {
  // Getting on stage against someone. The clearest statement of what you are.
  battle: { batalleroMusico: -2 },
  // The circle with your people: still battling, but with them, not against them.
  cypher: { batalleroMusico: -1, soloCrew: 1 },
  // Barras frente al espejo. Craft, and craft leans musical.
  write: { batalleroMusico: 1 },
  // Paying for studio time to finish a song. The most musician thing in the game.
  record: { batalleroMusico: 2, undergroundComercial: 1 },
  // A show is an audience, not an opponent.
  show: { batalleroMusico: 2, undergroundComercial: 1 },
  // Posting is talking to everyone. It is how you get known, and it costs a little
  // of the underground.
  social: { undergroundComercial: 2 },
  // Practising alone in the room.
  practice: { soloCrew: -1 },
  // Working a shift says nothing about your art, and rest says nothing at all.
};
