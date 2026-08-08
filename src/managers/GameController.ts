// Orchestration layer between the Phaser scenes and the pure systems.
// Owns the live GameState, RNG, persistence, careerView and the agenda-strip
// animation (timeFx). Contains no game rules (AGENTS.md: managers coordinate;
// rules live in src/systems). Scenes call commands; the controller applies
// them through systems, finalizes/saves, and emits events on the bus.

import type {
  ActionResult,
  BattleChoice,
  CareerActionInfo,
  CareerView,
  Difficulty,
  GameState,
  JobOption,
  SocialPostOption,
  StatKey,
  TimeAdvance,
  UpgradeKey,
} from "../core/types";
import { createNewState } from "../core/state";
import { momentumMood } from "../core/derived";
import { DifficultyConfig } from "../data/config/DifficultyConfig";
import { NewGameConfig } from "../data/config/NewGameConfig";
import { createStateRng, type RandomSource } from "../services/RandomService";
import { createSaveManager, type SaveManagerApi } from "./SaveManager";
import { battleChoices } from "../data/battle";
import { eventBus } from "../events/EventBus";
import { finalizeEvent, getCareerGoals } from "../systems/ProgressionSystem";
import { formatBlock } from "../systems/CalendarSystem";
import { finishBattle as finishBattleSys, resolveBattle as resolveBattleSys } from "../systems/BattleSystem";
import {
  buyItem as buyItemSys,
  buyRecommendedItem as buyRecommendedItemSys,
  buyUpgradeByKey as buyUpgradeByKeySys,
  canAffordItem,
  recommendedItem,
} from "../systems/StoreSystem";
import { trainSpecificStat as trainSpecificStatSys } from "../systems/TrainingSystem";
import { publishSocialPost as publishSocialPostSys } from "../systems/SocialSystem";
import { performJob as performJobSys } from "../systems/JobsSystem";
import { executeAction, getCareerActions } from "../systems/ActionsSystem";

export interface TimeAdvanceFx extends TimeAdvance {
  elapsed: number;
  duration: number;
}

const TIME_FX_DURATION = 1.8;

// Characters accepted by the two text fields of the Crear MC screen.
const NAME_CHAR = /^[a-zA-Z0-9 _-]$/;

// Wraps an index into 0..length-1 for any (even negative) delta.
function wrapIndex(index: number, length: number): number {
  return ((index % length) + length) % length;
}

// Wraps a 1-based option index (look/skin/voice) by delta inside 1..count.
function wrapOption(current: number, delta: number, count: number): number {
  return wrapIndex(current - 1 + delta, count) + 1;
}

export class GameController {
  state: GameState;
  careerView: CareerView = "base";
  timeFx: TimeAdvanceFx | null = null;
  creatingNew: boolean;
  savedSnapshot: GameState | null;

  readonly rng: RandomSource;
  private readonly saveManager: SaveManagerApi;

  constructor(storage: Storage) {
    this.saveManager = createSaveManager(storage);
    this.savedSnapshot = this.saveManager.load();
    this.creatingNew = !this.savedSnapshot;
    this.state = this.savedSnapshot ? this.saveManager.normalize(this.savedSnapshot) : createNewState();
    // Bind the RNG to whatever GameState is currently active so the stream
    // survives save/continue/new-game swaps (accessor host).
    const liveState = () => this.state;
    this.rng = createStateRng({
      get seed() {
        return liveState().seed;
      },
      set seed(value: number) {
        liveState().seed = value;
      },
    });
  }

  hasSave(): boolean {
    return this.savedSnapshot !== null;
  }

  // --- Frame update (agenda-strip animation + idle clock) --------------------

  update(dt: number): void {
    this.state.animationTime += dt;
    if (this.timeFx) {
      this.timeFx.elapsed += dt;
      if (this.timeFx.elapsed >= this.timeFx.duration) {
        this.timeFx = null;
      }
    }
  }

  // --- Event/save plumbing ----------------------------------------------------

  private saveState(): void {
    this.savedSnapshot = this.saveManager.save(this.state);
  }

  private setEvent(parts: string[]): void {
    finalizeEvent(this.state, parts);
    this.saveState();
  }

  private startTimeFx(fx: TimeAdvance): void {
    this.timeFx = { ...fx, elapsed: 0, duration: TIME_FX_DURATION };
    eventBus.emit("TIME_ADVANCED", fx);
  }

  private applyResult(result: ActionResult): void {
    if (result.type === "event") {
      if (result.fx) this.startTimeFx(result.fx);
      this.setEvent(result.parts);
    } else if (result.type === "battle-started") {
      eventBus.emit("BATTLE_STARTED", undefined);
      eventBus.emit("MODE_CHANGED", this.state.mode);
    }
    eventBus.emit("STATE_CHANGED", undefined);
  }

  // --- Career commands ---------------------------------------------------------

  runCareerAction(actionId: string): void {
    this.applyResult(executeAction(this.state, this.rng, actionId));
  }

