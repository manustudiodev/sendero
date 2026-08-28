# Sendero — estado actual, gaps y protocolo de auditoría

**Fecha:** 2026-08-28
**Estado:** baseline preliminar, pendiente de auditoría de repositorio

## 1. Objetivo

Este documento evita el error de tratar una visión de producto como si fuera una descripción del software ya implementado. Organiza el estado de Sendero en cuatro niveles:

- **Confirmado:** declarado expresamente por el owner.
- **Por auditar:** debe comprobarse en repositorio, infraestructura o deployment.
- **Challenge:** delta inmediato requerido para participar.
- **Roadmap:** objetivo futuro, fuera del alcance urgente.

No debe comenzar una implementación grande hasta completar la auditoría indicada en la sección 7.

## 2. Estado confirmado por el owner

Los siguientes hechos se consideran confirmados para efectos de planificación:

### Producto y superficies

- Sendero ya tiene una fase inicial funcional.
- Existe un plugin de Sendero para ChatGPT.
- El plugin utiliza un servidor MCP.
- Existe una API propia de Sendero.
- Existe una landing page.
- Existen páginas web para itinerarios compartidos.
- El owner genera el viaje desde una conversación con ChatGPT.
- El owner administra el itinerario mediante el plugin.
- El owner puede compartir el itinerario mediante una página web.
- La página compartida está pensada, en esta etapa, como read-only para invitados.
- Cuando el owner modifica el viaje, los invitados pueden ver la versión actualizada en la página compartida.
- La edición por colaboradores está prevista para una fase futura, no para el challenge.
- WebMCP todavía debe conectarse a la experiencia para completar la propuesta del challenge.

### Decisiones de producto confirmadas

- Traveler es la primera vertical y debe completarse antes de Business.
- La página compartida no nació para reemplazar el plugin, sino para distribuir el resultado a amigos y familiares.
- El challenge debe aprovechar lo ya construido, no obligar a reconstruir Sendero como una web app completa.
- El caso inmediato de WebMCP debe mejorar la experiencia del invitado.
- El invitado no necesita el plugin cuando utiliza WebMCP desde la página abierta.
- El itinerario canónico no debe cambiar por las consultas o personalizaciones temporales de un viewer.
- Después del challenge, el roadmap debe incorporar cuentas, colaboración y monetización de Traveler.
- Sendero Business será una vertical posterior.
- No habrá publicidad, placements patrocinados ni pago por entrar a un itinerario.
- Sendero Ready se instalará mediante un snippet único y administrado.

## 3. Estado que debe auditarse en código

Estas capacidades son plausibles por el producto descrito, pero no deben marcarse como implementadas sin evidencia:

### Repositorios y despliegue

- ubicación y estructura real de los repositorios;
- si frontend, backend, plugin y landing viven juntos o separados;
- rama y commit desplegados actualmente;
- proveedor de hosting y pipeline de deploy;
- si el repositorio que se presentará puede hacerse público;
- licencia actual y dependencias que permitan open source.

### Plugin y MCP

- listado exacto de tools existentes;
- schemas, annotations y side effects;
- método de autenticación del MCP;
- forma en que se resuelve el owner del viaje;
- IDs estables retornados al modelo;
- herramientas actuales de compartir, leer y modificar;
- UI components existentes dentro de ChatGPT;
- evals y tests de selección de tools.

### API y dominio

- entidad real que representa un viaje;
- persistencia y versionado del itinerario;
- endpoints públicos de shared trips;
- modelo de share token;
- sanitización de datos privados;
- fechas, timezone y estados de items;
- caché y consistencia entre plugin y web;
- estrategia de permisos actual;
- idempotencia y concurrencia en mutaciones.

### Página compartida

