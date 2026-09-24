// What the battle crowd yells (Fase 12 D). Presentation copy, kept as data so
// the voice of the room can be tuned without touching the scene. The scene
// picks from these deterministically (by round and slot, never RNG), so the
// same battle always sounds the same and the trace harness stays byte-exact.

// A round the MC landed hard: the room is with you.
export const crowdCheers = ["¡UUUH!", "¡OTRA!", "¡FUEGO!", "¡SE MURIÓ!", "¡BARRA!", "¡ESOOO!", "¡LO MATÓ!"] as const;

// A round the rival took from you: the room turns.
export const crowdJeers = ["¡UYYY!", "¡TE MATÓ!", "¡RESPONDE!", "¡AUCH!", "¡HUMILDAD!"] as const;

// The battle is over and you won it.
export const crowdVictory = ["¡CAMPEÓN!", "¡OTRA, OTRA!", "¡ESE ES!", "¡LEYENDA!"] as const;
