// Crear MC screen (mode "start" without a save, or after "Nueva carrera"),
// rebuilt in Fase 4 against reference/screens/ChatGPT Image 15 jun 2026,
// 06_29_41 a.m. (1).png: one big rounded panel, a framed rooftop portrait with
// the logo and a large MC on the left, and six label + pill rows on the right
// over a wide COMENZAR call to action.
//
// Presentation only: every value is read from GameState and every change goes
// through a GameController command.
//
// Keyboard: the row cursor (up/down) and the value cycling (left/right) are
// scene-local Phaser listeners — the global InputRouter ignores arrows in start
// mode, and it preventDefaults Enter/Backspace so Phaser never sees them, which
// keeps Enter = "empezar carrera" in one place. Typing the *nickname* is the one
// case that cannot be expressed that way (the router types every printable key
// into inputName), so while the APODO row holds the cursor this scene claims
// those keys in a capture-phase listener that is removed on SHUTDOWN. See the
// handoff note: InputRouter should own a text-focus target instead.

import Phaser from "phaser";
import type { GameState } from "../core/types";
import { DifficultyConfig } from "../data/config/DifficultyConfig";
import { NewGameConfig } from "../data/config/NewGameConfig";
import { eventBus } from "../events/EventBus";
import { gameContext } from "../game/context";
import type { GameController } from "../managers/GameController";
import { palette } from "../ui/palette";
import { addHitZone, addRect } from "../ui/kit";
import {
  CANVAS_H,
  CANVAS_W,
  addAnchoredText,
  addLogoLockup,
  addMcFigure,
  addPillButton,
  addPixelTriangle,
  addPortraitBackdrop,
  addRoundedPanel,
} from "./startShared";

// --- Mockup geometry (1672x941 mockup * 0.5742 -> 960x540 canvas) -----------

const PANEL = { x: 12, y: 10, w: 936, h: 520 } as const;
const PORTRAIT = { x: 20, y: 20, w: 390, h: 500 } as const;
const PILL = { x: 625, w: 259, h: 44 } as const;
const ROW_TOP = 70;
const ROW_PITCH = 60.4;
const LABEL_X = 494;
// Labels stay left-aligned until they would touch the pill; the mockup shifts
// "COLOR DE PIEL" left for exactly this reason.
const LABEL_MAX_RIGHT = PILL.x - 9;
const ROW_CURSOR_X = 478;
const ARROW_LEFT_X = 651;
const ARROW_RIGHT_X = 859;
const VALUE_CX = PILL.x + PILL.w / 2;
const START_BUTTON = { x: 497, y: 450, w: 360, h: 54 } as const;
const BACK_BUTTON = { x: 774, y: 26, w: 110, h: 32 } as const;

const PILL_FILL = "#01041e";
const PANEL_FILL = "#050b34";
const SWATCH = { w: 28, h: 26, gap: 4 } as const;

// Skin tones sampled from the mockup's swatch strip. Presentation-only: the
// state stores a 1-based index (NewGameConfig.identityOptions.skins), the tone
// table is what the player sees while character sprite variants are pending.
const SKIN_TONES = ["#ecb98c", "#d49765", "#aa6c42", "#693c22", "#3f2617"] as const;

type RowId = "nombre" | "apodo" | "look" | "skin" | "voice" | "difficulty";

interface RowDef {
  id: RowId;
  label: string;
}

const ROWS: readonly RowDef[] = [
  { id: "nombre", label: "NOMBRE" },
  { id: "apodo", label: "APODO" },
  { id: "look", label: "ASPECTO" },
  { id: "skin", label: "COLOR DE PIEL" },
  { id: "voice", label: "VOZ" },
  { id: "difficulty", label: "DIFICULTAD" },
];

// Mockup formats the cosmetic indexes as two digits ("01").
function optionLabel(value: number): string {
  return String(value).padStart(2, "0");
}

function difficultyLabel(state: GameState): string {
  const level = DifficultyConfig.levels[state.difficulty];
  return (level?.label ?? state.difficulty).toUpperCase();
}

export class CreateMcScene extends Phaser.Scene {
  private layer!: Phaser.GameObjects.Container;
  private focus = 0;
  // Blinking caret on the focused text row: `base` is the committed value, so
  // update() can retint the caret without a full redraw.
  private caret: { text: Phaser.GameObjects.Text; base: string } | null = null;
  private nicknameKeys: ((event: KeyboardEvent) => void) | null = null;

  constructor() {
    super("CreateMc");
  }

