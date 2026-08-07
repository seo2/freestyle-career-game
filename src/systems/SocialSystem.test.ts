import { describe, expect, it } from "vitest";
import type { ActionResult } from "../core/types";
import { createNewState } from "../core/state";
import { createSequenceRng, createStateRng } from "../services/RandomService";
import { socialPostOptions } from "../data/social";
import { publishSocialPost } from "./SocialSystem";

const video = socialPostOptions[0]; // fans 26, fame 5, energy 12, blocks 1, rhythm 8

function asEvent(result: ActionResult): Extract<ActionResult, { type: "event" }> {
  if (result.type !== "event") throw new Error(`expected event, got ${result.type}`);
  return result;
}

describe("publishSocialPost", () => {
  it("blocks posting below the option energy without consuming rng", () => {
    const state = createNewState("Tester", 42);
    state.energy = 11;
    const result = asEvent(publishSocialPost(state, createStateRng(state), video));

    expect(result.parts).toEqual(["Necesitas energia para publicar con foco."]);
    expect(result.fx).toBeNull();
    expect(state.fans).toBe(0);
    expect(state.fame).toBe(0);
    expect(state.energy).toBe(11);
    expect(state.seed).toBe(42); // guard path makes zero rng calls
  });

  it("resolves a non-viral post: fans, fame, health tick and clock", () => {
    const state = createNewState("Tester", 42);
    // rolls: viral check 0.5 (<= 0.868, not viral), fan bonus 5, carisma 0.5 (no gain)
    const result = asEvent(publishSocialPost(state, createSequenceRng([0.5, 0.5, 0.5]), video));

    expect(result.parts).toEqual(["Video freestyle: +34 fans, +7 fama.", "Impulso +12: Frio."]);
    expect(result.fx).toEqual({
      label: "Video freestyle",
      fromBlock: 0,
      toBlock: 1,
      blocks: 1,
      daysPassed: 0,
    });
    expect(state.fans).toBe(34); // 26 + carisma 3 + roll 5
    expect(state.fame).toBe(7); // 5 + floor(34/12)
    expect(state.health).toBe(87);
    expect(state.stats.carisma).toBe(1);
    expect(state.xp).toBe(16);
    expect(state.energy).toBe(74);
    expect(state.momentum).toBe(54);
    expect(state.lastActionId).toBe("social-video");
  });

  it("resolves a viral post with the carisma gain branch", () => {
    const state = createNewState("Tester", 42);
    // rolls: viral 0.95 (> 0.868), fan bonus 5, carisma 0.9 (> 0.68, +1)
    const result = asEvent(publishSocialPost(state, createSequenceRng([0.95, 0.5, 0.9]), video));

    expect(result.parts).toEqual(["Video freestyle exploto: +82 fans.", "Impulso +21: Activo."]);
    expect(state.fans).toBe(82); // 26 + 3 + 5 + viral 48
    expect(state.fame).toBe(21); // 5 + floor(82/12) + viral 10
    expect(state.health).toBe(84); // viral costs 4
    expect(state.stats.carisma).toBe(2);
    expect(state.xp).toBe(32); // 16 + viral 16
    expect(state.momentum).toBe(63); // rhythm 8+9, +4 fresh-action bonus
  });

  it("adds the outfit bonus to fan gain", () => {
    const state = createNewState("Tester", 42);
    state.outfitLevel = 2;
    const result = asEvent(publishSocialPost(state, createSequenceRng([0.5, 0.5, 0.5]), video));

    expect(result.parts[0]).toBe("Video freestyle: +44 fans, +8 fama.");
    expect(state.fans).toBe(44); // 26 + 3 + outfit 10 + roll 5
  });

  it("consumes exactly three rng rolls in legacy order", () => {
    const state = createNewState("Tester", 777);
    const ref = { seed: 777 };
    const refRng = createStateRng(ref);
    // Replay the legacy stream: viral check, fan bonus int, carisma roll.
    const viral = refRng.next() > 0.88 - state.stats.carisma * 0.012;
    const expectedFans =
      video.fans + state.stats.carisma * 3 + state.outfitLevel * 5 + refRng.int(0, 10) + (viral ? 48 : 0);
    refRng.next();

    publishSocialPost(state, createStateRng(state), video);

    expect(state.seed).toBe(ref.seed);
    expect(state.fans).toBe(expectedFans);
  });
});
