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
- `open_trip` como fachada de apertura: resuelve una referencia reciente, exacta o natural, carga el snapshot autoritativo y lo presenta sin regenerarlo ni modificarlo.
- `present_trip` como fachada de resultado no persistente: valida estrictamente el snapshot final y lo muestra como una vista deliberadamente no editable, sin `tripId`, `version`, `role` ni contexto de viaje guardado.
- `save_and_present_trip` como fachada de resultado persistente: valida, guarda una nueva versión y presenta exactamente el snapshot autoritativo que quedó almacenado.
- Controles de reserva que registran **confirmada** o **cancelada** únicamente dentro de Sendero; el enlace oficial abre el proveedor y Sendero nunca afirma haber reservado o cancelado allí.
- `find_itineraries`, `list_itineraries`, `get_itinerary`, `validate_itinerary`, `render_itinerary` y `save_itinerary` como primitivas internas y de compatibilidad para resolución especializada, diagnóstico y recuperación. `open_trip` ya incluye sus propias tarjetas cuando una referencia tiene varios resultados; `list_itineraries` queda solo para navegar explícitamente sin referencia. El flujo normal no encadena primitivas cuando una fachada expresa la intención completa.
- `share_itinerary` para invitar por email a colaboradores como editores o lectores.
- Un flujo de publicación que previsualiza la copia pública exacta, crea un enlace de solo lectura y permite actualizarla, cambiar el enlace o revocarlo conversando con Sendero.
- `restore_itinerary_version` para recuperar una versión anterior como una nueva revisión y devolver ya presentado el snapshot autoritativo restaurado.
- Rutas diarias reconstruidas desde las ubicaciones reales de las actividades, con enlaces de Google Maps divididos en tramos compatibles cuando el día es largo y una vista esquemática integrada cuando existen coordenadas respaldadas, sin asumir que el viajero conduce ni convertir una base provisional en parada final.

El alojamiento exacto ya no bloquea un viaje nuevo. Sendero puede trabajar con un barrio, una zona o una base provisional claramente identificada y recalcular los trayectos cuando el usuario confirme dónde se hospedará.

## Contrato conversacional

- Una solicitud clara avanza directamente. “Quiero organizar cinco días en Lisboa en octubre” no abre un menú general: Sendero extrae esos datos y prepara el viaje.
- Antes de preguntar, Sendero procesa todo lo que la persona ya dijo con `prepare_trip_brief`.
- Si falta uno o más datos críticos, el mismo componente pregunta por el conjunto completo. Por ejemplo, si faltan destino y fechas, ambos aparecen en una sola interacción, no en dos turnos separados.
- Una pregunta se pospone únicamente cuando depende de otra respuesta. La licencia de conducir, por ejemplo, solo se vuelve relevante si el viaje incluye auto.
- “Abre mi último viaje guardado” ejecuta una sola apertura de intención completa: resuelve directamente el viaje actualizado más recientemente y lo muestra sin selector, regeneración, validación ni cambios. Una referencia exacta a cualquier otro viaje también lo abre directamente; solo las referencias realmente ambiguas muestran tarjetas clicables para elegir.
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

## Web y colaboración

La misma aplicación Hono que sirve el MCP se despliega en Vercel y también expone las superficies web de Sendero:

- `/`: landing pública.
- `/app`: cuenta autenticada con viajes propios y compartidos.
- `/app/trips/:webId`: itinerario restringido para propietario, colaboradores y viewers.
- `/invite/:webId#token=...`: aceptación explícita de una invitación.
- `/share#TOKEN`: snapshot público de solo lectura para cualquiera que tenga el enlace.
- `/privacy` y `/terms`: páginas legales públicas.

Hay dos formas deliberadamente distintas de compartir:

- **Solo personas invitadas**: el propietario invita un correo como `viewer` o `collaborator`. La persona debe iniciar sesión con ese correo verificado y aceptar la invitación antes de obtener acceso.
- **Público con enlace**: cualquiera con el enlace opaco puede ver la proyección pública, sin una cuenta de Sendero. El enlace se puede revocar o reemplazar.

La web es una extensión para consultar, colaborar y compartir; la planificación sigue siendo conversacional dentro de ChatGPT.

## Compartir públicamente sin ChatGPT

La persona propietaria puede decir “comparte este viaje con un enlace”. Sendero muestra primero, dentro del chat, exactamente la proyección pública que se publicaría. Solo después de una confirmación explícita crea el enlace.

- La publicación es una copia congelada de una versión concreta. Editar el viaje privado no cambia silenciosamente la página compartida.
- **Actualizar publicación** reemplaza el contenido manteniendo el enlace; **cambiar enlace** invalida el anterior; **revocar** bloquea el acceso inmediatamente.
- El enlace lleva un token opaco de 256 bits en el fragmento de la URL. Convex guarda únicamente su hash y la página lo intercambia mediante un `POST` del mismo origen.
- La proyección usa una allowlist: omite el alojamiento exacto, notas y URLs privadas de reservas, colaboradores, IDs internos e historial de versiones. Las rutas se reconstruyen desde una zona general o el destino.
- Los enlaces vencidos, revocados, reemplazados o inexistentes muestran el mismo estado genérico. La página usa `no-store`, `no-referrer` y `noindex`, y no carga analytics.

