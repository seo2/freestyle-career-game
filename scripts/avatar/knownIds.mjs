// Every asset id the runtime already knows, read out of src/avatar/assets/*.ts.
//
// The pipeline needs this because the id space is ONE space: a hat imported from
// Figma may declare `incompatible: ["hair_004"]`, and hair_004 is authored in code.
// Checking an imported batch only against itself reported a live rule as dangling.
//
// It is a regex over source, which is fragile — so src/avatar/pipeline.test.ts
// compares this list against the registry's real ids and fails if they diverge.
// That test is what makes the shortcut safe; without it this would be a time bomb.

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const codeAssetsDir = resolve(here, "../../src/avatar/assets");

// Ids look like `top_001`, `skin_03`, `tattoo_arm_002`: lowercase words joined by
// underscores, ending in digits.
const ID = /"([a-z][a-z0-9]*(?:_[a-z0-9]+)*_\d+)"/g;

export function codeAuthoredIds() {
  const ids = new Set();
  for (const file of readdirSync(codeAssetsDir)) {
    if (!file.endsWith(".ts") || file === "generated.ts" || file.endsWith(".test.ts")) continue;
    const source = readFileSync(join(codeAssetsDir, file), "utf8");
    for (const match of source.matchAll(ID)) ids.add(match[1]);
  }
  return [...ids].sort();
}
