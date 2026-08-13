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
import { CypherScene } from "./scenes/CypherScene";
import { DilemmaScene } from "./scenes/DilemmaScene";
import { EpilogueScene } from "./scenes/EpilogueScene";
import { hex, palette } from "./ui/palette";
import { AudioService } from "./services/AudioService";
import { wireAudio } from "./game/audioWiring";
import { MusicPlayer } from "./services/MusicPlayer";
import type { MusicTrackId } from "./data/music";
import { AudioConfig as AudioConfigProbe } from "./data/config/AudioConfig";
import { eventBus } from "./events/EventBus";

const controller = new GameController(localStorage);
const input = new InputRouter(controller);
// Audio (Fase 8): synthesized, so there is nothing to preload. It reads its
// settings from the loaded save and stays in step through the controller.
const audio = new AudioService(controller.state.audio);
controller.attachAudio(audio);
wireAudio(eventBus, audio, () => controller.state);
setGameContext({ controller, input });

// Browsers refuse to start an AudioContext without a gesture, so the first real
// input unlocks it. Once is enough, hence { once: true } on both.
const unlock = (): void => audio.unlock();
window.addEventListener("keydown", unlock, { once: true });
window.addEventListener("pointerdown", unlock, { once: true });

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
    scene: [BootScene, MenuScene, CreateMcScene, CareerScene, BattleScene, CypherScene, DilemmaScene, EpilogueScene],
  });
  new SceneDirector(game, controller);
});

// Deterministic test hooks (project rule: keep working across refactors).
window.render_game_to_text = () => controller.renderGameToText();
window.advanceTime = (ms: number) => {
  const steps = Math.max(1, Math.round(ms / (1000 / 60)));
  for (let i = 0; i < steps; i += 1) controller.update(1 / 60);
};
// Sound cannot be screenshotted, so the sounds the game asked for since the last
// call are readable instead. Draining keeps each assertion about the action that
// was just performed.
window.audio_log = () => audio.drainLog();
// Sound cannot be screenshotted and a node graph existing proves nothing, so this
// renders a loop OFFLINE and reports how loud it actually came out. It is the only
// way to show "the game sounds" as a number instead of an assertion.
window.audio_probe = async (track, seconds = 2) => {
  const Offline = window.OfflineAudioContext;
  if (!Offline) return { rms: 0, peak: 0, supported: false };
  const ctx = new Offline(1, Math.ceil(44100 * seconds), 44100);
  // The same gain chain the game runs: music bus under a master trimmed by the
  // player's volume. Measuring the raw synth instead reported a healthy peak for
  // a loop that was actually at about -30 dBFS by the time it left the speakers.
  const master = ctx.createGain();
  master.gain.value = (controller.state.audio.volume / 10) * AudioConfigProbe.volume.master;
  master.connect(ctx.destination);
  const player = new MusicPlayer();
  player.attach(ctx as unknown as AudioContext, master);
  player.setVolume(AudioConfigProbe.music.busGain);
  player.play(track);
  // The real player schedules from a timer against a live clock; offline has no
  // wall clock, so the whole window is scheduled up front.
  player.renderWindow(seconds);
  const buffer = await ctx.startRendering();
  const data = buffer.getChannelData(0);
  let sum = 0;
  let peak = 0;
  for (let i = 0; i < data.length; i += 1) {
    sum += data[i] * data[i];
    peak = Math.max(peak, Math.abs(data[i]));
  }
  return { rms: Math.sqrt(sum / data.length), peak, supported: true };
};

declare global {
  interface Window {
    render_game_to_text: () => string;
    advanceTime: (ms: number) => void;
    audio_log: () => string[];
    audio_probe: (track: MusicTrackId, seconds?: number) => Promise<{ rms: number; peak: number; supported: boolean }>;
  }
}

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // The game still runs without offline cache.
    });
  });
}
