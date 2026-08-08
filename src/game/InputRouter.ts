// Global keyboard routing, ported 1:1 from the legacy canvas engine so the
// whole game stays playable with arrows + Enter/Space + hotkeys (project rule
// 5). Holds the focus cursors (presentation state); scenes read them for
// highlights. Pointer input is handled per-scene via Phaser interactives.

import type { CareerView } from "../core/types";
import { battleChoices } from "../data/battle";
import { socialPostOptions } from "../data/social";
import { jobOptions } from "../data/jobs";
import { upgrades } from "../data/upgrades";
import { calendarActionIds } from "../data/actions";
import { trainingStats } from "../data/stats";
import { clamp } from "../utils/math";
import { eventBus } from "../events/EventBus";
import type { GameController } from "../managers/GameController";

interface CareerNavItem {
  id: CareerView;
  key: string;
}

// Hotkeys stay exactly as they were when the room drew an eight-tab nav bar
// (Fase 4 removed the bar, not the keys).
const careerNavKeys: CareerNavItem[] = [
  { id: "base", key: "B" },
  { id: "calendar", key: "C" },
  { id: "map", key: "M" },
  { id: "training", key: "E" },
  { id: "social", key: "R" },
  { id: "work", key: "J" },
  { id: "shop", key: "T" },
  { id: "stats", key: "S" },
];

// Room dock slots (mockup navigation model): the five big tiles are the only
// on-screen navigation in the room, left to right. A slot either runs a career
// action or opens a career view. CareerScene renders one tile per slot and
// highlights `actionFocus`, so tiles and keyboard cursor cannot drift apart.
export interface CareerDockSlot {
  id: string;
  actionId?: string;
  view?: CareerView;
}

export const careerDockSlots: readonly CareerDockSlot[] = [
  { id: "rest", actionId: "rest" },
  { id: "train", view: "training" },
  { id: "write", actionId: "write" },
  { id: "social", view: "social" },
  { id: "exit", view: "map" },
];

export class InputRouter {
  // In the room this is the dock slot cursor (0..careerDockSlots.length-1).
  actionFocus = 0;
  battleFocus = 0;

  constructor(private readonly controller: GameController) {
    window.addEventListener("keydown", (event) => this.handleKey(event));
    eventBus.on("BATTLE_STARTED", () => {
      this.battleFocus = 0;
      eventBus.emit("FOCUS_CHANGED", undefined);
    });
  }

  private setActionFocus(value: number, max: number): void {
    this.actionFocus = clamp(value, 0, max);
    eventBus.emit("FOCUS_CHANGED", undefined);
  }

  // Pointer and keyboard share one path: clicking a dock tile also moves the
  // cursor there, so arrows continue from where the mouse left off.
  activateDockSlot(index: number): void {
    const slot = careerDockSlots[index];
    if (!slot) return;
    this.setActionFocus(index, careerDockSlots.length - 1);
    if (slot.view) {
      this.controller.setCareerView(slot.view);
      return;
    }
    if (!slot.actionId) return;
    const action = this.controller.careerActions().find((item) => item.id === slot.actionId);
    if (action && !action.disabledReason) this.controller.runCareerAction(action.id);
  }

  private setBattleFocus(value: number): void {
    this.battleFocus = clamp(value, 0, battleChoices.length - 1);
    eventBus.emit("FOCUS_CHANGED", undefined);
  }

  private handleKey(event: KeyboardEvent): void {
    const c = this.controller;
    const state = c.state;
    const isConfirm = event.key === "Enter" || event.code === "Space";

    if (event.key.toLowerCase() === "f") {
      this.toggleFullscreen();
      return;
    }

    if (state.mode === "start") {
      if (isConfirm) {
        if (c.hasSave() && !c.creatingNew) c.continueCareer();
        else c.startCareerFromMenu();
        event.preventDefault();
        return;
      }
      if (!c.creatingNew && c.hasSave()) return;
      if (event.key === "Backspace") {
        c.backspaceName();
        event.preventDefault();
        return;
      }
      if (event.key.length === 1) c.appendNameChar(event.key);
      return;
    }

    if (state.mode === "career") {
      const actions = c.careerActions();
      const lower = event.key.toLowerCase();
      const navMatch = careerNavKeys.find((item) => item.key.toLowerCase() === lower);
      if (navMatch) {
        c.setCareerView(navMatch.id);
        event.preventDefault();
        return;
      }
      if (event.key === "Escape") {
        c.setCareerView("base");
        event.preventDefault();
        return;
      }
      if (event.key.toLowerCase() === "u") {
        c.buyRecommendedUpgrade();
        event.preventDefault();
        return;
      }
      const number = Number(event.key);
      if (Number.isInteger(number) && number > 0 && c.careerView !== "base") {
        if (c.careerView === "calendar") {
          const actionId = calendarActionIds[number - 1];
          if (actionId) c.runCareerAction(actionId);
        } else if (c.careerView === "training") {
          const stat = trainingStats[number - 1];
          if (stat) c.trainSpecificStat(stat);
        } else if (c.careerView === "social") {
          const option = socialPostOptions[number - 1];
          if (option) c.publishSocialPost(option);
        } else if (c.careerView === "work") {
          const option = jobOptions[number - 1];
          if (option) c.performJob(option);
        } else if (c.careerView === "shop") {
          const upgrade = upgrades[number - 1];
          if (upgrade) c.buyUpgradeByKey(upgrade.key);
        }
        event.preventDefault();
        return;
      }
      if (c.careerView !== "base") {
        if (isConfirm) event.preventDefault();
        return;
      }
      // The room is a single row of five dock tiles, so the cursor walks it
      // horizontally; up/down are previous/next so nobody gets stuck.
      const lastSlot = careerDockSlots.length - 1;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        this.setActionFocus(this.actionFocus + 1, lastSlot);
        event.preventDefault();
        return;
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        this.setActionFocus(this.actionFocus - 1, lastSlot);
        event.preventDefault();
        return;
      }
      if (isConfirm) {
        this.activateDockSlot(this.actionFocus);
        event.preventDefault();
        return;
      }
      if (Number.isInteger(number) && number > 0) {
        const action = actions[number - 1];
        if (action && !action.disabledReason) c.runCareerAction(action.id);
      }
      return;
    }

    if (state.mode === "battle") {
      const battle = state.battle;
      if (!battle) return;
      if (battle.finished && isConfirm) {
        c.finishBattle();
        event.preventDefault();
        return;
      }
      if (event.key === "ArrowRight") {
        this.setBattleFocus(this.battleFocus + 1);
        event.preventDefault();
        return;
      }
      if (event.key === "ArrowLeft") {
        this.setBattleFocus(this.battleFocus - 1);
        event.preventDefault();
        return;
      }
      if (event.key === "ArrowDown") {
        this.setBattleFocus(this.battleFocus + 3);
        event.preventDefault();
        return;
      }
      if (event.key === "ArrowUp") {
        this.setBattleFocus(this.battleFocus - 3);
        event.preventDefault();
        return;
      }
      if (isConfirm) {
        c.resolveBattle(battleChoices[this.battleFocus]);
        event.preventDefault();
        return;
      }
      const number = Number(event.key);
      if (Number.isInteger(number) && number >= 1 && number <= battleChoices.length) {
        c.resolveBattle(battleChoices[number - 1]);
      }
    }
  }

  private toggleFullscreen(): void {
    const canvas = document.querySelector("#game-root canvas");
    if (!document.fullscreenElement) {
      canvas?.requestFullscreen?.().catch(() => {
        // Fullscreen is a nicety; ignore rejections (e.g. not user-gesture).
      });
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }
}
