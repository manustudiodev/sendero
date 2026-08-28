# Sendero — colaboración, identidad y permisos

**Fecha:** 2026-08-28
**Estado:** especificación target posterior al challenge
**Dependencia:** Sendero Shared Trip Companion read-only funcionando

## 1. Propósito

Este documento define cómo Sendero debe evolucionar desde páginas compartidas de solo lectura hacia viajes colaborativos sin depender del chat original donde nació el itinerario.

La decisión central es:

> Un itinerario pertenece a Sendero y posee identidad, miembros y permisos propios. El chat, el plugin, la web y WebMCP son superficies de acceso al mismo recurso.

El historial de ChatGPT no debe ser fuente de verdad para propiedad, membresía, permisos ni estado del viaje.

## 2. Corrección fundamental: el colaborador no necesita el plugin para editar desde la página

Existen dos caminos de acceso diferentes y ambos son válidos.

### 2.1 Acceso contextual desde una página abierta

Cuando una persona abre una página de Sendero con WebMCP:

- no necesita instalar el plugin de Sendero;
- no necesita conectar el MCP remoto;
- las site tools pertenecen a la página visitada;
- las tools pueden reutilizar la sesión web de Sendero;
- la página puede registrar tools distintas según el rol real de la persona;
- un viewer puede recibir tools read-only;
- un editor autenticado puede recibir tools de edición;
- el backend sigue validando cada operación.

Este es el camino natural para un invitado o colaborador que llega mediante un link.

```text
Invitación o link
      ↓
Página de Sendero
      ↓
Sesión pública o autenticada
      ↓
WebMCP registra tools permitidas
      ↓
API valida el permiso
      ↓
Viaje leído o modificado
```

### 2.2 Acceso global desde un chat sin una página abierta

Cuando una persona abre un chat cualquiera y dice:

> “Muéstrame los viajes de Sendero donde soy colaborador.”

no hay una página que identifique el viaje ni una sesión web que exponga site tools. En ese contexto, el MCP remoto es la superficie adecuada. Para consultar datos privados de una cuenta, esa conexión debe identificar al usuario mediante el mecanismo de autenticación soportado por Sendero.

```text
Chat arbitrario
      ↓
Plugin / MCP remoto de Sendero
      ↓
Identidad de cuenta
      ↓
list_accessible_trips
      ↓
Viajes propios y compartidos
```

Este camino es opcional para la colaboración web. Añade comodidad para utilizar Sendero desde cualquier conversación, pero no es requisito para aceptar una invitación ni editar desde la página.

## 3. Matriz de escenarios

| Escenario | Página abierta | Cuenta Sendero | Plugin/MCP remoto | WebMCP | Puede modificar el viaje |
|---|---:|---:|---:|---:|---:|
| Visitante anónimo con link público | Sí | No | No | Sí | No |
| Viewer autenticado en la página | Sí | Sí | No | Sí | No |
| Editor autenticado en la página | Sí | Sí | No | Sí | Sí, según capacidades |
| Owner autenticado en la página | Sí | Sí | No | Sí | Sí |
| Usuario en chat arbitrario, sin página | No | Sí | Sí | No | Según rol |
| Usuario con página y plugin conectados | Sí | Sí | Opcional | Sí | Según rol; evitar duplicidad |

## 4. Conceptos que no deben confundirse

### 4.1 Share link

Credencial o referencia que permite abrir una proyección compartida de un viaje.

Puede ser:

```text
public
unlisted
invite_only
expired
revoked
```

Un share link no convierte automáticamente a quien lo abre en miembro del viaje.

### 4.2 Invitation

Oferta dirigida a una persona para incorporarse con un rol determinado.

La invitación puede enviarse por:

- correo;
- link individual;
- contacto futuro dentro de Sendero.

### 4.3 Membership

Relación persistente entre un usuario y un viaje. Es la autoridad para determinar el rol después de aceptar la invitación.

### 4.4 Role

Agrupación legible de capacidades. Para la primera versión colaborativa:

```text
owner
editor
viewer
```

