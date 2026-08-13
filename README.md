# Freestyle Game

Simulador RPG de la carrera de un MC y freestyler, en pixel-art. Empiezas rapeando en tu pieza, administras tu semana (entrenar, escribir, trabajar, redes, descansar), compites en batallas de freestyle por rondas y asciendes desde el underground a la leyenda: **Pieza → Plaza → Regional → Nacional → Internacional → Estrellato → Leyenda**.

El MVP es una PWA local: corre en navegador, guarda en `localStorage` y queda preparado para empaquetarse como app (Capacitor) cuando el loop esté validado.

## Estado actual

**7 etapas** de carrera (Pieza → Plaza → Regional → Nacional → Internacional → Estrellato → Leyenda) y el **día partido en 3 bloques** (Mañana / Tarde / Noche).

- **Identidad del MC**: nombre, apodo, aspecto, color de piel, voz y dificultad (la dificultad es la única elección con efecto mecánico: mueve el poder del rival y el multiplicador de premios).
- **Loop de carrera**: acciones con costo de bloques y energía, trabajos, redes sociales, entrenamiento por stat, **tienda con ítems** en 4 categorías, metas por etapa.
- **Batalla v2**: los 10 recursos de la Bible (punchline, flow, humor, ataque, defensa, métrica, doble tempo, respuesta, storytelling, improvisación), **mano de 5 por ronda**, estímulo, **timer de decisión** con "Pasada" al expirar, reglas de tensión (bonus por responder al ataque, penalización por repetir, bonus por estímulo) y **veredicto tras cada ronda**.
- **Las 10 pantallas reconstruidas 1:1 contra los mockups** de `reference/`: el modelo de navegación es el del mockup — la pieza es HUD + escena + dock de 5 tiles, sin barra de pestañas, y el **mapa es el hub**.
- Jugable **completo con teclado y completo con mouse**, guardado local con migración de versiones, PWA (manifest + service worker).

## Verificación

El proyecto se apoya en un arnés determinista, no en revisión a ojo:

```bash
npm run test        # suite de systems/managers/data (Vitest)
npm run lint        # ESLint (Math.random prohibido; unused = error)
npm run traces      # paridad byte-idéntica contra traces/baseline/
node scripts/verify-save-migration.mjs      # e2e de migración de saves
node scripts/compare-mockup.mjs <mockup> <captura> <salida>   # comparación lado a lado
```

`window.render_game_to_text()` expone el estado completo del juego como JSON independiente del renderer, y `window.advanceTime(ms)` mueve el reloj: juntos permiten manejar el juego desde Playwright y detectar cualquier cambio de conducta.

## Stack

TypeScript + Vite + **Phaser 4** (960×540, pixel-art). Núcleo de reglas puro y testeable en `src/systems` + escenas solo-presentación en `src/scenes` — ver [docs/PLAN.md](docs/PLAN.md).

## Desarrollo

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Estructura

| Ruta | Contenido |
|---|---|
| `src/main.ts` | Bootstrap de Phaser (~58 líneas) |
| `src/core/` | `GameState` y tipos |
| `src/systems/` | Reglas puras y testeadas (Calendar, Battle, Store, Training…) |
| `src/data/` | Contenido + `config/` con todos los números de tuning |
| `src/managers/` | `GameController` (estado vivo, RNG con seed, save, comandos) |
| `src/scenes/` | Escenas y una vista por pantalla en `scenes/views/` (solo presentación) |
| `public/assets/` | Assets runtime (capas del menú, logo, fondos, personajes, iconos) |
| `traces/baseline/` | Referencia de trazas deterministas (`npm run traces`) |
| `reference/` | Mockups y sprites fuente — diseño oficial, **no tocar** |
| `docs/` | GDD, plan de trabajo, catálogo de pantallas |
| `output/` | Evidencia de verificación (capturas Playwright), fuera de git |
| `progress.md` | Bitácora de desarrollo por sesión |
| `CLAUDE.md` | Instrucciones de trabajo para Claude Code |

## Documentación

- [docs/GAME_BIBLE.md](docs/GAME_BIBLE.md) — visión canónica: fantasía central, pilares, loops, sistemas, roadmap MVP→1.0.
- [docs/GDD.md](docs/GDD.md) — diseño detallado: stats, sistema de batalla, economía, datos de los mockups y decisiones registradas.
- [docs/PLAN.md](docs/PLAN.md) — plan maestro por fases (refactor → Phaser → assets → pantallas → batalla v2 → calendario → progresión → audio → balance → empaquetado).
- [docs/PANTALLAS.md](docs/PANTALLAS.md) — mapeo de los mockups de referencia y lenguaje visual.
- [AGENTS.md](AGENTS.md) — guía de ingeniería: arquitectura, convenciones, gauntlets y definition of done.

## Roadmap resumido

1. ✅ Extraer núcleo de reglas puro + tests (sin cambio visual).
2. ✅ Migrar render a Phaser 4 (escenas: menú, crear MC, carrera, batalla).
3. ✅ Pipeline de sprites reales desde `reference/`.
4. ✅ Pantallas 1:1 con los mockups (+ identidad del MC e inventario de ítems).
5. 🔄 Batalla v2: ✅ motor (10 recursos, mano de 5, timer, tensión) · **en curso:** arquetipos de rival y game feel.
6. Calendario semanal planificable con eventos y resumen.
7. Dilemas de carrera y primer arco completo (Pieza → Plaza).
8. Audio, balance, empaquetado como app.

**Futuro online:** rankings y temporadas → batallas asincrónicas contra "fantasmas" → crews y torneos → batallas en vivo con votación.
