// Turns what the game DOES into what the game SOUNDS like (Fase 8).
//
// This listens to the event bus and diffs a few scalars between STATE_CHANGED
// beats instead of asking GameController to emit a new event per sound. That is a
// deliberate trade: audio is decoration, and decoration should not get to add
// obligations to the systems layer. Everything it needs — a level that went up, a
// week that rolled over, a round verdict that appeared — is already visible in the
// state it is handed, so the coupling stays one-way and this whole file can be
// deleted without touching a single rule.
//
// Presentation only: it never mutates state.

import type { EventBus } from "../events/EventBus";
import type { GameState } from "../core/types";
import type { AudioService } from "../services/AudioService";
import type { SoundId } from "../data/sounds";

interface Snapshot {
  mode: string;
  level: number;
  week: number;
  cash: number;
  // Which round's verdict is parked on screen, so one round resolving plays once.
  verdictRound: number | null;
  // Whether that verdict went the player's way. The verdict itself is a Spanish
  // word chosen by BattleConfig; the mechanical signal is the hype it earned.
  verdictWon: boolean;
  battleResult: string | null;
}

function snapshot(state: GameState): Snapshot {
  return {
    mode: state.mode,
    level: state.level,
    week: state.week,
    cash: state.cash,
    verdictRound: state.battle?.pendingResult?.round ?? null,
    verdictWon: (state.battle?.pendingResult?.playerHypeDelta ?? 0) > 0,
    battleResult: state.battle?.result ?? null,
  };
}

// What a mode change sounds like. A dilemma stops the loop, so it gets its own
// unresolved interval; the rest just confirm.
const MODE_SOUND: Record<string, SoundId | undefined> = {
  dilemma: "dilemma",
  epilogue: "levelUp",
  battle: "uiConfirm",
  cypher: "uiConfirm",
  // Entering the game at all. Its absence was the first thing the audio log
  // caught: starting a new career made no sound whatsoever.
  career: "uiConfirm",
};

export function wireAudio(bus: EventBus, audio: AudioService, readState: () => GameState): () => void {
  let last = snapshot(readState());

  const offState = bus.on("STATE_CHANGED", () => {
    const now = snapshot(readState());

    // A round's verdict appearing is the loudest beat of a battle.
    if (now.verdictRound !== null && now.verdictRound !== last.verdictRound) {
      audio.play(now.verdictWon ? "verdictGreat" : "verdictWeak");
    }
    if (now.battleResult && now.battleResult !== last.battleResult) {
      audio.play(now.battleResult === "loss" ? "battleLoss" : "battleWin");
    }
    if (now.level > last.level) audio.play("levelUp");
    if (now.week > last.week) audio.play("weekClose");
    // Only money ARRIVING makes a sound; spending it already has its own screen.
    else if (now.cash > last.cash) audio.play("cash");

    last = now;
  });

  const offMode = bus.on("MODE_CHANGED", (mode) => {
    const sound = MODE_SOUND[mode];
    if (sound) audio.play(sound);
    last = snapshot(readState());
  });

  const offFocus = bus.on("FOCUS_CHANGED", () => audio.play("uiMove"));
  const offView = bus.on("CAREER_VIEW_CHANGED", () => audio.play("uiConfirm"));

  return () => {
    offState();
    offMode();
    offFocus();
    offView();
  };
}
