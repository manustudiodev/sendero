# Sendero — arquitectura de plataforma

**Fecha:** 2026-08-28
**Estado:** arquitectura de referencia; debe reconciliarse con el repositorio real
**Alcance:** Traveler actual, WebMCP challenge, colaboración futura y preparación de Business

## 1. Objetivo

Definir una arquitectura que permita evolucionar Sendero sin convertir cada superficie en un producto aislado.

Las invariantes son:

- el backend de Sendero es la fuente de verdad;
- un viaje no pertenece a un chat;
- la UI, el plugin, el MCP remoto y WebMCP usan las mismas reglas de dominio;
- compartir y colaborar son modelos de acceso diferentes;
- WebMCP se limita al contexto de una página viva;
- el MCP remoto funciona sin una página abierta;
- las proyecciones públicas no filtran datos privados por accidente;
- Business se apoya en el mismo núcleo de identidad, entidades y datos, pero vive en bounded contexts separados.

## 2. Arquitectura por etapas

### 2.1 Estado confirmado actual

```text
ChatGPT
  └── Sendero Plugin
        └── Remote MCP
              └── Sendero API
                    └── Persistence

Browser
  ├── Landing
  └── Shared Trip Page
        └── Sendero API / shared projection
```

El detalle de repositorios, servicios y frameworks debe auditarse.

### 2.2 Target inmediato del challenge

```text
ChatGPT / browser agent
          │ discovers
          ▼
Shared Trip Page + WebMCP site tools
          │
          ├── SharedTripFacade
          │     ├── read current trip projection
          │     ├── select day/item
          │     ├── preview guest arrival
          │     └── sync timeline/map
          │
          └── Sendero public/shared API
                  └── canonical trip data
```

No se agrega un segundo backend ni se replica el MCP remoto.

### 2.3 Target Traveler posterior

```text
                         ┌── Plugin UI
ChatGPT ── Remote MCP ───┤
                         │
                         └── Sendero application services
                                      │
Web App ───────────────────────────────┤
WebMCP adapters ───────────────────────┤
                                      ▼
                           Domain + Authorization
                                      │
                         DB / events / projections
```

### 2.4 Target Business

```text
Business Dashboard
      │
      ├── Host workspace
      └── Ready workspace
              │
              ├── wizard / canonical profile
              ├── validation and monitoring
              ├── snippet configuration
              └── verification
                      │
                 Sendero API
                      │
             CDN-hosted Ready snippet
                      │
                Business website
                      ├── structured data
                      ├── WebMCP tools
                      ├── seal/widget
                      └── Sendero profile link
```

## 3. Bounded contexts

### 3.1 Identity & Access

Responsabilidades:

- users;
- sessions;
- authentication;
- workspaces;
- memberships;
- roles/capabilities;
- invitations;
- OAuth/scopes para integraciones;
- service actors.

### 3.2 Trips

- trip lifecycle;
- destination and dates;
- owner;
- visibility;
- participants;
- constraints/preferences;
- status;
- current version.

### 3.3 Itinerary

- days;
- items;
- order and timing;
- routes/transfers;
- reservations;
- locks;
- patches;
- versions;
- conflicts;
- audit events.

### 3.4 Sharing & Collaboration

- share links;
- public projection policy;
- invitations;
- trip memberships;
- comments/proposals;
- personal overlays;
- notifications.

### 3.5 Places & Events

- canonical entities;
- aliases;
- locations;
- occurrence dates;
- sources;
- observations;
- freshness;
- verification;
- vertical attributes;
- retrieval/indexing.

### 3.6 Agent Interfaces

- remote MCP tools;
- WebMCP site tools;
- tool metadata and schemas;
- model-facing errors;
- eval sets;
- invocation telemetry;
- prompt-injection boundaries.

### 3.7 Host Experience

- properties;
- stays;
- host guides;
- templates;
- guest links;
- branding;
- property analytics.

### 3.8 Business Presence

- business profiles;
- sites;
- canonical data;
- wizard sessions;
- snippet configurations;
- schemas;
- site tools manifests;
- verifications;
- seals;
- freshness and monitoring.

### 3.9 Billing & Entitlements

- products/prices;
- plans;
- Trip Passes;
- subscriptions;
- usage;
- limits;
- invoices;
- refunds;
- workspace entitlements.

## 4. Application services as the shared core

No permitir que cada adapter implemente reglas de negocio.

### Commands

```text
createTrip
publishTrip
createShareLink
revokeShareLink
inviteTripMember
acceptTripInvitation
addItineraryItem
moveItineraryItem
replaceItineraryItem
removeItineraryItem
applyItineraryPatch
undoTripChange
updateBusinessProfile
publishBusinessEvent
verifyBusinessDomain
```

