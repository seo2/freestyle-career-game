// Shared game types. Pure data — no DOM, no Phaser, no side effects.

// "cypher" is training with its own screen (owner decision, 2026-08-13): the
// any-day outlet that lets the stage battle keep its weekend appointment.
// "dilemma" is a decision with its own screen: the loop stops, because a choice
// that shapes who you become should not be a line in a log.
export type GameMode = "start" | "career" | "battle" | "cypher" | "dilemma" | "epilogue";
// Career difficulty picked once on the Crear MC screen. Mechanical effects live
// in src/data/config/DifficultyConfig.ts and are applied by BattleSystem.
export type Difficulty = "facil" | "normal" | "dificil";
export type CareerView = "base" | "calendar" | "map" | "training" | "social" | "work" | "shop" | "stats";
export type StageId = "pieza" | "plaza" | "regional" | "nacional" | "internacional" | "estrella" | "leyenda";
export type StatKey =
  | "flow"
  | "punchline"
  | "metrica"
  | "improvisacion"
  | "escena"
  | "carisma"
  | "disciplina";

export type Stats = Record<StatKey, number>;

// The 10 battle resources of the Bible (gauntlet 9). Their data — labels,
// feeding stats, base hype — lives in src/data/battle.ts.
export type BattleResourceId =
  | "punchline"
  | "flow"
  | "humor"
  | "ataque"
  | "defensa"
  | "metrica"
  | "dobletempo"
  | "respuesta"
  | "storytelling"
  | "improvisacion";
export type UpgradeKey = "outfit" | "studio" | "home";

export interface StageDef {
  id: StageId;
  title: string;
  place: string;
  nextHint: string;
  minLevel: number;
  minFans: number;
  minRespect: number;
  minFame: number;
}

// One turn thrown into the circle. There is no rival: the score is this MC's own
// stats plus a roll, so the verdict answers "did it come out?".
export interface CypherTurn {
  turn: number;
  choice: BattleResourceId;
  score: number;
  verdict: string;
  kind: "great" | "good" | "weak";
  // Throwing the same resource twice in one circle teaches less.
  repeated: boolean;
  // The stat points this turn actually paid, for the screen and the summary.
  learned: { stat: StatKey; amount: number; label: string }[];
}

// A cypher in progress. Never persisted: saves always write cypher: null, the
// same contract the battle has.
export interface CypherState {
  turn: number;
  maxTurns: number;
  // The resources on offer this turn (a circle always offers a choice).
  options: BattleResourceId[];
  turns: CypherTurn[];
  // The turn whose verdict is on screen; null while choosing.
  pending: CypherTurn | null;
  finished: boolean;
}

// The identity axes of the GDD ("mismo origen, destinos distintos"). Every axis
// runs -100..+100 and starts at 0: nobody is born commercial or underground, you
// become it by deciding. They gate which dilemmas and offers appear, and the
// endings of the Bible are attractors over them — never a menu.
export type IdentityAxis = "undergroundComercial" | "batalleroMusico" | "soloCrew" | "autenticoPolemico";

export type IdentityAxes = Record<IdentityAxis, number>;

// What one option of a dilemma does. Nothing here is "the right answer": each
// side pays and costs something.
export interface DilemmaOption {
  id: string;
  label: string;
  detail: string;
  // How this choice moves who you are becoming.
  axes: Partial<Record<IdentityAxis, number>>;
  cash?: number;
  fans?: number;
  respect?: number;
  fame?: number;
  health?: number;
  energy?: number;
  momentum?: number;
  xp?: number;
  // The line the log and the event feed show afterwards.
  outcome: string;
}

export interface DilemmaDef {
  id: string;
  title: string;
  // The situation, in the MC's world.
  text: string;
  options: DilemmaOption[];
  // Earliest stage it can appear at.
  minStage: StageId;
  // Axis gates: the dilemma only shows up when the axis is at least / at most
  // these values, which is how identity starts steering what happens to you.
  requires?: Partial<Record<IdentityAxis, { min?: number; max?: number }>>;
  // Some dilemmas should only ever land once in a career.
  once?: boolean;
}

// A decision that was actually made. This is the career's memory: the GDD calls
// it barely-costly now and impossible to retro-fit later.
export interface DecisionRecord {
  dilemmaId: string;
  optionId: string;
  week: number;
  day: number;
  title: string;
  choice: string;
  outcome: string;
  axes: Partial<Record<IdentityAxis, number>>;
}

// An offer scheduled for a weekday (Fase 6). It is the same shape whether it is
// still live, taken or missed, so the week's history keeps what you turned down.
export interface ScheduledOpportunity {
  id: string;
  day: number;
  taken: boolean;
  missed: boolean;
}

// Weekly planning (Fase 6, gauntlet 3 v2). The Bible's main loop is "enter the
// room -> plan the week -> execute -> consequences -> weekly summary", so the
// plan is the player's stated intent for each day and lives in the save.
//
// One entry per weekday: the action id planned for it, or null for a day left
// open. Index 0 is Monday.
export type WeekPlan = (string | null)[];

