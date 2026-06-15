import "./styles.css";

const canvasEl = document.querySelector<HTMLCanvasElement>("#game-canvas");
if (!canvasEl) {
  throw new Error("Missing #game-canvas");
}
const canvas: HTMLCanvasElement = canvasEl;

const canvasContext = canvas.getContext("2d");
if (!canvasContext) {
  throw new Error("Canvas 2D context is not available");
}
const ctx: CanvasRenderingContext2D = canvasContext;

const W = 960;
const H = 540;
const SAVE_KEY = "freestyle-career-save-v1";

type GameMode = "start" | "career" | "battle";
type StageId = "pieza" | "plaza" | "regional" | "nacional" | "internacional" | "estrella";
type StatKey =
  | "flow"
  | "punchline"
  | "metrica"
  | "improvisacion"
  | "escena"
  | "carisma"
  | "disciplina";
type Vec2 = [number, number];

type Stats = Record<StatKey, number>;

type BattleChoiceId = "respuesta" | "punchline" | "flow" | "humor" | "tecnica" | "escena";
type UpgradeKey = "outfit" | "studio" | "home";

interface StageDef {
  id: StageId;
  title: string;
  place: string;
  nextHint: string;
  minLevel: number;
  minFans: number;
  minRespect: number;
  minFame: number;
}

interface BattlePrompt {
  text: string;
  best: BattleChoiceId[];
}

interface BattleChoice {
  id: BattleChoiceId;
  label: string;
  stat: StatKey;
  detail: string;
}

interface RoundResult {
  round: number;
  choice: BattleChoiceId;
  player: number;
  rival: number;
  note: string;
}

