// Relationships exist to make the week harder to plan. These tests pin the two
// things that do that work: a bond that costs you when you stop showing up, and
// a rival who is not the same opponent the second time.

import { describe, expect, it } from "vitest";
import { createNewState } from "../core/state";
import {
  affinityOf,
  bondTemperature,
  crewHypeBoost,
  decayRelationships,
  feedBonds,
  applyAxisPull,
  recordRivalry,
  relationshipSummary,
  restHealthBonus,
  rivalryEdge,
  rivalryLine,
  rivalryWith,
} from "./RelationshipSystem";
import { RelationshipConfig } from "../data/config/RelationshipConfig";
import { bondDefs } from "../data/bonds";
import type { GameState } from "../core/types";

function career(week = 3): GameState {
  const state = createNewState("Test", 1);
  state.mode = "career";
  state.week = week;
  return state;
}

describe("bonds decay when you stop showing up", () => {
  it("charges a week that got no attention", () => {
    const state = career(3);
    const before = affinityOf(state, "familia");
    // The bond was last fed in week 1; weeks 2 and 3 went by.
    decayRelationships(state);
    expect(affinityOf(state, "familia")).toBe(before - RelationshipConfig.bonds.decayPerWeek);
  });

  it("charges nothing for a week you did show up", () => {
    const state = career(3);
    feedBonds(state, "rest");
    const after = affinityOf(state, "familia");
    decayRelationships(state);
    expect(affinityOf(state, "familia")).toBe(after);
  });

  it("says it out loud the week a bond turns cold, and only that week", () => {
    const state = career(2);
    state.bonds.familia = { affinity: RelationshipConfig.bonds.coldAt + 2, fedWeek: 1 };
    // Keep the crew warm and fed: otherwise IT crosses the cold line here too
    // and the assertion stops being about the bond under test.
    state.bonds.crew = { affinity: RelationshipConfig.bonds.max, fedWeek: 99 };
    const crossing = decayRelationships(state);
    expect(crossing.some((line) => line === bondDefs[0].coldLine)).toBe(true);
    // Already cold: repeating the line every week would be nagging, not news.
    state.week += 1;
    expect(decayRelationships(state)).toEqual([]);
    expect(bondTemperature(state, "familia")).toBe("cold");
  });

  it("never falls below zero or climbs past the ceiling", () => {
    const state = career(40);
    state.bonds.crew = { affinity: 1, fedWeek: 1 };
    for (let i = 0; i < 10; i += 1) decayRelationships(state);
    expect(affinityOf(state, "crew")).toBe(RelationshipConfig.bonds.min);
    for (let i = 0; i < 40; i += 1) feedBonds(state, "cypher");
    expect(affinityOf(state, "crew")).toBe(RelationshipConfig.bonds.max);
  });
});

describe("showing up is what feeds a bond", () => {
  it("counts resting for the family and the cypher for the crew, not the other way round", () => {
    const state = career();
    const familia = affinityOf(state, "familia");
    const crew = affinityOf(state, "crew");
    feedBonds(state, "rest");
    expect(affinityOf(state, "familia")).toBeGreaterThan(familia);
    expect(affinityOf(state, "crew")).toBe(crew);

    const afterRest = affinityOf(state, "familia");
    feedBonds(state, "cypher");
    expect(affinityOf(state, "crew")).toBeGreaterThan(crew);
    expect(affinityOf(state, "familia")).toBe(afterRest);
  });

  it("an action nobody counts as attention feeds nothing", () => {
    const state = career();
    const before = { familia: affinityOf(state, "familia"), crew: affinityOf(state, "crew") };
    expect(feedBonds(state, "work")).toEqual([]);
    expect(affinityOf(state, "familia")).toBe(before.familia);
    expect(affinityOf(state, "crew")).toBe(before.crew);
  });

  it("a decision moves the bond it is about without paying the week's visit", () => {
    const state = career(5);
    state.bonds.crew = { affinity: 40, fedWeek: 1 };
    applyAxisPull(state, { soloCrew: 20 });
    expect(affinityOf(state, "crew")).toBeGreaterThan(40);
    // Crucially the clock did NOT reset: answering dilemmas cannot replace
    // showing up, or the decay would never bite.
    expect(state.bonds.crew.fedWeek).toBe(1);
  });

  it("choosing yourself over the crew cools the crew", () => {
    const state = career();
    const before = affinityOf(state, "crew");
    applyAxisPull(state, { soloCrew: -30 });
    expect(affinityOf(state, "crew")).toBeLessThan(before);
  });
});

