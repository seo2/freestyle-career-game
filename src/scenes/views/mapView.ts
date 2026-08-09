// Career view 5: the city map, rebuilt against its mockup
// (reference/screens "ChatGPT Image 15 jun 2026, 06_23_15 a.m. (5).png").
//
// Owner decision (Fase 4): the map is THE HUB. It is a PLACES map, not a stage
// list: labelled nodes (TU PIEZA / TRABAJO / TIENDA / PLAZA / GIMNASIO /
// ESTUDIO) joined by dotted paths, the MC standing at his pieza, and a bottom
// bar with level, stage stars and the career goals that used to live in the
// room. Clicking a node navigates (setCareerView) or acts (runCareerAction).
//
// Presentation only: nothing here computes rules. Locks are read from the real
// action list (CareerActionInfo.disabledReason), never invented — a place with
// no gate behind it never draws a padlock.
//
// The mockup is 1672x941 and the canvas is 960x540 (factor 0.574 in x). The map
// panel is compressed vertically because CareerScene keeps the HUD on top
// (y 10..86), which the mockup does not have.

import type Phaser from "phaser";
import { eventBus } from "../../events/EventBus";
import { palette } from "../../ui/palette";
import { addDisplayText, addHitZone, addPanel, addSoftPanel } from "../../ui/kit";
import { getCareerGoals } from "../../systems/ProgressionSystem";
import { stageIndex } from "../../core/derived";
import { stages } from "../../data/stages";
import { goalRow, line, mcFigure, rect } from "./viewKit";
import type { ViewCtx } from "./viewKit";
import type { CareerView } from "../../core/types";
import type { GameController } from "../../managers/GameController";

// Mockup: map panel 27..1644 x 79..766, bottom bar 786..909 split into a level
// panel (27..330) and a goals panel (348..1644).
const MAP = { x: 16, y: 92, w: 928, h: 348 } as const;
const LEVEL_PANEL = { x: 16, y: 451, w: 174, h: 71 } as const;
const GOAL_PANEL = { x: 200, y: 451, w: 744, h: 71 } as const;
const PANEL_FILL = "#050e2d";

const CITY = {
  base: "#070c22",
  skyline: "#0d1533",
  road: "#2e3450",
  roadLine: "#8a8460",
  blockDark: "#141d3f",
  blockLite: "#1a2450",
  blockSide: "#0d1330",
  roof: "#26325f",
  window: "#e0b95c",
  tree: "#16351f",
} as const;

const NODE = {
  labelSize: 16, // display face renders at 0.7x -> ~11px caps (mockup 20)
  labelH: 24,
  labelPadX: 7,
  charW: 11.5,
  reasonMaxW: 150,
  boxFill: "#0d1330",
  boxEdge: "#05081a",
  boxTop: "#9aa0e8",
  boxTopDim: "#3a4288",
  platform: "#e8ecff",
  scrim: "#050a20",
} as const;

type PlaceKind = "home" | "job" | "shop" | "gym" | "studio" | "plaza";

interface PlaceNode {
  id: string;
  label: string;
  kind: PlaceKind;
  /** Platform centre: the ground the marker stands on. */
  x: number;
  y: number;
  /** Distance from the platform up to the bottom of the label box. */
  labelDy: number;
  /** Places that open a screen: navigation is never gated. */
  view?: CareerView;
  /** Places that run an action: the action's disabledReason IS the lock. */
  actionId?: string;
  /** Action whose disabledReason is worth showing, without closing the place. */
  hintActionId?: string;
}

// Constellation copied from the mockup's relative layout: pieza left, trabajo
// below it, plaza in the middle with tienda under it, gimnasio bottom right and
// estudio top right.
const PLACES: readonly PlaceNode[] = [
  { id: "pieza", label: "TU PIEZA", kind: "home", x: 168, y: 262, labelDy: 60, view: "base" },
  { id: "trabajo", label: "TRABAJO", kind: "job", x: 262, y: 388, labelDy: 42, view: "work", hintActionId: "work" },
  { id: "plaza", label: "PLAZA", kind: "plaza", x: 476, y: 246, labelDy: 52, actionId: "battle" },
  { id: "tienda", label: "TIENDA", kind: "shop", x: 470, y: 394, labelDy: 46, view: "shop" },
  { id: "gimnasio", label: "GIMNASIO", kind: "gym", x: 700, y: 390, labelDy: 52, view: "training", hintActionId: "practice" },
  { id: "estudio", label: "ESTUDIO", kind: "studio", x: 814, y: 258, labelDy: 66, actionId: "record" },
];

