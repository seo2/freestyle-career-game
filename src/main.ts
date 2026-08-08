// Game bootstrap: wires the controller, input, scenes and deterministic test
// hooks. All rules live in src/systems; all presentation in src/scenes.

import "./styles.css";

import Phaser from "phaser";
import { GameController } from "./managers/GameController";
import { InputRouter } from "./game/InputRouter";
import { SceneDirector } from "./game/SceneDirector";
import { setGameContext } from "./game/context";
import { BootScene } from "./scenes/BootScene";
import { MenuScene } from "./scenes/MenuScene";
import { CreateMcScene } from "./scenes/CreateMcScene";
import { CareerScene } from "./scenes/CareerScene";
import { BattleScene } from "./scenes/BattleScene";
import { hex, palette } from "./ui/palette";

const controller = new GameController(localStorage);
const input = new InputRouter(controller);
setGameContext({ controller, input });

// The arcade display face must resolve before any scene measures text, or
// Phaser caches metrics for the fallback font. Boot is gated on it, with a
// timeout so a missing font file can never brick the game.
const fontsReady = Promise.race([
  document.fonts.load('16px "Press Start 2P"'),
  new Promise((resolve) => setTimeout(resolve, 1500)),
]);

fontsReady.then(() => {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game-root",
    width: 960,
    height: 540,
    backgroundColor: hex(palette.deep),
    pixelArt: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [BootScene, MenuScene, CreateMcScene, CareerScene, BattleScene],
  });
  new SceneDirector(game, controller);
});

// Deterministic test hooks (project rule: keep working across refactors).
window.render_game_to_text = () => controller.renderGameToText();
window.advanceTime = (ms: number) => {
  const steps = Math.max(1, Math.round(ms / (1000 / 60)));
  for (let i = 0; i < steps; i += 1) controller.update(1 / 60);
};

declare global {
  interface Window {
    render_game_to_text: () => string;
    advanceTime: (ms: number) => void;
  }
}

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // The game still runs without offline cache.
    });
  });
}
