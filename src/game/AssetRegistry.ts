// Central asset registry (AGENTS.md: never write asset paths inline).
// Keys are what scenes reference; paths resolve against public/assets.

import type { StageId } from "../core/types";
import { layerOrder } from "../data/characterLayers";

export const AssetRegistry = {
  scenes: {
    pieza: { key: "scene-pieza", path: "/assets/scenes/pieza-home-studio-v1.png" },
    plaza: { key: "scene-plaza", path: "/assets/scenes/plaza-cypher-v1.png" },
    regional: { key: "scene-regional", path: "/assets/scenes/regional-stage-v1.png" },
    // The isometric night city of the map mockup, cut from reference/ and cleaned
    // of its baked-in UI (see scripts/build-map-city.mjs).
    mapCity: { key: "scene-map-city", path: "/assets/scenes/map-city-v1.png" },
    // The crowd seen from behind along the bottom of the battle mockup, cut and
    // feathered by scripts/build-battle-crowd.mjs.
    battleCrowd: { key: "scene-battle-crowd", path: "/assets/scenes/battle-crowd-front-v1.png" },
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
  // Props the pieza earns (Fase 12 C), cut from the advanced-room mockup by
  // scripts/build-room-props.mjs.
  room: {
    discoOro: { key: "room-disco-oro", path: "/assets/room/disco-oro.png" },
    rapToWin: { key: "room-rap-to-win", path: "/assets/room/rap-to-win.png" },
    placa100k: { key: "room-placa-100k", path: "/assets/room/placa-100k.png" },
    neonFoco: { key: "room-neon-foco", path: "/assets/room/neon-foco.png" },
    trofeos: { key: "room-trofeos", path: "/assets/room/trofeos.png" },
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
    resFame: { key: "res-fame", path: "/assets/icons/res-fame.png" },
    uiCart: { key: "ui-cart", path: "/assets/icons/ui-cart.png" },
    // Cut from the calendar mockup (06_23_14 (4)), its top-right HUD button.
    uiCalendar: { key: "ui-calendar", path: "/assets/icons/ui-calendar.png" },
    actionOffer: { key: "action-offer", path: "/assets/icons/action-offer.png" },
    battleDefensa: { key: "battle-defensa", path: "/assets/icons/battle-defensa.png" },
    battleDobletempo: { key: "battle-dobletempo", path: "/assets/icons/battle-dobletempo.png" },
    battleStorytelling: { key: "battle-storytelling", path: "/assets/icons/battle-storytelling.png" },
    battleImprovisacion: { key: "battle-improvisacion", path: "/assets/icons/battle-improvisacion.png" },
    itemInterfaz: { key: "item-interfaz", path: "/assets/icons/item-interfaz.png" },
    itemMonitores: { key: "item-monitores", path: "/assets/icons/item-monitores.png" },
    itemGorra: { key: "item-gorra", path: "/assets/icons/item-gorra.png" },
    itemZapatillas: { key: "item-zapatillas", path: "/assets/icons/item-zapatillas.png" },
    itemChaqueta: { key: "item-chaqueta", path: "/assets/icons/item-chaqueta.png" },
    itemMesa: { key: "item-mesa", path: "/assets/icons/item-mesa.png" },
    itemCuaderno: { key: "item-cuaderno", path: "/assets/icons/item-cuaderno.png" },
    itemBeatBoombap: { key: "item-beat-boombap", path: "/assets/icons/item-beat-boombap.png" },
    itemBeatTrap: { key: "item-beat-trap", path: "/assets/icons/item-beat-trap.png" },
    itemPackAcapella: { key: "item-pack-acapella", path: "/assets/icons/item-pack-acapella.png" },
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
  // A show is fame on a stage: the fame star until it has its own icon.
  show: AssetRegistry.icons.resFame.key,
  // The weekly plan's offer slot (Fase 6): the thing with a deadline.
  offer: AssetRegistry.icons.actionOffer.key,
};

export function actionIconKey(id: string): string | null {
  return actionIconKeys[id] ?? null;
}

// Battle resource id -> card icon texture key. All ten resources of the Bible
// have art now (the four missing ones were generated and processed through
// scripts/process-icon.mjs in 2026-08-13), so no card falls back to the dashed
// pending frame.
const battleChoiceIconKeys: Record<string, string> = {
  respuesta: AssetRegistry.icons.battleRespuesta.key,
  punchline: AssetRegistry.icons.battlePunchline.key,
  flow: AssetRegistry.icons.battleFlow.key,
  humor: AssetRegistry.icons.battleHumor.key,
  metrica: AssetRegistry.icons.battleMetrica.key,
  ataque: AssetRegistry.icons.battleAtaque.key,
  defensa: AssetRegistry.icons.battleDefensa.key,
  dobletempo: AssetRegistry.icons.battleDobletempo.key,
  storytelling: AssetRegistry.icons.battleStorytelling.key,
  improvisacion: AssetRegistry.icons.battleImprovisacion.key,
};

export function battleChoiceIconKey(id: string): string | null {
  return battleChoiceIconKeys[id] ?? null;
}

// The MC's sprite, sliced into recolourable materials by
// scripts/build-character-layers.mjs. Registered from the layer list rather than
// spelled out here, so adding a slice to the segmentation cannot forget to load it.
export function characterLayerKey(id: string): string {
  return `mc-layer-${id}`;
}

function characterLayerEntries(): { key: string; path: string }[] {
  return layerOrder.map((id) => ({
    key: characterLayerKey(id),
    path: `/assets/characters/layers/${id}.png`,
  }));
}

export function allAssetEntries(): { key: string; path: string }[] {
  return [
    ...Object.values(AssetRegistry.scenes),
    ...Object.values(AssetRegistry.cover),
    ...Object.values(AssetRegistry.characters),
    ...Object.values(AssetRegistry.room),
    ...characterLayerEntries(),
    ...Object.values(AssetRegistry.icons),
  ];
}

// Store item id -> icon texture key. Shared by the shop rows and the pieza,
// which shows a bought item at object scale (Fase 12 C). Two items keep the cuts
// they borrowed from the mockups, because those ARE their objects.
const ITEM_ICON_KEYS: Record<string, string> = {
  microfono: AssetRegistry.icons.battlePunchline.key,
  audifonos: AssetRegistry.icons.battleFlow.key,
  interfaz: AssetRegistry.icons.itemInterfaz.key,
  monitores: AssetRegistry.icons.itemMonitores.key,
  gorra: AssetRegistry.icons.itemGorra.key,
  zapatillas: AssetRegistry.icons.itemZapatillas.key,
  chaqueta: AssetRegistry.icons.itemChaqueta.key,
  "beat-boombap": AssetRegistry.icons.itemBeatBoombap.key,
  "beat-trap": AssetRegistry.icons.itemBeatTrap.key,
  "pack-acapella": AssetRegistry.icons.itemPackAcapella.key,
  cuaderno: AssetRegistry.icons.itemCuaderno.key,
  mesa: AssetRegistry.icons.itemMesa.key,
  colchon: AssetRegistry.icons.actionRest.key,
};

export function itemIconKey(id: string): string | null {
  return ITEM_ICON_KEYS[id] ?? null;
}

// A room prop's `art` (src/data/roomProps.ts) -> texture key: "item:<id>" reuses
// the store icon, anything else is a cut from the advanced-room mockup.
const ROOM_ART_KEYS: Record<string, string> = {
  "disco-oro": AssetRegistry.room.discoOro.key,
  "rap-to-win": AssetRegistry.room.rapToWin.key,
  "placa-100k": AssetRegistry.room.placa100k.key,
  "neon-foco": AssetRegistry.room.neonFoco.key,
  trofeos: AssetRegistry.room.trofeos.key,
};

export function roomPropKey(art: string): string | null {
  if (art.startsWith("item:")) return itemIconKey(art.slice(5));
  return ROOM_ART_KEYS[art] ?? null;
}
