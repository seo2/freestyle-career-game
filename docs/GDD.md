# Freestyle Game — Diseño detallado (GDD)

> **La visión canónica del juego vive en [`docs/GAME_BIBLE.md`](GAME_BIBLE.md)** (fantasía central, pilares, loops, sistemas, regla suprema). Este documento la baja a tierra: detalle de sistemas, datos transcritos de los mockups de `reference/` y decisiones de diseño ya tomadas. Si algo contradice a la Bible, la Bible manda — salvo en lo visual, donde mandan los mockups (ver Decisiones).

Simulador RPG de carrera artística de un MC / freestyler: del anonimato en su pieza a leyenda mundial. Gestión de tiempo + progreso de personaje + batallas de freestyle + decisiones de industria. El jugador no escribe rimas reales: toma decisiones inteligentes durante toda la carrera.

**Principio rector (visión del owner, 2026-08-06): mismo origen, destinos distintos.** Es un juego de rol de decisiones: todos parten igual — la misma pieza, el mismo potencial — y el desenlace depende de cómo cada jugador lleve su carrera en cada etapa y desafío. La creación del MC es identidad (nombre, aspecto, voz), nunca un reparto de stats; la divergencia se juega, no se configura.

## Identidad de carrera y destinos

Cómo se materializa el principio rector:

- **Memoria de decisiones:** el `GameState` registra las decisiones clave (dilemas, contratos, batallas aceptadas/rechazadas, lealtades) — no solo recursos acumulados.
- **Ejes de identidad acumulativos:** cada decisión mueve ejes como *underground ↔ comercial*, *batallero ↔ músico*, *lobo solitario ↔ crew*, *auténtico ↔ polémico*. Los ejes determinan qué eventos, oportunidades y NPCs aparecen.
- **Destinos como atractores, no rutas escritas:** los finales de la Bible (Campeón Mundial, rapero famoso, productor, empresario, fundador de sello, mentor, leyenda underground) son perfiles emergentes que se ganan por acumulación de ejes + relaciones + logros. No hay un menú de "elegir final".
- **Las puertas se cierran por elegir, no por perder:** coherente con el "no hay Game Over" — perder una batalla nunca cierra un destino; firmar con un sello, traicionar a la crew o ignorar la salud mental, sí.
- **Cada etapa reformula la misma pregunta a mayor escala:** en Plaza es prestigio local vs. plata; en Nacional es marca vs. respeto; en Estrellato es legado vs. imperio.
- **Epílogo de carrera:** al retirarse (o alcanzar Leyenda), el juego muestra la historia de la partida: línea de tiempo de decisiones clave y el "quién fuiste". Es la pantalla que paga la fantasía retrospectiva y el motor de rejugabilidad.

## Decisiones de diseño registradas (2026-08-06)

| Tema | Decisión | Nota |
|---|---|---|
| **Modelo de tiempo** | **Bloques del día**: cada día se divide en bloques (mañana / tarde / noche); cada bloque admite una acción. | Híbrido entre la Bible ("1 acción por día") y los mockups (costos en horas). Los costos en horas de los mockups se convierten: ≤4 hrs ≈ 1 bloque, 5–6 hrs ≈ 2 bloques. El reloj por horas del código actual migra a este modelo en el refactor. |
| **Plataforma** | **Web primero**; la decisión Steam vs. móvil (Capacitor) se toma en beta con el loop validado. | Ambas salidas comparten el mismo código. |
| **Etapas** | 7 etapas: se agrega **Leyenda** después de Estrellato (según Bible). | El código actual tiene 6 (`StageId`); migrar en el refactor con save-migration. |
| **Estilo visual** | Los mockups de `reference/` son la fuente de verdad (paleta noche azul + neón). Las inspiraciones de la Bible (Eastward, Punch Club, etc.) son referencia de calidad y mood, no de paleta. | Ver `docs/PANTALLAS.md`. |
| **Stats** | Modelo de la Bible: **7 stats entrenables** + stats derivadas + recursos. Salud Mental, Respeto y Fama dejan de ser "stats" y pasan a recursos. | Reconciliar `StatKey` del código en el refactor. |

