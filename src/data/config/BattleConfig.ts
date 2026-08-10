// Battle tuning values. Formula shapes live in src/systems/BattleSystem.ts;
// every number they consume lives here.

export const BattleConfig = {
  entry: {
    energyCostBase: 22,
    energyCostPerStage: 3,
  },
  rounds: {
    maxRounds: 3,
    openingHype: 50,
  },
  tier: {
    rivalPowerBase: 3,
    rivalPowerPerStage: 2,
    rivalPowerLevelDivisor: 3,
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
    hypeDivisor: 8,
    playerRandomMin: 7,
    playerRandomMax: 26,
    rivalPowerWeight: 8,
    roundWeight: 2,
    rivalRandomMin: 12,
    rivalRandomMax: 34,
  },
  hype: {
    winGain: 12,
    winPromptBonusDivisor: 3,
    lossDrop: 7,
  },
  // Real rival meters (they replaced BattleScene's fabricated readout, which
  // showed 70 + rivalPower*2 energy on a /100 bar — these values keep that
  // opening picture but clamp at the max and actually move during the match).
  rival: {
    energyBase: 70,
    energyPerPower: 2,
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
