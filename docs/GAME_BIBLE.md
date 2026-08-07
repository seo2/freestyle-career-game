# GAME_BIBLE.md

> Freestyle Game
> Version: 0.1
> Project Owner: Seo2
> Engine Target: Phaser 4 + TypeScript
> Architecture: ECS-lite + State Machine
> Genre: Career RPG + Time Management + Strategy + Freestyle Battles

---

# Vision

Freestyle Game es un simulador de carrera artística donde el jugador vive toda la evolución de un MC, desde improvisar en su pieza hasta convertirse en una leyenda mundial del rap.

El objetivo NO es escribir rimas reales.

El objetivo es tomar decisiones inteligentes durante toda la carrera.

El jugador administra:

- tiempo
- energía
- dinero
- reputación
- relaciones
- progreso artístico

Cada decisión tiene consecuencias a corto y largo plazo.

El juego debe sentirse como una mezcla entre:

- Football Manager
- Game Dev Tycoon
- Persona
- Punch Club
- Slay the Spire
- BitLife
- Stardew Valley
- NBA 2K MyCareer

pero ambientado completamente dentro de la cultura del freestyle y el hip-hop.

---

# Core Fantasy

"Quiero sentir que construí mi carrera."

No quiero ganar simplemente una batalla.

Quiero mirar atrás después de 20 horas y pensar:

"Todo comenzó en una pieza con un micrófono barato."

---

# Core Pillars

## 1. Cada decisión importa.

Nada ocurre porque sí.

Todo modifica el futuro.

---

## 2. Todo consume recursos.

No existen acciones gratuitas.

Todo cuesta:

- tiempo
- energía
- salud mental
- dinero
- reputación

---

## 3. El progreso es lento.

Subir de nivel debe sentirse importante.

Comprar un micrófono debe sentirse importante.

Ganar una batalla debe sentirse importante.

---

## 4. El jugador escribe su historia.

No existe una única carrera.

Puede ser:

- Freestyler
- Rapero
- Comercial
- Underground
- Productor
- Host
- Empresario
- Mentor

---

# Loop Principal

```text
Entrar a la pieza

↓

Planificar semana

↓

Ejecutar acciones

↓

Resolver consecuencias

↓

Eventos

↓

Batalla (si existe)

↓

Resumen semanal

↓

Guardar

↓

Nueva semana
```

---

# Gameplay Loop

```
Entrenar

↓

Subir Stats

↓

Competir

↓

Ganar dinero

↓

Comprar mejoras

↓

Competir mejor

↓

Desbloquear eventos

↓

Nueva etapa
```

---

# Meta Loop

```
Pieza

↓

Plaza

↓

Regional

↓

Nacional

↓

Internacional

↓

Estrellato

↓

Leyenda
```

---

# Recursos

## Primarios

- Energía
- Dinero
- Tiempo

## Sociales

- Fans
- Respeto Underground
- Fama Mainstream

## Personales

- Salud Mental
- Disciplina
- Estrés

## Carrera

- XP
- Nivel
- Legado

---

# Stats

## Flow

Capacidad rítmica.

---

## Punchline

Poder de remate.

---

## Métrica

Estructura.

---

## Improvisación

Capacidad de responder.

---

## Escena

Performance.

---

## Carisma

Conquista público.

---

## Disciplina

Velocidad de progreso.

---

# Secondary Stats

Se calculan automáticamente.

Ejemplo

```
Popularidad

=

Fans
+
Carisma
+
Fama
```

---

```
Calidad de grabación

=

Micrófono
+
Interfaz
+
Monitores
```

---

# Tiempo

El juego funciona por semanas.

Cada semana tiene:

```
Lunes

Martes

Miércoles

Jueves

Viernes

Sábado

Domingo
```

Cada día admite exactamente una acción.

---

# Acciones

## Entrenar

Sube estadísticas.

Consume energía.

---

## Trabajar

Genera dinero.

Consume tiempo.

---

## Escribir

Genera material.

Mejora métrica.

---

## Redes

Genera fans.

Puede generar hate.

---

## Descansar

Recupera energía.

Recupera salud mental.

---

## Batallar

Genera:

- respeto
- dinero
- rivalidades
- desbloqueos

---

# Economía

El dinero sirve para:

- equipo
- ropa
- decoración
- estudio
- viajes
- campañas
- videoclips

Nunca debe sobrar.

---

# Inventario

Categorías

## Equipo

- Micrófonos
- Interfaces
- Audífonos
- Cámaras

## Beats

- Boom Bap
- Trap
- Drill
- Experimental

## Ropa

- Hoodies
- Gorros
- Poleras
- Sneakers

## Decoración

- Posters
- Trofeos
- Discos
- Luces
- Plantas

Cada objeto entrega bonus.

---

# Batallas

Una batalla consiste en:

```
Presentación

↓

Rondas

↓

Resultado

↓

Recompensas
```

Cada ronda:

```
Estímulo

↓

Jugador elige recurso

↓

IA responde

↓

Comparación

↓

Hype

↓

Nueva ronda
```

---

# Recursos de batalla

- Punchline
- Flow
- Humor
- Ataque
- Defensa
- Métrica
- Doble Tempo
- Respuesta
- Storytelling
- Improvisación

---

# Estímulos

Ejemplos

- Barrio
- Familia
- Escuela
- Dinero
- Corona
- Respeto
- Tiempo
- Rival
- Trabajo
- Cultura

---

# IA del Rival

Cada rival posee personalidad.

Ejemplo

```
Nombre

Nivel

Flow

Punchline

Personalidad

Agresividad

Humor

Métrica

Frecuencia de riesgo
```

Tipos

- Agresivo
- Técnico
- Humorístico
- Callejero
- Viral
- Veteranísimo
- Campeón Mundial

---

# Hype

Toda batalla tiene un medidor.

```
Jugador

VS

Rival
```

El hype modifica:

- votos
- presión
- público

---

# Carrera

Etapas

```
Pieza

↓

Plaza

↓

Regional

↓

Nacional

↓

Internacional

↓

Estrellato

↓

Leyenda
```

Cada etapa desbloquea:

- escenarios
- rivales
- eventos
- sponsors
- tiendas
- trabajos

---

# Eventos

Cada semana existe una probabilidad de generar eventos.

Ejemplos

- entrevista
- hate
- polémica
- sponsor
- videoclip
- lesión
- enfermedad
- pelea
- viaje
- colaboración

Todos ofrecen decisiones.

Nunca respuestas correctas.

---

# Relaciones

El jugador posee relaciones con:

- Familia
- Crew
- Productores
- Managers
- Sellos
- Marcas
- Fans
- Rivales

Cada relación tiene afinidad.

---

# Fatiga

Todo genera desgaste.

Si la energía llega a cero:

- baja rendimiento
- baja improvisación
- aumenta errores

---

# Salud Mental

Afecta:

- disciplina
- creatividad
- improvisación
- estrés

Puede recuperarse mediante:

- descanso
- vacaciones
- familia
- terapia
- meditación

---

# Victoria

No existe una única victoria.

El jugador puede terminar siendo:

- Campeón Mundial
- Rapero famoso
- Productor
- Empresario
- Fundador de sello
- Mentor
- Leyenda Underground

---

# Condiciones de derrota

No existe Game Over tradicional.

El jugador siempre puede recuperarse.

Solo cambian las oportunidades disponibles.

---

# Estilo Visual

Pixel Art HD.

Inspiración

- Eastward
- Dave The Diver
- Stardew Valley
- Coffee Talk
- Pokémon HGSS
- Punch Club

Paleta:

- cálida
- urbana
- neón
- cemento
- luces nocturnas

---

# Música

Boom Bap.

Jazz.

Soul.

Lo-Fi.

Trap.

Cada zona posee ambiente propio.

---

# Arquitectura Técnica

```
Game

↓

GameState

↓

Managers

↓

Systems

↓

Scenes

↓

UI

↓

Assets
```

Managers

- SaveManager
- AudioManager
- BattleManager
- EconomyManager
- CalendarManager
- EventManager
- NPCManager
- InventoryManager

---

# Guardado

Debe almacenarse:

- Player
- Stats
- Inventario
- Relaciones
- Carrera
- Calendario
- Eventos
- Mundo
- Configuración

---

# IA Friendly Rules

Toda lógica debe estar desacoplada del render.

Nunca mezclar UI con lógica.

Cada sistema debe ser independiente.

Toda acción debe devolver un resultado determinístico.

Todo dato debe poder serializarse.

Todo sistema debe poder testearse sin Phaser.

---

# Convenciones

Nunca acceder directamente al Player.

Siempre mediante GameState.

Nunca modificar recursos desde la UI.

Toda modificación pasa por Systems.

Nunca calcular bonus en componentes visuales.

Siempre en los Managers.

---

# Filosofía de Desarrollo

Cada nueva característica debe responder tres preguntas:

1. ¿Hace más interesante tomar decisiones?

2. ¿Genera nuevas historias?

3. ¿Hace que el jugador quiera jugar una semana más?

Si la respuesta no es "sí" en las tres, la característica no debe implementarse.

---

# Roadmap

## MVP

- Crear MC
- Pieza
- Calendario
- Entrenamiento
- Trabajo
- Tienda
- Inventario
- Batallas básicas
- Guardado

## Alpha

- Redes Sociales
- Eventos
- Rivalidades
- Rankings
- Sponsors

## Beta

- Discos
- Estudios
- Videoclips
- Tours
- Crew

## 1.0

- Carrera completa
- Finales múltiples
- Logros
- Steam
- Workshop

---

# Regla Suprema

**Todo sistema del juego debe reforzar la fantasía de construir la carrera de un MC desde cero mediante decisiones significativas, progreso persistente y consecuencias emergentes.**
