# Sendero

Sendero es un planificador de viajes conversacional para ChatGPT. La persona habla con la IA de forma natural y Sendero convierte fechas, alojamiento, intereses, transporte, reservas y compromisos fijos en un itinerario local-first. Los componentes aparecen dentro del chat solo cuando ayudan a completar, elegir, revisar o visualizar información estructurada.

La conversación es la experiencia principal: no hace falta memorizar comandos ni aprender una interfaz separada. La página web pública se reserva para compartir una proyección de solo lectura con personas que no usan ChatGPT; no reemplaza la planificación dentro del chat.

## Qué incluye

- Conversación natural como entrada principal para crear, abrir, ajustar o actualizar viajes.
- Cuatro atajos opcionales en el menú `/` de ChatGPT: **Nuevo viaje**, **Mis viajes**, **Ajustar viaje** y **Actualizar viaje**.
- Una skill interna de orquestación que interpreta la intención actual, omite el lanzador cuando el objetivo está claro y continúa desde selecciones previas sin volver a pedir la misma información.
- Un componente compacto que solicita en una sola interacción todos los datos críticos que falten. Solo difiere una pregunta cuando su necesidad depende de una respuesta anterior.
- Un formulario guiado completo para quien elige explícitamente el atajo **Nuevo viaje** o pide completar la configuración paso a paso.
- `prepare_trip_brief` para normalizar las preferencias y detectar información crítica faltante.
- `render_trip_requirements` para completar juntos todos los datos críticos pendientes sin volver a preguntar lo ya dicho.
- `render_trip_intake` para abrir el formulario guiado o, cuando la intención es realmente ambigua, un menú breve.
- `validate_itinerary` para controlar fechas, solapamientos, transporte, reservas, fuentes y actividades fijas.
- `render_itinerary` para mostrar el itinerario completo en un componente MCP Apps con lista diaria, calendario expandible, mapa de rutas y seguimiento de reservas.
- Controles de reserva que registran **confirmada** o **cancelada** únicamente dentro de Sendero; el enlace oficial abre el proveedor y Sendero nunca afirma haber reservado o cancelado allí.
- `find_itineraries` para resolver referencias naturales a un viaje sin mostrar un selector; `list_itineraries` para los casos ambiguos con tarjetas clicables de un solo uso; y `get_itinerary` para abrir la selección exacta.
- `save_itinerary` para crear un viaje o guardar una nueva versión sin perder el historial.
- `share_itinerary` para invitar por email a colaboradores como editores o lectores.
- Un flujo de publicación que previsualiza la copia pública exacta, crea un enlace de solo lectura y permite actualizarla, cambiar el enlace o revocarlo conversando con Sendero.
- `restore_itinerary_version` para recuperar una versión anterior como una nueva revisión.
- Rutas diarias reconstruidas desde las ubicaciones reales de las actividades, con enlaces de Google Maps divididos en tramos compatibles cuando el día es largo y una vista esquemática integrada cuando existen coordenadas respaldadas, sin asumir que el viajero conduce ni convertir una base provisional en parada final.

El alojamiento exacto ya no bloquea un viaje nuevo. Sendero puede trabajar con un barrio, una zona o una base provisional claramente identificada y recalcular los trayectos cuando el usuario confirme dónde se hospedará.

## Contrato conversacional

