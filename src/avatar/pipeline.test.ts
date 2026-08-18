// Tests for the asset pipeline's validator (scripts/avatar/validate.mjs).
//
// The validator IS the §66 QA checklist. If it is wrong, bad art passes and the
// checklist is theatre — so it gets the same treatment as the renderer.

import { describe, expect, it } from "vitest";
import {
  LAYERS,
  LAYERS_FOR_CATEGORY,
  checkCanvas,
  checkCrossReferences,
  checkMetadata,
  checkNoRaster,
  checkNoRootTransform,
  checkTokenAgreement,
  checkTokens,
  checkWellFormed,
  hasErrors,
  validateAsset,
} from "../../scripts/avatar/validate.mjs";
import { layerOrder, layersForCategory } from "./layers";
import { paletteFor } from "./palettes";
import { CANVAS } from "./canvas";
import { codeAuthoredIds } from "../../scripts/avatar/knownIds.mjs";
import type { Finding } from "../../scripts/avatar/validate.mjs";
import { assetRegistry } from "./registry";
import { generatedAssets } from "./assets/generated";

const good = (body = '<path d="M10 10h20v20h-20Z" fill="var(--fabric-primary)"/>'): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS.w} ${CANVAS.h}" fill="none">${body}</svg>`;

const meta = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: "top_099",
  name: "Polera de prueba",
  category: "top",
  rarity: "common",
  layers: { top: true },
  colors: ["fabric_primary"],
  ...over,
});

// The validator duplicates the layer list and the category map so the build scripts
// can run under bare node. Duplication is only safe if something checks it.
describe("the validator agrees with the runtime", () => {
  it("carries the same 27 layers, in the same order", () => {
    expect(LAYERS).toEqual([...layerOrder]);
  });

  it("carries the same category-to-layer map", () => {
    for (const [category, layers] of Object.entries(LAYERS_FOR_CATEGORY)) {
      expect(layers, category).toEqual([...(layersForCategory as Record<string, readonly string[]>)[category]]);
    }
    expect(Object.keys(LAYERS_FOR_CATEGORY).sort()).toEqual(Object.keys(layersForCategory).sort());
  });

  it("knows the same colour tokens the palettes resolve", async () => {
    const { TOKENS } = await import("../../scripts/avatar/validate.mjs");
    expect([...TOKENS].sort()).toEqual(Object.keys(paletteFor).sort());
  });
});

describe("§66 correct canvas", () => {
  it("accepts the master template's viewBox", () => {
    expect(checkCanvas(good())).toEqual([]);
  });

  it("rejects a different size, which makes every coordinate meaningless", () => {
    const wrong = `<svg viewBox="0 0 280 280"></svg>`;
    expect(checkCanvas(wrong)[0].message).toContain(`0 0 ${CANVAS.w} ${CANVAS.h}`);
  });

  it("rejects an offset origin", () => {
    expect(checkCanvas(`<svg viewBox="10 0 500 800"></svg>`)[0].message).toContain("partir en 0 0");
  });

  it("rejects a missing viewBox", () => {
    expect(checkCanvas(`<svg width="500"></svg>`)[0].message).toContain("falta viewBox");
  });
});

describe("§8 the coordinate system is not negotiable", () => {
  it("refuses a transform on the root, which would move the art unpredictably", () => {
    const shifted = `<svg viewBox="0 0 500 800" transform="translate(12,0)"></svg>`;
    expect(checkNoRootTransform(shifted)[0].message).toContain("transform");
  });

  it("allows transforms on inner groups, which Figma emits normally", () => {
    expect(checkNoRootTransform(good('<g transform="translate(4,4)"></g>'))).toEqual([]);
  });
});

