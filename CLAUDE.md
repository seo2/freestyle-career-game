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
npm run preview    # servir dist/
```

No hay tests todavía; la Fase 1 del plan introduce Vitest (`npx vitest run`).

## Estado actual de la arquitectura

- **Todo el juego vive en `src/main.ts` (~3.800 líneas)**: canvas 2D a 960×540, modos `start | career | battle`, vistas de carrera (`base/calendar/map/training/social/work/shop/stats`), reloj semana/día/hora, batallas por rondas, upgrades, metas.
- Guardado en `localStorage`, clave `freestyle-career-save-v1`; carga pasa por `normalizeLoadedState()`.
- Assets runtime en `public/assets/` (capas del menú, logo, fondos de escena). Casi todo lo demás se dibuja proceduralmente — esa es la principal deuda visual.
- PWA: `public/manifest.webmanifest` + `public/sw.js`.
- Hooks de test deterministas expuestos en `window`: `render_game_to_text()` (estado como texto) y `advanceTime(ms)`. Mantenerlos funcionando en cualquier refactor.

**Arquitectura objetivo** (Fases 1–2 del plan, estructura completa en `AGENTS.md`): Systems puros y testeables (`src/systems/` + `src/core/` GameState + `src/data/` configs + `src/services/` RandomService) y escenas Phaser 3 solo-presentación (`src/scenes/`). Al tocar lógica de juego, moverla hacia systems en vez de engordar `main.ts`.

## Reglas del proyecto

1. **`reference/` es intocable.** Son los mockups y sprites fuente (diseño oficial). No borrar, no renombrar, no editar. Para usar un asset: copiar/recortar/optimizar hacia `public/assets/`.
2. **Fidelidad a los mockups.** Toda pantalla nueva o retocada se compara contra su mockup (ver `docs/PANTALLAS.md`). Preferir sprites reales sobre dibujo procedural; si un asset no existe, anotarlo como pendiente en vez de improvisar formas con canvas.
3. **Saves compatibles.** Si cambia la forma de `GameState`, migrar en `normalizeLoadedState()` (o subir la versión de `SAVE_KEY` con migración explícita). Nunca romper partidas guardadas silenciosamente.
4. **Idiomas:** código, tipos y comentarios en inglés; todos los textos visibles del juego en español (tono chileno/neutro como los mockups: "pieza", "plata", "¡Buenísimo!").
5. **Accesibilidad de input:** el juego completo debe poder jugarse con teclado (flechas + Enter/Espacio) además de mouse/touch. No introducir pantallas solo-mouse.
6. **`dist/` es build generado** — no editarlo a mano. `output/` guarda evidencia de verificación (capturas Playwright), no assets del juego.

## Verificación (antes de dar por cerrado cualquier cambio)

1. `npm run build` sin errores (TypeScript estricto).
2. Levantar dev server y capturar con Playwright las pantallas afectadas hacia `output/web-game/<slug-descriptivo>/` (patrón existente: `shot-N.png` + `state-N.json` usando `render_game_to_text`).
3. Revisar las capturas de verdad (leerlas): sin textos superpuestos, sin paneles rotos, consola sin errores.
4. Si hubo cambio visual, comparar contra el mockup correspondiente de `reference/screens/`.
5. Registrar el resultado en `progress.md`.

## Contexto de diseño

`.impeccable.md` define los principios de UI (una decisión primaria a la vez, jerarquía antes que decoración, el escenario nunca tapa texto, targets táctiles grandes). El lenguaje visual concreto (paleta noche, paneles pixel de doble borde, HUD con bust + energía dominante, selección amarilla con cursor ▶) está en `docs/PANTALLAS.md`.
