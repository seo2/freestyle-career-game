// Autonomous playthrough: plays a NEW career the way a reasonable player would
// and measures the pacing.
//
// docs/PLAN.md's closing criterion for Fase 7 is "new game -> Plaza in 30-60 min
// with at least 3 dilemmas encountered". Human minutes cannot be measured here,
// so this reports the two things that DO map to them — the number of player
// decisions (a human spends roughly 3-6s per input, so ~400-700 inputs is that
// window) and the number of in-game weeks — plus everything a balance problem
// would show up as: weeks stuck with no energy, days that drifted with no plan,
// money starvation, and whether the run stalls entirely.
//
// It is a MEASUREMENT tool, not a test: it prints a report and never asserts, so
// reading it is the point.
//
// Usage: node scripts/playthrough.mjs [--weeks 40] [--target plaza] [--shots outDir]

import { chromium } from "playwright";
import fs from "node:fs";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const MAX_WEEKS = Number(flag("weeks", 40));
const TARGET = flag("target", "plaza");
const SHOTS = flag("shots", "");
// The career's seed comes from Date.now, which the harness freezes — so changing
// this changes the run. Exposed because "3 dilemmas" from ONE seed is luck, not a
// rate, and the plan's closing criterion is about the rate.
const FIXED_NOW = Number(flag("seed", 1754000000000));

// What the player plans on each weekday. A reasonable-but-not-optimal plan:
// train early in the week, work when the wallet is thin, keep the Saturday
// appointment, and rest when the body asks.
function planFor(day, state) {
  const broke = state.player.cash < 60;
  const tired = state.player.energy < 30 || state.player.health < 40;
  if (tired) return "rest";
  if (day === 6) return "battle"; // the week's appointment
  if (broke && (day === 2 || day === 4)) return "work";
  if (day === 1 || day === 3) return "practice";
  if (day === 5) return "cypher";
  if (day === 7) return "write";
  return "social";
}

