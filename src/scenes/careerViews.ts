// Dispatcher for the seven non-base career views (calendar/map/training/social/
// work/shop/stats). CareerScene calls renderCareerView() on every redraw with
// the container it owns; each view lives in ./views/<name>View.ts and draws
// through the shared ./views/viewKit helpers. Keyboard input stays global in
// InputRouter.

import type Phaser from "phaser";
import { gameContext } from "../game/context";
import { renderCalendar } from "./views/calendarView";
import { renderMap } from "./views/mapView";
import { renderTraining } from "./views/trainingView";
import { renderSocial } from "./views/socialView";
import { renderWork } from "./views/workView";
import { renderShop } from "./views/shopView";
import { renderStats } from "./views/statsView";

const viewRenderers = {
  calendar: renderCalendar,
  map: renderMap,
  training: renderTraining,
  social: renderSocial,
  work: renderWork,
  shop: renderShop,
  stats: renderStats,
} as const;

export function renderCareerView(
  scene: Phaser.Scene,
  layer: Phaser.GameObjects.Container,
  view: "calendar" | "map" | "training" | "social" | "work" | "shop" | "stats",
): void {
  viewRenderers[view]({ scene, layer, controller: gameContext().controller });
}
