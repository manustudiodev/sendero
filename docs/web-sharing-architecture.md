# Sendero web y colaboración

## Objetivo

Sendero conserva ChatGPT como superficie principal de planificación y agrega una web propia para tres necesidades que el chat no resuelve por sí solo: descubrir el producto, consultar viajes guardados con una cuenta de Sendero y compartir itinerarios con personas que no usan ChatGPT.

La web no es un segundo editor completo. Los cambios amplios del viaje se piden conversando; la web permite lectura, estados operativos acotados y gestión de acceso.

## Superficies

| Superficie | Audiencia | Autenticación | Capacidad |
| --- | --- | --- | --- |
| Landing `/` | Cualquiera | No | Explicar Sendero y abrirlo en ChatGPT |
| Cuenta `/app` | Usuario Sendero | Auth0 | Ver viajes propios y compartidos |
| Viaje privado `/app/trips/:webId` | Invitados | Auth0 + ACL | Ver; actualizar reservas si es colaborador |
| Invitación `/invite/:webId#token=...` | Destinatario | Auth0 | Inspeccionar y aceptar o rechazar explícitamente |
| Publicación `/share#TOKEN` | Cualquiera con el enlace | No | Ver un snapshot sanitizado y de solo lectura |

## Arquitectura

Hono sigue siendo el backend HTTP y se aloja como función de Vercel. No hace falta otro servidor:

```text
ChatGPT / MCP UI -----------+
                            |
Browser web -> Hono/Vercel -+-> Auth0 -> access token
             |              |
             |              +-> Convex -> trips, ACL, invitations, audit
             |                   |
             |                   +-> durable outbox -> Resend
             |
             +-> Google Maps Embed -> route preview
```

- **Hono/Vercel**: páginas, OAuth BFF, CSRF, API web, recursos MCP y proyección pública.
- **Convex**: estado autoritativo, versiones, permisos, invitaciones, auditoría y worker durable de email.
- **Auth0**: identidad. El acceso depende de `sub`, correo exacto y correo verificado; no del navegador ni de datos enviados por el cliente.
- **Resend**: entrega de invitaciones. No decide permisos.

## Permisos

| Acción | Owner | Collaborator | Viewer | Público con enlace |
| --- | :---: | :---: | :---: | :---: |
| Ver itinerario privado | Sí | Sí | Sí | No |
| Cambiar estado de reserva | Sí | Sí | No | No |
| Editar el viaje conversando | Sí | Sí | No | No |
| Invitar o quitar personas | Sí | No | No | No |
| Cambiar roles | Sí | No | No | No |
| Publicar, rotar o revocar enlace | Sí | No | No | No |
| Ver snapshot público | Sí | Sí | Sí | Sí |

Internamente Convex usa `owner`, `editor` y `viewer`; la UI traduce `editor` como **Colaborador**.

## Identidad y acceso

- Cada viaje tiene un `webId` opaco y estable para rutas web. No otorga acceso por sí solo.
- Cada consulta privada vuelve a comprobar la identidad y la ACL en Convex.
- La autorización no se basa en email salvo al reclamar una invitación. Después de aceptar, el acceso queda vinculado al `subject` de Auth0.
- El propietario no puede eliminarse ni rebajarse por una operación de colaborador.
- Todas las mutaciones requieren un `operationId` para reintentos idempotentes y generan auditoría.

## Invitaciones

1. El propietario introduce correo y permiso.
2. Hono genera un token opaco y pide a Convex crear la invitación pendiente guardando solo su hash.
3. La misma mutación encola una entrega durable vinculada al hash, rol y generación actuales. El worker de Convex deriva el bearer sin persistirlo y llama a Resend con una clave de idempotencia acotada por propietario, viaje y operación.
4. Resend envía `/invite/:webId#token=...`. El fragmento no llega al servidor en logs ni encabezados.
5. La página intercambia el token por su hash mediante `POST`; Hono conserva el contexto cifrado durante OAuth.
6. Tras iniciar sesión, Sendero exige correo exacto y verificado.
7. La persona acepta o rechaza explícitamente. Iniciar sesión nunca acepta por sí solo.
8. Aceptar crea o actualiza la ACL y consume la invitación de forma atómica; el enlace deja de funcionar como bearer inmediatamente.

Reenviar rota el token y vence el anterior. Revocar invalida la invitación inmediatamente. Estados revocados, vencidos o inexistentes devuelven el mismo resultado genérico para evitar enumeración.

Las filas `collaborators.pending` creadas por versiones anteriores nunca conceden acceso ni se reclaman automáticamente por correo. El propietario puede migrarlas explícitamente desde la gestión de acceso: una única transacción crea la invitación moderna con token y entrega durable, enlaza ambas generaciones y revoca la fila antigua. La persona invitada conserva el mismo requisito de correo verificado y aceptación explícita.

