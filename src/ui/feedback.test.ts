// The feedback layer is presentation, but what it reports has to be true (a
// "+12" the state did not gain is a lie) and its curves have to land, so both
// are pinned here instead of trusted to screenshots.

import { describe, expect, it } from "vitest";
import { Floater, diffFeedback, flicker, idlePose } from "./feedback";
import type { FeedbackSnapshot } from "./feedback";

function snapshot(overrides: Partial<FeedbackSnapshot> = {}): FeedbackSnapshot {
  return {
    energy: 90,
    cash: 25,
    fans: 0,
    respect: 0,
    xp: 0,
    level: 1,
    songs: 0,
    discProgress: 0,
    stats: { flow: 2, punchline: 2, metrica: 1, improvisacion: 2, escena: 1, carisma: 1, disciplina: 1 },
    roomProps: [],
    ...overrides,
  };
}

describe("diffFeedback", () => {
  it("reports nothing when nothing moved", () => {
    expect(diffFeedback(snapshot(), snapshot())).toEqual([]);
  });

  it("reports a training session as the skill gained plus the energy spent", () => {
    const before = snapshot({ stats: { ...snapshot().stats, flow: 3 } });
    const after = snapshot({ energy: 76, xp: 6, stats: { ...before.stats, flow: 4 } });
    const texts = diffFeedback(before, after).map((d) => d.text);
    expect(texts).toEqual(["+1 FLOW", "+6 XP", "-14"]);
  });

  it("anchors resources to their HUD card and character gains to the MC", () => {
    const deltas = diffFeedback(snapshot(), snapshot({ cash: 45, fans: 12, respect: 3, discProgress: 20 }));
    expect(deltas.map((d) => [d.anchor, d.text])).toEqual([
      ["mc", "+20% TEMA"],
      ["cash", "+$20"],
      ["fans", "+12"],
      ["respect", "+3"],
    ]);
  });

  it("marks losses as negative so they never celebrate", () => {
    const [cash] = diffFeedback(snapshot({ cash: 50 }), snapshot({ cash: 20 }));
    expect(cash.text).toBe("-$30");
    expect(cash.positive).toBe(false);
  });

  it("turns a rank crossing into a milestone instead of a +1", () => {
    const before = snapshot({ stats: { ...snapshot().stats, flow: 4 } });
    const after = snapshot({ stats: { ...snapshot().stats, flow: 5 } });
    const [delta] = diffFeedback(before, after);
    expect(delta.text).toBe("FLOW CALLEJERO");
    expect(delta.milestone?.kicker).toBe("NUEVO RANGO");
  });

  it("announces a new prop in the pieza as a milestone", () => {
    const [delta] = diffFeedback(snapshot(), snapshot({ roomProps: ["disco-oro"] }));
    expect(delta.text).toBe("DISCO DE ORO");
    expect(delta.milestone?.kicker).toBe("TU PIEZA CAMBIO");
  });

  it("shows a level-up instead of the xp bar resetting", () => {
    const texts = diffFeedback(snapshot({ xp: 65 }), snapshot({ xp: 2, level: 2 })).map((d) => d.text);
    expect(texts).toEqual(["¡NIVEL 2!"]);
  });

  it("celebrates a finished song instead of the progress bar resetting", () => {
    const texts = diffFeedback(snapshot({ discProgress: 90 }), snapshot({ discProgress: 0, songs: 1 })).map((d) => d.text);
    expect(texts).toEqual(["¡TEMA TERMINADO!"]);
  });
});

describe("Floater", () => {
  it("waits out its stagger before showing", () => {
    const f = new Floater(200);
    f.advance(100);
    expect(f.pending).toBe(true);
    expect(f.alpha).toBe(0);
    f.advance(150);
    expect(f.pending).toBe(false);
    expect(f.alpha).toBe(1);
  });

  it("pops past full size and lands on it", () => {
    const f = new Floater(0, 1500, 30, 160);
    f.advance(1);
    expect(f.scale).toBeGreaterThan(1.3);
    f.advance(200);
    expect(f.scale).toBe(1);
  });

  it("rises to its full height and fades out by the end of its life", () => {
    const f = new Floater(0, 1000, 30, 100, 400);
    f.advance(500);
    expect(f.alpha).toBe(1);
    expect(f.rise).toBeGreaterThan(15);
    f.advance(500);
    expect(f.done).toBe(true);
    expect(f.rise).toBeCloseTo(30, 5);
    expect(f.alpha).toBe(0);
  });

  it("lands in the same place however the frames are sliced", () => {
    const big = new Floater();
    big.advance(700);
    const small = new Floater();
    for (let i = 0; i < 70; i += 1) small.advance(10);
    expect(small.rise).toBeCloseTo(big.rise, 5);
  });
});

describe("idlePose", () => {
  it("nods down on the beat and is back up before the next one", () => {
    const beatMs = 60000 / 88;
    expect(idlePose(0).dy).toBe(-2);
    expect(idlePose(beatMs * 0.5).dy).toBe(0);
    expect(idlePose(beatMs).dy).toBe(-2);
  });

  it("breathes by about one percent, never more", () => {
    for (let t = 0; t < 5000; t += 37) {
      const { scaleY } = idlePose(t);
      expect(Math.abs(scaleY - 1)).toBeLessThanOrEqual(0.012 + 1e-9);
    }
  });
});

describe("flicker", () => {
  it("stays inside 0..1 and is deterministic", () => {
    for (let t = 0; t < 20000; t += 53) {
      const v = flicker(t, 3);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      expect(flicker(t, 3)).toBe(v);
    }
  });
});
