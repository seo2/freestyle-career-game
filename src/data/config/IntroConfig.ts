// The prologue battle's tuning (Fase 12 E, AGENTS.md: Data Driven).
//
// The career used to open on a bedroom and a "Dormir" button: the fantasy (a
// battle) was two screens and a map away. The prologue throws the MC on stage
// first, so the room that follows has a reason to exist. It is a real battle —
// same rounds, same rival formula — but it happens the night BEFORE the career's
// first day, so it costs no energy, moves no clock and pays almost nothing: it
// is the hook, not a head start.

export const IntroConfig = {
  // A real pieza rival from src/data/rivals.ts, so the grudge the prologue leaves
  // is the same person who turns up later in the plaza.
  rivalName: "Tuti",
  eventName: "Batalla del viernes",
  // What a win in front of forty people is worth: a nudge, not a skip.
  winReward: { fans: 12, respect: 4 },
  drawReward: { fans: 5, respect: 1 },
} as const;
