import Phaser from "phaser";
import { allAssetEntries } from "../game/AssetRegistry";
import { gameContext } from "../game/context";
import { targetSceneKey } from "../game/SceneDirector";
import { hex, palette } from "../ui/palette";

// Loads every registered asset, then hands off to the scene director via the
// first real screen. Missing files must not block the game (procedural
// fallbacks cover them), so load errors are tolerated.

export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  preload(): void {
    this.cameras.main.setBackgroundColor(hex(palette.deep));
    for (const entry of allAssetEntries()) {
      this.load.image(entry.key, entry.path);
    }
    this.load.on("loaderror", (file: Phaser.Loader.File) => {
      // Tolerated: scenes check texture existence before using images.
      console.warn(`Asset failed to load: ${file.key}`);
    });
  }

  create(): void {
    this.scene.start(targetSceneKey(gameContext().controller));
  }
}
