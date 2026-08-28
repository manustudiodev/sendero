# Sendero — especificación técnica de WebMCP para la página compartida

**Fecha:** 2026-08-28
**Estado:** target técnico para el challenge
**Alcance:** tools read-only respecto del backend y acciones locales sobre UI

## 1. Objetivo técnico

Agregar WebMCP a la shared trip page existente sin duplicar la lógica del MCP remoto ni reconstruir la aplicación.

La implementación debe:

- reutilizar la API y el modelo público ya existentes;
- registrar tools específicas de la página abierta;
- trabajar con la misma versión de datos que la UI;
- controlar estado local de agenda y mapa;
- producir una personalización temporal para el viewer;
- preservar el viaje canónico;
- funcionar como progressive enhancement.

## 2. Arquitectura

```text
                              ┌────────────────────┐
                              │ Sendero API / DB   │
                              │ source of truth    │
                              └─────────┬──────────┘
                                        │
                           public shared projection
                                        │
                              ┌─────────▼──────────┐
                              │ Shared Trip Page   │
                              │ timeline + map     │
                              └──────┬───────┬─────┘
                                     │       │
                              normal UI    WebMCP facade
                                     │       │
                              human input   site tools
                                             │
                                      browser agent
```

El MCP remoto no forma parte del request path del viewer:

```text
Owner in ChatGPT → Remote MCP → API → canonical trip
Viewer on web     → WebMCP page tools → shared projection + local UI
```

## 3. Fronteras de responsabilidad

### API/backend

- resolver share link/token;
- aplicar visibilidad;
- sanitizar campos privados;
- devolver datos canónicos públicos;
- declarar versión y `updatedAt`;
- rate limiting y observabilidad;
- no aceptar mutaciones desde las tools P0.

### Shared page

- cargar la proyección;
- renderizar timeline y mapa;
- almacenar selección y overlays locales;
- ofrecer application facade estable;
- registrar/desregistrar tools;
- reflejar tool calls en UI;
- limpiar previews.

### Browser agent

- interpretar la solicitud del viewer;
- elegir tool;
- construir argumentos;
- explicar el resultado;
- no decidir permisos ni inventar datos faltantes.

### Remote MCP

- queda fuera del flujo del viewer;
- continúa sirviendo al owner y a usuarios que conecten Sendero desde una conversación independiente.

## 4. Proyección pública

No registrar tools directamente sobre el DTO interno de `Trip`. Crear una proyección explícita.

```ts
export interface SharedTripProjection {
  trip: {
    publicId: string;
    title: string;
    destinationLabel: string;
    timezone: string;
    startDate: string;
    endDate: string;
    publicVersion: string;
    updatedAt: string;
  };
  days: SharedTripDay[];
  capabilities: {
    webmcp: boolean;
    guestArrivalPreview: boolean;
    localViewActions: boolean;
    canonicalWriteAccess: false;
  };
}

export interface SharedTripDay {
  date: string;
  label?: string;
  items: SharedItineraryItem[];
}

export interface SharedItineraryItem {
  publicId: string;
  type:
    | "activity"
    | "place"
    | "meal"
    | "event"
    | "reservation"
    | "transport"
    | "free_time"
    | "note";
  title: string;
  startAt?: string;
  endAt?: string;
  timezone: string;
  status: "planned" | "confirmed" | "cancelled" | "tentative";
  booking: {
    required: boolean;
    confirmed: boolean;
    publicNote?: string;
  };
  location?: {
    label: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    placeUrl?: string;
  };
  publicDescription?: string;
  tags?: string[];
  transferFromPrevious?: {
    mode?: "walk" | "transit" | "car" | "bike" | "unknown";
    durationMinutes?: number;
    publicNote?: string;
  };
}
```

### Campos prohibidos en la proyección

- internal database IDs cuando no sean necesarios;
- share token;
- reservation confirmation code;
- email, teléfono o nombre legal de participantes;
- private notes;
- billing data;
- auth claims;
- history interno;
- prompts o conversaciones;
- source credentials;
- ubicación privada del alojamiento cuando no se haya compartido explícitamente.

## 5. Facade de aplicación

WebMCP no debería importar stores internos dispersos. La página debe exponer un facade pequeño.

```ts
export interface SharedTripAgentFacade {
  getContext(): SharedTripContextResult;
  getDay(date: string): SharedTripDayResult;
  showDayOnMap(date: string): LocalViewResult;
  focusItem(publicItemId: string): LocalViewResult;
  previewGuestArrival(input: GuestArrivalInput): GuestArrivalPreview;
  clearGuestPreview(): LocalViewResult;
}
```

