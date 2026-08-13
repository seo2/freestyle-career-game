// The wiring is the part that decides WHEN the game speaks, so these tests pin
// the two failure modes that would matter: a beat that stays silent, and a beat
// that fires twice for one event.

import { describe, expect, it, beforeEach } from "vitest";
import { EventBus } from "../events/EventBus";
import { wireAudio } from "./audioWiring";
import { AudioService } from "../services/AudioService";
import { createNewState } from "../core/state";
import type { GameState, RoundResult } from "../core/types";

function round(n: number, delta: number): RoundResult {
  return {
    round: n,
    choice: "punchline",
    rivalChoice: "ataque",
    player: 10,
    rival: 5,
    note: "",
    tensionNotes: [],
    playerHypeDelta: delta,
    playerVerdict: delta > 0 ? "BUENISIMO" : "DEBIL",
    rivalHypeDelta: 0,
    rivalVerdict: "",
  };
}

describe("audio wiring", () => {
  let bus: EventBus;
  let audio: AudioService;
  let state: GameState;

  beforeEach(() => {
    bus = new EventBus();
    // No WebAudio in node: the service still logs what it was asked for, which is
    // exactly what these tests read.
    audio = new AudioService(state?.audio ?? { volume: 6, sfxOn: true, musicOn: true }, () => null);
    state = createNewState("Test", 1);
    state.mode = "career";
    wireAudio(bus, audio, () => state);
    audio.drainLog();
  });

  it("speaks when the cursor moves and when a screen opens", () => {
    bus.emit("FOCUS_CHANGED", undefined);
    bus.emit("CAREER_VIEW_CHANGED", "calendar");
    expect(audio.drainLog()).toEqual(["uiMove", "uiConfirm"]);
  });

  it("gives a dilemma its own sound, not a generic confirm", () => {
    bus.emit("MODE_CHANGED", "dilemma");
    expect(audio.drainLog()).toEqual(["dilemma"]);
  });

  it("plays a round's verdict once, not on every redraw", () => {
    state.battle = { pendingResult: round(1, 12) } as GameState["battle"];
    bus.emit("STATE_CHANGED", undefined);
    bus.emit("STATE_CHANGED", undefined);
    bus.emit("STATE_CHANGED", undefined);
    // Three redraws, one verdict: the beat is the round resolving, not the frame.
    expect(audio.drainLog()).toEqual(["verdictGreat"]);
  });

  it("distinguishes a round that went well from one that did not", () => {
    state.battle = { pendingResult: round(1, 14) } as GameState["battle"];
    bus.emit("STATE_CHANGED", undefined);
    state.battle = { pendingResult: round(2, -6) } as GameState["battle"];
    bus.emit("STATE_CHANGED", undefined);
    expect(audio.drainLog()).toEqual(["verdictGreat", "verdictWeak"]);
  });

  it("marks the end of a battle by its result", () => {
    state.battle = { result: "loss" } as GameState["battle"];
    bus.emit("STATE_CHANGED", undefined);
    expect(audio.drainLog()).toEqual(["battleLoss"]);
  });

  it("celebrates a level and a closed week", () => {
    state.level += 1;
    bus.emit("STATE_CHANGED", undefined);
    state.week += 1;
    bus.emit("STATE_CHANGED", undefined);
    expect(audio.drainLog()).toEqual(["levelUp", "weekClose"]);
  });

  it("only chimes for money arriving, never for money leaving", () => {
    state.cash += 40;
    bus.emit("STATE_CHANGED", undefined);
    expect(audio.drainLog()).toEqual(["cash"]);
    state.cash -= 40;
    bus.emit("STATE_CHANGED", undefined);
    expect(audio.drainLog()).toEqual([]);
  });

  it("stops listening once unwired, so a scene restart cannot double every sound", () => {
    const bus2 = new EventBus();
    const off = wireAudio(bus2, audio, () => state);
    audio.drainLog();
    off();
    bus2.emit("FOCUS_CHANGED", undefined);
    expect(audio.drainLog()).toEqual([]);
  });
});