// What actually happened on a day, recorded as the week is played so the weekly
// summary and the calendar's history are the truth and not a reconstruction.
export interface PlannedDayRecord {
  day: number;
  // What was planned (null = the day was left open).
  planned: string | null;
  // What ran: the planned action, "rest" when the plan broke for lack of
  // energy, or null when the day drifted by with no plan at all.
  ran: string | null;
  note: string;
  // Set only on a battle day, so the weekly summary can count wins and losses
  // from data instead of matching the wording of an event string.
  outcome?: "win" | "loss" | "draw";
}

// The Bible's weekly summary: one per finished week, kept bounded by
// PlanConfig.history so a long career does not bloat the save.
export interface WeekSummary {
  week: number;
  days: PlannedDayRecord[];
  // Resource deltas across the week, for the summary panel.
  cash: number;
  fans: number;
  respect: number;
  fame: number;
  xp: number;
  battlesWon: number;
  battlesLost: number;
}

// The 7 rival archetypes of the Bible.
export type RivalArchetype =
  | "agresivo"
  | "tecnico"
  | "humoristico"
  | "callejero"
  | "viral"
  | "veteranisimo"
  | "campeon";

// The Bible's rival personality: four weights that decide which resource the
// rival reaches for. Read by BattleSystem.chooseRivalMove, never by a scene.
export interface RivalPersonality {
  agresividad: number;
  humor: number;
  metrica: number;
  frecuenciaDeRiesgo: number;
}

// A rival as the Bible describes them: name, their own flow/punchline, an
// archetype and a personality. Roster in src/data/rivals.ts.
export interface RivalProfile {
  stage: StageId;
  eventName: string;
  name: string;
  style: string;
  archetype: RivalArchetype;
  flow: number;
  punchline: number;
  personality: RivalPersonality;
}

// Per-round stimulus (the Bible's "Estimulo"): the big keyword of the round.
// `best` lists the resources the crowd rewards on it — the hand is dealt
// independently, so reading the stimulus means recognizing when the hand fits.
export interface BattleStimulus {
  id: string;
  label: string;
  text: string;
  best: BattleResourceId[];
}

// One playable battle resource (a card of the hand). `stats` feed its roll
// (averaged), `baseHype` is the card's win hype before tension bonuses.
export interface BattleResource {
  id: BattleResourceId;
  label: string;
  detail: string;
  stats: StatKey[];
  baseHype: number;
}

export interface RoundResult {
  round: number;
  // null = "Pasada": the decision timer expired and the round was skipped.
  choice: BattleResourceId | null;
  // The resource the rival performed this round (gauntlet 9: seeded uniform
  // pick; gauntlet 10 replaces the picker with rival personalities).
  rivalChoice: BattleResourceId;
  player: number;
  rival: number;
  note: string;
  // Tension rules that fired this round (response bonus, repetition penalty,
  // timer expiry), as the visible notes of the verdict panel.
  tensionNotes: string[];
  // Round-result panel data (mockup 06_25_07): how much hype each answer
  // earned this round and its one-word grade. Verdict vocabulary and the
  // thresholds that pick a word live in BattleConfig.verdict.
  playerHypeDelta: number;
  playerVerdict: string;
  rivalHypeDelta: number;
  rivalVerdict: string;
}

export interface BattleState {
  eventName: string;
  rivalName: string;
  rivalStyle: string;
  rivalPower: number;
  // Who this rival is, not just how strong: the archetype drives which
  // resource they reach for, and flow/punchline feed the roll of the resource
  // they perform (gauntlet 10).
  rivalArchetype: RivalArchetype;
  rivalFlow: number;
  rivalPunchline: number;
  rivalPersonality: RivalPersonality;
  // What this event's crowd rewards and what leaves it cold: it scales the
  // hype a won round awards, and the screen states it so the player can play
  // to the room instead of guessing.
  crowdLoves: BattleResourceId[];
  crowdColds: BattleResourceId[];
  crowdLine: string;
  // Real rival meters (mockup HUD right side). Initialized by
  // BattleSystem.startBattle from BattleConfig.rival and updated every round
  // from actual outcomes — the scene only reads them.
  rivalEnergy: number;
  rivalEnergyMax: number;
  rivalHype: number;
  rewardCash: number;
  rewardFans: number;
  rewardRespect: number;
  rewardFame: number;
  rewardXp: number;
  round: number;
  maxRounds: number;
  hype: number;
  playerScore: number;
  rivalScore: number;
  prompt: BattleStimulus;
  // Hand of 5 dealt each round by BattleSystem (mockup shows exactly 5 cards).
  // The scene renders whatever the state holds — no hand logic in scenes.
  hand: BattleResourceId[];
  // Decision timer in seconds (float internally; test hooks expose only whole
  // seconds). Ticks in GameController.update while choosing, pauses on the
  // verdict beat. Never persisted: saves always write battle: null.
  timeLeft: number;
  results: RoundResult[];
  // Round-result beat: set when a round has resolved and its verdict panel is
  // on screen; advanceBattleRound clears it (next round or final verdict).
  pendingResult: RoundResult | null;
  finished: boolean;
  result: "win" | "loss" | "draw" | null;
}