const PATHS: readonly [string, string][] = [
  ["pieza", "trabajo"],
  ["pieza", "plaza"],
  ["plaza", "tienda"],
  ["plaza", "estudio"],
  ["tienda", "gimnasio"],
];

// Node cursor (presentation state, same role as InputRouter.actionFocus for the
// room dock). Module scope so it survives the immediate-mode redraws.
let cursor = 0;
let boundScene: Phaser.Scene | null = null;

export function renderMap(ctx: ViewCtx): void {
  const { controller } = ctx;
  const state = controller.state;

  bindNodeKeys(ctx);
  cursor = nextOpenIndex(controller, cursor, 1);

  addPanel(ctx.scene, ctx.layer, MAP.x, MAP.y, MAP.w, MAP.h, CITY.base);
  cityBackdrop(ctx, MAP.x, MAP.y, MAP.w, MAP.h);
  mapHeader(ctx);

  const byId = new Map(PLACES.map((place) => [place.id, place]));
  PATHS.forEach(([fromId, toId]) => {
    const from = byId.get(fromId);
    const to = byId.get(toId);
    if (!from || !to) return;
    const open = !lockReason(controller, from) && !lockReason(controller, to);
    dottedPath(ctx, from, to, open);
  });

  PLACES.forEach((place, index) => {
    const locked = lockReason(controller, place);
    drawPlace(ctx, place, locked, index === cursor);
    if (locked) return;
    const zoneW = place.label.length * NODE.charW + NODE.labelPadX * 2 + 8;
    addHitZone(ctx.scene, ctx.layer, place.x - zoneW / 2, place.y - place.labelDy - NODE.labelH, zoneW, place.labelDy + NODE.labelH + 16, () => {
      cursor = index;
      activate(controller, place);
    });
  });

  levelPanel(ctx, state.level);
  goalsPanel(ctx);
}

// --- Places -------------------------------------------------------------------

// A place is locked only when a real action behind it says so.
function lockReason(controller: GameController, place: PlaceNode): string | undefined {
  if (!place.actionId) return undefined;
  return controller.careerActions().find((action) => action.id === place.actionId)?.disabledReason;
}

// Soft note for places that open a screen: the screen stays reachable, but the
// action you would run there is unavailable right now.
function hintReason(controller: GameController, place: PlaceNode): string | undefined {
  if (!place.hintActionId) return undefined;
  return controller.careerActions().find((action) => action.id === place.hintActionId)?.disabledReason;
}

function activate(controller: GameController, place: PlaceNode): void {
  if (place.view) {
    controller.setCareerView(place.view);
    return;
  }
  if (place.actionId) controller.runCareerAction(place.actionId);
}

function drawPlace(ctx: ViewCtx, place: PlaceNode, locked: string | undefined, focused: boolean): void {
  platform(ctx, place.x, place.y, !locked);
  marker(ctx, place);
  if (locked) {
    rect(ctx, place.x - 32, place.y - place.labelDy - 4, 64, place.labelDy + 14, NODE.scrim, 0.55);
    padlock(ctx, place.x + 14, place.y - 30);
  }
  const boxBottom = place.y - place.labelDy;
  labelBox(ctx, place.x, boxBottom, place.label, Boolean(locked));
  if (focused) pin(ctx, place.x, boxBottom - NODE.labelH - 5);
  const note = locked ?? hintReason(ctx.controller, place);
  if (note) {
    const x = Math.round(place.x - NODE.reasonMaxW / 2);
    rect(ctx, x - 4, place.y + 12, NODE.reasonMaxW + 8, 15, NODE.scrim, 0.8);
    line(ctx, x, place.y + 23, note, 9, locked ? palette.red : palette.muted, NODE.reasonMaxW);
  }
}

// Glowing pixel platform (the mockup's white ellipse) plus its ground shadow.
function platform(ctx: ViewCtx, x: number, y: number, open: boolean): void {
  const alpha = open ? 1 : 0.45;
  rect(ctx, x - 24, y + 2, 48, 5, "#03060f", 0.55 * alpha);
  rect(ctx, x - 30, y - 3, 60, 6, NODE.platform, 0.5 * alpha);
  rect(ctx, x - 22, y - 7, 44, 4, NODE.platform, 0.3 * alpha);
  rect(ctx, x - 22, y + 3, 44, 4, NODE.platform, 0.3 * alpha);
  rect(ctx, x - 14, y - 10, 28, 3, NODE.platform, 0.16 * alpha);
}