## Stats y recursos

### Stats entrenables (7)

| Stat | Qué gobierna |
|---|---|
| Flow | Capacidad rítmica y musicalidad |
| Punchline | Poder de remate |
| Métrica | Estructura y técnica |
| Improvisación | Capacidad de responder rápido |
| Escena | Performance en vivo |
| Carisma | Conquista al público, redes, entrevistas |
| Disciplina | Velocidad de progreso |

### Stats derivadas (calculadas, nunca almacenadas)

- `Popularidad = Fans + Carisma + Fama`
- `Calidad de grabación = Micrófono + Interfaz + Monitores`
- (extensible: cada derivada vive en su System, nunca en la UI)

### Recursos

- **Primarios:** energía, dinero, tiempo (bloques).
- **Sociales:** fans, respeto underground, fama mainstream.
- **Personales:** salud mental, estrés.
- **Carrera:** XP, nivel, legado.
- **De batalla:** hype.
- **Momentum/impulso** (racha por variar acciones — ya implementado, conservar).

> Reconciliación pendiente ("Needs Game Design Decision"): los mockups de trabajos otorgan "Agilidad +1", "Resistencia +1", "Fuerza +1", que no existen en este modelo. Propuesta: mapear Resistencia → energía máxima, Agilidad/Fuerza → Escena o Disciplina, o rediseñar los efectos de trabajos al implementar el JobsSystem.

## Tiempo y calendario

- El juego avanza por **semanas** (Lunes → Domingo); cada día tiene **bloques** (mañana/tarde/noche) y cada bloque admite una acción.
- Loop semanal (Bible): entrar a la pieza → planificar semana → ejecutar acciones → resolver consecuencias → eventos → batalla (si existe) → **resumen semanal** → guardar → nueva semana.
- Las batallas y eventos grandes se programan en el calendario (típicamente fin de semana); las oportunidades pueden expirar.

## Acciones núcleo

| Acción | Efecto principal | Costo |
|---|---|---|
| Entrenar | Sube stats | Energía, bloque |
| Trabajar | Genera dinero (+efectos menores) | Energía, bloques |
| Escribir | Genera material, mejora Métrica | Energía, bloque |
| Redes | Genera fans; puede generar hate | Bloque |
| Descansar | Recupera energía y salud mental | Bloque |
| Batallar | Respeto, dinero, rivalidades, desbloqueos | Energía, bloque(s) |

**Regla pilar: no existen acciones gratuitas.** Todo cuesta tiempo, energía, salud mental, dinero o reputación.

## Sistema de batallas

Estructura: **Presentación → Rondas → Resultado → Recompensas.**

Cada ronda: **Estímulo → jugador elige recurso → IA responde → comparación → hype → nueva ronda.**

- **Estímulos:** Barrio, Familia, Escuela, Dinero, Corona, Respeto, Tiempo, Rival, Trabajo, Cultura…
- **Recursos de batalla (10):** Punchline, Flow, Humor, Ataque, Defensa, Métrica, Doble Tempo, Respuesta, Storytelling, Improvisación.
- **Valores de referencia (mockups):** cartas con hype base (Punchline +15, Respuesta +10, Humor +8, Ataque +12, Métrica +8), costo de energía por ronda (10). La resolución por ronda muestra: tu jugada, calificación ("¡BUENÍSIMO! +18 HYPE"), respuesta del rival ("DÉBIL +4") y barra de HYPE TOTAL (56/100).
- **Reglas de tensión:** responder al ataque del rival da bonus; repetir recurso aburre al público (penalización); usar bien el estímulo sube el hype; decidir bajo presión (timer por ronda).

### Decisiones de Batalla v2 (Fase 5 · gauntlet 9, 2026-08-12)

