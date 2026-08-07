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
} as const;

// Career/battle backdrop per stage; later stages reuse the regional set until
// stage-specific art lands (Fase 3).
export function stageBackdropKey(stage: StageId): string {
  if (stage === "pieza") return AssetRegistry.scenes.pieza.key;
  if (stage === "plaza") return AssetRegistry.scenes.plaza.key;
  return AssetRegistry.scenes.regional.key;
}

export function allAssetEntries(): { key: string; path: string }[] {
  return [...Object.values(AssetRegistry.scenes), ...Object.values(AssetRegistry.cover)];
}
