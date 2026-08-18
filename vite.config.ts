// Vite config. Two entry points: the game (index.html) and the standalone
// Creador de Avatar (avatar.html). The creator is its own page because it is a web
// UI with real typography, while the game is a Phaser canvas — see
// src/avatar/creator/main.ts.
import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  server: { host: "0.0.0.0" },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        avatar: resolve(__dirname, "avatar.html"),
      },
    },
  },
});
