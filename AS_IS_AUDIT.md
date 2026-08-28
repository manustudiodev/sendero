# Sendero — auditoría as-is para The WebMCP Challenge

**Fecha de auditoría:** 2026-08-28
**Rama inspeccionada:** `main`
**HEAD local y remoto:** `a8ebc826c5814d3dfc7a88e658ffade748eb039f`
**Estado:** baseline pre-WebMCP confirmado; los documentos de producto agregados el 28 de agosto están sin seguimiento y no forman parte del baseline.

## Resumen ejecutivo

Sendero ya es una aplicación única Node/Hono desplegada en Vercel que contiene el MCP remoto, la API/BFF web, las páginas públicas y autenticadas, y los bundles React. Convex es la fuente de persistencia. La página pública `/share#TOKEN` ya resuelve una copia congelada y sanitizada del itinerario mediante un `POST` same-origin, funciona sin Auth0 y tiene un mapa por día.

El delta WebMCP todavía no existe. La proyección pública actual es una buena frontera de privacidad, pero no incluye timezone, IDs públicos ni semántica pública de reservas. La UI tampoco ofrece un facade común para seleccionar un día, enfocar un item o aplicar un overlay temporal. Esos son los gaps reales del challenge.

La producción respondió `200` en `/health` durante esta auditoría y GitHub registra un deployment de producción exitoso del mismo SHA. El repositorio es privado y no tiene licencia detectada, por lo que aún no cumple el requisito de repositorio público open source de la submission.

## 1. Inventario y deployment

### CONFIRMED

| Superficie | Implementación real | Evidencia |
|---|---|---|
| Runtime y servidor | Node 22, Hono, un único servidor para web y MCP | `package.json`; `server/app.mjs:createApp` |
| MCP remoto | MCP SDK por Streamable HTTP en `POST /mcp` | `server/app.mjs:app.all("/mcp")`; `server/server.mjs:createTripPlannerServer` |
| Persistencia | Convex, con adaptador en el servidor | `server/persistence.mjs:createConvexPersistence`; `convex/schema.ts` |
| Landing y legales | Páginas React autocontenidas servidas por Hono | `web/build.mjs:pages`; `server/app.mjs` |
| Cuenta y colaboración | Cuenta, itinerario restringido e invitaciones ya existen en código | `web/src/account`; `web/src/restricted`; `web/src/invite`; `convex/tripAccess.ts`; `convex/tripInvitations.ts` |
| Shared page pública | `/share#TOKEN`, sin login | `server/app.mjs:app.get("/share")`; `web/src/share/PublicShareApp.jsx` |
| Hosting | Vercel | `vercel.json`; deployment GitHub `6140719216` |

### Deployment verificado

- SHA desplegado: `a8ebc826c5814d3dfc7a88e658ffade748eb039f`.
- Deployment de producción: estado `success`, creado el `2026-08-28T11:58:50Z`.
- Alias público comprobado: `https://sendero-alpha.vercel.app/health`.
- Respuesta observada: storage, authentication, public sharing y Maps configurados; web authentication no configurado.
- El último commit anterior a la apertura del challenge fue `123bd07bf91ef69e3182646a6f550a4c614c7465` (`2026-08-25T15:52:53-03:00`).
- El baseline de implementación WebMCP recomendado es el HEAD actual `a8ebc826...`, porque no contiene WebMCP. Para una comparación histórica honesta también debe conservarse la referencia `123bd07...`; ningún trabajo intermedio debe presentarse como delta WebMCP.

### Riesgo de submission

- Repositorio GitHub: `PRIVATE`.
- Licencia detectada: ninguna.
- No debe hacerse público, agregar licencia, crear tag, branch, commit, push ni deployment sin una decisión explícita del owner.

## 2. Flujo real ChatGPT → MCP → persistencia

```text
ChatGPT
  → POST /mcp (Hono)
  → validación OAuth/Auth0 y scopes
  → createTripPlannerServer()
  → tool handler
  → createConvexPersistence()
  → Convex query/mutation/action
  → trips, revisions, members, invitations o publicShares
```

Evidencia principal:

- autenticación y montaje del transporte: `server/app.mjs:app.all("/mcp")`;
- registro de tools: `server/server.mjs:createTripPlannerServer`;
- scopes: `trips:read`, `trips:write`, `trips:share` en `server/auth.mjs` y `README.md`;
- acceso y operaciones Convex: `server/persistence.mjs`;
- autorización autoritativa: `convex/tripAccess.ts` y mutations especializadas.

## 3. Tools MCP existentes

Se localizaron 27 tools. WebMCP no debe duplicar este servidor ni convertir estas tools en dependencia del viewer público.

### Lectura, preparación y presentación

- `prepare_trip_brief`
- `render_trip_requirements`
- `render_trip_intake`
- `validate_itinerary`
- `render_itinerary`
- `present_trip`
- `open_trip`
- `find_itineraries`
- `list_itineraries`
- `get_itinerary`
- `get_trip_access`
- `preview_public_share`
- `get_public_share_status`

### Mutaciones de viaje, acceso y publicación

- `update_reservation_status`
- `save_itinerary`
- `save_and_present_trip`
- `invite_trip_member`
- `resend_trip_invitation`
- `revoke_trip_invitation`
- `change_trip_member_role`
- `remove_trip_member`
- `share_trip_publicly`
- `publish_public_share`
- `update_public_share`
- `rotate_public_share`
- `revoke_public_share`
- `restore_itinerary_version`

Los schemas, annotations y descripciones están junto a cada `server.registerTool(...)` en `server/server.mjs`. Los handlers protegidos vuelven a comprobar auth/scopes y Convex vuelve a comprobar ownership/capabilities; la metadata del cliente no es el control de autorización.

## 4. Modelo de datos real

### CONFIRMED

- `trips` conserva owner, snapshot actual, `currentVersion`, locale, `webId` y timestamps.
- `tripRevisions` conserva snapshots inmutables.
- `tripMembers`, `tripInvitations` y `tripAccessAudit` ya implementan colaboración.
- `publicShares` conserva únicamente hash del token, snapshot público congelado, `sourceVersion`, generación, estado, expiración y timestamps.
- `publicShareOperations` da idempotencia a publish/update/rotate/revoke.

Evidencia: `convex/schema.ts`; `convex/trips.ts`; `convex/publicShares.ts`.

### CONTRADICTS TARGET ASSUMPTION

La publicación pública no se actualiza automáticamente con cada cambio del owner. Es una copia congelada de una versión y requiere `update_public_share`/`share_trip_publicly` para publicar una nueva copia manteniendo el link. Esto está documentado correctamente en `README.md` y se implementa con `publicShares.sourceVersion`.

Para el challenge esto no bloquea: la UI y las site tools deben leer exactamente el mismo snapshot público abierto, no el agregado privado más reciente.

## 5. Shared page pública

### Loader y seguridad — CONFIRMED

1. `PublicShareApp` obtiene el bearer token únicamente de `window.location.hash`.
2. Envía `POST /api/public-shares/resolve` con `credentials: "omit"`, `cache: "no-store"` y `referrerPolicy: "no-referrer"`.
3. Hono valida content type, tamaño y formato del token.
4. Convex deriva un hash de dominio separado y busca la publicación activa.
5. El servidor valida el resultado con `publicItinerarySchema` antes de responder.

Evidencia: `web/src/share/PublicShareApp.jsx`; `web/src/share/public-share.js`; `server/app.mjs`; `convex/publicShareResolver.ts`; `convex/publicShares.ts:resolveByTokenHash`.

La respuesta de error es genérica para inexistente, revocado y vencido. El token no aparece en la URL HTTP, output, logs ni analytics. La página aplica `no-store`, `no-referrer`, `noindex` y una CSP limitada.

### Proyección pública — PARTIALLY IMPLEMENTED

`shared/public-snapshot.mjs:sanitizePublicSnapshot` ya usa allowlist y excluye:

- IDs privados de trip y activity;
- alojamiento exacto y variantes textuales;
- códigos, URLs, notas y deadlines de reservas;
- colaboradores, historial, prompts y claims;
- rutas que parten del alojamiento privado.

Gaps para WebMCP:

- no hay timezone IANA;
- no hay IDs públicos por activity;
- no hay versión pública en el payload de la página;
- no hay flags públicos de reserva requerida/confirmada;
- los textos de lugares y guías siguen siendo contenido no confiable y deben tratarse como datos, nunca como instrucciones.

