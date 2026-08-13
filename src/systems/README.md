# Systems layer — Fase 1 conventions

All game rules live here as pure TypeScript modules. Systems receive the live
`GameState` (and a `RandomSource` when they roll) as explicit parameters. They
never touch the DOM, `localStorage`, `window`, `Math.random`, or `Date.now`,
and they are fully testable in Node (Vitest).

**Result convention.** Player-facing commands return an `ActionResult`
(`src/core/types.ts`). Systems never write `state.lastEvent` and never persist:
the orchestrator (`src/managers/GameController.ts`) finalizes events via
`ProgressionSystem.finalizeEvent` + `SaveManager.save`, turns the returned
`TimeAdvance` into the animated agenda strip, and notifies the Phaser scenes
through `src/events/EventBus`.

## Documented deviations from AGENTS.md (reviewed each fase)

These are deliberate and contained, not oversights:

1. **In-place mutation instead of "returns a new state".** Systems mutate the
   GameState they are handed. Chosen to guarantee byte-identical behavior with
   the legacy engine during extraction (verified by blind trace diffing).
   Revisit when a concrete need (undo, rollback netcode) appears.
2. **Direct sibling imports instead of an event bus between systems.**
   Composite flows (ActionsSystem, BattleSystem, StoreSystem) call
   `addXp`/`applyRhythm`/`advanceClock` directly; the call graph is acyclic and
   pinned by mock-based tests. The `src/events/EventBus` introduced in Fase 2
   covers controller → scene communication; migrating system-to-system calls
   onto it is deferred until events carry gameplay value (Fase 7 EventSystem).

Resolved: the Fase 1 deviation for the 2.5k-line legacy `src/main.ts` is gone —
Fase 2 replaced it with a 58-line bootstrap plus Phaser scenes under
`src/scenes/` (presentation-only, per the rules above). The Fase 3 deviation for
the oversized `src/scenes/careerViews.ts` is gone too — Fase 4 split it into
`src/scenes/views/*.ts` (one file per career sub-view plus a shared
`viewKit.ts`), leaving `careerViews.ts` as a 33-line dispatcher.

Open, and recorded rather than silently ignored: **`src/managers/GameController.ts`
is 527 lines, ~5% over the 500-line rule.** Fase 6 moved the
renderer-independent state dump out to `src/managers/renderState.ts` (verified
byte-identical by the trace harness, which compares exactly that output), which
brought it down from 712. What remains is the command surface itself — every
player intention arrives here. The next honest cut is the weekly-plan block
(`planDay`, `cyclePlanForDay`, `runPlannedDay`, `livePlannedOpportunity`), which
is cohesive but leans on private helpers (`setEvent`, `startTimeFx`), so it needs
a small collaborator instead of a copy-paste move. `src/scenes/BattleScene.ts`
had the same problem after gauntlet 9 (578 lines) and was split into
`battleDraw.ts` in Fase 5, proven pixel-identical.

## Fase 7 notes

- `RelationshipSystem` owns both halves of "the people": bonds (familia, crew)
  and rivalries. Its effects are read by other systems rather than pushed:
  `ActionsSystem` asks for `restHealthBonus`, `battleTier` asks for
  `rivalryEdge`, `BattleSystem` asks for `crewHypeBoost`. That keeps the
  dependency one-way and lets the bond rules change without touching them.
- `battleTier.ts` was split out of `BattleSystem` when the latter hit the size
  limit: it owns how an opponent is BUILT for the current stage (roster pick,
  power, rewards, crowd, and the grudge that sharpens them), while
  `BattleSystem` owns the FLOW (rounds, resolution, payout).
- `acrossAffinity` anchors every bond effect at the bond's STARTING affinity, not
  at zero. Anchoring at zero would have handed a fresh career the bonus and
  silently re-tuned the battle/rest balance that `scripts/playthrough.mjs` had
  just measured.

## Fase 4 notes

- **Store = items, upgrades = backbone.** `StoreSystem` sells the catalogue in
  `src/data/items.ts` (`buyItem`, `buyRecommendedItem`). Item `grants` raise the
  internal `outfitLevel`/`studioLevel`/`homeLevel` (clamped by
  `src/data/upgrades.ts`) and/or call `addStat`, so `maxEnergy`, `recordCost`,
  battle presence and the action formulas keep reading the same fields. The
  by-key upgrade purchase stays exported as the internal level bump; the store
  UI no longer shows the three abstract upgrades.
- **Difficulty is the only mechanical choice of Crear MC.** `DifficultyConfig`
  holds `rivalPowerBonus` (applied in `BattleSystem.getBattleTier`) and
  `rewardMultiplier` (applied to the whole payout in `finishBattle`). Nickname,
  look, skin and voice are cosmetic identity, stored and persisted.
- **Save key stays `v2`.** The new identity/inventory fields are backfilled from
  `NewGameConfig` in `SaveManager.normalize`, so pre-Fase-4 saves (and migrated
  v1 saves) keep loading.
