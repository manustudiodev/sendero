# Sendero — glosario de producto y arquitectura

**Fecha:** 2026-08-28
**Objetivo:** mantener un lenguaje común entre producto, diseño, agentes y desarrollo

## Sendero

Sistema que convierte una conversación de viaje en un itinerario persistente, visual, compartible y eventualmente colaborativo y accionable.

## Sendero Traveler

Vertical para viajeros, owners, invitados y grupos. Su unidad central es el `Trip`.

## Sendero Business

Vertical futura para hosts, alojamientos, lugares, eventos y experiencias. Incluye Sendero for Hosts y Sendero Ready.

## Owner

Usuario con propiedad y control administrativo sobre un viaje. Puede compartir, invitar, gestionar miembros y, según política, archivar o eliminar.

## Viewer / invitado

Persona que puede leer una proyección del viaje. Puede ser anónima mediante share link o autenticada mediante membership.

## Editor / colaborador

Miembro autenticado con capacidad de modificar el itinerario dentro de límites definidos. No administra automáticamente miembros, billing o ownership.

## Trip

Recurso persistente que representa un viaje: destino, fechas, timezone, owner, participantes, días, itinerario, preferencias, restricciones, versiones y visibilidad.

## Itinerary

Organización temporal de actividades, lugares, eventos, reservas, traslados, notas y tiempo libre de un Trip.

## Itinerary item

Unidad individual del itinerary. Posee ID, tipo, fecha/hora, timezone, status, ubicación, requirement, visibilidad y orden.

## Canonical itinerary

Versión autoritativa del viaje guardada en Sendero. No debe confundirse con previews, filtros o overlays personales.

## Personal overlay

Capa privada de un usuario sobre un viaje: llegada, salida, dieta, movilidad, notas o elementos ocultos. No modifica automáticamente el canonical itinerary.

## Shared page

Página web que presenta una proyección autorizada del viaje a través de un link o membership.

## SharedTripProjection

Contrato allowlisted de datos que puede consumir una página compartida y sus tools. Excluye información privada y detalles internos innecesarios.

## Share link

Credencial o URL que permite acceder a una proyección compartida. No crea por sí sola una membership.

## Invitation

Oferta para incorporar a una persona al viaje con un rol. Tiene token, estado, expiración y aceptación.

## Membership

Relación persistente entre User y Trip o Workspace. Es la autoridad para roles después de autenticarse.

## Role

Agrupación de capacidades legible para usuarios, por ejemplo owner/editor/viewer.

## Capability

Permiso atómico validado por el backend, por ejemplo `trip:update_itinerary` o `trip:manage_members`.

## Source of truth

Backend/base de datos de Sendero. El modelo, chat, UI, mapa y tools son interfaces o proyecciones.

## Remote MCP

Servidor MCP de Sendero accesible desde ChatGPT/Codex. Puede operar sin una página abierta y permite capacidades globales como crear o listar viajes.

## Plugin

Integración de Sendero en ChatGPT basada en el MCP remoto y, cuando aplique, componentes UI.

## WebMCP / Site tools

Herramientas registradas por una página web para que un agente pueda trabajar con esa página, su estado y su sesión. Se descubren al visitar la página y no requieren conectar un MCP remoto separado.

## Page-scoped tool

Tool disponible únicamente en el contexto de la página que la registró. Puede desaparecer al navegar o cerrar la página.

## SharedTripFacade

Interfaz de aplicación que ofrece datos y acciones de la shared page a UI y WebMCP sin inspeccionar el DOM.

## Progressive enhancement

Estrategia donde la página funciona normalmente y WebMCP añade capacidades cuando el navegador/agente lo soporta.

## Guest arrival preview

Adaptación temporal que calcula qué se pierde un invitado por llegar a cierta hora y dónde podría encontrarse con el grupo. No persiste cambios canónicos.

## Preview

Representación no persistida de una interpretación o cambio. Permite revisar antes de aplicar o mantener una vista personal temporal.

## Apply

Commit persistente de un cambio validado. No forma parte del P0 read-only del challenge.

## Trip version

Número o identificador monotónico que representa el estado canónico de un viaje después de cada mutación.

## Expected version

Versión observada por el cliente al solicitar un cambio. Permite detectar conflictos.

## Idempotency key

Clave que identifica una intención de escritura y evita aplicarla dos veces ante retries.

## Audit event

Registro de quién hizo qué, desde qué superficie, sobre qué versión y cuándo.

## Locked item

Elemento que no puede moverse, reemplazarse o eliminarse sin autorización explícita, normalmente una reserva o compromiso confirmado.

## Constraint

Condición que limita la planificación, por ejemplo movilidad, presupuesto, horario máximo o zona.

## Disruption

Cambio que afecta un plan: lluvia, cierre, demora, cancelación o disponibilidad.

## Live Repair

Capacidad futura para reparar una parte afectada del itinerary preservando decisiones, locks y constraints. No es el alcance P0 del challenge.

## Place

Entidad canónica para un lugar físico o virtual: restaurante, bar, museo, hotel, taller, etc.

## Event

Ocurrencia temporal con inicio, fin, timezone, venue, status y disponibilidad.

## Provenance / procedencia

Origen de un dato: fuente, fecha de observación, quién lo confirmó y nivel de confianza.

## Freshness / frescura

Medida de vigencia temporal de un dato. No equivale a veracidad absoluta.

## Observation

Dato observado en una fuente y fecha específicas. Puede diferir del valor canónico hasta reconciliarse.

## SEO

Prácticas para facilitar crawling, indexación, comprensión y visibilidad en motores de búsqueda.

## GEO / AEO

Términos usados para optimización orientada a respuestas generativas. No representan un switch o estándar técnico universal; se apoyan ampliamente en fundamentos SEO, claridad, autoridad, estructura y actualidad.

## Structured data

Datos machine-readable, normalmente Schema.org/JSON-LD, que describen entidades y atributos. Deben coincidir con el contenido visible y no garantizan ranking.

## Crawling

Proceso por el cual un bot visita y recupera páginas. Es distinto de WebMCP.

## Indexing

Proceso por el cual un motor incorpora contenido a su índice. WebMCP no indexa páginas.

## Scraping

Extracción de información mediante interpretación de HTML/DOM u otras señales sin una interfaz explícita del sitio. WebMCP es una interfaz cooperativa, no scraping.

## Sendero for Hosts

Producto futuro para que hosts y alojamientos configuren información práctica y experiencias personalizadas por estadía.

## Sendero Ready

Producto futuro para modelar, verificar y mantener la presencia digital de negocios locales mediante wizard, perfil canónico, snippet, structured data, WebMCP y publicación en Sendero.

## Sendero Ready snippet

Script administrado e instalado una sola vez en el sitio business. La configuración real vive en Sendero.

## Listed on Sendero

Entidad con perfil en Sendero, sin implicar verificación técnica completa.

## Sendero Ready seal

Sello que certifica condiciones técnicas/informativas vigentes. No es recomendación ni garantía de ranking.

## Sendero Verified

Estado adicional que indica que control/identidad y campos específicos fueron verificados mediante un método y fecha visibles.

## Workspace

Contenedor de recursos, miembros, roles y billing. Puede ser personal, host, business u organization.

## Entitlement

Derecho de producto derivado de un plan, Trip Pass o suscripción, por ejemplo límites, exports o colaboración avanzada.

## Trip Pass

Hipótesis de compra por viaje para valor episódico. El rango discutido, USD 12–15, no es precio definitivo.

## Frequent Traveler

Hipótesis de suscripción anual para viajeros recurrentes. El rango discutido, USD 39–49, no es precio definitivo.
