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

### Decisiones de AI Rivals (Fase 5 · gauntlet 10, 2026-08-12)

- **Un rival por etapa con perfil completo** (`src/data/rivals.ts`): nombre, estilo,
  arquetipo, su propio flow y punchline, y las cuatro pesas de personalidad de la
  Bible (agresividad, humor, métrica, frecuencia de riesgo). Los **7 arquetipos**
  existen y todos son alcanzables en una carrera: Callejero (pieza), Agresivo
  (plaza), Técnico (regional), Viral (nacional), Humorístico (internacional),
  Veteranísimo (estrellato), Campeón Mundial (leyenda).
- **Cómo la personalidad elige la jugada**: se arma un peso por recurso partiendo
  de una base plana (nada es imposible), y se le suman las pesas de personalidad
  (agresividad levanta Ataque/Punchline y baja Defensa; humor levanta Humor y
  Storytelling; métrica levanta Métrica/Doble Tempo; la frecuencia de riesgo
  levanta las cartas de alto hype y baja Defensa) más el sesgo propio del
  arquetipo. Todo con piso mínimo: **un rival legible igual puede sorprender**.
  La elección se resuelve con **exactamente un draw de RNG** sobre el peso
  acumulado — el arnés de trazas deterministas depende de esa cuenta.
- **El recurso que juega el rival importa mecánicamente**: sus stats alimentan la
  tirada del recurso que interpreta (un Punchline de un rival punchlinero pega más
  que el mismo Punchline de un técnico métrico). Qué recurso se apoya en cuál stat
  es data (`BattleConfig.rivalResource`).
- **Público/jueces por evento**: cada etapa declara qué recursos premia y cuáles
  la dejan fría (`crowdByStage`), y eso multiplica el hype que paga una ronda
  ganada. Vive **dentro de `projectedHypeGain`**, así que el `+N` que muestra la
  carta sigue siendo exactamente lo que paga ganar — en la Final Nacional el
  Punchline se ve +20 y la Métrica +8. La pantalla dice en una línea qué quiere
  esa sala, para que jugarle al público sea una decisión y no una adivinanza.

### Decisiones del calendario semanal (Fase 6 · gauntlet 3 v2, 2026-08-12)

- **El plan vive en el save**: `state.plan` es un slot por día (el mockup dibuja
  exactamente uno por tarjeta) y guarda **intención**, no ejecución. Planificar es
  gratis y reversible; lo que cuesta es vivir el día.
- **Un día es un compromiso**: al ejecutarlo queda registrado y no se puede
  repetir (`dayAlreadyLived`). Los bloques que sobren del día se usan desde la
  pieza, así el sistema de 3 bloques sigue vivo sin que el plan se pueda farmear.
- **Un día sin plan se va en nada** (cuesta impulso y lo dice), y un **plan roto**
  —agendaste algo que al llegar el día no podías pagar— cae a descansar
  explicándolo. Sobre-planificar tiene precio y nunca desaparece en silencio.
- **La cita de la semana**: la batalla solo se puede **agendar** el sábado
  (`PlanConfig.week.battleDay`), lo que le da forma a la semana: los días previos
  son un trade-off real porque hay que llegar con energía. Se puede **saltar** la
  cita agendando otra cosa ahí: esa también es una decisión.
- **Resumen semanal** (paso del loop de la Bible): al girar la semana se cierra
  con sus deltas de plata/fans/respeto/XP y el conteo de batallas. El conteo sale
  de un **resultado guardado en el día** (`outcome`), no de leer el texto del
  evento, porque la batalla se resuelve después en su propia escena y el texto
  puede cambiar sin aviso.
- **Las flechas del mockup ya no son decorativas**: navegan el historial de
  semanas cerradas que guarda el save, acotado a 12 semanas para no inflarlo.