La UI manual puede reutilizar las mismas funciones para evitar rutas divergentes.

## 6. Estado local

```ts
export interface SharedTripViewState {
  selectedDate: string | null;
  focusedItemId: string | null;
  mapBoundsMode: "trip" | "day" | "item" | "guest_preview";
  guestPreview: GuestArrivalPreview | null;
  dimmedItemIds: string[];
  highlightedItemIds: string[];
  meetingPointItemId: string | null;
  lastAgentAction?: {
    toolName: string;
    executedAt: string;
  };
}
```

El `guestPreview` es efímero:

- no se persiste en el viaje;
- no se comparte con otros viewers;
- puede vivir solo en memory state durante el challenge;
- opcionalmente puede reflejarse en query params si eso mejora el demo, pero no es necesario;
- se limpia al cambiar de trip o usar `clear_guest_preview`.

## 7. Registro y lifecycle

La página debe registrar tools después de disponer de:

- una proyección válida;
- un facade inicializado;
- un document activo;
- feature support.

Usar `AbortController` para asociar las tools al ciclo de vida de la ruta/página.

```ts
type ModelContextDocument = Document & {
  modelContext?: {
    registerTool: (
      tool: {
        name: string;
        title?: string;
        description: string;
        inputSchema: Record<string, unknown>;
        annotations?: {
          readOnlyHint?: boolean;
          untrustedContentHint?: boolean;
        };
        execute: (input: unknown) => Promise<unknown> | unknown;
      },
      options?: { signal?: AbortSignal }
    ) => Promise<void>;
  };
};

export async function registerSharedTripTools(
  facade: SharedTripAgentFacade,
  signal: AbortSignal
): Promise<boolean> {
  const doc = document as ModelContextDocument;
  const register = doc.modelContext?.registerTool;

  if (typeof register !== "function") return false;

  await Promise.all([
    register.call(doc.modelContext, buildGetContextTool(facade), { signal }),
    register.call(doc.modelContext, buildGetDayTool(facade), { signal }),
    register.call(doc.modelContext, buildArrivalPreviewTool(facade), { signal }),
    register.call(doc.modelContext, buildShowDayTool(facade), { signal }),
    register.call(doc.modelContext, buildFocusItemTool(facade), { signal }),
    register.call(doc.modelContext, buildClearPreviewTool(facade), { signal }),
  ]);

  return true;
}
```

La firma exacta debe validarse contra la versión soportada por el navegador usado en el challenge. No crear un wrapper que silencie errores de registro.

### React lifecycle conceptual

```ts
useEffect(() => {
  if (!facade || !projection) return;

  const controller = new AbortController();

  registerSharedTripTools(facade, controller.signal)
    .then(setWebMcpAvailable)
    .catch((error) => reportWebMcpRegistrationError(error));

  return () => controller.abort();
}, [facade, projection.trip.publicId, projection.trip.publicVersion]);
```

Si la versión pública cambia, evaluar si se necesita re-registrar o si los callbacks siempre leen el estado más reciente del facade. Evitar registrar tools duplicadas con el mismo nombre.

## 8. Contratos P0

### 8.1 `get_shared_trip_context`

```ts
interface GetSharedTripContextInput {}

interface GetSharedTripContextResult {
  trip: {
    publicId: string;
    title: string;
    destinationLabel: string;
    timezone: string;
    startDate: string;
    endDate: string;
    updatedAt: string;
    publicVersion: string;
  };
  days: Array<{
    date: string;
    itemCount: number;
    firstStartAt?: string;
    lastEndAt?: string;
  }>;
  permissions: {
    view: true;
    modifyCanonicalTrip: false;
  };
}
```

Tool definition:

```ts
{
  name: "get_shared_trip_context",
  title: "Get shared trip context",
  description:
    "Read the public context of the Sendero trip currently open, including dates, timezone, available days, update version, and viewer permissions. This does not modify the trip.",
  inputSchema: {
    type: "object",
    properties: {},
    additionalProperties: false
  },
  annotations: { readOnlyHint: true },
  execute: async () => facade.getContext()
}
```

### 8.2 `get_day_itinerary`

Input:

```ts
interface GetDayItineraryInput {
  date: string; // YYYY-MM-DD
}
```

Result:

```ts
interface SharedTripDayResult {
  date: string;
  timezone: string;
  items: SharedItineraryItem[];
  warnings: Array<{
    code: string;
    message: string;
  }>;
}
```

Description must indicate that `date` belongs to the currently open trip.

### 8.3 `preview_guest_arrival`

