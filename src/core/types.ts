// Shared game types. Pure data — no DOM, no Phaser, no side effects.

export type GameMode = "start" | "career" | "battle";
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
}

export interface BattleState {
  eventName: string;
  rivalName: string;
  rivalStyle: string;
  rivalPower: number;
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
  finished: boolean;
  result: "win" | "loss" | "draw" | null;
}

export interface GameState {
  mode: GameMode;
  playerName: string;
  inputName: string;
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
  outfitLevel: number;
  studioLevel: number;
  homeLevel: number;
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