- **Oportunidades con fecha** (`src/data/opportunities.ts`): cada semana golpean
  hasta dos ofertas (radio, cypher sorpresa, pega extra, videoclip, sponsor,
  podcast, colaboración), filtradas por etapa. Se agendan **solo el día que
  llegaron**, cuestan energía y bloques, y **se pierden con aviso** si el día
  pasa. Algunas tienen filo: el sponsor paga bien y **baja respeto**, la pega
  extra da plata y **baja impulso**. El sorteo consume una cantidad **fija** de
  draws de RNG (tres por ranura) para que el arnés determinista no se corra según
  el resultado, y hay semanas en que no golpea nada — eso es lo que hace que las
  semanas cargadas se sientan cargadas.
- **Descanso obligatorio** (`OpportunityConfig.burnout`): bajo el piso de salud
  mental **todo se cierra menos descansar**, con el motivo dicho en cada acción.
  El juego deja de permitirte cavar más hondo.
- **Impulso visible**: es un modificador real de las tiradas de batalla, así que
  el panel de planificación lo muestra con su ánimo en vez de dejarlo escondido
  dentro del texto de los eventos.
- **Resuelto (decisión del owner, 2026-08-13): dos niveles, no una regla rígida.**
  El problema no era "estricto o no": era que `battle` y `cypher` eran casi lo
  mismo (en la pieza la "batalla" se llamaba literalmente *cypher con amigos*).
  Ahora:
  - **Cypher = entrenamiento, con su propia pantalla.** Cualquier día. Tiras un
    recurso, ruedas contra **tus propias stats** (no hay rival ni medidor de
    hype) y lo que te llevas son **puntos en las stats que ese recurso ejercita**.
    Es la válvula de siempre-puedes-rapear.
  - **Evento de etapa = la batalla.** Tiene **fecha** (se agenda el sábado), paga
    los premios de etapa y cuenta para las metas. Es la cita que le da forma a la
    semana.
  - Con eso la semana tiene stakes **sin** encerrar a nadie. La acción `battle`
    **no** quedó cerrada fuera del sábado: la cita sigue rigiendo el **plan**, y
    la PLAZA del mapa sigue abierta. Cerrarla es ahora seguro (el cypher cubre el
    hueco) si el owner lo quiere; es una línea.

### Dilemas e identidad (Fase 7 · primera tajada, 2026-08-13)

Aquí el principio rector deja de ser una intención y pasa a ser código.

- **Cuatro ejes** (`state.axes`, −100..+100, **todos en 0** al empezar):
  underground↔comercial, batallero↔músico, lobo solitario↔crew,
  auténtico↔polémico. Nadie nace comercial: el eje se mueve **solo** decidiendo.
- **Los dilemas tienen pantalla propia** (`DilemmaScene`): la pregunta arriba y
  las dos respuestas lado a lado como una bifurcación. Cada opción muestra **lo
  que cuesta con el mismo tamaño que lo que paga** — esconder el costo haría que
  un lado pareciera la respuesta correcta, y la regla de la Bible es que no la
  hay. Debajo, "TE MUEVE HACIA" dice a qué te acerca cada camino: es la parte
  honesta de la pantalla.
- **Un test fija la regla**, no solo el comentario: ningún dilema puede tener dos
  opciones que muevan **todos** los ejes igual, porque entonces habría una
  respuesta correcta.
- **Registro de decisiones** (`state.decisions`): cada elección queda con semana,
  día, qué elegiste y qué movió. Es la memoria de la carrera. Acotado a 60 para
  no inflar el save — y cuando una línea vieja se cae, **los ejes que movió ya
  están horneados**, así que no se pierde historia real.
- **Los ejes ya deciden qué te pasa**: un dilema puede exigir un umbral de eje
  (`requires`), así dos jugadores en la misma semana pueden recibir situaciones
  distintas. Ahí empieza la divergencia.
- **Se ve en pantalla**: Estadísticas tiene "QUIEN VAS SIENDO" con los cuatro
  ejes como sliders y la última decisión. Un MC que no decidió nada dice **"Sin
  definir"** en vez de inventarle una etiqueta.
- **Ritmo**: como máximo **un dilema por semana** y ninguno en la primera (el
  jugador necesita entender el loop antes de que le pidan jugarse algo). El
  sorteo consume una cantidad fija de draws para no correr el arnés.
- Números en `src/data/config/DilemmaConfig.ts`, contenido en `src/data/dilemmas.ts`.