async function run() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 960, height: 540 } });
  await context.addInitScript(`Date.now = () => ${FIXED_NOW};`);
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("pageerror", (error) => consoleErrors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  const read = async () => JSON.parse(await page.evaluate(() => window.render_game_to_text()));

  let inputs = 0;
  const lowCashWeeks = new Set();
  const burntOutDays = new Set();
  const press = async (key, settle = 60) => {
    await page.keyboard.press(key);
    inputs += 1;
    await page.waitForTimeout(settle);
  };

  await page.goto("http://localhost:5173", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await press("Enter", 250); // new career

  const report = {
    reachedTarget: false,
    weeks: 0,
    inputs: 0,
    dilemmas: 0,
    cyphers: 0,
    battles: { won: 0, lost: 0, drawn: 0 },
    idleDays: 0,
    brokenPlans: 0,
    burntOutDays: 0,
    lowCashWeeks: 0,
    epilogue: null,
    stalled: null,
    timeline: [],
  };

  let state = await read();
  let guard = 0;
  const seenDilemmas = new Set();

  while (guard < 4000) {
    guard += 1;
    state = await read();

    // --- modal screens first: they own the loop while they are up -------------
    if (state.mode === "epilogue") {
      report.reachedTarget = true;
      report.epilogue = {
        stage: state.player.stage,
        destiny: state.identity.destiny,
        leaning: state.identity.leaning,
        week: state.week.number,
      };
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/epilogue.png` });
      break;
    }
    if (state.mode === "dilemma") {
      if (!seenDilemmas.has(state.identity.pendingDilemma)) {
        seenDilemmas.add(state.identity.pendingDilemma);
        report.dilemmas += 1;
        report.timeline.push(`S${state.week.number} dilema: ${state.identity.pendingDilemma}`);
      }
      // Alternate the answer so the run does not become a single-axis rail.
      await press(report.dilemmas % 2 === 0 ? "1" : "2", 180);
      continue;
    }
    if (state.mode === "cypher") {
      report.cyphers += 1;
      while (state.mode === "cypher") {
        await press("1", 120); // throw the first option
        state = await read();
        if (state.cypher?.pending || state.cypher?.finished) await press("Enter", 120);
        state = await read();
      }
      continue;
    }
    if (state.mode === "battle") {
      let rounds = 0;
      while (state.mode === "battle" && rounds < 12) {
        rounds += 1;
        await press(String((rounds % 5) + 1), 110); // vary the card played
        state = await read();
        if (state.battle?.pendingResult || state.battle?.finished) await press("Enter", 110);
        state = await read();
      }
      const last = state.week.record.find((entry) => entry.outcome);
      if (last?.outcome === "win") report.battles.won += 1;
      else if (last?.outcome === "loss") report.battles.lost += 1;
      else if (last?.outcome === "draw") report.battles.drawn += 1;
      continue;
    }

    if (state.mode !== "career") {
      report.stalled = `modo inesperado: ${state.mode}`;
      break;
    }
    if (state.week.number > MAX_WEEKS) {
      report.stalled = `no llego a ${TARGET} en ${MAX_WEEKS} semanas`;
      break;
    }
    report.weeks = state.week.number;
    // Count DISTINCT weeks, not loop iterations: the first version incremented
    // once per pass and reported "4 low-cash weeks" inside a single week.
    if (state.player.cash < 40) lowCashWeeks.add(state.week.number);
    if (state.week.burntOut) burntOutDays.add(`${state.week.number}-${state.week.day}`);

    // --- plan whatever is still open, then live today ------------------------
    if (state.careerView !== "calendar") {
      await press("c", 90);
      state = await read();
    }
    for (let day = state.week.day; day <= 7; day += 1) {
      const wanted = planFor(day, state);
      let current = state.week.plan[day - 1];
      // The day cycles through its options; press until it holds what we want or
      // the cycle came all the way round (an option can be unavailable).
      let spins = 0;
      while (current !== wanted && spins < 10) {
        await press(String(day), 55);
        state = await read();
        current = state.week.plan[day - 1];
        spins += 1;
      }
    }
    state = await read();
    const before = { day: state.week.day, week: state.week.number, block: state.player.block };
    await press("Enter", 150); // live today's plan
    state = await read();
    const record = state.week.record.find((entry) => entry.day === before.day);
    if (record && record.ran === null) report.idleDays += 1;
    if (record && record.planned && record.ran === "rest" && record.planned !== "rest") report.brokenPlans += 1;

    // If the day is spent, burn the remaining blocks from the room so the clock
    // keeps moving (a real player would do something with the afternoon).
    if (state.mode === "career" && state.week.day === before.day && state.player.block === before.block) {
      await press("Escape", 70);
      await press("Enter", 120); // the dock's first tile (DORMIR)
    }
  }

  report.inputs = inputs;
  report.lowCashWeeks = lowCashWeeks.size;
  report.burntOutDays = burntOutDays.size;
  // Honest about the proxy: a human spends roughly 3-6 seconds per input, and
  // this player re-cycles a day's plan more than a person would, so the minute
  // range is an upper bound.
  report.estimatedMinutes = `${Math.round((inputs * 3) / 60)}-${Math.round((inputs * 6) / 60)} (cota alta)`;
  report.consoleErrors = consoleErrors.length;
  const finalState = await read();
  // The decay is a mechanic I added, so whether a reasonable player ends the arc
  // with cold bonds is a balance question that has to be measured, not assumed.
  report.relationships = {
    bonds: (finalState.relationships?.bonds ?? []).map(
      (bond) => `${bond.id} ${bond.affinity} (${bond.temperature})`,
    ),
    summary: finalState.relationships?.summary ?? null,
    rivalries: (finalState.relationships?.rivalries ?? []).map(
      (r) => `${r.name} ${r.won}-${r.lost} heat ${r.heat}${r.line ? ` "${r.line}"` : ""}`,
    ),
  };
  report.final = {
    stage: finalState.player.stage,
    // The trained stats, so the battle-balance profiles in
    // scripts/measure-battles.mjs can be facts instead of guesses.
    stats: finalState.player.stats,
    level: finalState.player.level,
    fans: finalState.player.fans,
    respect: finalState.player.respect,
    cash: finalState.player.cash,
    energy: finalState.player.energy,
    health: finalState.player.health,
  };

  console.log(JSON.stringify(report, null, 2));
  if (SHOTS) fs.writeFileSync(`${SHOTS}/playthrough.json`, JSON.stringify(report, null, 2));
  await browser.close();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