  create(): void {
    this.focus = 0;
    this.caret = null;
    const chrome = this.add.container(0, 0);
    this.buildChrome(chrome);
    this.layer = this.add.container(0, 0);

    const subs = [
      eventBus.on("STATE_CHANGED", () => this.redraw()),
      eventBus.on("FOCUS_CHANGED", () => this.redraw()),
      eventBus.on("MODE_CHANGED", () => this.redraw()),
    ];
    this.input.keyboard?.on("keydown", this.onSceneKey, this);
    this.nicknameKeys = (event: KeyboardEvent) => this.routeNicknameKey(event);
    window.addEventListener("keydown", this.nicknameKeys, true);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      subs.forEach((unsubscribe) => unsubscribe());
      this.input.keyboard?.off("keydown", this.onSceneKey, this);
      if (this.nicknameKeys) window.removeEventListener("keydown", this.nicknameKeys, true);
      this.nicknameKeys = null;
      this.caret = null;
    });
    this.redraw();
  }

  update(_time: number, delta: number): void {
    const { controller } = gameContext();
    controller.update(delta / 1000);
    const caret = this.caret;
    if (caret && caret.text.active) {
      // Space and underscore share an advance in the mono UI face, so the value
      // never jitters as the caret blinks.
      const blink = Math.floor(controller.state.animationTime * 2) % 2 === 0;
      const next = `${caret.base}${blink ? "_" : " "}`;
      if (caret.text.text !== next) caret.text.setText(next);
    }
  }

  // --- Static chrome (panel + portrait; none of it depends on GameState) -----

  private buildChrome(layer: Phaser.GameObjects.Container): void {
    addRect(this, layer, 0, 0, CANVAS_W, CANVAS_H, "#02041a");
    addRoundedPanel(this, layer, PANEL.x, PANEL.y, PANEL.w, PANEL.h, {
      fill: PANEL_FILL,
      border: palette.line,
      radius: 14,
      lineWidth: 3,
      innerBorder: "#1b2270",
    });
    addPortraitBackdrop(this, layer, PORTRAIT.x, PORTRAIT.y, PORTRAIT.w, PORTRAIT.h);
    // Portrait frame: quiet edges plus the mockup's bright vertical divider.
    addRect(this, layer, PORTRAIT.x, PORTRAIT.y, PORTRAIT.w, 2, palette.borderLo);
    addRect(this, layer, PORTRAIT.x, PORTRAIT.y, 2, PORTRAIT.h, palette.borderLo);
    addRect(this, layer, PORTRAIT.x, PORTRAIT.y + PORTRAIT.h - 2, PORTRAIT.w, 2, palette.borderLo);
    addRect(this, layer, PORTRAIT.x + PORTRAIT.w - 3, PORTRAIT.y, 3, PORTRAIT.h, "#3a37a8");
    // Logo above the MC. The mockup paints it as a low-contrast "sky graffiti"
    // watermark; a multiply tint would turn the yellow GAME olive, so the real
    // lockup is simply dropped in opacity instead.
    addLogoLockup(this, layer, { x: 83, y: 74, width: 214, alpha: 0.45 });
    addMcFigure(this, layer, { centerX: 216, feetY: 434, height: 262 });
    addAnchoredText(this, layer, 41, 43, "2. CREAR MC", 28, palette.ink, 0, true);
  }

  // --- Dynamic layer --------------------------------------------------------

  private redraw(): void {
    const { controller } = gameContext();
    this.caret = null;
    this.layer.removeAll(true);
    ROWS.forEach((row, index) => this.drawRow(controller, row, index));
    addPillButton(
      this,
      this.layer,
      START_BUTTON.x,
      START_BUTTON.y,
      START_BUTTON.w,
      START_BUTTON.h,
      "COMENZAR",
      () => controller.startCareerFromMenu(),
      { size: 30, display: true, fill: "#0b1240", border: palette.borderHi, radius: 10 },
    );
    if (controller.hasSave()) {
      addPillButton(
        this,
        this.layer,
        BACK_BUTTON.x,
        BACK_BUTTON.y,
        BACK_BUTTON.w,
        BACK_BUTTON.h,
        "VOLVER",
        () => controller.loadSavedIntoDraft(),
        { size: 14, radius: 6 },
      );
    } else {
      addAnchoredText(
        this,
        this.layer,
        START_BUTTON.x + START_BUTTON.w / 2,
        513,
        "Escribe tu nombre y presiona Enter.",
        11,
        palette.muted,
      );
    }
  }

  private drawRow(controller: GameController, row: RowDef, index: number): void {
    const layer = this.layer;
    const state = controller.state;
    const top = ROW_TOP + Math.round(index * ROW_PITCH);
    const cy = top + PILL.h / 2;
    const focused = this.focus === index;
    const accent = focused ? palette.yellow : palette.ink;

    addRoundedPanel(this, layer, PILL.x, top, PILL.w, PILL.h, {
      fill: PILL_FILL,
      border: focused ? palette.yellow : palette.line,
      radius: 12,
      lineWidth: focused ? 3 : 2,
    });
    const label = addAnchoredText(this, layer, LABEL_X, cy, row.label, 19, accent, 0);
    if (label.x + label.width > LABEL_MAX_RIGHT) label.x = LABEL_MAX_RIGHT - label.width;
    if (focused) addPixelTriangle(this, layer, ROW_CURSOR_X, cy, 12, 18, "right", palette.yellow);
    // Clicking the pill moves the row cursor, so mouse and keyboard never drift.
    addHitZone(this, layer, PILL.x, top, PILL.w, PILL.h, () => this.setFocus(index));

    switch (row.id) {
      case "nombre":
        this.addTextValue(cy, state.inputName, "TU NOMBRE", focused);
        break;
      case "apodo":
        this.addTextValue(cy, state.nickname, "FREESTYLER", focused);
        break;
      case "look":
        this.addValue(cy, optionLabel(state.look), palette.ink);
        this.addArrows(cy, accent, index, (delta) => controller.cycleLook(delta));
        break;
      case "skin":
        this.addSkinStrip(cy, state.skin);
        this.addArrows(cy, accent, index, (delta) => controller.cycleSkin(delta));
        break;
      case "voice":
        this.addValue(cy, optionLabel(state.voice), palette.ink);
        this.addArrows(cy, accent, index, (delta) => controller.cycleVoice(delta));
        break;
      case "difficulty":
        this.addValue(cy, difficultyLabel(state), palette.ink);
        this.addArrows(cy, accent, index, (delta) => controller.cycleDifficulty(delta));
        break;
    }
  }

  private addValue(cy: number, content: string, color: string): Phaser.GameObjects.Text {
    return addAnchoredText(this, this.layer, VALUE_CX, cy, content, 18, color);
  }

  // Free-text row: the committed value plus a caret while it holds the cursor.
  // An empty field falls back to the mockup's muted placeholder, so the row is
  // never blank.
  private addTextValue(cy: number, value: string, placeholder: string, focused: boolean): void {
    const shown = value || placeholder;
    const color = value ? palette.ink : palette.muted;
    if (!focused) {
      this.addValue(cy, shown, color);
      return;
    }
    const text = this.addValue(cy, `${shown}_`, color);
    this.caret = { text, base: shown };
  }

  private addArrows(cy: number, color: string, index: number, cycle: (delta: number) => void): void {
    const layer = this.layer;
    addPixelTriangle(this, layer, ARROW_LEFT_X, cy, 12, 16, "left", color);
    addPixelTriangle(this, layer, ARROW_RIGHT_X, cy, 12, 16, "right", color);
    const step = (delta: number): void => {
      this.focus = index;
      cycle(delta);
    };
    addHitZone(this, layer, ARROW_LEFT_X - 20, cy - 20, 40, 40, () => step(-1));
    addHitZone(this, layer, ARROW_RIGHT_X - 20, cy - 20, 40, 40, () => step(1));
  }

  private addSkinStrip(cy: number, selected: number): void {
    const count = NewGameConfig.identityOptions.skins;
    const stripW = count * SWATCH.w + (count - 1) * SWATCH.gap;
    const left = Math.round(VALUE_CX - stripW / 2);
    const top = Math.round(cy - SWATCH.h / 2);
    for (let i = 0; i < count; i += 1) {
      const x = left + i * (SWATCH.w + SWATCH.gap);
      const isSelected = i + 1 === selected;
      if (isSelected) addRect(this, this.layer, x - 2, top - 2, SWATCH.w + 4, SWATCH.h + 4, palette.yellow);
      addRect(this, this.layer, x, top, SWATCH.w, SWATCH.h, SKIN_TONES[i % SKIN_TONES.length]);
    }
  }

  // --- Keyboard -------------------------------------------------------------

  private setFocus(index: number): void {
    const next = ((index % ROWS.length) + ROWS.length) % ROWS.length;
    if (next === this.focus) return;
    this.focus = next;
    this.redraw();
  }

  private onSceneKey(event: KeyboardEvent): void {
    const { controller } = gameContext();
    switch (event.key) {
      case "ArrowUp":
        this.setFocus(this.focus - 1);
        return;
      case "ArrowDown":
        this.setFocus(this.focus + 1);
        return;
      case "ArrowLeft":
        this.cycleFocusedRow(controller, -1);
        return;
      case "ArrowRight":
        this.cycleFocusedRow(controller, 1);
        return;
      default:
        return;
    }
  }

  private cycleFocusedRow(controller: GameController, delta: number): void {
    switch (ROWS[this.focus].id) {
      case "look":
        controller.cycleLook(delta);
        return;
      case "skin":
        controller.cycleSkin(delta);
        return;
      case "voice":
        controller.cycleVoice(delta);
        return;
      case "difficulty":
        controller.cycleDifficulty(delta);
        return;
      default:
        // Text rows have nothing to cycle.
        return;
    }
  }

  // Capture-phase claim so printable keys reach the nickname instead of the
  // name while the APODO row holds the cursor. Enter is left alone: the global
  // router owns "empezar carrera".
  private routeNicknameKey(event: KeyboardEvent): void {
    if (ROWS[this.focus].id !== "apodo") return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const { controller } = gameContext();
    if (event.key === "Backspace") {
      controller.backspaceNickname();
    } else if (event.key.length === 1) {
      controller.appendNicknameChar(event.key);
    } else {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  }
}