// Place marker: the MC himself at home, a small procedural building elsewhere.
// The isometric city art is a pending asset (docs/ASSETS.md), so these read like
// the mockup's silhouettes without pretending to be the final sprites.
function marker(ctx: ViewCtx, place: PlaceNode): void {
  const { x, y } = place;
  if (place.kind === "home") {
    mcFigure(ctx, x, y - 16, 0.62);
    return;
  }
  if (place.kind === "job") {
    rect(ctx, x - 28, y - 36, 56, 36, "#3b3f52");
    rect(ctx, x + 20, y - 32, 8, 32, "#262a38");
    rect(ctx, x - 28, y - 40, 56, 4, "#5a6076");
    rect(ctx, x - 7, y - 17, 14, 17, "#1b1f2e");
    rect(ctx, x - 5, y - 14, 10, 12, CITY.window, 0.55);
    [0, 1, 2].forEach((i) => rect(ctx, x - 24 + i * 15, y - 31, 10, 8, CITY.window, 0.9));
    return;
  }
  if (place.kind === "shop") {
    rect(ctx, x - 26, y - 34, 52, 34, "#4a3341");
    rect(ctx, x + 18, y - 30, 8, 30, "#33222c");
    for (let i = 0; i < 9; i += 1) {
      rect(ctx, x - 28 + i * 6, y - 40, 6, 6, i % 2 === 0 ? palette.red : palette.ink);
    }
    rect(ctx, x - 22, y - 27, 18, 12, CITY.window, 0.9);
    rect(ctx, x + 1, y - 25, 14, 25, "#241a24");
    rect(ctx, x + 4, y - 21, 8, 10, CITY.window, 0.45);
    return;
  }
  if (place.kind === "gym") {
    rect(ctx, x - 23, y - 44, 46, 44, "#4b4a44");
    rect(ctx, x + 15, y - 40, 8, 40, "#33322e");
    rect(ctx, x - 23, y - 48, 46, 4, "#6b6a60");
    rect(ctx, x - 14, y - 33, 6, 15, palette.ink);
    rect(ctx, x + 6, y - 33, 6, 15, palette.ink);
    rect(ctx, x - 9, y - 28, 16, 5, palette.ink);
    rect(ctx, x - 8, y - 14, 16, 14, "#232228");
    rect(ctx, x - 5, y - 11, 10, 9, CITY.window, 0.4);
    return;
  }
  if (place.kind === "studio") {
    rect(ctx, x - 24, y - 52, 48, 52, "#2b3c74");
    rect(ctx, x + 16, y - 48, 8, 48, "#1d2a55");
    rect(ctx, x - 24, y - 56, 48, 4, "#4a5da0");
    [0, 1, 2].forEach((row) =>
      [0, 1].forEach((col) => rect(ctx, x - 18 + col * 19, y - 48 + row * 15, 13, 9, "#8ea7ff", 0.85)),
    );
    rect(ctx, x + 3, y - 66, 3, 10, "#6b6a60");
    rect(ctx, x - 2, y - 71, 13, 6, "#8f8e84");
    return;
  }
  // plaza: lit monument on a stepped base, the mockup's centre square.
  rect(ctx, x - 30, y - 10, 60, 10, "#3a3c56");
  rect(ctx, x - 21, y - 19, 42, 9, "#4a4d6b");
  rect(ctx, x - 6, y - 42, 12, 23, "#c9c6b4");
  rect(ctx, x - 11, y - 50, 22, 8, palette.yellow);
  rect(ctx, x - 18, y - 5, 36, 5, CITY.window, 0.35);
}

function labelBox(ctx: ViewCtx, cx: number, bottomY: number, label: string, dim: boolean): void {
  const w = label.length * NODE.charW + NODE.labelPadX * 2;
  const x = Math.round(cx - w / 2);
  const y = bottomY - NODE.labelH;
  rect(ctx, x - 2, y - 2, w + 4, NODE.labelH + 4, NODE.boxEdge);
  rect(ctx, x, y, w, NODE.labelH, NODE.boxFill);
  rect(ctx, x, y, w, 2, dim ? NODE.boxTopDim : NODE.boxTop);
  rect(ctx, x, y, 2, NODE.labelH, dim ? NODE.boxTopDim : NODE.boxTop);
  // Pointer down to the platform (the mockup's speech-bubble tail).
  rect(ctx, Math.round(cx - 6), y + NODE.labelH, 12, 4, NODE.boxEdge);
  rect(ctx, Math.round(cx - 5), y + NODE.labelH, 10, 3, NODE.boxFill);
  rect(ctx, Math.round(cx - 3), y + NODE.labelH + 3, 6, 3, NODE.boxEdge);
  rect(ctx, Math.round(cx - 2), y + NODE.labelH + 3, 4, 2, NODE.boxFill);
  const text = addDisplayText(
    ctx.scene,
    ctx.layer,
    cx,
    y + NODE.labelH / 2,
    label,
    NODE.labelSize,
    dim ? "#8a8fa5" : palette.ink,
  );
  text.setOrigin(0.5, 0.5).setPosition(cx, y + NODE.labelH / 2);
}