### UI y mapa — PARTIALLY IMPLEMENTED

- `PublicShareApp` controla `activeView` (`list`, `calendar`, `routes`).
- `ItineraryViewer` contiene estado local independiente para día de calendario y día de rutas.
- `RoutesView` muestra Google Maps Embed si la cobertura es completa y un mapa esquemático como fallback.
- No existe un store/facade compartido para `selectDay`, `focusItem`, preview o clear.
- `DayCard` decide su apertura localmente y las actividades no tienen estados dim/highlight/focus.
- El mapa puede seleccionar un día, pero no enfocar un item por comando de aplicación.

Evidencia: `web/src/share/PublicShareApp.jsx`; `web/src/itinerary/ItineraryViewer.jsx:DayCard`; `CalendarView`; `RoutesView`; `RouteSchematic`.

### WebMCP — MISSING

No aparece `document.modelContext`, `registerTool` ni un adapter de site tools en la página. El único `registerTool` actual pertenece al MCP remoto server-side.

## 6. Calidad actual

### Baseline ejecutado

- `npm test`: **238/238 tests pasan**.
- `npm test` incluye `npm run build:ui`: **5 componentes y 7 páginas construidos**.
- No hay scripts separados de lint o typecheck en `package.json`.
- El build genera `server/ui/generated/widgets.mjs` de forma reproducible; la ejecución no dejó cambios tracked.
- La suite existente cubre auth, colaboración, publicación, privacidad, token handling, mapas, UI, localización y contratos MCP.

### Observabilidad

- El backend posee logs seguros de auth y fallos del resolver.
- La shared page pública no carga analytics, deliberadamente.
- No hay todavía eventos específicos de registro/invocación WebMCP.

## 7. Matriz current → target P0

| Requisito | Estado | Evidencia / gap |
|---|---|---|
| FR-01 página normal | IMPLEMENTADO | `/share`, React + Hono, fallback sin WebMCP implícito |
| FR-02 registro condicional | NO IMPLEMENTADO | no existe `document.modelContext` |
| FR-03 mismos datos UI/tools | PARCIAL | snapshot común existe; falta facade/tool adapter |
| FR-04 proyección pública | PARCIAL | allowlist sólida; falta semántica agent-ready |
| FR-05 sin mutación canónica | IMPLEMENTABLE SIN BACKEND NUEVO | resolver público solo expone read |
| FR-06 sin plugin | IMPLEMENTADO COMO ARQUITECTURA | `/share` no depende de MCP/Auth0 |
| FR-07 feedback visual | NO IMPLEMENTADO | no hay comandos externos de UI |
| FR-08 reversibilidad local | NO IMPLEMENTADO | no hay guest preview |
| FR-09 timezone | NO IMPLEMENTADO | modelo actual no declara timezone |
| FR-10 errores tool | NO IMPLEMENTADO | solo existen errores HTTP/UI humanos |
| `get_shared_trip_context` | NO IMPLEMENTADO | falta proyección/facade WebMCP |
| `get_day_itinerary` | NO IMPLEMENTADO | falta proyección/facade WebMCP |
| `preview_guest_arrival` | NO IMPLEMENTADO | falta algoritmo y overlay |
| `show_day_on_map` | PARCIAL | UI manual existe; falta comando compartido |
| `focus_itinerary_item` | NO IMPLEMENTADO | mapa/timeline no aceptan item focus |
| `clear_guest_preview` | NO IMPLEMENTADO | falta estado efímero |

## 8. Scope mínimo recomendado

1. Extender la proyección allowlisted solo con timezone opcional, IDs públicos derivados y semántica booleana de booking.
2. Exponer `sourceVersion/generation/updatedAt` seguros al cliente.
3. Crear un facade puro de shared trip con estado local y algoritmo determinístico de llegada.
4. Conectar `ItineraryViewer` al facade para día, focus, dim/highlight y mapa.
5. Registrar seis tools imperativas en la top-level page con feature detection y cleanup.
6. Cubrir contratos, privacidad, lifecycle y fallback con tests.

No se necesita un segundo backend, nuevas cuentas, nuevos roles, writes públicos, realtime ni billing.
