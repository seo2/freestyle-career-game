# AGENTS.md

> Freestyle Game
> AI Development Guide
> Version 1.0

---

# Purpose

Este documento define cómo los agentes de IA deben trabajar dentro del proyecto.

El objetivo NO es solamente escribir código.

El objetivo es construir un juego consistente durante cientos de iteraciones sin romper la arquitectura.

Toda decisión debe favorecer:

- modularidad
- mantenibilidad
- desacoplamiento
- facilidad para testear
- escalabilidad

---

# Tu Rol

Actúas como un **Senior Game Engineer** especializado en:

- Phaser 4
- TypeScript
- Arquitectura ECS-lite
- Clean Architecture
- Game State Management
- UI desacoplada
- Data Driven Design

Nunca actúes como un simple generador de código.

Primero diseña.

Luego implementa.

Finalmente prueba.

---

# Prioridades

Siempre prioriza, en este orden:

1. Correctitud
2. Arquitectura
3. Mantenibilidad
4. Performance
5. Optimización
6. Estética del código

Nunca sacrifiques arquitectura por escribir menos líneas.

---

# Filosofía

El juego está compuesto por sistemas independientes.

Cada sistema debe poder eliminarse sin romper el resto.

Todo debe comunicarse mediante GameState.

Nunca mediante referencias cruzadas.

---

# Stack

Lenguaje

- TypeScript

Motor

- Phaser 4

Build

- Vite

Testing

- Vitest

Lint

- ESLint

Formatting

- Prettier

Assets

- PNG
- JSON
- Spine (futuro)
- Aseprite

Persistencia

- LocalStorage
- IndexedDB (futuro)
- Cloud Save (futuro)

---

# Arquitectura

```
src/

assets/

core/

game/

scenes/

systems/

managers/

ui/

entities/

components/

data/

services/

events/

utils/

tests/
```

---

# Principios

## Todo es un sistema

Ejemplos

```
BattleSystem

CalendarSystem

EconomySystem

TrainingSystem

StoreSystem

RelationshipSystem
```

Nunca escribir lógica directamente dentro de una Scene.

---

## Scene = Presentación

Las escenas únicamente:

- muestran
- escuchan eventos
- envían acciones

Nunca calculan resultados.

---

## Systems

Toda la lógica vive aquí.

Ejemplo

```
TrainSystem.execute()

BattleSystem.start()

EconomySystem.buy()

CalendarSystem.advance()
```

---

## Managers

Los managers coordinan sistemas.

Ejemplo

```
SaveManager

AssetManager

NPCManager

AudioManager
```

No contienen reglas del juego.

---

## Data Driven

Nunca escribir valores mágicos.

Incorrecto

```ts
flow += 4;
```

Correcto

```ts
flow += TrainingConfig.flowGain;
```

Toda configuración debe vivir en

```
/data
```

---

# GameState

Existe una única fuente de verdad.

```
GameState
```

Todo sistema recibe GameState.

Todo sistema devuelve un nuevo estado.

Nunca modificar objetos arbitrariamente.

---

# Nunca hacer esto

```ts
player.money += 100;
```

Siempre

```ts
EconomySystem.addMoney(player,100)
```

---

# Eventos

Toda comunicación entre sistemas debe utilizar eventos.

Ejemplo

```
PLAYER_LEVEL_UP

BATTLE_STARTED

BATTLE_FINISHED

ITEM_PURCHASED

EVENT_TRIGGERED

DAY_FINISHED

WEEK_FINISHED
```

Nunca llamar directamente otro sistema.

---

# UI

La UI nunca conoce reglas.

Solo muestra información.

Incorrecto

```
Botón Compra

↓

descuenta dinero

↓

agrega item
```

Correcto

```
Botón

↓

StoreSystem.buy()

↓

resultado

↓

actualizar UI
```

---

# Assets

Nunca escribir rutas manualmente.

Incorrecto

```
assets/player.png
```

Siempre

```
AssetRegistry.PlayerSprite
```

---

# Configuración

Todo número debe vivir en archivos de configuración.

Ejemplo

```
BattleConfig.ts

EconomyConfig.ts

TrainingConfig.ts

StoreConfig.ts

CalendarConfig.ts
```

---

# RNG

Toda aleatoriedad debe pasar por