interface BattleState {
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

interface GameState {
  mode: GameMode;
  playerName: string;
  inputName: string;
  week: number;
  day: number;
  hour: number;
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

interface UpgradeDef {
  key: UpgradeKey;
  label: string;
  shortLabel: string;
  color: string;
  baseCost: number;
  costStep: number;
  maxLevel: number;
  effect: string;
}

interface CareerGoal {
  label: string;
  detail: string;
  value: number;
  max: number;
  color: string;
}

interface ButtonZone {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  disabled: boolean;
  onClick: () => void;
}

interface CareerAction {
  id: string;
  label: string;
  detail: string;
  cost: string;
  rhythm: string;
  durationHours: number;
  disabledReason?: string;
  run: () => void;
}

interface TimeAdvanceFx {
  label: string;
  fromHour: number;
  toHour: number;
  hours: number;
  daysPassed: number;
  elapsed: number;
  duration: number;
}

const stages: StageDef[] = [
  {
    id: "pieza",
    title: "Pieza",
    place: "Pieza / cypher con amigos",
    nextHint: "Gana nivel 2 y 8 de respeto para salir a la plaza.",
    minLevel: 1,
    minFans: 0,
    minRespect: 0,
    minFame: 0,
  },
  {
    id: "plaza",
    title: "Plaza",
    place: "Competencias de plaza",
    nextHint: "Nivel 4, 80 fans y 45 respeto abren el regional.",
    minLevel: 2,
    minFans: 0,
    minRespect: 8,
    minFame: 0,
  },
  {
    id: "regional",
    title: "Regional",
    place: "Escenarios regionales",
    nextHint: "Nivel 7, 350 fans y 90 fama abren el nacional.",
    minLevel: 4,
    minFans: 80,
    minRespect: 45,
    minFame: 0,
  },
  {
    id: "nacional",
    title: "Nacional",
    place: "Liga nacional",
    nextHint: "Nivel 10, 1200 fans y 350 fama abren internacional.",
    minLevel: 7,
    minFans: 350,
    minRespect: 90,
    minFame: 90,
  },
  {
    id: "internacional",
    title: "Internacional",
    place: "Circuito mundial",
    nextHint: "Nivel 14, 5000 fans y 1500 fama abren estrellato.",
    minLevel: 10,
    minFans: 1200,
    minRespect: 180,
    minFame: 350,
  },
  {
    id: "estrella",
    title: "Estrella",
    place: "Festivales y giras",
    nextHint: "Construye legado, crew y sello propio.",
    minLevel: 14,
    minFans: 5000,
    minRespect: 350,
    minFame: 1500,
  },
];

const statLabels: Record<StatKey, string> = {
  flow: "Flow",
  punchline: "Punch",
  metrica: "Metrica",
  improvisacion: "Impro",
  escena: "Escena",
  carisma: "Carisma",
  disciplina: "Disciplina",
};

const battleChoices: BattleChoice[] = [
  {
    id: "respuesta",
    label: "Responder",
    stat: "improvisacion",
    detail: "Castiga el ataque del rival.",
  },
  {
    id: "punchline",
    label: "Punchline",
    stat: "punchline",
    detail: "Busca el remate mas fuerte.",
  },
  {
    id: "flow",
    label: "Flow",
    stat: "flow",
    detail: "Gana al publico con ritmo.",
  },
  {
    id: "humor",
    label: "Humor",
    stat: "carisma",
    detail: "Desarma la tension con gracia.",
  },
  {
    id: "tecnica",
    label: "Tecnica",
    stat: "metrica",
    detail: "Juega con estructuras y multis.",
  },
  {
    id: "escena",
    label: "Escena",
    stat: "escena",
    detail: "Domina el escenario y el hype.",
  },
];

const battlePrompts: BattlePrompt[] = [
  {
    text: "El rival se burla de que eres nuevo en el circuito.",
    best: ["respuesta", "humor"],
  },
  {
    text: "El beat cambia y el publico espera doble tempo.",
    best: ["flow", "tecnica"],
  },
  {
    text: "Te tiran una palabra dificil como estimulo.",
    best: ["tecnica", "punchline"],
  },
  {
    text: "El host prende a la gente y la tarima se calienta.",
    best: ["escena", "flow"],
  },
  {
    text: "El rival ataca tu barrio y tus primeras canciones.",
    best: ["respuesta", "punchline"],
  },
  {
    text: "La ronda va pareja y queda una barra para cerrar.",
    best: ["punchline", "escena"],
  },
];

const palette = {
  ink: "#f3f2e9",
  muted: "#a8a59c",
  black: "#101114",
  panel: "#1c1e23",
  line: "#363941",
  yellow: "#e1b84a",
  red: "#f04d3a",
  teal: "#2fa58d",
  blue: "#6e7fe8",
  green: "#77c46b",
  pink: "#d65a8a",
  floor: "#2c2f36",
  room: "#20242d",
};

const upgrades: UpgradeDef[] = [
  {
    key: "outfit",
    label: "Outfit",
    shortLabel: "Ropa",
    color: palette.yellow,
    baseCost: 55,
    costStep: 85,
    maxLevel: 3,
    effect: "+fans/batalla",
  },
  {
    key: "studio",
    label: "Estudio",
    shortLabel: "Studio",
    color: palette.pink,
    baseCost: 75,
    costStep: 115,
    maxLevel: 3,
    effect: "+temas/grabar",
  },
  {
    key: "home",
    label: "Base",
    shortLabel: "Casa",
    color: palette.teal,
    baseCost: 110,
    costStep: 150,
    maxLevel: 3,
    effect: "+energia/salud",
  },
];

const sceneAssetPaths: Partial<Record<StageId, string>> = {
  pieza: "/assets/scenes/pieza-home-studio-v1.png",
  plaza: "/assets/scenes/plaza-cypher-v1.png",
  regional: "/assets/scenes/regional-stage-v1.png",
  nacional: "/assets/scenes/regional-stage-v1.png",
  internacional: "/assets/scenes/regional-stage-v1.png",
  estrella: "/assets/scenes/regional-stage-v1.png",
};
const sceneImages: Partial<Record<StageId, HTMLImageElement>> = {};
const sceneReady: Partial<Record<StageId, boolean>> = {};

let zones: ButtonZone[] = [];
let pointer = { x: 0, y: 0, down: false };
let savedSnapshot = loadSavedState();
let creatingNew = !savedSnapshot;
let state: GameState = savedSnapshot ? normalizeLoadedState(savedSnapshot) : createNewState();
let lastFrame = performance.now();
let actionFocus = 0;
let battleFocus = 0;
let timeFx: TimeAdvanceFx | null = null;

ctx.imageSmoothingEnabled = false;
canvas.tabIndex = 0;
canvas.focus();

for (const [stageId, src] of Object.entries(sceneAssetPaths) as [StageId, string][]) {
  const image = new Image();
  image.onload = () => {
    sceneReady[stageId] = true;
    render();
  };
  image.onerror = () => {
    sceneReady[stageId] = false;
  };
  image.src = src;
  sceneImages[stageId] = image;
}

function createNewState(name = "MC Barrio"): GameState {
  return {
    mode: "start",
    playerName: name,
    inputName: name,
    week: 1,
    day: 1,
    hour: 10,
    level: 1,
    xp: 0,
    xpNext: 70,
    energy: 86,
    health: 88,
    cash: 25,
    fans: 0,
    respect: 0,
    fame: 0,
    songs: 0,
    discProgress: 0,
    outfitLevel: 0,
    studioLevel: 0,
    homeLevel: 0,
    momentum: 42,
    lastActionId: null,
    actionStreak: 0,
    stage: "pieza",
    stats: {
      flow: 2,
      punchline: 2,
      metrica: 1,
      improvisacion: 2,
      escena: 1,
      carisma: 1,
      disciplina: 1,
    },
    lastEvent: "Escribe tu nombre artistico y empieza desde la pieza.",
    seed: Date.now() >>> 0,
    animationTime: 0,
    battle: null,
  };
}

function normalizeLoadedState(saved: GameState): GameState {
  return {
    ...createNewState(saved.playerName || "MC Barrio"),
    ...saved,
    mode: "start",
    inputName: saved.playerName || "MC Barrio",
    animationTime: 0,
    battle: null,
    outfitLevel: clamp(saved.outfitLevel ?? 0, 0, 3),
    studioLevel: clamp(saved.studioLevel ?? 0, 0, 3),
    homeLevel: clamp(saved.homeLevel ?? 0, 0, 3),
    momentum: clamp(saved.momentum ?? 42, 0, 100),
    lastActionId: saved.lastActionId ?? null,
    actionStreak: saved.actionStreak ?? 0,
    lastEvent: `Partida encontrada: ${saved.playerName}, nivel ${saved.level}.`,
  };
}

function loadSavedState(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GameState;
  } catch {
    return null;
  }
}

function saveState(): void {
  const toSave: GameState = {
    ...state,
    mode: "career",
    inputName: state.playerName,
    battle: null,
    animationTime: 0,
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(toSave));
  savedSnapshot = toSave;
}

function deleteSave(): void {
  localStorage.removeItem(SAVE_KEY);
  savedSnapshot = null;
  creatingNew = true;
  state = createNewState();
  timeFx = null;
}

function random(): number {
  state.seed = (state.seed * 1664525 + 1013904223) >>> 0;
  return state.seed / 4294967296;
}

function randomInt(min: number, max: number): number {
  return Math.floor(random() * (max - min + 1)) + min;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function currentStage(): StageDef {
  return stages.find((stage) => stage.id === state.stage) ?? stages[0];
}

function stageIndex(id = state.stage): number {
  return Math.max(0, stages.findIndex((stage) => stage.id === id));
}

function maxEnergy(): number {
  return 90 + state.level * 2 + state.stats.disciplina + state.homeLevel * 8;
}

function upgradeLevel(key: UpgradeKey): number {
  if (key === "outfit") return state.outfitLevel;
  if (key === "studio") return state.studioLevel;
  return state.homeLevel;
}

function setUpgradeLevel(key: UpgradeKey, value: number): void {
  if (key === "outfit") state.outfitLevel = value;
  else if (key === "studio") state.studioLevel = value;
  else state.homeLevel = value;
}

function upgradeCost(def: UpgradeDef, level = upgradeLevel(def.key)): number {
  return def.baseCost + def.costStep * level + level * level * 25;
}

function nextUpgrade(): UpgradeDef | null {
  const available = upgrades.filter((upgrade) => upgradeLevel(upgrade.key) < upgrade.maxLevel);
  if (available.length === 0) return null;
  return [...available].sort((a, b) => {
    const levelDelta = upgradeLevel(a.key) - upgradeLevel(b.key);
    if (levelDelta !== 0) return levelDelta;
    return upgradeCost(a) - upgradeCost(b);
  })[0];
}

function buyRecommendedUpgrade(): void {
  const upgrade = nextUpgrade();
  if (!upgrade) {
    setEvent(["Ya tienes el setup al maximo por ahora."]);
    return;
  }
  const level = upgradeLevel(upgrade.key);
  const cost = upgradeCost(upgrade, level);
  if (state.cash < cost) return;

  state.cash -= cost;
  setUpgradeLevel(upgrade.key, level + 1);
  const levelMessages = addXp(14 + level * 4);
  const rhythmMessages = applyRhythm(`upgrade-${upgrade.key}`, 6 + level * 2);
  const timeMessages = advanceClock(1, upgrade.shortLabel);
  setEvent([
    `Invertiste $${cost} en ${upgrade.label} Nv ${level + 1}: ${upgrade.effect}.`,
    ...rhythmMessages,
    ...levelMessages,
    ...timeMessages,
  ]);
}

function recordCost(): number {
  return Math.max(20, 35 - state.studioLevel * 5);
}

function stageGoalProgress(stage: StageDef): number {
  const ratios = [
    stage.minLevel <= 1 ? 1 : clamp(state.level / stage.minLevel, 0, 1),
    stage.minFans <= 0 ? 1 : clamp(state.fans / stage.minFans, 0, 1),
    stage.minRespect <= 0 ? 1 : clamp(state.respect / stage.minRespect, 0, 1),
    stage.minFame <= 0 ? 1 : clamp(state.fame / stage.minFame, 0, 1),
  ];
  return ratios.reduce((sum, value) => sum + value, 0) / ratios.length;
}

function getCareerGoals(): CareerGoal[] {
  const next = stages[stageIndex() + 1];
  const goals: CareerGoal[] = [];

  if (next) {
    goals.push({
      label: `Abrir ${next.title}`,
      detail: `Nv ${state.level}/${next.minLevel} · Resp ${state.respect}/${next.minRespect}`,
      value: Math.round(stageGoalProgress(next) * 100),
      max: 100,
      color: palette.teal,
    });
  } else {
    goals.push({
      label: "Legado",
      detail: `Fama ${state.fame} · Fans ${state.fans}`,
      value: clamp(state.fame, 0, 2500),
      max: 2500,
      color: palette.pink,
    });
  }

  if (state.discProgress < 80) {
    goals.push({
      label: "Primer tema",
      detail: `${state.discProgress}% escrito`,
      value: state.discProgress,
      max: 80,
      color: palette.yellow,
    });
  } else if (state.cash < recordCost()) {
    goals.push({
      label: "Pagar estudio",
      detail: `$${state.cash}/$${recordCost()}`,
      value: state.cash,
      max: recordCost(),
      color: palette.pink,
    });
  } else {
    goals.push({
      label: "Grabar tema",
      detail: "Listo para entrar al estudio",
      value: 1,
      max: 1,
      color: palette.green,
    });
  }

  return goals;
}

function startCareerFromMenu(): void {
  const cleanName = state.inputName.trim().slice(0, 16) || "MC Barrio";
  state = createNewState(cleanName);
  state.playerName = cleanName;
  state.inputName = cleanName;
  state.mode = "career";
  state.lastEvent = `${cleanName} parte rapeando en su pieza.`;
  creatingNew = false;
  actionFocus = 0;
  timeFx = null;
  saveState();
}

function continueCareer(): void {
  const saved = loadSavedState();
  if (!saved) return;
  state = {
    ...normalizeLoadedState(saved),
    mode: "career",
    lastEvent: "Retomaste la carrera desde tu ultimo guardado.",
  };
  creatingNew = false;
  actionFocus = 0;
  timeFx = null;
}

function newCareerDraft(): void {
  creatingNew = true;
  state = createNewState("");
  state.inputName = "";
  state.lastEvent = "Nueva carrera: elige nombre artistico.";
  timeFx = null;
}

function addStat(stat: StatKey, amount = 1): void {
  state.stats[stat] = clamp(state.stats[stat] + amount, 1, 99);
}

function addXp(amount: number): string[] {
  const messages: string[] = [];
  state.xp += amount;
  while (state.xp >= state.xpNext) {
    state.xp -= state.xpNext;
    state.level += 1;
    state.xpNext = Math.round(state.xpNext * 1.22 + 18);
    state.energy = clamp(state.energy + 18, 0, maxEnergy());
    state.health = clamp(state.health + 7, 0, 100);
    const statToRaise = pickLevelStat();
    addStat(statToRaise, 1);
    messages.push(`Subiste a nivel ${state.level}: +1 ${statLabels[statToRaise]}.`);
  }
  return messages;
}

function pickLevelStat(): StatKey {
  const ordered: StatKey[] = [
    "flow",
    "punchline",
    "improvisacion",
    "metrica",
    "escena",
    "carisma",
    "disciplina",
  ];
  return ordered[(state.level + stageIndex()) % ordered.length];
}

function spendActionTime(energyCost: number, hours: number, label: string): string[] {
  state.energy = clamp(state.energy - energyCost, -20, maxEnergy());
  if (state.energy < 0) {
    state.health = clamp(state.health + state.energy, 0, 100);
    state.energy = 0;
  }
  return advanceClock(hours, label);
}

function advanceClock(hours: number, label: string): string[] {
  const messages: string[] = [];
  const fromHour = state.hour;
  let remaining = Math.max(0, Math.round(hours));
  let daysPassed = 0;
  let weekChanged = false;

  while (remaining > 0) {
    const untilMidnight = 24 - state.hour;
    if (remaining >= untilMidnight) {
      remaining -= untilMidnight;
      state.hour = 0;
      state.day += 1;
      daysPassed += 1;
      state.energy = clamp(state.energy + 8 + state.stats.disciplina, 0, maxEnergy());
      state.health = clamp(state.health + 2, 0, 100);
      if (state.day > 7) {
        state.week += 1;
        state.day = 1;
        weekChanged = true;
        state.energy = clamp(state.energy + 18 + state.stats.disciplina * 3, 0, maxEnergy());
        state.health = clamp(state.health + 6, 0, 100);
      }
    } else {
      state.hour += remaining;
      remaining = 0;
    }
  }

  if (daysPassed > 0) {
    state.momentum = clamp(state.momentum - daysPassed * 3, 0, 100);
    messages.push(`Paso ${daysPassed === 1 ? "un dia" : `${daysPassed} dias`}.`);
  }
  if (weekChanged) messages.push(`Semana ${state.week}: recuperaste energia.`);
  timeFx = {
    label,
    fromHour,
    toHour: state.hour,
    hours,
    daysPassed,
    elapsed: 0,
    duration: 1.8,
  };
  return messages;
}

function formatHour(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

function formatDuration(hours: number): string {
  return `${hours}h`;
}

function maybeUnlockStage(): string | null {
  const next = stages[stageIndex() + 1];
  if (!next) return null;
  const unlocks =
    state.level >= next.minLevel &&
    state.fans >= next.minFans &&
    state.respect >= next.minRespect &&
    state.fame >= next.minFame;
  if (!unlocks) return null;
  state.stage = next.id;
  return `Nuevo circuito desbloqueado: ${next.title}.`;
}

function setEvent(parts: string[]): void {
  const unlock = maybeUnlockStage();
  if (unlock) parts.push(unlock);
  state.lastEvent = parts.join(" ");
  saveState();
}

function momentumMood(): string {
  if (state.momentum >= 78) return "En racha";
  if (state.momentum >= 55) return "Activo";
  if (state.momentum >= 30) return "Frio";
  return "Quemado";
}

function rhythmPreview(actionId: string, baseDelta: number): string {
  const repeatPenalty = state.lastActionId === actionId ? Math.min(12, (state.actionStreak + 1) * 4) : -4;
  const fatiguePenalty = state.energy < 24 && actionId !== "rest" ? 5 : 0;
  const latePenalty = (state.hour >= 23 || state.hour < 6) && actionId !== "rest" ? 3 : 0;
  const delta = Math.round(baseDelta - repeatPenalty - fatiguePenalty - latePenalty);
  if (delta > 0) return `Impulso +${delta}`;
  if (delta < 0) return `Impulso ${delta}`;
  return "Impulso neutro";
}

function rhythmShort(label: string): string {
  return label.replace("Impulso ", "").replace("neutro", "0");
}

function rhythmColor(label: string): string {
  if (label.includes("+")) return palette.teal;
  if (label.includes("-")) return palette.red;
  return palette.muted;
}

function applyRhythm(actionId: string, baseDelta: number): string[] {
  const repeated = state.lastActionId === actionId;
  state.actionStreak = repeated ? state.actionStreak + 1 : 1;
  state.lastActionId = actionId;

  const repeatPenalty = repeated ? Math.min(12, state.actionStreak * 4) : -4;
  const fatiguePenalty = state.energy < 24 && actionId !== "rest" ? 5 : 0;
  const latePenalty = (state.hour >= 23 || state.hour < 6) && actionId !== "rest" ? 3 : 0;
  const delta = Math.round(baseDelta - repeatPenalty - fatiguePenalty - latePenalty);
  state.momentum = clamp(state.momentum + delta, 0, 100);

  if (delta > 0) return [`Impulso +${delta}: ${momentumMood()}.`];
  if (delta < 0) return [`Impulso ${delta}: ${momentumMood()}.`];
  return [`Impulso estable: ${momentumMood()}.`];
}

function getCareerActions(): CareerAction[] {
  const actions: CareerAction[] = [];
  const tired = state.energy < 12 ? "Necesitas descansar." : undefined;
  const stage = currentStage();

  actions.push({
    id: "practice",
    label: "Practicar",
    detail: "Barras frente al espejo y beats en loop.",
    cost: "2h / -16 energia",
    rhythm: rhythmPreview("practice", 4),
    durationHours: 2,
    disabledReason: state.energy < 16 ? tired : undefined,
    run: () => {
      const gained = random() > 0.5 ? "flow" : "improvisacion";
      addStat(gained, 1);
      const levelMessages = addXp(24);
      const rhythmMessages = applyRhythm("practice", 4);
      const timeMessages = spendActionTime(16, 2, "Practicar");
      setEvent([`Practicaste 2h en la pieza: +1 ${statLabels[gained]}.`, ...rhythmMessages, ...levelMessages, ...timeMessages]);
    },
  });

  actions.push({
    id: "cypher",
    label: "Cypher",
    detail: "Juntarte con amigos a soltar rimas.",
    cost: "3h / -14 energia",
    rhythm: rhythmPreview("cypher", 8),
    durationHours: 3,
    disabledReason: state.energy < 14 ? tired : undefined,
    run: () => {
      addStat("improvisacion", random() > 0.58 ? 1 : 0);
      state.respect += 4 + randomInt(0, 3);
      state.fans += 1 + randomInt(0, 2);
      const levelMessages = addXp(20);
      const rhythmMessages = applyRhythm("cypher", 8);
      const timeMessages = spendActionTime(14, 3, "Cypher");
      setEvent([`El cypher de 3h te dio respeto local.`, ...rhythmMessages, ...levelMessages, ...timeMessages]);
    },
  });

  actions.push({
    id: "work",
    label: "Trabajar",
    detail: "Turno corto para financiar micros y estudio.",
    cost: "6h / -20 energia",
    rhythm: rhythmPreview("work", -3),
    durationHours: 6,
    disabledReason: state.energy < 20 ? tired : undefined,
    run: () => {
      const earned = 42 + state.stats.disciplina * 4 + randomInt(0, 12);
      state.cash += earned;
      addStat("disciplina", random() > 0.75 ? 1 : 0);
      const levelMessages = addXp(10);
      const rhythmMessages = applyRhythm("work", -3);
      const timeMessages = spendActionTime(20, 6, "Trabajar");
      setEvent([`Trabajaste 6h: +$${earned}.`, ...rhythmMessages, ...levelMessages, ...timeMessages]);
    },
  });

  actions.push({
    id: "social",
    label: "Subir clip",
    detail: "Publicar freestyle, responder comentarios.",
    cost: "2h / -12 energia",
    rhythm: rhythmPreview("social", 7),
    durationHours: 2,
    disabledReason: state.energy < 12 ? tired : undefined,
    run: () => {
      const viral = random() > 0.88;
      const fanGain = state.stats.carisma * 4 + state.outfitLevel * 6 + randomInt(2, 12) + (viral ? 42 : 0);
      const fameGain = Math.floor(fanGain / 8) + (viral ? 12 : 0);
      state.fans += fanGain;
      state.fame += fameGain;
      state.health = clamp(state.health - (viral ? 5 : 2), 0, 100);
      addStat("carisma", random() > 0.68 ? 1 : 0);
      const levelMessages = addXp(18 + (viral ? 18 : 0));
      const rhythmMessages = applyRhythm("social", viral ? 16 : 7);
      const timeMessages = spendActionTime(12, 2, "Redes");
      setEvent([
        viral
          ? `En 2h el clip se movio fuerte: +${fanGain} fans.`
          : `Subiste un clip en 2h: +${fanGain} fans.`,
        ...rhythmMessages,
        ...levelMessages,
        ...timeMessages,
      ]);
    },
  });

  actions.push({
    id: "write",
    label: "Escribir tema",
    detail: "Convertir barras en una cancion grabable.",
    cost: "3h / -18 energia",
    rhythm: rhythmPreview("write", 5),
    durationHours: 3,
    disabledReason: state.energy < 18 ? tired : undefined,
    run: () => {
      const progress = 18 + state.stats.metrica * 2 + state.studioLevel * 6 + randomInt(0, 8);
      state.discProgress = clamp(state.discProgress + progress, 0, 120);
      addStat(random() > 0.5 ? "metrica" : "punchline", 1);
      const levelMessages = addXp(22);
      const rhythmMessages = applyRhythm("write", 5);
      const timeMessages = spendActionTime(18, 3, "Escribir");
      setEvent([`Escribiste 3h: +${progress}% de cancion.`, ...rhythmMessages, ...levelMessages, ...timeMessages]);
    },
  });

  actions.push({
    id: "record",
    label: "Grabar",
    detail: "Pagar horas y subir una cancion terminada.",
    cost: `4h / $${recordCost()} / -16 energia`,
    rhythm: rhythmPreview("record", 14),
    durationHours: 4,
    disabledReason:
      state.discProgress < 80
        ? "Necesitas 80% de cancion."
        : state.cash < recordCost()
          ? "Falta dinero."
          : state.energy < 16
            ? tired
            : undefined,
    run: () => {
      state.cash -= recordCost();
      state.discProgress = 0;
      state.songs += 1;
      const fanGain =
        25 +
        state.stats.flow * 3 +
        state.stats.carisma * 2 +
        state.studioLevel * 12 +
        state.outfitLevel * 5 +
        randomInt(0, 18);
      state.fans += fanGain;
      state.fame += Math.floor(fanGain / 4);
      state.respect += 8;
      const levelMessages = addXp(46);
      const rhythmMessages = applyRhythm("record", 14);
      const timeMessages = spendActionTime(16, 4, "Grabar");
      setEvent([`Grabaste 4h la cancion #${state.songs}: +${fanGain} fans.`, ...rhythmMessages, ...levelMessages, ...timeMessages]);
    },
  });

  const battleCost = 22 + stageIndex() * 3;
  actions.push({
    id: "battle",
    label: battleLabel(),
    detail: `${stage.place}: ronda por decisiones rapidas.`,
    cost: `${battleDurationHours()}h / -${battleCost} energia`,
    rhythm: rhythmPreview("battle", 12),
    durationHours: battleDurationHours(),
    disabledReason: state.energy < battleCost ? tired : undefined,
    run: () => startBattle(),
  });

  if (state.songs > 0 || stageIndex() >= 2) {
    actions.push({
      id: "show",
      label: "Show chico",
      detail: "Tocar en vivo, vender merch y probar canciones.",
      cost: "5h / -26 energia",
      rhythm: rhythmPreview("show", 12),
      durationHours: 5,
      disabledReason: state.energy < 26 ? tired : undefined,
      run: () => {
        const earned = 28 + state.songs * 18 + state.stats.escena * 5 + state.outfitLevel * 10 + randomInt(0, 20);
        const fans = 18 + state.stats.escena * 5 + state.outfitLevel * 8 + state.studioLevel * 4 + randomInt(0, 18);
        state.cash += earned;
        state.fans += fans;
        state.fame += Math.floor(fans / 3);
        addStat("escena", 1);
        const levelMessages = addXp(38);
        const rhythmMessages = applyRhythm("show", 12);
        const timeMessages = spendActionTime(26, 5, "Show");
        setEvent([`Hiciste show de 5h: +$${earned}, +${fans} fans.`, ...rhythmMessages, ...levelMessages, ...timeMessages]);
      },
    });
  }

  actions.push({
    id: "rest",
    label: "Descansar",
    detail: "Recuperar aire y evitar quemarte.",
    cost: "8h / +energia / +salud",
    rhythm: rhythmPreview("rest", state.energy < 35 ? 10 : -2),
    durationHours: 8,
    run: () => {
      const rhythmBase = state.energy < 35 ? 10 : -2;
      state.energy = clamp(state.energy + 36 + state.stats.disciplina * 2 + state.homeLevel * 10, 0, maxEnergy());
      state.health = clamp(state.health + 18 + state.homeLevel * 4, 0, 100);
      const rhythmMessages = applyRhythm("rest", rhythmBase);
      const timeMessages = advanceClock(8, "Descansar");
      setEvent(["Descansaste 8h y ordenaste la cabeza.", ...rhythmMessages, ...timeMessages]);
    },
  });

  return actions;
}

function battleLabel(): string {
  switch (state.stage) {
    case "pieza":
      return "Batalla casera";
    case "plaza":
      return "Batalla plaza";
    case "regional":
      return "Regional";
    case "nacional":
      return "Nacional";
    case "internacional":
      return "Internacional";
    case "estrella":
      return "Festival";
  }
}

function battleDurationHours(): number {
  return 4 + Math.min(stageIndex(), 3);
}

function startBattle(): void {
  const cost = 22 + stageIndex() * 3;
  if (state.energy < cost) return;
  state.energy = clamp(state.energy - cost, 0, maxEnergy());
  const tier = getBattleTier();
  state.mode = "battle";
  state.battle = {
    ...tier,
    round: 1,
    maxRounds: 3,
    hype: 50,
    playerScore: 0,
    rivalScore: 0,
    prompt: pickPrompt(),
    results: [],
    finished: false,
    result: null,
  };
  battleFocus = 0;
}

function getBattleTier(): Omit<
  BattleState,
  "round" | "maxRounds" | "hype" | "playerScore" | "rivalScore" | "prompt" | "results" | "finished" | "result"
> {
  const idx = stageIndex();
  const rivals = [
    ["Cypher de pieza", "Nico Cuaderno", "nervioso pero creativo"],
    ["Plaza del barrio", "La Sombra", "agresivo de plaza"],
    ["Regional Sur", "Killa Metro", "tecnico y frio"],
    ["Final Nacional", "Rima Royal", "completo y mediatico"],
    ["Mundial Underground", "Nova X", "veloz e impredecible"],
    ["Festival Leyenda", "Icono", "leyenda con publico propio"],
  ];
  const picked = rivals[idx] ?? rivals[0];
  return {
    eventName: picked[0],
    rivalName: picked[1],
    rivalStyle: picked[2],
    rivalPower: 3 + idx * 2 + Math.floor(state.level / 3),
    rewardCash: 35 + idx * 85,
    rewardFans: 18 + idx * 95,
    rewardRespect: 10 + idx * 18,
    rewardFame: 3 + idx * 25,
    rewardXp: 48 + idx * 28,
  };
}

function pickPrompt(): BattlePrompt {
  return battlePrompts[randomInt(0, battlePrompts.length - 1)];
}

function resolveBattle(choice: BattleChoice): void {
  const battle = state.battle;
  if (!battle || battle.finished) return;
  const statValue = state.stats[choice.stat];
  const promptBonus = battle.prompt.best.includes(choice.id) ? 12 : 0;
  const energyBonus = state.energy > 45 ? 4 : state.energy < 15 ? -8 : 0;
  const healthBonus = state.health > 70 ? 3 : state.health < 30 ? -8 : 0;
  const momentumBonus = Math.floor((state.momentum - 50) / 8);
  const presenceBonus = state.outfitLevel * 2 + (state.stage === "pieza" ? 0 : state.outfitLevel);
  const playerRoll =
    statValue * 8 +
    state.level * 3 +
    promptBonus +
    energyBonus +
    healthBonus +
    momentumBonus +
    presenceBonus +
    Math.floor(battle.hype / 8) +
    randomInt(7, 26);
  const rivalRoll = battle.rivalPower * 8 + battle.round * 2 + randomInt(12, 34);
  const wonRound = playerRoll >= rivalRoll;

  if (wonRound) {
    battle.playerScore += 1;
    battle.hype = clamp(battle.hype + 12 + promptBonus / 3, 0, 100);
  } else {
    battle.rivalScore += 1;
    battle.hype = clamp(battle.hype - 7, 0, 100);
  }

  battle.results.push({
    round: battle.round,
    choice: choice.id,
    player: playerRoll,
    rival: rivalRoll,
    note: wonRound ? "El publico reacciona a tu ronda." : "El rival conecto mas fuerte.",
  });

  if (battle.round >= battle.maxRounds) {
    battle.finished = true;
    battle.result =
      battle.playerScore > battle.rivalScore
        ? "win"
        : battle.playerScore < battle.rivalScore
          ? "loss"
          : "draw";
  } else {
    battle.round += 1;
    battle.prompt = pickPrompt();
  }
}

function finishBattle(): void {
  const battle = state.battle;
  if (!battle || !battle.finished) return;
  const won = battle.result === "win";
  const draw = battle.result === "draw";
  const cash = won ? battle.rewardCash : draw ? Math.floor(battle.rewardCash * 0.35) : 0;
  const fans = won
    ? battle.rewardFans
    : draw
      ? Math.floor(battle.rewardFans * 0.45)
      : Math.floor(battle.rewardFans * 0.22);
  const respect = won
    ? battle.rewardRespect
    : draw
      ? Math.floor(battle.rewardRespect * 0.5)
      : Math.floor(battle.rewardRespect * 0.25);
  const fame = won
    ? battle.rewardFame
    : draw
      ? Math.floor(battle.rewardFame * 0.45)
      : Math.floor(battle.rewardFame * 0.2);
  const xp = won ? battle.rewardXp : draw ? Math.floor(battle.rewardXp * 0.55) : Math.floor(battle.rewardXp * 0.32);

  state.cash += cash;
  state.fans += fans;
  state.respect += respect;
  state.fame += fame;
  const levelMessages = addXp(xp);
  const rhythmMessages = applyRhythm("battle", won ? 18 : draw ? 7 : -10);
  const timeMessages = advanceClock(battleDurationHours(), battle.eventName);

  const resultText = won ? "Ganaste" : draw ? "Empataste" : "Perdiste";
  const messages = [
    `${resultText} en ${battle.eventName} (${formatDuration(battleDurationHours())}): +$${cash}, +${fans} fans, +${respect} respeto.`,
    ...rhythmMessages,
    ...levelMessages,
    ...timeMessages,
  ];
  state.battle = null;
  state.mode = "career";
  setEvent(messages);
}

function update(dt: number): void {
  state.animationTime += dt;
  if (timeFx) {
    timeFx.elapsed += dt;
    if (timeFx.elapsed >= timeFx.duration) {
      timeFx = null;
    }
  }
}

function render(): void {
  zones = [];
  ctx.clearRect(0, 0, W, H);
  if (state.mode === "start") {
    drawStartScreen();
  } else if (state.mode === "battle") {
    drawBattleScreen();
  } else {
    drawCareerScreen();
  }
}

function drawStartScreen(): void {
  drawBackdrop("pieza");
  if (!hasSceneBackdrop("pieza")) drawRoomProps();
  drawMc(465, 300, 2.2, state.animationTime);
  drawVinylLogo(108, 112);

  drawText("FREESTYLE CAREER", 156, 96, 34, palette.ink);
  drawText("Desde la pieza al escenario mundial", 158, 132, 15, palette.yellow);

  const hasSave = Boolean(savedSnapshot);
  drawPanel(566, 84, 300, 282);
  drawText(hasSave && !creatingNew ? "Partida guardada" : "Nueva carrera", 590, 122, 20, palette.ink);

  if (hasSave && !creatingNew) {
    drawText(`${savedSnapshot?.playerName ?? "MC"} · Nivel ${savedSnapshot?.level ?? 1}`, 590, 158, 16, palette.yellow);
    drawText(`Semana ${savedSnapshot?.week ?? 1} · ${stageTitle(savedSnapshot?.stage ?? "pieza")}`, 590, 184, 14, palette.muted);
    button("continue", 590, 222, 246, 44, "Continuar", "", false, continueCareer);
    button("new", 590, 276, 246, 38, "Nueva carrera", "", false, newCareerDraft);
    button("delete", 590, 322, 246, 34, "Borrar guardado", "", false, deleteSave);
  } else {
    drawText("Nombre artistico", 590, 158, 14, palette.muted);
    drawInputBox(590, 172, 246, 44, state.inputName || "MC Barrio");
    drawText("Teclas para escribir · Enter empieza", 590, 230, 12, palette.muted);
    button("start", 590, 260, 246, 48, "Empezar", "", false, startCareerFromMenu);
    if (hasSave) {
      button("back-save", 590, 320, 246, 36, "Volver al guardado", "", false, () => {
        creatingNew = false;
        state = normalizeLoadedState(savedSnapshot as GameState);
      });
    }
  }

  drawText("F: pantalla completa", 36, 504, 13, palette.muted);
}

function drawCareerScreen(): void {
  drawBackdrop(state.stage);
  if (!hasSceneBackdrop(state.stage)) drawEnvironment(state.stage);
  drawCareerSceneFrame();
  drawMc(hasSceneBackdrop(state.stage) ? 470 : 250, 322, 2.0, state.animationTime);
  drawTopHud();
  drawCareerPanels();
  drawActions();
}

function drawBattleScreen(): void {
  const battle = state.battle;
  if (!battle) return;
  drawBackdrop(state.stage);
  drawBattleArena(state.stage);

  drawMc(260, 318, 2.25, state.animationTime);
  drawRival(675, 318, 2.25, state.animationTime);
  drawMicStand(468, 294);

  drawTopHud();
  drawBattleHeader(battle);

  drawPanel(44, 348, 872, 170);
  if (battle.finished) {
    const label = battle.result === "win" ? "Victoria" : battle.result === "draw" ? "Replica pareja" : "Derrota";
    drawText(label, 70, 388, 24, battle.result === "win" ? palette.green : palette.yellow);
    drawTextBlock(lastBattleNote(), 70, 418, 15, palette.ink, 560, 3);
    button("finish-battle", 708, 418, 168, 52, "Cobrar resultado", "", false, finishBattle);
  } else {
    drawTextBlock(battle.prompt.text, 70, 382, 16, palette.ink, 808, 2);
    battleChoices.forEach((choice, index) => {
      const x = 70 + (index % 3) * 278;
      const y = 424 + Math.floor(index / 3) * 44;
      const boosted = battle.prompt.best.includes(choice.id);
      drawBattleChoiceCard(choice, index, x, y, 252, 36, boosted, index === battleFocus);
    });
  }

  drawBattleLog();
}

function drawBattleHeader(battle: BattleState): void {
  drawPanel(44, 88, 300, 78);
  drawTextLine(battle.eventName, 66, 120, 22, palette.ink, 248);
  drawTextLine(`${state.playerName} vs ${battle.rivalName}`, 66, 146, 14, palette.yellow, 248);

  drawPanel(370, 88, 224, 78);
  drawText(`Ronda ${battle.round}/${battle.maxRounds}`, 392, 118, 17, palette.ink);
  drawText(`Marcador ${battle.playerScore} - ${battle.rivalScore}`, 392, 144, 14, palette.yellow);
  drawMeter(500, 118, 70, 10, battle.hype, 100, palette.red, "Hype");

  if (battle.results.length === 0) {
    drawPanel(632, 88, 248, 78);
    drawText("Rival", 654, 118, 16, palette.ink);
    drawTextLine(battle.rivalStyle, 654, 144, 12, palette.muted, 202);
  }
}

function drawTopHud(): void {
  drawSoftPanel(24, 16, 288, 56);
  drawTextLine(state.playerName, 44, 42, 19, palette.ink, 148);
  drawText(`Nv ${state.level}`, 212, 42, 16, palette.yellow);
  drawTextLine(currentStage().title, 256, 42, 13, palette.teal, 42);
  drawSmallMeter(44, 56, 238, 6, state.xp, state.xpNext, palette.blue, "XP");

  drawSoftPanel(328, 16, 260, 56);
  drawText(`Semana ${state.week}`, 348, 38, 12, palette.muted);
  drawText(`Dia ${state.day}/7`, 438, 38, 12, palette.muted);
  drawText(formatHour(state.hour), 520, 42, 18, palette.yellow);
  drawDayProgress(348, 56, 206, 7);

  drawSoftPanel(604, 16, 332, 56);
  drawSmallMeter(624, 40, 70, 8, state.energy, maxEnergy(), palette.green, "Energia");
  drawSmallMeter(708, 40, 66, 8, state.health, 100, palette.red, "Salud");
  drawSmallMeter(788, 40, 62, 8, state.momentum, 100, palette.teal, "Impulso");
  drawTextLine(`$${state.cash}`, 864, 38, 13, palette.yellow, 62);
  drawTextLine(`${state.fans} fans`, 864, 58, 11, palette.ink, 62);
}

function drawCareerPanels(): void {
  drawCareerDossier(676, 88, 236, 236);
}

function drawActions(): void {
  const actions = getCareerActions();
  actionFocus = clamp(actionFocus, 0, actions.length - 1);
  drawSoftPanel(38, 340, 884, 186);
  drawText("Siguiente movimiento", 64, 368, 18, palette.ink);
  if (timeFx) {
    drawTimeAdvanceFx();
  } else {
    drawTextLine(`Impulso: ${momentumMood()} · variar acciones mantiene la carrera viva`, 382, 367, 11, palette.muted, 500);
  }

  drawTextBlock(state.lastEvent, 64, 389, 10, palette.muted, 296, 2);
  drawSelectedActionDetail(actions[actionFocus], 64, 412, 286, 88);
  actions.forEach((action, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = 382 + col * 260;
    const y = 384 + row * 34;
    drawActionListItem(action, index, x, y, 238, 30, index === actionFocus);
  });
}

function drawCareerSceneFrame(): void {
  if (hasSceneBackdrop(state.stage)) {
    pixelRect(52, 306, 248, 20, "rgba(9, 11, 14, 0.54)");
    pixelRect(52, 322, 248, 3, palette.yellow);
    drawTextLine(currentStage().place, 64, 320, 11, palette.ink, 220);
    return;
  }

  drawQuad(
    [
      [34, 82],
      [626, 82],
      [604, 324],
      [52, 324],
    ],
    "rgba(10,12,16,0.18)",
  );
  drawLine(46, 318, 604, 318, "rgba(225,184,74,0.28)", 2);
  drawLine(610, 96, 604, 318, "rgba(243,242,233,0.12)", 1);
  pixelRect(54, 308, 166, 4, palette.yellow);
  drawTextLine(currentStage().place, 56, 302, 11, palette.muted, 230);
}

function drawCareerDossier(x: number, y: number, w: number, h: number): void {
  drawSoftPanel(x, y, w, h);
  drawText("Carrera", x + 18, y + 32, 18, palette.ink);
  drawTextLine(currentStage().title, x + w - 88, y + 32, 15, palette.yellow, 68);
  drawTextLine(currentStage().place, x + 18, y + 58, 12, palette.muted, w - 36);

  pixelRect(x + 18, y + 74, w - 36, 1, "#333842");
  drawText("Objetivos", x + 18, y + 94, 12, palette.teal);
  getCareerGoals()
    .slice(0, 2)
    .forEach((goal, index) => drawGoalRow(x + 18, y + 108 + index * 34, w - 36, goal));

  pixelRect(x + 18, y + 174, w - 36, 1, "#333842");
  drawSetupUpgrade(x + 18, y + 190, w - 36);
}

function drawGoalRow(x: number, y: number, w: number, goal: CareerGoal): void {
  drawTextLine(goal.label, x, y, 11, palette.ink, w);
  drawTextLine(goal.detail, x, y + 13, 9, palette.muted, w);
  pixelRect(x, y + 19, w, 6, "rgba(8,9,12,0.92)");
  pixelRect(x, y + 19, Math.floor((clamp(goal.value, 0, goal.max) / goal.max) * w), 6, goal.color);
}

function drawSetupUpgrade(x: number, y: number, w: number): void {
  const next = nextUpgrade();
  const setupText = `Setup ${state.outfitLevel}/${state.studioLevel}/${state.homeLevel}`;
  drawTextLine(setupText, x, y, 11, palette.muted, 86);
  upgrades.forEach((upgrade, index) => {
    const level = upgradeLevel(upgrade.key);
    const dotX = x + 94 + index * 36;
    for (let i = 0; i < upgrade.maxLevel; i += 1) {
      pixelRect(dotX + i * 8, y - 8, 6, 6, i < level ? upgrade.color : "#343843");
    }
  });

  const buttonY = y + 12;
  const disabled = !next || state.cash < upgradeCost(next);
  const label = next ? `U ${next.shortLabel} $${upgradeCost(next)}` : "Setup max";
  pixelRect(x + 2, buttonY + 2, w, 26, "rgba(0,0,0,0.24)");
  pixelRect(x, buttonY, w, 26, disabled ? "rgba(18,20,26,0.72)" : "rgba(35,42,50,0.96)");
  pixelRect(x, buttonY, 4, 26, next ? next.color : palette.muted);
  drawTextLine(label, x + 12, buttonY + 17, 11, disabled ? "#72757d" : palette.ink, 92);
  drawTextLine(next?.effect ?? "Todo listo", x + 112, buttonY + 17, 9, disabled ? "#676a71" : palette.muted, w - 120);
  zones.push({ id: "upgrade", x, y: buttonY, w, h: 26, disabled, onClick: buyRecommendedUpgrade });
}

function drawSelectedActionDetail(action: CareerAction, x: number, y: number, w: number, h: number): void {
  const accent = actionAccent(action.id);
  pixelRect(x, y, w, h, "#111319");
  pixelRect(x, y, 5, h, accent);
  drawActionIcon(action.id, x + 18, y + 18, accent);
  drawText("Plan", x + 58, y + 19, 10, palette.muted);
  drawTextLine(action.label, x + 58, y + 40, 17, action.disabledReason ? "#858891" : palette.ink, w - 76);
  drawTextLine(action.detail, x + 18, y + 62, 10, palette.muted, w - 36);
  drawTextLine(action.disabledReason ?? action.cost, x + 18, y + h - 10, 10, action.disabledReason ? palette.red : palette.yellow, 136);
  drawTextLine(action.rhythm, x + 164, y + h - 10, 10, rhythmColor(action.rhythm), w - 182);
}

function drawActionListItem(
  action: CareerAction,
  index: number,
  x: number,
  y: number,
  w: number,
  h: number,
  focused: boolean,
): void {
  const disabled = Boolean(action.disabledReason);
  const accent = disabled ? "#5b5f68" : actionAccent(action.id);
  const hot = pointer.x >= x && pointer.x <= x + w && pointer.y >= y && pointer.y <= y + h;
  const fill = disabled
    ? "rgba(19,21,27,0.74)"
    : focused
      ? "rgba(48,56,67,0.96)"
      : hot
        ? "rgba(39,45,55,0.96)"
        : "rgba(18,20,26,0.88)";

  pixelRect(x + 3, y + 3, w, h, "rgba(0,0,0,0.24)");
  pixelRect(x, y, w, h, fill);
  pixelRect(x, y, 4, h, accent);
  drawTextLine(String(index + 1), x + 13, y + 19, 10, disabled ? "#70737b" : palette.muted, 18);
  drawTextLine(actionShortLabel(action.id, action.label), x + 36, y + 19, 12, disabled ? "#737781" : palette.ink, 112);
  drawTextLine(disabled ? "bloq" : formatDuration(action.durationHours), x + w - 88, y + 19, 10, disabled ? "#686b72" : palette.yellow, 42);
  if (!disabled) {
    drawTextLine(rhythmShort(action.rhythm), x + w - 48, y + 19, 10, rhythmColor(action.rhythm), 40);
  }
  if (focused) {
    pixelRect(x + w - 7, y + 7, 3, h - 14, palette.yellow);
  }
  zones.push({ id: `action-${action.id}`, x, y, w, h, disabled, onClick: action.run });
}

function actionShortLabel(id: string, fallback: string): string {
  switch (id) {
    case "practice":
      return "Practicar";
    case "cypher":
      return "Cypher";
    case "work":
      return "Trabajar";
    case "social":
      return "Clip";
    case "write":
      return "Tema";
    case "record":
      return "Grabar";
    case "battle":
      return "Batalla";
    case "show":
      return "Show";
    case "rest":
      return "Descansar";
    default:
      return fallback;
  }
}

function actionAccent(id: string): string {
  switch (id) {
    case "practice":
      return palette.teal;
    case "cypher":
      return palette.yellow;
    case "work":
      return "#b58b62";
    case "social":
      return palette.green;
    case "write":
      return palette.blue;
    case "record":
      return palette.pink;
    case "battle":
      return palette.red;
    case "show":
      return palette.pink;
    case "rest":
      return "#9aa0ad";
    default:
      return palette.yellow;
  }
}

function drawActionIcon(id: string, x: number, y: number, color: string): void {
  pixelRect(x, y, 26, 26, "#0d0f13");
  if (id === "battle") {
    pixelRect(x + 5, y + 11, 16, 5, color);
    pixelRect(x + 18, y + 7, 5, 5, palette.ink);
    return;
  }
  if (id === "social") {
    pixelRect(x + 6, y + 5, 14, 18, color);
    pixelRect(x + 9, y + 8, 8, 2, palette.ink);
    pixelRect(x + 9, y + 17, 8, 2, palette.ink);
    return;
  }
  if (id === "write") {
    pixelRect(x + 5, y + 6, 13, 16, palette.ink);
    pixelRect(x + 9, y + 10, 13, 4, color);
    return;
  }
  if (id === "rest") {
    pixelRect(x + 5, y + 14, 16, 6, color);
    pixelRect(x + 8, y + 9, 6, 5, palette.ink);
    return;
  }
  pixelRect(x + 6, y + 7, 14, 14, color);
  pixelRect(x + 10, y + 11, 6, 6, "#0d0f13");
}

function drawBattleChoiceCard(
  choice: BattleChoice,
  index: number,
  x: number,
  y: number,
  w: number,
  h: number,
  boosted: boolean,
  focused: boolean,
): void {
  const accent = boosted ? palette.teal : statColor(choice.stat);
  const fill = focused ? "#303945" : boosted ? "#1d332f" : "#15171d";
  pixelRect(x + 3, y + 3, w, h, "rgba(0,0,0,0.24)");
  pixelRect(x, y, w, h, fill);
  pixelRect(x, y, w, 3, accent);
  drawTextLine(`${index + 1}. ${choice.label}`, x + 12, y + 20, 13, palette.ink, 122);
  drawTextLine(boosted ? "lectura buena" : statLabels[choice.stat], x + 144, y + 20, 10, boosted ? palette.teal : palette.muted, 92);
  if (focused) pixelRect(x + w - 8, y + 9, 4, h - 18, palette.yellow);
  zones.push({ id: `battle-${choice.id}`, x, y, w, h, disabled: false, onClick: () => resolveBattle(choice) });
}

function drawBattleLog(): void {
  const battle = state.battle;
  if (!battle || battle.results.length === 0) return;
  const recent = battle.results.slice(-2);
  drawPanel(632, 88, 248, 86);
  drawText("Ultimas barras", 654, 116, 16, palette.ink);
  recent.forEach((result, index) => {
    const winner = result.player >= result.rival ? "tuya" : "rival";
    drawTextLine(`R${result.round}: ${winner} ${result.player}-${result.rival}`, 654, 142 + index * 20, 12, palette.muted, 198);
  });
}

function lastBattleNote(): string {
  const battle = state.battle;
  if (!battle) return "";
  const last = battle.results[battle.results.length - 1];
  if (!last) return "La batalla termino.";
  if (battle.result === "win") return "La ultima ronda prende al publico y te llevas el evento.";
  if (battle.result === "draw") return "El publico queda dividido, pero tu nombre empieza a circular.";
  return "No alcanzo esta vez, pero sumaste experiencia real de tarima.";
}

function drawBackdrop(stageId: StageId): void {
  if (drawGeneratedBackdrop(stageId)) return;

  const gradient = ctx.createLinearGradient(0, 0, 0, H);
  if (stageId === "pieza") {
    gradient.addColorStop(0, "#293142");
    gradient.addColorStop(0.56, "#1c202a");
    gradient.addColorStop(1, "#242832");
  } else if (stageId === "plaza") {
    gradient.addColorStop(0, "#263d50");
    gradient.addColorStop(0.58, "#1e3130");
    gradient.addColorStop(1, "#30372d");
  } else if (stageId === "regional") {
    gradient.addColorStop(0, "#26253f");
    gradient.addColorStop(0.6, "#182630");
    gradient.addColorStop(1, "#28282f");
  } else {
    gradient.addColorStop(0, "#181926");
    gradient.addColorStop(0.55, "#251923");
    gradient.addColorStop(1, "#29262f");
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  for (let i = 0; i < 58; i += 1) {
    const x = (i * 83 + Math.floor(state.animationTime * 8)) % W;
    const y = 76 + ((i * 47) % 240);
    const alpha = i % 4 === 0 ? "0.11" : "0.055";
    pixelRect(x, y, i % 5 === 0 ? 4 : 2, i % 5 === 0 ? 4 : 2, `rgba(255,255,255,${alpha})`);
  }

  drawDepthShell(stageId);
}

function hasSceneBackdrop(stageId: StageId): boolean {
  return Boolean(sceneReady[stageId] && sceneImages[stageId]);
}

function drawGeneratedBackdrop(stageId: StageId): boolean {
  const image = sceneImages[stageId];
  if (!image || !sceneReady[stageId] || image.width <= 0 || image.height <= 0) return false;

  const sourceRatio = image.width / image.height;
  const targetRatio = W / H;
  let sx = 0;
  let sy = 0;
  let sw = image.width;
  let sh = image.height;

  if (sourceRatio > targetRatio) {
    sw = image.height * targetRatio;
    sx = (image.width - sw) / 2;
  } else if (sourceRatio < targetRatio) {
    sh = image.width / targetRatio;
    sy = (image.height - sh) / 2;
  }

  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, W, H);

  const shade = ctx.createLinearGradient(0, 0, 0, H);
  shade.addColorStop(0, "rgba(8, 10, 13, 0.42)");
  shade.addColorStop(0.32, "rgba(8, 10, 13, 0.1)");
  shade.addColorStop(0.64, "rgba(8, 10, 13, 0.06)");
  shade.addColorStop(1, "rgba(8, 10, 13, 0.62)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, H);

  return true;
}

function drawEnvironment(stageId: StageId): void {
  if (stageId === "pieza") {
    drawRoomProps();
    return;
  }
  if (stageId === "plaza") {
    drawPlazaProps(false);
    return;
  }
  drawStageSet(stageId, false);
}

function drawBattleArena(stageId: StageId): void {
  if (stageId === "pieza") {
    if (!hasSceneBackdrop(stageId)) drawRoomProps();
    drawCypherFriends();
    return;
  }
  if (stageId === "plaza") {
    if (!hasSceneBackdrop(stageId)) drawPlazaProps(true);
    drawBattleCrowd(290, 0.85);
    return;
  }
  if (!hasSceneBackdrop(stageId)) drawStageSet(stageId, true);
  drawBattleCrowd(292, stageId === "estrella" ? 1.2 : 1);
}

function drawDepthShell(stageId: StageId): void {
  const horizon = stageId === "pieza" ? 318 : stageId === "plaza" ? 306 : 300;
  if (stageId === "pieza") {
    drawQuad(
      [
        [0, 92],
        [212, 128],
        [212, horizon],
        [0, 350],
      ],
      "#202633",
    );
    drawQuad(
      [
        [748, 128],
        [960, 92],
        [960, 350],
        [748, horizon],
      ],
      "#171b24",
    );
    pixelRect(210, 126, 540, horizon - 126, "#20242e");
    pixelRect(210, 126, 540, 4, "#343a47");
  }
  drawPerspectiveFloor(stageId, horizon);
}

function drawPerspectiveFloor(stageId: StageId, horizon: number): void {
  const vanX = stageId === "pieza" ? 480 : stageId === "plaza" ? 420 : 500;
  const floorColor = stageId === "pieza" ? "#2c3039" : stageId === "plaza" ? "#31372f" : "#26272f";
  pixelRect(0, horizon, W, H - horizon, floorColor);
  pixelRect(0, horizon, W, 4, "#4b5058");

  for (let i = 1; i < 9; i += 1) {
    const t = i / 9;
    const y = horizon + Math.pow(t, 1.85) * (H - horizon);
    drawLine(0, y, W, y, "rgba(255,255,255,0.08)", 1);
  }
  for (let x = -240; x <= W + 240; x += stageId === "pieza" ? 120 : 96) {
    drawLine(vanX, horizon, x, H, "rgba(255,255,255,0.075)", 1);
  }
}

function drawRoomProps(): void {
  drawWindow(84, 150);
  drawPoster(272, 152, "FLOW", palette.teal);
  drawPoster(356, 152, "BPM", palette.red);
  drawRecordShelf(742, 184);
  drawStudioDesk(592, 250);
  drawSpeakerStack(52, 198, 1);
  drawBox3d(402, 292, 122, 34, 28, "#38313a", "#4c4450", "#211d25");
  drawText("RUG", 446, 314, 14, palette.yellow);
  drawLine(212, 318, 0, 350, "rgba(255,255,255,0.08)", 1);
  drawLine(748, 318, 960, 350, "rgba(255,255,255,0.08)", 1);
}

function drawPlazaProps(isBattle: boolean): void {
  drawCitySilhouette();
  drawQuad(
    [
      [112, 210],
      [846, 196],
      [816, 286],
      [82, 300],
    ],
    "#263139",
  );
  drawQuad(
    [
      [126, 226],
      [424, 216],
      [408, 260],
      [110, 272],
    ],
    "#334148",
  );
  drawText("FREESTYLE", 148, 252, 22, palette.yellow);
  drawText("PLAZA", 320, 250, 20, palette.teal);
  drawBench3d(612, 270);
  drawStreetLamp(820, 172);
  drawTree3d(74, 206);
  drawTree3d(872, 218);
  if (!isBattle) {
    drawSpeakerStack(704, 256, 0.76);
  }
}

function drawStageSet(stageId: StageId, isBattle: boolean): void {
  const scale = stageId === "estrella" || stageId === "internacional" ? 1.12 : 1;
  drawStageLights(stageId);
  drawQuad(
    [
      [72, 286],
      [890, 286],
      [840, 354],
      [118, 354],
    ],
    "#191a20",
  );
  drawQuad(
    [
      [118, 354],
      [840, 354],
      [882, 382],
      [78, 382],
    ],
    "#3a3036",
  );
  drawLine(118, 354, 840, 354, "#5a4b56", 2);
  drawSpeakerStack(80, 238, 0.9 * scale);
  drawSpeakerStack(818, 238, 0.9 * scale);
  drawLedScreen(358, 126, stageId);
  if (!isBattle) {
    drawBattleCrowd(316, 0.75);
  }
}

function drawStageLights(stageId: StageId): void {
  const rigY = stageId === "estrella" || stageId === "internacional" ? 82 : 96;
  drawLine(78, rigY, 884, rigY, "#0f1015", 8);
  drawLine(108, rigY, 72, 282, "#0f1015", 5);
  drawLine(852, rigY, 890, 282, "#0f1015", 5);
  for (let i = 0; i < 5; i += 1) {
    const x = 120 + i * 180;
    const color = [palette.yellow, palette.red, palette.teal, palette.blue, palette.pink][i];
    pixelRect(x, rigY - 8, 56, 14, color);
    ctx.fillStyle = `${color}33`;
    ctx.beginPath();
    ctx.moveTo(x + 28, rigY + 6);
    ctx.lineTo(x - 58, 318);
    ctx.lineTo(x + 116, 318);
    ctx.closePath();
    ctx.fill();
  }
}

function drawBattleCrowd(baseY = 300, scale = 1): void {
  const count = Math.round(52 * scale);
  for (let i = 0; i < count; i += 1) {
    const x = -6 + i * (19 / scale);
    const y = baseY + ((i * 7) % 20);
    const color = [palette.blue, palette.teal, palette.yellow, palette.red, palette.pink][i % 5];
    pixelRect(x, y, 10 * scale, 22 * scale, color);
    pixelRect(x + 2 * scale, y - 6 * scale, 6 * scale, 6 * scale, palette.ink);
    if (i % 6 === 0) {
      drawLine(x + 6, y + 4, x + 14, y - 12, color, 3);
    }
  }
}

function drawCypherFriends(): void {
  const spots = [
    [142, 318, palette.blue],
    [178, 322, palette.yellow],
    [758, 318, palette.teal],
    [804, 324, palette.red],
  ] as const;
  spots.forEach(([x, y, color], index) => {
    const s = index % 2 === 0 ? 1.05 : 0.92;
    pixelRect(x - 10 * s, y - 42 * s, 20 * s, 16 * s, color);
    pixelRect(x - 14 * s, y - 26 * s, 28 * s, 34 * s, "#2a2d35");
    pixelRect(x - 8 * s, y + 8 * s, 7 * s, 24 * s, "#555b66");
    pixelRect(x + 2 * s, y + 8 * s, 7 * s, 24 * s, "#555b66");
  });
  drawQuad(
    [
      [324, 332],
      [636, 332],
      [704, 386],
      [262, 386],
    ],
    "rgba(225,184,74,0.12)",
  );
  drawLine(324, 332, 636, 332, "rgba(225,184,74,0.38)", 2);
}

function drawCitySilhouette(): void {
  for (let i = 0; i < 12; i += 1) {
    const x = i * 88;
    const h = 40 + ((i * 29) % 70);
    pixelRect(x, 190 - h, 56 + (i % 3) * 18, h, "rgba(12,16,20,0.52)");
    for (let w = 0; w < 3; w += 1) {
      pixelRect(x + 10 + w * 16, 198 - h + ((i + w) % 4) * 12, 5, 7, "rgba(225,184,74,0.22)");
    }
  }
}

function drawWindow(x: number, y: number): void {
  drawBox3d(x, y, 128, 82, 12, "#11151d", "#2f3848", "#0b0d12");
  pixelRect(x + 14, y + 14, 100, 50, "#172130");
  pixelRect(x + 18, y + 34, 92, 3, "#304055");
  pixelRect(x + 62, y + 18, 3, 42, "#304055");
  pixelRect(x + 24, y + 22, 8, 8, palette.yellow);
  pixelRect(x + 76, y + 28, 6, 6, palette.teal);
}

function drawPoster(x: number, y: number, text: string, color: string): void {
  drawBox3d(x, y, 64, 72, 8, "#171a21", "#2d323d", "#0b0c10");
  pixelRect(x + 10, y + 12, 44, 32, color);
  drawText(text, x + 12, y + 62, 13, palette.ink);
}

function drawRecordShelf(x: number, y: number): void {
  drawBox3d(x, y, 112, 128, 18, "#17191f", "#2f3440", "#101116");
  for (let row = 0; row < 4; row += 1) {
    pixelRect(x + 16, y + 18 + row * 27, 78, 4, "#0f1014");
    for (let i = 0; i < 6; i += 1) {
      const color = [palette.yellow, palette.red, palette.blue, palette.teal, palette.pink, palette.ink][(i + row) % 6];
      pixelRect(x + 18 + i * 12, y + 6 + row * 27, 7, 21, color);
    }
  }
}

function drawStudioDesk(x: number, y: number): void {
  drawBox3d(x, y, 104, 58, 20, "#2f2623", "#524640", "#171211");
  drawBox3d(x + 14, y - 28, 62, 30, 8, "#2f333d", "#515665", "#15171d");
  pixelRect(x + 22, y - 20, 46, 16, "#151a22");
  pixelRect(x + 30, y - 12, 30, 3, palette.teal);
  drawMicStand(x + 76, y - 24);
}

function drawSpeakerStack(x: number, y: number, scale: number): void {
  const w = 82 * scale;
  const h = 108 * scale;
  drawBox3d(x, y, w, h, 14 * scale, "#171a20", "#303642", "#0d0e12");
  pixelRect(x + 14 * scale, y + 16 * scale, 50 * scale, 42 * scale, "#0d0e12");
  pixelRect(x + 24 * scale, y + 26 * scale, 30 * scale, 22 * scale, "#2c3038");
  pixelRect(x + 22 * scale, y + 70 * scale, 34 * scale, 20 * scale, "#0d0e12");
  pixelRect(x + 30 * scale, y + 78 * scale, 18 * scale, 7 * scale, palette.teal);
}

function drawBench3d(x: number, y: number): void {
  drawBox3d(x, y, 142, 22, 18, "#6b5740", "#8a704f", "#372c22");
  pixelRect(x + 10, y + 20, 10, 42, "#221b16");
  pixelRect(x + 116, y + 20, 10, 42, "#221b16");
  drawQuad(
    [
      [x - 4, y + 44],
      [x + 142, y + 44],
      [x + 170, y + 64],
      [x + 20, y + 66],
    ],
    "rgba(0,0,0,0.22)",
  );
}

function drawStreetLamp(x: number, y: number): void {
  drawLine(x, y, x, y + 132, "#101218", 5);
  drawLine(x, y, x + 58, y + 16, "#101218", 5);
  pixelRect(x + 54, y + 10, 22, 12, palette.yellow);
  ctx.fillStyle = "rgba(225,184,74,0.18)";
  ctx.beginPath();
  ctx.moveTo(x + 65, y + 22);
  ctx.lineTo(x + 12, y + 168);
  ctx.lineTo(x + 124, y + 168);
  ctx.closePath();
  ctx.fill();
}

function drawTree3d(x: number, y: number): void {
  drawBox3d(x + 28, y + 42, 22, 72, 8, "#5b4735", "#705942", "#30261d");
  drawQuad(
    [
      [x, y + 40],
      [x + 42, y],
      [x + 92, y + 42],
      [x + 48, y + 76],
    ],
    "#3f7c49",
  );
  drawQuad(
    [
      [x + 22, y + 18],
      [x + 80, y + 20],
      [x + 110, y + 66],
      [x + 50, y + 88],
    ],
    "#32693e",
  );
}

function drawLedScreen(x: number, y: number, stageId: StageId): void {
  const title = stageId === "estrella" ? "FEST" : stageId === "internacional" ? "WORLD" : "REGIONAL";
  drawBox3d(x, y, 250, 92, 16, "#101116", "#2b303a", "#090a0d");
  pixelRect(x + 16, y + 16, 218, 60, "#111721");
  for (let i = 0; i < 11; i += 1) {
    const color = [palette.red, palette.yellow, palette.teal, palette.blue][i % 4];
    pixelRect(x + 24 + i * 18, y + 24 + ((i * 5) % 18), 12, 28, `${color}cc`);
  }
  drawText(title, x + 78, y + 58, 20, palette.ink);
}

function drawMc(x: number, y: number, scale: number, time: number): void {
  drawPerformer(x, y, scale, time, "mc");
}

function drawRival(x: number, y: number, scale: number, time: number): void {
  drawPerformer(x, y, scale, time, "rival");
}

function drawPerformer(x: number, y: number, scale: number, time: number, variant: "mc" | "rival"): void {
  const s = scale;
  const bounce = (variant === "mc" ? Math.sin(time * 6) : Math.cos(time * 5.5)) * 2;
  const dir = variant === "mc" ? 1 : -1;
  const idx = stageIndex();
  const outfit = variant === "mc" ? state.outfitLevel : 0;
  const jacket =
    variant === "mc"
      ? outfit >= 3
        ? palette.pink
        : outfit >= 2
          ? palette.yellow
          : idx >= 1
            ? "#3ab89d"
            : palette.teal
      : palette.pink;
  const jacketDark = variant === "mc" ? (outfit >= 2 ? "#8d7438" : "#1e766a") : "#a43f6b";
  const pants = variant === "mc" ? (outfit >= 1 ? "#243a68" : idx >= 2 ? "#38466f" : palette.blue) : "#525865";
  const cap = variant === "mc" ? (outfit >= 2 || state.level >= 4 ? palette.yellow : palette.red) : palette.blue;
  const skin = variant === "mc" ? "#f0bd82" : "#d69a72";
  const hair = "#171116";
  const shirt = variant === "mc" ? palette.ink : "#ddd8cf";

  drawQuad(
    [
      [x - 34 * s, y + 35 * s],
      [x + 34 * s, y + 35 * s],
      [x + 48 * s, y + 44 * s],
      [x - 48 * s, y + 44 * s],
    ],
    "rgba(0,0,0,0.22)",
  );

  const yy = y + bounce;
  const px = (dx: number, dy: number, w: number, h: number, color: string) => {
    const left = w < 0 ? dx + w : dx;
    pixelRect(x + left * s, yy + dy * s, Math.abs(w) * s, h * s, color);
  };

  px(-18, -2, 13, 38, pants);
  px(5, -2, 13, 38, pants);
  px(-21, 30, 19, 7, variant === "mc" ? palette.ink : "#16181d");
  px(2, 30, 22, 7, variant === "mc" ? palette.yellow : palette.ink);
  px(-16, -6, 34, 9, "#15171d");

  px(-27, -54, 54, 13, jacketDark);
  px(-23, -48, 46, 48, jacket);
  px(-12, -45, 24, 43, shirt);
  px(-4, -43, 8, 40, variant === "mc" ? "#f4efe4" : "#242834");
  px(-22, -42, 9, 38, jacketDark);
  px(13, -42, 9, 38, jacketDark);

  px(-25, -37, 10, 42, skin);
  px(15, -37, 10, 30, skin);
  px(25 * dir, -50, 24 * dir, 7, skin);
  px(43 * dir, -55, 7 * dir, 8, palette.ink);
  px(38 * dir, -58, 15 * dir, 5, palette.yellow);

  px(-15, -75, 30, 26, skin);
  px(-18, -80, 36, 12, cap);
  px(10 * dir, -78, 18 * dir, 5, cap);
  px(-16, -67, 32, 8, hair);
  px(-8, -63, 5, 4, palette.black);
  px(5, -63, 5, 4, palette.black);
  px(-7, -55, 14, 3, "#7c3f33");

  px(-13, -28, 26, 3, palette.yellow);
  if ((state.level >= 3 || outfit >= 1) && variant === "mc") {
    px(-6, -24, 12, 8, palette.yellow);
  }
  if (variant === "mc" && outfit >= 3) {
    px(-18, -48, 5, 42, palette.pink);
    px(13, -48, 5, 42, palette.pink);
  }
}

function drawMicStand(x: number, y: number): void {
  pixelRect(x, y, 6, 90, "#111217");
  pixelRect(x - 18, y + 88, 42, 6, "#111217");
  pixelRect(x - 6, y - 6, 34, 10, palette.yellow);
}

function drawVinylLogo(x: number, y: number): void {
  pixelRect(x - 56, y - 56, 112, 112, "#111217");
  pixelRect(x - 40, y - 40, 80, 80, palette.panel);
  pixelRect(x - 16, y - 16, 32, 32, palette.yellow);
  pixelRect(x - 4, y - 4, 8, 8, palette.black);
}

function drawBox3d(
  x: number,
  y: number,
  w: number,
  h: number,
  depth: number,
  front: string,
  top: string,
  side: string,
): void {
  drawQuad(
    [
      [x, y],
      [x + depth, y - depth],
      [x + w + depth, y - depth],
      [x + w, y],
    ],
    top,
  );
  drawQuad(
    [
      [x + w, y],
      [x + w + depth, y - depth],
      [x + w + depth, y + h - depth],
      [x + w, y + h],
    ],
    side,
  );
  pixelRect(x, y, w, h, front);
  drawLine(x, y, x + w, y, "rgba(255,255,255,0.13)", 1);
  drawLine(x + w, y, x + w + depth, y - depth, "rgba(255,255,255,0.1)", 1);
}

function drawQuad(points: Vec2[], color: string): void {
  if (points.length < 3) return;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(Math.round(points[0][0]), Math.round(points[0][1]));
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(Math.round(points[i][0]), Math.round(points[i][1]));
  }
  ctx.closePath();
  ctx.fill();
}

function drawLine(x1: number, y1: number, x2: number, y2: number, color: string, width = 1): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(Math.round(x1), Math.round(y1));
  ctx.lineTo(Math.round(x2), Math.round(y2));
  ctx.stroke();
  ctx.lineWidth = 1;
}

function drawPanel(x: number, y: number, w: number, h: number): void {
  pixelRect(x + 4, y + 4, w, h, "rgba(0,0,0,0.28)");
  pixelRect(x, y, w, h, palette.panel);
  pixelRect(x, y, w, 3, palette.line);
  pixelRect(x, y + h - 3, w, 3, "#0d0e11");
  pixelRect(x, y, 3, h, palette.line);
  pixelRect(x + w - 3, y, 3, h, "#0d0e11");
}

function drawSoftPanel(x: number, y: number, w: number, h: number): void {
  pixelRect(x + 5, y + 6, w, h, "rgba(0,0,0,0.28)");
  pixelRect(x, y, w, h, "rgba(18,20,26,0.88)");
  pixelRect(x, y, w, 2, "rgba(243,242,233,0.16)");
  pixelRect(x, y + h - 2, w, 2, "rgba(0,0,0,0.42)");
  pixelRect(x, y, 2, h, "rgba(225,184,74,0.22)");
  pixelRect(x + w - 2, y, 2, h, "rgba(0,0,0,0.36)");
}

function drawInputBox(x: number, y: number, w: number, h: number, value: string): void {
  pixelRect(x, y, w, h, "#0e0f12");
  pixelRect(x, y, w, 3, palette.yellow);
  pixelRect(x, y + h - 3, w, 3, palette.line);
  const cursor = Math.floor(state.animationTime * 2) % 2 === 0 ? "_" : "";
  drawText(`${value}${cursor}`, x + 14, y + 28, 18, palette.ink);
}

function button(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  detail: string,
  disabled: boolean,
  onClick: () => void,
  base = palette.panel,
): void {
  const hot = pointer.x >= x && pointer.x <= x + w && pointer.y >= y && pointer.y <= y + h;
  const fill = disabled ? "#25272d" : hot ? "#3b414b" : base;
  const showDetail = Boolean(detail) && h >= 38;
  pixelRect(x + 3, y + 3, w, h, "rgba(0,0,0,0.28)");
  pixelRect(x, y, w, h, fill);
  pixelRect(x, y, w, 3, disabled ? "#42444a" : palette.yellow);
  drawTextLine(label, x + 12, y + (showDetail ? 19 : Math.floor(h / 2) + 5), 13, disabled ? "#777a82" : palette.ink, w - 24);
  if (showDetail) {
    drawTextLine(detail, x + 12, y + h - 9, 10, disabled ? "#686b72" : palette.muted, w - 24);
  }
  zones.push({ id, x, y, w, h, disabled, onClick });
}

function drawResourceLine(x: number, y: number, label: string, value: number | string, color: string): void {
  pixelRect(x, y - 12, 9, 9, color);
  drawText(label, x + 16, y, 14, palette.muted);
  drawText(String(value), x + 140, y, 14, palette.ink);
}

function drawDayProgress(x: number, y: number, w: number, h: number): void {
  pixelRect(x, y, w, h, "#0d0f13");
  const dawn = Math.floor(w * 0.25);
  const dusk = Math.floor(w * 0.75);
  pixelRect(x, y, dawn, h, "#1d2230");
  pixelRect(x + dawn, y, dusk - dawn, h, "#594f32");
  pixelRect(x + dusk, y, w - dusk, h, "#171b28");
  for (let i = 0; i <= 24; i += 4) {
    const tickX = x + Math.floor((i / 24) * w);
    pixelRect(tickX, y - 2, 1, h + 4, "rgba(243,242,233,0.22)");
  }
  const markerX = x + Math.floor((state.hour / 24) * w);
  pixelRect(markerX - 3, y - 4, 7, h + 8, state.hour >= 7 && state.hour < 20 ? palette.yellow : palette.blue);
  drawText(state.hour >= 7 && state.hour < 20 ? "dia" : "noche", x + w - 42, y + 8, 10, palette.muted);
}

function drawSmallMeter(
  x: number,
  y: number,
  w: number,
  h: number,
  value: number,
  max: number,
  color: string,
  label: string,
): void {
  drawText(label, x, y - 4, 9, palette.muted);
  pixelRect(x, y, w, h, "rgba(8,9,12,0.92)");
  pixelRect(x, y, Math.floor((clamp(value, 0, max) / max) * w), h, color);
  pixelRect(x, y, w, 1, "rgba(255,255,255,0.2)");
}

function drawTimeAdvanceFx(): void {
  if (!timeFx) return;
  const progress = clamp(timeFx.elapsed / timeFx.duration, 0, 1);
  const eased = 1 - Math.pow(1 - progress, 3);
  const x = 382;
  const y = 350;
  const w = 510;
  pixelRect(x, y, w, 28, "rgba(18,20,26,0.94)");
  pixelRect(x, y, 4, 28, palette.yellow);
  drawTextLine(`Pasaron ${formatDuration(timeFx.hours)} · ${timeFx.label}`, x + 14, y + 18, 11, palette.ink, 232);
  drawText(`${formatHour(timeFx.fromHour)} -> ${formatHour(timeFx.toHour)}`, x + 260, y + 18, 10, palette.muted);
  pixelRect(x + 358, y + 11, 110, 6, "#0d0f13");
  pixelRect(x + 358, y + 11, Math.floor(110 * eased), 6, palette.yellow);
  const markerX = x + 358 + Math.floor(110 * eased);
  pixelRect(markerX - 2, y + 7, 5, 14, palette.teal);
  if (timeFx.daysPassed > 0) {
    drawText(`+${timeFx.daysPassed} dia`, x + 474, y + 18, 10, palette.yellow);
  }
}

function drawResourcePill(x: number, y: number, label: string, value: number | string, color: string): void {
  pixelRect(x, y - 17, 114, 24, "#121419");
  pixelRect(x, y - 17, 4, 24, color);
  drawTextLine(label, x + 12, y - 1, 10, palette.muted, 62);
  drawTextLine(String(value), x + 78, y - 1, 13, palette.ink, 30);
}

function drawMiniStatBar(x: number, y: number, label: string, value: number, color: string): void {
  drawTextLine(label, x, y, 11, palette.muted, 78);
  pixelRect(x, y + 7, 82, 8, "#0e1014");
  const fill = Math.floor((clamp(value, 0, 20) / 20) * 82);
  pixelRect(x, y + 7, fill, 8, color);
  drawText(`${value}`, x + 94, y + 15, 11, palette.ink);
}

function drawMeter(
  x: number,
  y: number,
  w: number,
  h: number,
  value: number,
  max: number,
  color: string,
  label: string,
): void {
  pixelRect(x, y, w, h, "#0d0e11");
  const fill = Math.floor((clamp(value, 0, max) / max) * w);
  pixelRect(x, y, fill, h, color);
  pixelRect(x, y, w, 2, "rgba(255,255,255,0.18)");
  if (label) drawText(label, x, y - 4, 9, palette.muted);
}

function drawText(text: string, x: number, y: number, size: number, color: string, maxWidth = 0): void {
  ctx.fillStyle = color;
  ctx.font = `${size}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
  ctx.textBaseline = "alphabetic";
  if (!maxWidth || ctx.measureText(text).width <= maxWidth) {
    ctx.fillText(text, x, y);
    return;
  }
  const words = text.split(" ");
  let line = "";
  let yy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += size + 4;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}

function drawTextBlock(
  text: string,
  x: number,
  y: number,
  size: number,
  color: string,
  maxWidth: number,
  maxLines: number,
): number {
  ctx.fillStyle = color;
  ctx.font = `${size}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
  ctx.textBaseline = "alphabetic";
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length >= maxLines) break;
    } else {
      line = test;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
    lines[maxLines - 1] = ellipsize(lines[maxLines - 1], maxWidth, size);
  }

