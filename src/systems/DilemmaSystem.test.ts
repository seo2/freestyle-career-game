// "Mismo origen, destinos distintos" is the owner's guiding principle, so these
// tests pin the two things that make it real: every MC starts neutral, and a
// decision is what moves them — plus the Bible's rule that no option is the
// right answer.

import { describe, expect, it } from "vitest";
import { createNewState } from "../core/state";
import { createSequenceRng } from "../services/RandomService";
import { dilemmas } from "../data/dilemmas";
import { DilemmaConfig } from "../data/config/DilemmaConfig";
import {
  axisLean,
  dilemmaThisWeek,
  eligibleDilemmas,
  findDilemma,
  identitySummary,
  moveAxis,
  recentDecisions,
  resolveDilemma,
  rollDilemma,
} from "./DilemmaSystem";
import type { GameState, IdentityAxis } from "../core/types";

function career(week = 2): GameState {
  const state = createNewState("Test", 1);
  state.mode = "career";
  state.week = week;
  return state;
}

const AXES: IdentityAxis[] = ["undergroundComercial", "batalleroMusico", "soloCrew", "autenticoPolemico"];

describe("mismo origen", () => {
  it("starts every axis neutral, with no decisions and no label", () => {
    const state = createNewState("Test", 1);
    for (const axis of AXES) expect(state.axes[axis]).toBe(0);
    expect(state.decisions).toEqual([]);
    expect(state.seenDilemmas).toEqual([]);
    expect(state.pendingDilemma).toBeNull();
    // An MC who has decided nothing has no identity label. That is the point.
    expect(identitySummary(state)).toEqual([]);
    for (const axis of AXES) expect(axisLean(state.axes, axis).label).toBe("Sin definir");
  });

  it("names a lean only once the axis has actually moved", () => {
    const state = career();
    moveAxis(state.axes, "undergroundComercial", DilemmaConfig.axes.leanThreshold - 1);
    expect(axisLean(state.axes, "undergroundComercial").label).toBe("Sin definir");
    moveAxis(state.axes, "undergroundComercial", 2);
    expect(axisLean(state.axes, "undergroundComercial").label).toBe(
      DilemmaConfig.axes.labels.undergroundComercial.high,
    );
    // And the other way, from the same neutral start.
    const other = career();
    moveAxis(other.axes, "undergroundComercial", -(DilemmaConfig.axes.leanThreshold + 1));
    expect(axisLean(other.axes, "undergroundComercial").label).toBe(
      DilemmaConfig.axes.labels.undergroundComercial.low,
    );
  });

  it("clamps an axis to its bounds however many decisions push it", () => {
    const state = career();
    for (let i = 0; i < 40; i += 1) moveAxis(state.axes, "soloCrew", 20);
    expect(state.axes.soloCrew).toBe(DilemmaConfig.axes.max);
    for (let i = 0; i < 80; i += 1) moveAxis(state.axes, "soloCrew", -20);
    expect(state.axes.soloCrew).toBe(DilemmaConfig.axes.min);
  });
});

describe("the catalogue keeps the Bible's rule", () => {
  it("gives every dilemma at least two options, and no option is free", () => {
    for (const dilemma of dilemmas) {
      expect(dilemma.options.length).toBeGreaterThanOrEqual(2);
      for (const option of dilemma.options) {
        // Every side must move identity: a choice that changes nothing is not a
        // decision, it is a button.
        expect(Object.keys(option.axes).length).toBeGreaterThan(0);
        expect(option.outcome.length).toBeGreaterThan(0);
        expect(option.detail.length).toBeGreaterThan(0);
      }
    }
  });

  it("never offers two options that pull the same way on every axis", () => {
    // If both sides moved you identically there would be a right answer.
    for (const dilemma of dilemmas) {
      const [first, second] = dilemma.options;
      const same = AXES.every((axis) => (first.axes[axis] ?? 0) === (second.axes[axis] ?? 0));
      expect(same).toBe(false);
    }
  });

  it("has no duplicate ids, in dilemmas or inside their options", () => {
    const ids = dilemmas.map((dilemma) => dilemma.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const dilemma of dilemmas) {
      const optionIds = dilemma.options.map((option) => option.id);
      expect(new Set(optionIds).size).toBe(optionIds.length);
    }
  });
});

