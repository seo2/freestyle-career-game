# Brief: personaje modular propio (encargo de arte)

Este archivo es el **prompt** que se le pasa a un diseñador o a un modelo de diseño
para que proponga y dibuje el set de personaje propio del juego.

Existe porque el MC actual está **cortado de un sprite que no fue dibujado para ser
modular** (`scripts/build-character-layers.mjs`): bajo la gorra no hay cráneo, bajo
los lentes no hay cara, y el pelo tuvo que trasplantarse del rival. El pipeline
funciona y no cambia si se reemplaza la base — pero el arte tiene un techo.

**Lo que NO se negocia** son las restricciones técnicas de la sección 3: son
literalmente lo que hace que el sistema de recoloreo y de capas funcione. Todo lo
demás (estética, proporción, paleta) es decisión del diseño.

---

## El prompt

> Necesito que diseñes el personaje de un juego, y que sea **modular**: un cuerpo
> base sobre el que se intercambian piezas (pelo, gorro, lentes, polera, pantalón,
> zapatillas, cadenas, tatuajes). Como el creador de Funko Pop Yourself, pero con
> **estética propia**, no la de Funko.
>
> ### 1. El juego
>
> Simulador de carrera de un MC de freestyle chileno. Arranca en su pieza rapeando
> solo, sube a la plaza, a competencias regionales, nacionales, internacionales.
> Administra su semana: entrenar, trabajar, escribir, grabar, redes, descansar.
> Compite en batallas por rondas.
>
> El juego es **pixel art**, paleta noche (azules profundos, acentos amarillo y
> teal), interfaz de paneles con doble borde. El personaje se ve a **tres tamaños
> muy distintos**: 46 px de alto en un retrato de HUD, ~92 px de pie en la escena,
> y 240 px en el espejo de la barbería. Tiene que leerse en los tres.
>
> Tono: **urbano, hip-hop, callejero**, sin caer en caricatura infantil ni en
> realismo. El jugador tiene que querer que ese personaje sea él.
>
> ### 2. Qué te pido primero (no dibujes todo todavía)
>
> **Fase A — dirección.** Propón **tres direcciones de arte distintas** para el
> mismo personaje. Para cada una: un render frontal del cuerpo base vestido con la
> tenida por defecto, más la misma figura con otro corte de pelo y otra tenida, para
> que se vea que el sistema aguanta variación. Explica en dos líneas qué decisión
> estética define cada dirección (proporción, grosor de contorno, saturación,
> cantidad de detalle).
>
> Direcciones que quiero que consideres, sin limitarte a ellas:
> - proporción **realista-estilizada** (cabeza ~1/6 del cuerpo), detalle alto, mucha
>   personalidad en la ropa
> - proporción **chibi moderna** (cabeza ~1/3), silueta gruesa, muy legible a 46 px
> - algo **más gráfico**: siluetas planas, contorno grueso, sombreado de dos valores,
>   más cercano al póster que al sprite
>
> **Fase B — set completo.** Recién cuando yo elija una dirección, dibujas todas las
> piezas de la sección 4.
>
> ### 3. Restricciones técnicas (esto no es negociable)
>
> El motor compone al personaje apilando PNGs y **recolorea cada capa remapeando su
> luminancia sobre una rampa de 4 valores**. Eso impone reglas:
>
> 1. **Lienzo fijo: 128 × 256 px.** Cada pieza se entrega en un PNG de 128×256
>    completo, con transparencia, con la pieza ya en su posición final. Sin recortes,
>    sin offsets, sin metadata de posición. Se apilan tal cual y calzan.
> 2. **Pixel art nativo, sin antialias.** Bordes duros. Nada de suavizado, nada de
>    dithering, nada de degradados. (El sprite actual es un render reescalado con
>    7451 colores y eso rompe el recoloreo.)
> 3. **Cada material usa exactamente 4 valores** más el contorno compartido, y esos
>    4 valores tienen que ir de oscuro a claro de forma **monótona**: sombra
>    profunda → sombra → base → luz. Si un material necesita más de 4, es dos
>    materiales.
> 4. **Un solo color de contorno para todo el personaje**, el mismo hex en todas las
>    piezas. Propón cuál (algo cercano a `#0A0814`).
> 5. **El cuerpo base tiene que estar COMPLETO debajo de la ropa**: cráneo con pelo
>    corto, cara con ojos abiertos, torso, brazos, piernas, pies. En ropa interior.
>    Sacar cualquier prenda nunca puede dejar un hueco. *Este es el error que estamos
>    arreglando: el sprite actual no tiene cráneo bajo la gorra ni cara bajo los
>    lentes.*
> 6. **Nada de sombras horneadas de otra capa.** La gorra no dibuja su sombra sobre
>    la frente, el pelo no dibuja su sombra sobre la oreja. Cada pieza se sombrea
>    sola, porque cualquier combinación tiene que ser válida.
> 7. **Una sola pose** (idle, de frente, brazos abajo, peso repartido). Las poses de
>    rapeo y de micrófono vienen después.
>
> ### 4. Anatomía y anclas
>
> Todas las piezas se alinean contra esta grilla. Si tu dirección de arte necesita
> otras proporciones, cámbialas — pero entrégame la tabla final, porque el juego la
> necesita escrita.
>
> | Ancla | y | Ancla | y |
> | --- | --- | --- | --- |
> | Coronilla (cráneo pelado) | 20 | Cintura | 158 |
> | Nacimiento del pelo | 34 | Cadera | 166 |
> | Ceja | 50 | Muñeca / mano | 178 |
> | Línea de ojos | 58 | Rodilla | 204 |
> | Nariz | 70 | Tobillo | 240 |
> | Boca | 80 | Suelo (planta) | 248 |
> | Mentón | 96 | | |
> | Hombros | 108 | Eje vertical | x = 64 |
> | Pecho | 130 | Ancho de hombros | ~64 px |
>
> ### 5. Los slots
>
> **Nivel 1 — sin esto el sistema no funciona (18 piezas):**
>
> | Slot | Piezas |
> | --- | --- |
> | Cuerpo base | 1 (completo, en ropa interior, con cara y ojos abiertos) |
> | Tonos de piel | 6 rampas de 4 valores (no 6 dibujos: el mismo dibujo, 6 paletas) |
> | Pelo | 4 cortes: rapado, fade corto, afro, trenzas |
> | Cabeza (accesorio) | 3: gorra plana, gorra curva, beanie |
> | Cara | 2: lentes oscuros, lentes transparentes |
> | Torso | 3: polera, polera ancha, hoodie |
> | Piernas | 2: jeans, short |
> | Pies | 2: zapatillas altas, zapatillas bajas |
>
> **Nivel 2 — cuando el nivel 1 esté aprobado:**
>
> | Slot | Piezas |
> | --- | --- |
> | Pelo | +3: mohicano, pelo largo, dreadlocks |
> | Cabeza | +3: bandana, durag, capucha puesta |
> | Cara | +5 barbas: candado, barba completa, bigote, chiva, patillas |
> | Cara | +3 aros: argolla, dormilona, arete doble |
> | Cuello | 4 cadenas: fina, gruesa, con dije, doble |
> | Brazos | 3: reloj, pulsera, muñequera |
> | Tatuajes | 4: brazo entero, antebrazo, cuello, mano |
> | Torso | +3: chaqueta, tank top, camisa abierta |
> | Piernas | +3: cargo, buzo, pantalón de vestir |
> | Pies | +3: botas, zapatos, sandalias |
>
> ### 6. Reglas de exclusión entre slots
>
> Dime cuáles piezas no pueden convivir y por qué. Las que ya veo:
> - capucha puesta ↔ cualquier gorro y cualquier pelo largo
> - gorra ↔ pelo (salvo que el corte tenga versión "bajo gorra")
> - **si un corte de pelo necesita versión recortada para usarse con gorra, esa
>   versión es una pieza aparte** y va en la entrega
>
> ### 7. Entregables
>
> 1. Un PNG de 128×256 por pieza, nombrado `slot-pieza.png`
>    (`pelo-fade.png`, `torso-hoodie.png`).
> 2. Una tabla con, por cada pieza: su slot, sus 4 valores hex de oscuro a claro, y
>    con qué otras piezas es incompatible.
> 3. La tabla de anclas final (sección 4) si la cambiaste.
> 4. El hex del contorno.
> 5. **Una hoja de prueba**: el mismo personaje en 6 combinaciones muy distintas
>    (con gorra / sin nada / hoodie con capucha / tenida completa / solo ropa
>    interior / cambio de tono de piel), a 240 px y a 46 px, sobre fondo azul noche
>    `#0C0F2D`. Si a 46 px no se distingue quién es, la dirección no sirve.
>
> ### 8. Cómo sé que está bien
>
> - Apilo todas las piezas de un slot sobre el cuerpo base y **no queda ni un pixel
>   de fondo asomando** en ninguna combinación.
> - Cada material tiene 4 valores y se puede repintar con otra rampa sin que se
>   pierda el volumen.
> - A 46 px se reconoce la silueta y se distingue una tenida de otra.
> - El personaje se ve como alguien que rapea, no como un maniquí con ropa encima.

---

## Notas para nosotros (no van en el prompt)

- **128×256 en vez de 101×240**: número redondo que baja limpio a 64×128 y 32×64, y
  da margen de detalle para el espejo de la barbería.
- **El pipeline no cambia.** Si el set nuevo respeta la sección 3, `characterDraw.ts`
  lo compone igual; lo que cambia es que ya no hace falta `build-character-layers.mjs`
  para cortar nada — las piezas vienen cortadas de origen. El script queda para el
  sprite viejo.
- **La regla 5 (cuerpo completo debajo) es la lección cara de esta fase.** El sprite
  actual no tiene cráneo bajo la gorra ni cara bajo los lentes, y eso costó tres
  iteraciones de relleno sintético que se notan.
- **La regla 2 (sin antialias) también.** El sprite actual es un render reescalado;
  cuantizarlo a 4 valores le puso un borde duro a todo, y no cuantizarlo obliga a
  interpolar en tiempo de ejecución.
- El **bust del HUD** (`mc-bust.png`) sigue siendo plano y no sigue al personaje. Con
  el set nuevo se resuelve solo: se recorta la cabeza de la textura compuesta.