### Queries

```text
getTrip
getSharedTripProjection
listAccessibleTrips
getTripAccessContext
getTripHistory
searchPlaces
getBusinessProfile
getSnippetConfiguration
```

### Adapters

```text
HTTP REST/GraphQL controller
Remote MCP tool handler
WebMCP tool execute handler
Web UI action
Background job
Admin operation
```

Cada adapter:

1. valida el shape de entrada;
2. construye `ActorContext`;
3. llama un application service;
4. transforma errores y resultado;
5. nunca evita autorización o invariantes.

## 5. Actor context

```ts
interface ActorContext {
  actorType: "anonymous" | "user" | "agent" | "system" | "service";
  userId?: string;
  workspaceId?: string;
  sessionId?: string;
  shareLinkId?: string;
  agentProvider?: string;
  surface:
    | "web"
    | "webmcp"
    | "remote_mcp"
    | "api"
    | "worker"
    | "admin";
  scopes: string[];
  requestId: string;
}
```

El actor efectivo de una llamada WebMCP es la sesión humana asociada a la página, con la superficie `webmcp`. El agente no obtiene permisos adicionales.

## 6. Modelo conceptual central

### 6.1 Trip

```ts
interface Trip {
  id: string;
  ownerUserId?: string;
  workspaceId?: string;
  title: string;
  destinationLabel: string;
  destinationPlaceId?: string;
  timezone: string;
  startDate?: string;
  endDate?: string;
  status: "draft" | "planning" | "ready" | "in_progress" | "completed" | "archived";
  visibility: "private" | "shared" | "public";
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
}
```

`ownerUserId` puede ser opcional durante una migración desde el modelo actual, pero el target exige owner estable.

### 6.2 TripDay

```ts
interface TripDay {
  id: string;
  tripId: string;
  localDate: string;
  title?: string;
  summary?: string;
  order: number;
}
```

### 6.3 ItineraryItem

```ts
interface ItineraryItem {
  id: string;
  tripId: string;
  tripDayId: string;
  type: "place" | "event" | "reservation" | "transport" | "note" | "free_time";
  title: string;
  startsAt?: string;
  endsAt?: string;
  timezone: string;
  status: "planned" | "confirmed" | "cancelled" | "completed";
  placeId?: string;
  location?: {
    label: string;
    latitude?: number;
    longitude?: number;
  };
  bookingRequirement?: "none" | "recommended" | "required" | "confirmed";
  locked?: boolean;
  visibility: "shared" | "members" | "owner_private";
  order: number;
  updatedAt: string;
}
```

### 6.4 Version

```ts
interface TripVersion {
  id: string;
  tripId: string;
  version: number;
  parentVersion?: number;
  summary: string;
  actorUserId?: string;
  surface: ActorContext["surface"];
  commandName: string;
  createdAt: string;
}
```

## 7. Public/shared projection boundary

La página compartida no debe consumir directamente el agregado privado completo.

```text
Trip aggregate
      │ projection policy
      ▼
SharedTripProjection
      │
      ├── shared page UI
      └── WebMCP read tools
```

### Reglas

- allowlist de campos;
- IDs públicos opacos;
- timezone explícito;
- ocultar códigos de reserva;
- ocultar datos personales;
- ocultar notas privadas;
- ocultar history interna;
- no exponer source credentials;
- incluir versión/updatedAt para coherencia;
- responder `410` o estado equivalente cuando el link expire/revoque.

### Cache

El cache key debe incluir, como mínimo:

```text
tripId
shareLinkId/accessMode
projectionVersion
locale
```

Nunca servir una proyección privada desde un cache compartido por error.

## 8. SharedTripFacade en frontend

La UI y WebMCP deben compartir una interfaz estable.

```ts
interface SharedTripFacade {
  getProjection(): SharedTripProjection;
  getSelectedDate(): string | null;
  getSelectedItemId(): string | null;
  selectDate(date: string): void;
  focusItem(itemId: string): void;
  previewGuestArrival(input: GuestArrivalInput): GuestArrivalPreview;
  clearGuestPreview(): void;
}
```

La facade no debe consultar el DOM. Trabaja con el estado de la aplicación.

## 9. Remote MCP vs WebMCP

