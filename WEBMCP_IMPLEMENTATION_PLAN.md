# Sendero — plan de implementación WebMCP P0

**Fecha:** 2026-08-28
**Baseline de implementación:** `a8ebc826c5814d3dfc7a88e658ffade748eb039f`
**Alcance:** `Sendero Shared Trip Companion` sobre `/share`

## Principios

- La página pública sigue funcionando sin WebMCP.
- UI y tools consumen la misma copia pública ya autorizada.
- Ninguna site tool llama a un endpoint de mutación.
- El token del fragmento nunca entra en el facade, los outputs o los logs.
- La personalización del invitado vive únicamente en memoria y se puede limpiar.
- Los contratos propios de Sendero aíslan la API experimental del navegador.

## Corte 1 — proyección pública agent-ready

**Estado actual:** la allowlist existe, pero faltan timezone, IDs públicos y booking seguro.

**Paths:**

- `shared/public-snapshot.mjs`
- `shared/public-snapshot.d.mts`
- `server/server.mjs`
- `convex/schema.ts`
- `convex/publicShares.ts`
- `server/app.mjs`
- tests de publicación y app

**Contrato:**

- timezone IANA opcional para compatibilidad con snapshots existentes;
- `publicId` derivado de fecha y posición, nunca del ID privado;
- `booking.required` y `booking.confirmed` sin URL, código, nota ni deadline;
- `publicVersion` construido desde `sourceVersion` y generación.

**Riesgo:** publicaciones antiguas no tendrán timezone hasta volver a publicarse. En ese caso las tools de lectura funcionan y el preview temporal devuelve un error explícito, sin inventar una zona.

**Aceptación:** tests de allowlist y payload confirman que los nuevos campos seguros existen y los secretos siguen ausentes.

## Corte 2 — SharedTripFacade y arrival preview

**Paths:**

- nuevo `web/src/share/shared-trip-companion.js`
- nuevo `web/shared-trip-companion.test.mjs`

**Contrato:**

- `getContext()`
- `getDay(date)`
- `showDayOnMap(date)`
- `focusItem(publicItemId)`
- `previewGuestArrival({ date, arrivalLocalTime, readyAfterMinutes, originLabel? })`
- `clearGuestPreview()`

**Algoritmo P0:** sumar la demora declarada a la hora local; marcar como perdidos los items finalizados antes de ese momento; elegir como primer encuentro el primer item futuro con hora y lugar público. No calcular tráfico ni inventar traslados.

**Aceptación:** tests de fecha/hora, límite 0–720, día vacío, item inválido, sin punto de encuentro, clear idempotente y canonical inmutable.

## Corte 3 — lifecycle y seis site tools

**Paths:**

- nuevo `web/src/share/webmcp.js`
- `web/src/share/PublicShareApp.jsx`
- nuevo `web/webmcp.test.mjs`

**Contrato:** registro imperativo con `document.modelContext.registerTool`, schemas cerrados y cleanup mediante `AbortController`.

**Tools:**

1. `get_shared_trip_context`
2. `get_day_itinerary`
3. `preview_guest_arrival`
4. `show_day_on_map`
5. `focus_itinerary_item`
6. `clear_guest_preview`

**Aceptación:** no se registra sin soporte; se registran exactamente seis tools con la proyección lista; todos los callbacks leen el facade actual; errores son compactos y no contienen stack/token.

## Corte 4 — feedback visual compartido

**Paths:**

- `web/src/itinerary/ItineraryViewer.jsx`
- `web/src/itinerary/route-utils.js`
- `web/src/share/PublicShareApp.jsx`
- `web/src/styles.css`
- tests UI/mapa

**Comportamiento:**

- seleccionar día cambia timeline/calendar/mapa mediante props controladas;
- item focus abre su día, aplica foco accesible y centra el mapa cuando hay ubicación;
- arrival preview atenúa perdidos, resalta el meetup y muestra un recibo local;
- clear elimina overlay/focus y conserva el itinerario intacto;
- colores no son la única señal de estado.

**Aceptación:** tests de clases/props y una prueba E2E verifican el cambio visible y su reversión.

## Corte 5 — seguridad, observabilidad y submission

**Paths previstos:**

- `CHALLENGE.md`
- `README.md`
- `evals/` y/o prueba de browser
- documentación de verificación

**Trabajo:**

- eventos mínimos sin PII: support, registration, invocation, success/failure, preview/clear;
- prueba de contenido malicioso como datos no confiables;
- fallback sin WebMCP;
- link inválido/revocado;
- refresh confirma canonical sin cambios;
- demo pública estable.

**Decisiones pendientes del owner antes de submission:**

- hacer público este repo o preparar una edición pública;
- elegir licencia;
- autorizar branch/tag/commits/push/deploy;
- actualizar o crear un viaje demo que incluya timezone y datos públicos suficientes;
- registrar Devpost y publicar el video.

## Secuencia de commits sugerida

1. `chore(challenge): document pre-WebMCP baseline`
2. `feat(shared-trip): expose agent-ready public projection`
3. `feat(webmcp): add shared trip companion facade and tools`
4. `feat(shared-trip): visualize guest arrival preview`
5. `test(webmcp): cover shared companion flow`
6. `docs(challenge): add submission and verification guide`

No se crearán commits ni se publicará nada sin autorización explícita.
