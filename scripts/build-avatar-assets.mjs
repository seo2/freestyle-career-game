#!/usr/bin/env node
// Imports illustrator-authored SVG assets into the runtime (spec §64 pipeline,
// steps "Master template validation" through "Import").
//
// Input:  assets/avatar/<category>/<id>.svg  +  assets/avatar/<category>/<id>.json
// Output: src/avatar/assets/generated.ts
//
// The whole §66 QA checklist runs first and NOTHING is emitted if any asset fails.
// A partial import is worse than none: the game would boot with a wardrobe that is
// missing pieces for reasons nobody wrote down.
//
// Usage: node scripts/build-avatar-assets.mjs [--quiet]

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import canvas from "../src/avatar/canvas.json" with { type: "json" };
import { CATEGORIES, checkCrossReferences, hasErrors, validateAsset } from "./avatar/validate.mjs";
import { codeAuthoredIds } from "./avatar/knownIds.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const assetsDir = resolve(root, "assets/avatar");
const outFile = resolve(root, "src/avatar/assets/generated.ts");
const quiet = process.argv.includes("--quiet");

// A token in the art becomes a field of DrawColors at render time. This map is the
// bridge between what an illustrator types and what the renderer resolves.
const TOKEN_TO_COLOR = {
  skin_primary: "skin",
  skin_shadow: "skinShade",
  hair_primary: "hair",
  hair_secondary: "hairShade",
  fabric_primary: "fabric",
  fabric_secondary: "fabric2",
  metal_primary: "metal",
  accent_primary: "accent",
  ink: "ink",
};

function collect() {
  if (!existsSync(assetsDir)) return [];
  const found = [];
  for (const category of readdirSync(assetsDir, { withFileTypes: true })) {
    if (!category.isDirectory()) continue;
    if (!CATEGORIES.includes(category.name)) {
      console.error(`AVISO: assets/avatar/${category.name}/ no es una categoria conocida, se ignora`);
      continue;
    }
    const dir = join(assetsDir, category.name);
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".svg") || file.startsWith("_")) continue;
      const id = file.slice(0, -4);
      const jsonPath = join(dir, `${id}.json`);
      found.push({
        id,
        dirCategory: category.name,
        svg: readFileSync(join(dir, file), "utf8"),
        meta: existsSync(jsonPath) ? JSON.parse(readFileSync(jsonPath, "utf8")) : null,
      });
    }
  }
  return found.sort((a, b) => a.id.localeCompare(b.id));
}

// Pulls the markup out of each `data-layer` group. Everything outside one is an
// error, not a silent drop: art the illustrator drew and the game never shows is the
// worst possible outcome of an import.
function extractLayers(svg) {
  const layers = {};
  const stray = [];
  const groups = [...svg.matchAll(/<g\b([^>]*?)data-layer\s*=\s*"([a-z_]+)"([^>]*)>([\s\S]*?)<\/g>/g)];
  for (const g of groups) {
    const layer = g[2];
    const inner = g[4].trim();
    if (inner === "") continue;
    layers[layer] = (layers[layer] ?? "") + inner;
  }
  // What is left after removing the whole layer block, the defs and the template's
  // own guide groups. Anything with a fill is real art in the wrong place.
  let rest = svg;
  for (const g of groups) rest = rest.replace(g[0], "");
  rest = rest
    .replace(/<svg\b[^>]*>|<\/svg>/g, "")
    .replace(/<(title|desc|defs|style|metadata)\b[\s\S]*?<\/\1>/g, "")
    .replace(/<g\b[^>]*data-template="[^"]*"[\s\S]*?<\/g>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim();
  if (/<(path|rect|circle|ellipse|polygon|polyline|line|g|use)\b/.test(rest)) {
    stray.push("hay formas fuera de un grupo data-layer: el importador no sabe en que capa van");
  }
  return { layers, stray };
}

// Turns `var(--fabric-primary)` into `${c.fabric}` so the emitted module is a
// template literal the renderer fills per look. This is the whole reason one asset
// serves every colourway (§44).
function toTemplate(markup) {
  const escaped = markup.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
  return escaped.replace(/var\(--([a-z0-9-]+)\)/g, (_, raw) => {
    const token = raw.replace(/-/g, "_");
    const field = TOKEN_TO_COLOR[token];
    return field ? `\${c.${field}}` : "#FF00FF";
  });
}

