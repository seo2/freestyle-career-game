// The QA checklist of spec §66, as code.
//
// The spec ships it as sixteen checkboxes for a human to tick. A checklist a human
// ticks is a checklist nobody ticks by asset forty, so here it is as functions that
// fail the build instead.
//
// Plain .mjs and not .ts on purpose: the pipeline scripts run under bare node, and
// vitest imports this file directly, so the rules are tested without adding a
// TypeScript runner to the project's dependencies.

import canvas from "../../src/avatar/canvas.json" with { type: "json" };

// The 27 layers, mirrored from src/avatar/layers.ts. Duplicated deliberately and
// guarded by a test that compares the two lists: the alternative is a TS import,
// which would drag a transpiler into the build scripts.
export const LAYERS = [
  "shadow", "back_accessories", "back_hair", "legs", "socks", "shoes", "body",
  "tattoos_body", "bottom", "top", "jacket", "neck", "head", "ears", "face",
  "eyes", "eyebrows", "nose", "mouth", "facial_hair", "front_hair", "glasses",
  "hat", "necklace", "front_accessories", "props", "effects",
];

export const CATEGORIES = [
  "body", "skin", "face", "eyes", "eyebrows", "nose", "mouth", "hair",
  "facial_hair", "tattoo", "piercing", "top", "jacket", "bottom", "socks",
  "shoes", "hat", "glasses", "jewelry", "accessory", "prop", "effect",
];

export const RARITIES = ["common", "uncommon", "rare", "epic", "legendary", "iconic"];

export const UNLOCK_TYPES = [
  "purchase", "battle_reward", "battle_wins", "mission_reward", "event_reward",
  "achievement", "career_level", "fame_level", "story", "album", "tour",
  "special_event",
];

export const TOKENS = canvas.tokens;
export const CANVAS = canvas.canvas;

// A finding, not a thrown error: one bad asset should report ALL its problems in one
// pass, so an illustrator gets a full list instead of fixing them one build at a time.
const fail = (check, message) => ({ level: "error", check, message });
const warn = (check, message) => ({ level: "warn", check, message });

// --- individual checks ------------------------------------------------------

// §66 "Correct canvas". A viewBox that is not the master template's means every
// coordinate inside the file is meaningless.
export function checkCanvas(svg) {
  const match = /viewBox\s*=\s*"([^"]+)"/.exec(svg);
  if (!match) return [fail("canvas", "falta viewBox")];
  const parts = match[1].trim().split(/[\s,]+/).map(Number);
  if (parts.length !== 4 || parts.some(Number.isNaN)) {
    return [fail("canvas", `viewBox ilegible: "${match[1]}"`)];
  }
  const [x, y, w, h] = parts;
  const out = [];
  if (x !== 0 || y !== 0) out.push(fail("canvas", `viewBox debe partir en 0 0, viene "${match[1]}"`));
  if (w !== CANVAS.w || h !== CANVAS.h) {
    out.push(fail("canvas", `viewBox debe ser 0 0 ${CANVAS.w} ${CANVAS.h}, viene "${match[1]}"`));
  }
  return out;
}

// §66 "Correct coordinate system". A transform on the root undoes the whole point of
// a shared template: the asset would sit somewhere the renderer cannot predict.
export function checkNoRootTransform(svg) {
  const root = /<svg\b[^>]*>/.exec(svg);
  if (!root) return [fail("coords", "no es un SVG")];
  if (/\btransform\s*=/.test(root[0])) {
    return [fail("coords", "el <svg> no puede llevar transform: reposiciona el arte en Figma")];
  }
  return [];
}

// §66 "No unnecessary raster images", and §42 "Avoid embedding raster images inside
// SVG unless explicitly approved". A base64 PNG inside an SVG defeats every reason
// the spec chose vector.
export function checkNoRaster(svg) {
  const out = [];
  if (/<image\b/i.test(svg)) out.push(fail("raster", "contiene <image>: el arte debe ser vectorial"));
  if (/data:image\/(png|jpe?g|gif|webp)/i.test(svg)) {
    out.push(fail("raster", "contiene un bitmap embebido en data: URI"));
  }
  return out;
}

