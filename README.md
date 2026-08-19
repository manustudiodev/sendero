# Sendero

Sendero es un plugin de planificación de viajes que convierte fechas, alojamiento, intereses, transporte, reservas y compromisos fijos en un itinerario local-first. Su interfaz muestra el resultado como lista diaria, calendario y rutas por día.

## Qué incluye

- Un skill que guía la investigación de clima, eventos, horarios, reservas y experiencias locales.
- `prepare_trip_brief` para normalizar las preferencias y detectar información crítica faltante.
- `validate_itinerary` para controlar fechas, solapamientos, transporte, reservas, fuentes y actividades fijas.
- `render_itinerary` para mostrar el itinerario en una interfaz MCP Apps con vistas de lista, calendario y mapa.
- `list_itineraries` y `get_itinerary` para recuperar los viajes accesibles por el usuario.
- `save_itinerary` para crear un viaje o guardar una nueva versión sin perder el historial.
- `share_itinerary` para invitar amigos como editores o lectores.
- `restore_itinerary_version` para recuperar una versión anterior como una nueva revisión.
- Rutas diarias generadas para Google Maps desde el alojamiento, sin asumir que el viajero conduce.

## Persistencia y permisos

Sendero usa Convex para cuatro colecciones relacionadas:

- Usuarios vinculados a la identidad autenticada.
- Viajes con un propietario y el snapshot actual del itinerario.
- Colaboradores con rol `owner`, `editor` o `viewer`.
- Revisiones inmutables para conservar cada versión guardada y permitir restauraciones.

Las funciones de Convex exigen una identidad válida. Un lector no puede modificar el viaje, un editor puede guardar y restaurar versiones, y solamente el propietario puede compartirlo.

La planificación, validación y visualización son públicas. Las herramientas de persistencia usan OAuth con permisos mínimos:

- `trips:read` para listar y abrir viajes.
- `trips:write` para guardar y restaurar versiones.
- `trips:share` para administrar colaboradores.

## Desarrollo local

Desde la raíz del proyecto:

```bash
npm install
npm test
npm run dev
```

El servidor HTTP queda disponible en `http://localhost:8788/mcp` y su comprobación de salud en `http://localhost:8788/health`.

Copia `.env.example` como `.env.local` para desarrollo. La configuración pública actual es:

```bash
CONVEX_URL=https://hallowed-possum-528.convex.cloud
CONVEX_SITE_URL=https://hallowed-possum-528.convex.site
MCP_SERVER_URL=https://your-sendero-domain.example/mcp
AUTH0_ISSUER=https://YOUR_TENANT.REGION.auth0.com/
AUTH0_AUDIENCE=https://your-sendero-domain.example/mcp
AUTH0_CLAIMS_NAMESPACE=https://your-sendero-domain.example/claims
```

Ninguna clave de despliegue debe guardarse en el repositorio. La variable `CONVEX_DEPLOY_KEY`, cuando se configure, debe existir únicamente como secreto del proyecto de Vercel.

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

## Vercel

El archivo raíz `server.mjs` exporta la aplicación Hono para que Vercel sirva:

- `GET /health`
- `POST /mcp` y los demás métodos requeridos por Streamable HTTP

Configura `CONVEX_URL`, `CONVEX_SITE_URL`, `MCP_SERVER_URL`, `AUTH0_ISSUER`, `AUTH0_AUDIENCE` y `AUTH0_CLAIMS_NAMESPACE` en Vercel. El despliegue de funciones Convex puede incorporarse después al proceso de build usando una deploy key protegida.

## Pendiente antes de publicar

- Mantener la Action `Sendero custom claims` desplegada y vinculada al trigger Post Login de Auth0.
- Reemplazar las development keys de Google provistas por Auth0 antes de usar el login social en producción.
- Verificar `/health`, la metadata OAuth y `/mcp` por HTTPS después de cada despliegue.
- Añadir envío de invitaciones por email; actualmente la invitación se activa al iniciar sesión con el mismo correo.