describe("§42/§66 vector only", () => {
  it("rejects an <image> tag", () => {
    expect(checkNoRaster(good('<image href="x.png"/>'))[0].message).toContain("<image>");
  });

  it("rejects a bitmap smuggled in as a data URI", () => {
    expect(checkNoRaster(good('<path fill="url(#p)"/><pattern><image href="data:image/png;base64,AAA"/></pattern>')).length).toBeGreaterThan(0);
  });

  it("rejects a script tag", () => {
    expect(checkWellFormed(good("<script>alert(1)</script>"))[0].message).toContain("<script>");
  });

  it("catches unbalanced groups, the classic broken export", () => {
    expect(checkWellFormed(good("<g><g></g>"))[0].message).toContain("desbalanceados");
  });
});

describe("§43/§44 colours are tokens, never literals", () => {
  it("accepts a token", () => {
    const out = checkTokens(good());
    expect(out.findings).toEqual([]);
    expect(out.tokens).toEqual(["fabric_primary"]);
  });

  it("rejects a raw hex, because that asset could never be recoloured", () => {
    const out = checkTokens(good('<path fill="#F25C54"/>'));
    expect(out.findings[0].message).toContain("#F25C54");
  });

  it("rejects an unknown token", () => {
    const out = checkTokens(good('<path fill="var(--sparkle)"/>'));
    expect(out.findings[0].message).toContain("--sparkle");
  });

  it("rejects gradients and patterns", () => {
    const out = checkTokens(good('<path fill="url(#grad)"/>'));
    expect(out.findings[0].message).toContain("paint server");
  });

  it("allows none, white and currentColor, which a drawing legitimately needs", () => {
    const out = checkTokens(good('<path fill="none" stroke="#fff"/><path fill="currentColor"/>'));
    expect(out.findings).toEqual([]);
  });

  it("flags art that uses a token it never declared", () => {
    // The failure mode is silent: the creator would not offer that colour and the
    // asset renders with a default, which looks like an art bug and is a data bug.
    const findings = checkTokenAgreement(meta({ colors: [] }), ["fabric_primary"]);
    expect(findings[0].message).toContain("no lo declara");
  });

  it("only warns about a declared token that goes unused", () => {
    const findings = checkTokenAgreement(meta({ colors: ["fabric_primary", "metal_primary"] }), ["fabric_primary"]);
    expect(findings).toHaveLength(1);
    expect(findings[0].level).toBe("warn");
  });
});

describe("§29–§34 metadata", () => {
  it("accepts a well-formed item", () => {
    expect(checkMetadata("top_099", meta())).toEqual([]);
  });

  it("requires the json id to match the filename", () => {
    expect(checkMetadata("top_100", meta())[0].message).toContain("no calza");
  });

  it("requires a machine-readable id", () => {
    expect(checkMetadata("Top-99", meta({ id: "Top-99" }))[0].message).toContain("minusculas");
  });

  it("refuses a layer the category is not allowed to paint", () => {
    // A hat in `legs` would draw behind the trousers. The layer map is the contract.
    const findings = checkMetadata("hat_099", meta({ id: "hat_099", category: "hat", layers: { legs: true } }));
    expect(findings.some((f: Finding) => f.message.includes("no puede pintar"))).toBe(true);
  });

  it("requires the asset to say where it paints at all", () => {
    expect(checkMetadata("top_099", meta({ layers: {} }))[0].message).toContain("en que capa");
  });

  it("refuses to let likeness carry a price (§3)", () => {
    const findings = checkMetadata("face_099", meta({ id: "face_099", category: "face", layers: { face: true }, price: 5000, colors: [] }));
    expect(findings.some((f: Finding) => f.message.includes("parecido fisico"))).toBe(true);
  });

  it("rejects a price of zero, which is a free item pretending to be sold", () => {
    expect(checkMetadata("top_099", meta({ price: 0 }))[0].check).toBe("price");
  });

  it("requires a value on the unlocks that need one", () => {
    const findings = checkMetadata("top_099", meta({ unlock: { type: "career_level" } }));
    expect(findings[0].message).toContain("value numerico");
  });

  it("accepts an unlock that needs no value", () => {
    expect(checkMetadata("top_099", meta({ unlock: { type: "story" } }))).toEqual([]);
  });

  it("rejects an unknown rule key, so a typo cannot become a dead rule", () => {
    const findings = checkMetadata("top_099", meta({ rules: { incompatibles: ["hair_004"] } }));
    expect(findings[0].message).toContain("incompatibles");
  });
});