- Una solicitud clara avanza directamente. “Quiero organizar cinco días en Lisboa en octubre” no abre un menú general: Sendero extrae esos datos y prepara el viaje.
- Antes de preguntar, Sendero procesa todo lo que la persona ya dijo con `prepare_trip_brief`.
- Si falta uno o más datos críticos, el mismo componente pregunta por el conjunto completo. Por ejemplo, si faltan destino y fechas, ambos aparecen en una sola interacción, no en dos turnos separados.
- Una pregunta se pospone únicamente cuando depende de otra respuesta. La licencia de conducir, por ejemplo, solo se vuelve relevante si el viaje incluye auto.
- Una referencia exacta a un viaje guardado lo abre directamente. Si hay varias coincidencias o ningún viaje identificado, Sendero muestra tarjetas clicables para elegir.
- Las decisiones que hacen avanzar la conversación son de un solo uso: después del clic, los controles se reemplazan por un recibo compacto y ya no pueden activarse desde un mensaje anterior.
- La respuesta visible nunca muestra nombres de herramientas, IDs internos, JSON ni instrucciones como “escribe Abrir Sevilla”. Los componentes transmiten ese contexto internamente y la conversación continúa con lenguaje humano.

## Componentes y flujos de ChatGPT

La interfaz vive en `web/src` como componentes React independientes y contextuales:

- `requirements`: formulario compacto con todos los datos críticos pendientes de la solicitud actual.
- `intake`: formulario guiado completo y menú solo cuando corresponde.
- `trips`: selector de viajes guardados con tarjetas que se consumen y colapsan a un recibo al elegirlas.
- `itinerary`: lista diaria compacta, calendario cuyos días se expanden en contexto, rutas en vista dividida, reservas con enlaces y estado, y acciones de seguimiento.
- `share-control`: previsualización completa y recibos para crear, actualizar, reemplazar o revocar una publicación.
- `share`: página pública independiente y sin login, con las mismas vistas de lista, calendario y rutas en modo de solo lectura.

`npm run build:ui` genera recursos HTML autocontenidos en `server/ui/generated/widgets.mjs`. Cada recurso recibe el resultado de la herramienta mediante el puente de MCP Apps y también escucha actualizaciones posteriores. El itinerario incluye desde su primer render las reservas que requieren atención; abrir la vista **Reservas** no genera una segunda respuesta de texto. Si el host no entrega un itinerario válido, el componente muestra un error recuperable en lugar de quedar indefinidamente en “Preparando tu viaje…”.

Después de conectar Sendero en ChatGPT, basta con conversar, por ejemplo: “Ayúdame a organizar Buenos Aires del 13 al 26 de agosto; no conducimos y queremos combinar clásicos con planes locales”. Sendero extrae lo que ya está dicho y pide en conjunto solo los datos críticos que todavía falten.

El menú `/` ofrece estos atajos opcionales:

- **Sendero · Nuevo viaje**
- **Sendero · Mis viajes**
- **Sendero · Ajustar viaje**
- **Sendero · Actualizar viaje**

Internamente, esos atajos se apoyan en `$plan-local-trip`, `$sendero-my-trips`, `$sendero-adjust-trip` y `$sendero-refresh-trip`; la persona no necesita escribir esos nombres para usar Sendero.

`sendero-conversation-orchestrator` funciona como una capa interna para solicitudes amplias, cambios de intención y continuaciones desde componentes. No agrega un quinto comando genérico ni reemplaza los cuatro flujos especializados.

## Compartir sin ChatGPT

La persona propietaria puede decir “comparte este viaje con un enlace”. Sendero muestra primero, dentro del chat, exactamente la proyección pública que se publicaría. Solo después de una confirmación explícita crea el enlace.

- La publicación es una copia congelada de una versión concreta. Editar el viaje privado no cambia silenciosamente la página compartida.
- **Actualizar publicación** reemplaza el contenido manteniendo el enlace; **cambiar enlace** invalida el anterior; **revocar** bloquea el acceso inmediatamente.
- El enlace lleva un token opaco de 256 bits en el fragmento de la URL. Convex guarda únicamente su hash y la página lo intercambia mediante un `POST` del mismo origen.
- La proyección usa una allowlist: omite el alojamiento exacto, notas y URLs privadas de reservas, colaboradores, IDs internos e historial de versiones. Las rutas se reconstruyen desde una zona general o el destino.
- Los enlaces vencidos, revocados, reemplazados o inexistentes muestran el mismo estado genérico. La página usa `no-store`, `no-referrer` y `noindex`, y no carga analytics.

