// The epilogue is the payoff of "mismo origen, destinos distintos": the same
// milestone, reached by different decisions, has to read differently. These tests
// pin that, and that the chapter measures the chapter it is actually about.

import { describe, expect, it } from "vitest";
import { createNewState } from "../core/state";
import { maybeUnlockStage } from "./ProgressionSystem";
import { buildEpilogue, closeEpilogue, destinyFor, openEpilogue } from "./EpilogueSystem";
import { destinyAttractors, stageChapters, undecidedLine } from "../data/epilogues";
import type { GameState, IdentityAxes } from "../core/types";

function career(week = 5): GameState {
  const state = createNewState("Test", 1);
  state.mode = "career";
  state.week = week;
  state.stageStartedWeek = 1;
  state.epilogueFromWeek = 1;
  return state;
}

function axes(partial: Partial<IdentityAxes>): IdentityAxes {
  return { undergroundComercial: 0, batalleroMusico: 0, soloCrew: 0, autenticoPolemico: 0, ...partial };
}

describe("openEpilogue", () => {
  it("stops the loop on the chapter and remembers when that chapter began", () => {
    const state = career(6);
    state.stageStartedWeek = 2;
    openEpilogue(state, "pieza");
    expect(state.mode).toBe("epilogue");
    expect(state.pendingEpilogue).toBe("pieza");
    // The closing chapter's start must survive the new stage's clock starting,
    // or the epilogue measures the wrong chapter (it reported 1 week and 0
    // decisions before this was split in two fields).
    expect(state.epilogueFromWeek).toBe(2);
    expect(state.stageStartedWeek).toBe(6);
  });

  it("is opened by the stage advance itself, not by the caller remembering to", () => {
    const state = career();
    // One point short of nothing: plaza's requirements met.
    state.level = 20;
    state.fans = 5000;
    state.respect = 500;
    state.fame = 500;
    const message = maybeUnlockStage(state);
    expect(message).not.toBeNull();
    expect(state.stage).not.toBe("pieza");
    expect(state.mode).toBe("epilogue");
    expect(state.pendingEpilogue).toBe("pieza");
  });

  it("closing it returns to the career and leaves nothing behind", () => {
    const state = career();
    openEpilogue(state, "pieza");
    closeEpilogue(state);
    expect(state.mode).toBe("career");
    expect(state.pendingEpilogue).toBeNull();
  });
});

describe("buildEpilogue measures the chapter it is about", () => {
  it("counts the weeks, the battles and only the decisions of that chapter", () => {
    const state = career(7);
    state.epilogueFromWeek = 4;
    state.decisions = [
      { dilemmaId: "a", optionId: "x", week: 2, day: 1, title: "vieja", choice: "Vieja", outcome: "", axes: {} },
      { dilemmaId: "b", optionId: "y", week: 5, day: 1, title: "esta", choice: "Esta", outcome: "", axes: {} },
      { dilemmaId: "c", optionId: "z", week: 6, day: 1, title: "otra", choice: "Otra", outcome: "", axes: {} },
    ];
    state.weekLog = [
      { week: 2, days: [], cash: 0, fans: 0, respect: 0, fame: 0, xp: 0, battlesWon: 9, battlesLost: 9 },
      { week: 5, days: [], cash: 0, fans: 0, respect: 0, fame: 0, xp: 0, battlesWon: 2, battlesLost: 1 },
    ];
    const epilogue = buildEpilogue(state, "pieza");
    if (!epilogue) throw new Error("expected an epilogue");
    expect(epilogue.weeks).toBe(4); // weeks 4..7
    // The previous chapter's decisions and battles stay in the previous chapter.
    expect(epilogue.decisions.map((entry) => entry.choice)).toEqual(["Esta", "Otra"]);
    expect(epilogue.battlesWon).toBe(2);
    expect(epilogue.battlesLost).toBe(1);
  });

  it("reads the undecided line for an MC who never leaned anywhere", () => {
    const state = career();
    const epilogue = buildEpilogue(state, "pieza");
    expect(epilogue?.chapterLines).toEqual([undecidedLine]);
    expect(epilogue?.destiny).toBeNull();
  });

  it("orders the chapter by how hard each axis leaned", () => {
    const state = career();
    state.axes = axes({ soloCrew: 20, undergroundComercial: -60 });
    const epilogue = buildEpilogue(state, "pieza");
    if (!epilogue) throw new Error("expected an epilogue");
    // The strongest lean speaks first: -60 underground before +20 crew.
    expect(epilogue.chapterLines[0]).toContain("No firmaste nada");
    expect(epilogue.chapterLines).toHaveLength(2);
  });

  it("returns null for a stage with no chapter written", () => {
    const state = career();
    expect(buildEpilogue(state, "leyenda")).toBeNull();
    expect(Object.keys(stageChapters)).not.toContain("leyenda");
  });
});

describe("mismo origen, destinos distintos", () => {
  it("gives the same milestone different chapters when the decisions differed", () => {
    const underground = career();
    underground.axes = axes({ undergroundComercial: -46, batalleroMusico: -32, soloCrew: 34 });
    const commercial = career();
    commercial.axes = axes({ undergroundComercial: 52, batalleroMusico: 30, soloCrew: -28 });

    const a = buildEpilogue(underground, "pieza");
    const b = buildEpilogue(commercial, "pieza");
    if (!a || !b) throw new Error("expected epilogues");
    // Same stage, same week, same everything except what they chose.
    expect(a.title).toBe(b.title);
    expect(a.chapterLines).not.toEqual(b.chapterLines);
    expect(a.destiny?.label).not.toBe(b.destiny?.label);
  });

  it("names the destiny the player leaned into hardest, not the first one listed", () => {
    // Both "productor" (musico >= 30) and "estrella" (comercial >= 35) hold here,
    // and productor is listed first — but +52 comercial is the stronger signal.
    const state = career();
    state.axes = axes({ undergroundComercial: 52, batalleroMusico: 30 });
    expect(destinyFor(state)?.label).toBe("Estrella");

    // ...and the other way round, from the same catalogue.
    const producer = career();
    producer.axes = axes({ undergroundComercial: 36, batalleroMusico: 90 });
    expect(destinyFor(producer)?.label).toBe("Productor");
  });

  it("gives no destiny to an MC who has not leaned far enough", () => {
    const state = career();
    state.axes = axes({ undergroundComercial: 10, soloCrew: 10 });
    expect(destinyFor(state)).toBeNull();
  });

  it("keeps every attractor reachable: none is shadowed by another", () => {
    // A catalogue where one profile can never be read is dead content.
    for (const attractor of destinyAttractors) {
      const state = career();
      const built = axes({});
      for (const [axis, needed] of Object.entries(attractor.needs)) {
        built[axis as keyof IdentityAxes] = needed >= 0 ? needed + 30 : needed - 30;
      }
      state.axes = built;
      expect(destinyFor(state)?.label).toBe(attractor.label);
    }
  });
});