describe("cross-references", () => {
  it("catches a rule pointing at an id that does not exist", () => {
    const assets = [
      { id: "hat_099", meta: meta({ id: "hat_099", rules: { incompatible: ["hair_999"] } }) },
      { id: "top_099", meta: meta() },
    ];
    const findings = checkCrossReferences(assets);
    expect(findings[0].message).toContain("hair_999");
  });

  it("passes when every reference resolves", () => {
    const assets = [
      { id: "hat_099", meta: meta({ id: "hat_099", rules: { incompatible: ["top_099"] } }) },
      { id: "top_099", meta: meta() },
    ];
    expect(checkCrossReferences(assets)).toEqual([]);
  });
});

describe("the whole checklist at once", () => {
  it("passes a good asset", () => {
    const result = validateAsset({ id: "top_099", svg: good(), meta: meta() });
    expect(hasErrors(result.findings), JSON.stringify(result.findings)).toBe(false);
  });

  it("reports EVERY problem in one pass, not the first one", () => {
    // An illustrator should get the full list, not fix them one build at a time.
    const bad = `<svg viewBox="0 0 280 280" transform="scale(2)"><image href="x.png"/><path fill="#000"/></svg>`;
    const result = validateAsset({ id: "Bad-One", svg: bad, meta: null });
    const checks = new Set(result.findings.map((f: Finding) => f.check));
    expect(checks.has("canvas")).toBe(true);
    expect(checks.has("coords")).toBe(true);
    expect(checks.has("raster")).toBe(true);
    expect(checks.has("tokens")).toBe(true);
    expect(checks.has("metadata")).toBe(true);
    expect(result.findings.length).toBeGreaterThan(4);
  });
});


// scripts/avatar/knownIds.mjs reads ids with a regex over source, which the pipeline
// needs so an imported rule can point at a code-authored asset. A regex over source
// is fragile, and this is the test that makes it safe: if the two lists diverge, the
// cross-reference check starts reporting live rules as dangling.
describe("the pipeline sees every code-authored id", () => {
  it("extracts exactly the ids the registry actually has", () => {
    const fromRegex = new Set(codeAuthoredIds());
    const generated = new Set(generatedAssets.map((a) => a.meta.id));
    const fromRegistry = assetRegistry
      .all()
      .map((a) => a.meta.id)
      .filter((id) => !generated.has(id));

    const missing = fromRegistry.filter((id) => !fromRegex.has(id));
    expect(missing, "el regex de knownIds.mjs no ve estos ids").toEqual([]);
  });

  it("also sees the skin tones, which draw nothing but can still be referenced", () => {
    const fromRegex = new Set(codeAuthoredIds());
    for (const tone of assetRegistry.itemsOf("skin")) expect(fromRegex.has(tone.id), tone.id).toBe(true);
  });
});

describe("imported assets land in the runtime", () => {
  it("registers every generated asset under its own id", () => {
    for (const asset of generatedAssets) {
      expect(assetRegistry.meta(asset.meta.id), asset.meta.id).toBeDefined();
    }
  });

  it("substitutes colour tokens instead of baking a hex", () => {
    // The point of §44: one asset, every colourway. If the generated markup still
    // carried a literal, the piece could never be recoloured.
    for (const asset of generatedAssets) {
      const drawn = asset.draw({
        body: { shoulderW: 178, waistW: 152, lift: 0, legW: 72, headW: 150, headH: 136, headR: "50%" },
        colors: {
          skin: "#111111", skinShade: "#222222", hair: "#333333", hairShade: "#444444",
          fabric: "#SENTINEL", fabricShade: "#555555", fabric2: "#666666",
          metal: "#777777", accent: "#888888", ink: "#999999",
        },
        y: { crown: 60 },
        cx: 250,
      });
      const markup = Object.values(drawn).join("");
      expect(markup, asset.meta.id).toContain("#SENTINEL");
      expect(markup, asset.meta.id).not.toContain("var(--");
    }
  });
});
