// Orchestration layer between the Phaser scenes and the pure systems.
// Owns the live GameState, RNG, persistence, careerView and the agenda-strip
// animation (timeFx). Contains no game rules (AGENTS.md: managers coordinate;
// rules live in src/systems). Scenes call commands; the controller applies
// them through systems, finalizes/saves, and emits events on the bus.

import type {
  ActionResult,
  BattleResource,
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
import { DifficultyConfig } from "../data/config/DifficultyConfig";
import { NewGameConfig } from "../data/config/NewGameConfig";
import { createStateRng, type RandomSource } from "../services/RandomService";
import { createSaveManager, type SaveManagerApi } from "./SaveManager";
import { eventBus } from "../events/EventBus";
import { addXp, finalizeEvent } from "../systems/ProgressionSystem";
import { spendActionTime } from "../systems/CalendarSystem";
import { renderStateToText } from "./renderState";
import type { AudioService } from "../services/AudioService";
import type { SoundId } from "../data/sounds";
import { beardStyles, hairColors, hairStyles } from "../data/character";
import { buyLook as buyLookSys, type BarberSlot } from "../systems/BarberSystem";
import { resolveDilemma as resolveDilemmaSys, rollDilemma } from "../systems/DilemmaSystem";
import { closeEpilogue as closeEpilogueSys } from "../systems/EpilogueSystem";
import {
  advanceCypher as advanceCypherSys,
  finishCypher as finishCypherSys,
  throwResource as throwResourceSys,
} from "../systems/CypherSystem";
import {
  advanceBattleRound as advanceBattleRoundSys,
  expireBattleRound as expireBattleRoundSys,
  finishBattle as finishBattleSys,
  resolveBattle as resolveBattleSys,
} from "../systems/BattleSystem";
import {
  buyItem as buyItemSys,
  buyRecommendedItem as buyRecommendedItemSys,
  buyUpgradeByKey as buyUpgradeByKeySys,
} from "../systems/StoreSystem";
import { trainSpecificStat as trainSpecificStatSys } from "../systems/TrainingSystem";
import { publishSocialPost as publishSocialPostSys } from "../systems/SocialSystem";
import { performJob as performJobSys } from "../systems/JobsSystem";
import { executeAction, getCareerActions } from "../systems/ActionsSystem";
import {
  battleDay,
  clearPlan as clearPlanSys,
  dayAlreadyLived,
  OFFER_ACTION_ID,
  planDay as planDaySys,
  plannedActionFor,
  recordBattleOutcome,
  recordDay,
  todaysPlan,
} from "../systems/PlanSystem";
import { PlanConfig } from "../data/config/PlanConfig";
import {
  expireOpportunities,
  findOpportunity,
  opportunityOn,
  rollWeekOpportunities,
  takeOpportunity,
} from "../systems/OpportunitySystem";
import { calendarActionIds } from "../data/actions";

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
// Steps through a piece list by id and wraps. Keeps the data in src/data as the
// source of truth: adding a hairstyle needs no change here.
function cycleId(pieces: readonly { id: string }[], current: string, delta: number): string {
  if (pieces.length === 0) return current;
  const index = pieces.findIndex((piece) => piece.id === current);
  const next = ((index < 0 ? 0 : index) + delta + pieces.length) % pieces.length;
  return pieces[next].id;
}

function wrapOption(current: number, delta: number, count: number): number {
  return wrapIndex(current - 1 + delta, count) + 1;
}

export class GameController {
  state: GameState;
  careerView: CareerView = "base";
  private audio: AudioService | null = null;
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
    if (!this.savedSnapshot) {
      // Fresh install goes straight to Crear MC: start the name empty so the
      // mockup's "TU NOMBRE" placeholder is honest and typing does not append
      // to the fallback name. startCareerFromMenu restores the fallback.
      this.state.inputName = "";
    }
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

  // --- Frame update (agenda-strip animation + battle timer + idle clock) -----

  update(dt: number): void {
    this.state.animationTime += dt;
    this.tickBattleTimer(dt);
    if (this.timeFx) {
      this.timeFx.elapsed += dt;
      if (this.timeFx.elapsed >= this.timeFx.duration) {
        this.timeFx = null;
      }
    }
  }

  // Decision timer: ticks only while the player is choosing a card (never on
  // the verdict/result beats) and expires the round into its Pasada verdict.
  // Living in update() keeps it testable through window.advanceTime(ms).
  private tickBattleTimer(dt: number): void {
    const battle = this.state.battle;
    if (this.state.mode !== "battle" || !battle || battle.finished || battle.pendingResult) return;
    battle.timeLeft = Math.max(0, battle.timeLeft - dt);
    if (battle.timeLeft > 0) return;
    expireBattleRoundSys(this.state, this.rng);
    eventBus.emit("STATE_CHANGED", undefined);
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
    // Time may have moved, so offers whose day has passed die here (announced
    // with the event, not silently) and a new week knocks with its own.
    const missed = expireOpportunities(this.state);
    this.ensureWeekOpportunities();
    // The Bible's loop puts events after consequences: a lived day can bring a
    // decision. Rolled here so every path that spends time can raise one.
    const dilemma = result.type === "event" ? rollDilemma(this.state, this.rng) : null;
    if (result.type === "event") {
      if (result.fx) this.startTimeFx(result.fx);
      this.setEvent([...result.parts, ...missed]);
    } else if (result.type === "battle-started") {
      eventBus.emit("BATTLE_STARTED", undefined);
      eventBus.emit("MODE_CHANGED", this.state.mode);
    } else if (result.type === "cypher-started") {
      eventBus.emit("MODE_CHANGED", this.state.mode);
    }
    if (dilemma) eventBus.emit("MODE_CHANGED", this.state.mode);
    eventBus.emit("STATE_CHANGED", undefined);
  }

  // Rolls this week's offers exactly once. Driven by state (the week marker), so
  // the RNG stream stays deterministic however many times this is called.
  private ensureWeekOpportunities(): void {
    if (this.state.opportunitiesWeek === this.state.week) return;
    this.state.opportunitiesWeek = this.state.week;
    this.state.opportunities = rollWeekOpportunities(this.state, this.rng);
  }

  // --- Career commands ---------------------------------------------------------

  runCareerAction(actionId: string): void {
    this.applyResult(executeAction(this.state, this.rng, actionId));
  }

  // --- Weekly plan (Fase 6) ---------------------------------------------------

  // The label the UI shows for an action id, taken from the same source the
  // action list uses so the calendar can never name an action differently.
  private actionLabel(actionId: string): string {
    // The offer slot is not a career action: it names the offer scheduled for
    // that day, so the calendar never shows a raw id.
    if (actionId === OFFER_ACTION_ID) {
      const entry = opportunityOn(this.state, this.state.day);
      return findOpportunity(entry?.id ?? "")?.label ?? "Oportunidad";
    }
    return this.careerActions().find((action) => action.id === actionId)?.label ?? actionId;
  }

  // Writing intent into a day. Free and reversible: the cost is in living it.
  planDay(day: number, actionId: string | null): void {
    if (!planDaySys(this.state, day, actionId)) return;
    const named =
      actionId === OFFER_ACTION_ID
        ? (findOpportunity(opportunityOn(this.state, day)?.id ?? "")?.label ?? "Oportunidad")
        : this.actionLabel(actionId ?? "");
    this.state.lastEvent = actionId === null ? `Dia ${day} liberado.` : `Dia ${day}: ${named}.`;
    eventBus.emit("STATE_CHANGED", undefined);
  }

  // Walks a day through the actions it can hold and back to open. Lives here so
  // the click and the digit key cannot drift apart, and so the battle's
  // weekday rule is applied in one place.
  cyclePlanForDay(day: number): void {
    const options: (string | null)[] = [
      null,
      // The day's offer comes first: it is the thing with a deadline.
      ...(opportunityOn(this.state, day) ? [OFFER_ACTION_ID] : []),
      ...calendarActionIds.filter((id) => id !== "battle" || day === battleDay()),
    ];
    const current = plannedActionFor(this.state, day);
    const index = options.indexOf(current);
    // Sounded here rather than only in the router: the calendar cards are
    // clickable too, and a mouse player deserves the same feedback.
    this.playSound("uiMove");
    this.planDay(day, options[(index + 1) % options.length]);
  }

  clearWeekPlan(): void {
    clearPlanSys(this.state);
    this.state.lastEvent = "Agenda de la semana borrada.";
    eventBus.emit("STATE_CHANGED", undefined);
  }

  // Living today: run what the week says and record what actually happened.
  // This is the Bible's "execute" step and the only place a planned day turns
  // into consequences.
  runPlannedDay(): void {
    if (dayAlreadyLived(this.state)) {
      // The day's commitment is spent: the blocks left are for room actions, so
      // the plan cannot be farmed by pressing the button again.
      this.state.lastEvent = "Ya viviste el plan de hoy. Lo que quede del dia se hace desde la pieza.";
      eventBus.emit("STATE_CHANGED", undefined);
      return;
    }
    const planned = todaysPlan(this.state);
    if (planned === null) {
      // A day nobody planned still passes. Saying so out loud beats letting the
      // player think the button was broken.
      const drift = PlanConfig.idleDay;
      this.state.momentum = Math.max(0, this.state.momentum - drift.momentumPenalty);
      recordDay(this.state, null, null, drift.message);
      this.runDayAs("rest", drift.message);
      return;
    }
    if (planned === OFFER_ACTION_ID) {
      this.livePlannedOpportunity();
      return;
    }
    const info = this.careerActions().find((action) => action.id === planned);
    if (info?.disabledReason) {
      // The plan broke: you scheduled more than the week could carry, so the day
      // falls through to rest instead of the plan vanishing silently.
      recordDay(this.state, planned, "rest", PlanConfig.brokenPlan.message);
      this.runDayAs("rest", PlanConfig.brokenPlan.message);
      return;
    }
    const result = executeAction(this.state, this.rng, planned);
    recordDay(this.state, planned, planned, result.type === "event" ? result.parts[0] : this.actionLabel(planned));
    this.applyResult(result);
  }

  // Living the day an offer was scheduled for: it pays out and costs its own
  // energy and blocks. Falls back to rest (explaining it) when the day arrives
  // and the energy is not there, exactly like a broken plan.
  private livePlannedOpportunity(): void {
    const entry = opportunityOn(this.state, this.state.day);
    const offer = entry ? findOpportunity(entry.id) : null;
    if (!offer) {
      // The offer is gone (taken or expired): the day is open again.
      this.state.lastEvent = "Esa oportunidad ya no esta.";
      eventBus.emit("STATE_CHANGED", undefined);
      return;
    }
    const payout = takeOpportunity(this.state, this.state.day);
    if (!payout) {
      recordDay(this.state, OFFER_ACTION_ID, "rest", PlanConfig.brokenPlan.message);
      this.runDayAs("rest", PlanConfig.brokenPlan.message);
      return;
    }
    // Time and energy are the calendar's business, so they go through the same
    // path every action uses.
    const clock = spendActionTime(this.state, offer.energyCost, offer.blocks, offer.label);
    addXp(this.state, offer.xp ?? 0);
    recordDay(this.state, OFFER_ACTION_ID, OFFER_ACTION_ID, payout.message);
    this.startTimeFx(clock.fx);
    this.setEvent([payout.message, ...clock.messages]);
    eventBus.emit("STATE_CHANGED", undefined);
  }

  // Runs a fallback action for the day and puts the reason in front of the
  // event line, so the player always learns why the day went the way it did.
  private runDayAs(actionId: string, reason: string): void {
    const result = executeAction(this.state, this.rng, actionId);
    if (result.type === "event") {
      if (result.fx) this.startTimeFx(result.fx);
      this.setEvent([reason, ...result.parts]);
    }
    eventBus.emit("STATE_CHANGED", undefined);
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

  // --- Audio (Fase 8) ------------------------------------------------------------

  // The service is created by the bootstrap (it needs a browser), so the
  // controller only holds it to keep it in step with the save.
  attachAudio(audio: AudioService): void {
    this.audio = audio;
    audio.applySettings(this.state.audio);
  }

  // UI sounds come from the INPUT layer, not from a state diff: only the router
  // knows that a key was accepted, refused, or merely moved a cursor. Verifying
  // the audio log showed the cost of not having this — planning a day and playing
  // a card were both silent, and `cardPlayed` was a sound nothing could trigger.
  playSound(id: SoundId): void {
    this.audio?.play(id);
  }

  // The mockup's menu carries a single "MUSICA: SI/NO", so one switch moves both:
  // a player turning the sound off means all of it.
  toggleSound(): void {
    const on = !(this.state.audio.sfxOn || this.state.audio.musicOn);
    this.state.audio = { ...this.state.audio, sfxOn: on, musicOn: on };
    this.audio?.applySettings(this.state.audio);
    // Persisted immediately: the closing criterion of Fase 8 is that this
    // survives a reload, and a setting is not a move you should have to confirm.
    this.saveState();
    eventBus.emit("STATE_CHANGED", undefined);
  }

  // The barbershop (Fase 10). Charged and applied in one place so the screen only
  // has to say which chair the player sat in.
  buyLook(slot: BarberSlot, id: string): void {
    const parts = buyLookSys(this.state, slot, id);
    if (!parts) {
      this.playSound("uiDenied");
      return;
    }
    this.playSound("cash");
    this.setEvent(parts);
    eventBus.emit("STATE_CHANGED", undefined);
  }

  setCareerView(view: CareerView): void {
    if (this.careerView === view) return;
    this.careerView = view;
    eventBus.emit("CAREER_VIEW_CHANGED", view);
    eventBus.emit("STATE_CHANGED", undefined);
  }

  // --- Battle commands -----------------------------------------------------------

  resolveBattle(choice: BattleResource): void {
    // Every route into a played card passes through here — digit, Enter on the
    // focused card, or a click on it — so this is the one place it can sound once.
    this.playSound("cardPlayed");
    resolveBattleSys(this.state, this.rng, choice);
    eventBus.emit("STATE_CHANGED", undefined);
  }

  // Confirms the round-result beat: next round, or the final verdict screen
  // after the last round (finishBattle then collects it).
  advanceBattleRound(): void {
    advanceBattleRoundSys(this.state, this.rng);
    eventBus.emit("STATE_CHANGED", undefined);
  }

  finishBattle(): void {
    // The day the battle was fought, captured before the payout advances the
    // clock (a late-night battle can roll the day over).
    const foughtDay = this.state.day;
    const outcome = this.state.battle?.result ?? null;
    const result = finishBattleSys(this.state, this.rng);
    if (!result) return;
    if (outcome) recordBattleOutcome(this.state, foughtDay, result.parts[0], outcome);
    this.careerView = "base";
    this.startTimeFx(result.fx);
    this.setEvent(result.parts);
    eventBus.emit("BATTLE_FINISHED", undefined);
    eventBus.emit("MODE_CHANGED", this.state.mode);
    eventBus.emit("STATE_CHANGED", undefined);
  }

  // --- Arc epilogue (Fase 7) ---------------------------------------------------

  // Closing the chapter. It is a read of the state, so nothing is stored: the
  // same epilogue can always be rebuilt from the career that produced it.
  closeEpilogue(): void {
    if (!this.state.pendingEpilogue) return;
    closeEpilogueSys(this.state);
    this.careerView = "base";
    this.saveState();
    eventBus.emit("MODE_CHANGED", this.state.mode);
    eventBus.emit("STATE_CHANGED", undefined);
  }

  // --- Dilemmas (Fase 7: mismo origen, destinos distintos) ---------------------

  // Answering the dilemma. No RNG: the outcome is the player's decision, and it
  // is written into the career's memory before anything else happens.
  answerDilemma(optionId: string): void {
    const resolution = resolveDilemmaSys(this.state, optionId);
    if (!resolution) return;
    this.careerView = "base";
    this.setEvent(resolution.parts);
    eventBus.emit("MODE_CHANGED", this.state.mode);
    eventBus.emit("STATE_CHANGED", undefined);
  }

  // --- Cypher (training with its own screen) -----------------------------------

  throwCypher(choice: BattleResource): void {
    throwResourceSys(this.state, this.rng, choice);
    eventBus.emit("STATE_CHANGED", undefined);
  }

  advanceCypherTurn(): void {
    advanceCypherSys(this.state, this.rng);
    eventBus.emit("STATE_CHANGED", undefined);
  }

  // Closing the circle: pays momentum, career xp and the clock, and records the
  // day so a planned cypher shows up in the weekly summary like any other day.
  finishCypher(): void {
    const outcome = finishCypherSys(this.state, this.rng);
    if (!outcome) return;
    recordDay(this.state, todaysPlan(this.state), "cypher", outcome.parts[0]);
    this.careerView = "base";
    this.startTimeFx(outcome.fx);
    this.setEvent(outcome.parts);
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
    // The week's offers are rolled before the first decision: an opportunity
    // you cannot see coming is not an opportunity.
    this.ensureWeekOpportunities();
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
    // A save from before this week's roll (or from before Fase 6) gets its
    // offers here, so resuming never lands on an empty week by accident.
    this.ensureWeekOpportunities();
    // A chapter that closed before the player quit is still owed to them.
    if (this.state.pendingEpilogue) this.state.mode = "epilogue";
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

  // The modular pieces (Fase 10). Cycling by id keeps the data as the source of
  // truth: adding a hairstyle to src/data/character.ts needs no code here.
  cycleHair(delta: number): void {
    this.state.hair = cycleId(hairStyles, this.state.hair, delta);
    eventBus.emit("STATE_CHANGED", undefined);
  }

  cycleBeard(delta: number): void {
    this.state.beard = cycleId(beardStyles, this.state.beard, delta);
    eventBus.emit("STATE_CHANGED", undefined);
  }

  cycleHairColor(delta: number): void {
    this.state.hairColor = wrapOption(this.state.hairColor, delta, hairColors.length);
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
    return renderStateToText(this.state, this.careerView, this.timeFx);
  }

  // Convenience reads shared by scenes.
  careerActions(): CareerActionInfo[] {
    return getCareerActions(this.state);
  }
}
