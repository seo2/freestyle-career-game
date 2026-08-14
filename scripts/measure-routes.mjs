// Measures whether a career can be climbed by a route OTHER than battling.
//
// The Bible promises "mismo origen, destinos distintos", and the identity axes
// already carry batallero <-> musico while the destiny catalogue already holds
// "Productor" and "Estrella". The question this answers is whether the ROAD
// exists: can a player who writes and records instead of battling actually get
// anywhere, or does the ladder only accept one credential?
//
// Runs the real systems through the dev server, like the other measurement tools,
// and plays three routes for a fixed number of weeks:
//   batallero — trains and battles, never records
//   musico    — writes and records, never battles
//   mixto     — alternates
//
// MEASUREMENT tool, not a test: it prints and never asserts.
//
// Usage: node scripts/measure-routes.mjs [--weeks 20]

import { chromium } from "playwright";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const WEEKS = Number(flag("weeks", 20));

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
    const battle = await import("/src/systems/BattleSystem.ts");
    const progression = await import("/src/systems/ProgressionSystem.ts");
    const { battleResources } = await import("/src/data/battle.ts");
    const { stages } = await import("/src/data/stages.ts");
    const { recordCost } = await import("/src/core/derived.ts");
    const epilogue = await import("/src/systems/EpilogueSystem.ts");
    const dilemma = await import("/src/systems/DilemmaSystem.ts");

    const byId = new Map(battleResources.map((r) => [r.id, r]));

    // What each route reaches for. These are FUNCTIONS, not fixed lists: a naive
    // preference list made the musician write forever, never reach "work", never
    // have the money that recording costs, and therefore never record — which
    // measured my own policy instead of the game. A real musician funds the studio.
    const ROUTES = {
      batallero: () => ["battle", "practice", "cypher", "work", "rest"],
      musico: (state, needed) =>
        state.cash < needed
          ? ["work", "write", "rest"]
          : ["record", "write", "show", "social", "rest"],
      mixto: (state, needed) =>
        state.cash < needed
          ? ["work", "battle", "write", "rest"]
          : ["battle", "record", "write", "practice", "rest"],
    };

    function playBattleOut(state, rng) {
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
        // Play well: the point is whether the ROUTE works, not whether the player
        // is careless.
        const scored = hand.map((card) => ({ card, gain: battle.projectedHypeGain(b, card) }));
        scored.sort((a, z) => z.gain - a.gain);
        battle.resolveBattle(state, rng, scored[0].card);
      }
      if (state.battle?.finished) battle.finishBattle(state, rng);
    }

    function run(routeName) {
      const state = createNewState("Ruta", 909);
      state.mode = "career";
      const rng = createStateRng(state);
      const route = ROUTES[routeName];
      const timeline = [];
      let guard = 0;
      let lastStage = state.stage;

      while (state.week <= weeks && guard < 6000) {
        guard += 1;
        // Rest is the fallback: an unavailable action changes nothing and would
        // otherwise spin forever.
        let acted = false;
        const needed = recordCost(state);
        for (const id of state.energy < 25 ? ["rest"] : route(state, needed)) {
          const outcome = actions.executeAction(state, rng, id);
          if (outcome.type === "none") continue;
          acted = true;
          if (outcome.type === "battle-started") playBattleOut(state, rng);
          if (outcome.type === "cypher-started") state.cypher = null;
          break;
        }
        if (!acted && actions.executeAction(state, rng, "rest").type === "none") break;
        // A dilemma or an epilogue would stop a real player; here they are cleared
        // so the measurement is about the route, not about modal screens.
        if (state.mode !== "career") {
          state.pendingDilemma = null;
          state.pendingEpilogue = null;
          state.mode = "career";
        }
        progression.maybeUnlockStage(state);
        if (state.mode !== "career") {
          state.pendingEpilogue = null;
          state.mode = "career";
        }
        if (state.stage !== lastStage) {
          timeline.push(`semana ${state.week}: ${state.stage}`);
          lastStage = state.stage;
        }
      }

      const idx = stages.findIndex((s) => s.id === state.stage);
      const next = stages[idx + 1];
      return {
        route: routeName,
        stage: state.stage,
        stagesClimbed: idx,
        level: state.level,
        fans: state.fans,
        respect: state.respect,
        fame: state.fame,
        songs: state.songs,
        releases: [...state.releases],
        cash: state.cash,
        // The whole question of Fase 10: does the ROUTE produce an identity?
        axes: Object.fromEntries(Object.entries(state.axes).map(([k, v]) => [k, Math.round(v)])),
        leaning: dilemma.identitySummary(state),
        destiny: epilogue.destinyFor(state)?.label ?? null,
        timeline,
        // What is actually blocking the next step, which is the whole question.
        blockedBy: next
          ? [
              state.level < next.minLevel ? `nivel ${state.level}/${next.minLevel}` : null,
              state.fans < next.minFans ? `fans ${state.fans}/${next.minFans}` : null,
              state.respect < next.minRespect ? `respeto ${state.respect}/${next.minRespect}` : null,
              state.fame < next.minFame ? `fama ${state.fame}/${next.minFame}` : null,
            ].filter(Boolean)
          : [],
      };
    }

    return ["batallero", "musico", "mixto"].map(run);
  },
  { weeks: WEEKS },
);

console.log(`\nTres rutas, ${WEEKS} semanas cada una, jugando bien. Reglas reales.\n`);
for (const r of report) {
  console.log(`── ${r.route.toUpperCase()}`);
  console.log(`   llega a: ${r.stage} (${r.stagesClimbed} etapas subidas)`);
  console.log(
    `   nivel ${r.level} · fans ${r.fans} · respeto ${r.respect} · fama ${r.fame} · temas ${r.songs} · $${r.cash}`,
  );
  console.log(`   ejes: batallero/musico ${r.axes.batalleroMusico >= 0 ? "+" : ""}${r.axes.batalleroMusico}` +
    ` · under/comercial ${r.axes.undergroundComercial >= 0 ? "+" : ""}${r.axes.undergroundComercial}` +
    ` · solo/crew ${r.axes.soloCrew >= 0 ? "+" : ""}${r.axes.soloCrew}`);
  console.log(`   se lee como: ${r.leaning.length ? r.leaning.join(", ") : "sin definir"}`);
  console.log(`   destino: ${r.destiny ?? "ninguno todavia"}`);
  console.log(`   obra: ${r.releases.length ? r.releases.join(" → ") : "nada grabado"}`);
  if (r.timeline.length) console.log(`   ascensos: ${r.timeline.join(" | ")}`);
  console.log(`   lo frena: ${r.blockedBy.length ? r.blockedBy.join(", ") : "nada (etapa maxima)"}\n`);
}
if (errors.length) console.log("errores de consola:", errors.slice(0, 3));
await browser.close();
