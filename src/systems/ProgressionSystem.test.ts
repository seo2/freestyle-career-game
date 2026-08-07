import { describe, expect, it } from "vitest";
import { createNewState } from "../core/state";
import {
  addStat,
  addXp,
  applyRhythm,
  finalizeEvent,
  getCareerGoals,
  maybeUnlockStage,
  rhythmPreview,
  stageGoalProgress,
} from "./ProgressionSystem";
import { stages } from "../data/stages";

const SEED = 1234;

describe("addStat", () => {
  it("clamps stats to the 1..99 band", () => {
    const state = createNewState("Test", SEED);
    addStat(state, "flow", 200);
    expect(state.stats.flow).toBe(99);
    addStat(state, "flow", -500);
    expect(state.stats.flow).toBe(1);
    addStat(state, "carisma", 1);
    expect(state.stats.carisma).toBe(2);
  });
});

describe("addXp", () => {
  it("cascades across multiple level thresholds with exact messages", () => {
    const state = createNewState("Test", SEED);
    const messages = addXp(state, 200);
    // 200 xp: 70 -> level 2 (xpNext 103), 103 -> level 3 (xpNext 144), 27 left.
    expect(messages).toEqual([
      "Subiste a nivel 2: +1 Impro.",
      "Subiste a nivel 3: +1 Metrica.",
    ]);
    expect(state.level).toBe(3);
    expect(state.xp).toBe(27);
    expect(state.xpNext).toBe(144);
    expect(state.stats.improvisacion).toBe(3);
    expect(state.stats.metrica).toBe(2);
    // Energy/health refill per level, clamped to caps.
    expect(state.energy).toBe(97);
    expect(state.health).toBe(100);
  });

  it("rotates the level stat by (level + stageIndex) % 7", () => {
    const state = createNewState("Test", SEED);
    // Level 1 -> 2 exactly, stage pieza (index 0): ordered[2] = improvisacion.
    const first = addXp(state, 70);
    expect(first).toEqual(["Subiste a nivel 2: +1 Impro."]);
    // Level 2 -> 3: ordered[3] = metrica.
    const second = addXp(state, state.xpNext);
    expect(second).toEqual(["Subiste a nivel 3: +1 Metrica."]);
  });

  it("returns no messages when the threshold is not crossed", () => {
    const state = createNewState("Test", SEED);
    expect(addXp(state, 69)).toEqual([]);
    expect(state.level).toBe(1);
    expect(state.xp).toBe(69);
  });
});

describe("maybeUnlockStage", () => {
  it("unlocks plaza at exactly level 2 and respect 8", () => {
    const state = createNewState("Test", SEED);
    state.level = 2;
    state.respect = 8;
    expect(maybeUnlockStage(state)).toBe("Nuevo circuito desbloqueado: Plaza.");
    expect(state.stage).toBe("plaza");
  });

  it("stays locked one point below either requirement", () => {
    const low = createNewState("Test", SEED);
    low.level = 2;
    low.respect = 7;
    expect(maybeUnlockStage(low)).toBeNull();
    expect(low.stage).toBe("pieza");

    const lowLevel = createNewState("Test", SEED);
    lowLevel.level = 1;
    lowLevel.respect = 8;
    expect(maybeUnlockStage(lowLevel)).toBeNull();
    expect(lowLevel.stage).toBe("pieza");
  });

  it("returns null at the final stage", () => {
    const state = createNewState("Test", SEED);
    state.stage = "estrella";
    expect(maybeUnlockStage(state)).toBeNull();
  });
});

describe("finalizeEvent", () => {
  it("appends the unlock message before joining parts", () => {
    const state = createNewState("Test", SEED);
    state.level = 2;
    state.respect = 8;
    const parts = ["Ganaste la batalla."];
    finalizeEvent(state, parts);
    expect(state.lastEvent).toBe("Ganaste la batalla. Nuevo circuito desbloqueado: Plaza.");
    expect(state.stage).toBe("plaza");
    expect(parts).toHaveLength(2);
  });

  it("joins parts with spaces when nothing unlocks", () => {
    const state = createNewState("Test", SEED);
    finalizeEvent(state, ["Escribiste un rato.", "Impulso +6: Activo."]);
    expect(state.lastEvent).toBe("Escribiste un rato. Impulso +6: Activo.");
    expect(state.stage).toBe("pieza");
  });
});

describe("stageGoalProgress", () => {
  it("averages the four requirement ratios", () => {
    const state = createNewState("Test", SEED);
    const plaza = stages[1];
    // level 1/2 = 0.5, fans req 0 = 1, respect 0/8 = 0, fame req 0 = 1.
    expect(stageGoalProgress(state, plaza)).toBeCloseTo(0.625, 10);
  });
});