Los jobs históricos del outbox que no guardaban la generación de la invitación se vinculan de forma segura antes de enviarse. Sendero solo cambia su clave de idempotencia si el job continúa en cola y nunca fue intentado; después del primer intento conserva la clave que pudo haber visto el proveedor. Un hash, rol o generación que no coincida termina el job sin enviar correo.

## Enlace público

- Publicar crea un snapshot sanitizado de una versión concreta; no expone el viaje privado vivo.
- El token público tiene alta entropía y Convex almacena solo su hash.
- Cambios privados no actualizan silenciosamente el snapshot público.
- Rotar invalida el enlace anterior. Revocar corta el acceso.
- No se incluyen alojamiento exacto, notas privadas, emails, colaboradores, IDs internos ni URLs privadas.
- La página usa `no-store`, `no-referrer`, `noindex`, CSP estricta y no carga analytics.

## API web de una sola intención

La web evita encadenamientos accidentales y ofrece endpoints que representan una intención completa:

- `GET /api/trips`
- `GET /api/trips/:webId`
- `PATCH /api/trips/:webId/reservations/status`
- `GET|PATCH /api/trips/:webId/access`
- `POST /api/trips/:webId/access/public-link/rotate`
- `POST /api/trips/:webId/invitations`
- `POST /api/trips/:webId/legacy-invitations/:collaboratorId/migrate`
- `DELETE /api/trips/:webId/legacy-invitations/:collaboratorId`
- `POST /api/trips/:webId/invitations/:id/resend`
- `DELETE /api/trips/:webId/invitations/:id`
- `PATCH|DELETE /api/trips/:webId/access/:collaboratorId`
- `POST /api/invitations/inspect|accept|decline`

Las operaciones equivalentes en ChatGPT deben tener herramientas MCP dedicadas. El modelo no necesita improvisar cadenas de primitivas para invitar, revocar, cambiar rol o abrir un viaje.

## Seguridad

- OAuth Authorization Code + PKCE y validación de `state`, `nonce`, issuer, audience y firma.
- Sesión cifrada, `HttpOnly`, `SameSite=Lax`, `Secure` en HTTPS y CSRF ligado a la sesión para toda mutación.
- `returnTo` limitado a rutas relativas del mismo origen.
- Cuerpo JSON estricto y limitado a 16 KiB.
- Los tokens no se registran. El bearer de invitación se entrega solo por email; el bearer público se devuelve una vez a la persona propietaria que acaba de publicar o rotar el enlace.
- Las invitaciones tienen un límite durable de cinco envíos por hora para la misma combinación de propietario, viaje y destinatario.
- Respuestas públicas deliberadamente indistinguibles para enlaces no disponibles.
- Secretos únicamente en los entornos de Vercel o Convex que los consumen; nunca en el bundle ni en Git.

## Entregas

### Entrega 1: fundación beta

- Landing, legales y CTA a ChatGPT.
- Cuenta web y viaje privado.
- Roles owner/collaborator/viewer.
- Invitación explícita por email.
- Acceso público o restringido.
- Gestión de personas y estado de reservas.
- Herramientas MCP de una sola intención para colaboración.

### Entrega 2: robustez operativa

- Outbox de email, reintentos y aceptación idempotente del proveedor: implementados para la beta cerrada. El estado `sent` significa que Resend aceptó el mensaje, no que llegó a la bandeja.
- Webhook de entrega con verificación de firma: pendiente antes de mostrar entregado, demorado, rebotado o spam como estados autoritativos del proveedor.
- Sesiones opacas revocables y gestión de dispositivos.
- Notificaciones de cambios y actividad reciente.
- Pruebas E2E con Auth0 de staging y matriz móvil/escritorio.
- Rate limits adicionales para login y resolución pública.

### Entrega 3: colaboración enriquecida

- Comentarios y sugerencias, sin convertir la web en un editor paralelo.
- Presencia y registro de actividad comprensible.
- Preferencias de notificación y digest del viaje.

## Criterios para beta

- Ningún viewer puede mutar el viaje o sus reservas.
- Ningún collaborator puede gestionar acceso o publicación.
- Una invitación solo puede reclamarse con el correo exacto verificado y una aceptación explícita.
- Reenvío, revocación y rotación invalidan el token anterior.
- Los viajes públicos nunca contienen campos privados.
- Una pérdida o repetición de respuesta del cliente no duplica operaciones.
- Landing, cuenta, invitación, viaje privado y publicación pasan QA responsive, teclado, lector de pantalla, light/dark y estados loading/empty/error.
- Los cambios de acceso quedan auditados.