### Contenido de batalla: tres rivales por etapa y 16 estimulos (Fase 9, 2026-08-13)

Con **un** rival por etapa, la segunda batalla de una etapa era idéntica a la
primera: mismo nombre, mismo arquetipo, mismas lecturas. Ahora hay **tres por
etapa, 21 en total**, y cada etapa **mezcla arquetipos** a propósito — así aprender
a leer a un "agresivo" sirve contra otro agresivo más adelante, y siempre hay
alguien cuyas mañas no viste.

- **Quién aparece se sortea con peso por rencor.** Un rival al que humillaste es
  más probable que te esté esperando que un desconocido: a rencor máximo es ~3×
  más probable, y **nunca** deja fuera a los otros. Eso convierte el registro de
  rivalidades en algo que te pasa, no en una tabla que consultas. Consume
  exactamente **una** tirada de RNG, como todo el resto (el arnés lo exige).
- **Efecto medido en el arco real:** de una rivalidad por arco a **dos**, y la del
  historial reaparece — "Tuti 3-1, rencor 90: Te odia. Vino a cobrar." Y **la curva
  de dificultad no se movió** (las tasas quedan dentro del ruido), que era el
  objetivo: agregar contenido no debe re-balancear el juego.
- **16 estímulos** (eran 10). Los 10 de la Bible siguen ahí y en orden — su lista
  termina en puntos suspensivos, así que es un piso y no un techo — y los seis
  nuevos son del mismo mundo: Hambre, Envidia, Origen, Noche, Micro, Miedo.

**Resuelto: la ventana de silencio se cuenta en días, no en semanas.** El criterio
de la Fase 7 ("al menos 3 dilemas antes de Plaza") chocaba con un ascenso rápido:
al hacer las batallas ganables, un jugador con suerte asciende en **3 semanas**, y
con un dilema por semana y la primera en silencio el techo era **2** — por debajo
del criterio del propio plan, y ninguna probabilidad levanta un techo (lo probé
subiendo la tasa de 0,40 a 0,50 y la medición lo desmintió).

La razón del silencio inicial era *"que el jugador entienda el loop antes de que le
pidan jugarse algo"*, y eso toma **días**, no una semana entera de 21 bloques. Así
que `quietDays: 4`: el primer dilema puede caer el día 5, cuando ya viste la pieza,
el calendario y una batalla. No se tocó la reja de Plaza (su ritmo ya estaba
medido) ni la intención original. Medido en cuatro semillas: **3, 4, 3 y 3
dilemas** — el criterio se cumple en todas, con arcos de 4 a 9 semanas según cómo
te vaya en las batallas.

### Costo de vivir: que la plata sea escasa (Fase 9, 2026-08-13)

Medido con `node scripts/measure-economy.mjs`. La Bible pide que **"el dinero
nunca debe sobrar"**, y la medición mostró algo peor que sobrar: **la plata no
bajaba nunca**. Diez semanas simuladas, 210 acciones, y el saldo seguía en los $25
del arranque. No había **ningún** sumidero: trabajar pagaba, las batallas pagaban,
y lo único que sacaba plata eran compras voluntarias. Un turno de trabajo
financiaba una carrera entera, así que "trabajar" era un botón que nadie
necesitaba apretar.

- **La semana se cobra al cerrarse** (`LivingSystem`): $58 en la pieza, +$26 por
  etapa. Dimensionado contra el trabajo, que paga ~$48 por turno de dos bloques:
  la semana cuesta poco más de un turno, o sea **un octavo de los 21 bloques**.
  Suficiente para que el presupuesto sea una línea real del plan, no tanto como
  para que el juego se vuelva un empleo.
- **Aprieta más al principio.** Los premios de batalla suben más rápido (+$85 por
  etapa) que el costo de vivir (+$26), así que la presión afloja a medida que la
  carrera crece — que es la forma correcta.
- **No alcanzar no termina nada** (regla de la Bible: no hay Game Over). Pagas lo
  que tengas y el resto **aterriza en la gente**: baja el lazo con la familia
  ("lo cubrieron en tu casa"), baja el momentum y duermes peor. Es una historia,
  no un muro. Y **no cuenta como visita**: la deuda no repone el lazo.
