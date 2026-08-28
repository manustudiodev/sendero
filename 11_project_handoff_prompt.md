# Prompt de handoff para auditar e implementar Sendero

**Uso:** entregar este prompt a un agente con acceso real al repositorio y al entorno de desarrollo.
**Objetivo:** comparar el estado existente con este paquete y ejecutar el delta del challenge sin inventar arquitectura.

---

## Prompt

Trabaja sobre el proyecto Sendero. Antes de modificar código, lee en este orden:

1. `README.md`
2. `00_current_state_and_gap_analysis.md`
3. `02_webmcp_challenge_product_brief.md`
4. `03_webmcp_shared_page_technical_spec.md`
5. `10_challenge_submission_checklist.md`
6. `08_decision_log.md`
7. `09_implementation_backlog.md`

Contexto confirmado por el owner:

- Sendero ya tiene un plugin para ChatGPT.
- Ya existe un servidor MCP y una API.
- Ya existe una landing.
- Ya existen páginas web compartidas para visualizar itinerarios.
- El owner crea y administra el viaje mediante el plugin.
- Los invitados abren la página read-only y ven los cambios del owner.
- El objetivo urgente es agregar WebMCP a esa página compartida para The WebMCP Challenge.
- Un invitado que usa WebMCP desde la página no necesita instalar el plugin ni conectar el MCP remoto.
- El challenge no incluye colaboración persistente, cuentas nuevas, edición del viaje por invitados ni Sendero Business.
- La propuesta P0 es `Sendero Shared Trip Companion` y el escenario principal es una llegada tardía con preview local, timeline y mapa.

No asumas que nombres, rutas, entidades o features descritos en los documentos coinciden literalmente con el código. La jerarquía de evidencia es:

1. deployment verificable;
2. código y tests actuales;
3. decisiones confirmadas del paquete;
4. target specs;
5. hipótesis.

### Fase 1 — auditoría obligatoria

Inspecciona el repositorio y crea `AS_IS_AUDIT.md`. Incluye evidencia por path, símbolo, endpoint, branch y SHA.

Debes documentar:

- repositorios/paquetes y responsabilidades;
- stack, runtime y comandos;
- branch y SHA desplegados;
- flujo ChatGPT → MCP → API → persistence;
- todas las tools MCP existentes, schemas y side effects;
- modelo real de Trip/Itinerary/Item;
- endpoint y response de shared trip;
- share token, permisos y filtrado de datos;
- ruta y componentes de la página compartida;
- estado de timeline, mapa, selected day/item;
- forma en que la página recibe actualizaciones del owner;
- tests, lint, typecheck y build actuales;
- analytics/logging;
- restricciones para publicar el repo y agregar una licencia.

Para cada afirmación importante usa una referencia concreta, por ejemplo:

```text
Hecho: la página compartida obtiene el viaje mediante GET /...
Evidencia: apps/web/src/...:Lx-Ly y services/api/src/...:Lx-Ly
Confianza: alta
```

Separa:

```text
CONFIRMED
PARTIALLY IMPLEMENTED
MISSING
UNKNOWN
CONTRADICTS TARGET
```

No implementes todavía si existe una ambigüedad arquitectónica que pueda cambiar el alcance. En ese caso, presenta la opción mínima compatible con el deadline y una recomendación clara.

### Fase 2 — baseline del challenge

Identifica el último commit representativo antes del trabajo WebMCP. No reescribas historia, no falsees fechas y no atribuyas trabajo anterior al challenge.

Propón:

- baseline SHA/tag;
- branch de challenge;
- estrategia de repo público;
- licencia;
- `CHALLENGE.md` basado en `14_challenge_md_template.md`;
- compare base…head.

Si ya existen cambios sin commit, clasifícalos honestamente y usa staging selectivo cuando sea necesario.

### Fase 3 — plan de implementación

Crea `WEBMCP_IMPLEMENTATION_PLAN.md` mapeando el código real contra estos requisitos P0:

1. proyección pública segura y estructurada;
2. facade/store reutilizable por UI y WebMCP;
3. feature detection y lifecycle;
4. `get_shared_trip_context`;
5. `get_day_itinerary`;
6. `preview_guest_arrival`;
7. `show_day_on_map`;
8. `focus_itinerary_item`;
9. `clear_guest_preview`;
10. tests, seguridad, observabilidad y deployment.

Para cada item indica:

- estado actual;
- paths a modificar;
- contratos;
- dependencia;
- riesgo;
- test;
- criterio de aceptación;
- commit sugerido.

Prioriza reutilizar lógica existente. No dupliques el MCP remoto ni construyas un segundo backend.

### Fase 4 — implementación

Después de que el plan esté aprobado o si la instrucción explícita es implementar de inmediato, desarrolla únicamente el P0.

Reglas:

- WebMCP debe usar el estado de aplicación, no scraping del DOM.
- La página funciona sin WebMCP.
- Las tools viven en la top-level page.
- Los inputs son estrechos y validados.
- Los resultados son compactos y verificables.
- La proyección usa allowlist.
- No exponer códigos de reserva, datos personales, notas privadas ni tokens.
- No realizar ninguna mutación canónica.
- El preview de invitado es local y reversible.
- Timeline y mapa reflejan las tool calls.
- Usar timezone explícito.
- Tratar contenido de lugares/notas como untrusted data.
- Añadir tests y logs mínimos.
- No incorporar accounts, memberships, billing, Hosts ni Ready.

### Fase 5 — verificación

Ejecuta y reporta:

- install;
- build;
- typecheck;
- lint;
- unit tests;
- integration tests;
- E2E del prompt principal;
- fallback sin WebMCP;
- test de link inválido;
- test de privacidad;
- test de refresh que confirma que el canonical trip no cambió.

No declares “listo” si una prueba no fue ejecutada. Distingue fallo nuevo de fallo preexistente.

### Fase 6 — submission

Actualiza:

- README público;
- `CHALLENGE.md`;
- arquitectura breve;
- instrucciones WebMCP;
- baseline/compare;
- demo data;
- license;
- texto Devpost;
- guion del video;
- checklist final.

La descripción del producto debe ser honesta:

> Sendero already turned a ChatGPT conversation into a live shared itinerary. During the challenge, the shared page was extended with WebMCP so each guest can explore how the group plan applies to them, using their own agent, without installing the Sendero plugin and without modifying the owner's itinerary.

### Formato de actualizaciones

Durante el trabajo, informa solo hallazgos que cambien decisiones:

- gaps reales;
- contradicciones;
- riesgos de deadline;
- seguridad/privacidad;
- cambios de scope;
- resultado de pruebas.

Evita reportar operaciones triviales. Mantén una tabla current → target actualizada.

### Entregables finales del agente

- `AS_IS_AUDIT.md`
- `WEBMCP_IMPLEMENTATION_PLAN.md`
- código y tests P0
- `CHALLENGE.md`
- README actualizado
- compare baseline…submission
- reporte de verificación
- checklist Devpost completada
- listado explícito de trabajo posterior trasladado al roadmap

---
