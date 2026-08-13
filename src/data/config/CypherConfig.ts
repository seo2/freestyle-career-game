// Cypher tuning (owner decision, 2026-08-13): the cypher is TRAINING, not a
// career event. It is the any-day outlet — you rap in a circle with friends and
// what you take home is practice, so the stage battle can keep its appointment
// without ever locking a player out of rapping.
//
// Formula shapes live in src/systems/CypherSystem.ts; every number they consume
// lives here.

export const CypherConfig = {
  entry: {
    energyCost: 14,
    blocks: 1,
    // A cypher is short: a few turns and the circle moves on.
    turns: 3,
    // How many of the ten resources you get to pick from each turn.
    handSize: 3,
  },
  // What a turn is worth. You are rolling against YOUR OWN stat, not a rival:
  // the question is whether the thing you tried came out, so improving is
  // visible instead of being hidden behind an opponent's roll.
  turn: {
    // The stat feeding a resource is scaled by this before the roll, so a low
    // stat lands "trabado" often and a trained one lands clean.
    statWeight: 3,
    rollMin: 0,
    rollMax: 30,
    // Above this the turn came out; above the great line it came out clean.
    goodAt: 14,
    greatAt: 26,
    labels: { great: "LIMPIO", good: "SALIO", weak: "TRABADO" },
    // Practice earns stat points: a clean turn teaches more than a fumbled one,
    // but a fumbled turn still teaches something (that is what practice is).
    xpGreat: 3,
    xpGood: 2,
    xpWeak: 1,
    // Repeating the same resource in one cypher teaches less: variety is the
    // point of a circle.
    repeatPenalty: 1,
  },
  // What closing the cypher gives, on top of the stat points earned per turn.
  payout: {
    // Momentum swings with how the cypher went overall.
    momentumGreat: 12,
    momentumGood: 6,
    momentumWeak: -4,
    // A little career xp, far below a real battle: this is practice.
    xpBase: 12,
    xpPerGoodTurn: 6,
    // Respect only when the circle really went well — a cypher is not a stage.
    respectAllClean: 2,
    rhythmActionId: "cypher",
  },
} as const;
