import type { JobOption } from "../core/types";

export const jobOptions: JobOption[] = [
  {
    id: "delivery",
    label: "Repartidor",
    detail: "Turno rapido para pagar micros.",
    cash: 40,
    energy: 16,
    blocks: 1,
    disciplineChance: 0.35,
  },
  {
    id: "dishes",
    label: "Lavaplatos",
    detail: "Trabajo pesado, paga estable.",
    cash: 50,
    energy: 20,
    blocks: 2,
    disciplineChance: 0.55,
  },
  {
    id: "construction",
    label: "Obra",
    detail: "Mucho desgaste, mejor paga.",
    cash: 62,
    energy: 28,
    blocks: 2,
    disciplineChance: 0.75,
  },
  {
    id: "clothes-store",
    label: "Tienda de ropa",
    detail: "Contactos y algo de estilo.",
    cash: 46,
    energy: 14,
    blocks: 1,
    disciplineChance: 0.45,
  },
];
