# Catálogo de assets runtime

Todos los assets viven en `public/assets/` y se referencian **solo** vía
`src/game/AssetRegistry.ts` (regla AGENTS.md: nunca rutas inline; excepción
documentada: los `@font-face` de `src/styles.css`, que el navegador resuelve
antes de que exista el registry). Origen de verdad visual: `reference/` (ver
`docs/PANTALLAS.md`).

**Pipeline de extracción** (lecciones de la primera pasada, que el crítico
reprobó):

1. Detectar el bbox real del contenido dentro del mockup (fondo de panel =
   azul dominante, `b - max(r,g) >= 8 and b < 150`) y **expandirlo 3 px**. Los
   recortes "a ojo" cortaban siluetas (pesa, sonrisa, lápiz).
2. Remover fondo en dos pasadas: flood desde los bordes con ese predicado de
   color (protege los contornos negros, donde `r≈g≈b`) y luego barrido global
   del mismo predicado (mata el fondo encerrado, p. ej. dentro del arco de los
   audífonos). **Nunca** flood por umbral de brillo/distancia RGB: eso se comió
   el mango del micrófono y lo dejó en confeti.
3. Trim al bbox alfa + descarte de componentes desconectados < 3 % del mayor.
4. Escalar a **exactamente 64 px de alto** (LANCZOS) para que el display a
   32 px sea un ×0.5 exacto y quede nítido.

Personajes: recorte del mockup + remoción de fondo con IA (`remove_background`)
+ trim; escalados a ~2× del display.

## Personajes (`characters/`) — Fase 3

| Archivo | Tamaño | Origen | Uso |
|---|---|---|---|
| `mc-idle.png` | 101×240 | Mockup "2. Crear MC" (`06_29_41 (1)`), fondo removido con IA | MC de pie en carrera, menú, crear MC, vistas, batalla (izquierda) |
| `mc-bust.png` | 97×96 | Recorte superior de `mc-idle` | Bust del HUD de carrera |
| `rival-idle.png` | 134×220 | Mockup resultado de batalla (`06_25_07 (1)`), fondo removido con IA | Rival en batalla (derecha) |

## Iconos (`icons/`) — Fase 3

Todos exactamente 64 px de alto; se muestran a 32 px (×0.5 exacto). El kit los
escala **contenidos en una caja** (`addSpriteImage(..., maxWidth)`) para que la
pesa ancha y el teléfono angosto no queden con pesos visuales dispares —
aproximación por caja, no igualación óptica real.

| Archivo | Glifo | Origen (mockup) | Uso |
|---|---|---|---|
| `action-rest.png` | Cama | Dock de "3. Pieza" (`06_34_33 (1)`) | Tile Dormir; calendario `rest` |
| `action-train.png` | Pesa | ídem | Tile Entrenar; calendario `practice` |
| `action-write.png` | Papel+lápiz | ídem | Tile Escribir; calendario `write` |
| `action-social.png` | Teléfono | ídem | Tile Redes; calendario `social` |
| `action-exit.png` | Puerta | ídem | Tile Mapa (salir de la pieza) |
| `res-cash.png` | $ verde | HUD de "3. Pieza" | Tarjeta de dinero; calendario `work` |
| `res-fans.png` | Personas azules | ídem | Tarjeta de fans |
| `res-respect.png` | Puño morado | ídem | Tarjeta de respeto |
| `battle-punchline.png` | Micrófono | Cartas de "10. Batalla" (`06_52_01 (1)`) | Carta Punchline; calendario `battle` |
| `battle-respuesta.png` | Globo de diálogo | ídem | Carta Responder; calendario `cypher` |
| `battle-humor.png` | Carita | ídem | Carta Humor |
| `battle-ataque.png` | Puño | ídem | Carta Escena (presencia escénica) |
| `battle-metrica.png` | Nota musical | ídem | Carta Técnica |
| `battle-flow.png` | Audífonos | Fila Audífonos de "9. Tienda" (`06_43_47 (1)`) | Carta Flow |

## Fuentes (`fonts/`) — Fase 3

| Archivo | Rol | Licencia |
|---|---|---|
| `PressStart2P-Regular.ttf` | Solo texto grande (≥ ~20 px): títulos de vista, "RONDA N", palabra del estímulo — `DISPLAY_FONT_FAMILY` / `addDisplayText()` | OFL (`OFL.txt`) |