## Persistencia y permisos

Sendero usa Convex para siete colecciones relacionadas:

- Usuarios vinculados a la identidad autenticada.
- Viajes con un propietario y el snapshot actual del itinerario.
- Colaboradores con rol `owner`, `editor` o `viewer`.
- Revisiones inmutables para conservar cada versión guardada y permitir restauraciones.
- Publicaciones sanitizadas y congeladas, con expiración, generación y solamente el hash del token.
- Operaciones idempotentes de publicación para que un reintento no cree enlaces distintos.

Las funciones de Convex exigen una identidad válida. Un lector no puede modificar el viaje, un editor puede guardar y restaurar versiones, y solamente el propietario puede compartirlo.

La planificación, validación y visualización son públicas. Las herramientas de persistencia usan OAuth con permisos mínimos:

- `trips:read` para listar y abrir viajes.
- `trips:write` para guardar, restaurar versiones y actualizar el estado de una reserva dentro de Sendero.
- `trips:share` para administrar colaboradores y publicaciones públicas; Convex vuelve a verificar que solo el propietario pueda publicar.

## Desarrollo local

Desde la raíz del proyecto:

```bash
npm install
npm test
npm run dev
```

El servidor HTTP queda disponible en `http://localhost:8788/mcp` y su comprobación de salud en `http://localhost:8788/health`.

La página pública se sirve en `http://localhost:8788/share#TOKEN` y resuelve el snapshot con `POST /api/public-shares/resolve`; ninguno de esos dos endpoints exige Auth0.

Para revisar los componentes con datos de muestra, ejecuta `npm run preview:ui` y abre `http://127.0.0.1:4173`. Las rutas `/itinerary`, `/itinerary-calendar`, `/itinerary-reservations`, `/itinerary-routes` e `/itinerary-warnings` permiten revisar directamente los estados principales del itinerario.

Copia `.env.example` como `.env.local` para desarrollo. La configuración pública actual es:

```bash
CONVEX_URL=https://hallowed-possum-528.convex.cloud
CONVEX_SITE_URL=https://hallowed-possum-528.convex.site
MCP_SERVER_URL=https://your-sendero-domain.example/mcp
PUBLIC_WEB_URL=https://your-sendero-domain.example
SENDERO_SHARE_SECRET=
AUTH0_ISSUER=https://YOUR_TENANT.REGION.auth0.com/
AUTH0_AUDIENCE=https://your-sendero-domain.example/mcp
AUTH0_CLAIMS_NAMESPACE=https://your-sendero-domain.example/claims
```

Ninguna clave de despliegue debe guardarse en el repositorio. La variable `CONVEX_DEPLOY_KEY`, cuando se configure, debe existir únicamente como secreto del proyecto de Vercel.

`SENDERO_SHARE_SECRET` también es un secreto de servidor y debe tener al menos 32 bytes aleatorios. Puedes generarlo con `openssl rand -base64 48`. Permite derivar el mismo token en un reintento seguro; no se envía a Convex ni al navegador. El valor vacío del ejemplo es intencional para que una configuración incompleta falle en lugar de usar un secreto predecible.

Para vincular y validar las funciones contra el proyecto de Convex:

```bash
npm run convex:dev
```

Este comando inicia sesión, selecciona el proyecto y genera los archivos locales de Convex. Debe ejecutarse conscientemente porque actualiza el deployment de desarrollo.

## OAuth con Auth0

Sendero funciona como resource server: publica metadata OAuth, verifica cada access token con las claves públicas de Auth0 y reenvía el mismo token a Convex. `AUTH0_AUDIENCE` debe coincidir exactamente con el identifier de la API creada en Auth0 y, de forma recomendada, con `MCP_SERVER_URL`.

Configura en Auth0 una API con firma `RS256` y estos permisos:

- `trips:read`
- `trips:write`
- `trips:share`

Para que las invitaciones por correo funcionen, agrega una Post Login Action con un secreto `CLAIMS_NAMESPACE` igual a `AUTH0_CLAIMS_NAMESPACE`:

```js
exports.onExecutePostLogin = async (event, api) => {
  const namespace = event.secrets.CLAIMS_NAMESPACE.replace(/\/$/, "");
  if (event.user.email) {
    api.accessToken.setCustomClaim(`${namespace}/email`, event.user.email);
  }
  if (event.user.name) {
    api.accessToken.setCustomClaim(`${namespace}/name`, event.user.name);
  }
};
```

Las variables `AUTH0_ISSUER`, `AUTH0_AUDIENCE` y `AUTH0_CLAIMS_NAMESPACE` deben existir tanto en Vercel como en el deployment de Convex. El endpoint de descubrimiento queda disponible en `/.well-known/oauth-protected-resource` y en su variante path-aware para `/mcp`.

Para uso local mediante entrada y salida estándar, la configuración está en `.mcp.json`.

### Renovación de la conexión

Cuando Auth0 rechaza un access token vencido, Sendero responde con `401` y `WWW-Authenticate` para que ChatGPT pueda renovar o reconectar la integración. El servidor registra únicamente diagnóstico seguro (`code`, `claim`, `issuer` y `audience`); nunca registra el token.

Para evitar reconexiones prematuras, comprueba en Auth0:

- **Allow Offline Access** habilitado en la API de Sendero.
- El cliente de ChatGPT autorizado para el grant `refresh_token`.
- Rotación y expiración de refresh tokens acordes al entorno.
- Que el consentimiento realmente incluya `offline_access` y que los logs de Auth0 muestren una renovación correcta.

Estos son cambios persistentes de seguridad y deben aplicarse deliberadamente en el dashboard; no se realizan desde el código del repositorio.

## Vercel

El archivo raíz `server.mjs` exporta la aplicación Hono para que Vercel sirva:

- `GET /health`
- `POST /mcp` y los demás métodos requeridos por Streamable HTTP
- `GET /share`, página pública de solo lectura
- `POST /api/public-shares/resolve`, resolución sin Auth0 del token público

Configura `CONVEX_URL`, `CONVEX_SITE_URL`, `MCP_SERVER_URL`, `PUBLIC_WEB_URL`, `SENDERO_SHARE_SECRET`, `AUTH0_ISSUER`, `AUTH0_AUDIENCE` y `AUTH0_CLAIMS_NAMESPACE` en Vercel. El despliegue de funciones Convex puede incorporarse después al proceso de build usando una deploy key protegida.

## Operación de producción

- El build de Vercel usa `npx convex deploy --cmd 'npm run build'`, de modo que el esquema y las funciones de Convex se publican antes de construir la web y el servidor MCP.
- `CONVEX_DEPLOY_KEY` y `SENDERO_SHARE_SECRET` son secretos exclusivos de Production. `CONVEX_URL` y `CONVEX_SITE_URL` mantienen valores separados para Production y Preview.
- El firewall limita `POST /api/public-shares/resolve` a 30 solicitudes por minuto e IP. Verifica que la regla continúe publicada después de cambios de infraestructura.
- Después de cada despliegue, comprueba `/health`, la metadata OAuth, `/mcp`, `/share` y la respuesta genérica del resolver para tokens inválidos.

## Pendiente antes de una beta pública

- Mantener la Action `Sendero custom claims` desplegada y vinculada al trigger Post Login de Auth0.
- Reemplazar las development keys de Google provistas por Auth0 antes de usar el login social en producción.
- Confirmar la política de renovación de tokens de Auth0 con una conexión nueva de ChatGPT.
- Añadir envío de invitaciones por email; actualmente la invitación se activa al iniciar sesión con el mismo correo.
