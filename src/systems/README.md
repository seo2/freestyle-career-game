# Systems layer — Fase 1 conventions

All game rules live here as pure TypeScript modules. Systems receive the live
`GameState` (and a `RandomSource` when they roll) as explicit parameters. They
never touch the DOM, `localStorage`, `window`, `Math.random`, or `Date.now`,
and they are fully testable in Node (Vitest).

**Result convention.** Player-facing commands return an `ActionResult`
(`src/core/types.ts`). Systems never write `state.lastEvent` and never persist:
the orchestrator (`src/main.ts`) finalizes events via
`ProgressionSystem.finalizeEvent` + `SaveManager.save`, and turns the returned
`TimeAdvance` into the animated agenda strip.

## Documented deviations from AGENTS.md (accepted for Fase 1)

These are deliberate, contained, and scheduled to be resolved in Fase 2 (Phaser
scene shell), not oversights:

1. **In-place mutation instead of "returns a new state".** Systems mutate the
   GameState they are handed. Chosen to guarantee byte-identical behavior with
   the legacy engine during extraction (verified by blind trace diffing).
   Immutability can be introduced at the system boundary once the event bus
   lands in Fase 2.
2. **Direct sibling imports instead of an event bus.** Composite flows
   (ActionsSystem, BattleSystem, StoreSystem) call `addXp`/`applyRhythm`/
   `advanceClock` directly. The event bus (`src/events/`) arrives with the
   Phaser scenes in Fase 2; introducing it now would double the surface of a
   parity-critical refactor.
3. **`src/main.ts` (~2.5k lines) exceeds the 500-line file rule.** It is the
   legacy canvas presentation layer, kept intact on purpose as the trace-parity
   reference. It is replaced wholesale by Phaser scenes in Fase 2 and gets no
   new logic in the meantime.
