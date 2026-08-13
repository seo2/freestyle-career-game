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

**Phaser 4 + TypeScript + Vite, con la arquitectura de `AGENTS.md`** (Fase 2 se construyó sobre Phaser 3.90; migrado a Phaser 4.2 el 2026-08-07 por decisión del owner tras la salida estable de abril 2026 — trazas byte-idénticas como compuerta): Scenes (presentación) → Managers (coordinación) → Systems (toda la lógica) → GameState (única fuente de verdad), configuración en `/data` (cero números mágicos), comunicación por eventos, `RandomService` con seed (nunca `Math.random()` directo), todo serializable y testeable sin Phaser (Vitest). Lint con ESLint + Prettier.

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

### Fase 2 — Cascarón Phaser (hoy Phaser 4) ✅ (2026-08-07)

- Instalar `phaser`; crear `src/scenes/`: `BootScene` (preload + AssetRegistry), `MenuScene`, `CreateMcScene`, `CareerScene`, `BattleScene`; componentes UI comunes en `src/ui/` (panel pixel 9-slice, botón, barra, tarjeta).
- Las escenas solo muestran, escuchan eventos y envían acciones a los systems (regla AGENTS.md).
- Mantener los hooks de test (`render_game_to_text`, `advanceTime`); retirar el render canvas legado al final.
- **Criterio de cierre:** flujo completo (menú → crear MC → carrera → batalla → volver) jugable en Phaser con teclado y mouse/touch, sin regresiones de guardado.

### Fase 3 — Pipeline de assets reales ✅ (2026-08-07)

- Recortar de `reference/` (o regenerar con IA cuando falte transparencia): personajes (MC con variantes de aspecto/piel, rivales por arquetipo), iconos (acciones, recursos, cartas), marcos/paneles/botones 9-slice, fondos por etapa, multitud, props; fuente pixel (bitmap font).
- Organizar en `public/assets/` por dominio (`ui/`, `characters/`, `scenes/`, `icons/`); atlas donde convenga; **todas las rutas vía AssetRegistry** (regla AGENTS.md).
- Documentar cada asset en `docs/PANTALLAS.md` o `docs/ASSETS.md`.
- **Criterio de cierre:** las pantallas clave no usan dibujo procedural para personajes, iconos ni paneles.

### Fase 4 — Pantallas 1:1 con los mockups ✅ parcial (2026-08-08)

Implementar cada vista contra su mockup (ver `docs/PANTALLAS.md`): 1 Menú, 2 Crear MC, 3 Pieza (con variantes de progresión de la habitación), 4–7 Calendario / Mapa / Entrenamiento / Redes, 8 Trabajo, 9 Tienda, 10 Batalla.

- **Criterio de cierre:** captura Playwright de cada pantalla comparada lado a lado con su mockup; layout, jerarquía y paleta coinciden.
- **Resultado:** las 10 pantallas se reconstruyeron y el layout/jerarquía/paleta coinciden (evidencia en `output/web-game/fase4-*`). Se adoptó el modelo de navegación del mockup y se construyeron los dos sistemas que los mockups exigían (identidad del MC, inventario con ítems).
- **Deuda del crítico — cerrada el 2026-08-09** (rama `fase-4/cierre-deuda-batalla`), salvo las dos que pertenecen a fases futuras:
  1. ✅ **HUD del rival real** — `BattleState` ganó `rivalEnergy`/`rivalEnergyMax`/`rivalHype`, inicializados y actualizados por `BattleSystem` desde los resultados reales de cada ronda (números en `BattleConfig.rival`); `rivalHudReadout()` eliminado.
  2. ✅ **Reglas una sola vez** — `BattleSystem` exporta `battleEnergyCost(state)` y `projectedHypeGain(battle, choice)`; `startBattle`, `ActionsSystem` y `BattleScene` los consumen (tests fijan que la proyección iguala lo otorgado).
  3. ✅ **Veredicto por ronda** — tras cada ronda la batalla se detiene en `pendingResult` y muestra el panel del mockup `06_25_07` (¡BUENISIMO!/BIEN/DEBIL + deltas + HYPE TOTAL); Enter o CONTINUAR avanzan (`advanceBattleRound`).
  4. ⏳ **El calendario insinúa una semana planificada que no existe** — se resuelve con el sistema de planificación semanal (**Fase 6**); hasta entonces la pantalla no debe leerse como agenda.
  5. ✅ **Cursor de fila en tienda/trabajo** — flechas mueven la selección (preview/panel siguen), Enter compra/trabaja con las mismas puertas que el clic, y las filas muestran el dígito de su atajo.
  6. ⏳ **`OPCIONES`/`CREDITOS`/`SALIR`** del menú y las flechas de semana del calendario siguen inertes (dibujados apagados y sin zona de clic); necesitan comandos reales (opciones/créditos ≈ Fase 8–10, navegación de semanas ≈ Fase 6).

### Fase 5 — Batalla v2 (el corazón del juego) ✅ (2026-08-12) — gauntlets 9–10

