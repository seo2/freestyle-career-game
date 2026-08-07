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
3. **`src/scenes/careerViews.ts` slightly exceeds the 500-line rule (~516).**
   Single responsibility (the seven career subviews), ~3% over; it will be
   restructured anyway in Fase 4 when every screen is rebuilt 1:1 against the
   mockups, so a pre-emptive split would just add churn.

Resolved: the Fase 1 deviation for the 2.5k-line legacy `src/main.ts` is gone —
Fase 2 replaced it with a 58-line bootstrap plus Phaser scenes under
`src/scenes/` (presentation-only, per the rules above).
