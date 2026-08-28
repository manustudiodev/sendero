# Entornos y release de Sendero

Este documento hace reproducible el build y la verificación de Sendero sin guardar secretos ni depender de la configuración histórica del dashboard.

## Perfiles

| Variable | Local | Preview | Production | Convex deployment | Secreto | Uso |
| --- | --- | --- | --- | --- | --- | --- |
| `CONVEX_URL` | opcional | requerida | requerida | no | no | Runtime Hono hacia Convex |
| `CONVEX_SITE_URL` | opcional | opcional | opcional | no | no | Reservada para HTTP Actions directas |
| `CONVEX_DEPLOY_KEY` | no usar | requerida, clave del staging fijo | requerida, clave Production | no | sí | Build de Vercel y deploy de Convex |
| `MCP_SERVER_URL` | opcional | requerida | requerida | no | no | Endpoint MCP canónico |
| `PUBLIC_WEB_URL` | opcional | requerida | requerida | requerida | no | Origin web, callbacks y enlaces de invitación |
| `SENDERO_CHATGPT_URL` | opcional | opcional | opcional | no | no | CTA hacia ChatGPT; usa `https://chatgpt.com/` por defecto |
| `SENDERO_SHARE_SECRET` | opcional | requerida | requerida | no | sí | Derivación de tokens públicos |
| `GOOGLE_MAPS_EMBED_API_KEY` | opcional | recomendada | recomendada | no | sí en Vercel; visible en iframe | Maps Embed API restringida |
| `AUTH0_ISSUER` | opcional | requerida | requerida | requerida | no | Issuer del tenant Auth0 |
| `AUTH0_AUDIENCE` | opcional | requerida | requerida | requerida | no | Audience de la API Sendero |
| `AUTH0_CLAIMS_NAMESPACE` | opcional | requerida | requerida | requerida | no | Namespace de claims custom |
| `AUTH0_WEB_CLIENT_ID` | opcional | requerida | requerida | no | no | Regular Web Application |
| `AUTH0_WEB_CLIENT_SECRET` | opcional | requerida | requerida | no | sí | Regular Web Application |
| `AUTH0_WEB_SCOPES` | opcional | requerida | requerida | no | no | Scopes solicitados por web |
| `SENDERO_WEB_SESSION_KEY` | opcional | requerida | requerida | no | sí | Cifrado de sesiones web |
| `SENDERO_INVITE_TOKEN_PEPPER` | opcional | requerida | requerida | requerida | sí | Hash y reconstrucción segura de invitaciones |
| `RESEND_API_KEY` | opcional | no aplica | no aplica | recomendada en staging, requerida en Production | sí | Entrega desde el outbox de invitaciones |
| `SENDERO_EMAIL_FROM` | opcional | no aplica | no aplica | recomendada en staging, requerida en Production | no | Remitente verificado del outbox |
| `MCP_PORT` | opcional | no aplica | no aplica | no | no | Puerto del servidor local |

`config/environment.mjs` es la lista verificable de variables. `.env.example` contiene todas las claves, pero mantiene vacíos los secretos.

## Validación local sin servicios externos

```bash
npm ci
npm run check:env:example
npm test
npm run smoke:local
npm run check:generated
npm run check:diff
```

`npm run smoke:local` levanta Hono en un puerto efímero, sin Convex/Auth0/Resend, y comprueba salud, páginas, metadata OAuth, `initialize`, `tools/list` y `resources/list`. No realiza escrituras ni llamadas externas.

Para validar un `.env.local` sin imprimir valores:

```bash
npm run check:env
node scripts/check-env.mjs --profile preview --env-file .env.preview.local
node scripts/check-env.mjs --profile production --env-file .env.production.local
node scripts/check-env.mjs --profile preview --target convex --env-file .env.preview.local
node scripts/check-env.mjs --profile production --target convex --env-file .env.production.local
```

Los dos últimos archivos son solo ejemplos de nombres locales y continúan excluidos por `.gitignore`.

## CI

`.github/workflows/ci.yml` ejecuta `npm ci` y `npm run ci` en Node `22.13.0`. El job:

1. valida que `.env.example` cubra la matriz sin secretos;
2. construye componentes y páginas;
3. ejecuta la suite Node;
4. ejecuta el smoke HTTP/MCP local;
5. comprueba que el bundle generado sea reproducible;
6. ejecuta `git diff --check` y exige que el build no deje diferencias.

El workflow no posee secretos y no despliega.

## Build de Vercel y Convex

`vercel.json` fija `npm run build:vercel`. Ese script está deliberadamente protegido: solo acepta `VERCEL=1`, `VERCEL_ENV=preview|production` y una `CONVEX_DEPLOY_KEY` no vacía. Después ejecuta el flujo recomendado por Convex:

```bash
convex deploy --cmd 'npm run build'
```

- Para la **beta cerrada**, Preview usa un deployment fijo de staging, una deploy key que apunte a ese mismo deployment y un `CONVEX_URL` de runtime que coincida exactamente. No se usa todavía una Preview Deploy Key por rama.
- En **Production**, usa una Production Deploy Key limitada a `deployment:deploy`.
- Nunca habilites la clave de Production en Preview o Development.
- Las variables que usan las funciones Convex (`AUTH0_ISSUER`, `AUTH0_AUDIENCE`, `AUTH0_CLAIMS_NAMESPACE`, `SENDERO_INVITE_TOKEN_PEPPER`, `PUBLIC_WEB_URL`, `RESEND_API_KEY` y `SENDERO_EMAIL_FROM`) también deben configurarse en cada deployment de Convex. Las cuatro últimas son necesarias porque el outbox de invitaciones se entrega desde una Convex Node action, no desde el runtime de Vercel.

### Por qué Preview usa staging fijo durante la beta cerrada

Una **Preview Deploy Key** crea o selecciona un backend Convex por rama. `convex deploy --cmd` inyecta la URL de ese backend solamente en el proceso de build que ejecuta `npm run build`; no actualiza por sí mismo `CONVEX_URL` para el runtime de la función Hono en Vercel. Como Sendero consulta `CONVEX_URL` en tiempo de ejecución, una variable Preview estática puede terminar apuntando a otro deployment distinto del que acaba de recibir las funciones.

Para evitar ese drift, la beta cerrada usa un único deployment Convex de staging compartido por los Vercel Preview deployments. La deploy key, `CONVEX_URL` y las variables Convex deben pertenecer al mismo staging. Si más adelante se necesitan backends aislados por rama, primero hay que implementar una propagación verificable de la URL creada por Convex hacia el runtime Vercel de esa rama; recién entonces se habilitan Preview Deploy Keys.

No ejecutes `npm run build:vercel` manualmente: el guard evita un deploy accidental desde una máquina local.

## Smoke posterior al deploy

Después de un deploy autorizado:

```bash
SENDERO_SMOKE_BASE_URL=https://sendero.example npm run smoke:remote
```

El smoke remoto es de solo lectura. Comprueba páginas públicas, salud, metadata OAuth, descubrimiento MCP (`initialize`, `tools/list`, `resources/list`) y que una autorización malformada responda `401` con `WWW-Authenticate`. No prueba login, aceptación de invitaciones, envío de email ni mutaciones: esos casos requieren un entorno de staging y cuentas de prueba.

## Criterio de release

Un release puede avanzar a staging cuando:

- `npm run ci` pasa desde un checkout limpio;
- la matriz Preview está completa;
- Auth0 acepta el callback exacto del dominio Preview;
- el remitente de Resend está verificado o el envío está deshabilitado de forma explícita;
- el deploy de Convex usa la clave del entorno correcto;
- `CONVEX_URL` apunta al mismo deployment identificado por la deploy key;
- las variables del outbox están configuradas también dentro del deployment Convex;
- el smoke remoto pasa en el alias público o en una URL autenticada si Vercel Access Protection está habilitado.

Publicar, cambiar OAuth, crear secretos, hacer commit/push o desplegar siguen siendo acciones separadas y requieren autorización explícita.