- **Los 10 recursos existen** (`src/data/battle.ts`): cada uno declara las stats
  que alimentan su tirada (varias stats se promedian para que ninguna carta
  escale más que las otras) y su `baseHype` — los valores del mockup donde el
  mockup los muestra (Punchline +15, Ataque +12, Respuesta +10, Humor +8,
  Métrica +8) y hermanos coherentes para el resto.
- **Mano de 5 por ronda** (decisión de diseño, no estaba en la Bible): el mockup
  de batalla muestra exactamente 5 cartas, así que cada ronda se reparte una mano
  de 5 de los 10 recursos con el RNG con seed. Dos reglas la gobiernan:
  **(a)** si el rival atacó la ronda anterior, la mano **siempre** incluye
  Respuesta, para que la decisión de contragolpear exista de verdad; **(b)** la
  mano **no** garantiza un recurso premiado por el estímulo — leer el estímulo es
  reconocer cuándo tu mano le calza. Se reparte de nuevo cada ronda.
- **El rival juega un recurso visible**: el panel de resultado nombra con qué
  respondió. En el gauntlet 9 la elección es uniforme con seed; el gauntlet 10
  (AI Rivals) reemplaza `chooseRivalMove()` por personalidades.
- **Reglas de tensión** (knobs en `BattleConfig.tension`): responder al Ataque da
  bonus; repetir el recurso de la ronda anterior penaliza (y la penalización ya
  viene incluida en el `+N` que muestra la carta, así que la vista previa nunca
  miente); el bonus por estímulo sigue vivo sobre los 10 recursos.
- **Timer de decisión por ronda** (`BattleConfig.timer`, escalado por
  `DifficultyConfig.timerMultiplier`: fácil 21s, normal 15s, difícil 12s). Corre
  solo mientras eliges (se pausa en el veredicto). Al expirar la ronda se
  resuelve como **"Pasada"**: no juegas carta, el rival se lleva la ronda y el
  público se enfría. Vive en `GameController.update(dt)` para que
  `window.advanceTime(ms)` lo pueda testear, y `render_game_to_text` solo expone
  segundos enteros para que las trazas deterministas no dependan de milisegundos.
- **Hype** modifica votos, presión y público.

### IA del rival

Cada rival tiene perfil propio: nombre, nivel, stats (flow, punchline…), personalidad, agresividad, humor, métrica, frecuencia de riesgo. Arquetipos: Agresivo, Técnico, Humorístico, Callejero, Viral, Veteranísimo, Campeón Mundial. El público y los jueces valoran distinto según el evento (plaza premia agresividad; jurado nacional premia técnica).

## Progresión por etapas (7)

**Pieza → Plaza → Regional → Nacional → Internacional → Estrellato → Leyenda.**

Cada etapa desbloquea escenarios, rivales, eventos, sponsors, tiendas y trabajos. El mapa de progreso (pantalla 5 de los mockups) muestra la ciudad con nodos — Tu Pieza, Trabajo, Tienda, Plaza, Gimnasio, Estudio — candados en lo bloqueado y la "Siguiente meta" (ej.: "Ganar 3 batallas en plaza (1/3)").

**El progreso es lento a propósito** (pilar 3): subir de nivel, comprar un micrófono o ganar una batalla debe sentirse importante.

## Economía e inventario

**El dinero nunca debe sobrar** (Bible). Sirve para: equipo, ropa, decoración, estudio, viajes, campañas, videoclips.

### Inventario (4 categorías, con bonus por objeto)

| Categoría | Ejemplos | Tab del mockup de tienda |
|---|---|---|
| Equipo | Micrófonos, interfaces, audífonos, cámaras | EQUIPO |
| Beats | Boom Bap, Trap, Drill, Experimental | BEATS |
| Ropa | Hoodies, gorros, poleras, sneakers | ROPA |
| Decoración | Posters, trofeos, discos, luces, plantas | OTROS |

Precios de referencia (mockup tienda): Micrófono $150 (+15 Punchline, mejora grabaciones), Audífonos $90, Interfaz $200, Monitores $180.