`commenter` puede incorporarse cuando existan comentarios reales. No debe agregarse solo como etiqueta sin una capacidad concreta.

### 4.5 Capability

Permiso atómico evaluado por el backend. El rol simplifica la UI, pero la autorización real debería expresarse mediante capacidades.

## 5. Modelo conceptual de datos

Los nombres son orientativos y deben ajustarse a las convenciones del repositorio.

```ts
interface User {
  id: string;
  email: string;
  displayName?: string;
  locale?: string;
  timezone?: string;
  createdAt: string;
}
```

```ts
interface Trip {
  id: string;
  ownerUserId: string;
  title: string;
  visibility: "private" | "shared" | "public";
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
}
```

```ts
interface TripMembership {
  id: string;
  tripId: string;
  userId: string;
  role: "owner" | "editor" | "viewer";
  status: "active" | "suspended" | "left";
  invitedByUserId?: string;
  joinedAt: string;
  updatedAt: string;
}
```

```ts
interface TripInvitation {
  id: string;
  tripId: string;
  invitedEmail?: string;
  role: "editor" | "viewer";
  tokenHash: string;
  status: "pending" | "accepted" | "expired" | "revoked";
  createdByUserId: string;
  acceptedByUserId?: string;
  expiresAt: string;
  acceptedAt?: string;
  createdAt: string;
}
```

```ts
interface TripShareLink {
  id: string;
  tripId: string;
  tokenHash: string;
  accessMode: "public" | "unlisted" | "invite_only";
  permissions: ["trip:read_public"];
  expiresAt?: string;
  revokedAt?: string;
  createdByUserId: string;
  createdAt: string;
}
```

```ts
interface TripAuditEvent {
  id: string;
  tripId: string;
  tripVersion: number;
  actorUserId?: string;
  actorType: "user" | "agent" | "system";
  surface: "web" | "webmcp" | "remote_mcp" | "api";
  action: string;
  targetId?: string;
  summary: string;
  requestId: string;
  createdAt: string;
}
```

## 6. Roles y capacidades

### 6.1 Capabilities recomendadas

```text
trip:read
trip:read_public
trip:update_itinerary
trip:comment
trip:manage_private_notes
trip:invite
trip:manage_members
trip:manage_share_links
trip:transfer_ownership
trip:archive
trip:delete
```

### 6.2 Matriz inicial

| Capacidad | Viewer | Editor | Owner |
|---|---:|---:|---:|
| Leer el itinerario compartible | Sí | Sí | Sí |
| Leer detalles privados permitidos | Según producto | Sí, limitado | Sí |
| Crear vista personal temporal | Sí | Sí | Sí |
| Agregar o mover items | No | Sí | Sí |
| Reemplazar o eliminar items | No | Sí | Sí |
| Gestionar reservas privadas | No | No por defecto | Sí |
| Invitar miembros | No | No por defecto | Sí |
| Cambiar roles | No | No | Sí |
| Revocar links | No | No | Sí |
| Transferir propiedad | No | No | Sí |
| Eliminar el viaje | No | No | Sí |

No asumir que `editor` equivale a administración completa. La edición del itinerario y la administración de miembros deben permanecer separadas.

## 7. Flujo de invitación a colaborador

### 7.1 Owner crea la invitación

1. El owner abre el viaje.
2. Selecciona “Invitar colaborador”.
3. Define correo o genera un link individual.
4. Elige `editor` o `viewer`.
5. Sendero crea una invitación con token de un solo propósito y vencimiento.

### 7.2 Invitado abre el enlace

1. La persona ve una preview segura del viaje y del rol ofrecido.
2. Sendero le solicita iniciar sesión o crear cuenta para aceptar una membership persistente.
3. La aceptación vincula la invitación con el `userId` autenticado.
4. Se crea `TripMembership`.
5. La invitación queda `accepted` y no puede reutilizarse.
6. La página vuelve a cargar el access context.
7. WebMCP registra las tools correspondientes al nuevo rol.

### 7.3 Uso posterior

El miembro puede:

- abrir directamente la URL del viaje y usar WebMCP sin plugin;
- encontrar el viaje en su futura biblioteca web;
- opcionalmente conectar Sendero a ChatGPT para acceder desde chats arbitrarios.

