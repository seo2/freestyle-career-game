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

## Serie completa identificada (2026-08-07)

Se generó una hoja de contactos con el borde superior de los 51 mockups para leer
sus títulos numerados. Resultado — archivos exactos por pantalla:

| # | Pantalla | Archivo canónico |
|---|---|---|
| 1 | Menú principal | `06_23_13 a.m. (1).png` |
| 2 | Crear MC | `06_29_41 a.m. (1).png` |
| 3 | Pieza (base) | `06_34_33 a.m. (1).png` (inicial) · `06_34_34 a.m. (5).png` (avanzada) |
| 4 | **Calendario semanal** | `06_23_14 a.m. (4).png` (sin número impreso) |
| 5 | Mapa (progreso) | `06_23_15 a.m. (5).png` |
| 6 | **Entrenamiento** | `06_23_15 a.m. (6).png` |
| 7 | **Redes sociales** | `06_23_15 a.m. (7).png` |
| 8 | Trabajo | `06_23_15 a.m. (8).png` · `06_37_39 a.m. (1).png` (variante con panel ilustrado) |
| 9 | Tienda | `06_43_47 a.m. (1).png` · `06_23_16 a.m. (10).png` (variante) |
| 10 | Batalla (ronda) | `06_52_01 a.m. (1).png` (plaza) · `06_52_02 a.m. (4).png` (evento grande) |
| — | Batalla (resultado de ronda) | `06_25_07 a.m. (1).png` |
| 13 | **Estadísticas** | `06_25_08 a.m. (3).png` |
| — | **Epílogo de arco** | sin mockup: pantalla nueva de 2026-08-13. Cierre de capítulo compuesto desde la carrera (ejes movidos, decisiones de ese capítulo, batallas, semanas) + el destino emergente |
| — | **Dilema (decisión de carrera)** | sin mockup: pantalla nueva de 2026-08-13. La pregunta arriba y dos respuestas lado a lado como bifurcación; cada una muestra costo y premio con el mismo peso, y hacia qué eje de identidad te mueve |
| — | **Cypher (entrenamiento)** | sin mockup: pantalla nueva de 2026-08-13, construida con el lenguaje visual de la batalla (paneles pixel, cartas, cursor amarillo) pero deliberadamente **sin** HUD de rival ni medidor de hype |

### Lo que revela el mockup 4 (calendario) — importante para el diseño

- HUD arriba, luego **"◀ SEMANA 3 ▶"** centrado (se navegan semanas).
- 7 tarjetas de día con **icono grande arriba** y label debajo (ENTRENAR, REDES,
  TRABAJAR, DESCANSAR, ESCRIBIR, BATALLA LOCAL, LIBRE), selección con
  **esquinas amarillas** en la tarjeta activa.
- Bajo cada label hay una **ranura punteada**: es el hueco donde se *programa* la
  acción. Confirma el loop "planificar la semana" de la Bible. **Desde la Fase 6
  funciona**: la ranura queda punteada mientras el día está libre y se llena con
  el color de la acción al agendarla (clic o tecla numérica); el sábado lleva la
  marca de la cita de batalla.
- Panel **INFORMACIÓN** abajo-izquierda y botón **CONTINUAR** abajo-derecha.
- Las flechas de semana **navegan el historial** de semanas cerradas desde la
  Fase 6 (antes estaban dibujadas e inertes).
- Arriba a la derecha hay dos botones de icono (calendario y engranaje/ajustes);
  el del calendario existe en el HUD desde la Fase 4, el de ajustes sigue
  pendiente.

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
