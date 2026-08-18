# Sistema de avatar propio (vectorial, cuerpo completo)

Decisión del owner (2026-08-18): **copiar la arquitectura de Avataaars y dibujar
nuestras propias piezas, pensadas a cuerpo completo desde el primer trazo.**

Reemplaza el enfoque de `docs/BRIEF-PERSONAJE.md` (encargar un set de pixel art).
El pixel art quedó descartado por una razón concreta y medida: tres intentos de
generarlo proceduralmente se vieron baratos, porque el pixel art bueno son píxeles
puestos a mano y la geometría no lo finge. El vector **es** geometría, así que el
código lo produce bien — y ahí crear una prenda pasa a ser escribir un path.

Prototipo funcionando: `output/vector-pruebas/pieces-prototipo.mjs` (8 looks
renderizados en `3-sistema-propio-cuerpo-completo.png`, ~3.9 KB de SVG por look).

---

## 1. Qué copiamos de Avataaars (leído de su código, no supuesto)

| Decisión suya | Por qué la copiamos |
| --- | --- |
| Cada pieza es una **función que devuelve un string de SVG** | Recolorear es interpolar texto (`fill="${c.hair}"`), no recorrer píxeles. Instantáneo y sin canvas |
| **Un solo viewBox compartido**, piezas posicionadas en absoluto | Es todo el mecanismo de registro. Cero offsets, cero desfases posibles |
| Slots = `components`, colores = `colors`, y un hook para las exclusiones | Las reglas entre slots (un gorro tapa el pelo) viven en un lugar |
| **Sin contorno.** Formas planas + un valor de sombra | Lo que hace que se lea como ilustración y no como coloring book |
| Rasgos de la cara como **slots separados** (ojos, cejas, boca, nariz) | Convierte la expresión en variedad gratis, y es la mitad del parecido |
| Piezas autoreadas en **Figma** y exportadas | Su pipeline. Nosotros podemos escribir paths a mano y/o exportar de Figma |

**Lo que NO copiamos: la proporción.** Avataaars es busto y no se extiende a un
cuerpo — sus componentes son `base, body, clothing, clothingGraphic, accessories,
eyebrows, eyes, facialHair, mouth, nose, top`, sin piernas ni zapatos, en un
viewBox de 280×280. Probamos pegarle piernas y se cae: sus hombros abarcan el
ancho completo, así que cualquier pierna razonable queda de palito, y el torso
termina en un corte horizontal plano que deja costura.

**Licencia (verificada en el archivo del paquete):** el diseño de Pablo Stanley es
"Free for personal and commercial use" y el código es MIT. O sea que también
podríamos usar sus piezas si quisiéramos — pero no las vamos a usar, porque son de
busto y porque el registro es "ilustración corporativa amable" y no calle.

## 2. El espacio de coordenadas

**256 × 512**, eje vertical en x=128. Anclas, y todas las piezas se alinean contra
esto:

| Ancla | y | Ancla | y |
| --- | --- | --- | --- |
| Coronilla | 42 | Cadera | 306 |
| Nacimiento del pelo | 64 | Rodilla | 396 |
| Ceja | 104 | Tobillo | 462 |
| Ojos | 118 | Suela | 492 |
| Nariz | 136 | | |
| Boca | 152 | Cabeza | 88 de ancho |
| Mentón | 168 | **Hombros** | **100 de ancho** |
| Hombros | 196 | | |

**Los hombros tienen que ser más anchos que la cabeza.** La primera versión los
tenía más angostos y la figura salía de chupete.

## 3. La luz

Una sola dirección para todo el cuerpo: **desde la izquierda**, con el límite de
sombra en **x = 146**. El sombreado se hace **redibujando la figura oscurecida y
recortada a ese lado** (`<use>` + `feColorMatrix`), no pintando un rectángulo:
un rectángulo negro sobre el lienzo pintaba también el fondo y dejaba un bloque
oscuro detrás del personaje.