describe("getCareerGoals", () => {
  it("builds the fresh-state goals byte-exact", () => {
    const state = createNewState("Test", SEED);
    const goals = getCareerGoals(state);
    expect(goals).toEqual([
      {
        label: "Abrir Plaza",
        detail: "Nv 1/2 · Resp 0/8",
        value: 63,
        max: 100,
        color: "#2fa58d",
      },
      {
        label: "Primer tema",
        detail: "0% escrito",
        value: 0,
        max: 80,
        color: "#e1b84a",
      },
    ]);
  });

  it("switches to the studio-payment goal once the song is written", () => {
    const state = createNewState("Test", SEED);
    state.discProgress = 80;
    state.cash = 25;
    const goals = getCareerGoals(state);
    expect(goals[1]).toEqual({
      label: "Pagar estudio",
      detail: "$25/$35",
      value: 25,
      max: 35,
      color: "#d65a8a",
    });
  });

  it("shows the record goal when cash covers the studio", () => {
    const state = createNewState("Test", SEED);
    state.discProgress = 80;
    state.cash = 50;
    const goals = getCareerGoals(state);
    expect(goals[1]).toEqual({
      label: "Grabar tema",
      detail: "Listo para entrar al estudio",
      value: 1,
      max: 1,
      color: "#77c46b",
    });
  });

  it("shows the legacy goal at the final stage", () => {
    const state = createNewState("Test", SEED);
    state.stage = "leyenda";
    state.fame = 3000;
    state.fans = 6000;
    const goals = getCareerGoals(state);
    expect(goals[0]).toEqual({
      label: "Legado",
      detail: "Fama 3000 · Fans 6000",
      value: 2500,
      max: 2500,
      color: "#d65a8a",
    });
  });
});

describe("applyRhythm", () => {
  it("grants the switch bonus on a fresh action", () => {
    const state = createNewState("Test", SEED);
    // repeatPenalty -4, no fatigue (energy 86), no night penalty (block 0).
    const messages = applyRhythm(state, "practice", 6);
    expect(messages).toEqual(["Impulso +10: Frio."]);
    expect(state.momentum).toBe(52);
    expect(state.lastActionId).toBe("practice");
    expect(state.actionStreak).toBe(1);
  });

  it("escalates the repeat penalty and caps it at 12", () => {
    const state = createNewState("Test", SEED);
    applyRhythm(state, "practice", 6); // momentum 52, streak 1
    const second = applyRhythm(state, "practice", 6); // penalty min(12, 8) = 8
    expect(second).toEqual(["Impulso -2: Frio."]);
    expect(state.momentum).toBe(50);
    expect(state.actionStreak).toBe(2);
    const third = applyRhythm(state, "practice", 6); // penalty min(12, 12) = 12
    expect(third).toEqual(["Impulso -6: Frio."]);
    expect(state.momentum).toBe(44);
    const fourth = applyRhythm(state, "practice", 6); // penalty stays 12
    expect(fourth).toEqual(["Impulso -6: Frio."]);
    expect(state.momentum).toBe(38);
  });

  it("applies the fatigue penalty below 24 energy", () => {
    const state = createNewState("Test", SEED);
    state.energy = 20;
    const messages = applyRhythm(state, "write", 6); // 6 + 4 - 5 = 5
    expect(messages).toEqual(["Impulso +5: Frio."]);
    expect(state.momentum).toBe(47);
  });

  it("applies the night penalty in the Noche block", () => {
    const state = createNewState("Test", SEED);
    state.block = 2;
    const messages = applyRhythm(state, "write", 6); // 6 + 4 - 3 = 7
    expect(messages).toEqual(["Impulso +7: Frio."]);
    expect(state.momentum).toBe(49);
  });

  it("skips the night penalty in the morning and afternoon blocks", () => {
    for (const block of [0, 1]) {
      const state = createNewState("Test", SEED);
      state.block = block;
      const messages = applyRhythm(state, "write", 6); // 6 + 4 = 10
      expect(messages).toEqual(["Impulso +10: Frio."]);
      expect(state.momentum).toBe(52);
    }
  });

  it("exempts rest from fatigue and night penalties", () => {
    const state = createNewState("Test", SEED);
    state.energy = 20;
    state.block = 2;
    const messages = applyRhythm(state, "rest", 10); // 10 + 4 = 14
    expect(messages).toEqual(["Impulso +14: Activo."]);
    expect(state.momentum).toBe(56);
  });

  it("reports a stable pulse when the delta is zero", () => {
    const state = createNewState("Test", SEED);
    state.lastActionId = "practice";
    state.actionStreak = 0;
    // repeated: streak becomes 1, penalty min(12, 4) = 4, delta 4 - 4 = 0.
    const messages = applyRhythm(state, "practice", 4);
    expect(messages).toEqual(["Impulso estable: Frio."]);
    expect(state.momentum).toBe(42);
  });
});

describe("rhythmPreview", () => {
  it("previews the switch bonus without mutating state", () => {
    const state = createNewState("Test", SEED);
    expect(rhythmPreview(state, "practice", 6)).toBe("Impulso +10");
    expect(state.momentum).toBe(42);
    expect(state.lastActionId).toBeNull();
    expect(state.actionStreak).toBe(0);
  });

  it("previews the next repeat penalty using streak + 1", () => {
    const state = createNewState("Test", SEED);
    state.lastActionId = "practice";
    state.actionStreak = 1; // next penalty min(12, 8) = 8
    expect(rhythmPreview(state, "practice", 6)).toBe("Impulso -2");
  });

  it("previews the night penalty in the Noche block", () => {
    const state = createNewState("Test", SEED);
    state.block = 2;
    expect(rhythmPreview(state, "write", 6)).toBe("Impulso +7"); // 6 + 4 - 3
    expect(rhythmPreview(state, "rest", 6)).toBe("Impulso +10"); // rest exempt
  });

  it("returns the neutral label at zero delta", () => {
    const state = createNewState("Test", SEED);
    state.lastActionId = "practice";
    state.actionStreak = 0; // next penalty min(12, 4) = 4
    expect(rhythmPreview(state, "practice", 4)).toBe("Impulso neutro");
  });
});
