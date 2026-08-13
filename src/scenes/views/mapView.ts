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
//
// The city itself is now the mockup's OWN art (owner request, 2026-08-13: "algo
// mas similar a la imagen adjunta, simulando un 3d"). It used to be a procedural
// grid of flat boxes, which project rule 2 only tolerates while the real asset is
// missing — and it was not missing, it was baked into the mockup. So it was cut
// out (scripts/build-map-city.mjs), the mockup's own UI patched out of it with
// neighbouring city texture, palette-reduced to 128 colours (628 KB -> 226 KB)
// and scaled with NEAREST to keep the hard pixel edges.
//
// Every node coordinate below is DERIVED from where that place actually stands in
// the art: game = ((mockup_x - 31), (mockup_y - 161)) * 0.57747 + (16, 92).
//
// The mockup's own dotted paths, platform rings, pills, MC and padlock pins were
// inpainted OUT of the art, so the game still draws all of those from real state.
// Painting them into the asset was tried first and was wrong twice over: the pills
// sit on the paths, so removing a pill cut a hole in the line, and a painted path
// cannot know that the ESTUDIO is padlocked.

import type Phaser from "phaser";
import { eventBus } from "../../events/EventBus";
import { palette } from "../../ui/palette";
import { addDisplayText, addHitZone, addPanel, addSoftPanel, addSpriteImage } from "../../ui/kit";
import { getCareerGoals } from "../../systems/ProgressionSystem";
import { stageIndex } from "../../core/derived";
import { stages } from "../../data/stages";
import { goalRow, line, mcFigure, rect } from "./viewKit";
import { AssetRegistry } from "../../game/AssetRegistry";
import type { ViewCtx } from "./viewKit";
import type { CareerView } from "../../core/types";
import type { GameController } from "../../managers/GameController";

// Mockup: map panel 27..1644 x 79..766, bottom bar 786..909 split into a level
// panel (27..330) and a goals panel (348..1644).
const MAP = { x: 16, y: 92, w: 928, h: 348 } as const;
const LEVEL_PANEL = { x: 16, y: 451, w: 174, h: 71 } as const;
const GOAL_PANEL = { x: 200, y: 451, w: 744, h: 71 } as const;
const PANEL_FILL = "#050e2d";

// Only the panel fill survives: everything else this used to define (roads,
// rooftops, windows, trees) is in the city art now.
const CITY = { base: "#070c22" } as const;

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
// Routes the mockup draws between places, with the bow its hand-drawn curve has.
// `bow` is the perpendicular offset of the curve's midpoint in game px, measured
// off the mockup: negative bows the path away from the straight line towards the
// top of the screen. Straight lines were tried first and cut across rooftops,
// where the mockup's route follows the streets.
const PATHS: readonly { from: string; to: string; bow: number }[] = [
  { from: "pieza", to: "plaza", bow: -14 },
  { from: "pieza", to: "trabajo", bow: -6 },
  { from: "plaza", to: "tienda", bow: 5 },
  { from: "plaza", to: "estudio", bow: -20 },
];