describe("eligibility is where divergence starts", () => {
  it("only offers what the stage has reached", () => {
    const rookie = career();
    for (const dilemma of eligibleDilemmas(rookie)) {
      expect(dilemma.minStage).toBe("pieza");
    }
    const veteran = career();
    veteran.stage = "plaza";
    expect(eligibleDilemmas(veteran).length).toBeGreaterThan(eligibleDilemmas(rookie).length);
  });

  it("respects axis gates, so two MCs in the same week can be offered different situations", () => {
    const gated = dilemmas.find((dilemma) => dilemma.requires);
    if (!gated) throw new Error("expected at least one gated dilemma");
    const [axis, gate] = Object.entries(gated.requires ?? {})[0] as [IdentityAxis, { min?: number }];
    const closed = career();
    closed.stage = "plaza";
    closed.axes[axis] = (gate.min ?? 0) - 30;
    expect(eligibleDilemmas(closed).map((d) => d.id)).not.toContain(gated.id);

    const open = career();
    open.stage = "plaza";
    open.axes[axis] = (gate.min ?? 0) + 5;
    expect(eligibleDilemmas(open).map((d) => d.id)).toContain(gated.id);
  });

  it("never repeats a once-only dilemma", () => {
    const once = dilemmas.find((dilemma) => dilemma.once);
    if (!once) throw new Error("expected a once-only dilemma");
    const state = career();
    state.stage = "plaza";
    expect(eligibleDilemmas(state).map((d) => d.id)).toContain(once.id);
    state.seenDilemmas.push(once.id);
    expect(eligibleDilemmas(state).map((d) => d.id)).not.toContain(once.id);
  });
});

describe("rollDilemma", () => {
  it("consumes exactly two RNG draws whatever the outcome", () => {
    const count = (draws: number[], state: GameState): number => {
      let used = 0;
      const rng = {
        next: () => {
          used += 1;
          return draws[used - 1] ?? 0;
        },
        int: (min: number, max: number) => {
          used += 1;
          const value = draws[used - 1] ?? 0;
          return min + Math.floor(value * (max - min + 1));
        },
      };
      rollDilemma(state, rng);
      return used;
    };
    // Lands, and does not land: the draw count must not tell them apart.
    expect(count([0, 0], career())).toBe(2);
    expect(count([0.99, 0], career())).toBe(2);
  });

  it("lands a dilemma on a low roll and parks the game on its screen", () => {
    const state = career();
    const dilemma = rollDilemma(state, createSequenceRng([0, 0]));
    expect(dilemma).not.toBeNull();
    expect(state.pendingDilemma).toBe(dilemma?.id);
    expect(state.mode).toBe("dilemma");
  });

  it("does not land on a high roll", () => {
    const state = career();
    expect(rollDilemma(state, createSequenceRng([0.99, 0]))).toBeNull();
    expect(state.pendingDilemma).toBeNull();
    expect(state.mode).toBe("career");
  });

  it("keeps the first week clear, so the loop can be learned first", () => {
    const state = career(1);
    expect(rollDilemma(state, createSequenceRng([0, 0]))).toBeNull();
    expect(state.mode).toBe("career");
  });

  it("brings at most one dilemma per week", () => {
    const state = career();
    const first = rollDilemma(state, createSequenceRng([0, 0]));
    if (!first) throw new Error("expected a dilemma");
    resolveDilemma(state, first.options[0].id);
    expect(dilemmaThisWeek(state)).toBe(true);
    expect(rollDilemma(state, createSequenceRng([0, 0]))).toBeNull();
    // The next week is open again.
    state.week += 1;
    expect(rollDilemma(state, createSequenceRng([0, 0]))).not.toBeNull();
  });

  it("never stacks a second dilemma on top of a pending one", () => {
    const state = career();
    rollDilemma(state, createSequenceRng([0, 0]));
    const pending = state.pendingDilemma;
    expect(rollDilemma(state, createSequenceRng([0, 0]))).toBeNull();
    expect(state.pendingDilemma).toBe(pending);
  });
});

