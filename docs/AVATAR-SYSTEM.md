# Sistema de avatar (Fase 11)

Implementa el handoff **AVATAR DESIGN SYSTEM** (48 páginas, entregado por el owner
el 2026-08-18) y la pantalla **Creador de Avatar** del proyecto de Claude Design
`87f46347-a5a1-44fd-8998-5f953bcfa566`.

Los dos documentos se complementan y donde difieren **manda el spec**, porque su
Regla de Oro (§79) es explícita:

> No construyas el creador como una colección de condiciones hard-codeadas.
> El creador es un **cliente** del sistema de avatar, no el sistema.

Por eso no hay ni un `if (item.id === "...")` en `src/avatar/`. Todo el
comportamiento sale de la metadata del item.

## Dónde vive cada cosa del spec

| Spec | Archivo |
| --- | --- |
| §39/§68 modelo de datos, serialización versionada | `src/avatar/types.ts` |
| §7/§8 canvas maestro y sistema de coordenadas | `src/avatar/canvas.ts` |
| §28 las 27 capas, en orden fijo | `src/avatar/layers.ts` |
| §43/§44 tokens de color en vez de assets duplicados | `src/avatar/palettes.ts` |
| §45/§46 motor de compatibilidad data-driven | `src/avatar/rules.ts` |
| §40/§41 el renderer (`renderAvatar`) | `src/avatar/renderer.ts` |
| §80 registro de assets | `src/avatar/registry.ts` |
| §37/§38/§70 inventario, equipo, compras, desbloqueos | `src/avatar/wardrobe.ts` |
| §56/§58/§59 aleatorio, NPCs, presets | `src/avatar/generate.ts` |
| §9–§27 los assets del MVP | `src/avatar/assets/` |
| §57 la UI del creador | `src/avatar/creator/` |
| §77/§78 criterios de aceptación | `src/avatar/avatar.test.ts` |

## Las decisiones que importan

**Un solo espacio de coordenadas: 500 × 800.** El spec recomienda 1000×1600 en 5:8
y permite explícitamente cambiar el tamaño mientras la razón y el sistema de
coordenadas se mantengan. Autoreamos a la mitad: misma proporción, números que caben
en la cabeza. Las anclas (§7: cabeza 20%, torso 30%, piernas 40%, zapatos 10%) están
en `canvas.ts` como filas absolutas, para que un ilustrador tenga a qué pegarse.

**El orden de capas no se negocia.** §28 lo dice sin rodeos: *el orden en que el
jugador equipa nunca debe determinar el orden de dibujo*. Por eso las 27 capas viven
en `layers.ts` y el renderer ordena **después** de recolectar, no mientras.

**El pelo pinta en DOS capas.** `back_hair` (03, detrás del cuerpo) y `front_hair`
(21, sobre la cara). Es lo que permite que un afro quede detrás de los hombros y su
nacimiento igual tape la frente. Una sola capa no puede hacer las dos cosas.

**El cuerpo base está completo debajo de la ropa.** Es la lección caras de la pasada
anterior con pixel art: cuando la base tiene agujeros, sacarse una prenda los
destapa y ninguna capa lo arregla. Hay un test que desnuda el avatar entero y exige
que siga habiendo una persona.

**La piel es un valor, no un dibujo** (§10). Ocho tonos como metadata sin `draw`, y
el color sale de `appearance.skin` — no de la bolsa de colores — porque el tono es
parte de quién ES el personaje y no un slider de una prenda.

**El sistema no evalúa progresión** (§70). `statusOf` recibe un callback
`satisfied(unlock)` y pregunta. Por eso una zapatilla con nivel **no se vende a
ningún precio** mientras la condición no se cumpla, y por eso agregar un desbloqueo
por victorias de batalla no toca el guardarropa.

**El parecido nunca se cobra** (§3). Hay un test que recorre cuerpo, piel, rostro,
ojos, cejas, nariz y boca y falla si alguno tiene precio.

**El aleatorio va con semilla.** El proyecto prohíbe `Math.random` (las corridas
tienen que ser reproducibles) y §56 pide generación de NPCs: la misma semilla da el
mismo MC y el mismo rival. Vive en `generate.ts`, no en la UI, porque el botón del
creador y el generador de NPCs quieren exactamente lo mismo.

## Cómo verlo

```bash
npm run dev
```

Y abrir `/avatar.html`. Evidencia en `output/web-game/creador-avatar/`.

## Estado, honestamente

**Hecho:** las fases 1, 2 y 3 del §76 (fundación, creador, inventario). El renderer
está probado aparte de la UI como pide §78, con 30 tests que son los criterios de
§77 escritos como código.

**El arte es de MVP, y se nota.** §61 dice literalmente "no gastes tiempo produciendo
cientos de assets antes de que el renderer esté probado", así que las piezas son
formas planas escritas a mano en `src/avatar/assets/`. Lo que falta ahí:

- Las **piernas se leen como una sola masa** cuando el pantalón es oscuro: los dos
  paths van pegados y necesitan separación real.
- Los **brazos** terminan en manos redondas a la altura de la cadera y quedan
  rígidos; la manga tampoco se despega del torso.
- El **pase de sombra** casi no se ve. El límite de luz existe (`LIGHT.shadeFromX`)
  pero el `feColorMatrix` está muy suave.
- Las **zapatillas** son losas.
- Faltan las **poses** (§53) y las **expresiones** (§54); hoy solo `idle`.

El pipeline de producción del spec (§64/§65: concepto → vector en Figma → validación
contra el template → metadata → import) es el camino para reemplazarlas. Como cada
asset es una función que devuelve SVG, cambiar una pieza escrita a mano por un
archivo exportado toca `assets/` y nada más.

**Lo que NO se tocó:** el juego. Las trazas quedaron idénticas al baseline — esto es
aditivo, en su propia página (`avatar.html`), y el juego sigue usando el paper doll
de pixel art de la Fase 10 hasta que el owner decida el cambio de estética completo
que `docs/SISTEMA-AVATAR.md` describe (fondos, iconos y paneles incluidos).
