# Catálogo de pantallas de referencia

Las imágenes en `reference/screens/` son los mockups oficiales del juego (fuente de verdad visual). Los nombres de archivo son timestamps de generación, no descripciones — este catálogo mapea cada grupo a su pantalla. Los mockups están numerados en pantalla ("2. CREAR MC", "9. TIENDA"), lo que define la serie completa de vistas del juego.

**Importante:** un mismo grupo de timestamp puede contener pantallas *distintas* (no solo variantes). Verificar imagen por imagen antes de usar.

## Mapeo verificado

| Grupo (timestamp) | Archivos | Pantalla | Verificado en |
|---|---|---|---|
| `06_23_13–16` | (1)–(10) | **1. Menú principal** (logo, Nueva carrera / Cargar / Opciones / Créditos / Salir, MC en rooftop, parlantes, v0.1.0, música ON) y **5. Mapa (progreso)** (ciudad isométrica con nodos: Tu Pieza, Trabajo, Tienda, Plaza, Gimnasio, Estudio; candados; nivel + estrellas; "Siguiente meta") | (1) = menú, (5) = mapa |
| `06_25_07–08` | (1)–(3) | **Batalla — pantalla de resultado de ronda** (estímulo FAMILIA, "Tu jugada: Punchline", calificación "¡BUENÍSIMO! +18 HYPE", "Respuesta rival: DÉBIL +4", barra HYPE TOTAL 56/100) | (1) |
| `06_29_41–43` | (1)–(10) | **2. Crear MC** (nombre, apodo, aspecto, color de piel, voz, dificultad, botón Comenzar) | (1) |
| `06_34_33–34` | (1)–(10) | **3. Pieza (base)** — habitación con HUD superior (bust del MC, energía, $, fans, respeto) y dock de acciones: Dormir, Entrenar, Escribir, Redes, Salir. Incluye variantes de progresión: (1) pieza inicial humilde, (5) pieza avanzada (disco de oro, home studio pro, fans 12.450) | (1), (5) |
| `06_37_39–40` | (1)–(4) | **8. Trabajo** — lista de trabajos con pago, panel ilustrado del trabajo seleccionado, dinero actual | (1) |
| `06_39_20` | 1 archivo | **Hoja de cartas de trabajo** — 10 cartas con tiempo/energía/pago/EXP/efecto (datos transcritos en `docs/GDD.md`) | ✔ |
| `06_43_47–49` | (1)–(5) | **9. Tienda** — tabs Equipo/Ropa/Beats/Otros, lista con precios, preview del ítem y su efecto | (1) |
| `06_52_01–02` | (1)–(8) | **10. Batalla** — HUD Tú/Rival (energía + hype), ronda, estímulo central, 5 cartas de jugada con hype base, costo de energía. Variantes por etapa: (1) plaza de barrio, (4) evento grande con escenario ("Combate de Barrios") | (1), (4) |

## Pendiente de verificar

- Los números 4, 6 y 7 de la serie (probablemente **Calendario**, **Entrenamiento** y **Redes sociales**) deben estar entre las imágenes no revisadas de los grupos grandes (`06_23`, `06_29`, `06_34`, `06_52`).
- Al identificar una pantalla nueva, agregar la fila en la tabla de arriba.

## Otros recursos de referencia

| Ubicación | Contenido |
|---|---|
| `reference/sprites/` (`07_07_46–50`) | Capas del arte de portada/menú: cielo nocturno, nubes, ciudad, rooftop, props (parlantes, neón, graffiti). Ya recortadas y optimizadas en `public/assets/main-menu/` |
| `reference/sprites/logo/` (`09_45_25–26`) | Logo "Freestyle Game" (versión transparente ya en `public/assets/main-menu/logo_freestyle_game.png`) |
| `reference/*.pdf` | "Diseño pantallas juego" — compilación de los mismos mockups en PDF |

## Lenguaje visual común (para implementar)

- Paleta: azules noche profundos (#1a1a3e aprox.), paneles azul oscuro con borde pixel claro, acentos: amarillo (títulos/selección), verde (dinero/energía), naranja (hype), rojo (rival/negativo), celeste (info).
- Tipografía pixel monoespaciada, MAYÚSCULAS en labels.
- Paneles con doble borde pixel redondeado y esquinas recortadas; selección con borde amarillo + cursor ▶.
- HUD superior persistente en carrera: bust del MC + barra de energía dominante + tarjetas $/fans/respeto.
- Iconografía pixel consistente: $ verde, fans azul, puño morado (respeto), micrófono, corazón (redes).
- Resolución de diseño: 16:9 (mockups ~1672×941), juego actual 960×540.