Un solo límite global es lo que hace que las piezas se lean como el mismo dibujo
en vez de como stickers pegados.

## 4. Los slots

Orden de apilado (es el contrato: **los ojos van al final de la cabeza**, nada los
puede tapar):

```
base → bottom → shoes → top → topGraphic → tattoo → chain → wrist
     → nose → eyebrows → eyes → mouth → facialHair → hair → head
     → accessories → earring
```

### Parecerse al usuario

El parecido no sale de la ropa, sale de la cara. Estos slots existen para eso y
necesitan **volumen de opciones**, no dos:

| Slot | Prototipo | Objetivo |
| --- | --- | --- |
| `faceShape` | **falta** | 5 (redonda, cuadrada, alargada, angosta, marcada) |
| `skin` | 5 tonos | 8 |
| `eyes` | 3 | 8 |
| `eyebrows` | 3 | 8 |
| `nose` | 1 | 5 |
| `mouth` | 3 | 8 |
| `hair` + color | 4 + 5 | 10 + 8 |
| `facialHair` | 3 | 6 |

`faceShape` es la palanca de parecido que más falta hoy: sin ella todos tienen la
misma cabeza.

### Lo que se compra y se gana

Cada pieza lleva un **desbloqueo**, y eso va en la arquitectura ahora y no después:

```ts
type Unlock =
  | { kind: 'start' }                          // en Crear MC
  | { kind: 'shop'; price: number }            // la tienda
  | { kind: 'reward'; reason: string }         // ganar algo lo entrega
  | { kind: 'stage'; stage: StageId }          // se abre al subir de etapa
```

Eso es lo que hace que la tienda importe: una cadena gruesa o unas zapatillas
doradas se **ven**, y solo las tiene quien las consiguió. Piezas candidatas a
premio: cadena gruesa (ganar la primera regional), zapatillas doradas (nacional),
tatuaje de cuello (una decisión de identidad, no plata).

## 5. Estado y compatibilidad de saves

`GameState` pasa a llevar un objeto de look por slot en vez de los campos suelto
de hoy (`look`, `skin`, `hair`, `hairColor`, `eyes`). Un save viejo migra en
`normalizeLoadedState()`, como siempre: `skin` mapea al tono nuevo, `hair`
("gorra"/"suelto") al slot `head`, `eyes` ("lentes"/"descubierto") a
`accessories`. Regla 3 del proyecto: **nunca romper una partida en silencio.**

## 6. Cómo se dibuja en el juego

El SVG compuesto se rasteriza **una vez por look** a una textura de Phaser y se
cachea — el mismo patrón que ya usa `src/ui/characterDraw.ts` hoy, así que el
cableado a las pantallas no cambia. A 3.9 KB por look, componer es gratis.

## 7. El costo que arrastra, y es el grande

Los fondos que sí tenemos son **pixel art**: la ciudad isométrica del mapa, la
pieza, la plaza, el escenario, la portada del menú. Un personaje vectorial encima
de eso no calza. Cambiar la estética del personaje **obliga** a cambiar fondos,
iconos y paneles, y con eso se cae la regla 2 del proyecto ("fidelidad a los
mockups") y buena parte de `docs/PANTALLAS.md`.

Es decisión del owner hacerlo. Queda escrito para que no aparezca como sorpresa a
mitad de camino.

## 8. Estado del prototipo

Funciona: 8 looks, todos los slots cableados, exclusiones aplicadas, escala a
240/92/46 sin pérdida. Lo que le falta:

- **`faceShape`** y el volumen de opciones de cara de la sección 4.
- Los **brazos se pierden dentro del torso** en varias prendas: la manga necesita
  separarse (un valor más oscuro o una silueta que la despegue).
- La **capucha** puesta necesita ajuste: hoy tapa raro contra la cara.
- Las piezas están escritas a mano en paths. Para volumen conviene autorear en
  **Figma** y exportar, igual que hacen ellos.