const assets = collect();
if (assets.length === 0) {
  if (!quiet) {
    console.log("no hay assets en assets/avatar/<categoria>/. Nada que importar.");
    console.log("La plantilla para dibujarlos: assets/avatar/_template.svg (npm run avatar:template)");
  }
  // Emit an empty module so the import in registry.ts always resolves.
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(
    outFile,
    `// GENERADO por scripts/build-avatar-assets.mjs — no editar a mano.\n` +
      `// Sin assets en assets/avatar/. Ver docs/AVATAR-PIPELINE.md.\n\n` +
      `import type { Asset } from "../asset";\n\nexport const generatedAssets: Asset[] = [];\n`,
  );
  process.exit(0);
}

let failed = 0;
const ok = [];
for (const asset of assets) {
  const result = validateAsset(asset);
  const { layers, stray } = extractLayers(asset.svg);
  const findings = [...result.findings, ...stray.map((m) => ({ level: "error", check: "layer", message: m }))];

  // The folder has to agree with the metadata: a top filed under hats is a bug that
  // only shows up as a garment drawing at the wrong height.
  if (asset.meta && asset.meta.category !== asset.dirCategory) {
    findings.push({
      level: "error",
      check: "category",
      message: `esta en assets/avatar/${asset.dirCategory}/ pero su category es "${asset.meta.category}"`,
    });
  }
  // What the metadata declared it paints has to be what the file actually paints.
  for (const layer of Object.keys(asset.meta?.layers ?? {})) {
    if (!layers[layer]) {
      findings.push({ level: "error", check: "layer", message: `declara la capa "${layer}" y no dibuja nada ahi` });
    }
  }
  for (const layer of Object.keys(layers)) {
    if (!(layer in (asset.meta?.layers ?? {}))) {
      findings.push({ level: "error", check: "layer", message: `dibuja en "${layer}" sin declararlo en layers` });
    }
  }

  const bad = hasErrors(findings);
  if (bad) failed += 1;
  if (!quiet || bad) {
    const mark = bad ? "FALLA" : findings.length ? "avisa" : "ok   ";
    console.log(`${mark} ${asset.id}`);
    for (const f of findings) console.log(`        ${f.level === "error" ? "·" : "~"} [${f.check}] ${f.message}`);
  }
  if (!bad) ok.push({ ...asset, layers });
}

// Against the FULL id space, not just this batch: a rule may legitimately point at
// an asset authored in code (src/avatar/assets/*.ts).
const existing = codeAuthoredIds().map((id) => ({ id, meta: { rules: {} } }));
const crossFindings = checkCrossReferences([...existing, ...ok]);
for (const f of crossFindings) {
  console.log(`FALLA ${f.id}\n        · [${f.check}] ${f.message}`);
}
if (failed > 0 || crossFindings.length > 0) {
  console.error(`\n${failed + crossFindings.length} asset(s) no pasan el checklist §66. No se emitio nada.`);
  process.exit(1);
}

const body = ok
  .map((asset) => {
    const layers = Object.entries(asset.layers)
      .map(([layer, markup]) => `      ${layer}: \`${toTemplate(markup)}\`,`)
      .join("\n");
    return `  {
    meta: ${JSON.stringify(stripLayers(asset.meta), null, 6).replace(/\n/g, "\n    ")},
    draw: (ctx) => {
      const c = ctx.colors;
      return {
${layers}
      };
    },
  },`;
  })
  .join("\n");

function stripLayers(meta) {
  const { layers: _layers, ...rest } = meta;
  return rest;
}

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(
  outFile,
  `// GENERADO por scripts/build-avatar-assets.mjs — no editar a mano.
//
// Fuente: assets/avatar/<categoria>/<id>.svg + <id>.json, dibujados contra
// assets/avatar/_template.svg. Regenerar con: npm run avatar:assets
//
// Cada asset paso el checklist §66 completo antes de aparecer aca. Los tokens de
// color del SVG quedaron convertidos en interpolaciones sobre DrawColors, que es lo
// que hace que una sola pieza sirva para todas las combinaciones de color (§44).

import type { Asset } from "../asset";

export const generatedAssets: Asset[] = [
${body}
];
`,
);

if (!quiet) {
  console.log(`\n${ok.length} asset(s) importados -> src/avatar/assets/generated.ts`);
  console.log(`  lienzo ${canvas.canvas.w}x${canvas.canvas.h}, cuerpo por defecto ${canvas.defaultBody}`);
}