describe("resolveDilemma", () => {
  it("applies the option, moves the axes and writes the decision into the memory", () => {
    const state = career();
    state.stage = "plaza";
    state.pendingDilemma = "sello-chico";
    const dilemma = findDilemma("sello-chico");
    if (!dilemma) throw new Error("dilemma missing");
    const firmar = dilemma.options[0];
    const before = { cash: state.cash, respect: state.respect, fans: state.fans };

    const resolution = resolveDilemma(state, firmar.id);
    if (!resolution) throw new Error("expected a resolution");
    expect(state.cash).toBe(before.cash + (firmar.cash ?? 0));
    expect(state.fans).toBe(before.fans + (firmar.fans ?? 0));
    // Signing costs respect: the cost is real, not decoration.
    expect(state.respect).toBeLessThan(before.respect + 1);
    expect(state.axes.undergroundComercial).toBe(firmar.axes.undergroundComercial);
    expect(state.decisions).toHaveLength(1);
    expect(state.decisions[0]).toMatchObject({
      dilemmaId: "sello-chico",
      optionId: firmar.id,
      week: state.week,
      choice: firmar.label,
    });
    expect(state.seenDilemmas).toContain("sello-chico");
    expect(state.pendingDilemma).toBeNull();
    expect(state.mode).toBe("career");
    expect(resolution.parts[0]).toBe(firmar.outcome);
  });

  it("takes the other road to the opposite place, from the same start", () => {
    const signing = career();
    signing.stage = "plaza";
    signing.pendingDilemma = "sello-chico";
    resolveDilemma(signing, "firmar");

    const refusing = career();
    refusing.stage = "plaza";
    refusing.pendingDilemma = "sello-chico";
    resolveDilemma(refusing, "rechazar");

    // Same origin, opposite destinations: that is the whole design.
    expect(signing.axes.undergroundComercial).toBeGreaterThan(0);
    expect(refusing.axes.undergroundComercial).toBeLessThan(0);
    expect(axisLean(signing.axes, "undergroundComercial").label).toBe(
      DilemmaConfig.axes.labels.undergroundComercial.high,
    );
    expect(axisLean(refusing.axes, "undergroundComercial").label).toBe(
      DilemmaConfig.axes.labels.undergroundComercial.low,
    );
  });

  it("refuses an option that does not belong to the pending dilemma", () => {
    const state = career();
    state.pendingDilemma = "entrevista-local";
    const snapshot = JSON.stringify(state);
    expect(resolveDilemma(state, "no-existe")).toBeNull();
    expect(JSON.stringify(state)).toBe(snapshot);
  });

  it("is a no-op when nothing is pending", () => {
    const state = career();
    const snapshot = JSON.stringify(state);
    expect(resolveDilemma(state, "tirar")).toBeNull();
    expect(JSON.stringify(state)).toBe(snapshot);
  });

  it("keeps the memory bounded without losing the axes it already moved", () => {
    const state = career();
    for (let i = 0; i < DilemmaConfig.log.maxDecisions + 8; i += 1) {
      state.pendingDilemma = "entrevista-local";
      state.week = 2 + i; // one per week, as the roll enforces
      resolveDilemma(state, i % 2 === 0 ? "tirar" : "respeto");
    }
    expect(state.decisions).toHaveLength(DilemmaConfig.log.maxDecisions);
    // The axes carry the whole history even though the oldest lines dropped.
    expect(state.axes.autenticoPolemico).not.toBe(0);
    expect(recentDecisions(state, 3)).toHaveLength(3);
    expect(recentDecisions(state, 3)[0].week).toBe(state.week);
  });

  it("never leaves a resource negative", () => {
    const state = career();
    state.stage = "plaza";
    state.respect = 0;
    state.fans = 0;
    state.health = 4;
    state.pendingDilemma = "pelea-afuera";
    resolveDilemma(state, "irse"); // costs respect
    expect(state.respect).toBeGreaterThanOrEqual(0);
    expect(state.fans).toBeGreaterThanOrEqual(0);
    expect(state.health).toBeGreaterThanOrEqual(0);
  });
});

describe("identitySummary", () => {
  it("reads only the axes that leaned", () => {
    const state = career();
    moveAxis(state.axes, "soloCrew", 40);
    const summary = identitySummary(state);
    expect(summary).toHaveLength(1);
    expect(summary[0]).toContain(DilemmaConfig.axes.labels.soloCrew.high);
    expect(summary[0]).toContain("+40");
  });
});