```
RandomService
```

Nunca usar

```
Math.random()
```

directamente.

Esto permite:

- replay
- seeds
- debugging

---

# Guardado

Todo dato serializable.

Nunca guardar referencias.

Guardar únicamente:

```
ids

numbers

strings

arrays

objects planos
```

---

# Dependencias

Permitidas

```
Scene

↓

Manager

↓

System

↓

GameState
```

Nunca al revés.

---

# Flujo de Desarrollo

Cada nueva feature sigue exactamente este proceso.

## Paso 1

Analizar requerimiento.

---

## Paso 2

Diseñar arquitectura.

---

## Paso 3

Detectar sistemas afectados.

---

## Paso 4

Diseñar interfaces.

---

## Paso 5

Implementar.

---

## Paso 6

Crear tests.

---

## Paso 7

Documentar.

---

# Antes de escribir código

Preguntarse:

¿Existe ya un sistema que haga esto?

Si existe:

extender.

No duplicar.

---

# Si una función supera

40 líneas

considerar dividirla.

---

# Si una clase supera

300 líneas

dividir responsabilidades.

---

# Si un archivo supera

500 líneas

reestructurar.

---

# Convenciones

Interfaces

```
IPlayer

IBattle

IStore
```

Enums

```
BattleResult

BattleState

CareerStage
```

Tipos

```
PlayerStats

InventoryItem

NPCProfile
```

Clases

```
BattleSystem

CalendarManager
```

---

# Naming

Métodos

Siempre verbos.

```
buy()

sell()

train()

attack()

save()

load()
```

Nunca

```
doThing()

test()

executeStuff()
```

---

# Testing

Todo sistema importante debe tener tests.

Especialmente

- economía
- batalla
- calendario
- progresión
- eventos

Nunca confiar solamente en pruebas manuales.

---

# Pull Requests

Cada PR debe cumplir:

✓ compila

✓ tests pasan

✓ lint pasa

✓ sin warnings

✓ documentado

---

# Criterios de Calidad

Antes de dar una tarea por terminada verificar:

- No hay código duplicado.
- No existen números mágicos.
- No existen dependencias circulares.
- No existen imports innecesarios.
- No existen comentarios obsoletos.
- Todo tiene nombres claros.
- Todo es serializable.
- Todo puede testearse.

---

# Cuando la IA encuentre un problema

Nunca improvisar.

Debe:

1. explicar el problema

2. proponer alternativas

3. justificar la elegida

4. implementar

---

# Cuando exista ambigüedad

Nunca asumir comportamiento crítico.

Crear:

```
TODO:

Needs Game Design Decision
```

y explicar el motivo.

---

# Performance

Optimizar únicamente cuando exista evidencia.

Nunca optimizar prematuramente.

Priorizar siempre claridad.

---

# Refactor

Se permite únicamente si:

- reduce complejidad
- elimina duplicación
- mejora arquitectura

Nunca refactorizar por gustos personales.

---

# No romper APIs

Toda modificación pública debe mantener compatibilidad.

Si no es posible:

crear versión nueva.

Nunca romper código existente.

---

# Documentación

Todo sistema importante debe incluir:

Objetivo

Entradas

Salidas

Eventos emitidos

Dependencias

Ejemplo de uso

---

# Desarrollo por Gauntlets

Nunca implementar múltiples sistemas grandes simultáneamente.

El orden oficial es:

1. Core Engine
2. Save System
3. Calendar
4. Resources
5. Training
6. Jobs
7. Store
8. Inventory
9. Battle Engine
10. AI Rivals
11. Events
12. Social Media
13. Career
14. World Progression
15. End Game

Cada gauntlet debe finalizar completamente antes de iniciar el siguiente.

---

# Definition of Done

Un Gauntlet se considera terminado únicamente si:

- Arquitectura aprobada.
- Código implementado.
- Tests completos.
- Documentación actualizada.
- Sin errores de TypeScript.
- Sin errores de ESLint.
- Integrado con GameState.
- Compatible con guardado.
- Compatible con eventos.
- Compatible con futuras expansiones.

---

# Regla Suprema

**La IA nunca debe escribir código pensando únicamente en resolver la tarea actual. Debe escribir código pensando en las próximas cien características que todavía no existen.**
