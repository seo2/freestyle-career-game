// Trace parity check against the baseline committed to the repo.
//
// scripts/capture-traces.mjs writes to output/, which is gitignored evidence:
// the baseline it produced only ever existed on the machine that ran it, so a
// fresh clone had no reference to compare against and the regression net was
// not reproducible. The reference states now live in traces/baseline/ (JSON
// only — the PNGs are ~1.5MB and not needed to detect a behaviour change).
//
// Usage:
//   node scripts/compare-traces.mjs [captureDir]   # default: a temp capture
//   node scripts/compare-traces.mjs --update       # accept the current
//                                                  # behaviour as the baseline
//
// Exit code 1 on any difference, so it can gate a build.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const BASELINE_DIR = "traces/baseline";
const SCENARIOS = ["fresh-career", "views-tour", "battle-flow", "save-continue"];

const args = process.argv.slice(2);
const update = args.includes("--update");
const givenDir = args.find((arg) => !arg.startsWith("--"));

function capture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "traces-"));
  execFileSync("node", ["scripts/capture-traces.mjs", dir], { stdio: "inherit" });
  return dir;
}

const captureDir = givenDir ?? capture();

if (update) {
  fs.mkdirSync(BASELINE_DIR, { recursive: true });
  for (const name of SCENARIOS) {
    fs.copyFileSync(path.join(captureDir, `${name}.json`), path.join(BASELINE_DIR, `${name}.json`));
  }
  console.log(`Baseline updated from ${captureDir} (${SCENARIOS.length} scenarios).`);
  process.exit(0);
}

let differences = 0;
for (const name of SCENARIOS) {
  const basePath = path.join(BASELINE_DIR, `${name}.json`);
  const capturePath = path.join(captureDir, `${name}.json`);
  if (!fs.existsSync(basePath)) {
    console.log(`${name}: NO BASELINE (run with --update to record one)`);
    differences += 1;
    continue;
  }
  const expected = fs.readFileSync(basePath, "utf8");
  const actual = fs.readFileSync(capturePath, "utf8");
  if (expected === actual) {
    console.log(`${name}: identical`);
    continue;
  }
  differences += 1;
  // Report the first differing step so a real regression is readable instead
  // of being buried in a whole-file diff.
  const expectedSteps = JSON.parse(expected);
  const actualSteps = JSON.parse(actual);
  const steps = Math.max(expectedSteps.length, actualSteps.length);
  let firstDiff = "length only";
  for (let i = 0; i < steps; i += 1) {
    const a = JSON.stringify(expectedSteps[i]?.state ?? null);
    const b = JSON.stringify(actualSteps[i]?.state ?? null);
    if (a !== b) {
      firstDiff = `step ${i} (input ${actualSteps[i]?.input ?? "missing"})`;
      break;
    }
  }
  console.log(`${name}: DIFFERS — first change at ${firstDiff}`);
}

if (differences > 0) {
  console.log(
    `\n${differences} scenario(s) differ. If the change is intentional, re-run with --update and say so in the commit.`,
  );
  process.exit(1);
}
console.log("\nAll scenarios match the committed baseline.");