Carga bloqueante en `src/main.ts` (`document.fonts.load` con timeout de 1.5 s)
para que Phaser no cachee métricas de la fuente fallback.

**El texto de cuerpo sigue en la mono del sistema, a propósito.** VT323 se probó
como fuente de cuerpo y se revirtió: a los 10–14 px que usa este layout pierde
trazos ("SEM 1.1" se renderizaba "SEN :.1", "ACTUAL" → "ACTLAL"), una regresión
de legibilidad en todas las pantallas que ningún ajuste de tamaño resolvió.
Adoptar una pixel font para el cuerpo exige re-tunear los tamaños de cada
pantalla: eso es trabajo de la Fase 4, donde cada vista se reconstruye contra su
mockup.

## Escenas (`scenes/`) — Fase pre-1 (ImageGen)

| Archivo | Uso |
|---|---|
| `pieza-home-studio-v1.png` | Fondo de **carrera** en etapa pieza |
| `plaza-cypher-v1.png` | Fondo de carrera en plaza, y de **batalla** en pieza+plaza |
| `regional-stage-v1.png` | Fondo de carrera y batalla regional+ (reutilizado — pendiente arte por etapa) |

**Carrera vs. batalla usan mapeos distintos** (`stageBackdropKey` vs.
`battleBackdropKey` en `AssetRegistry`): ningún mockup de batalla ocurre en un
dormitorio, y el piso de la pieza está cortado por muebles (velador, sofá,
cajones), así que los personajes quedaban parados encima de ellos. Los fondos de
batalla tienen suelo continuo y permiten la composición ancha del mockup
(anclas x=160 / x=706, pies en y=308, libres de la tarjeta de estímulo y del
panel de decisiones).

## Menú (`main-menu/`) — Fase pre-1 (de `reference/sprites/`)

Capas del cover: `bg_sky_night`, `bg_clouds`, `bg_city_back`, `bg_city_front`,
`bg_rooftop_floor`, `bg_rooftop_fence`, props (`prop_neon_rap`,
`prop_graffiti_freestyle`, `prop_speaker_left/right`) y
`logo_freestyle_game.png`.

## Pendientes (anotar aquí, no improvisar — regla CLAUDE.md #2)

### Iconos generados (2026-08-13) — 17 nuevos

Los 17 iconos que faltaban **existen** y están enchufados. No se recortaron de
`reference/` porque **no había fuente**: los mockups solo muestran 5-6 iconos de
batalla y ninguno de ítem, así que se **generaron** en el estilo de los
existentes y se pasaron por un pipeline nuevo.

- **Batalla (4):** `battle-defensa`, `battle-dobletempo`, `battle-storytelling`,
  `battle-improvisacion`. Con esto los **10 recursos de la Bible** tienen arte y
  ninguna carta cae al marco punteado.
- **Ítems de tienda (11):** `item-interfaz`, `item-monitores`, `item-gorra`,
  `item-zapatillas`, `item-chaqueta`, `item-mesa`, `item-cuaderno`,
  `item-beat-boombap`, `item-beat-trap`, `item-pack-acapella` (micrófono y
  audífonos siguen usando los cortes del mockup, porque **son** esos objetos).
- **UI (3):** `ui-cart` (carrito de la tienda), `action-offer` (la oportunidad
  agendada de la Fase 6) y `res-fame` (la estrella de fama, que antes se
  componía con rects).