export interface GameState {
  mode: GameMode;
  playerName: string;
  inputName: string;
  // --- Identity (Crear MC). Cosmetic except `difficulty`, which is mechanical.
  // look/skin/voice are 1-based option indexes; their counts live in
  // NewGameConfig.identityOptions. Sprite variants per look/skin are a pending
  // asset (see docs/ASSETS.md) — the state carries the choice regardless.
  nickname: string;
  look: number;
  skin: number;
  voice: number;
  difficulty: Difficulty;
  week: number;
  day: number;
  block: number;
  // This week's intent, one slot per weekday (Fase 6). Planning costs no time:
  // what costs is executing, and what hurts is arriving at a day you cannot
  // afford.
  plan: WeekPlan;
  // What has happened so far this week; rolls into weekLog when the week turns.
  weekRecord: PlannedDayRecord[];
  // Finished weeks, newest last, bounded by PlanConfig.history.maxWeeks.
  weekLog: WeekSummary[];
  // This week's scheduled offers: what knocked, on which day, and whether you
  // took it. Rolled fresh every week (Fase 6).
  opportunities: ScheduledOpportunity[];
  // The week `opportunities` was rolled for. The roll needs RNG, which lives in
  // the controller, so this marker is what makes "roll once per week"
  // state-driven and therefore deterministic.
  opportunitiesWeek: number;
  // Resource snapshot taken when the week began, so the summary can report
  // deltas without every system having to report them.
  weekOpening: { cash: number; fans: number; respect: number; fame: number; xp: number };
  level: number;
  xp: number;
  xpNext: number;
  energy: number;
  health: number;
  cash: number;
  fans: number;
  respect: number;
  fame: number;
  songs: number;
  discProgress: number;
  // Internal upgrade backbone (maxEnergy, recordCost, battle presence and the
  // action formulas read these). The store sells items; items raise the levels.
  outfitLevel: number;
  studioLevel: number;
  homeLevel: number;
  // Owned store item ids (src/data/items.ts). Ids only — never item objects.
  items: string[];
  momentum: number;
  lastActionId: string | null;
  actionStreak: number;
  stage: StageId;
  stats: Stats;
  lastEvent: string;
  seed: number;
  animationTime: number;
  battle: BattleState | null;
  // A cypher in progress (training with its own screen). Never persisted.
  cypher: CypherState | null;
  // Who this MC is becoming (Fase 7). Starts at 0 on every axis: the divergence
  // is played, never configured.
  axes: IdentityAxes;
  // Every key decision, in order. The career's memory.
  decisions: DecisionRecord[];
  // The dilemma waiting for an answer, if any (id only: the definition is data).
  pendingDilemma: string | null;
  // Dilemma ids already seen, so a once-only dilemma never repeats.
  seenDilemmas: string[];
  // The stage whose chapter is waiting to be read (Fase 7). Persisted: a
  // milestone should survive a reload instead of vanishing.
  pendingEpilogue: StageId | null;
  // The week the current stage began, so a chapter can measure itself.
  stageStartedWeek: number;
  // The week the CLOSING chapter began. Kept apart from stageStartedWeek, which
  // already points at the new stage: reading one for the other made the epilogue
  // report zero weeks and zero decisions.
  epilogueFromWeek: number;
}

export interface UpgradeDef {
  key: UpgradeKey;
  label: string;
  shortLabel: string;
  color: string;
  baseCost: number;
  costStep: number;
  maxLevel: number;
  effect: string;
}

export interface CareerGoal {
  label: string;
  detail: string;
  value: number;
  max: number;
  color: string;
}

export interface SocialPostOption {
  id: string;
  label: string;
  detail: string;
  fans: number;
  fame: number;
  energy: number;
  blocks: number;
  rhythm: number;
}

export interface JobOption {
  id: string;
  label: string;
  detail: string;
  cash: number;
  energy: number;
  blocks: number;
  disciplineChance: number;
}

// Result of advancing the clock. The presentation layer turns this into the
// animated agenda strip (adding elapsed/duration itself).
export interface TimeAdvance {
  label: string;
  fromBlock: number;
  toBlock: number;
  blocks: number;
  daysPassed: number;
}

// Career action descriptor exposed to the presentation layer. Execution goes
// through ActionsSystem.executeAction — descriptors carry no behavior.
export interface CareerActionInfo {
  id: string;
  label: string;
  detail: string;
  cost: string;
  rhythm: string;
  durationBlocks: number;
  disabledReason?: string;
}

// What a system hands back to the orchestrator after a player command.
// "event" carries the message parts to finalize (stage unlock + lastEvent +
// save happen in one place) plus the clock movement to animate, if any.
export type ActionResult =
  | { type: "event"; parts: string[]; fx: TimeAdvance | null }
  | { type: "battle-started" }
  | { type: "cypher-started" }
  | { type: "none" };