## Persistencia y permisos

Sendero usa Convex para doce colecciones relacionadas:

- Usuarios vinculados a la identidad autenticada.
- Viajes con un propietario y el snapshot actual del itinerario.
- Colaboradores con rol `owner`, `editor` o `viewer`.
- Revisiones inmutables para conservar cada versión guardada y permitir restauraciones.
- Operaciones idempotentes de guardado y restauración, con control optimista de versión para evitar sobrescribir cambios recientes.
- Operaciones idempotentes de estado de reservas y boletos dentro de Sendero.
- Publicaciones sanitizadas y congeladas, con expiración, generación y solamente el hash del token.
- Operaciones idempotentes de publicación para que un reintento no cree enlaces distintos.
- Invitaciones pendientes vinculadas a un correo normalizado y a un hash de token, nunca al token original.
- Entregas de invitación en un outbox durable con lease, reintentos, idempotencia y estado observable. Cada job se vincula al hash y generación vigentes de la invitación, pero nunca persiste el bearer token.
- Recuperación explícita de invitaciones antiguas: una fila pendiente histórica nunca concede acceso por email; el propietario la migra a una invitación moderna y la persona invitada debe aceptarla con correo verificado.
- Auditoría de cambios de acceso, rol, aceptación y revocación.
- Operaciones idempotentes de colaboración para que reintentos de la web y del chat no dupliquen efectos.

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

La landing queda en `http://localhost:8788/`, la cuenta en `http://localhost:8788/app` y una invitación local usa `http://localhost:8788/invite/WEB_ID#token=TOKEN`.

Para revisar los componentes con datos de muestra, ejecuta `npm run preview:ui` y abre `http://127.0.0.1:4173`. Las rutas `/itinerary`, `/itinerary-calendar`, `/itinerary-reservations`, `/itinerary-routes` e `/itinerary-warnings` permiten revisar directamente los estados principales del itinerario.

Copia `.env.example` como `.env.local` para desarrollo. La configuración pública actual es:

```bash
CONVEX_URL=https://hallowed-possum-528.convex.cloud
CONVEX_SITE_URL=https://hallowed-possum-528.convex.site
CONVEX_DEPLOY_KEY=
MCP_SERVER_URL=https://your-sendero-domain.example/mcp
PUBLIC_WEB_URL=https://your-sendero-domain.example
SENDERO_CHATGPT_URL=https://chatgpt.com/
SENDERO_SHARE_SECRET=
GOOGLE_MAPS_EMBED_API_KEY=
AUTH0_ISSUER=https://YOUR_TENANT.REGION.auth0.com/
AUTH0_AUDIENCE=https://your-sendero-domain.example/mcp
AUTH0_CLAIMS_NAMESPACE=https://your-sendero-domain.example/claims
AUTH0_WEB_CLIENT_ID=
AUTH0_WEB_CLIENT_SECRET=
AUTH0_WEB_SCOPES=openid profile email offline_access trips:read trips:write trips:share
SENDERO_WEB_SESSION_KEY=
SENDERO_INVITE_TOKEN_PEPPER=
RESEND_API_KEY=
SENDERO_EMAIL_FROM=Sendero <viajes@your-sendero-domain.example>
MCP_PORT=8788
```

Ninguna clave de despliegue debe guardarse en el repositorio. La variable `CONVEX_DEPLOY_KEY`, cuando se configure, debe existir únicamente como secreto del proyecto de Vercel.

`SENDERO_SHARE_SECRET` también es un secreto de servidor y debe tener al menos 32 bytes aleatorios. Puedes generarlo con `openssl rand -base64 48`. Permite derivar el mismo token en un reintento seguro; no se envía a Convex ni al navegador. El valor vacío del ejemplo es intencional para que una configuración incompleta falle en lugar de usar un secreto predecible.

`SENDERO_WEB_SESSION_KEY` cifra las sesiones y la continuidad de invitaciones durante el login; `SENDERO_INVITE_TOKEN_PEPPER` protege los hashes de invitación. Ambos deben contener al menos 32 bytes aleatorios y existir solamente como secretos de servidor. `RESEND_API_KEY` y `SENDERO_EMAIL_FROM` habilitan el worker de invitaciones dentro de Convex; si faltan allí, la invitación queda creada y el outbox pasa de forma asíncrona a **Correo no configurado**. Ningún bearer token se expone a la web.

`GOOGLE_MAPS_EMBED_API_KEY` habilita el mapa interactivo de las rutas dentro del componente. Guárdala como secreto de Vercel y restríngela en Google Cloud exclusivamente a **Maps Embed API**. Sendero la inserta en el HTML solo al servir el recurso: no forma parte del bundle versionado ni debe guardarse en Git. Como toda clave usada por Maps Embed, será visible para el navegador en la URL del iframe; la restricción de API es la protección principal.

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

Para que una persona pueda reclamar una invitación únicamente con su correo exacto y verificado, agrega una Post Login Action con un secreto `CLAIMS_NAMESPACE` igual a `AUTH0_CLAIMS_NAMESPACE`:

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

