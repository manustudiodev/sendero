# Sendero Shared Trip Companion — product brief para The WebMCP Challenge

**Fecha:** 2026-08-28
**Estado:** alcance recomendado para implementación y submission
**Deadline oficial:** 3 de septiembre de 2026, 1:00 p. m. PDT / 17:00 Buenos Aires

## 1. Nombre de trabajo

**Sendero Shared Trip Companion**

Alternativa corta para el submission:

**Sendero — Every shared trip becomes personal**

## 2. Tagline

> **A shared itinerary every guest can explore with their own AI agent.**

## 3. Pitch

Sendero ya convierte una conversación en un itinerario compartible. Con WebMCP, cada persona que recibe el link puede preguntarle a su propio agente cómo ese viaje se relaciona con su llegada, horarios y necesidades, mientras el agente resalta la respuesta en la misma agenda y el mismo mapa, sin modificar el plan del grupo.

## 4. Problema

Cuando una persona organiza un viaje para un grupo, suele ocurrir lo siguiente:

1. una sola persona crea el plan;
2. comparte un documento, mensaje o página;
3. todos reciben la misma información;
4. cada integrante debe interpretar manualmente cómo le afecta;
5. el owner termina respondiendo preguntas individuales.

Ejemplos:

- “Llego tres horas más tarde, ¿dónde me encuentro con ustedes?”
- “¿Qué cosas requieren reserva?”
- “¿Qué tenemos cerca del hotel?”
- “¿Cuál es la primera actividad a la que todavía llego?”
- “Muéstrame en el mapa solamente el sábado.”

Una página estática puede contener la respuesta, pero no la adapta al contexto de cada invitado ni coordina la explicación con la interfaz.

## 5. Solución

La página compartida de Sendero registra site tools WebMCP. Cuando un invitado la abre en un navegador compatible:

- el agente descubre las capacidades de esa página;
- obtiene datos estructurados del viaje actual;
- conoce fecha, timezone, horarios, lugares y estados;
- puede seleccionar un día o item en la interfaz;
- puede generar una vista personal temporal;
- agenda y mapa reflejan la respuesta;
- el itinerario del owner permanece intacto.

## 6. Por qué WebMCP es esencial

Sin WebMCP, el agente puede intentar leer el DOM o usar computer interaction. Eso tiene varias limitaciones:

- interpreta semántica visual de forma indirecta;
- puede confundir reserva, recomendación y traslado;
- no tiene IDs estables;
- no conoce necesariamente el timezone;
- no puede controlar de forma confiable la selección del mapa;
- puede perder información colapsada;
- depende de selectores y estructura visual;
- no posee una operación oficial para crear una vista temporal.

Con WebMCP, Sendero declara explícitamente:

- qué información puede consultarse;
- qué parámetros acepta cada operación;
- qué efectos tiene sobre la página;
- qué acciones no persisten cambios;
- qué resultado estructurado debe recibir el agente.

El valor no es “ChatGPT puede leer una web”. El valor es:

> **El agente y el invitado comparten una interpretación verificable del mismo viaje y la página puede visualizar esa interpretación.**

## 7. Relación con el producto existente

### Preexistente

- plugin conversacional;
- servidor MCP;
- API de Sendero;
- creación y edición del viaje por el owner;
- landing;
- página compartida;
- visualización read-only;
- propagación de cambios del owner.

### Trabajo nuevo del challenge

- feature detection de WebMCP;
- registro y lifecycle de site tools;
- proyección pública estructurada para agentes;
- operaciones que sincronizan timeline y mapa;
- guest arrival preview temporal;
- estados visuales para la personalización del invitado;
- privacidad específica de tool outputs;
- tests WebMCP;
- README y documentación del delta;
- deployment y demo reproducible.

El proyecto no debe afirmar que la landing, el plugin, la página compartida o la API fueron creados durante el challenge si ya existían.

## 8. Usuario de la demo

**Invitado de un viaje grupal**

- no es owner;
- no tiene el chat donde se creó el viaje;
- no tiene instalado el plugin de Sendero;
- recibe un link público read-only;
- abre el viaje en el navegador compatible;
- usa su agente para entender cómo incorporarse al grupo.

## 9. Escenario principal de demo

### Contexto

Un grupo tiene un itinerario en Buenos Aires. El viernes incluye:

- desayuno;
- visita cultural;
- almuerzo;
- paseo por un barrio;
- cena reservada.

El invitado aterriza a las 17:30 y estima cuarenta y cinco minutos para llegar desde el aeropuerto.

### Prompt

> “I land on Friday at 5:30 PM and need about 45 minutes to get into the city. What will I miss, and where is the earliest place I can join the group?”

### Secuencia visible

1. El invitado abre el shared trip.
2. El agente descubre las site tools.
3. Consulta el contexto del viaje y el viernes.
4. Ejecuta el preview de llegada.
5. Sendero atenúa actividades imposibles.
6. Resalta el primer punto alcanzable.
7. Centra el mapa en ese punto.
8. Muestra hora estimada de encuentro y contexto.
9. El agente explica la respuesta.
10. Un botón o tool limpia la vista personalizada.
11. El itinerario del owner no cambia y conserva su versión.

## 10. Experiencia antes y después

### Antes

```text
Abrir link → leer agenda → abrir mapa → calcular tiempos mentalmente → preguntar al owner
```

### Después

```text
Abrir link → preguntar al agente → ver respuesta aplicada sobre agenda y mapa
```

## 11. Site tools P0

### `get_shared_trip_context`

Lee información general del viaje visible:

- título;
- destino;
- timezone;
- fechas;
- versión pública;
- días disponibles;
- capacidades permitidas;
- última actualización.

No devuelve información privada.

### `get_day_itinerary`

Devuelve el itinerario estructurado de una fecha:

- items ordenados;
- horas;
- duración;
- tipo;
- lugar público;
- estado;
- reserva requerida o confirmada como boolean/contexto público;
- traslados disponibles;
- IDs públicos estables.

### `preview_guest_arrival`

Recibe:

- fecha;
- hora de llegada;
- minutos estimados antes de poder incorporarse;
- opcionalmente un punto de inicio público o label.

Produce una proyección temporal:

- items perdidos;
- items no alcanzables;
- primer item alcanzable;
- punto sugerido de encuentro;
- hora estimada;
- explicación estructurada;
- overlay aplicado en la UI.

No persiste cambios.

### `show_day_on_map`

Selecciona un día en la timeline y ajusta el mapa para mostrar sus lugares.

Efecto: solamente UI local.

### `focus_itinerary_item`

Selecciona un item por ID público, lo desplaza a la vista y centra/resalta su marker.

Efecto: solamente UI local.

### `clear_guest_preview`

Limpia filtros, atenuaciones, highlights y el arrival preview.

Efecto: solamente UI local.

## 12. Site tools P1, solo si P0 está sólido

- `get_booking_requirements`
- `highlight_items_by_type`
- `highlight_items_by_area`
- `get_meeting_points`
- `get_public_transport_notes`

No agregar tools P1 para inflar el número. Cada una debe resolver un objetivo demostrable.

## 13. Requisitos funcionales

### FR-01 — Página normal funcional

La shared page debe funcionar correctamente en navegadores sin WebMCP.

### FR-02 — Registro condicional

Las tools se registran solamente cuando existe `document.modelContext.registerTool`.

### FR-03 — Datos actuales

Las tools deben trabajar con la misma versión pública que la UI.

### FR-04 — Proyección pública

Los resultados no deben revelar campos privados o internos.

### FR-05 — Sin mutación canónica

Ninguna tool del challenge puede modificar la API, DB o versión del viaje.

### FR-06 — Sin plugin

El invitado puede usar las site tools sin instalar Sendero ni conectar el MCP remoto.

### FR-07 — Feedback visual

Las acciones relevantes deben producir un cambio visible en timeline o mapa.

### FR-08 — Reversibilidad local

El usuario puede limpiar la personalización y volver a la vista canónica.

### FR-09 — Timezone correcto

Las comparaciones temporales deben usar el timezone del viaje.

### FR-10 — Errores comprensibles

Si la fecha no existe, faltan datos o no puede calcularse una reunión, la tool responde con un error estructurado y la UI permanece estable.

## 14. Requisitos no funcionales

- HTTPS y secure context;
- carga mobile razonable;
- tool outputs acotados;
- schemas cerrados con `additionalProperties: false`;
- no insertar instrucciones no confiables en descripciones;
- logs de registro y ejecución sin PII;
- feature flag para desactivar WebMCP;
- accesibilidad de estados resaltados;
- demo reproducible con seed data o un trip estable.