// Mockup selection marker: the golden map pin, here parked over the focused
// node so pointer and keyboard share one cursor.
function pin(ctx: ViewCtx, cx: number, bottomY: number): void {
  rect(ctx, cx - 10, bottomY - 26, 20, 17, "#8a6a12");
  rect(ctx, cx - 9, bottomY - 27, 18, 17, palette.yellow);
  rect(ctx, cx - 7, bottomY - 29, 14, 3, palette.yellow);
  rect(ctx, cx - 6, bottomY - 10, 12, 5, palette.yellow);
  rect(ctx, cx - 3, bottomY - 5, 6, 4, palette.yellow);
  rect(ctx, cx - 4, bottomY - 24, 8, 8, "#0a0d1f");
}

// Padlock badge: only drawn where a real disabledReason closed the place.
function padlock(ctx: ViewCtx, x: number, y: number): void {
  rect(ctx, x - 1, y - 1, 20, 20, "#12060a");
  rect(ctx, x, y, 18, 18, palette.red);
  rect(ctx, x + 6, y + 3, 6, 2, "#12060a");
  rect(ctx, x + 5, y + 5, 2, 3, "#12060a");
  rect(ctx, x + 11, y + 5, 2, 3, "#12060a");
  rect(ctx, x + 4, y + 8, 10, 7, palette.ink);
  rect(ctx, x + 8, y + 10, 2, 3, "#12060a");
}

function dottedPath(ctx: ViewCtx, from: PlaceNode, to: PlaceNode, open: boolean): void {
  const steps = 24;
  const color = open ? NODE.platform : "#5b628c";
  const alpha = open ? 0.85 : 0.4;
  for (let i = 1; i < steps; i += 2) {
    const t = i / steps;
    const x = from.x + (to.x - from.x) * t;
    const y = from.y + (to.y - from.y) * t;
    rect(ctx, Math.round(x) - 3, Math.round(y) - 3, 5, 5, color, alpha);
  }
}

// --- City backdrop -------------------------------------------------------------

// Procedural night city: the isometric city art is pending (docs/ASSETS.md), so
// this only has to read like the mockup - lit blocks, a street grid, a far
// skyline. Rooftops are not all one navy: blues, indigos and warm brick mix.
const BLOCK_FILLS = [CITY.blockLite, CITY.blockDark, "#26214c", "#33253c", "#1e2c56", "#2c2a3f"] as const;
const CELL = { row: 76, col: 116, road: 10, top: 34 } as const;

