# Sendero — implementation backlog

**Fecha:** 2026-08-28
**Estado:** backlog target; debe ajustarse después de `AS_IS_AUDIT.md`
**Convención de prioridad:** P0 challenge, P1 post-challenge inmediato, P2 Traveler core, P3 Business

## 1. Reglas de uso

- No asumir que un ticket representa trabajo faltante hasta auditar el repo.
- Si una capacidad ya existe, convertir el ticket en verificación, hardening o cerrar con evidencia.
- No incorporar P1/P2/P3 en la rama del challenge salvo dependencia técnica mínima.
- Cada ticket debe enlazar commits, tests y evidencia de comportamiento.
- La Definition of Done exige build/tests, no solo código.

# Epic C0 — Auditoría y baseline del challenge

## C0-01 — Inventariar repositorios y deployment

**Prioridad:** P0
**Resultado:** mapa frontend/backend/MCP/landing/shared pages y SHA desplegados.

**Aceptación:**

- [ ] Repositorios y ramas documentados.
- [ ] Stack y comandos de ejecución identificados.
- [ ] Ambientes y hosting identificados.
- [ ] No se incluyen secretos en la documentación.

## C0-02 — Auditar tools MCP actuales

**Prioridad:** P0

- [ ] Nombre, schema, read/write y path de cada tool.
- [ ] Flujo hacia API trazado.
- [ ] Auth y owner resolution documentados.
- [ ] Duplicaciones potenciales con WebMCP señaladas.

## C0-03 — Auditar página compartida

**Prioridad:** P0

- [ ] Ruta y loader localizados.
- [ ] API response real documentado.
- [ ] Estado de mapa/timeline localizado.
- [ ] Privacidad de proyección evaluada.
- [ ] Mobile, loading y error states revisados.

## C0-04 — Crear baseline pre-WebMCP

**Prioridad:** P0

- [ ] Commit base identificado.
- [ ] Tag o referencia creada sin alterar historia.
- [ ] `CHALLENGE.md` describe trabajo previo.
- [ ] Compare URL o comando documentado.

## C0-05 — Definir estrategia de repo público

**Prioridad:** P0

- [ ] Confirmar si el repo actual puede publicarse.
- [ ] Auditar secretos, assets y licencias.
- [ ] Elegir licencia open source.
- [ ] Si hace falta, preparar edición pública funcional sin falsificar historia.

# Epic C1 — Shared projection segura

## C1-01 — Formalizar `SharedTripProjection`

**Prioridad:** P0

- [ ] Contrato TypeScript/schema explícito.
- [ ] Timezone, dates, IDs y statuses incluidos.
- [ ] Campos privados excluidos por allowlist.
- [ ] Tests de serialización y data minimization.

## C1-02 — Versionar o marcar frescura de la proyección

**Prioridad:** P0

- [ ] `tripVersion` o equivalente disponible.
- [ ] `updatedAt` disponible.
- [ ] Shared page y tools leen el mismo estado actual.
- [ ] Cache no mezcla accesos.

## C1-03 — Manejar links inválidos/revocados

**Prioridad:** P0

- [ ] Estados 404/410/forbidden definidos.
- [ ] UI humana clara.
- [ ] Tool error estable.
- [ ] Token no aparece en logs/analytics.

# Epic C2 — Facade y estado de la página

## C2-01 — Extraer `SharedTripFacade`

**Prioridad:** P0

- [ ] Lee projection desde el store real.
- [ ] Expone selected date/item.
- [ ] Permite select/focus/clear.
- [ ] No inspecciona DOM.
- [ ] Unit tests.

## C2-02 — Sincronizar mapa y timeline

**Prioridad:** P0

- [ ] Seleccionar item enfoca mapa y card.
- [ ] Seleccionar día actualiza ambas vistas.
- [ ] IDs inválidos no rompen UI.
- [ ] Mobile tiene comportamiento equivalente.

## C2-03 — Implementar guest preview local

**Prioridad:** P0

- [ ] Arrival input se valida en timezone del viaje.
- [ ] Items perdidos se marcan visualmente.
- [ ] Primer meetup viable se resalta.
- [ ] El preview no llama endpoints de mutación.
- [ ] Clear restaura estado.

# Epic C3 — WebMCP tools del challenge

## C3-01 — Feature detection y lifecycle

**Prioridad:** P0

- [ ] Registro solo si API disponible.
- [ ] Tools en top-level page.
- [ ] Cleanup/re-registration al cambiar trip/context.
- [ ] Página funciona sin WebMCP.

## C3-02 — `get_shared_trip_context`

**Prioridad:** P0