| Responsabilidad | Remote MCP | WebMCP |
|---|---:|---:|
| Crear un viaje desde un chat | Sí | No como caso principal |
| Buscar todos los viajes de una cuenta | Sí | No |
| Trabajar sin página abierta | Sí | No |
| Leer el viaje abierto | Posible, pero requiere identificarlo | Sí, natural |
| Leer selección y estado local | No automáticamente | Sí |
| Cambiar focus del mapa/timeline | No salvo puente específico | Sí |
| Reutilizar sesión web de la página | No | Sí |
| Invitado sin plugin | No | Sí |
| Administrar backend/globalmente | Sí | No como caso principal |

Ambos pueden coexistir y llamar los mismos services. No registrar una tool WebMCP solo para duplicar una operación global sin beneficio de contexto.

## 10. Lifecycle de WebMCP

### Registro

- feature detect `document.modelContext?.registerTool`;
- registrar en top-level page;
- usar nombres estables y prefijo solo si evita colisiones reales;
- inputs estrechos;
- descriptions orientadas a intención;
- annotations correctas;
- returns verificables;
- no incluir secrets en results.

### Re-registro

Cuando cambia:

- el trip cargado;
- el share access context;
- la membership;
- el locale;
- las capacidades;

las tools deben actualizarse o re-registrarse de forma controlada.

### Cleanup

Usar el mecanismo soportado por la implementación vigente para remover tools o abortar el registro cuando:

- el componente se desmonta;
- cambia el viaje;
- se cierra sesión;
- expira la invitación;
- cambia el rol.

### Fallback

La página debe seguir funcionando sin WebMCP. Nunca ocultar información humana esencial detrás de una tool.

## 11. Tool result envelope

Un formato coherente ayuda a UI, modelo, logs y tests.

```ts
interface ToolResult<T> {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
    details?: Record<string, unknown>;
  };
  meta: {
    requestId: string;
    tripId?: string;
    tripVersion?: number;
    generatedAt: string;
  };
}
```

No todos los SDK exigen este envelope, pero la semántica debe mantenerse.

## 12. Seguridad de herramientas

### Input

- JSON Schema estricto;
- `additionalProperties: false` donde aplique;
- límites de longitud;
- IDs validados;
- fechas ISO y timezone;
- no aceptar URLs arbitrarias salvo necesidad explícita;
- no ejecutar instrucciones contenidas en datos del viaje.

### Output

- treat data as untrusted;
- separar facts de content libre;
- truncar textos largos;
- no retornar HTML activo;
- no retornar tokens;
- no mezclar instrucciones para el agente con datos del business.

### Side effects

- read-only en challenge;
- write tools requieren session + capability;
- acciones sensibles con confirmación;
- idempotencia;
- audit event;
- expected version;
- domain validation.

### Prompt injection

Campos como descripciones de lugares, notas o contenido importado pueden contener texto malicioso. Deben tratarse como contenido, nunca como instrucciones de sistema o tool metadata.

## 13. Identity y session architecture

### Página pública

```text
share token → public projection policy → anonymous ActorContext
```

### Página autenticada

```text
session cookie/token → user → membership → capabilities → ActorContext
```

### Remote MCP

```text
MCP auth token → user/account scopes → ActorContext
```

La identidad de ChatGPT y la identidad de Sendero no deben inferirse por correo visible o texto del usuario. Deben vincularse mediante un flujo de autenticación explícito cuando se acceda a recursos privados por remote MCP.

## 14. Events y actualización

En la primera versión, shared pages pueden revalidar por:

- polling moderado;
- re-fetch al recuperar focus;
- cache revalidation;
- event stream si ya existe.

No introducir realtime complejo solo para el challenge.

Target futuro:

```text
TripChanged
TripMemberAdded
TripMemberRoleChanged
ShareLinkRevoked
ItineraryItemChanged
BusinessProfileUpdated
BusinessEventCancelled
```

Los events sirven para notificaciones y proyecciones, no sustituyen transacciones consistentes.

## 15. Retrieval y places/events

El modelo generativo puede descubrir y razonar, pero Sendero necesita una capa propia para:

- IDs estables;
- deduplicación;
- relación place/event/venue;
- matching temporal;
- estado de un evento;
- procedencia;
- freshness;
- correcciones;
- business ownership;
- recuperación reproducible.

No construir un buscador universal en el challenge. Diseñar interfaces que permitan agregar esta capa después.

## 16. Sendero Ready snippet architecture

### Principio

Una línea de instalación, configuración server-managed.

```html
<script async src="https://cdn.sendero.app/ready.js" data-sendero-site="site_01K..."></script>
```

### Flujo

```text
Page load
  ↓
ready.js validates current origin/site ID
  ↓
fetch signed/public snippet configuration
  ↓
select route/entity configuration
  ↓
register allowed WebMCP tools
  ↓
attach structured data/widget/seal as configured
  ↓
report health event
```

