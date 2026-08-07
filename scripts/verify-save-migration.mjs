// End-to-end check: a legacy v1 save (hour-based clock, 6-stage era) seeded
// into localStorage must load, migrate hour -> block, persist under the v2
// key, and continue the career with all progress intact.

import { chromium } from "playwright";

const BASE_URL = process.env.GAME_URL ?? "http://localhost:5173";

const v1Save = {
  mode: "career",
  playerName: "MC Legacy",
  inputName: "MC Legacy",
  week: 3,
  day: 5,
  hour: 14, // -> expect block 1 (Tarde)
  level: 4,
  xp: 31,
  xpNext: 152,
  energy: 61,
  health: 74,
  cash: 210,
  fans: 96,
  respect: 47,
  fame: 12,
  songs: 1,
  discProgress: 40,
  outfitLevel: 1,
  studioLevel: 0,
  homeLevel: 0,
  momentum: 58,
  lastActionId: "work",
  actionStreak: 1,
  stage: "plaza",
  stats: { flow: 4, punchline: 3, metrica: 2, improvisacion: 3, escena: 2, carisma: 2, disciplina: 3 },
  lastEvent: "Trabajaste 6h: +$55.",
  seed: 123456789,
  animationTime: 0,
  battle: null,
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 960, height: 540 } });
const page = await context.newPage();
await page.goto(BASE_URL, { waitUntil: "networkidle" });
await page.evaluate((save) => {
  localStorage.clear();
  localStorage.setItem("freestyle-career-save-v1", JSON.stringify(save));
}, v1Save);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(150);
await page.keyboard.press("Enter"); // continue career
await page.waitForTimeout(60);

const state = JSON.parse(await page.evaluate(() => window.render_game_to_text()));
const v2Raw = await page.evaluate(() => localStorage.getItem("freestyle-career-save-v2"));
const v2 = v2Raw ? JSON.parse(v2Raw) : null;

const checks = [
  ["mode is career", state.mode === "career"],
  ["block migrated from hour 14 -> 1", state.player.block === 1],
  ["timeLabel is Tarde", state.player.timeLabel === "Tarde"],
  ["week preserved", state.player.week === 3],
  ["day preserved", state.player.day === 5],
  ["level preserved", state.player.level === 4],
  ["cash preserved", state.player.cash === 210],
  ["fans preserved", state.player.fans === 96],
  ["stage preserved", state.player.stage === "plaza"],
  ["stats preserved", state.player.stats.flow === 4 && state.player.stats.disciplina === 3],
  ["v2 key persisted", v2 !== null],
  ["v2 save carries block", v2 !== null && v2.block === 1 && !("hour" in v2)],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}: ${name}`);
  if (!ok) failed += 1;
}
await browser.close();
process.exit(failed === 0 ? 0 : 1);