### Trabajos (transcritos de los mockups)

| Trabajo | Horas → bloques | Energía | Pago | EXP | Efecto |
|---|---|---|---|---|---|
| Repartidor | 3 → 1 | −20 | $40 | +10 | Agilidad +1 |
| Lavaplatos | 4 → 1 | −20 | $50 | +10 | Resistencia +1 |
| Obra | 4 → 1 | −35 | $70 | +15 | Fuerza +1 |
| Tienda de ropa | 4 → 1 | −20 | $70 | +15 | Carisma +1 |
| Cajero | 4 → 1 | −20 | $45 | +10 | Disciplina +1 |
| Promotor / volanteo | 3 → 1 | −15 | $30 | +5 | Carisma +1 |
| Creador de contenido | 6 → 2 | −25 | $35 | +20 | Fans +50 |
| DJ en evento | 5 → 2 | −25 | $80 | +15 | Respeto +5 |
| Estudio de grabación | 5 → 2 | −20 | $70 | +20 | Métrica +1 |
| Reparto de mercadería | 5 → 2 | −30 | $55 | +10 | Resistencia +1 |

## Eventos, relaciones y desgaste

- **Eventos semanales** (probabilísticos): entrevista, hate, polémica, sponsor, videoclip, lesión, enfermedad, pelea, viaje, colaboración. **Todos ofrecen decisiones; nunca hay respuesta correcta.** Ejemplos de dilema: ¿firmar con la marca que paga bien pero baja respeto? ¿ir a la batalla cansado? ¿responder la polémica o ignorarla? ¿ayudar a la crew perdiendo una oportunidad propia? ¿disco experimental o comercial?
- **Relaciones con afinidad:** familia, crew, productores, managers, sellos, marcas, fans, rivales.
- **Fatiga:** con energía en cero baja el rendimiento y la improvisación, y aumentan los errores.
- **Salud mental:** afecta disciplina, creatividad, improvisación y estrés; se recupera con descanso, vacaciones, familia, terapia, meditación.

## Victoria y derrota

- **No hay una única victoria:** Campeón Mundial, rapero famoso, productor, empresario, fundador de sello, mentor, leyenda underground.
- **No hay Game Over tradicional:** el jugador siempre puede recuperarse; solo cambian las oportunidades disponibles.

## Estilo visual y música

- Pixel-art HD; la fuente de verdad visual son los mockups (`docs/PANTALLAS.md`): paleta noche, paneles pixel de doble borde, HUD arcade. Inspiración de calidad: Eastward, Dave The Diver, Stardew Valley, Coffee Talk, Pokémon HGSS, Punch Club.
- Música por zona: boom bap, jazz, soul, lo-fi, trap. Cada zona con ambiente propio.

## Alcance del MVP (Bible) y primer arco

Crear MC · Pieza · Calendario · Entrenamiento · Trabajo · Tienda · Inventario · Batallas básicas · Guardado. **Primer arco completo: Pieza → Plaza.**

Roadmap completo (Alpha: redes/eventos/rivalidades/rankings/sponsors; Beta: discos/estudios/videoclips/tours/crew; 1.0: carrera completa/finales múltiples/logros) en `docs/GAME_BIBLE.md`; fases de ejecución en `docs/PLAN.md`.

## Futuro online (post-MVP, en orden)

1. Rankings, perfiles y temporadas.
2. Batallas asincrónicas contra "fantasmas" de otros jugadores.
3. Crews, torneos, ligas y eventos globales.
4. Batallas en vivo con turnos cronometrados, votación de público y jurados.

**Implicancia técnica:** la lógica vive en Systems puros desacoplados del render (ver `AGENTS.md`), reutilizables en backend/simulación de fantasmas.

## Filtro para toda característica nueva (Bible)

1. ¿Hace más interesante tomar decisiones?
2. ¿Genera nuevas historias?
3. ¿Hace que el jugador quiera jugar una semana más?

Si las tres no son "sí", no se implementa.