- **Lo que esto destapó de golpe:** con la plata escasa, el recorrido autónomo
  pasó de ganar 5 de 5 batallas a **3-2**, de terminar con $250 a $81, y **la crew
  se le enfrió a 24** ("Te estás alejando de: Crew") porque tuvo que trabajar en
  vez de ir al cypher. La economía dejó de ser un número y se volvió una
  consecuencia de relación: exactamente el tipo de enganche entre sistemas que
  busca el filtro de la Bible.
- Números en `src/data/config/LivingConfig.ts`.

### Balance de batalla (Fase 9, 2026-08-13)

Medido con `node scripts/measure-battles.mjs`, que juega miles de batallas con las
reglas reales y tres políticas: **naive** (siempre la primera carta), **greedy**
(la de mejor hype previsto) y **worst** (la peor, a propósito).

**Lo que estaba roto.** La curva era un serrucho que terminaba en trámite: un MC
nuevo ganaba **8%** de su primera batalla, y en regional y nacional ganaba **100%
con cualquier política**, incluso jugando la peor carta. O sea la habilidad no
existía. Tres causas:

1. **Dificultad escondida en los dados.** El azar del jugador era 7..26 (media
   16,5) y el del rival 12..34 (media 23): un **+6,5 fijo** contra el jugador que
   ninguna perilla de dificultad podía ver. Ahora los dos dados son idénticos y la
   dificultad vive **solo** en `rivalPower`.
2. **El hype se realimentaba solo para el jugador.** Ganar una ronda subía tu
   hype, que subía tu tirada siguiente; el rival tenía medidor en pantalla pero no
   lo usaba. Por eso los márgenes medidos eran casi siempre barridas de 3-0. Ahora
   el público levanta **a quien lo tiene**, y vale hasta +8 en vez de +12.
3. **El rival crecía con la etapa; el jugador, con sus stats.** Al llegar a Plaza
   el MC ya tiene stats promedio **11,7** (no 6, como supuse durante tres pasadas
   de ajuste antes de medirlo). El rival ahora sigue lo que el jugador **entrenó**,
   casi 1:1.

**El principio de diseño que salió de ahí:** el premio de entrenar **no** es
ganarle más fácil al mismo rival, sino **poder subir de etapa**. La ventaja del
jugador tiene que venir de la preparación (energía, salud, momentum, el estímulo)
y de elegir bien la carta.

**La curva resultante** (evidencia en `output/web-game/fase9-balance/`):

| perfil | naive | greedy | worst |
|---|---|---|---|
| pieza semana 1 | 82% | 96% | 64% |
| pieza semana 3 | 73% | 97% | 33% |
| plaza | 48% | 85% | 14% |
| plaza, cansado | 16% | 19% | 5% |
| regional | 54% | 80% | 16% |
| nacional | 46% | 82% | 49% |

La primera etapa es indulgente a propósito (estás aprendiendo), desde Plaza el
jugador distraído queda en una moneda al aire, y **entre jugar bien y jugar mal
hay 30-70 puntos en cada etapa**. Pelear cansado se castiga fuerte, que es lo que
hace que descansar sea una decisión.

**Anotado, no resuelto:** en nacional la política *worst* gana más que *naive*. El
preview de la carta dice cuánto **hype** paga, no qué tan probable es ganar la
ronda, así que "la peor carta" por hype no es la peor por tirada. Es una honestidad
pendiente de la UI, no un defecto del balance.

### Relaciones y rivalidades (Fase 7, 2026-08-13)

Las relaciones existen para que **la semana sea más difícil de planificar**, no
para agregar una pantalla de números. De las ocho de la Bible se implementan las
dos que ya están antes de que nadie sepa tu nombre, más los rivales:

- **Los lazos decaen.** La afinidad sube solo si **apareces**, y cada semana que
  pasa sin aparecer se lleva un pedazo. Eso es lo que convierte "descansar" de un
  bloque perdido en una decisión con motivo, y lo que hace que el cypher sea más
  que entrenamiento. Un lazo que solo subiera sería contabilidad.
  - **Familia** se alimenta con descansar; **Crew**, con el cypher (y poco con
    redes: postear es hablarle a todos, no a ellos).
  - **Cobran en la moneda del juego, no en puntos**: con la familia firme una
    noche de descanso **sana más**, y con la casa abandonada sana **menos**; con
    la crew firme entras a la batalla con **hype de ventaja**.
  - **Los bonos se miden desde donde el lazo empieza**, no desde cero: así una
    carrera nueva no cobra nada y agregar relaciones **no re-tunea en silencio**
    el balance de batalla y descanso que se acababa de medir.
  - Un dilema que elige la crew **calienta a la crew** — la decisión aterriza en
    una persona, no solo en un slider. Pero **no** repone la visita: contestar
    dilemmas no reemplaza aparecer.
- **Las rivalidades recuerdan.** Cada cruce queda con nombre, récord y *heat* (el
  rencor). Ganarle a alguien le sube más el rencor que perder contra él —
  el que tiene algo que probar es el que perdió el último round— y **ganar por
  paliza es humillación**, que se recuerda más. El rencor le compra al rival
  **poder y agresividad** la próxima vez (acotados), decae si no se cruzan, y la
  pantalla de batalla **lo dice en voz alta** bajo su arquetipo: "Te tiene ganas."
  / "Viene por la revancha." / "Te odia. Vino a cobrar." En un primer cruce
  **calla**: una advertencia sobre cada rival escondería las de verdad.
- **Pantalla propia** ("14. QUIEN VAS SIENDO"): los cuatro ejes a tamaño real, el
  destino emergente, los lazos con su temperatura en palabras, lo que decidiste y
  los rivales que te recuerdan. Nació de un defecto: el panel de identidad vivía
  encima de la mitad baja de la columna izquierda de Estadísticas, en una banda
  que **no** estaba libre — tapaba el nombre del MC, el nivel de carrera y la
  barra de XP. Se aplicó la regla del owner para el cypher: si merece pantalla,
  que tenga la propia.
- **La visita paga una vez por semana y el decay se cobra siempre.** Primero era
  al revés (cada acción sumaba, el decay solo si no habías aparecido) y una
  medición del arco completo lo desarmó: los dos lazos terminaban en **100/100**
  en cinco semanas, o sea el lazo era un trinquete hacia arriba y el decay nunca
  mordía. Con la regla corregida, la misma partida termina con **familia 93 y
  crew 36** — el jugador descansa seguido y va poco al cypher, y eso se ve en
  quién lo acompaña. Es la diferencia entre una mecánica y una planilla.
- Números en `src/data/config/RelationshipConfig.ts`, contenido en
  `src/data/bonds.ts`, reglas en `src/systems/RelationshipSystem.ts`.

### Desbloqueo de nodos del mapa (Fase 7, decisión 2026-08-13)

El plan pedía "desbloqueo de nodos (gimnasio, estudio)". Quedó así:

- **El estudio se canda solo, y bien**: su acción `record` exige 60% de canción y
  plata, y el mapa dibuja el candado con ese motivo. No se le agregó una segunda
  reja de progresión: dos rejas sobre la misma puerta terminan contradiciéndose.
- **El gimnasio NO se canda**, y es deliberado. Lo implementé (nivel 3, respetado
  por el mapa, el dock y la tecla) y al verlo funcionando lo reversé por dos
  razones concretas: un jugador nuevo aprieta ENTRENAR —lo más obvio en un RPG—
  y recibe "todavía no", lo que **esconde el vocabulario de los siete stats** en
  el primer minuto; y practicar en la pieza es la fantasía inicial declarada del
  juego ("empezaste rapeando contra la pared de tu cuarto"). Además el arnés de
  trazas perdía la cobertura de esa pantalla. Si el owner lo quiere candado
  igual, es una línea de data.
- Lo que el mapa **sí** hace desde la Fase 4 y sigue: la meta de etapa con su
  progreso ("SIGUIENTE META: Abrir Plaza · Nv 3/5 · Resp 12/45") y el candado de
  cada lugar leído de la acción real que hay detrás, nunca inventado.

### Epílogo de arco: los destinos se leen, no se eligen (Fase 7, 2026-08-13)