## 8. Access context de la página

La UI y el registro de WebMCP deben consumir el mismo objeto de autorización.

```ts
interface TripAccessContext {
  tripId: string;
  actor: {
    type: "anonymous" | "user";
    userId?: string;
  };
  accessSource: "share_link" | "membership" | "owner";
  role?: "owner" | "editor" | "viewer";
  capabilities: string[];
  tripVersion: number;
  shareLinkId?: string;
}
```

Nunca construir `capabilities` en el cliente a partir de un parámetro de URL. Deben venir de una respuesta firmada o de una sesión validada por el backend.

## 9. Registro dinámico de WebMCP

### 9.1 Anónimo o viewer

Registrar tools como:

```text
get_shared_trip_context
get_day_itinerary
get_booking_requirements
preview_guest_arrival
show_day_on_map
focus_itinerary_item
clear_guest_preview
```

Estas tools no persisten cambios sobre el viaje canónico.

### 9.2 Editor autenticado

Además de las anteriores, podrán registrarse progresivamente:

```text
preview_itinerary_change
add_itinerary_item
move_itinerary_item
replace_itinerary_item
remove_itinerary_item
apply_itinerary_change
```

Las operaciones amplias deberían seguir un flujo preview/apply. Las mutaciones simples pueden aplicarse directamente cuando el efecto sea evidente y reversible.

### 9.3 Owner

No exponer inicialmente administración sensible como site tools solo porque el owner tenga permiso. Acciones como transferir propiedad, eliminar el viaje o cambiar roles requieren una evaluación separada, confirmación reforzada y una razón de producto clara.

## 10. Contrato de autorización

Cada mutación debe seguir esta secuencia:

```text
Tool call
  ↓
Validar sesión o share token
  ↓
Resolver actor y membership
  ↓
Comprobar capability concreta
  ↓
Validar input y expectedVersion
  ↓
Ejecutar command de dominio
  ↓
Persistir nueva versión y audit event
  ↓
Devolver resultado canónico
  ↓
Actualizar UI
```

La existencia de una tool en el navegador no concede autoridad. Es una affordance. El backend debe denegar cualquier operación no permitida aunque el cliente registre una tool por error.

## 11. WebMCP y remote MCP deben compartir application services

Evitar dos implementaciones de las reglas de viaje.

```text
WebMCP adapter ─┐
                ├── Trip application service ── Domain ── DB
Remote MCP ─────┤
Web UI ─────────┘
```

Ejemplo:

```ts
await tripCommands.moveItem({
  actorContext,
  tripId,
  itemId,
  targetStart,
  expectedVersion,
  idempotencyKey,
});
```

El adapter transforma el input de la superficie. El command decide si la operación es válida.

## 12. Concurrencia y versiones

La colaboración introduce cambios simultáneos. Cada mutación debe declarar la versión observada.

```json
{
  "tripId": "trip_123",
  "itemId": "item_456",
  "targetStart": "2026-09-14T21:00:00-03:00",
  "expectedVersion": 24
}
```

Si el viaje ya está en la versión 25:

```json
{
  "error": {
    "code": "TRIP_VERSION_CONFLICT",
    "expectedVersion": 24,
    "currentVersion": 25,
    "retryable": true
  }
}
```

El agente o la UI debe leer el estado más reciente y reconstruir la intención. No aplicar last-write-wins silencioso sobre el itinerario completo.

## 13. Idempotencia

Toda tool de escritura debe aceptar o generar un `idempotencyKey` estable para una intención concreta. Esto evita duplicar un cambio cuando:

- el navegador reintenta;
- el agente repite la llamada;
- se pierde la respuesta;
- una UI optimista reconcilia tarde.

## 14. Auditoría y atribución

El historial debe permitir responder:

- quién hizo el cambio;
- desde qué superficie;
- si fue iniciado por una persona o ejecutado por un agente;
- qué versión produjo;
- qué item afectó;
- qué se cambió;
- si se revirtió.

Ejemplo visible:

```text
María movió “Cena en Naranjo Bar” de 20:00 a 21:00 mediante ChatGPT en la página de Sendero.
```

No es necesario guardar prompts completos por defecto. Pueden contener información sensible. Guardar intención resumida, tool, argumentos saneados, request ID y resultado.

## 15. Share links: seguridad y ciclo de vida

- almacenar hashes de tokens, no tokens en texto plano;
- permitir revocar y rotar;
- soportar expiración opcional;
- no usar IDs secuenciales como secreto;
- limitar rate por token/IP/sesión;
- evitar incluir secretos en analytics o logs;
- impedir indexación cuando el link sea unlisted o privado;
- separar metadatos públicos de notas y reservas privadas;
- mostrar al owner qué links están activos y cuándo se usaron por última vez, con una política de privacidad clara.

## 16. Preferencias personales del invitado

Durante el challenge, las adaptaciones del invitado son locales y temporales.

Después, un viewer autenticado podría guardar una capa personal sin modificar el plan del grupo:

```ts
interface PersonalTripOverlay {
  userId: string;
  tripId: string;
  arrival?: DateTime;
  departure?: DateTime;
  dietaryPreferences?: string[];
  mobilityPreferences?: string[];
  hiddenItemIds?: string[];
  personalNotes?: PersonalNote[];
}
```

Esta overlay debe estar separada del itinerario canónico. El usuario puede optar por proponer alguno de sus cambios al grupo, pero no se fusiona automáticamente.

## 17. Notificaciones futuras

Notificar solo eventos útiles:

- invitación recibida;
- rol modificado;
- cambio relevante en un viaje próximo;
- conflicto con una reserva;
- propuesta que requiere aprobación;
- mención o comentario;
- link revocado o viaje archivado.

Evitar notificar cada movimiento menor por defecto. Permitir digest y preferencias por viaje.

## 18. Fases de implementación

### Fase A — Challenge

- viewer anónimo;
- share link existente;
- WebMCP read-only;
- estado local temporal;
- ninguna membership nueva.

### Fase B — Identidad Traveler

- cuenta Sendero;
- biblioteca de viajes;
- owner vinculado a usuario estable;
- login web;
- sesiones.

### Fase C — Invitaciones y memberships

- invite by email/link;
- roles owner/editor/viewer;
- aceptación y revocación;
- panel de miembros.

### Fase D — Edición web y WebMCP por rol

- tools write para editor;
- commands compartidos;
- versionado;
- audit log;
- conflicto y retry.

### Fase E — Acceso global por remote MCP

- `list_accessible_trips`;
- filtros por owner, rol, destino y fechas;
- abrir y modificar desde chats arbitrarios;
- OAuth/scopes según la implementación vigente.

Las fases D y E son independientes: puede existir colaboración completa desde la página antes de habilitar el acceso global en ChatGPT.

## 19. Criterios de aceptación de colaboración V1

- [ ] Un owner puede invitar a una persona como editor o viewer.
- [ ] La invitación no puede aceptarse dos veces.
- [ ] El usuario ve el viaje en su biblioteca después de aceptar.
- [ ] Un editor abre la página y puede editar sin instalar el plugin.
- [ ] WebMCP registra únicamente tools compatibles con sus capacidades.
- [ ] Un viewer recibe `403` ante cualquier mutación, aunque invoque el endpoint manualmente.
- [ ] Todas las mutaciones usan expected version e idempotencia.
- [ ] El historial identifica actor, superficie y cambio.
- [ ] El owner puede retirar acceso y revocar links.
- [ ] Los datos privados no aparecen en la proyección pública.
- [ ] La edición desde remote MCP, cuando exista, utiliza exactamente las mismas reglas.

## 20. Decisión final

> WebMCP elimina la obligación de instalar el plugin cuando el usuario ya está dentro de una página de Sendero. El MCP remoto sigue siendo una superficie complementaria para encontrar y administrar viajes desde cualquier chat sin abrir previamente esa página.

La colaboración no depende del historial de ChatGPT. Depende de identidad, membership, capabilities y una API que trate el viaje como un recurso compartido y versionado.