  trainSpecificStat(stat: StatKey): void {
    this.applyResult(trainSpecificStatSys(this.state, this.rng, stat));
  }

  publishSocialPost(option: SocialPostOption): void {
    this.applyResult(publishSocialPostSys(this.state, this.rng, option));
  }

  performJob(option: JobOption): void {
    this.applyResult(performJobSys(this.state, this.rng, option));
  }

  // Tienda: buy one catalogue item by id (src/data/items.ts).
  buyItem(itemId: string): void {
    this.applyResult(buyItemSys(this.state, this.rng, itemId));
  }

  // Recommended purchase (U hotkey): cheapest affordable unowned item.
  buyRecommendedItem(): void {
    this.applyResult(buyRecommendedItemSys(this.state, this.rng));
  }

  /** @deprecated Legacy name of the recommended purchase; kept for the U hotkey. */
  buyRecommendedUpgrade(): void {
    this.buyRecommendedItem();
  }

  /** @deprecated Internal level bump; the store UI sells items instead. */
  buyUpgradeByKey(key: UpgradeKey): void {
    this.applyResult(buyUpgradeByKeySys(this.state, this.rng, key));
  }

  setCareerView(view: CareerView): void {
    if (this.careerView === view) return;
    this.careerView = view;
    eventBus.emit("CAREER_VIEW_CHANGED", view);
    eventBus.emit("STATE_CHANGED", undefined);
  }

  // --- Battle commands -----------------------------------------------------------

  resolveBattle(choice: BattleChoice): void {
    resolveBattleSys(this.state, this.rng, choice);
    eventBus.emit("STATE_CHANGED", undefined);
  }

  finishBattle(): void {
    const result = finishBattleSys(this.state, this.rng);
    if (!result) return;
    this.careerView = "base";
    this.startTimeFx(result.fx);
    this.setEvent(result.parts);
    eventBus.emit("BATTLE_FINISHED", undefined);
    eventBus.emit("MODE_CHANGED", this.state.mode);
    eventBus.emit("STATE_CHANGED", undefined);
  }

  // --- Menu / save flows -----------------------------------------------------------

  startCareerFromMenu(): void {
    const identity = this.state.inputName.trim().slice(0, NewGameConfig.identity.nameMaxLength);
    const cleanName = identity || "MC Barrio";
    // The Crear MC screen edits the draft state; carry its identity across the
    // fresh-career reset (createNewState clears everything else).
    const draft = this.state;
    this.state = createNewState(cleanName);
    this.state.playerName = cleanName;
    this.state.inputName = cleanName;
    this.state.nickname = draft.nickname.trim() || NewGameConfig.identity.nickname;
    this.state.look = draft.look;
    this.state.skin = draft.skin;
    this.state.voice = draft.voice;
    this.state.difficulty = draft.difficulty;
    this.state.mode = "career";
    this.state.lastEvent = `${cleanName} parte rapeando en su pieza.`;
    this.creatingNew = false;
    this.careerView = "base";
    this.timeFx = null;
    this.saveState();
    eventBus.emit("MODE_CHANGED", this.state.mode);
    eventBus.emit("STATE_CHANGED", undefined);
  }

  continueCareer(): void {
    const saved = this.saveManager.load();
    if (!saved) return;
    this.state = {
      ...this.saveManager.normalize(saved),
      mode: "career",
      lastEvent: "Retomaste la carrera desde tu ultimo guardado.",
    };
    this.creatingNew = false;
    this.careerView = "base";
    this.timeFx = null;
    eventBus.emit("MODE_CHANGED", this.state.mode);
    eventBus.emit("STATE_CHANGED", undefined);
  }

  newCareerDraft(): void {
    this.creatingNew = true;
    this.state = createNewState("");
    this.state.inputName = "";
    this.state.lastEvent = "Nueva carrera: elige nombre artistico.";
    this.careerView = "base";
    this.timeFx = null;
    eventBus.emit("MODE_CHANGED", this.state.mode);
    eventBus.emit("STATE_CHANGED", undefined);
  }

  loadSavedIntoDraft(): void {
    if (!this.savedSnapshot) return;
    this.creatingNew = false;
    this.state = this.saveManager.normalize(this.savedSnapshot);
    eventBus.emit("MODE_CHANGED", this.state.mode);
    eventBus.emit("STATE_CHANGED", undefined);
  }

  // --- Name input (create MC screen) ----------------------------------------------

  appendNameChar(char: string): void {
    if (this.state.inputName.length < NewGameConfig.identity.nameMaxLength && NAME_CHAR.test(char)) {
      this.state.inputName += char;
      eventBus.emit("STATE_CHANGED", undefined);
    }
  }

  backspaceName(): void {
    this.state.inputName = this.state.inputName.slice(0, -1);
    eventBus.emit("STATE_CHANGED", undefined);
  }

