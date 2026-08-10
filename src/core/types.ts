// Shared game types. Pure data — no DOM, no Phaser, no side effects.

export type GameMode = "start" | "career" | "battle";
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

export type BattleChoiceId = "respuesta" | "punchline" | "flow" | "humor" | "tecnica" | "escena";
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

export interface BattlePrompt {
  text: string;
  best: BattleChoiceId[];
}

export interface BattleChoice {
  id: BattleChoiceId;
  label: string;
  stat: StatKey;
  detail: string;
}

export interface RoundResult {
  round: number;
  choice: BattleChoiceId;
  player: number;
  rival: number;
  note: string;
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
  prompt: BattlePrompt;
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
  | { type: "none" };