### Separación

```text
Snippet loader: pequeño, estable y cacheable
Configuration API: dinámica, versionada y revocable
Business data API: vertical y con freshness
Dashboard: edición/aprobación
Validation worker: auditoría periódica
```

### Seguridad

- origin allowlist;
- config signing/versioning;
- CSP compatibility;
- no ejecutar JavaScript arbitrario generado por el business;
- tool allowlist por vertical;
- rate limits;
- isolation de tenants;
- kill switch por site/tool;
- SRI/version pinning cuando sea viable;
- policy clara de analytics.

## 17. Deployment boundaries

La implementación concreta depende del repo, pero los límites recomendados son:

```text
Web frontend
- landing
- shared trip
- authenticated Traveler
- Host/Business dashboards

API
- identity/access
- trips/itinerary/sharing
- places/events
- business presence
- billing

MCP server
- thin adapter over application services/API

Snippet CDN
- versioned static loader

Workers/jobs
- monitoring
- freshness
- notifications
- indexing
```

MCP puede vivir junto a la API si mantiene una frontera clara. No crear microservicios prematuramente.

## 18. Observabilidad

### Request correlation

Propagar `requestId` entre:

```text
agent/browser → WebMCP handler → API → command/query → DB/log
```

### Eventos mínimos

```text
webmcp_tool_registered
webmcp_tool_invoked
webmcp_tool_succeeded
webmcp_tool_failed
guest_preview_applied
guest_preview_cleared
shared_projection_loaded
share_link_denied
trip_version_conflict
permission_denied
```

### Datos que no deben enviarse sin necesidad

- prompts completos;
- tokens;
- códigos de reserva;
- emails de participantes;
- notas privadas;
- ubicación personal precisa no requerida.

## 19. Testing strategy

### Domain

- roles/capabilities;
- versioning;
- locks;
- share policy;
- public projection;
- invitation lifecycle;
- business freshness.

### Contract

- schemas de MCP/WebMCP;
- backward compatibility de API;
- error codes;
- timezone;
- data minimization.

### UI

- map/timeline synchronization;
- local preview;
- no canonical mutation;
- responsive/mobile;
- fallback no-WebMCP.

### Agent evals

- prompts directos e indirectos;
- selección correcta de tool;
- no tool cuando no corresponde;
- ambigüedad;
- prompt injection;
- permission denial;
- stale version;
- verificabilidad de resultados.

### E2E

- shared link válido/inválido;
- judge demo;
- invitación futura;
- editor WebMCP;
- remote MCP access;
- revocación durante sesión.

## 20. Migration path

### Paso 1

Auditar y documentar el actual trip/shared response.

### Paso 2

Crear una proyección pública explícita sin cambiar el dominio más de lo necesario.

### Paso 3

Extraer `SharedTripFacade` y estado controlable.

### Paso 4

Registrar tools P0 del challenge.

### Paso 5

Después del challenge, introducir user identity y ownership estable.

### Paso 6

Separar share links de memberships.

### Paso 7

Extraer commands/versioning para edición multi-superficie.

### Paso 8

Agregar colaboración y remote MCP account access.

### Paso 9

Introducir places/events canónicos y procedencia.

### Paso 10

Agregar Host y Ready como bounded contexts, no como condiciones en el código de Traveler.

## 21. Anti-patterns

- usar el chat ID como owner del viaje;
- confiar en roles enviados por el cliente;
- reconstruir datos desde el DOM para WebMCP;
- duplicar reglas entre MCP y API;
- exponer el agregado privado a un link público;
- registrar tools de escritura para viewers;
- hacer last-write-wins sobre todo el itinerary;
- usar un único `manage_trip(action, payload)` opaco;
- crear una segunda base de datos para WebMCP;
- hacer del snippet la fuente de verdad de business data;
- mezclar paid business status con organic recommendation rank;
- construir Business dentro del código urgente del challenge.

## 22. Invariantes de arquitectura

1. Toda mutación persistente tiene actor, permiso, request ID y versión.
2. Toda superficie usa los mismos application services o contratos equivalentes.
3. Todo dato público se obtiene mediante una proyección allowlisted.
4. WebMCP funciona como progressive enhancement.
5. El agente nunca amplía los permisos de la persona.
6. El modelo propone e interpreta; el dominio valida y persiste.
7. Share access y membership permanecen separados.
8. Business no compra ranking ni inclusión.
9. Snippet es método de instalación; el producto es la plataforma administrada.
10. Cada decisión target debe verificarse contra el repo antes de migrar.