  // --- Identity commands (Crear MC screen) -------------------------------------
  // Cosmetic selectors wrap through their option count; difficulty wraps through
  // DifficultyConfig.order. Every setter is one field + STATE_CHANGED.

  setNickname(value: string): void {
    this.state.nickname = value.slice(0, NewGameConfig.identity.nicknameMaxLength);
    eventBus.emit("STATE_CHANGED", undefined);
  }

  appendNicknameChar(char: string): void {
    if (this.state.nickname.length < NewGameConfig.identity.nicknameMaxLength && NAME_CHAR.test(char)) {
      this.state.nickname += char;
      eventBus.emit("STATE_CHANGED", undefined);
    }
  }

  backspaceNickname(): void {
    this.state.nickname = this.state.nickname.slice(0, -1);
    eventBus.emit("STATE_CHANGED", undefined);
  }

  cycleLook(delta: number): void {
    this.state.look = wrapOption(this.state.look, delta, NewGameConfig.identityOptions.looks);
    eventBus.emit("STATE_CHANGED", undefined);
  }

  cycleSkin(delta: number): void {
    this.state.skin = wrapOption(this.state.skin, delta, NewGameConfig.identityOptions.skins);
    eventBus.emit("STATE_CHANGED", undefined);
  }

  cycleVoice(delta: number): void {
    this.state.voice = wrapOption(this.state.voice, delta, NewGameConfig.identityOptions.voices);
    eventBus.emit("STATE_CHANGED", undefined);
  }

  cycleDifficulty(delta: number): void {
    const order = DifficultyConfig.order;
    const current = Math.max(0, order.indexOf(this.state.difficulty));
    const next: Difficulty = order[wrapIndex(current + delta, order.length)];
    this.state.difficulty = next;
    eventBus.emit("STATE_CHANGED", undefined);
  }

  // --- Deterministic test hook (kept renderer-independent) --------------------------

  renderGameToText(): string {
    const state = this.state;
    const recommended = recommendedItem(state);
    const actions =
      state.mode === "career"
        ? getCareerActions(state).map((action, index) => ({
            key: String(index + 1),
            id: action.id,
            label: action.label,
            durationBlocks: action.durationBlocks,
            cost: action.cost,
            rhythm: action.rhythm,
            disabled: Boolean(action.disabledReason),
            reason: action.disabledReason ?? null,
          }))
        : [];
    const battle = state.battle
      ? {
          event: state.battle.eventName,
          rival: state.battle.rivalName,
          round: state.battle.round,
          score: `${state.battle.playerScore}-${state.battle.rivalScore}`,
          hype: state.battle.hype,
          prompt: state.battle.prompt.text,
          finished: state.battle.finished,
          result: state.battle.result,
          choices: battleChoices.map((choice, index) => ({
            key: String(index + 1),
            id: choice.id,
            label: choice.label,
            boosted: state.battle?.prompt.best.includes(choice.id) ?? false,
          })),
        }
      : null;
    return JSON.stringify({
      coordinate_system: "canvas 960x540, origin top-left, x right, y down",
      mode: state.mode,
      careerView: state.mode === "career" ? this.careerView : null,
      player: {
        name: state.playerName,
        nickname: state.nickname,
        look: state.look,
        skin: state.skin,
        voice: state.voice,
        difficulty: state.difficulty,
        stage: state.stage,
        level: state.level,
        week: state.week,
        day: state.day,
        block: state.block,
        timeLabel: formatBlock(state.block),
        xp: state.xp,
        xpNext: state.xpNext,
        energy: state.energy,
        health: state.health,
        cash: state.cash,
        fans: state.fans,
        respect: state.respect,
        fame: state.fame,
        songs: state.songs,
        discProgress: state.discProgress,
        upgrades: {
          outfit: state.outfitLevel,
          studio: state.studioLevel,
          home: state.homeLevel,
        },
        items: [...state.items],
        momentum: state.momentum,
        momentumMood: momentumMood(state),
        lastActionId: state.lastActionId,
        actionStreak: state.actionStreak,
        stats: state.stats,
      },
      timeFx: this.timeFx
        ? {
            label: this.timeFx.label,
            blocks: this.timeFx.blocks,
            from: formatBlock(this.timeFx.fromBlock),
            to: formatBlock(this.timeFx.toBlock),
            daysPassed: this.timeFx.daysPassed,
          }
        : null,
      lastEvent: state.lastEvent,
      goals: getCareerGoals(state).map((goal) => ({
        label: goal.label,
        detail: goal.detail,
        value: goal.value,
        max: goal.max,
      })),
      recommendedItem: recommended
        ? {
            id: recommended.id,
            label: recommended.label,
            category: recommended.category,
            price: recommended.price,
            affordable: canAffordItem(state, recommended),
          }
        : null,
      actions,
      battle,
    });
  }

  // Convenience reads shared by scenes.
  careerActions(): CareerActionInfo[] {
    return getCareerActions(this.state);
  }
}
