// GENERADO por scripts/build-avatar-assets.mjs — no editar a mano.
//
// Fuente: assets/avatar/<categoria>/<id>.svg + <id>.json, dibujados contra
// assets/avatar/_template.svg. Regenerar con: npm run avatar:assets
//
// Cada asset paso el checklist §66 completo antes de aparecer aca. Los tokens de
// color del SVG quedaron convertidos en interpolaciones sobre DrawColors, que es lo
// que hace que una sola pieza sirva para todas las combinaciones de color (§44).

import type { Asset } from "../asset";

export const generatedAssets: Asset[] = [
  {
    meta: {
          "id": "hat_101",
          "name": "Bucket estampado",
          "category": "hat",
          "rarity": "rare",
          "price": 15000,
          "currency": "cash",
          "colors": [
                "fabric_primary",
                "fabric_secondary"
          ],
          "style": {
                "street": 8,
                "originality": 8
          },
          "rules": {
                "incompatible": [
                      "hair_004",
                      "hair_005"
                ]
          }
    },
    draw: (ctx) => {
      const c = ctx.colors;
      return {
      hat: `<path d="M172 96C172 60 208 36 250 36s78 24 78 60v18H172Z" fill="${c.fabric}" stroke="${c.ink}" stroke-width="6" stroke-linejoin="round"/>
    <path d="M136 100h228l-24 44H160Z" fill="${c.fabric}" stroke="${c.ink}" stroke-width="6" stroke-linejoin="round"/>
    <rect x="176" y="74" width="148" height="16" rx="8" fill="${c.fabric2}"/>`,
      };
    },
  },
  {
    meta: {
          "id": "top_101",
          "name": "Buzo oversize",
          "category": "top",
          "rarity": "uncommon",
          "price": 21000,
          "currency": "cash",
          "colors": [
                "fabric_primary",
                "fabric_secondary"
          ],
          "style": {
                "street": 9,
                "sport": 5,
                "originality": 6
          },
          "rules": {}
    },
    draw: (ctx) => {
      const c = ctx.colors;
      return {
      top: `<path d="M132 246C132 204 184 176 250 176s118 28 118 70v190c0 20-52 28-118 28s-118-8-118-28Z" fill="${c.fabric}" stroke="${c.ink}" stroke-width="6" stroke-linejoin="round"/>
    <rect x="88" y="232" width="86" height="258" rx="43" fill="${c.fabric}" stroke="${c.ink}" stroke-width="6"/>
    <rect x="326" y="232" width="86" height="258" rx="43" fill="${c.fabric}" stroke="${c.ink}" stroke-width="6"/>
    <path d="M186 180c10 46 34 66 64 66s54-20 64-66c-24-14-104-14-128 0Z" fill="${c.fabric2}" stroke="${c.ink}" stroke-width="6" stroke-linejoin="round"/>
    <rect x="192" y="330" width="116" height="66" rx="30" fill="${c.fabric2}"/>
    <path d="M228 178v58" stroke="${c.ink}" stroke-width="5" stroke-linecap="round"/>
    <path d="M272 178v58" stroke="${c.ink}" stroke-width="5" stroke-linecap="round"/>`,
      };
    },
  },
];