- [ ] Devuelve título, destino, fechas, timezone, versión y días.
- [ ] No devuelve campos privados.
- [ ] Read-only annotation cuando sea soportada.
- [ ] Contract test.

## C3-03 — `get_day_itinerary`

**Prioridad:** P0

- [ ] Requiere fecha válida.
- [ ] Devuelve items ordenados y semánticos.
- [ ] Incluye requirements y ubicación permitida.
- [ ] Error estable para fecha fuera del viaje.

## C3-04 — `preview_guest_arrival`

**Prioridad:** P0

- [ ] Inputs estrechos.
- [ ] Usa facade/algoritmo, no DOM.
- [ ] Devuelve missed items y meetup candidate.
- [ ] Actualiza UI local.
- [ ] No persiste.

## C3-05 — `show_day_on_map`

**Prioridad:** P0

- [ ] Selecciona el día.
- [ ] Ajusta mapa a items válidos.
- [ ] Devuelve estado verificable.

## C3-06 — `focus_itinerary_item`

**Prioridad:** P0

- [ ] Valida ID dentro de projection.
- [ ] Enfoca timeline/mapa.
- [ ] Devuelve título y fecha/item seleccionado.

## C3-07 — `clear_guest_preview`

**Prioridad:** P0

- [ ] Limpia preview y focus temporal cuando corresponda.
- [ ] Idempotente.
- [ ] Devuelve estado final.

## C3-08 — Tool metadata review

**Prioridad:** P0

- [ ] Nombres orientados a intención.
- [ ] Descripciones no prometen más de lo que hacen.
- [ ] `additionalProperties: false` donde aplique.
- [ ] Side effects descritos.
- [ ] Outputs compactos y verificables.

# Epic C4 — Seguridad, testing y observabilidad

## C4-01 — Threat model ligero

**Prioridad:** P0

- [ ] Share token leakage.
- [ ] Prompt injection desde trip/place content.
- [ ] Oversharing.
- [ ] Tool misuse.
- [ ] XSS/content rendering.
- [ ] Rate limiting.

## C4-02 — Unit tests

**Prioridad:** P0

- [ ] Arrival preview edge cases.
- [ ] Timezone.
- [ ] Empty day.
- [ ] Invalid IDs.
- [ ] No meetup candidate.
- [ ] Clear/idempotency local.

## C4-03 — Integration tests

**Prioridad:** P0

- [ ] Projection → facade → tool result.
- [ ] UI updates after tool call.
- [ ] No backend mutation requests.
- [ ] Link revoked.

## C4-04 — E2E demo test

**Prioridad:** P0

- [ ] Live URL opens.
- [ ] Tools discovered.
- [ ] Main prompt completes.
- [ ] Timeline/map update.
- [ ] Refresh shows canonical trip unchanged.
- [ ] Fallback browser works.

## C4-05 — Telemetry mínima

**Prioridad:** P0

- [ ] registration/invocation/success/error.
- [ ] request ID.
- [ ] no secret/personal payloads.
- [ ] dashboard/log query para demo failures.

# Epic C5 — Submission

## C5-01 — `CHALLENGE.md`

**Prioridad:** P0

- [ ] Pre-existing functionality.
- [ ] Baseline SHA/tag.
- [ ] New WebMCP work.
- [ ] Compare instructions.
- [ ] Architecture diagram.

## C5-02 — Public README

**Prioridad:** P0

- [ ] Product description.
- [ ] Local setup.
- [ ] Environment variables documented safely.
- [ ] WebMCP test instructions.
- [ ] Demo credentials if required.
- [ ] License visible.

## C5-03 — Deployment freeze candidate

**Prioridad:** P0

- [ ] Submission tag.
- [ ] Exact SHA deployed.
- [ ] Health check.
- [ ] No third-party fragile dependency without fallback.

## C5-04 — Video

**Prioridad:** P0

- [ ] Menor a 3 minutos.
- [ ] Audio claro.
- [ ] Antes/después.
- [ ] Tools visibles o explicadas.
- [ ] No claims no implementados.
- [ ] Público en YouTube.

## C5-05 — Devpost text

**Prioridad:** P0

- [ ] Strong fit for WebMCP.
- [ ] Better user experience.
- [ ] Human + agent collaboration.
- [ ] Implementation summary.
- [ ] Existing vs new work.

# Epic T1 — Post-challenge hardening

## T1-01 — Analizar uso y fallos

**Prioridad:** P1

- [ ] Tool usage report.
- [ ] Top questions.
- [ ] Failure taxonomy.
- [ ] Decision keep/change/remove por tool.

## T1-02 — Expandir read-only companion

**Prioridad:** P1