```ts
interface GuestArrivalInput {
  date: string;
  arrivalLocalTime: string; // HH:mm
  readyAfterMinutes: number;
  originLabel?: string;
}

interface GuestArrivalPreview {
  previewId: string;
  date: string;
  timezone: string;
  availableFrom: string;
  missedItemIds: string[];
  unreachableItemIds: string[];
  reachableItemIds: string[];
  earliestJoinableItem?: {
    publicItemId: string;
    title: string;
    startAt?: string;
    location?: SharedItineraryItem["location"];
    estimatedArrivalAt?: string;
  };
  rationale: string[];
  uiApplied: boolean;
  canonicalTripChanged: false;
}
```

Reglas:

- `readyAfterMinutes` entre 0 y un máximo razonable, por ejemplo 720;
- validar `date` contra el trip;
- interpretar `arrivalLocalTime` en timezone del trip;
- no inventar tiempo de traslado si no existe;
- si falta traslado hasta un item, marcar incertidumbre;
- nunca mover o cancelar items;
- aplicar overlay local solo después de validar;
- devolver suficiente información para que el agente verifique el efecto.

Annotation:

- no usar `readOnlyHint: true` si la tool modifica estado local de UI, aunque no persista backend;
- la description debe decir expresamente: “Changes only the temporary view on this page and does not modify the shared itinerary.”

### 8.4 `show_day_on_map`

```ts
interface ShowDayOnMapInput {
  date: string;
}

interface LocalViewResult {
  selectedDate: string | null;
  focusedItemId: string | null;
  mapMode: string;
  affectedItemIds: string[];
  canonicalTripChanged: false;
}
```

### 8.5 `focus_itinerary_item`

```ts
interface FocusItineraryItemInput {
  publicItemId: string;
}
```

Debe validar que el ID pertenezca al viaje abierto. No aceptar URLs o selectores CSS.

### 8.6 `clear_guest_preview`

Input vacío. Limpia solo overlay y selección vinculada al preview, con un resultado verificable.

## 9. Algoritmo de arrival preview

El objetivo del challenge no exige resolver rutas globales perfectas. Debe ser determinístico y honesto.

### Versión mínima

1. combinar `date + arrivalLocalTime` en timezone del trip;
2. sumar `readyAfterMinutes`;
3. ordenar items por start time;
4. marcar como perdidos los items finalizados antes de `availableFrom`;
5. para cada item futuro:
   - usar duración de traslado disponible desde el origen o una aproximación declarada;
   - calcular `estimatedArrivalAt`;
   - elegir el primer item cuyo comienzo o ventana admita incorporación;
6. si no existe suficiente información, devolver `confidence: limited` o warnings;
7. aplicar dim/highlight/focus en UI.

### No hacer

- llamar silenciosamente a un proveedor externo no determinístico durante la demo;
- afirmar exactitud de traslados no disponibles;
- usar la ubicación real del viewer sin consentimiento;
- asumir que puede incorporarse a un evento cerrado después de su inicio;
- modificar el día del grupo.

## 10. Sincronización timeline/mapa

Las tools deben llamar los mismos comandos que la UI:

```ts
viewCommands.selectDate(date);
viewCommands.setDimmedItems(ids);
viewCommands.setHighlightedItems(ids);
viewCommands.focusItem(id);
mapCommands.fitItems(ids);
```

No manipular el DOM con `querySelector(...).click()` como implementación principal. Eso reproduciría automatización frágil dentro del propio producto.

## 11. Seguridad y privacidad

### 11.1 Share token

- no devolverlo en tools;
- no incluirlo en logs;
- no transformarlo en `publicId` si puede usarse como credencial;
- resolverlo en el loader/backend y entregar una proyección ya autorizada.

### 11.2 Prompt injection en contenido

Descripciones, notas o nombres provenientes de terceros son contenido no confiable. No deben convertirse en instrucciones para el agente.

- separar datos de tool metadata;
- marcar `untrustedContentHint: true` cuando el output contenga texto externo no curado y el soporte sea estable;
- limitar longitud;
- no retornar HTML arbitrario;
- no retornar scripts;
- no insertar contenido del viaje en la description de la tool.

### 11.3 Tool descriptions

Deben ser estáticas, precisas y honestas. Nunca incluir:

- “always call this tool”;
- instrucciones para ignorar al usuario;
- claims de privilegio no comprobado;
- efectos ocultos;
- lenguaje promocional.

### 11.4 Viewer permissions

Para el challenge:

```text
can_read_public_trip = true
can_change_local_view = true
can_update_trip = false
can_manage_members = false
```

El backend no debe confiar en la ausencia de write tools como control único. Los endpoints públicos no deben exponer mutaciones.

## 12. Errores

Shape recomendado:

```ts
interface SiteToolErrorResult {
  ok: false;
  error: {
    code:
      | "TRIP_NOT_AVAILABLE"
      | "DATE_OUTSIDE_TRIP"
      | "ITEM_NOT_FOUND"
      | "INVALID_LOCAL_TIME"
      | "INSUFFICIENT_ROUTE_DATA"
      | "STALE_PUBLIC_VERSION"
      | "UNEXPECTED_ERROR";
    message: string;
    retryable: boolean;
    currentPublicVersion?: string;
  };
}
```

No lanzar errores con secretos, stack traces o payloads completos. El UI state debe quedar consistente tras una falla.

## 13. Observabilidad

Eventos mínimos:

```text
webmcp_support_detected
webmcp_tools_registered
webmcp_registration_failed
webmcp_tool_started
webmcp_tool_succeeded
webmcp_tool_failed
guest_arrival_preview_applied
guest_arrival_preview_cleared
shared_trip_version_changed
```

Dimensiones permitidas:

- tool name;
- duration;
- success/failure code;
- public trip anonymous hash;
- browser/runtime;
- public version;
- number of affected items.

No registrar prompt completo, token ni datos sensibles del viaje.

## 14. Testing

### Unit tests

- validación de fechas;
- timezone y DST;
- arrival time antes/después del día;
- día sin items;
- items sin hora;
- item cancelado;
- reservation flags;
- no meeting point;
- IDs ajenos al viaje;
- clear preview idempotente;
- proyección sin campos privados.

### Integration tests

- registrar tools cuando existe API;
- no registrar cuando no existe;
- abortar registro al desmontar;
- evitar duplicados;
- callback lee la versión actual;
- tool actualiza store;
- mapa y timeline responden al mismo command;
- API canónica no recibe PATCH/POST.

### E2E

1. abrir shared URL;
2. confirmar UI normal;
3. inspeccionar site tools;
4. ejecutar `get_shared_trip_context`;
5. ejecutar `preview_guest_arrival`;
6. comprobar elementos atenuados y meeting point;
7. comprobar map focus;
8. limpiar preview;
9. recargar y confirmar que el canonical no cambió;
10. repetir en ChatGPT in-app browser y Chrome 149+ con flag.

### Security tests

- texto malicioso en descripción de item;
- input enorme;
- fecha inválida;
- tool call repetida;
- token vencido;
- viaje despublicado durante sesión;
- intento de item ID de otro viaje;
- respuesta de API con campo privado accidental.

## 15. Feature flags

Recomendación:

```text
WEBMCP_SHARED_TRIP_ENABLED
WEBMCP_GUEST_ARRIVAL_PREVIEW_ENABLED
WEBMCP_TELEMETRY_ENABLED
```

Permiten desplegar sin bloquear la página y desactivar la integración si el entorno cambia.

## 16. Performance

- no realizar un segundo fetch completo por cada read tool si la proyección está vigente;
- usar snapshot local con version check;
- evitar devolver todos los días cuando se pidió uno;
- limitar texto descriptivo;
- no cargar SDK externo si la API es nativa del navegador;
- no bloquear render inicial por registro de tools.

## 17. Progressive enhancement

Estado visible opcional:

```text
AI companion available
```

No mostrar un error si WebMCP no existe. La página continúa operando normalmente.

La feature puede exponer ayuda contextual:

> Open this trip in a WebMCP-compatible browser to explore it with your agent.

No convertir esa ayuda en un requisito para leer el viaje.

## 18. Preparación para colaboración futura

El facade debe ser extensible, pero no registrar write tools todavía.

Futuro:

```ts
interface AuthenticatedTripAgentFacade extends SharedTripAgentFacade {
  getCurrentActor(): ActorCapabilities;
  previewCanonicalChange(input: TripPatchInput): Promise<TripPatchPreview>;
  applyCanonicalChange(input: ApplyTripPatchInput): Promise<TripMutationResult>;
}
```

Las write tools futuras solo se registrarán cuando:

- el usuario esté autenticado;
- tenga membership editor/owner;
- el backend confirme capabilities;
- exista versioning/concurrency;
- se describan side effects;
- se apliquen confirmaciones apropiadas.

## 19. Definition of Done técnico

- proyección pública explícita;
- facade compartido entre UI y tools;
- seis tools P0 registradas sin duplicación;
- lifecycle y abort correctos;
- arrival preview determinístico;
- timeline/mapa sincronizados;
- canonical trip inmutable;
- privacidad validada;
- tests unit/integration/E2E;
- telemetría mínima;
- feature flags;
- README de ejecución;
- demo reproducible en los dos entornos aceptados.