## 15. Fuera de alcance del challenge

- registro general de usuarios;
- biblioteca de viajes;
- colaboración persistente;
- invitaciones;
- roles editor;
- edición del itinerario mediante WebMCP;
- comentarios;
- preferencias guardadas del invitado;
- realtime multiusuario;
- billing;
- Trip Pass;
- Sendero for Hosts;
- Sendero Ready;
- snippet para negocios;
- reparación automática por clima;
- versionado/undo nuevo, salvo que ya exista y sea necesario para el sistema actual.

## 16. Criterios de aceptación

El submission está listo cuando:

1. una URL pública abre un viaje completo;
2. la página funciona sin WebMCP;
3. ChatGPT o Chrome detecta las site tools;
4. el agente obtiene el día correcto;
5. el prompt de llegada tardía produce una respuesta exacta;
6. timeline y mapa cambian de forma visible;
7. la personalización puede limpiarse;
8. el viaje canónico no cambia;
9. no se expone información privada;
10. el flujo funciona repetidamente en un ambiente limpio;
11. el repositorio público contiene código, licencia e instrucciones;
12. `CHALLENGE.md` distingue baseline y delta;
13. el video público dura menos de tres minutos y tiene audio.

## 17. Métricas del experimento

- tool registration success rate;
- tool execution success rate;
- tiempo hasta primer resultado visual;
- número de pasos del flujo;
- arrival previews válidos;
- errores de timezone;
- uso de clear/reset;
- preguntas que requirieron fallback al DOM;
- tamaño y latencia de tool outputs.

## 18. Relación con los criterios de judging

### WebMCP Leverage

- tools estructuradas no triviales;
- lectura exacta del viaje abierto;
- coordinación con estado visual;
- personalización temporal aplicada en la página;
- uso real de la sesión y contexto de la página;
- fallback normal sin WebMCP.

### Execution

- producto existente y completo;
- demo clara de punta a punta;
- mapa y agenda sincronizados;
- errores y privacidad contemplados;
- deployment estable.

### Potential Impact

- los viajes grupales generan preguntas individuales reales;
- reduce trabajo del organizador;
- mejora la utilidad de un link compartido;
- no requiere instalar otra app;
- abre un camino hacia colaboración y hosts.

### Creativity & Ambition

- cada viewer obtiene una interpretación personal del mismo plan canónico;
- el agente no solo responde: modifica la representación visual;
- separa estado de grupo y overlay personal;
- extiende un plugin conversacional hacia invitados que nunca usaron el plugin.

## 19. Diferenciación frente a un planner editable genérico

OpenAI ya muestra WanderNote como ejemplo de un planner editable con mapa donde usuario y agente revisan un itinerario. Sendero no debería competir presentando simplemente “un itinerary planner with AI”.

La diferencia del submission es:

- el plan nació en la conversación de otra persona;
- el viewer no es owner;
- no tiene el contexto original;
- no necesita instalar Sendero;
- el itinerario se comparte como fuente canónica;
- cada invitado genera una lectura personal y temporal;
- la personalización no modifica el plan del grupo.

## 20. Texto breve para Devpost

### What it does

Sendero turns an AI-generated group trip into a shared live itinerary. With WebMCP, every guest who opens the shared page can ask their own agent how the trip fits their personal timing and see the answer highlighted directly in the schedule and map.

### Why WebMCP

A browser agent could scrape the page, but it would have to infer times, booking states, locations, and UI relationships. Sendero exposes explicit tools for the trip currently open and lets the agent control the same visual state the guest is inspecting.

### What becomes possible

A guest who arrives late can instantly see what they will miss, the earliest activity they can reach, and the exact meeting point on the map—without installing the Sendero plugin and without changing the owner’s itinerary.

### What was added during the challenge

WebMCP tool registration, a sanitized shared-trip projection, synchronized timeline/map actions, a temporary guest-arrival preview, tests, and challenge-specific documentation were added to Sendero’s pre-existing plugin, API, landing, and shared itinerary page.

## 21. Riesgo principal

El mayor riesgo es que el resultado parezca “un agente leyó JSON”. La mitigación obligatoria es que la tool call produzca una transformación visual útil, verificable y reversible sobre la página compartida.