// Deterministic 0..1 hash: the city must look scattered but redraw identically
// (the trace harness compares byte-identical frames, and Math.random is banned).
function noise(a: number, b: number): number {
  const v = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

function cityBackdrop(ctx: ViewCtx, x: number, y: number, w: number, h: number): void {
  rect(ctx, x, y, w, h, CITY.base);
  // Distant skyline along the top edge (the mockup's far bank).
  for (let i = 0; i < 26; i += 1) {
    const bh = 10 + Math.floor(noise(i, 9) * 22);
    rect(ctx, x + 4 + i * 36, y + CELL.top - bh, 16 + Math.floor(noise(i, 11) * 20), bh, CITY.skyline);
  }
  const top = y + CELL.top;
  for (let r = 0; top + (r + 1) * CELL.row < y + h; r += 1) {
    const ry = top + r * CELL.row + CELL.row - CELL.road;
    rect(ctx, x, ry, w, CELL.road, CITY.road);
    rect(ctx, x, ry + 4, w, 1, CITY.roadLine, 0.55);
  }
  for (let c = 0; x + 30 + (c + 1) * CELL.col < x + w; c += 1) {
    const cx = x + 30 + c * CELL.col;
    rect(ctx, cx, top, 9, h - CELL.top, CITY.road);
    rect(ctx, cx + 4, top, 1, h - CELL.top, CITY.roadLine, 0.45);
  }
  for (let r = 0; top + r * CELL.row + 40 < y + h; r += 1) {
    for (let c = 0; x + 39 + c * CELL.col < x + w - 40; c += 1) {
      const cellX = x + 39 + c * CELL.col;
      const cellY = top + r * CELL.row + 2;
      const cellW = CELL.col - 15;
      const cellH = Math.min(CELL.row - CELL.road - 4, y + h - 6 - cellY);
      const count = noise(r * 17 + c, 1) > 0.45 ? 2 : 1;
      for (let k = 0; k < count; k += 1) {
        const seed = r * 31 + c * 7 + k * 3;
        const bw = 24 + Math.floor(noise(seed, 2) * (cellW / count - 20));
        const bh = 18 + Math.floor(noise(seed, 3) * (cellH - 22));
        if (bw < 14 || bh < 12) continue;
        const bx = cellX + k * Math.floor(cellW / count) + Math.floor(noise(seed, 4) * Math.max(1, cellW / count - bw));
        const by = cellY + Math.floor(noise(seed, 5) * Math.max(1, cellH - bh));
        cityBlock(ctx, bx, by, bw, bh, seed);
      }
    }
  }
  // Keeps the city behind the nodes instead of competing with them.
  rect(ctx, x, y, w, h, NODE.scrim, 0.24);
}

// One city block, or a patch of park when it would land on a place node (the
// nodes need clean ground under their platform and label).
function cityBlock(ctx: ViewCtx, x: number, y: number, w: number, h: number, seed: number): void {
  const onNode = PLACES.some(
    (place) => Math.abs(place.x - (x + w / 2)) < 56 && place.y > y - 30 && place.y < y + h + 46,
  );
  if (onNode) {
    rect(ctx, x, y + h - 8, w, 8, CITY.tree, 0.7);
    rect(ctx, x + 4, y + h - 13, 6, 6, CITY.tree);
    return;
  }
  rect(ctx, x, y, w, h, BLOCK_FILLS[Math.floor(noise(seed, 6) * BLOCK_FILLS.length) % BLOCK_FILLS.length]);
  rect(ctx, x + w - 6, y + 2, 6, h - 2, CITY.blockSide);
  rect(ctx, x, y, w, 3, CITY.roof);
  const cols = Math.max(1, Math.floor((w - 6) / 10));
  const rows = Math.max(1, Math.floor((h - 8) / 9));
  for (let wy = 0; wy < rows; wy += 1) {
    for (let wx = 0; wx < cols; wx += 1) {
      if (noise(seed * 5 + wy * 3 + wx, 7) < 0.45) continue;
      rect(ctx, x + 4 + wx * 10, y + 6 + wy * 9, 4, 5, CITY.window, 0.8);
    }
  }
  if (noise(seed, 8) > 0.6) rect(ctx, x - 7, y + h - 9, 6, 9, CITY.tree);
}

// The mockup titles the screen above the frame; the HUD occupies that band here,
// so the title and the navigation hint ride a strip inside the panel.
function mapHeader(ctx: ViewCtx): void {
  rect(ctx, MAP.x, MAP.y, MAP.w, 22, NODE.scrim, 0.82);
  rect(ctx, MAP.x, MAP.y + 22, MAP.w, 1, palette.line, 0.6);
  addDisplayText(ctx.scene, ctx.layer, MAP.x + 8, MAP.y + 6, "MAPA", 16, palette.ink);
  line(ctx, MAP.x + 96, MAP.y + 16, "Flechas + Enter o clic para ir · TU PIEZA vuelve a tu pieza", 9, palette.muted, 520);
}

// --- Bottom bar ----------------------------------------------------------------

function levelPanel(ctx: ViewCtx, level: number): void {
  addPanel(ctx.scene, ctx.layer, LEVEL_PANEL.x, LEVEL_PANEL.y, LEVEL_PANEL.w, LEVEL_PANEL.h, PANEL_FILL);
  pixelStar(ctx, LEVEL_PANEL.x + 12, LEVEL_PANEL.y + 15, 5);
  addDisplayText(ctx.scene, ctx.layer, LEVEL_PANEL.x + 74, LEVEL_PANEL.y + 12, "NIVEL", 16, palette.ink);
  const value = addDisplayText(ctx.scene, ctx.layer, 0, 0, String(level), 26, palette.yellow);
  value.setOrigin(0.5, 0).setPosition(LEVEL_PANEL.x + 104, LEVEL_PANEL.y + 36);
}

function goalsPanel(ctx: ViewCtx): void {
  const state = ctx.controller.state;
  addPanel(ctx.scene, ctx.layer, GOAL_PANEL.x, GOAL_PANEL.y, GOAL_PANEL.w, GOAL_PANEL.h, PANEL_FILL);

  // Star counter: the game has no star currency, so the counter shows the real
  // progression it can stand for - how many of the seven stages are unlocked.
  addSoftPanel(ctx.scene, ctx.layer, GOAL_PANEL.x + 14, GOAL_PANEL.y + 8, 124, 54);
  pixelStar(ctx, GOAL_PANEL.x + 22, GOAL_PANEL.y + 14, 4);
  line(ctx, GOAL_PANEL.x + 62, GOAL_PANEL.y + 36, "x", 12, palette.muted);
  addDisplayText(ctx.scene, ctx.layer, GOAL_PANEL.x + 80, GOAL_PANEL.y + 20, `${stageIndex(state) + 1}`, 24, palette.green);
  line(ctx, GOAL_PANEL.x + 22, GOAL_PANEL.y + 54, `ETAPAS DE ${stages.length}`, 8, palette.muted, 110);

  const goals = getCareerGoals(state);
  line(ctx, GOAL_PANEL.x + 156, GOAL_PANEL.y + 20, "SIGUIENTE META:", 12, palette.ink, 240);
  goalRow(ctx, GOAL_PANEL.x + 156, GOAL_PANEL.y + 40, 268, goals[0]);
  if (goals[1]) {
    line(ctx, GOAL_PANEL.x + 448, GOAL_PANEL.y + 20, "TAMBIEN:", 12, palette.muted, 240);
    goalRow(ctx, GOAL_PANEL.x + 448, GOAL_PANEL.y + 40, 268, goals[1]);
  }
}

// Chunky pixel star (no star sprite exists yet).
const STAR_ROWS = [
  "....X....",
  "...XXX...",
  "XXXXXXXXX",
  ".XXXXXXX.",
  "..XXXXX..",
  "..XX.XX..",
  ".XX...XX.",
] as const;

function pixelStar(ctx: ViewCtx, x: number, y: number, cell: number): void {
  STAR_ROWS.forEach((row, ry) => {
    for (let rx = 0; rx < row.length; rx += 1) {
      if (row[rx] !== "X") continue;
      rect(ctx, x + rx * cell, y + ry * cell, cell, cell, ry < 3 ? "#f7dd7a" : palette.yellow);
    }
  });
}

// --- Keyboard node cursor -------------------------------------------------------

// The global InputRouter owns the room dock and the letter hotkeys; it ignores
// arrows and only preventDefaults Enter/Space while a sub-view is open, so the
// map adds its own cursor listener here and drops it on scene SHUTDOWN
// ("shutdown" is Phaser.Scenes.Events.SHUTDOWN, kept as a string to avoid a
// value import). It listens on window rather than through Phaser's keyboard
// plugin because that plugin skips events the router already preventDefaulted,
// which would swallow Enter on this screen.
function bindNodeKeys(ctx: ViewCtx): void {
  if (boundScene === ctx.scene) return;
  boundScene = ctx.scene;
  const { controller } = ctx;
  const step = (dir: 1 | -1) => {
    cursor = nextOpenIndex(controller, cursor + dir, dir);
    eventBus.emit("FOCUS_CHANGED", undefined);
  };
  const confirm = () => {
    const place = PLACES[cursor];
    if (place && !lockReason(controller, place)) activate(controller, place);
  };
  const onKey = (event: KeyboardEvent) => {
    // The director stops this scene on a mode change, but guard anyway: the map
    // cursor must never act while a battle owns the screen.
    if (controller.state.mode !== "career" || controller.careerView !== "map") return;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") step(1);
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") step(-1);
    else if (event.key === "Enter" || event.code === "Space") confirm();
    else return;
    event.preventDefault();
  };
  window.addEventListener("keydown", onKey);
  ctx.scene.events.once("shutdown", () => {
    window.removeEventListener("keydown", onKey);
    boundScene = null;
    cursor = 0;
  });
}

// Walks the node ring from `from` until it lands on a place that is not locked.
function nextOpenIndex(controller: GameController, from: number, dir: 1 | -1): number {
  const count = PLACES.length;
  for (let i = 0; i < count; i += 1) {
    const index = (((from + i * dir) % count) + count) % count;
    if (!lockReason(controller, PLACES[index])) return index;
  }
  return 0;
}
