// Deterministic gameplay trace capture.
//
// Drives the game in headless Chromium through scripted keyboard sequences and
// records window.render_game_to_text() after every step. Date.now is frozen so
// new games always start from the same RNG seed, making full runs replayable.
//
// Usage: node scripts/capture-traces.mjs <outDir> [baseUrl]
//   outDir  e.g. output/traces/baseline
//   baseUrl defaults to http://localhost:5173

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const OUT_DIR = process.argv[2] ?? "output/traces/current";
const BASE_URL = process.argv[3] ?? "http://localhost:5173";
const FIXED_NOW = 1754000000000;
const STEP_SETTLE_MS = 40;

// Each step is either { press: <key> } or { reload: true }.
const SCENARIOS = {
  "fresh-career": [
    { press: "Enter" }, // start new career with default name
    { press: "1" }, // practice
    { press: "2" }, // cypher
    { press: "3" }, // work
    { press: "4" }, // social clip
    { press: "5" }, // write
    { press: "u" }, // buy recommended upgrade
    { press: "c" }, // calendar view
    // Fase 6: the calendar plans instead of acting. Digit n cycles day n's
    // slot and Enter lives today's plan, so this now exercises planning.
    { press: "4" }, // plan day 4
    { press: "1" }, // plan today
    { press: "Enter" }, // live today's plan
    { press: "Escape" }, // back to base
  ],
  "views-tour": [
    { press: "Enter" },
    { press: "e" }, // training view
    { press: "1" }, // train flow
    { press: "r" }, // social view
    { press: "2" }, // studio photo post
    { press: "j" }, // work view
    { press: "2" }, // dishes job
    { press: "t" }, // shop view
    { press: "1" }, // try to buy outfit (fails: not enough cash)
    { press: "s" }, // stats view
    { press: "m" }, // map view
    { press: "c" }, // calendar view
    { press: "7" }, // plan the last day of the week
    { press: "Escape" },
  ],
  // Fase 5 battle engine v2: each round deals a hand of 5 of the 10 resources
  // (digits 1..5 pick a card) and parks on its verdict panel after resolving
  // (battle.pendingResult), so each round needs one extra Enter to CONTINUAR
  // before the next hand (or the final screen) appears. The per-round decision
  // timer cannot expire here: steps settle in ~40-190ms against a >=12s timer,
  // and render_game_to_text exposes it as whole seconds only, so the traces
  // stay byte-identical across runs.
  "battle-flow": [
    { press: "Enter" },
    { press: "c" },
    // Day 6 is the week's battle slot: six presses cycle it to BATALLA, and
    // Enter would live it on Saturday. Reaching a battle from Monday takes a
    // whole week, so this scenario keeps starting one from the map's PLAZA
    // node instead (the informal cypher door, open any day).
    { press: "6" },
    { press: "Escape" },
    { press: "m" }, // map hub (cursor starts on TU PIEZA)
    { press: "ArrowRight" }, // TRABAJO
    { press: "ArrowRight" }, // PLAZA
    { press: "Enter" }, // PLAZA -> battle
    { press: "1" }, // round 1: play hand card 1
    { press: "Enter" }, // continue past round 1 verdict
    { press: "2" }, // round 2: play hand card 2
    { press: "Enter" }, // continue past round 2 verdict
    { press: "3" }, // round 3: play hand card 3
    { press: "Enter" }, // continue past round 3 verdict -> final screen
    { press: "Enter" }, // collect result
  ],
  "save-continue": [
    { press: "Enter" },
    { press: "1" }, // practice
    { press: "3" }, // work
    { reload: true }, // back to the main menu with a save present
    { press: "Enter" }, // continue career (menu cursor defaults to Cargar partida)
  ],
};

async function captureState(page) {
  const raw = await page.evaluate(() => window.render_game_to_text());
  return JSON.parse(raw);
}

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();

  for (const [name, steps] of Object.entries(SCENARIOS)) {
    const context = await browser.newContext({ viewport: { width: 960, height: 540 } });
    await context.addInitScript(`Date.now = () => ${FIXED_NOW};`);
    const page = await context.newPage();
    const consoleErrors = [];
    page.on("pageerror", (error) => consoleErrors.push(String(error)));
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });

    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(150);

    const trace = [{ step: 0, input: "initial", state: await captureState(page) }];
    let stepIndex = 1;
    for (const step of steps) {
      if (step.reload) {
        await page.reload({ waitUntil: "networkidle" });
        await page.waitForTimeout(150);
        trace.push({ step: stepIndex, input: "reload", state: await captureState(page) });
      } else {
        await page.keyboard.press(step.press);
        await page.waitForTimeout(STEP_SETTLE_MS);
        trace.push({ step: stepIndex, input: `key:${step.press}`, state: await captureState(page) });
      }
      stepIndex += 1;
    }

    fs.writeFileSync(path.join(OUT_DIR, `${name}.json`), JSON.stringify(trace, null, 2));
    await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`) });
    fs.writeFileSync(path.join(OUT_DIR, `${name}.errors.json`), JSON.stringify(consoleErrors, null, 2));
    console.log(`${name}: ${trace.length} states captured, ${consoleErrors.length} console errors`);
    await context.close();
  }

  await browser.close();
  console.log(`Traces written to ${OUT_DIR}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