const PLACES: readonly PlaceNode[] = [
  { id: "pieza", label: "TU PIEZA", kind: "home", x: 183, y: 251, labelDy: 78, view: "base" },
  { id: "trabajo", label: "TRABAJO", kind: "job", x: 261, y: 398, labelDy: 70, view: "work", hintActionId: "work" },
  { id: "plaza", label: "PLAZA", kind: "plaza", x: 503, y: 240, labelDy: 85, actionId: "battle" },
  { id: "tienda", label: "TIENDA", kind: "shop", x: 481, y: 421, labelDy: 94, view: "shop" },
  { id: "gimnasio", label: "GIMNASIO", kind: "gym", x: 725, y: 398, labelDy: 71, view: "training", hintActionId: "practice" },
  { id: "estudio", label: "ESTUDIO", kind: "studio", x: 790, y: 242, labelDy: 102, actionId: "record" },
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
  coverImage(ctx, AssetRegistry.scenes.mapCity.key, MAP.x, MAP.y, MAP.w, MAP.h);
  mapHeader(ctx);

  const byId = new Map(PLACES.map((place) => [place.id, place]));
  PATHS.forEach((route) => {
    const from = byId.get(route.from);
    const to = byId.get(route.to);
    if (!from || !to) return;
    const open = !lockReason(controller, from) && !lockReason(controller, to);
    dottedPath(ctx, from, to, route.bow, open);
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

// The mockup's glowing platform ellipse. Two earlier tries got this wrong in the
// same way: a stack of full-width rects. That passed on flat procedural boxes but
// on the real city art it reads as a concrete slab, and "hollowing" it by drawing
// black at alpha 0 does nothing at all — rect() paints, it cannot erase.
//
// So the ring is drawn as an OUTLINE: the flat top and bottom rows are full bars,
// and every row between them is two short end segments with nothing in the middle.
function platform(ctx: ViewCtx, x: number, y: number, open: boolean): void {
  const alpha = (open ? 0.85 : 0.32);
  const rx = 20;
  const ry = 6;
  rect(ctx, x - 14, y + ry - 1, 28, 2, "#03060f", 0.35 * alpha);
  for (let dy = -ry; dy <= ry; dy += 2) {
    const t = 1 - (dy / (ry + 1)) ** 2;
    if (t <= 0) continue;
    const half = Math.round(rx * Math.sqrt(t));
    const edge = Math.abs(dy) >= ry - 1;
    const fade = edge ? 0.5 : 1;
    if (edge || half <= 7) {
      rect(ctx, x - half, y + dy, half * 2, 2, NODE.platform, alpha * fade);
      continue;
    }
    // Middle rows: only the two ends, so the ground shows through the ring.
    const seg = Math.max(3, Math.round(half * 0.28));
    rect(ctx, x - half, y + dy, seg, 2, NODE.platform, alpha);
    rect(ctx, x + half - seg, y + dy, seg, 2, NODE.platform, alpha);
  }
}

// The only marker still drawn: the MC standing at his pieza. Every other place
// is a real building in the city art, so the procedural silhouettes that stood in
// for them (a grey box for the job, a red awning for the shop...) are gone — they
// would now be a second, worse shop sitting on top of the real one.
function marker(ctx: ViewCtx, place: PlaceNode): void {
  if (place.kind !== "home") return;
  mcFigure(ctx, place.x, place.y - 3, 0.6);
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

// Draws an image filling a box, cropping the overflow instead of stretching it —
// the same helper statsView and trainingView use for their backdrops.
function coverImage(ctx: ViewCtx, key: string, x: number, y: number, w: number, h: number): void {
  const image = addSpriteImage(ctx.scene, ctx.layer, key, x + w / 2, y + h / 2, h, 0.5, 0.5);
  if (!image || image.width <= 0 || image.height <= 0) return;
  const scale = Math.max(w / image.width, h / image.height);
  image.setScale(scale);
  image.setCrop((image.width - w / scale) / 2, (image.height - h / scale) / 2, w / scale, h / scale);
}

// Dotted route between two places, in the game's own hands again now that the art
// no longer paints one. Dimmed when either end is closed — the whole reason this
// is not baked into the asset.
//
// A quadratic curve, not a segment: `bow` pushes the midpoint perpendicular to the
// line by the amount measured off the mockup, so the route follows the streets the
// way the drawn one does instead of cutting over rooftops.
function dottedPath(ctx: ViewCtx, from: PlaceNode, to: PlaceNode, bow: number, open: boolean): void {
  const steps = 26;
  const color = open ? NODE.platform : "#5b628c";
  const alpha = open ? 0.9 : 0.35;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.max(1, Math.hypot(dx, dy));
  // Control point: the straight midpoint pushed along the line's normal.
  const cx = (from.x + to.x) / 2 + (-dy / len) * bow;
  const cy = (from.y + to.y) / 2 + (dx / len) * bow;
  for (let i = 1; i < steps; i += 2) {
    const t = i / steps;
    const u = 1 - t;
    const x = Math.round(u * u * from.x + 2 * u * t * cx + t * t * to.x);
    const y = Math.round(u * u * from.y + 2 * u * t * cy + t * t * to.y);
    // A round-ish dot: the mockup's are circles, not squares.
    rect(ctx, x - 2, y - 3, 4, 6, color, alpha);
    rect(ctx, x - 3, y - 2, 6, 4, color, alpha);
  }
}
