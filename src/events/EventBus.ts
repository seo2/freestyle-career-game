// Typed event bus (AGENTS.md: systems/UI communicate through events).
// The GameController emits; scenes and the input router listen.

import type { CareerView, GameMode, TimeAdvance } from "../core/types";

export interface GameEventMap {
  STATE_CHANGED: void;
  MODE_CHANGED: GameMode;
  CAREER_VIEW_CHANGED: CareerView;
  TIME_ADVANCED: TimeAdvance;
  BATTLE_STARTED: void;
  BATTLE_FINISHED: void;
  FOCUS_CHANGED: void;
}

export type GameEventName = keyof GameEventMap;

type Handler<E extends GameEventName> = (payload: GameEventMap[E]) => void;

export class EventBus {
  private handlers = new Map<GameEventName, Set<Handler<GameEventName>>>();

  on<E extends GameEventName>(event: E, handler: Handler<E>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as Handler<GameEventName>);
    return () => this.off(event, handler);
  }

  off<E extends GameEventName>(event: E, handler: Handler<E>): void {
    this.handlers.get(event)?.delete(handler as Handler<GameEventName>);
  }

  emit<E extends GameEventName>(event: E, payload: GameEventMap[E]): void {
    this.handlers.get(event)?.forEach((handler) => handler(payload));
  }
}

export const eventBus = new EventBus();