**Cómo se hicieron, para poder repetirlo:** se pidió cada icono con el mismo
prompt base ("pixel art, píxel grueso en grilla 32x32, contorno negro grueso,
sombreado plano de tres tonos, objeto único centrado, fondo plano") y se procesó
con `node scripts/process-icon.mjs <in> <out>`, que hace dos cosas que un recorte
ingenuo hace mal:

1. **Quita el fondo por flood fill desde el borde**, igualando el color que el
   borde tenga de verdad (el generador ignora "fondo negro" y suele devolver
   blanco). Los píxeles interiores de ese mismo color **sobreviven** — es el
   error que en Fase 3 convirtió el micrófono en confeti.
2. **Encaja el arte en su grilla nativa** (promedia a 32px de alto y luego escala
   x2 con vecino más cercano). Bajar directo de 1024 a 64 deja bloques de 2px y
   de 1px mezclados, que se lee como un icono borroso al lado de los recortados.

Se verificó lo mismo que exige el proyecto: **64px de alto exactos, esquinas
transparentes**, y los iconos vistos **dentro del juego** (batalla y las cuatro
pestañas de la tienda) junto a los del mockup para comparar estilo. Evidencia en
`output/web-game/arte-iconos/`.

Dos notas honestas: son **arte generado, no recortado del diseño oficial**, así
que si alguno no calza con tu idea, reemplazarlo es un prompt; y el filtro de
contenido rebotó tres veces (gorra, mesa, chaqueta) con falsos positivos —
salieron reformulando el prompt.

### Sigue pendiente (ilustraciones, no iconos)

**Resuelto (2026-08-13): la ciudad isométrica del mapa.** No hacía falta
ilustrarla: ya existía dentro del mockup del mapa. `map-city-v1.png` (928×348,
225 KB, 128 colores) se construye con `node scripts/build-map-city.mjs`, que
recorta la ciudad de `reference/screens/...06_23_15 a.m. (5).png` y le **quita la
UI horneada** (seis píldoras, el MC, dos candados, el pin de ubicación, los
caminos punteados y los anillos de plataforma) para que el juego siga dibujando
todo eso desde el estado real. Detalles del método y de los tres errores que
costó afinarlo, en la cabecera del script.

Esto es lo que queda, y es de otra escala: son **ilustraciones**, con más riesgo
de no calzar con el estilo del mockup.

- **Multitud de batalla**: el mockup tiene público rodeando el cypher; hoy
  reacciona la **luz** de la escena al hype, no una multitud.
- **Ilustraciones de trabajo (4)** y sus iconos de fila, con el hueco de 406×168
  ya reservado.
- **Preview por ítem** de la tienda (el mockup los muestra sobre un escenario);
  hoy escala el icono de la fila.
- **Variantes del MC por aspecto y color de piel**: los selectores de Crear MC
  cambian el estado, pero el sprite es el mismo.
- **Fondo en formato retrato** para el marco de Crear MC.
- **Arte por stat** (libros, foco, manos-corazón, cerebro) para Entrenamiento.
- **"Cypher en la pieza"** como fondo de batalla temprana.
- **Música por zona** (boom bap / jazz / soul / lo-fi / trap, según la Bible). Los
  **SFX no son un pendiente**: se sintetizan con WebAudio (`src/data/sounds.ts`),
  así que no hay archivos que cargar ni que falten. Una pista de boom bap sí es
  otra cosa — no la fingen unos osciladores — y `AudioService` está hecho para que
  meter los archivos después no necesite plomería nueva.

### Placeholders resueltos en Fase 4

Las cinco pantallas que en Fase 3 mostraban rectángulos desnudos (previews de
Tienda y Redes, Trabajo, Mapa, "wells" del calendario) se reconstruyeron contra
sus mockups; lo que queda es **arte pendiente** con su hueco ya reservado (lista
de arriba), no maquetas vacías. También se corrigió el bug de los parlantes del
menú: el cover es RGB opaco y se componía con `LIGHTEN`, que el renderer WebGL de
Phaser 4 no implementa para game objects (caía a NORMAL en silencio y tapaba la
ciudad con cajas negras); ahora cada capa se croma por color a una textura canvas
cacheada.

- Variantes del MC (aspecto/color de piel del Crear MC) y poses (rapeando, con mic).
- Rivales por arquetipo (agresivo, técnico, humorístico…) — hoy un solo rival.
- Fondos por etapa: nacional, internacional, estrella, leyenda (reutilizan regional).
- Fondo propio de "cypher en la pieza" para la batalla de etapa pieza (hoy usa el de plaza).
- Iconos de calendario faltantes: ninguno (7/7 mapeados), pero `record`/`show` de la
  vista base no tienen icono propio.
- Paneles/botones 9-slice recortados del mockup (el kit los dibuja con rects).
- Multitud para batallas; props de la pieza que evolucionan con el progreso.
- Sprite sheet de animación (idle/rap) — hoy solo poses estáticas con tween.
