// Measures the battle difficulty curve, with the real rules.
//
// docs/PLAN.md Fase 9 is balance, and the one thing already measured about it is
// that the autonomous playthrough wins 5 of 5 — but "5 of 5" from one run is an
// anecdote, not a curve. This plays thousands of battles across the profiles a
// real career passes through and reports what actually happens.
//
// It runs the SYSTEMS, not the UI: the dev server already serves the TypeScript,
// so the page imports src/systems/BattleSystem.ts directly. That keeps the rules
// authoritative (no reimplementation to drift) while running a battle in
// microseconds instead of the fifteen keypresses the screen needs.
//
// Three policies are played, because "is it too easy" depends on who is asking:
//   naive   — always the first card in hand. A player who has not learned anything.
//   greedy  — the card with the best previewed hype. A player who reads the UI.
//   worst   — the card with the lowest preview. A floor for how bad it can get.
//
// It is a MEASUREMENT tool, not a test: it prints and never asserts.
//
// Usage: node scripts/measure-battles.mjs [--runs 400]

import { chromium } from "playwright";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const RUNS = Number(flag("runs", 400));

// Where a career actually IS at each point. These were guesses at first — a flat
// "stat 6 at Plaza" — and the guess was wrong by a factor of two: the measured
// playthrough arrives at Plaza with an average stat of 11.7 and improvisacion at
// 20, because training pays a point per action and the cypher pays several. Three
// tuning passes were spent balancing against that fiction, so the pieza and plaza
// rows now come from scripts/playthrough.mjs and the rest extrapolate its slope
// (about +2 average stat and +1 level per week).
const PLAZA_STATS = { flow: 14, punchline: 13, metrica: 7, improvisacion: 20, escena: 11, carisma: 8, disciplina: 9 };
const scaled = (factor) =>
  Object.fromEntries(Object.entries(PLAZA_STATS).map(([k, v]) => [k, Math.max(1, Math.round(v * factor))]));

const PROFILES = [
  // A fresh career, exactly as createNewState leaves it.
  { name: "pieza semana 1", stage: "pieza", level: 1, stats: null, energy: 86, health: 100, momentum: 42 },
  { name: "pieza semana 3", stage: "pieza", level: 3, stats: scaled(0.45), energy: 70, health: 95, momentum: 55 },
  // Measured, not assumed.
  { name: "plaza recien", stage: "plaza", level: 6, stats: PLAZA_STATS, energy: 70, health: 95, momentum: 55 },
  // Tired but still able to enter: at energy 12 startBattle refuses and measures
  // nothing at all.
  { name: "plaza cansado", stage: "plaza", level: 6, stats: PLAZA_STATS, energy: 30, health: 25, momentum: 30 },
  { name: "regional", stage: "regional", level: 10, stats: scaled(1.8), energy: 75, health: 95, momentum: 60 },
  { name: "nacional", stage: "nacional", level: 14, stats: scaled(2.9), energy: 75, health: 95, momentum: 60 },
];

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto("http://localhost:5173", { waitUntil: "networkidle" });

