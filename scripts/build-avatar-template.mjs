#!/usr/bin/env node
// Generates the master template an illustrator opens in Figma.
//
// Spec §8: "Artists must NOT manually reposition assets to match other assets. Each
// asset must align to the master avatar template." That only works if the template
// is real and current — so it is GENERATED from src/avatar/canvas.json, the same file
// the renderer reads. It cannot drift.
//
// What the file contains:
//   * the canvas at its exact size, so a Figma frame inherits it;
//   * every anchor as a labelled guide line;
//   * the default body silhouette, faint, to trace against;
//   * one named, empty group per layer of the 27 — the illustrator draws inside the
//     group whose name matches the layer, and the importer reads that name;
//   * a legend of the colour tokens with their sample values.
//
// Usage: node scripts/build-avatar-template.mjs

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import canvas from "../src/avatar/canvas.json" with { type: "json" };
import { LAYERS, LAYERS_FOR_CATEGORY } from "./avatar/validate.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(root, "assets/avatar/_template.svg");
mkdirSync(dirname(out), { recursive: true });

const { w, h } = canvas.canvas;
const cx = canvas.centerX;
const A = canvas.anchors;
const GUIDE = "#00A8C0";
const FAINT = "#C9C2B4";

// The default body, drawn faint. These proportions mirror the renderer's body_03
// metrics; they are a TRACING GUIDE, not art, and the importer ignores this group.
const B = { shoulderW: 178, waistW: 152, legW: 72, headW: 150, headH: 136 };

const guides = Object.entries(A)
  .map(([name, y]) => {
    const label = `${name} ${y}`;
    return (
      `<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="${GUIDE}" stroke-width="1" stroke-dasharray="6 5" opacity="0.55"/>` +
      `<text x="6" y="${y - 4}" font-family="monospace" font-size="10" fill="${GUIDE}">${label}</text>`
    );
  })
  .join("\n    ");

const body = `
    <rect x="${cx - B.headW / 2}" y="${A.crown}" width="${B.headW}" height="${B.headH}" rx="60" fill="${FAINT}"/>
    <rect x="${cx - 26}" y="${A.chin - 16}" width="52" height="40" rx="14" fill="${FAINT}"/>
    <path d="M${cx - B.shoulderW / 2} ${A.shoulders + 26}C${cx - B.shoulderW / 2} ${A.shoulders - 4} ${cx - B.shoulderW / 2 + 26} ${A.chin + 8} ${cx} ${A.chin + 8}C${cx + B.shoulderW / 2 - 26} ${A.chin + 8} ${cx + B.shoulderW / 2} ${A.shoulders - 4} ${cx + B.shoulderW / 2} ${A.shoulders + 26}L${cx + B.waistW / 2} ${A.hip}L${cx - B.waistW / 2} ${A.hip}Z" fill="${FAINT}"/>
    <rect x="${cx - B.shoulderW / 2 - 44}" y="${A.shoulders + 8}" width="52" height="${A.waist - A.shoulders + 40}" rx="26" fill="${FAINT}"/>
    <rect x="${cx + B.shoulderW / 2 - 8}" y="${A.shoulders + 8}" width="52" height="${A.waist - A.shoulders + 40}" rx="26" fill="${FAINT}"/>
    <rect x="${cx - 5 - B.legW}" y="${A.hip - 12}" width="${B.legW}" height="${A.ankle - A.hip + 12}" rx="36" fill="${FAINT}"/>
    <rect x="${cx + 5}" y="${A.hip - 12}" width="${B.legW}" height="${A.ankle - A.hip + 12}" rx="36" fill="${FAINT}"/>`;

// One group per layer, named exactly as the runtime layer. Empty on purpose: the
// illustrator draws inside the one they are authoring, and the importer refuses art
// that sits outside a recognised group.
const layerGroups = LAYERS.map((layer) => {
  const categories = Object.entries(LAYERS_FOR_CATEGORY)
    .filter(([, layers]) => layers.includes(layer))
    .map(([category]) => category);
  const hint = categories.length ? categories.join(", ") : "reservada";
  return `    <g id="layer-${layer}" data-layer="${layer}" data-categories="${hint}"/>`;
}).join("\n");