  const lineHeight = size + 5;
  lines.forEach((item, index) => {
    ctx.fillText(item, x, y + index * lineHeight);
  });
  return y + lines.length * lineHeight;
}

function drawTextLine(text: string, x: number, y: number, size: number, color: string, maxWidth: number): void {
  ctx.fillStyle = color;
  ctx.font = `${size}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
  ctx.textBaseline = "alphabetic";
  if (ctx.measureText(text).width <= maxWidth) {
    ctx.fillText(text, x, y);
    return;
  }
  ctx.fillText(ellipsize(text, maxWidth, size), x, y);
}

function ellipsize(text: string, maxWidth: number, size: number): string {
  ctx.font = `${size}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
  if (ctx.measureText(text).width <= maxWidth) return text;
  let next = text;
  while (next.length > 1 && ctx.measureText(`${next}...`).width > maxWidth) {
    next = next.slice(0, -1);
  }
  return `${next.trimEnd()}...`;
}

function pixelRect(x: number, y: number, w: number, h: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function statColor(stat: StatKey): string {
  switch (stat) {
    case "flow":
      return palette.teal;
    case "punchline":
      return palette.red;
    case "metrica":
      return palette.blue;
    case "improvisacion":
      return palette.yellow;
    case "escena":
      return palette.pink;
    case "carisma":
      return palette.green;
    case "disciplina":
      return palette.ink;
  }
}

function stageTitle(stageId: StageId): string {
  return stages.find((stage) => stage.id === stageId)?.title ?? "Pieza";
}

function screenToGame(clientX: number, clientY: number): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) / rect.width) * W,
    y: ((clientY - rect.top) / rect.height) * H,
  };
}

