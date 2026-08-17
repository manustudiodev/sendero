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
```

Ninguna clave de despliegue debe guardarse en el repositorio. La variable `CONVEX_DEPLOY_KEY`, cuando se configure, debe existir únicamente como secreto del proyecto de Vercel.

Para vincular y validar las funciones contra el proyecto de Convex:

```bash
npm run convex:dev
```

Este comando inicia sesión, selecciona el proyecto y genera los archivos locales de Convex. Debe ejecutarse conscientemente porque actualiza el deployment de desarrollo.

Para uso local mediante entrada y salida estándar, la configuración está en `.mcp.json`.

## Vercel

El archivo raíz `server.mjs` exporta la aplicación Hono para que Vercel sirva:

- `GET /health`
- `POST /mcp` y los demás métodos requeridos por Streamable HTTP

Configura `CONVEX_URL` en Vercel. El despliegue de funciones Convex puede incorporarse después al proceso de build usando una deploy key protegida.

## Pendiente antes de publicar

- Configurar el proveedor OAuth/OIDC compartido por ChatGPT y Convex.
- Vincular las funciones locales con el proyecto Convex y ejecutar su generación de tipos.
- Crear el proyecto Vercel, añadir las variables de entorno y verificar `/health` y `/mcp` por HTTPS.
- Añadir envío de invitaciones por email; actualmente la invitación se activa al iniciar sesión con el mismo correo.