- Los 10 recursos de batalla de la Bible; timer de decisión por ronda; bonus por responder el ataque del rival; penalización por repetición; bonus por usar el estímulo.
- `AI Rivals`: perfiles con personalidad (agresividad, humor, métrica, frecuencia de riesgo) y los 7 arquetipos; público/jueces que valoran distinto según evento.
- Game feel: tweens de cartas, shake al recibir punchline, reacción de multitud ligada al hype, pantalla de resultado por ronda como el mockup.
- **Criterio de cierre:** una batalla completa se siente tensa y legible; el test de la Bible: "dan ganas de jugar otra".
- **Gauntlet 9 (Battle Engine) ✅:** los 10 recursos y los 10 estímulos de la Bible, mano de 5 por ronda con sus dos reglas, el rival juega un recurso visible, reglas de tensión (respuesta al ataque, penalización por repetir, bonus por estímulo) y timer de decisión por ronda con su "Pasada". Decisiones registradas en `docs/GDD.md` › "Decisiones de Batalla v2". Evidencia: `output/web-game/fase5-engine/`.
- **Gauntlet 10 (AI Rivals) ✅:** un rival por etapa con arquetipo, flow/punchline propios y las 4 pesas de personalidad; la elección de jugada es un pick ponderado de **un solo draw** (mismo contrato de RNG que la versión uniforme, así el arnés sigue determinista); el recurso que interpreta alimenta su tirada; y cada evento tiene su público con lo que premia y lo que lo deja frío, aplicado dentro de `projectedHypeGain` para que el `+N` de la carta no mienta. Los 7 arquetipos son alcanzables. Decisiones en `docs/GDD.md` › "Decisiones de AI Rivals". Evidencia: `output/web-game/fase5-ai-rivals/`.
- **Game feel ✅:** primitivos de animación por delta de frame en `src/ui/fx.ts` (nunca tweens: el arnés congela `Date.now`), con la mano entrando deslizándose, medidores de hype que persiguen su valor, shake al resolver la ronda (más fuerte si el golpe lo recibes) y la sala calentándose con el hype. La matemática está pinneada en `src/ui/fx.test.ts` porque en headless cada frame trae cientos de ms y ninguna captura alcanza a muestrear una animación corta. **Pendiente de arte:** el sprite de multitud (hoy reacciona la luz de la escena, no una multitud inventada).

### Fase 6 — Tiempo, calendario y semana ✅ (2026-08-12) — gauntlet 3 v2

- Calendario semanal real con bloques (mañana/tarde/noche): planificar semana → ejecutar → **resumen semanal** (loop principal de la Bible).
- Eventos programados (batallas de fin de semana, oportunidades que expiran), descanso obligatorio (fatiga y salud mental según Bible), momentum visible.
- **Criterio de cierre:** planificar la semana es una decisión interesante, no un trámite.
- **Hecho:** el plan semanal vive en el save (con migración: una partida anterior lo recibe vacío y sigue jugable), planificar es gratis y reversible, un día es un compromiso que no se puede repetir, un día sin plan se va en nada, un plan roto cae a descansar explicándolo, la batalla solo se agenda el sábado (y se puede saltar), la semana cierra con su **resumen** y las flechas del mockup navegan el historial de semanas cerradas. Decisiones en `docs/GDD.md` › "Decisiones del calendario semanal". Evidencia: `output/web-game/fase6-calendario/`.
- **Cerrado también:** **oportunidades programadas que expiran** (`src/data/opportunities.ts` + `OpportunitySystem`): cada semana golpean hasta dos ofertas con fecha, se agendan solo el día que llegaron, pagan lo que prometen y **se pierden** con aviso si el día pasa. **Descanso obligatorio** por salud mental: bajo el piso de `OpportunityConfig.burnout` todo se cierra menos descansar. **Impulso visible** en el panel de planificación (es un modificador real de las tiradas de batalla, así que dejó de vivir solo dentro del texto de los eventos).
- **Queda una pregunta de diseño para el owner** (registrada en `docs/GDD.md`): si las batallas deben ser estrictamente de fin de semana. Hoy la cita rige el plan y el nodo PLAZA del mapa sigue abierto cualquier día.

### Cypher como entrenamiento ✅ (2026-08-13) — decisión del owner

- El cypher dejó de ser una acción que se resolvía en una línea: es **entrenamiento con su propia pantalla** (tiras un recurso, ruedas contra tus stats, te llevas puntos en las stats que ese recurso ejercita). Eso resuelve la pregunta de si las batallas debían ser estrictamente de fin de semana: hay **dos niveles** — cypher cualquier día, evento de etapa con fecha. Decisiones en `docs/GDD.md`. Evidencia: `output/web-game/cypher/`.

### Fase 7 — Progresión, eventos y primer arco completo ⏳ en curso — gauntlets 11–14

- `EventSystem`: eventos semanales probabilísticos con decisiones sin respuesta correcta (entrevista, hate, polémica, sponsor, lesión…).
- **Registro de decisiones + ejes de identidad** (ver "Identidad de carrera y destinos" en el GDD): desde el primer dilema, cada decisión clave queda en el `GameState` y mueve los ejes (underground↔comercial, etc.). Es la semilla de los destinos múltiples — barata de implementar ahora, imposible de retro-instalar después.
- `RelationshipSystem` básico (familia, crew, rivales con afinidad); rivalidades persistentes.
- Metas por etapa con el mapa de progreso (pantalla 5) funcional; desbloqueo de nodos (gimnasio, estudio).
- Arco Pieza → Plaza completo con cierre y apertura de Regional.
- **Criterio de cierre:** partida nueva → ascenso a Plaza en 30–60 min con al menos 3 dilemas encontrados.
- **Hecho (2026-08-13): dilemas, ejes de identidad y registro de decisiones.** Los cuatro ejes del GDD viven en el save (todos en 0 al empezar), 8 dilemas con dos caminos que se excluyen, **pantalla propia** que muestra el costo con el mismo peso que el premio, los ejes ya **filtran** qué dilemas te alcanzan, y Estadísticas muestra "QUIEN VAS SIENDO". Decisiones en `docs/GDD.md` › "Dilemas e identidad". Evidencia: `output/web-game/fase7-dilemas/`.
- **Falta de esta fase:** `RelationshipSystem` (familia, crew, rivales con afinidad y rivalidades persistentes), desbloqueo de nodos del mapa por metas, y el cierre del arco Pieza → Plaza con su epílogo.

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
