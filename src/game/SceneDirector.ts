// Switches the active scene to match the game mode. Scenes never switch
// each other directly — the controller emits MODE_CHANGED / STATE_CHANGED
// and the director reconciles.

import type Phaser from "phaser";
import { eventBus } from "../events/EventBus";
import type { GameController } from "../managers/GameController";

const GAME_SCENES = ["Menu", "CreateMc", "Career", "Battle", "Cypher", "Dilemma", "Epilogue"] as const;
export type GameSceneKey = (typeof GAME_SCENES)[number];

export function targetSceneKey(controller: GameController): GameSceneKey {
  const { state, creatingNew } = controller;
  if (state.mode === "battle") return "Battle";
  if (state.mode === "cypher") return "Cypher";
  if (state.mode === "dilemma") return "Dilemma";
  if (state.mode === "epilogue") return "Epilogue";
  if (state.mode === "career") return "Career";
  return controller.hasSave() && !creatingNew ? "Menu" : "CreateMc";
}

export class SceneDirector {
  constructor(
    private readonly game: Phaser.Game,
    private readonly controller: GameController,
  ) {
    eventBus.on("MODE_CHANGED", () => this.reconcile());
    eventBus.on("STATE_CHANGED", () => this.reconcile());
  }

  target(): GameSceneKey {
    return targetSceneKey(this.controller);
  }

  private activeKey(): GameSceneKey | null {
    for (const key of GAME_SCENES) {
      const scene = this.game.scene.getScene(key);
      if (scene && this.game.scene.isActive(key)) return key;
    }
    return null;
  }

  reconcile(): void {
    const target = this.target();
    const active = this.activeKey();
    if (active === target) return;
    if (active) this.game.scene.stop(active);
    this.game.scene.start(target);
  }
}
