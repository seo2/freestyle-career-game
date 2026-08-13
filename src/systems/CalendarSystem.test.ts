import { describe, it, expect } from "vitest";
import { createNewState } from "../core/state";
import { maxEnergy } from "../core/derived";
import { advanceClock, spendActionTime, formatBlock, formatDuration } from "./CalendarSystem";

// New state baseline: block 0 (Mañana), energy 86, health 88, momentum 42,
// level 1, disciplina 1, homeLevel 0 -> maxEnergy 93. Days have 3 blocks.

describe("advanceClock", () => {
  it("advances within the same day without recovery or messages", () => {
    const state = createNewState("Test", 1234);
    const result = advanceClock(state, 2, "Entrenar");

    expect(state.block).toBe(2);
    expect(state.day).toBe(1);
    expect(state.week).toBe(1);
    expect(state.energy).toBe(86);
    expect(state.health).toBe(88);
    expect(state.momentum).toBe(42);
    expect(result.messages).toEqual([]);
    expect(result.fx).toEqual({
      label: "Entrenar",
      fromBlock: 0,
      toBlock: 2,
      blocks: 2,
      daysPassed: 0,
    });
  });

  it("applies day rollover recovery when the day's blocks run out", () => {
    const state = createNewState("Test", 1234);
    state.energy = 40;
    const result = advanceClock(state, 3, "Trabajo");

    expect(state.block).toBe(0);
    expect(state.day).toBe(2);
    expect(state.week).toBe(1);
    // +8 + disciplina(1) energy, +2 health, -3 momentum per day.
    expect(state.energy).toBe(49);
    expect(state.health).toBe(90);
    expect(state.momentum).toBe(39);
    expect(result.messages).toEqual(["Paso un dia."]);
    expect(result.fx.daysPassed).toBe(1);
    expect(result.fx.fromBlock).toBe(0);
    expect(result.fx.toBlock).toBe(0);
  });

  it("clamps day rollover energy gain to maxEnergy", () => {
    const state = createNewState("Test", 1234);
    expect(maxEnergy(state)).toBe(93);
    state.energy = 90;
    advanceClock(state, 3, "Trabajo");
    expect(state.energy).toBe(93);
  });

  it("applies week rollover gains and message", () => {
    const state = createNewState("Test", 1234);
    state.day = 7;
    state.block = 2;
    state.energy = 10;
    const result = advanceClock(state, 1, "Descansar");

    expect(state.week).toBe(2);
    expect(state.day).toBe(1);
    expect(state.block).toBe(0);
    // Day gain: +8 + 1 = +9 -> 19. Week gain: +18 + 1*3 = +21 -> 40.
    expect(state.energy).toBe(40);
    // Health: 88 + 2 (day) + 6 (week) = 96.
    expect(state.health).toBe(96);
    expect(state.momentum).toBe(39);
    // Fase 6: the week closes with its summary before the counter moves, so the
    // summary line carries the week that ended, not the one starting.
    expect(result.messages).toEqual([
      "Paso un dia.",
      "Semana 1 cerrada: +$0, +0 fans, +0 respeto.",
      "Semana 2: recuperaste energia y la agenda esta vacia.",
    ]);
  });

  it("reports multi-day advances with plural message", () => {
    const state = createNewState("Test", 1234);
    state.energy = 5;
    const result = advanceClock(state, 7, "Gira");

    // 0 + 7 blocks: 3 close day 1, 3 close day 2, 1 remains -> block 1, day 3.
    expect(state.day).toBe(3);
    expect(state.block).toBe(1);
    expect(state.momentum).toBe(36);
    // Two day gains of +9 each: 5 -> 14 -> 23.
    expect(state.energy).toBe(23);
    expect(state.health).toBe(92);
    expect(result.messages).toEqual(["Paso 2 dias."]);
    expect(result.fx).toEqual({
      label: "Gira",
      fromBlock: 0,
      toBlock: 1,
      blocks: 7,
      daysPassed: 2,
    });
  });

  it("rounds fractional durations but keeps the raw value in fx", () => {
    const state = createNewState("Test", 1234);
    const result = advanceClock(state, 1.4, "Micro");
    expect(state.block).toBe(1);
    expect(result.fx.blocks).toBe(1.4);
    expect(result.fx.toBlock).toBe(1);
  });
});

describe("spendActionTime", () => {
  it("deducts energy and advances the clock", () => {
    const state = createNewState("Test", 1234);
    const result = spendActionTime(state, 12, 1, "Entrenar");

    expect(state.energy).toBe(74);
    expect(state.health).toBe(88);
    expect(state.block).toBe(1);
    expect(result.fx.label).toBe("Entrenar");
  });

  it("converts energy overdraft into a health penalty", () => {
    const state = createNewState("Test", 1234);
    state.energy = 5;
    spendActionTime(state, 15, 1, "Entrenar");

    // energy = clamp(5 - 15, -20, max) = -10 -> health += -10, energy = 0.
    expect(state.energy).toBe(0);
    expect(state.health).toBe(78);
    expect(state.block).toBe(1);
  });

  it("caps overdraft at the -20 energy floor", () => {
    const state = createNewState("Test", 1234);
    state.energy = 5;
    spendActionTime(state, 100, 1, "Entrenar");

    // energy = clamp(5 - 100, -20, max) = -20 -> health 88 - 20 = 68.
    expect(state.energy).toBe(0);
    expect(state.health).toBe(68);
  });
});

describe("formatting", () => {
  it("names each block of the day", () => {
    expect(formatBlock(0)).toBe("Mañana");
    expect(formatBlock(1)).toBe("Tarde");
    expect(formatBlock(2)).toBe("Noche");
  });

  it("formats durations in blocks", () => {
    expect(formatDuration(1)).toBe("1 bloque");
    expect(formatDuration(2)).toBe("2 bloques");
    expect(formatDuration(7)).toBe("7 bloques");
  });
});
