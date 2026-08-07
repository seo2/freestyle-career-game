# Freestyle Game

Simulador RPG de la carrera de un MC y freestyler, en pixel-art. Empiezas rapeando en tu pieza, administras tu semana (entrenar, escribir, trabajar, redes, descansar), compites en batallas de freestyle por rondas y asciendes desde el underground al estrellato: **Pieza → Plaza → Regional → Nacional → Internacional → Estrellato**.

El MVP es una PWA local: corre en navegador, guarda en `localStorage` y queda preparado para empaquetarse como app (Capacitor) cuando el loop esté validado.

## Características actuales (prototipo v0.1)

- Menú principal con arte de portada por capas y creación de MC.
- Loop de carrera: acciones semanales con costo de tiempo/energía, reloj día/hora, trabajos, redes sociales, entrenamiento por stat, tienda de upgrades (outfit/estudio/base) y metas de etapa.
- Batallas por rondas: estímulo + jugadas (punchline, respuesta, humor, ataque, métrica…), hype, rivales por nivel.
- Guardado local, navegación completa por teclado, PWA (manifest + service worker).

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
| `src/main.ts` | Todo el juego actual (estado, reglas, render, input) |
| `public/assets/` | Assets runtime (capas del menú, logo, fondos de escena) |
| `reference/` | Mockups y sprites fuente — diseño oficial, **no tocar** |
| `docs/` | GDD, plan de trabajo, catálogo de pantallas |
| `output/` | Capturas de verificación (Playwright) |
| `progress.md` | Bitácora de desarrollo por sesión |
| `CLAUDE.md` | Instrucciones de trabajo para Claude Code |

## Documentación

- [docs/GAME_BIBLE.md](docs/GAME_BIBLE.md) — visión canónica: fantasía central, pilares, loops, sistemas, roadmap MVP→1.0.
- [docs/GDD.md](docs/GDD.md) — diseño detallado: stats, sistema de batalla, economía, datos de los mockups y decisiones registradas.
- [docs/PLAN.md](docs/PLAN.md) — plan maestro por fases (refactor → Phaser → assets → pantallas → batalla v2 → calendario → progresión → audio → balance → empaquetado).
- [docs/PANTALLAS.md](docs/PANTALLAS.md) — mapeo de los mockups de referencia y lenguaje visual.
- [AGENTS.md](AGENTS.md) — guía de ingeniería: arquitectura, convenciones, gauntlets y definition of done.

## Roadmap resumido

1. Extraer núcleo de reglas puro + tests (sin cambio visual).
2. ✅ Migrar render a Phaser 4 (escenas: menú, crear MC, carrera, batalla).
3. Pipeline de sprites reales desde `reference/` (adiós dibujo procedural).
4. Pantallas 1:1 con los mockups.
5. Batalla v2: timer, anti-repetición, arquetipos de rival, game feel.
6. Calendario semanal con eventos y resumen.
7. Dilemas de carrera y primer arco completo (Pieza → Plaza).
8. Audio, balance, empaquetado como app.

**Futuro online:** rankings y temporadas → batallas asincrónicas contra "fantasmas" → crews y torneos → batallas en vivo con votación.