- ruta exacta y formato del link;
- si requiere token, slug o ambos;
- qué datos se muestran;
- si existe mapa y cómo se sincroniza con el itinerario;
- estado local disponible: día seleccionado, item activo, bounds del mapa;
- comportamiento en mobile;
- actualización ante cambios del owner;
- SSR, CSR o rendering híbrido;
- analytics existentes;
- privacidad y metadata pública;
- si actualmente existe un store o facade reutilizable por WebMCP.

### Identidad

- si Sendero ya tiene usuarios propios o solo una identidad vinculada al plugin;
- si existe login en web;
- si el share link es anónimo;
- si ya existen participantes, invitados o memberships;
- si el correo u otro identificador se guarda de forma estable.

## 4. Matriz current → challenge → roadmap

| Capacidad | Estado actual | Confianza | Delta challenge | Roadmap posterior |
|---|---|---:|---|---|
| Plugin conversacional | Implementado | Confirmado | Ninguno funcional; solo demostrar origen del viaje | Mejorar discovery, auth y herramientas |
| MCP remoto | Implementado | Confirmado | No duplicar tools en WebMCP | Acceso a viajes desde chats arbitrarios |
| API de viajes | Implementada | Confirmado | Reutilizar proyección shared | Evolucionar permisos, versiones y colaboración |
| Landing | Implementada | Confirmado | Fuera de alcance | Growth y conversión |
| Página compartida | Implementada | Confirmado | Agregar WebMCP y estados de UI necesarios | Personalización, cuentas y colaboración |
| Share read-only | Implementado conceptualmente | Confirmado por owner; auditar código | Mantener canónico read-only | Viewer autenticado y editor futuro |
| Actualización tras cambios del owner | Implementada conceptualmente | Confirmado por owner; auditar mecanismo | Asegurar que tools lean versión actual | Realtime o revalidación mejorada |
| Site tools WebMCP | No implementadas | Confirmado | P0 | Ampliar según rol y contexto |
| Vista personal temporal del invitado | No confirmada | Por auditar | P0: arrival preview y focus visual | Preferencias privadas persistentes |
| Cuentas Traveler | No confirmadas | Por auditar | Fuera de alcance salvo lo ya existente | Biblioteca de viajes y memberships |
| Colaboradores con edición | No implementados | Confirmado como futuro | Fuera de alcance | Invitaciones, roles, edición y auditoría |
| Monetización Traveler | No confirmada | Por auditar | Fuera de alcance | Trip Pass y plan anual |
| Sendero for Hosts | No implementado | Roadmap | Fuera de alcance | V2A |
| Sendero Ready | No implementado | Roadmap | Fuera de alcance | V2B |

## 5. Delta real para The WebMCP Challenge

El challenge no requiere reconstruir el plugin, el API ni la página compartida. El delta debería limitarse a:

1. detectar soporte de WebMCP;
2. registrar site tools en la página compartida;
3. exponer una proyección pública, estructurada y exacta del viaje;
4. permitir que el agente cambie la vista local de la página;
5. implementar una personalización temporal clara para un invitado;
6. asegurar que ninguna acción modifique el viaje del owner;
7. agregar tests, documentación, baseline y evidencia de commits;
8. desplegar una URL reproducible para jueces;
9. preparar video y submission.

### Cambio de experiencia

**Antes**

```text
El invitado abre una página estática y la interpreta manualmente.
Todos ven el mismo itinerario, aunque tengan horarios o restricciones distintas.
```

**Después**

```text
El invitado abre la misma página.
Su agente descubre tools oficiales de Sendero.
Puede preguntar cómo le afecta llegar tarde, qué requiere reserva o dónde reunirse.
La página resalta la respuesta en agenda y mapa.
El plan del owner no cambia.
```

## 6. Gaps prioritarios que probablemente aparecerán

### Gap A — La página muestra datos, pero no posee un facade estructurado

WebMCP no debería leer componentes visuales ni reconstruir el viaje desde el DOM. Debe existir una función como:

```ts
getSharedTripProjection(): SharedTripProjection
```

que utilicen tanto la UI como las site tools.

