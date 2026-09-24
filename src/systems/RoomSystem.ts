// Which props the pieza has earned (Fase 12 C). Pure reads of GameState: the
// room is a picture of the career, so it is derived, never stored — an old save
// shows every prop it has already earned the first time it loads.

import type { GameState } from "../core/types";
import { roomProps } from "../data/roomProps";
import type { RoomPropDef, RoomUnlock } from "../data/roomProps";
import { battlesWon } from "./RelationshipSystem";

export { battlesWon };

export function roomUnlocked(state: GameState, unlock: RoomUnlock): boolean {
  switch (unlock.kind) {
    case "item":
      return state.items.includes(unlock.id);
    case "release":
      return state.releases.includes(unlock.id);
    case "fans":
      return state.fans >= unlock.min;
    case "wins":
      return battlesWon(state) >= unlock.min;
    case "rank":
      return state.stats[unlock.stat] >= unlock.min;
  }
}

export function earnedRoomProps(state: GameState): RoomPropDef[] {
  return roomProps.filter((prop) => roomUnlocked(state, prop.unlock));
}
