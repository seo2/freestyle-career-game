#!/usr/bin/env node
// Preview PNGs, one per asset (spec §65 item 4, §66 "Preview generated").
//
// Each preview shows the asset ON the default body, because that is the only way to
// tell whether a garment fits — a sleeve floating on transparency looks fine right
// up until it is 20px from the arm it belongs to.
//
// Also renders a contact sheet, which is what actually gets looked at: forty PNGs in
// a folder is not a review, one sheet is.
//
// Usage: node scripts/build-avatar-previews.mjs [--out output/avatar-previews]

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import canvas from "../src/avatar/canvas.json" with { type: "json" };

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argIndex = process.argv.indexOf("--out");
const outDir = resolve(root, argIndex > 0 ? process.argv[argIndex + 1] : "output/avatar-previews");
mkdirSync(outDir, { recursive: true });

// The renderer is TypeScript, so previews are produced through the dev server the
// same way every other measurement script in this repo works — the alternative is a
// second build step that could disagree with the game.
const PORT = process.env.PORT ?? "5173";
const base = `http://localhost:${PORT}`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

try {
  await page.goto(`${base}/avatar.html`, { waitUntil: "networkidle" });
} catch {
  console.error(`No hay dev server en ${base}. Correr \`npm run dev\` primero.`);
  await browser.close();
  process.exit(1);
}

// Every item, with the asset equipped over the starter body.
const shots = await page.evaluate(async () => {
  const reg = await import("/src/avatar/registry.ts");
  const ren = await import("/src/avatar/renderer.ts");
  const ward = await import("/src/avatar/wardrobe.ts");
  const out = [];
  // A review palette, not the starter's. The starter dresses the MC in ink black
  // (fabric_primary 1) because that is what a broke first-week MC owns — and every
  // preview came out as a black slab where no shape could be read. What a reviewer
  // needs is contrast against the paper.
  const review = () => {
    const base = reg.starterConfig();
    return {
      ...base,
      appearance: { ...base.appearance, skin: "skin_03" },
      colors: { ...base.colors, fabric_primary: 7, fabric_secondary: 9, metal_primary: 0, accent_primary: 2 },
    };
  };
  for (const asset of reg.assetRegistry.all()) {
    const meta = asset.meta;
    const config = ward.withItem(review(), meta);
    const result = ren.renderAvatar(config, reg.assetRegistry);
    out.push({
      id: meta.id,
      name: meta.name,
      category: meta.category,
      rarity: meta.rarity,
      price: meta.price ?? null,
      unlock: meta.unlock?.value ?? null,
      svg: result.svg,
      conflicts: result.conflicts.length,
    });
  }
  return out;
});

const { w, h } = canvas.canvas;
const CARD_H = 260;
const CARD_W = Math.round((CARD_H * w) / h);

// One PNG per asset, from its own SVG, so a reviewer can open the piece alone.
for (const shot of shots) {
  await page.setContent(
    `<body style="margin:0;background:#F5EFE3">${shot.svg.replace("<svg ", `<svg width="${CARD_W * 2}" height="${CARD_H * 2}" `)}</body>`,
  );
  await page.locator("svg").screenshot({ path: resolve(outDir, `${shot.category}-${shot.id}.png`) });
}

// The contact sheet.
const cells = shots
  .map(
    (s) => `<div class="cell">
      <div class="art">${s.svg.replace("<svg ", `<svg width="${CARD_W}" height="${CARD_H}" `)}</div>
      <div class="id">${s.id}</div>
      <div class="name">${s.name}</div>
      <div class="meta">${s.rarity}${s.price ? ` · $${s.price.toLocaleString("es-CL")}` : ""}${s.unlock ? ` · NV ${s.unlock}` : ""}</div>
    </div>`,
  )
  .join("");

await page.setContent(`<!doctype html><meta charset="utf-8"><style>
  body{margin:0;background:#F5EFE3;font:12px/1.4 Chivo,ui-monospace,monospace;color:#12100F;padding:22px}
  h1{font-size:15px;letter-spacing:.1em;margin:0 0 18px;font-family:ui-monospace,monospace}
  .grid{display:flex;flex-wrap:wrap;gap:14px}
  .cell{width:${CARD_W + 20}px;border:3px solid #12100F;background:#EDE5D6;padding:8px}
  .art{background:#F5EFE3;border:2px solid #12100F;height:${CARD_H}px;display:flex;align-items:center;justify-content:center}
  .id{font-family:ui-monospace,monospace;font-size:9.5px;color:#7A7266;margin-top:6px;letter-spacing:.06em}
  .name{font-weight:700;font-size:11.5px}
  .meta{font-family:ui-monospace,monospace;font-size:9px;color:#7A7266}
</style><h1>PREVIEWS DE ASSETS · ${shots.length} piezas · lienzo ${w}x${h}</h1><div class="grid">${cells}</div>`);
await page.waitForTimeout(400);
await page.screenshot({ path: resolve(outDir, "_contact-sheet.png"), fullPage: true });

const conflicted = shots.filter((s) => s.conflicts > 0);
writeFileSync(
  resolve(outDir, "_index.json"),
  JSON.stringify({ canvas: canvas.canvas, count: shots.length, assets: shots.map(({ svg: _svg, ...rest }) => rest) }, null, 2),
);

console.log(`${shots.length} previews -> ${outDir}`);
console.log(`  hoja de contacto: ${resolve(outDir, "_contact-sheet.png")}`);
if (conflicted.length) {
  // Not a failure: some pieces genuinely conflict with the starter look (a beanie
  // over the default fade is fine, a beanie over an afro is not). Worth saying out
  // loud so a reviewer knows the preview is showing a resolved stack.
  console.log(`  ${conflicted.length} pieza(s) chocaron con el look base: ${conflicted.map((s) => s.id).join(", ")}`);
}
if (errors.length) {
  console.error(`consola con ${errors.length} error(es): ${errors.join(" | ")}`);
  await browser.close();
  process.exit(1);
}
await browser.close();