const SAMPLES = {
  skin_primary: "#CE9364",
  skin_shadow: "#A87049",
  hair_primary: "#151210",
  hair_secondary: "#3A2415",
  fabric_primary: "#F25C54",
  fabric_secondary: "#2E3A5C",
  metal_primary: "#FFC300",
  accent_primary: "#00E5FF",
  ink: "#12100F",
};

const legend = canvas.tokens
  .map((token, i) => {
    const y = 20 + i * 26;
    return (
      `<rect x="${w + 30}" y="${y}" width="22" height="22" fill="${SAMPLES[token] ?? "#CCC"}" stroke="#12100F" stroke-width="2"/>` +
      `<text x="${w + 60}" y="${y + 16}" font-family="monospace" font-size="12" fill="#12100F">--${token.replace(/_/g, "-")}</text>`
    );
  })
  .join("\n    ");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w + 260} ${h}" width="${w + 260}" height="${h}">
  <title>Plantilla maestra del avatar</title>
  <desc>Generada por scripts/build-avatar-template.mjs desde src/avatar/canvas.json. No editar a mano.
Como se usa:
1. Importar este SVG a Figma. El marco util es 0,0 a ${w},${h}; la columna de la derecha es la leyenda y NO se exporta.
2. Dibujar dentro del grupo cuya capa corresponde (layer-top, layer-hat, ...).
3. Pintar SOLO con los tokens de la leyenda, con la sintaxis var() de CSS. Un hex literal hace que la pieza no se pueda recolorear nunca.
4. Exportar el grupo como SVG con viewBox 0 0 ${w} ${h}, sin transform en la raiz, y guardarlo en assets/avatar/[categoria]/[id].svg con su [id].json.
5. Correr: npm run avatar:assets</desc>
  <g id="guias-plantilla" data-template="guides">
    <rect x="0" y="0" width="${w}" height="${h}" fill="#F5EFE3"/>
    <rect x="0" y="${canvas.figure.top}" width="${w}" height="${canvas.figure.height}" fill="none" stroke="${GUIDE}" stroke-width="2" opacity="0.5"/>
    <line x1="${cx}" y1="0" x2="${cx}" y2="${h}" stroke="${GUIDE}" stroke-width="1" stroke-dasharray="4 6" opacity="0.7"/>
    <line x1="${canvas.light.shadeFromX}" y1="0" x2="${canvas.light.shadeFromX}" y2="${h}" stroke="#E0A030" stroke-width="1" stroke-dasharray="2 8" opacity="0.9"/>
    <text x="${canvas.light.shadeFromX + 5}" y="${h - 8}" font-family="monospace" font-size="10" fill="#B07818">limite de luz ${canvas.light.shadeFromX}</text>
    ${guides}
  </g>
  <g id="cuerpo-referencia" data-template="body" opacity="0.5">${body}
  </g>
  <g id="capas">
${layerGroups}
  </g>
  <g id="leyenda-tokens" data-template="legend">
    <text x="${w + 30}" y="12" font-family="monospace" font-size="11" fill="#7A7266">TOKENS DE COLOR</text>
    ${legend}
    <text x="${w + 30}" y="${20 + canvas.tokens.length * 26 + 24}" font-family="monospace" font-size="11" fill="#7A7266">CUERPO POR DEFECTO</text>
    <text x="${w + 30}" y="${20 + canvas.tokens.length * 26 + 42}" font-family="monospace" font-size="12" fill="#12100F">${canvas.defaultBody}</text>
    <text x="${w + 30}" y="${20 + canvas.tokens.length * 26 + 74}" font-family="monospace" font-size="11" fill="#7A7266">REPARTO (spec §7)</text>
${Object.entries(canvas.distribution)
  .map(([part, share], i) => `    <text x="${w + 30}" y="${20 + canvas.tokens.length * 26 + 94 + i * 18}" font-family="monospace" font-size="12" fill="#12100F">${part} ${Math.round(share * 100)}%</text>`)
  .join("\n")}
  </g>
</svg>
`;

writeFileSync(out, svg);
console.log(`plantilla: ${out}`);
console.log(`  lienzo ${w}x${h}, eje x=${cx}, luz desde x=${canvas.light.shadeFromX}`);
console.log(`  ${Object.keys(A).length} anclas, ${LAYERS.length} grupos de capa, ${canvas.tokens.length} tokens`);
