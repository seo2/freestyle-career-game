import { describe, expect, it } from "vitest";
import { stages } from "./stages";
import { battleRivals } from "./battle";

describe("stages data", () => {
  it("defines the 7 career stages in canonical order", () => {
    expect(stages.map((stage) => stage.id)).toEqual([
      "pieza",
      "plaza",
      "regional",
      "nacional",
      "internacional",
      "estrella",
      "leyenda",
    ]);
  });

  it("has strictly increasing unlock requirements", () => {
    for (let i = 1; i < stages.length; i += 1) {
      expect(stages[i].minLevel).toBeGreaterThan(stages[i - 1].minLevel);
      expect(stages[i].minFans).toBeGreaterThanOrEqual(stages[i - 1].minFans);
      expect(stages[i].minRespect).toBeGreaterThanOrEqual(stages[i - 1].minRespect);
      expect(stages[i].minFame).toBeGreaterThanOrEqual(stages[i - 1].minFame);
    }
  });

  it("has a battle rival lineup for every stage", () => {
    expect(battleRivals).toHaveLength(stages.length);
  });
});