// §66 "Valid SVG". Not a full parse — a cheap structural check that catches the
// failures a Figma export actually produces.
export function checkWellFormed(svg) {
  const out = [];
  if (!/<svg[\s>]/.test(svg) || !/<\/svg>/.test(svg)) out.push(fail("svg", "falta <svg> o </svg>"));
  if (/<script\b/i.test(svg)) out.push(fail("svg", "contiene <script>: un asset no ejecuta codigo"));
  // XML forbids "--" inside a comment, and a token like var(--fabric-primary) pasted
  // into an explanatory comment produces a file every parser rejects. Found the hard
  // way generating our own template.
  for (const comment of svg.matchAll(/<!--([\s\S]*?)-->/g)) {
    if (comment[1].includes("--")) {
      out.push(fail("svg", 'un comentario XML no puede contener "--": mueve el texto a <desc>'));
      break;
    }
  }
  const opens = (svg.match(/<g\b/g) ?? []).length;
  const closes = (svg.match(/<\/g>/g) ?? []).length;
  if (opens !== closes) out.push(fail("svg", `grupos desbalanceados: ${opens} <g> contra ${closes} </g>`));
  return out;
}

// §43/§44 colour tokens. Every fill and stroke has to be a token, `none`, or one of
// the two literals a drawing legitimately needs: pure white for a highlight and
// currentColor. A raw hex means that asset can never be recoloured, which is the one
// thing the whole token system exists to prevent.
const ALLOWED_LITERALS = ["none", "currentcolor", "#fff", "#ffffff", "white", "transparent"];

export function checkTokens(svg) {
  const out = [];
  const seen = new Set();
  for (const m of svg.matchAll(/(?:fill|stroke)\s*=\s*"([^"]*)"/g)) {
    const raw = m[1].trim();
    const value = raw.toLowerCase();
    if (value === "" || ALLOWED_LITERALS.includes(value)) continue;
    const token = /^var\(--([a-z0-9_-]+)\)$/.exec(value);
    if (token) {
      const name = token[1].replace(/-/g, "_");
      if (!TOKENS.includes(name)) out.push(fail("tokens", `token desconocido: --${token[1]}`));
      else seen.add(name);
      continue;
    }
    if (value.startsWith("url(")) {
      out.push(fail("tokens", `referencia a un paint server (${raw}): sin degradados ni patrones`));
      continue;
    }
    out.push(fail("tokens", `color literal "${raw}": usa var(--fabric-primary) o el token que corresponda`));
  }
  if (/(fill|stroke)-opacity\s*=\s*"0(\.0+)?"/.test(svg)) {
    out.push(warn("tokens", "hay formas con opacidad 0: arte invisible que igual pesa"));
  }
  return { findings: out, tokens: [...seen] };
}

// §66 "Correct layer position". The asset says which of the 27 layers it paints, and
// the layer has to be one a category is allowed to use — a hat in `legs` would draw
// behind the trousers.
export const LAYERS_FOR_CATEGORY = {
  body: ["legs", "body", "neck", "head", "ears"],
  skin: [],
  face: ["face"],
  eyes: ["eyes"],
  eyebrows: ["eyebrows"],
  nose: ["nose"],
  mouth: ["mouth"],
  hair: ["back_hair", "front_hair"],
  facial_hair: ["facial_hair"],
  tattoo: ["tattoos_body"],
  piercing: ["front_accessories"],
  top: ["top"],
  jacket: ["jacket"],
  bottom: ["bottom"],
  socks: ["socks"],
  shoes: ["shoes"],
  hat: ["hat"],
  glasses: ["glasses"],
  jewelry: ["necklace"],
  accessory: ["back_accessories", "front_accessories"],
  prop: ["props"],
  effect: ["effects"],
};

