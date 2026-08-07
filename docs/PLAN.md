# Plan de trabajo — Freestyle Game

Actualizado: 2026-08-06. Plan maestro para llevar el prototipo actual a un MVP entretenido (primer arco Pieza → Plaza completo) y dejarlo listo para empaquetar.

**Jerarquía documental:** `docs/GAME_BIBLE.md` (visión canónica) → `docs/GDD.md` (diseño detallado + decisiones) → este plan (ejecución por fases) → `AGENTS.md` (cómo se escribe el código) → `progress.md` (bitácora).

## Diagnóstico del estado actual

Lo que existe funciona pero no se siente como el juego de los mockups:

1. **Todo es dibujo procedural.** `src/main.ts` (~3.800 líneas) dibuja personajes, escenarios y UI con rectángulos y paths de canvas. Los mockups de `reference/` son pixel-art rico; la brecha se cierra **usando sprites reales**, no programando formas.
2. **Monolito sin motor.** Un solo archivo mezcla estado, reglas, render, input y layout — violando todas las reglas de `AGENTS.md` (Scene=presentación, Systems=lógica, data-driven, límite de 500 líneas por archivo). No hay escenas, tweens, animaciones por sprite, partículas ni audio: por eso el game feel es plano.
3. **Lógica y render acoplados.** Impide tests de balance y bloquea el futuro online (rankings, batallas fantasma) que exige la simulación separada del canvas.
4. **Falta la capa de "juego".** Hay números que suben, pero el arco (metas visibles, calendario con eventos, dilemas, rivales con personalidad, resumen semanal) está incompleto — y ahí vive la diversión según la Bible.

## Decisión técnica

**Phaser 3 + TypeScript + Vite, con la arquitectura de `AGENTS.md`:** Scenes (presentación) → Managers (coordinación) → Systems (toda la lógica) → GameState (única fuente de verdad), configuración en `/data` (cero números mágicos), comunicación por eventos, `RandomService` con seed (nunca `Math.random()` directo), todo serializable y testeable sin Phaser (Vitest). Lint con ESLint + Prettier.

Decisiones de diseño ya registradas (detalle en `docs/GDD.md`): tiempo por **bloques del día**, **web primero** (Steam vs. Capacitor se decide en beta), **7 etapas** (con Leyenda), mockups mandan en lo visual.

## Orden oficial de sistemas (gauntlets de AGENTS.md)

`AGENTS.md` define 15 gauntlets secuenciales: 1 Core Engine · 2 Save System · 3 Calendar · 4 Resources · 5 Training · 6 Jobs · 7 Store · 8 Inventory · 9 Battle Engine · 10 AI Rivals · 11 Events · 12 Social Media · 13 Career · 14 World Progression · 15 End Game.

Las fases de abajo son los **hitos de entrega** (incluyen trabajo visual/assets que los gauntlets no cubren); dentro de cada fase, los sistemas se implementan respetando este orden. Mapa: Fase 1 ≈ gauntlets 1–4 (extraídos del código actual) · Fase 5 ≈ 9–10 · Fase 6 ≈ 3 (v2) · Fase 7 ≈ 11–14 · Post-MVP ≈ 15.

## Fases

### Fase 0 — Fundaciones de proyecto ✅ (2026-08-06)

`CLAUDE.md`, `README.md`, `AGENTS.md`, `docs/GAME_BIBLE.md`, `docs/GDD.md`, `docs/PLAN.md`, `docs/PANTALLAS.md`; decisiones de tiempo/plataforma/etapas/estilo registradas.

### Fase 1 — Extraer el núcleo del juego ✅ (2026-08-07) — gauntlets 1–4

- Instalar Vitest + ESLint + Prettier.
- Crear la estructura de `AGENTS.md`: `src/systems/` (CalendarSystem, TrainingSystem, JobsSystem, StoreSystem, BattleSystem, ProgressionSystem…), `src/managers/` (SaveManager…), `src/data/` (configs: costos, curvas, cartas, trabajos — cero números mágicos), `src/services/` (RandomService con seed), `src/events/`, `src/core/` (GameState, tipos).
- Migrar la lógica de `main.ts` a esos módulos; `main.ts` queda como capa de presentación que consume systems.
- Migraciones de save: tiempo por horas → bloques; 6 → 7 etapas; `StatKey` → 7 stats + recursos (vía `SaveManager` con versión de `SAVE_KEY`).
- Tests de los sistemas núcleo: avance de calendario, costos de energía, resolución de batalla, anti-repetición, desbloqueo de etapas, save/load round-trip.
- **Criterio de cierre:** build + lint + tests verdes; el juego se ve igual y las partidas guardadas migran sin romperse.

### Fase 2 — Cascarón Phaser 3

- Instalar `phaser`; crear `src/scenes/`: `BootScene` (preload + AssetRegistry), `MenuScene`, `CreateMcScene`, `CareerScene`, `BattleScene`; componentes UI comunes en `src/ui/` (panel pixel 9-slice, botón, barra, tarjeta).
- Las escenas solo muestran, escuchan eventos y envían acciones a los systems (regla AGENTS.md).
- Mantener los hooks de test (`render_game_to_text`, `advanceTime`); retirar el render canvas legado al final.
- **Criterio de cierre:** flujo completo (menú → crear MC → carrera → batalla → volver) jugable en Phaser con teclado y mouse/touch, sin regresiones de guardado.