function handlePointer(clientX: number, clientY: number, click: boolean): void {
  const mapped = screenToGame(clientX, clientY);
  pointer = { ...mapped, down: click };
  if (!click) return;
  canvas.focus();
  const zone = [...zones].reverse().find((item) => {
    return (
      !item.disabled &&
      mapped.x >= item.x &&
      mapped.x <= item.x + item.w &&
      mapped.y >= item.y &&
      mapped.y <= item.y + item.h
    );
  });
  zone?.onClick();
}

function handleKey(event: KeyboardEvent): void {
  const isConfirm = event.key === "Enter" || event.code === "Space";
  if (event.key.toLowerCase() === "f") {
    toggleFullscreen();
    return;
  }

  if (state.mode === "start") {
    if (isConfirm) {
      if (savedSnapshot && !creatingNew) continueCareer();
      else startCareerFromMenu();
      event.preventDefault();
      return;
    }
    if (!creatingNew && savedSnapshot) return;
    if (event.key === "Backspace") {
      state.inputName = state.inputName.slice(0, -1);
      event.preventDefault();
      return;
    }
    if (event.key.length === 1 && state.inputName.length < 16 && /^[a-zA-Z0-9 _-]$/.test(event.key)) {
      state.inputName += event.key;
    }
    return;
  }

  if (state.mode === "career") {
    const actions = getCareerActions();
    if (event.key.toLowerCase() === "u") {
      buyRecommendedUpgrade();
      event.preventDefault();
      return;
    }
    if (event.key === "ArrowRight") {
      actionFocus = clamp(actionFocus + 1, 0, actions.length - 1);
      event.preventDefault();
      return;
    }
    if (event.key === "ArrowLeft") {
      actionFocus = clamp(actionFocus - 1, 0, actions.length - 1);
      event.preventDefault();
      return;
    }
    if (event.key === "ArrowDown") {
      actionFocus = clamp(actionFocus + 2, 0, actions.length - 1);
      event.preventDefault();
      return;
    }
    if (event.key === "ArrowUp") {
      actionFocus = clamp(actionFocus - 2, 0, actions.length - 1);
      event.preventDefault();
      return;
    }
    if (isConfirm) {
      const action = actions[actionFocus];
      if (action && !action.disabledReason) action.run();
      event.preventDefault();
      return;
    }
    const number = Number(event.key);
    if (Number.isInteger(number) && number > 0) {
      const action = actions[number - 1];
      if (action && !action.disabledReason) action.run();
    }
    return;
  }

  if (state.mode === "battle") {
    const battle = state.battle;
    if (!battle) return;
    if (battle.finished && isConfirm) {
      finishBattle();
      event.preventDefault();
      return;
    }
    if (event.key === "ArrowRight") {
      battleFocus = clamp(battleFocus + 1, 0, battleChoices.length - 1);
      event.preventDefault();
      return;
    }
    if (event.key === "ArrowLeft") {
      battleFocus = clamp(battleFocus - 1, 0, battleChoices.length - 1);
      event.preventDefault();
      return;
    }
    if (event.key === "ArrowDown") {
      battleFocus = clamp(battleFocus + 3, 0, battleChoices.length - 1);
      event.preventDefault();
      return;
    }
    if (event.key === "ArrowUp") {
      battleFocus = clamp(battleFocus - 3, 0, battleChoices.length - 1);
      event.preventDefault();
      return;
    }
    if (isConfirm) {
      resolveBattle(battleChoices[battleFocus]);
      event.preventDefault();
      return;
    }
    const number = Number(event.key);
    if (Number.isInteger(number) && number >= 1 && number <= battleChoices.length) {
      resolveBattle(battleChoices[number - 1]);
    }
  }
}

