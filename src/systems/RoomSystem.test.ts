import { describe, expect, it } from "vitest";
import { createNewState } from "../core/state";
import { battlesWon, earnedRoomProps } from "./RoomSystem";
import { roomProps } from "../data/roomProps";

const ids = (state: ReturnType<typeof createNewState>): string[] => earnedRoomProps(state).map((p) => p.id);

describe("RoomSystem (Fase 12 C)", () => {
  it("starts the career with a bare room", () => {
    expect(ids(createNewState())).toEqual([]);
  });

  it("shows what you bought", () => {
    const state = createNewState();
    state.items.push("microfono", "zapatillas");
    expect(ids(state)).toEqual(expect.arrayContaining(["microfono", "zapatillas"]));
  });

  it("hangs the gold disc only once the disco is out", () => {
    const state = createNewState();
    state.releases.push("sencillo", "ep");
    expect(ids(state)).not.toContain("disco-oro");
    state.releases.push("disco");
    expect(ids(state)).toContain("disco-oro");
  });

  it("counts wins across every rival for the poster and the trophies", () => {
    const state = createNewState();
    state.rivalries.push({ name: "A", faced: 2, won: 1, lost: 1, heat: 0, lastWeek: 1 });
    expect(battlesWon(state)).toBe(1);
    expect(ids(state)).toContain("rap-to-win");
    expect(ids(state)).not.toContain("trofeos");
    state.rivalries.push({ name: "B", faced: 4, won: 4, lost: 0, heat: 0, lastWeek: 2 });
    expect(ids(state)).toContain("trofeos");
  });

  it("lights the neon when discipline reaches Callejero, and the plaque at 100.000 fans", () => {
    const state = createNewState();
    state.stats.disciplina = 5;
    state.fans = 100000;
    expect(ids(state)).toEqual(expect.arrayContaining(["neon-foco", "placa-100k"]));
  });

  it("gives every prop a unique id and a spot below the HUD", () => {
    const seen = new Set<string>();
    for (const prop of roomProps) {
      expect(seen.has(prop.id)).toBe(false);
      seen.add(prop.id);
      const top = prop.anchor === "center" ? prop.y - prop.h / 2 : prop.y - prop.h;
      expect(top).toBeGreaterThanOrEqual(86);
    }
  });
});