### Fase 3 — Pipeline de assets reales

- Recortar de `reference/` (o regenerar con IA cuando falte transparencia): personajes (MC con variantes de aspecto/piel, rivales por arquetipo), iconos (acciones, recursos, cartas), marcos/paneles/botones 9-slice, fondos por etapa, multitud, props; fuente pixel (bitmap font).
- Organizar en `public/assets/` por dominio (`ui/`, `characters/`, `scenes/`, `icons/`); atlas donde convenga; **todas las rutas vía AssetRegistry** (regla AGENTS.md).
- Documentar cada asset en `docs/PANTALLAS.md` o `docs/ASSETS.md`.
- **Criterio de cierre:** las pantallas clave no usan dibujo procedural para personajes, iconos ni paneles.

### Fase 4 — Pantallas 1:1 con los mockups

Implementar cada vista contra su mockup (ver `docs/PANTALLAS.md`): 1 Menú, 2 Crear MC, 3 Pieza (con variantes de progresión de la habitación), 4–7 Calendario / Mapa / Entrenamiento / Redes, 8 Trabajo, 9 Tienda, 10 Batalla.

- **Criterio de cierre:** captura Playwright de cada pantalla comparada lado a lado con su mockup; layout, jerarquía y paleta coinciden.

### Fase 5 — Batalla v2 (el corazón del juego) — gauntlets 9–10

- Los 10 recursos de batalla de la Bible; timer de decisión por ronda; bonus por responder el ataque del rival; penalización por repetición; bonus por usar el estímulo.
- `AI Rivals`: perfiles con personalidad (agresividad, humor, métrica, frecuencia de riesgo) y los 7 arquetipos; público/jueces que valoran distinto según evento.
- Game feel: tweens de cartas, shake al recibir punchline, reacción de multitud ligada al hype, pantalla de resultado por ronda como el mockup.
- **Criterio de cierre:** una batalla completa se siente tensa y legible; el test de la Bible: "dan ganas de jugar otra".

### Fase 6 — Tiempo, calendario y semana — gauntlet 3 v2

- Calendario semanal real con bloques (mañana/tarde/noche): planificar semana → ejecutar → **resumen semanal** (loop principal de la Bible).
- Eventos programados (batallas de fin de semana, oportunidades que expiran), descanso obligatorio (fatiga y salud mental según Bible), momentum visible.
- **Criterio de cierre:** planificar la semana es una decisión interesante, no un trámite.

### Fase 7 — Progresión, eventos y primer arco completo — gauntlets 11–14

- `EventSystem`: eventos semanales probabilísticos con decisiones sin respuesta correcta (entrevista, hate, polémica, sponsor, lesión…).
- **Registro de decisiones + ejes de identidad** (ver "Identidad de carrera y destinos" en el GDD): desde el primer dilema, cada decisión clave queda en el `GameState` y mueve los ejes (underground↔comercial, etc.). Es la semilla de los destinos múltiples — barata de implementar ahora, imposible de retro-instalar después.
- `RelationshipSystem` básico (familia, crew, rivales con afinidad); rivalidades persistentes.
- Metas por etapa con el mapa de progreso (pantalla 5) funcional; desbloqueo de nodos (gimnasio, estudio).
- Arco Pieza → Plaza completo con cierre y apertura de Regional.
- **Criterio de cierre:** partida nueva → ascenso a Plaza en 30–60 min con al menos 3 dilemas encontrados.

### Fase 8 — Audio y juice final

- `AudioManager`: música por zona (boom bap / jazz / soul / lo-fi / trap según Bible), SFX (UI, cartas, público), toggle de música como en el mockup del menú.
- **Criterio de cierre:** el juego suena; volumen persistido en save.

### Fase 9 — Balance y contenido

- Curvas de costos/ganancias en `/data` (el dinero nunca debe sobrar), dificultades, más estímulos y rivales.
- Playtesting con checklist; validar con el filtro de 3 preguntas de la Bible.

### Fase 10 — Empaquetado

- Auditoría PWA (ya hay manifest + service worker). **Decisión pendiente de beta:** Capacitor (móvil) vs. Steam (escritorio) — el MVP web debe correr bien en ambos contextos.
- **Criterio de cierre:** build instalable corriendo el MVP en la plataforma elegida.

### Post-MVP — gauntlet 15 y online

Finales múltiples resueltos por ejes de identidad + **epílogo de carrera** (línea de tiempo de decisiones clave: "quién fuiste") y end game (Bible 1.0); luego online en orden: rankings/perfiles/temporadas → batallas asincrónicas contra fantasmas → crews/torneos/ligas → batallas en vivo con votación. Los Systems puros de la Fase 1 son el prerrequisito.

## Cómo trabajar cada sesión

1. Leer `CLAUDE.md`, `AGENTS.md`, este plan y `progress.md`.
2. Atacar **una fase (o un bloque de fase) por sesión**, respetando el orden de gauntlets; no mezclar refactor con features visuales.
3. Seguir el flujo de `AGENTS.md`: analizar → diseñar → detectar sistemas afectados → interfaces → implementar → tests → documentar.
4. Verificar siempre: `npm run build`, lint, tests, captura Playwright a `output/web-game/<slug>/`.
5. Cerrar la sesión actualizando `progress.md` y, si cambió el rumbo, este plan.
