// Battle tuning values. Formula shapes live in src/systems/BattleSystem.ts;
// every number they consume lives here.

import type { BattleResourceId } from "../../core/types";

export const BattleConfig = {
  entry: {
    energyCostBase: 22,
    energyCostPerStage: 3,
  },
  rounds: {
    maxRounds: 3,
    openingHype: 50,
  },
  // Hand of 5 per round (battle mockup shows exactly 5 cards). Dealt by
  // BattleSystem via RandomService; rules live there, the size lives here.
  hand: {
    size: 5,
  },
  // Per-round decision timer. Runs only while choosing a card (paused on the
  // verdict beat); DifficultyConfig scales the seconds per difficulty. On
  // expiry the round auto-resolves as a "Pasada": skipped turn, hype penalty,
  // DEBIL-style verdict (BattleSystem.expireBattleRound).
  timer: {
    roundSeconds: 15,
    passHypePenalty: 10,
    passLabel: "PASADA",
  },
  // How the rival picks their resource (gauntlet 10). Personality weights and
  // the archetype bias are added to a flat base so every resource keeps a
  // chance; the pick then costs exactly ONE RNG draw over the cumulative
  // weight, which is what keeps the trace harness deterministic.
  rivalAi: {
    baseWeight: 4,
    // Which personality trait lifts which resource, and by how much per point.
    agresividadPerPoint: { ataque: 0.9, punchline: 0.5, defensa: -0.3 },
    humorPerPoint: { humor: 0.9, storytelling: 0.3 },
    metricaPerPoint: { metrica: 0.8, dobletempo: 0.6, storytelling: 0.2 },
    // Risk-takers reach for the high-hype swings and stop hiding behind guard.
    riesgoPerPoint: { punchline: 0.5, dobletempo: 0.4, improvisacion: 0.5, defensa: -0.4 },
    // A weight can never go to zero or below: a legible rival still surprises.
    minWeight: 1,
  },
  // The resource the rival performs now feeds their roll: a Punchline from a
  // punchline rival hits harder than the same card from a metric technician.
  rivalResource: {
    // Halved. These are the rival's OWN stats from the roster, which climb with
    // the stage — so at 1.2 the ladder was counted twice, once here and once in
    // rivalPowerPerStage, and the measured curve dipped hard exactly at the stages
    // whose rival happens to be punchline-heavy. The personality still reads (a
    // punchline rival hits harder with punchlines); it just no longer decides the
    // fight on its own.
    flowWeight: 0.6,
    punchlineWeight: 0.6,
    // Which of the rival's two stats each resource leans on (the rest lean on
    // neither and roll on power alone).
    flowResources: ["flow", "dobletempo", "improvisacion", "respuesta"] as BattleResourceId[],
    punchlineResources: ["punchline", "ataque", "humor", "storytelling"] as BattleResourceId[],
  },
  // Crowd taste (per event, data in src/data/rivals.ts): scales the hype a won
  // round awards. Applied inside projectedHypeGain, so the +N previewed on the
  // card is exactly what a win pays.
  crowd: {
    lovesMultiplier: 1.35,
    coldsMultiplier: 0.7,
  },
  // Tension rules (Bible): the counter pays, boring the crowd costs, and both
  // surface as verdict-panel notes.
  tension: {
    // Playing Respuesta the round after the rival played Ataque.
    responseBonus: 6,
    // Playing the same resource you played the previous round (applies to the
    // win gain and deepens the loss drop).
    repetitionPenalty: 5,
    notes: {
      response: "Respondiste el ataque del rival.",
      repetition: "Repites recurso: aburres al publico.",
      timeout: "Se acabo el tiempo: pasaste la ronda.",
    },
  },
  tier: {
    // Measured, not guessed (scripts/measure-battles.mjs). The old curve was a
    // sawtooth that ended in a formality: 8% wins in week 1, then 100% at regional
    // and nacional with EVERY policy, including deliberately playing the worst
    // card. The cause was that the player's roll grows with stats (8 a point) and
    // level (3 a point) while the rival only grew with the stage, so the gap ran
    // from -15 to +47 across a career.
    rivalPowerBase: 1,
    // The stage adds far less than it did. It should raise the STAKES, not build a
    // wall the week you get promoted: at +2 (with the old weight) promotion took
    // the win rate from 94% to 27% in one battle.
    rivalPowerPerStage: 1,
    // Halved from 3 for the same reason as the stat term: a rival who only gained
    // a point every three levels fell 40 roll points behind by nacional. The prize
    // for training is that you can face a HIGHER stage, not that the same rival
    // gets easier — the edge is meant to come from preparation and card choice,
    // which is where the measured gap between playing well and playing badly is.
    rivalPowerLevelDivisor: 2,
    // The rival tracks the player's own training. Below 1.0 the MC still gains
    // ground for every stat point — just slowly enough that the ladder stays a
    // contest instead of turning into a victory lap.
    // Times rivalPowerWeight this must stay BELOW statWeight, or training makes
    // the MC weaker in relative terms. At 2.2 it was 8.8 against the player's 8 —
    // inverted, and the win rates hid it because level and prompt bonuses made up
    // the difference. A test pins the inequality now.
    rivalPowerPerPlayerStat: 1.95,
    rewardCashBase: 35,
    rewardCashPerStage: 85,
    rewardFansBase: 18,
    rewardFansPerStage: 95,
    rewardRespectBase: 10,
    rewardRespectPerStage: 18,
    rewardFameBase: 3,
    rewardFamePerStage: 25,
    rewardXpBase: 48,
    rewardXpPerStage: 28,
  },
  roll: {
    statWeight: 8,
    levelWeight: 3,
    promptBonus: 12,
    highEnergyThreshold: 45,
    highEnergyBonus: 4,
    lowEnergyThreshold: 15,
    lowEnergyPenalty: -8,
    highHealthThreshold: 70,
    highHealthBonus: 3,
    lowHealthThreshold: 30,
    lowHealthPenalty: -8,
    momentumPivot: 50,
    momentumDivisor: 8,
    outfitPresenceWeight: 2,
    offPiezaOutfitWeight: 1,
    // Raised from 8: at 8 a full meter was worth +12 on the roll, which on top of
    // the feedback loop turned round one into the whole battle. Now it is worth up
    // to +8, and it applies to BOTH sides (BattleSystem.rollRival).
    hypeDivisor: 12,
    // The two dice are SYMMETRIC on purpose. They used to be 7..26 for the player
    // and 12..34 for the rival, which is a flat +6.5 handicap smuggled into the
    // RNG where no difficulty knob can see it — and it was most of why a brand new
    // MC won only 8% of his first battles. Difficulty now lives entirely in
    // rivalPower, which is one number a designer can reason about.
    playerRandomMin: 8,
    playerRandomMax: 30,
    // Halved from 8 so a power point is a FINER step. At 8 the win rate swung
    // ~25 points for every single point of rival power, which left no setting that
    // was neither a wall nor a formality. rivalPower is not shown anywhere, so its
    // absolute scale is free — only the product matters.
    rivalPowerWeight: 4,
    roundWeight: 2,
    rivalRandomMin: 8,
    rivalRandomMax: 30,
  },
  // Win hype now starts from each card's baseHype (src/data/battle.ts, mockup
  // values); these knobs shape the swing around it.
  hype: {
    winPromptBonusDivisor: 3,
    lossDrop: 7,
  },
  // Real rival meters (they replaced BattleScene's fabricated readout, which
  // showed 70 + rivalPower*2 energy on a /100 bar — these values keep that
  // opening picture but clamp at the max and actually move during the match).
  rival: {
    energyBase: 70,
    // Halved with rivalPowerWeight, so the rival's energy bar still opens where it
    // used to: the number behind it doubled, its meaning did not.
    energyPerPower: 1,
    energyMax: 100,
    // Performing a round tires the rival regardless of who takes it.
    roundEnergyDrain: 8,
    // Crowd swing of the rival's answer: a strong round earns full hype, a
    // weak answer still earns a little (mockup round panel: "DEBIL +4").
    hypeWinGain: 12,
    hypeLossGain: 4,
  },
  // One-word grade for each side's answer on the round-result panel, picked by
  // hype-delta thresholds: boosted win (+16) reads great, plain win (+12)
  // reads good, anything under goodMin reads weak.
  verdict: {
    greatMin: 14,
    goodMin: 8,
    labels: {
      great: "¡BUENISIMO!",
      good: "BIEN",
      weak: "DEBIL",
    },
  },
  payout: {
    cashDrawFraction: 0.35,
    fansDrawFraction: 0.45,
    fansLossFraction: 0.22,
    respectDrawFraction: 0.5,
    respectLossFraction: 0.25,
    fameDrawFraction: 0.45,
    fameLossFraction: 0.2,
    xpDrawFraction: 0.55,
    xpLossFraction: 0.32,
  },
  duration: {
    piezaBlocks: 1,
    otherStagesBlocks: 2,
  },
  rhythm: {
    winDelta: 18,
    drawDelta: 7,
    lossDelta: -10,
  },
} as const;