describe("bonds pay and charge in the game's own currencies", () => {
  it("the family makes a night of rest worth more, or less", () => {
    const warm = career();
    warm.bonds.familia = { affinity: RelationshipConfig.bonds.max, fedWeek: 1 };
    const cold = career();
    cold.bonds.familia = { affinity: RelationshipConfig.bonds.min, fedWeek: 1 };
    expect(restHealthBonus(warm)).toBeGreaterThan(0);
    expect(restHealthBonus(cold)).toBeLessThan(0);
    expect(restHealthBonus(warm)).toBeGreaterThan(restHealthBonus(cold));
  });

  it("the crew brings hype to a battle only if it is still your crew", () => {
    const warm = career();
    warm.bonds.crew = { affinity: RelationshipConfig.bonds.max, fedWeek: 1 };
    const gone = career();
    gone.bonds.crew = { affinity: RelationshipConfig.bonds.min, fedWeek: 1 };
    expect(crewHypeBoost(warm)).toBe(RelationshipConfig.crew.hypeAtMax);
    expect(crewHypeBoost(gone)).toBe(RelationshipConfig.crew.hypeAtMin);
  });

  it("reads warm, cold or neither from the same thresholds the screens use", () => {
    const state = career();
    state.bonds.familia = { affinity: RelationshipConfig.bonds.warmAt, fedWeek: 1 };
    expect(bondTemperature(state, "familia")).toBe("warm");
    state.bonds.familia = { affinity: RelationshipConfig.bonds.coldAt, fedWeek: 1 };
    expect(bondTemperature(state, "familia")).toBe("cold");
    state.bonds.familia = { affinity: (RelationshipConfig.bonds.warmAt + RelationshipConfig.bonds.coldAt) / 2, fedWeek: 1 };
    expect(bondTemperature(state, "familia")).toBe("steady");
  });

  it("names what is going wrong before what is going right", () => {
    const state = career();
    state.bonds.familia = { affinity: RelationshipConfig.bonds.max, fedWeek: 1 };
    state.bonds.crew = { affinity: RelationshipConfig.bonds.min, fedWeek: 1 };
    // A player who is losing someone needs to hear that, not a compliment.
    expect(relationshipSummary(state)).toContain("alejando");
    expect(relationshipSummary(state)).toContain("Crew");
  });
});

describe("rivalries remember", () => {
  it("records the record from the player's side", () => {
    const state = career();
    recordRivalry(state, "La Sombra", "win", 1);
    recordRivalry(state, "La Sombra", "loss", -1);
    const rivalry = rivalryWith(state, "La Sombra");
    expect(rivalry).not.toBeNull();
    expect(rivalry?.faced).toBe(2);
    expect(rivalry?.won).toBe(1);
    expect(rivalry?.lost).toBe(1);
  });

  it("beating someone makes them want you more than losing to them does", () => {
    const beaten = career();
    recordRivalry(beaten, "La Sombra", "win", 1);
    const lostTo = career();
    recordRivalry(lostTo, "La Sombra", "loss", -1);
    expect(rivalryWith(beaten, "La Sombra")?.heat).toBeGreaterThan(rivalryWith(lostTo, "La Sombra")?.heat ?? 0);
  });

  it("a landslide is humiliation and says so", () => {
    const close = career();
    recordRivalry(close, "La Sombra", "win", 1);
    const landslide = career();
    const messages = recordRivalry(landslide, "La Sombra", "win", RelationshipConfig.rivalry.humiliationMargin);
    expect(rivalryWith(landslide, "La Sombra")?.heat).toBeGreaterThan(rivalryWith(close, "La Sombra")?.heat ?? 0);
    expect(messages.join(" ")).toContain("no va a olvidar");
  });

  it("a grudge buys the rival power and aggression, bounded", () => {
    const state = career();
    expect(rivalryEdge(state, "La Sombra")).toEqual({ power: 0, aggression: 0 });
    state.rivalries.push({ name: "La Sombra", faced: 9, won: 9, lost: 0, heat: RelationshipConfig.rivalry.max, lastWeek: 1 });
    const edge = rivalryEdge(state, "La Sombra");
    expect(edge.power).toBe(RelationshipConfig.rivalry.maxPowerBonus);
    expect(edge.aggression).toBe(RelationshipConfig.rivalry.aggressionAtMaxHeat);
  });

  it("says nothing about a rival who barely remembers you", () => {
    const state = career();
    state.rivalries.push({
      name: "Nico Cuaderno",
      faced: 1,
      won: 0,
      lost: 1,
      heat: RelationshipConfig.rivalry.readableAt - 1,
      lastWeek: 1,
    });
    // Silence is the honest read: a warning line for every opponent would make
    // the real grudges invisible.
    expect(rivalryLine(state, "Nico Cuaderno")).toBeNull();
    expect(rivalryEdge(state, "Nico Cuaderno").power).toBe(0);
  });

  it("gets louder as the heat climbs", () => {
    const state = career();
    state.rivalries.push({ name: "La Sombra", faced: 1, won: 1, lost: 0, heat: 25, lastWeek: 1 });
    const mild = rivalryLine(state, "La Sombra");
    state.rivalries[0].heat = RelationshipConfig.rivalry.max;
    const furious = rivalryLine(state, "La Sombra");
    expect(mild).not.toBeNull();
    expect(furious).not.toBeNull();
    expect(furious).not.toBe(mild);
  });

  it("cools a grudge nobody renewed, and never past zero", () => {
    const state = career(2);
    recordRivalry(state, "La Sombra", "win", 1);
    const hot = rivalryWith(state, "La Sombra")?.heat ?? 0;
    state.week = 5;
    decayRelationships(state);
    expect(rivalryWith(state, "La Sombra")?.heat).toBe(hot - RelationshipConfig.rivalry.decayPerWeek);
    for (let i = 0; i < 60; i += 1) {
      state.week += 1;
      decayRelationships(state);
    }
    expect(rivalryWith(state, "La Sombra")?.heat).toBe(0);
  });

  it("keeps the ledger bounded so a long career cannot bloat the save", () => {
    const state = career();
    for (let i = 0; i < RelationshipConfig.log.maxRivalries + 8; i += 1) {
      recordRivalry(state, `Rival ${i}`, "win", 1);
    }
    expect(state.rivalries.length).toBe(RelationshipConfig.log.maxRivalries);
  });
});