// §29/§30 naming and ids, §31 metadata, §33 rarity, §34 unlocks.
export function checkMetadata(id, meta) {
  const out = [];
  if (!meta || typeof meta !== "object") return [fail("metadata", "falta el .json del asset")];

  if (meta.id !== id) out.push(fail("naming", `el id del json ("${meta.id}") no calza con el archivo ("${id}")`));
  if (!/^[a-z0-9_]+$/.test(id)) out.push(fail("naming", `el id debe ser minusculas, numeros y _: "${id}"`));
  if (typeof meta.name !== "string" || meta.name.trim() === "") out.push(fail("metadata", "falta name"));

  if (!CATEGORIES.includes(meta.category)) {
    out.push(fail("category", `categoria desconocida: "${meta.category}"`));
  }
  if (!RARITIES.includes(meta.rarity)) out.push(fail("rarity", `rareza desconocida: "${meta.rarity}"`));

  const allowed = LAYERS_FOR_CATEGORY[meta.category] ?? [];
  const layers = Object.keys(meta.layers ?? {});
  if (layers.length === 0) out.push(fail("layer", "el asset no declara en que capa pinta"));
  for (const layer of layers) {
    if (!LAYERS.includes(layer)) out.push(fail("layer", `capa desconocida: "${layer}"`));
    else if (allowed.length && !allowed.includes(layer)) {
      out.push(fail("layer", `un asset de "${meta.category}" no puede pintar en "${layer}" (permitidas: ${allowed.join(", ")})`));
    }
  }

  // §34: a price and an unlock mean different things, and the shop's copy depends on
  // telling them apart. Both together is legal (the design's limited-edition shoe)
  // but a price of 0 is a free item pretending to be sold.
  if (meta.price !== undefined) {
    if (typeof meta.price !== "number" || !Number.isFinite(meta.price) || meta.price <= 0) {
      out.push(fail("price", `precio invalido: ${meta.price}`));
    }
    if (meta.currency !== undefined && typeof meta.currency !== "string") {
      out.push(fail("price", "currency debe ser el id de una moneda"));
    }
  }
  if (meta.unlock !== undefined) {
    if (!UNLOCK_TYPES.includes(meta.unlock.type)) {
      out.push(fail("unlock", `tipo de desbloqueo desconocido: "${meta.unlock.type}"`));
    }
    const needsValue = ["career_level", "fame_level", "battle_wins"];
    if (needsValue.includes(meta.unlock.type) && typeof meta.unlock.value !== "number") {
      out.push(fail("unlock", `"${meta.unlock.type}" necesita un value numerico`));
    }
  }

  // §3: likeness is never sold. The rule is a product decision, so it belongs in the
  // validator and not in a code review someone might skip.
  const APPEARANCE = ["body", "skin", "face", "eyes", "eyebrows", "nose", "mouth"];
  if (APPEARANCE.includes(meta.category) && meta.price !== undefined) {
    out.push(fail("price", `"${meta.category}" es parecido fisico y nunca se cobra (spec §3)`));
  }

  // §45: rules are data. An empty object is fine; a string is a mistake.
  if (meta.rules !== undefined) {
    if (typeof meta.rules !== "object" || Array.isArray(meta.rules)) {
      out.push(fail("rules", "rules debe ser un objeto"));
    } else {
      for (const key of Object.keys(meta.rules)) {
        if (!["incompatible", "requires", "replaces"].includes(key)) {
          out.push(fail("rules", `regla desconocida: "${key}"`));
        }
      }
    }
  }

  if (meta.colors !== undefined) {
    for (const token of meta.colors) {
      if (!TOKENS.includes(token)) out.push(fail("tokens", `token declarado desconocido: "${token}"`));
    }
  }
  return out;
}

// Every id an asset's rules point at has to exist. A rule against a retired id is
// silently dead, which is worse than a broken one.
export function checkCrossReferences(assets) {
  const out = [];
  const ids = new Set(assets.map((a) => a.id));
  for (const asset of assets) {
    for (const key of ["incompatible", "requires"]) {
      for (const ref of asset.meta.rules?.[key] ?? []) {
        if (!ids.has(ref)) {
          out.push({ id: asset.id, ...fail("rules", `rules.${key} apunta a "${ref}", que no existe`) });
        }
      }
    }
  }
  return out;
}

// What the asset declared vs what its markup actually uses. Declaring a token you do
// not use is untidy; USING one you did not declare means the creator will not offer
// the player that colour, and the asset silently renders with a default.
export function checkTokenAgreement(meta, usedTokens) {
  const out = [];
  const declared = new Set(meta.colors ?? []);
  for (const token of usedTokens) {
    if (!declared.has(token) && token !== "ink" && token !== "skin_shadow") {
      out.push(fail("tokens", `usa --${token.replace(/_/g, "-")} pero no lo declara en colors`));
    }
  }
  for (const token of declared) {
    if (!usedTokens.includes(token)) out.push(warn("tokens", `declara ${token} y no lo usa`));
  }
  return out;
}

// --- the whole checklist for one asset --------------------------------------
export function validateAsset({ id, svg, meta }) {
  const findings = [
    ...checkWellFormed(svg),
    ...checkCanvas(svg),
    ...checkNoRootTransform(svg),
    ...checkNoRaster(svg),
    ...checkMetadata(id, meta),
  ];
  const tokens = checkTokens(svg);
  findings.push(...tokens.findings);
  if (meta && typeof meta === "object") findings.push(...checkTokenAgreement(meta, tokens.tokens));
  return { id, findings, tokens: tokens.tokens };
}

export const hasErrors = (findings) => findings.some((f) => f.level === "error");
