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

### Placeholders que el jugador ve hoy (se resuelven en Fase 4, al reconstruir cada pantalla 1:1)

- **Tienda:** el panel "Vista previa" son rectángulos planos (parlantes + pie de
  micrófono); el mockup `06_43_47 (1)` trae una preview completa del micrófono en
  escenario **y** los 4 iconos de ítem (micrófono, audífonos, interfaz,
  monitores) que aún no se recortan.
- **Redes:** la "Vista previa" es un bloque gris con edificios de rectángulos.
- **Trabajo:** losa gris plana donde el mockup tiene cajas de bodega.
- **Mapa:** 100 % procedural (nodos cuadrados + bloques de ciudad); el mockup
  `06_23_15 (5)` tiene ciudad isométrica con edificios y pines.
- **Calendario:** los 7 "wells" negros bajo cada día quedan siempre vacíos.
- **Menú:** los parlantes del cover se dibujan dentro de cajas negras opacas
  (recorte heredado de Fase pre-1, sin transparencia).

- Variantes del MC (aspecto/color de piel del Crear MC) y poses (rapeando, con mic).
- Rivales por arquetipo (agresivo, técnico, humorístico…) — hoy un solo rival.
- Fondos por etapa: nacional, internacional, estrella, leyenda (reutilizan regional).
- Fondo propio de "cypher en la pieza" para la batalla de etapa pieza (hoy usa el de plaza).
- Iconos de calendario faltantes: ninguno (7/7 mapeados), pero `record`/`show` de la
  vista base no tienen icono propio.
- Paneles/botones 9-slice recortados del mockup (el kit los dibuja con rects).
- Multitud para batallas; props de la pieza que evolucionan con el progreso.
- Sprite sheet de animación (idle/rap) — hoy solo poses estáticas con tween.
