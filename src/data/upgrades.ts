import type { UpgradeDef } from "../core/types";

export const upgrades: UpgradeDef[] = [
  {
    key: "outfit",
    label: "Outfit",
    shortLabel: "Ropa",
    color: "#e1b84a",
    baseCost: 55,
    costStep: 85,
    maxLevel: 3,
    effect: "+fans/batalla",
  },
  {
    key: "studio",
    label: "Estudio",
    shortLabel: "Studio",
    color: "#d65a8a",
    baseCost: 75,
    costStep: 115,
    maxLevel: 3,
    effect: "+temas/grabar",
  },
  {
    key: "home",
    label: "Base",
    shortLabel: "Casa",
    color: "#2fa58d",
    baseCost: 110,
    costStep: 150,
    maxLevel: 3,
    effect: "+energia/salud",
  },
];
