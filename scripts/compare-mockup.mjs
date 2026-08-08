// Side-by-side comparison harness for Fase 4+: stacks a mockup from reference/
// on top of a captured screenshot so layout, hierarchy and palette can be
// judged directly (project rule 2: every screen is compared to its mockup).
//
// Usage:
//   node scripts/compare-mockup.mjs <mockupPath> <screenshotPath> <outPath>
//
// Both images are scaled to the same width; the mockup goes on top with a
// magenta separator. Requires no extra dependencies (uses canvas via Playwright's
// bundled Chromium is overkill, so this shells out to python3 + PIL, which the
// asset pipeline already relies on).

import { execFileSync } from "node:child_process";

const [mockup, shot, out] = process.argv.slice(2);
if (!mockup || !shot || !out) {
  console.error("usage: node scripts/compare-mockup.mjs <mockup> <screenshot> <out>");
  process.exit(1);
}

const script = `
import sys
from PIL import Image
mockup, shot, out = sys.argv[1:4]
W = 900
a = Image.open(mockup).convert("RGB")
b = Image.open(shot).convert("RGB")
ah = round(a.height * W / a.width)
bh = round(b.height * W / b.width)
a = a.resize((W, ah), Image.LANCZOS)
b = b.resize((W, bh), Image.LANCZOS)
canvas = Image.new("RGB", (W, ah + bh + 8), (255, 0, 255))
canvas.paste(a, (0, 0))
canvas.paste(b, (0, ah + 8))
canvas.save(out)
print(f"{out}: mockup {a.size} over shot {b.size}")
`;

execFileSync("python3", ["-c", script, mockup, shot, out], { stdio: "inherit" });