- **Al cambiar de etapa el loop se detiene** y muestra el **cierre del capítulo**
  (`EpilogueScene`). Nada del texto está enlatado: se **compone** desde lo que el
  jugador hizo — los ejes que movió, las decisiones de **ese** capítulo, las
  batallas y las semanas que tardó. Dos jugadores que llegan a Plaza la misma
  semana leen capítulos distintos.
- **Los destinos de la Bible son atractores** (`destinyAttractors`): perfiles con
  umbrales de eje. Cuando varios calzan, gana **el que el jugador marcó más
  fuerte** (se puntea qué tan lejos pasó cada umbral), no el primero de la lista —
  con +52 comercial y +30 músico, "Estrella" es la lectura honesta, no "Productor".
  Un test verifica además que **todos** los atractores son alcanzables: un perfil
  que nunca se puede leer es contenido muerto.
- **Sin decisiones no hay destino**: un MC que no se definió lee eso mismo. No se
  le inventa un final.
- **El epílogo es un espejo, no una cinemática**: no consume RNG, y se puede
  reconstruir desde el estado en cualquier momento (por eso el capítulo no se
  guarda: se guarda **qué** capítulo está pendiente, para que un milestone
  sobreviva a un reload en vez de perderse).
- Contenido en `src/data/epilogues.ts`, reglas en `src/systems/EpilogueSystem.ts`.

### El cypher como entrenamiento (decisión del owner, 2026-08-13)

- **Su propia pantalla** (`src/scenes/CypherScene.ts`), no la de batalla: sin HUD
  de rival, sin medidor de hype, sin premios de etapa. El círculo de amigos
  alrededor, puntos de turno arriba, y tres cartas anchas que **dicen qué entrena
  cada recurso** — que es la razón para elegir una sobre otra.
- **Ruedas contra ti mismo** (`CypherSystem`): la tirada es tus stats + un dado,
  así el veredicto responde "¿te salió?" (LIMPIO / SALIO / TRABADO) en vez de
  compararte con un rival. Mejorar se vuelve visible.
- **Paga en stats, turno por turno.** Un turno limpio enseña más que uno trabado,
  pero **un turno trabado también enseña** — eso es practicar. Repetir el mismo
  recurso en el mismo círculo enseña menos: la variedad es el punto.
- **El costo se cobra al cerrar el círculo**, no al abrirlo (energía + 1 bloque),
  así irse a la mitad no es gratis. El respeto solo llega si **todos** los turnos
  salieron limpios: un cypher no es un escenario. Nunca paga plata ni fans.
- Números en `src/data/config/CypherConfig.ts`.

### Decisiones de game feel (Fase 5 · cierre, 2026-08-12)

- **Nada se anima con tweens de Phaser**: el arnés congela `Date.now` y el
  TweenManager de Phaser 4 saca su delta de ahí, así que un tween queda quieto en
  toda captura. Los primitivos viven en `src/ui/fx.ts` y avanzan con el **delta de
  frame**: `EasedValue` (persigue un objetivo, independiente del framerate),
  `Shake` (decae y **siempre vuelve a cero**, sin `Math.random` para no romper
  paridad) y `Pulse` (rampa 0→1 con salida suave).
- **Qué se siente en la batalla:** la mano **entra deslizándose** cuando se
  reparte la ronda; los medidores de hype **persiguen** su valor en vez de saltar;
  la pantalla **tiembla** al resolverse la ronda, más fuerte cuando el golpe lo
  recibes tú que cuando lo das; y la **sala responde al hype** (calidez creciente
  + un destello cuando la ronda gana mucho hype).
- **Honestidad del público:** el *sprite* de multitud sigue pendiente
  (`docs/ASSETS.md`). Lo que reacciona es la **luz de la escena existente**, no
  una multitud inventada.
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
- **Relaciones con afinidad:** familia, crew, productores, managers, sellos, marcas, fans, rivales. **Implementadas (Fase 7):** familia, crew y rivales (ver "Relaciones y rivalidades"). Los fans ya son un recurso; productores, managers, sellos y marcas esperan contratos que les den sentido.
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