### Gap B — El mapa y el itinerario no comparten un estado controlable

Las tools necesitan acciones explícitas:

```ts
selectDay(date)
focusItem(itemId)
applyGuestArrivalPreview(input)
clearGuestPreview()
```

Si esos comportamientos hoy están dispersos en componentes, deben extraerse sin rediseñar todo el frontend.

### Gap C — El endpoint público expone demasiado

Antes de devolver datos a una tool read-only, confirmar que la proyección no incluya:

- códigos de reserva;
- notas privadas;
- emails o teléfonos personales;
- identificadores internos innecesarios;
- historial privado;
- preferencias sensibles de participantes.

### Gap D — La versión pública no expresa timezone y semántica

Para responder correctamente a preguntas temporales, cada día e item debe tener:

- fecha ISO;
- hora local o timestamp con offset;
- timezone del viaje;
- tipo de item;
- estado;
- ubicación estructurada;
- indicador de reserva o requirement;
- duración y traslado cuando existan.

### Gap E — El proyecto preexistente no está separado del trabajo del challenge

Debe registrarse un baseline honesto y documentar el delta en `CHALLENGE.md`.

## 7. Protocolo obligatorio de auditoría del repositorio

El primer agente que reciba este paquete debe producir `AS_IS_AUDIT.md` con evidencia concreta.

### 7.1 Inventario

- listar repositorios y paquetes;
- identificar frontend web, landing, API, MCP y shared pages;
- registrar framework, runtime y comandos de desarrollo;
- identificar ambientes y variables necesarias;
- identificar branch y SHA desplegados.

### 7.2 Plugin/MCP

- enumerar todas las tools con path y nombre;
- indicar qué tools leen o escriben;
- identificar autenticación;
- trazar el flujo `ChatGPT → MCP → API → DB`;
- localizar creación y publicación del shared link.

### 7.3 Shared page

- localizar ruta, loader y componentes;
- identificar el endpoint que consume;
- documentar el shape real de la respuesta;
- listar datos privados filtrados;
- localizar estado de mapa y timeline;
- comprobar mobile y loading/error states.

### 7.4 Modelo de datos

- localizar `Trip`, `Itinerary`, items y share links;
- identificar IDs y relaciones;
- documentar visibilidad y permisos actuales;
- comprobar si existe versionado o `updated_at` suficiente para el challenge.

### 7.5 Calidad

- correr tests y build;
- registrar fallos preexistentes;
- localizar analytics y logs;
- evaluar si la demo puede funcionar sin APIs externas frágiles;
- comprobar compatibilidad con HTTPS y secure context.

### 7.6 Comparación

Para cada requisito de `02_webmcp_challenge_product_brief.md`, indicar:

```text
IMPLEMENTADO
PARCIAL
NO IMPLEMENTADO
BLOQUEADO
NO APLICA
```

Cada veredicto debe incluir evidencia por archivo, símbolo, endpoint o prueba.

## 8. Regla de no sobreconstrucción

Durante el challenge no implementar, salvo que ya exista y solo requiera adaptación:

- cuentas completas de Traveler;
- edición web del owner;
- colaboradores;
- invitaciones;
- roles persistentes;
- comentarios;
- realtime multiusuario;
- billing;
- Trip Pass;
- suscripciones;
- hosts;
- business workspaces;
- Sendero Ready;
- snippet B2B;
- SEO/GEO para negocios.

## 9. Definition of Done del análisis

La auditoría se considera completa cuando:

- existe una lista verificable de capacidades actuales;
- se conoce el SHA baseline;
- se conoce la ruta exacta de la página compartida;
- se conoce la proyección pública y sus riesgos de privacidad;
- se conoce dónde registrar y desmontar site tools;
- se conoce cómo controlar agenda y mapa;
- el delta del challenge tiene tickets pequeños;
- no se presentan features antiguas como trabajo nuevo;
- las decisiones futuras quedaron fuera del P0.