const report = await page.evaluate(
  async ({ runs, profiles }) => {
    const battle = await import("/src/systems/BattleSystem.ts");
    const { createNewState } = await import("/src/core/state.ts");
    const { createStateRng } = await import("/src/services/RandomService.ts");
    const { battleResources } = await import("/src/data/battle.ts");

    const byId = new Map(battleResources.map((r) => [r.id, r]));

    function playOne(profile, seed, policy) {
      const state = createNewState("Medicion", seed);
      state.mode = "career";
      state.stage = profile.stage;
      state.level = profile.level;
      state.energy = profile.energy;
      state.health = profile.health;
      state.momentum = profile.momentum;
      // null keeps whatever a new career starts with, which is the honest profile
      // for week 1.
      if (profile.stats) for (const key of Object.keys(state.stats)) state.stats[key] = profile.stats[key];
      const rng = createStateRng(state);
      if (!battle.startBattle(state, rng)) return null;

      let guard = 0;
      while (state.battle && !state.battle.finished && guard < 40) {
        guard += 1;
        const b = state.battle;
        if (b.pendingResult) {
          battle.advanceBattleRound(state, rng);
          continue;
        }
        const hand = b.hand.map((id) => byId.get(id)).filter(Boolean);
        if (hand.length === 0) break;
        let pick = hand[0];
        if (policy !== "naive") {
          const scored = hand.map((card) => ({ card, gain: battle.projectedHypeGain(b, card) }));
          scored.sort((a, z) => z.gain - a.gain);
          pick = policy === "greedy" ? scored[0].card : scored[scored.length - 1].card;
        }
        battle.resolveBattle(state, rng, pick);
      }
      const b = state.battle;
      if (!b) return null;
      // The rolls themselves, which is where a gap actually lives. Guessing which
      // term caused a dip cost three tuning passes before this was measured.
      const rolls = b.results.reduce(
        (acc, r) => ({ player: acc.player + r.player, rival: acc.rival + r.rival, n: acc.n + 1 }),
        { player: 0, rival: 0, n: 0 },
      );
      return {
        result: b.result,
        hype: b.hype,
        rivalHype: b.rivalHype,
        rounds: b.results.length,
        margin: b.playerScore - b.rivalScore,
        rivalPower: b.rivalPower,
        playerRoll: rolls.n ? rolls.player / rolls.n : 0,
        rivalRoll: rolls.n ? rolls.rival / rolls.n : 0,
      };
    }

    const out = [];
    for (const profile of profiles) {
      for (const policy of ["naive", "greedy", "worst"]) {
        const tally = { win: 0, loss: 0, draw: 0 };
        let hype = 0;
        let margin = 0;
        let rounds = 0;
        let power = 0;
        let played = 0;
        let pRoll = 0;
        let rRoll = 0;
        for (let i = 0; i < runs; i += 1) {
          // A different seed per run: one seed measures one battle, not a rate.
          const res = playOne(profile, 1000 + i * 7919, policy);
          if (!res) continue;
          played += 1;
          tally[res.result ?? "draw"] += 1;
          hype += res.hype;
          margin += res.margin;
          rounds += res.rounds;
          power = res.rivalPower;
          pRoll += res.playerRoll;
          rRoll += res.rivalRoll;
        }
        out.push({
          profile: profile.name,
          policy,
          played,
          winRate: played ? tally.win / played : 0,
          lossRate: played ? tally.loss / played : 0,
          drawRate: played ? tally.draw / played : 0,
          avgHype: played ? hype / played : 0,
          avgMargin: played ? margin / played : 0,
          avgRounds: played ? rounds / played : 0,
          rivalPower: power,
          avgPlayerRoll: played ? pRoll / played : 0,
          avgRivalRoll: played ? rRoll / played : 0,
        });
      }
    }
    return out;
  },
  { runs: RUNS, profiles: PROFILES },
);

const pct = (v) => `${(v * 100).toFixed(1)}%`.padStart(6);
console.log(`\n${RUNS} batallas por celda. Reglas reales (src/systems/BattleSystem.ts).\n`);
console.log("perfil               politica   gana    pierde  hype  margen  poder  tirada-J  tirada-R  brecha");
console.log("-".repeat(96));
let lastProfile = "";
for (const row of report) {
  const name = row.profile === lastProfile ? "" : row.profile;
  lastProfile = row.profile;
  console.log(
    `${name.padEnd(20)} ${row.policy.padEnd(9)} ${pct(row.winRate)} ${pct(row.lossRate)}` +
      ` ${row.avgHype.toFixed(0).padStart(5)} ${row.avgMargin.toFixed(2).padStart(7)} ${String(row.rivalPower).padStart(6)}` +
      ` ${row.avgPlayerRoll.toFixed(1).padStart(9)} ${row.avgRivalRoll.toFixed(1).padStart(9)}` +
      ` ${(row.avgPlayerRoll - row.avgRivalRoll).toFixed(1).padStart(7)}`,
  );
}
if (errors.length) console.log("\nerrores de consola:", errors.slice(0, 3));
await browser.close();
