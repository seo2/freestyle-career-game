// Social system: publishing posts for fans/fame with a viral chance. Pure
// functions over GameState — mutate in place, no globals, no DOM. Ported
// verbatim from the legacy main.ts engine (RNG call order preserved).

import type { ActionResult, GameState, SocialPostOption } from "../core/types";
import type { RandomSource } from "../services/RandomService";
import { SocialConfig } from "../data/config/SocialConfig";
import { clamp } from "../utils/math";
import { addStat, addXp, applyRhythm } from "./ProgressionSystem";
import { spendActionTime } from "./CalendarSystem";

export function publishSocialPost(
  state: GameState,
  rng: RandomSource,
  option: SocialPostOption,
): ActionResult {
  if (state.energy < option.energy) {
    return { type: "event", parts: ["Necesitas energia para publicar con foco."], fx: null };
  }
  const viral =
    rng.next() > SocialConfig.viral.baseThreshold - state.stats.carisma * SocialConfig.viral.carismaThresholdFactor;
  const fanGain =
    option.fans +
    state.stats.carisma * SocialConfig.fans.carismaMultiplier +
    state.outfitLevel * SocialConfig.fans.outfitMultiplier +
    rng.int(SocialConfig.fans.randomMin, SocialConfig.fans.randomMax) +
    (viral ? SocialConfig.viral.fanBonus : 0);
  const fameGain =
    option.fame + Math.floor(fanGain / SocialConfig.fame.fanDivisor) + (viral ? SocialConfig.viral.fameBonus : 0);
  state.fans += fanGain;
  state.fame += fameGain;
  state.health = clamp(
    state.health - (viral ? SocialConfig.health.viralCost : SocialConfig.health.normalCost),
    0,
    100,
  );
  if (rng.next() > SocialConfig.carisma.gainThreshold) addStat(state, "carisma", SocialConfig.carisma.gain);
  const levelMessages = addXp(state, SocialConfig.xp.base + (viral ? SocialConfig.xp.viralBonus : 0));
  const rhythmMessages = applyRhythm(
    state,
    `social-${option.id}`,
    viral ? option.rhythm + SocialConfig.viral.rhythmBonus : option.rhythm,
  );
  const time = spendActionTime(state, option.energy, option.blocks, option.label);
  return {
    type: "event",
    parts: [
      viral ? `${option.label} exploto: +${fanGain} fans.` : `${option.label}: +${fanGain} fans, +${fameGain} fama.`,
      ...rhythmMessages,
      ...levelMessages,
      ...time.messages,
    ],
    fx: time.fx,
  };
}
