# Pipeline de assets del avatar

Implementa el pipeline de contenido del spec (§64) y su checklist de QA (§66).

Existe por una razón concreta: §66 llega como dieciséis casillas para que una persona
las marque, y una lista que una persona marca es una lista que nadie marca desde el
asset cuarenta. Acá es código que **falla el build**.

## Para el ilustrador

### 1. La plantilla

```bash
npm run avatar:template
```

Genera `assets/avatar/_template.svg`. Ábrela en Figma. Trae:

- el lienzo de **500 × 800** (el spec recomienda 1000×1600 en 5:8; autoreamos a la
  mitad, misma razón, y §7 lo permite explícitamente)
- **cada ancla como guía con su nombre y su valor**: coronilla 60, nacimiento del pelo
  86, ceja 126, ojos 140, nariz 164, boca 182, mentón 196, hombros 220, pecho 270,
  cintura 360, cadera 400, rodilla 536, tobillo 672, suela 740
- el **eje vertical en x=250** y el **límite de luz en x=286** (la luz viene siempre de
  la izquierda; una pieza sombreada al revés se lee como pegada encima)
- el **cuerpo por defecto** (`body_03`) tenue, para calcar
- un grupo vacío por cada una de las **27 capas**
- la **leyenda de tokens de color** con sus valores de muestra

La plantilla se **genera** desde `src/avatar/canvas.json`, el mismo archivo que lee el
renderer. No puede desviarse.

### 2. Dibujar

- Dentro del grupo cuya capa corresponde: `layer-top`, `layer-hat`, `layer-back_hair`…
  Arte fuera de un grupo `data-layer` es **error**, no se ignora en silencio: una pieza
  que el ilustrador dibujó y el juego nunca muestra es el peor resultado posible.
- Pintar **solo con tokens**: `fill="var(--fabric-primary)"`. Un hex literal hace que
  esa pieza no se pueda recolorear nunca, que es justo lo que el sistema de tokens
  existe para evitar (§44).
- Se permiten `none`, `currentColor` y blanco puro, porque un brillo los necesita.
- **Sin degradados, sin patrones, sin bitmaps** (§42).
- El **cuerpo base ya está completo debajo de la ropa**. No hace falta dibujar piel
  bajo una prenda, y tampoco hay que "tapar" nada.

### 3. Exportar

Un SVG por pieza, con `viewBox="0 0 500 800"` y **sin `transform` en la raíz** — un
transform en la raíz deshace todo el sentido de una plantilla compartida.

```
assets/avatar/<categoria>/<id>.svg
assets/avatar/<categoria>/<id>.json
```

El `id` es minúsculas, números y `_`, **inmutable** (§30): el nombre visible puede
cambiar después sin invalidar el save de nadie.

### 4. La metadata

```json
{
  "id": "top_101",
  "name": "Buzo oversize",
  "category": "top",
  "rarity": "uncommon",
  "price": 21000,
  "currency": "cash",
  "colors": ["fabric_primary", "fabric_secondary"],
  "layers": { "top": true },
  "style": { "street": 9, "sport": 5, "originality": 6 },
  "rules": { "incompatible": [] }
}
```

- **`price`** = la tienda lo vende. **`unlock`** = es una recompensa de carrera y **no
  se vende a ningún precio** hasta que se cumpla. Los dos juntos es legal (la zapatilla
  de edición limitada del diseño: hay que ser alguien **y** tener la plata).
- **`layers`** tiene que calzar exactamente con lo que el SVG dibuja. Declarar una capa
  y no pintar ahí, o pintar sin declararla, es error.
- **`colors`** tiene que incluir todo token que el SVG usa. Usar uno sin declararlo
  falla de forma silenciosa: el creador no le ofrece ese color al jugador y la pieza
  renderiza con un default.
- **`rules`** es data, nunca código (§46). Puede apuntar a assets de código
  (`hair_004`) o importados — el espacio de ids es uno solo.

### 5. Importar

```bash
npm run avatar:assets
```

Corre el checklist completo y **si algo falla no emite nada**. Un import parcial es
peor que ninguno: el juego arrancaría con un guardarropa incompleto por razones que
nadie escribió.

```bash
npm run dev            # en otra terminal
npm run avatar:previews
```

Genera un PNG por pieza **sobre el cuerpo por defecto** (una manga flotando sobre
transparencia se ve bien hasta que está a 20px del brazo) y una **hoja de contacto**,
que es lo que realmente se revisa: cuarenta PNG en una carpeta no son una revisión.

## Lo que valida (§66)

| Chequeo | Qué atrapa |
| --- | --- |
| lienzo | un `viewBox` distinto: cada coordenada adentro queda sin significado |
| coordenadas | `transform` en la raíz |
| vector | `<image>`, bitmaps en `data:`, `<script>` |
| SVG | grupos desbalanceados, y `--` dentro de un comentario XML |
| tokens | hex literales, tokens desconocidos, degradados y patrones |
| acuerdo de tokens | usar un token sin declararlo, o declararlo sin usarlo (aviso) |
| capa | una capa que la categoría no puede pintar; declarada y vacía; pintada sin declarar |
| naming | id que no calza con el archivo, o que no es legible por máquina |
| categoría | carpeta que no concuerda con la metadata |
| precio | precio 0, o parecido físico con precio (§3: eso nunca se cobra) |
| desbloqueo | tipo desconocido, o `career_level` sin `value` |
| reglas | clave desconocida (un typo se volvería una regla muerta) |
| referencias | una regla que apunta a un id que no existe |

El validador está en `scripts/avatar/validate.mjs` y **tiene sus propios tests**
(`src/avatar/pipeline.test.ts`). Si el validador está mal, arte malo pasa y el
checklist es teatro.

Dos duplicaciones deliberadas, ambas con test que las custodia: el validador repite la
lista de 27 capas y el mapa categoría→capa (para correr bajo node sin transpilador), y
`scripts/avatar/knownIds.mjs` lee los ids con un regex sobre el código fuente. Los dos
tests comparan contra el runtime y fallan si divergen.

## Un caso que ya se encontró

Al generar nuestra propia plantilla salió un SVG que ningún parser acepta: el
comentario de instrucciones contenía `var(--fabric-primary)`, y **XML prohíbe `--`
dentro de un comentario**. El texto se movió a `<desc>` y el chequeo quedó en el
validador. Ese es el tipo de error que este pipeline existe para atrapar.