function toggleFullscreen(): void {
  if (!document.fullscreenElement) {
    canvas.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
}

canvas.addEventListener("pointermove", (event) => handlePointer(event.clientX, event.clientY, false));
canvas.addEventListener("pointerdown", (event) => handlePointer(event.clientX, event.clientY, true));
window.addEventListener("keydown", handleKey);
window.addEventListener("resize", render);

function frame(now: number): void {
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  update(dt);
  render();
  requestAnimationFrame(frame);
}

function renderGameToText(): string {
  const upgrade = nextUpgrade();
  const actions =
    state.mode === "career"
      ? getCareerActions().map((action, index) => ({
          key: String(index + 1),
          id: action.id,
          label: action.label,
          durationHours: action.durationHours,
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
    player: {
      name: state.playerName,
      stage: state.stage,
      level: state.level,
      week: state.week,
      day: state.day,
      hour: state.hour,
      timeLabel: formatHour(state.hour),
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
      momentum: state.momentum,
      momentumMood: momentumMood(),
      lastActionId: state.lastActionId,
      actionStreak: state.actionStreak,
      stats: state.stats,
    },
    timeFx: timeFx
      ? {
          label: timeFx.label,
          hours: timeFx.hours,
          from: formatHour(timeFx.fromHour),
          to: formatHour(timeFx.toHour),
          daysPassed: timeFx.daysPassed,
        }
      : null,
    lastEvent: state.lastEvent,
    goals: getCareerGoals().map((goal) => ({
      label: goal.label,
      detail: goal.detail,
      value: goal.value,
      max: goal.max,
    })),
    nextUpgrade: upgrade
      ? {
          key: upgrade.key,
          label: upgrade.label,
          cost: upgradeCost(upgrade),
          affordable: state.cash >= upgradeCost(upgrade),
        }
      : null,
    actions,
    battle,
  });
}

window.render_game_to_text = renderGameToText;
window.advanceTime = (ms: number) => {
  const steps = Math.max(1, Math.round(ms / (1000 / 60)));
  for (let i = 0; i < steps; i += 1) update(1 / 60);
  render();
};

declare global {
  interface Window {
    render_game_to_text: () => string;
    advanceTime: (ms: number) => void;
  }
}

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // The game still runs without offline cache.
    });
  });
}

requestAnimationFrame(frame);
