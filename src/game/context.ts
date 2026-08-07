// Module-level game context: gives scenes access to the controller and input
// router without threading constructor params through Phaser's scene manager.

import type { GameController } from "../managers/GameController";
import type { InputRouter } from "./InputRouter";

export interface GameContext {
  controller: GameController;
  input: InputRouter;
}

let current: GameContext | null = null;

export function setGameContext(context: GameContext): void {
  current = context;
}

export function gameContext(): GameContext {
  if (!current) throw new Error("Game context not initialized");
  return current;
}
