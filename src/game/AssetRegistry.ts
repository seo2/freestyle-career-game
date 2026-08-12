// Central asset registry (AGENTS.md: never write asset paths inline).
// Keys are what scenes reference; paths resolve against public/assets.

import type { StageId } from "../core/types";

export const AssetRegistry = {
  scenes: {
    pieza: { key: "scene-pieza", path: "/assets/scenes/pieza-home-studio-v1.png" },
    plaza: { key: "scene-plaza", path: "/assets/scenes/plaza-cypher-v1.png" },
    regional: { key: "scene-regional", path: "/assets/scenes/regional-stage-v1.png" },
  },
  cover: {
    sky: { key: "cover-sky", path: "/assets/main-menu/bg_sky_night.png" },
    clouds: { key: "cover-clouds", path: "/assets/main-menu/bg_clouds.png" },
    cityBack: { key: "cover-city-back", path: "/assets/main-menu/bg_city_back.png" },
    cityFront: { key: "cover-city-front", path: "/assets/main-menu/bg_city_front.png" },
    rooftopFloor: { key: "cover-rooftop-floor", path: "/assets/main-menu/bg_rooftop_floor.png" },
    rooftopFence: { key: "cover-rooftop-fence", path: "/assets/main-menu/bg_rooftop_fence.png" },
    neonRap: { key: "cover-neon-rap", path: "/assets/main-menu/prop_neon_rap.png" },
    graffitiFreestyle: { key: "cover-graffiti", path: "/assets/main-menu/prop_graffiti_freestyle.png" },
    speakerLeft: { key: "cover-speaker-left", path: "/assets/main-menu/prop_speaker_left.png" },
    speakerRight: { key: "cover-speaker-right", path: "/assets/main-menu/prop_speaker_right.png" },
    logo: { key: "cover-logo", path: "/assets/main-menu/logo_freestyle_game.png" },
  },
  characters: {
    mcIdle: { key: "mc-idle", path: "/assets/characters/mc-idle.png" },
    mcBust: { key: "mc-bust", path: "/assets/characters/mc-bust.png" },
    rivalIdle: { key: "rival-idle", path: "/assets/characters/rival-idle.png" },
  },
  icons: {
    actionRest: { key: "action-rest", path: "/assets/icons/action-rest.png" },
    actionTrain: { key: "action-train", path: "/assets/icons/action-train.png" },
    actionWrite: { key: "action-write", path: "/assets/icons/action-write.png" },
    actionSocial: { key: "action-social", path: "/assets/icons/action-social.png" },
    actionExit: { key: "action-exit", path: "/assets/icons/action-exit.png" },
    resCash: { key: "res-cash", path: "/assets/icons/res-cash.png" },
    resFans: { key: "res-fans", path: "/assets/icons/res-fans.png" },
    resRespect: { key: "res-respect", path: "/assets/icons/res-respect.png" },
    battlePunchline: { key: "battle-punchline", path: "/assets/icons/battle-punchline.png" },
    battleRespuesta: { key: "battle-respuesta", path: "/assets/icons/battle-respuesta.png" },
    battleHumor: { key: "battle-humor", path: "/assets/icons/battle-humor.png" },
    battleAtaque: { key: "battle-ataque", path: "/assets/icons/battle-ataque.png" },
    battleMetrica: { key: "battle-metrica", path: "/assets/icons/battle-metrica.png" },
    battleFlow: { key: "battle-flow", path: "/assets/icons/battle-flow.png" },
  },
} as const;

// Career/battle backdrop per stage; later stages reuse the regional set until
// stage-specific art lands (Fase 3).
export function stageBackdropKey(stage: StageId): string {
  if (stage === "pieza") return AssetRegistry.scenes.pieza.key;
  if (stage === "plaza") return AssetRegistry.scenes.plaza.key;
  return AssetRegistry.scenes.regional.key;
}

// Battles never take place in the bedroom: every battle mockup shows a cypher
// circle or a stage with a crowd, and those backdrops have continuous ground so
// performers can stand anywhere (the room's floor is broken up by furniture).
// A dedicated "cypher en la pieza" backdrop is pending — see docs/ASSETS.md.
export function battleBackdropKey(stage: StageId): string {
  if (stage === "pieza" || stage === "plaza") return AssetRegistry.scenes.plaza.key;
  return AssetRegistry.scenes.regional.key;
}

// Career action id -> dock/calendar icon texture key (null when no icon cut yet).
const actionIconKeys: Record<string, string> = {
  practice: AssetRegistry.icons.actionTrain.key,
  rest: AssetRegistry.icons.actionRest.key,
  write: AssetRegistry.icons.actionWrite.key,
  social: AssetRegistry.icons.actionSocial.key,
  battle: AssetRegistry.icons.battlePunchline.key,
  work: AssetRegistry.icons.resCash.key,
  cypher: AssetRegistry.icons.battleRespuesta.key,
};

export function actionIconKey(id: string): string | null {
  return actionIconKeys[id] ?? null;
}

// Battle resource id -> card icon texture key (null when no icon cut yet).
// Pending art: battle-defensa, battle-dobletempo, battle-storytelling and
// battle-improvisacion — those cards draw the neutral framed placeholder.
const battleChoiceIconKeys: Record<string, string> = {
  respuesta: AssetRegistry.icons.battleRespuesta.key,
  punchline: AssetRegistry.icons.battlePunchline.key,
  flow: AssetRegistry.icons.battleFlow.key,
  humor: AssetRegistry.icons.battleHumor.key,
  metrica: AssetRegistry.icons.battleMetrica.key,
  ataque: AssetRegistry.icons.battleAtaque.key,
};

export function battleChoiceIconKey(id: string): string | null {
  return battleChoiceIconKeys[id] ?? null;
}

export function allAssetEntries(): { key: string; path: string }[] {
  return [
    ...Object.values(AssetRegistry.scenes),
    ...Object.values(AssetRegistry.cover),
    ...Object.values(AssetRegistry.characters),
    ...Object.values(AssetRegistry.icons),
  ];
}
