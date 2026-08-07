import type { SocialPostOption } from "../core/types";

export const socialPostOptions: SocialPostOption[] = [
  {
    id: "video",
    label: "Video freestyle",
    detail: "Clip corto con punch y energia.",
    fans: 26,
    fame: 5,
    energy: 12,
    blocks: 1,
    rhythm: 8,
  },
  {
    id: "studio-photo",
    label: "Foto estudio",
    detail: "Muestra disciplina y proceso.",
    fans: 18,
    fame: 4,
    energy: 8,
    blocks: 1,
    rhythm: 5,
  },
  {
    id: "thought",
    label: "Frase/reflexion",
    detail: "Conecta con fans fieles.",
    fans: 13,
    fame: 2,
    energy: 5,
    blocks: 1,
    rhythm: 3,
  },
  {
    id: "behind",
    label: "Detras de escena",
    detail: "Humaniza la carrera.",
    fans: 21,
    fame: 4,
    energy: 9,
    blocks: 1,
    rhythm: 6,
  },
];
