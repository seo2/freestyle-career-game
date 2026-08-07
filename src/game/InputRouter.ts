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

export class InputRouter {
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
      if (event.key === "ArrowRight") {
        this.setActionFocus(this.actionFocus + 1, actions.length - 1);
        event.preventDefault();
        return;
      }
      if (event.key === "ArrowLeft") {
        this.setActionFocus(this.actionFocus - 1, actions.length - 1);
        event.preventDefault();
        return;
      }
      if (event.key === "ArrowDown") {
        this.setActionFocus(this.actionFocus + 2, actions.length - 1);
        event.preventDefault();
        return;
      }
      if (event.key === "ArrowUp") {
        this.setActionFocus(this.actionFocus - 2, actions.length - 1);
        event.preventDefault();
        return;
      }
      if (isConfirm) {
        const action = actions[this.actionFocus];
        if (action && !action.disabledReason) c.runCareerAction(action.id);
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
