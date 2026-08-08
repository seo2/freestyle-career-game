# Freestyle Game

Simulador RPG de carrera de un MC/freestyler (pixel-art, web). El jugador administra su semana (entrenar, trabajar, redes, escribir, descansar), compite en batallas de freestyle por rondas y asciende de etapa: Pieza → Plaza → Regional → Nacional → Internacional → Estrellato.

**Documentos clave (leer antes de trabajar):**

- `docs/GAME_BIBLE.md` — **visión canónica del juego** (fantasía, pilares, loops, sistemas, regla suprema). Ante conflicto de diseño, la Bible manda.
- `AGENTS.md` — **cómo se escribe el código**: arquitectura Scenes→Managers→Systems→GameState, data-driven, eventos, gauntlets, definition of done. Obligatorio para todo código nuevo.
- `docs/GDD.md` — diseño detallado: stats, batallas, economía, datos de mockups y decisiones registradas (tiempo por bloques, 7 etapas, web primero).
- `docs/PLAN.md` — plan maestro por fases y mapeo a gauntlets. Trabajar la fase activa; no saltarse fases.
- `docs/PANTALLAS.md` — catálogo de los mockups de `reference/` y lenguaje visual.
- `progress.md` — bitácora: qué se hizo y qué sigue. **Actualizarla al cerrar cada sesión.**

**Filtro para features (Bible):** ¿hace más interesante decidir? ¿genera historias? ¿hace querer jugar una semana más? Si las tres no son "sí", no se implementa.

## Comandos

```bash
npm run dev        # Vite dev server (host 0.0.0.0)
npm run build      # tsc (estricto) + vite build
npm run test       # Vitest (suite de systems/managers/data)
npm run lint       # ESLint (Math.random prohibido; unused = error)
npm run preview    # servir dist/
node scripts/capture-traces.mjs <outDir>   # trazas deterministas de juego (arnés de paridad)
node scripts/verify-save-migration.mjs      # e2e de migración de saves (dev server corriendo)
```

## Arquitectura (Fases 1–2 completas)

- **Motor: Phaser 4** (960×540, pixelArt, FIT). `src/main.ts` es un bootstrap de ~58 líneas.
- **Reglas** en `src/systems/` (Calendar, Progression, Battle, Store, Training, Social, Jobs, Actions): funciones puras sobre `GameState`, testeadas con Vitest. Ver convenciones y desviaciones documentadas en `src/systems/README.md`.
- **Balance/data**: contenido en `src/data/`, todos los números de tuning en `src/data/config/*Config.ts` (cero números mágicos en systems).
- **Orquestación**: `src/managers/GameController.ts` (estado vivo, RNG con seed vía `RandomService`, save, comandos, eventos) + `src/events/EventBus.ts` + `src/game/InputRouter.ts` (teclado global) + `src/game/SceneDirector.ts`.
- **Presentación**: escenas en `src/scenes/` (Boot/Menu/CreateMc/Career+careerViews/Battle) — solo muestran y envían comandos al controller; assets siempre vía `src/game/AssetRegistry.ts`.
- **Tiempo**: día en 3 bloques (Mañana/Tarde/Noche). **Etapas**: 7 (pieza→leyenda).
- Guardado en `localStorage` clave `freestyle-career-save-v2` (migración automática desde v1 en `SaveManager`); PWA: `public/manifest.webmanifest` + `public/sw.js`.
- Hooks de test deterministas en `window`: `render_game_to_text()` (independiente del renderer) y `advanceTime(ms)`. **Mantenerlos en cualquier refactor** — son la base del arnés de trazas byte-idénticas (`output/traces/baseline-v2/` es la referencia vigente).
- Personajes/props aún en placeholders: la Fase 3 los reemplaza con sprites reales de `reference/`.

## Reglas del proyecto

1. **`reference/` es intocable.** Son los mockups y sprites fuente (diseño oficial). No borrar, no renombrar, no editar. Para usar un asset: copiar/recortar/optimizar hacia `public/assets/`.
2. **Fidelidad a los mockups.** Toda pantalla nueva o retocada se compara contra su mockup (ver `docs/PANTALLAS.md`). Preferir sprites reales sobre dibujo procedural; si un asset no existe, anotarlo como pendiente en vez de improvisar formas con canvas.
3. **Saves compatibles.** Si cambia la forma de `GameState`, migrar en `normalizeLoadedState()` (o subir la versión de `SAVE_KEY` con migración explícita). Nunca romper partidas guardadas silenciosamente.
4. **Idiomas:** código, tipos y comentarios en inglés; todos los textos visibles del juego en español (tono chileno/neutro como los mockups: "pieza", "plata", "¡Buenísimo!").
5. **Accesibilidad de input:** el juego completo debe poder jugarse con teclado (flechas + Enter/Espacio) además de mouse/touch. No introducir pantallas solo-mouse.
6. **`dist/` es build generado** — no editarlo a mano. `output/` guarda evidencia de verificación (capturas Playwright), no assets del juego.
7. **Flujo git — rama por tarea (regla del owner, 2026-08-07):** antes de partir cada tarea, crear una rama (`fase-N/descripcion-corta` o `fix/...`); al terminarla y verificarla, commit, push de la rama, y merge a `main` (+ push de main). Nunca desarrollar tareas directamente sobre `main`.

## Verificación (antes de dar por cerrado cualquier cambio)

1. `npm run build` sin errores (TypeScript estricto) + `npm run lint` + `npm run test`.
2. Levantar dev server y capturar con Playwright las pantallas afectadas hacia `output/web-game/<slug-descriptivo>/` (patrón existente: `shot-N.png` + `state-N.json` usando `render_game_to_text`).
3. Revisar las capturas de verdad (leerlas): sin textos superpuestos, sin paneles rotos, consola sin errores.
4. Si hubo cambio visual, comparar contra el mockup correspondiente con `node scripts/compare-mockup.mjs <mockup> <captura> <salida>` y **leer** el resultado (el mapa de mockups por pantalla está en `docs/PANTALLAS.md`).
5. Registrar el resultado en `progress.md`.

**Trampas conocidas del arnés de captura:**

- El arnés congela `Date.now` para que las corridas sean deterministas, y el
  TweenManager de Phaser 4 deriva su delta de `Date.now` → **los tweens aparecen
  congelados en las capturas**. Animar con el delta de frame (`update(_, delta)`)
  en vez de tweens cuando el resultado deba ser verificable.
- Los textos de Phaser usan `resolution: 1` a propósito (con `2` el escalado
  pixelArt come filas de glifos: "HYPE" salía "HYPF"). No subirlo.

## Contexto de diseño

`.impeccable.md` define los principios de UI (una decisión primaria a la vez, jerarquía antes que decoración, el escenario nunca tapa texto, targets táctiles grandes). El lenguaje visual concreto (paleta noche, paneles pixel de doble borde, HUD con bust + energía dominante, selección amarilla con cursor ▶) está en `docs/PANTALLAS.md`.
