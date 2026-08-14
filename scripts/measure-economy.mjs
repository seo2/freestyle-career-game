// Measures the money curve, with the real rules.
//
// The Bible's line is "el dinero nunca debe sobrar", and the measured playthrough
// finishes the first arc with $250 it never needed — which is the opposite. But
// "$250 left over" is one number from one run; this reports the whole ledger, so
// the question "does money ever actually bind a decision?" gets an answer instead
// of an impression.
//
// Like scripts/measure-battles.mjs it runs the SYSTEMS through the dev server, so
// the rules stay authoritative and nothing is reimplemented here to drift.
//
// It reports three things:
//   1. What an hour of each action is worth, so income can be compared to prices.
//   2. What the shop actually asks for, against that income.
//   3. A simulated career: cash week by week under a plan that never works unless
//      it has to, which is the only way to see whether money forces a choice.
//
// MEASUREMENT tool, not a test: it prints and never asserts.
//
// Usage: node scripts/measure-economy.mjs [--weeks 12]

import { chromium } from "playwright";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const WEEKS = Number(flag("weeks", 12));

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto("http://localhost:5173", { waitUntil: "networkidle" });

const report = await page.evaluate(
  async ({ weeks }) => {
    const { createNewState } = await import("/src/core/state.ts");
    const { createStateRng } = await import("/src/services/RandomService.ts");
    const actions = await import("/src/systems/ActionsSystem.ts");
    const { ActionsConfig } = await import("/src/data/config/ActionsConfig.ts");
    const { BattleConfig } = await import("/src/data/config/BattleConfig.ts");
    const { storeItems } = await import("/src/data/items.ts");
    const { recordCost } = await import("/src/core/derived.ts");

    // --- 1. what an action pays, per block of the day -----------------------
    const work = ActionsConfig.work;
    const perBlock = {
      // Average roll, so this is what a week of working really brings in.
      work: (work.earnBase + work.earnRandomMax / 2) / work.blocks,
      battlePieza: BattleConfig.tier.rewardCashBase / 1,
      battlePlaza: (BattleConfig.tier.rewardCashBase + BattleConfig.tier.rewardCashPerStage) / 1,
    };

    // --- 2. what the shop asks -----------------------------------------------
    const prices = storeItems.map((item) => ({ id: item.id, price: item.price }));
    prices.sort((a, b) => a.price - b.price);

    // --- 3. a simulated career ----------------------------------------------
    // The plan a real player runs: train and write, work only when the wallet is
    // thin, rest when tired. If money never binds, "work only when thin" will
    // almost never fire — and that is the finding, not an opinion.
    // Driven by the STATE's clock, not by loop counters of its own. The first
    // version counted its own days and weeks and reported ten identical weeks,
    // because the game's calendar had moved on without it. It also has to notice
    // when an action is unavailable: executeAction returns {type:"none"} and
    // changes nothing, which is an infinite loop unless something else is played.
    function simulate(workThreshold) {
      const state = createNewState("Economia", 4242);
      state.mode = "career";
      const rng = createStateRng(state);
      const ledger = [];
      let worked = 0;
      let broke = 0;
      let openingCash = state.cash;
      let openingWeek = state.week;
      let workedThisWeek = 0;
      let guard = 0;

      while (state.week <= weeks && guard < 4000) {
        guard += 1;
        const tired = state.energy < 25;
        const thin = state.cash < workThreshold;
        const wanted = tired ? "rest" : thin ? "work" : state.day % 2 === 0 ? "practice" : "write";
        if (state.cash < 10) broke += 1;
        const before = { week: state.week, cash: state.cash };
        let outcome = actions.executeAction(state, rng, wanted);
        // Unavailable (no energy, no money): sleeping always works, and a player
        // with nothing left to spend does exactly that.
        if (outcome.type === "none") outcome = actions.executeAction(state, rng, "rest");
        if (outcome.type === "none") break;
        if (wanted === "work" && state.cash > before.cash) worked += 1;

        if (state.week !== before.week) {
          ledger.push({ week: openingWeek, opening: openingCash, closing: state.cash, worked: workedThisWeek });
          openingCash = state.cash;
          openingWeek = state.week;
          workedThisWeek = 0;
        } else if (wanted === "work" && state.cash > before.cash) {
          workedThisWeek += 1;
        }
      }
      return { ledger, worked, days: guard, broke, finalCash: state.cash };
    }

    const state = createNewState("Economia", 1);
    return {
      perBlock,
      prices,
      recordCostAtStart: recordCost(state),
      startingCash: state.cash,
      lazy: simulate(0), // never works unless forced
      careful: simulate(60), // works when the wallet is thin
    };
  },
  { weeks: WEEKS },
);

const money = (n) => `$${Math.round(n)}`;
console.log(`\nEconomia medida sobre ${WEEKS} semanas. Reglas reales.\n`);
console.log("INGRESO POR BLOQUE DEL DIA");
console.log(`  trabajar          ${money(report.perBlock.work).padStart(6)} por bloque`);
console.log(`  batalla pieza     ${money(report.perBlock.battlePieza).padStart(6)} por batalla`);
console.log(`  batalla plaza     ${money(report.perBlock.battlePlaza).padStart(6)} por batalla`);
console.log(`\n  plata inicial     ${money(report.startingCash)}`);
console.log(`  grabar cuesta     ${money(report.recordCostAtStart)}`);

console.log("\nPRECIOS DE LA TIENDA (en bloques de trabajo)");
for (const item of report.prices) {
  const blocks = item.price / report.perBlock.work;
  console.log(`  ${item.id.padEnd(16)} ${money(item.price).padStart(6)}  = ${blocks.toFixed(1)} bloques de trabajo`);
}

for (const [name, run] of [
  ["NUNCA TRABAJA (salvo obligado)", report.lazy],
  ["TRABAJA CUANDO LA BILLETERA ESTA FLACA", report.careful],
]) {
  console.log(`\n${name}`);
  console.log("  semana   abre    cierra   dias trabajados");
  for (const row of run.ledger) {
    console.log(
      `  ${String(row.week).padStart(6)} ${money(row.opening).padStart(7)} ${money(row.closing).padStart(8)}` +
        ` ${String(row.worked).padStart(12)}`,
    );
  }
  console.log(
    `  total: ${run.worked} bloques de trabajo en ${run.days} acciones, termina con ${money(run.finalCash)}` +
      `, ${run.broke} acciones con menos de $10 en el bolsillo`,
  );
}
if (errors.length) console.log("\nerrores de consola:", errors.slice(0, 3));
await browser.close();