Las variables `AUTH0_ISSUER`, `AUTH0_AUDIENCE` y `AUTH0_CLAIMS_NAMESPACE` deben existir tanto en Vercel como en el deployment de Convex. El outbox de invitaciones se entrega desde una Convex Node action, por lo que `SENDERO_INVITE_TOKEN_PEPPER`, `PUBLIC_WEB_URL`, `RESEND_API_KEY` y `SENDERO_EMAIL_FROM` también deben configurarse en el deployment Convex correspondiente. El endpoint de descubrimiento queda disponible en `/.well-known/oauth-protected-resource` y en su variante path-aware para `/mcp`.

Además de la API usada por el MCP, crea en Auth0 una **Regular Web Application** para las páginas de Sendero. Configura:

- Callback URL: `https://TU_DOMINIO/auth/callback`.
- Logout URL: `https://TU_DOMINIO/`.
- Allowed Web Origin: `https://TU_DOMINIO`.
- Grant types: Authorization Code y Refresh Token.
- Variables de Vercel: `AUTH0_WEB_CLIENT_ID`, `AUTH0_WEB_CLIENT_SECRET` y `AUTH0_WEB_SCOPES`.

El access token de esa aplicación debe incluir el correo y su estado de verificación. Amplía la Action anterior con claims de email verificado cuando Auth0 no los incluya de forma estándar en el access token:

```js
if (event.user.email) {
  api.accessToken.setCustomClaim(`${namespace}/email`, event.user.email);
}
api.accessToken.setCustomClaim(
  `${namespace}/email_verified`,
  event.user.email_verified === true,
);
```

Sendero no acepta invitaciones automáticamente al completar OAuth. Conserva de forma cifrada el contexto de la invitación y exige que la persona presione **Aceptar invitación** con el correo exacto y verificado.

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
- `GET /`, `/privacy` y `/terms`, sitio público
- `GET /app`, `/app/trips/:webId` e `/invite/:webId`, experiencia web autenticada
- `/auth/*` y `/api/*`, OAuth web, cuenta, permisos, invitaciones y estados de reservas

Configura `CONVEX_URL`, `CONVEX_SITE_URL`, `MCP_SERVER_URL`, `PUBLIC_WEB_URL`, `SENDERO_SHARE_SECRET`, `SENDERO_INVITE_TOKEN_PEPPER`, `SENDERO_WEB_SESSION_KEY`, `GOOGLE_MAPS_EMBED_API_KEY`, `AUTH0_ISSUER`, `AUTH0_AUDIENCE`, `AUTH0_CLAIMS_NAMESPACE`, `AUTH0_WEB_CLIENT_ID` y `AUTH0_WEB_CLIENT_SECRET` en Vercel. `RESEND_API_KEY` y `SENDERO_EMAIL_FROM` pertenecen al deployment de Convex que ejecuta el outbox; no son necesarias en el runtime Hono de Vercel. El despliegue de funciones Convex puede incorporarse después al proceso de build usando una deploy key protegida.

## Operación de producción

- `vercel.json` fija `npm run build:vercel`. El script exige un entorno Vercel Preview/Production y una deploy key antes de ejecutar `convex deploy --cmd 'npm run build'`, de modo que el esquema y las funciones de Convex se publican antes de construir la web y el servidor MCP.
- `CONVEX_DEPLOY_KEY` y `SENDERO_SHARE_SECRET` son secretos por entorno. Durante la beta cerrada, Preview usa un deployment Convex de staging fijo: su deploy key y su `CONVEX_URL` deben apuntar al mismo deployment. No uses una Preview Deploy Key por rama hasta propagar de forma verificable su URL al runtime Hono de Vercel.
- El firewall limita `POST /api/public-shares/resolve` a 30 solicitudes por minuto e IP. Verifica que la regla continúe publicada después de cambios de infraestructura.
- Después de cada despliegue, comprueba `/health`, la metadata OAuth, `/mcp`, `/share` y la respuesta genérica del resolver para tokens inválidos.

La matriz de variables, el CI sin secretos y los smoke checks locales/remotos están documentados en [`docs/environment-and-release.md`](docs/environment-and-release.md).

## Pendiente antes de una beta pública

- Mantener la Action `Sendero custom claims` desplegada y vinculada al trigger Post Login de Auth0.
- Reemplazar las development keys de Google provistas por Auth0 antes de usar el login social en producción.
- Confirmar la política de renovación de tokens de Auth0 con una conexión nueva de ChatGPT.
- Verificar el dominio remitente de `SENDERO_EMAIL_FROM` con una entrega real de staging.
- Añadir el endpoint de webhook de Resend con verificación de firma para convertir los eventos aceptado, entregado, demorado, rebotado y spam en estados de entrega autoritativos.
- Migrar las sesiones web cifradas del cookie a identificadores opacos revocables si la beta requiere cierre global de sesiones o múltiples dispositivos administrados.

La arquitectura, permisos y criterios de entrega están detallados en [`docs/web-sharing-architecture.md`](docs/web-sharing-architecture.md).