Candidatos:

```text
get_booking_requirements
get_meeting_points
get_transport_details
get_accessibility_summary
highlight_items_by_area
```

Agregar solo con evidencia de necesidad.

## T1-03 — Mejorar mobile y travel mode

**Prioridad:** P1

- [ ] Próximo item.
- [ ] Directions CTA.
- [ ] Timezone/local time.
- [ ] Data-light loading.

# Epic T2 — Traveler identity

## T2-01 — User/account model

**Prioridad:** P2

- [ ] User estable.
- [ ] Session/login.
- [ ] Recovery/security.
- [ ] Migration strategy.

## T2-02 — Personal workspace y trip ownership

**Prioridad:** P2

- [ ] Workspace personal.
- [ ] Owner de trips existentes.
- [ ] Access checks.

## T2-03 — Trip library

**Prioridad:** P2

- [ ] Owned/shared tabs.
- [ ] Upcoming/in-progress/completed.
- [ ] Search/filter.
- [ ] Open/manage share links.

## T2-04 — Duplicate shared trip

**Prioridad:** P2

- [ ] CTA para crear cuenta.
- [ ] Copy con nueva ownership.
- [ ] Provenance de template.
- [ ] Sin copiar datos privados.

# Epic T3 — Collaboration

## T3-01 — Invitations

**Prioridad:** P2

- [ ] Email/link token.
- [ ] Role offered.
- [ ] Expiry/revoke.
- [ ] Single acceptance.

## T3-02 — Trip memberships

**Prioridad:** P2

- [ ] owner/editor/viewer.
- [ ] Capability resolver.
- [ ] Member panel.
- [ ] Remove/change role.

## T3-03 — Shared page authenticated context

**Prioridad:** P2

- [ ] Detect session.
- [ ] Access context.
- [ ] WebMCP tools by role.
- [ ] Viewer denial tests.

## T3-04 — Versioned itinerary commands

**Prioridad:** P2

- [ ] expected version.
- [ ] idempotency.
- [ ] audit events.
- [ ] conflict response.

## T3-05 — Editor WebMCP tools

**Prioridad:** P2

- [ ] preview change.
- [ ] add/move/replace/remove.
- [ ] apply/confirm semantics.
- [ ] UI sync.
- [ ] permission tests.

## T3-06 — Remote MCP account access

**Prioridad:** P2

- [ ] account auth.
- [ ] `list_accessible_trips`.
- [ ] role/destination/date filters.
- [ ] ambiguous trip flow.
- [ ] same commands and permissions.

# Epic T4 — Execution and premium

## T4-01 — Today view
## T4-02 — Reservations and locks
## T4-03 — Localized repair preview/apply
## T4-04 — History and undo
## T4-05 — Calendar/map export
## T4-06 — Offline/cache strategy
## T4-07 — Alerts and notifications
## T4-08 — Entitlements and limits
## T4-09 — Trip Pass experiment
## T4-10 — Annual plan experiment

Todos son P2 y requieren definición individual antes de implementación.

# Epic H1 — Sendero for Hosts

## H1-01 — Host workspace
## H1-02 — Property model
## H1-03 — Host guide
## H1-04 — Stay model and private link
## H1-05 — Guest preference intake
## H1-06 — Itinerary around property
## H1-07 — Branding and contact
## H1-08 — Host analytics
## H1-09 — Pricing pilot

**Prioridad:** P3; comenzar después de Traveler identity y shared experience estable.

# Epic B1 — Sendero Ready

## B1-01 — Business workspace
## B1-02 — URL scanner
## B1-03 — Vertical classifier
## B1-04 — Canonical business profile
## B1-05 — Adaptive wizard
## B1-06 — Domain verification
## B1-07 — Snippet loader
## B1-08 — Configuration API
## B1-09 — Structured data renderer
## B1-10 — Business WebMCP read tools
## B1-11 — Validation worker
## B1-12 — Seal and verification page
## B1-13 — Freshness alerts
## B1-14 — Sendero index publication
## B1-15 — Managed plan pilot

**Prioridad:** P3; no iniciar como extensión accidental del challenge.

## Definition of Done global

Una historia está terminada cuando:

- [ ] comportamiento y edge cases están definidos;
- [ ] autorización y privacidad fueron consideradas;
- [ ] tests relevantes pasan;
- [ ] build/lint/typecheck pasan;
- [ ] observabilidad existe para fallos importantes;
- [ ] documentación del contrato está actualizada;
- [ ] no se introdujo duplicidad entre superficies;
- [ ] deployment y rollback están definidos cuando aplica;
- [ ] el resultado se verificó en la superficie real del usuario.
