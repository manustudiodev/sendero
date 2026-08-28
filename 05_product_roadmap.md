# Sendero — roadmap de producto e implementación

**Fecha:** 2026-08-28
**Estado:** roadmap secuencial posterior al baseline actual
**Regla:** las fases expresan dependencias y criterios de salida; no constituyen promesas de fecha salvo el challenge

## 1. Punto de partida

Según el estado confirmado por el owner, Sendero ya cuenta con:

- plugin conversacional para ChatGPT;
- servidor MCP;
- API;
- landing;
- páginas compartidas de itinerario;
- flujo owner → creación/edición en ChatGPT → link compartido;
- visualización read-only para invitados.

El repositorio todavía debe auditarse para confirmar el detalle de cada implementación.

## 2. Principio de secuencia

La secuencia aprobada es:

```text
Producto actual
    ↓
Challenge: WebMCP en página compartida
    ↓
Estabilización y aprendizaje
    ↓
Traveler: cuentas y biblioteca
    ↓
Traveler: colaboración
    ↓
Traveler: ejecución y premium
    ↓
Hosts
    ↓
Sendero Ready / Business
```

No adelantar Business para justificar el challenge. No convertir el challenge en una reconstrucción completa de Traveler.

## 3. Horizonte 0 — auditoría y baseline del proyecto

### Objetivo

Conocer exactamente qué está desplegado y proteger la trazabilidad del trabajo nuevo.

### Entregables

- `AS_IS_AUDIT.md` con evidencia por archivo, endpoint y deployment;
- inventario de repositorios;
- listado de tools MCP actuales;
- contrato real del endpoint de shared trip;
- mapa de componentes de la página compartida;
- baseline/tag pre-WebMCP;
- rama del challenge;
- decisión sobre repositorio público y licencia.

### Criterio de salida

No hay afirmaciones importantes marcadas como “implementadas” sin evidencia. Existe una comparación reproducible entre baseline y submission.

## 4. Horizonte 1 — The WebMCP Challenge

**Ventana oficial:** 25 de agosto de 2026, 11:00 PT → 3 de septiembre de 2026, 13:00 PT.
**Cierre en Buenos Aires:** 3 de septiembre de 2026, 17:00.

### Objetivo

Convertir la página shared read-only existente en un companion consultable por el agente de cada invitado, sin plugin y sin alterar el viaje del owner.

### Experiencia P0

Un invitado abre el itinerario y pregunta:

> “Llego el viernes a las 17:30. ¿Qué me pierdo y dónde puedo encontrarme con el grupo?”

Sendero:

1. devuelve el día exacto y el timezone;
2. calcula qué items ya no son alcanzables;
3. determina el primer punto de encuentro viable;
4. resalta la respuesta en timeline y mapa;
5. mantiene intacto el itinerario canónico.

### Alcance

- detección de WebMCP;
- site tools read-only;
- proyección pública segura;
- preview local de llegada;
- focus/sync entre mapa y timeline;
- clear/reset;
- tests y observabilidad mínima;
- documentación del delta;
- live URL;
- repo público con licencia;
- video público menor a tres minutos;
- submission Devpost.

### Fuera de alcance

- cuentas nuevas;
- colaboración persistente;
- edición por invitados;
- billing;
- Live Repair completo;
- Business;
- Sendero Ready;
- búsqueda universal de lugares;
- integraciones de reservas.

### Criterio de salida

La demo funciona de punta a punta en el entorno de WebMCP soportado y cumple el checklist de `10_challenge_submission_checklist.md`.

## 5. Horizonte 2 — estabilización posterior al challenge

### Objetivo

Convertir el prototipo de challenge en una capacidad mantenible de Traveler, independientemente del resultado del concurso.

### Trabajo

- corregir problemas encontrados por usuarios y jueces;
- normalizar facade y contratos de shared trip;
- revisar privacidad de la proyección pública;
- instrumentar eventos de uso;
- mejorar mobile;
- fallback claro para navegadores sin WebMCP;
- documentar compatibilidad y limitaciones;
- evaluar cuáles tools P0 aportan uso real;
- retirar tools o UI que solo servían para la demo;
- añadir preguntas read-only útiles: reservas, accesibilidad, traslados y puntos de encuentro.

### Métricas

- porcentaje de shared pages que cargan correctamente;
- tasa de disponibilidad de tools;
- tool success rate;
- tiempo hasta primera respuesta útil;
- errores de timezone;
- porcentaje de visitantes que usan al menos una tool;
- regreso posterior al itinerary link.

### Criterio de salida

WebMCP es progressive enhancement y no una rama especial difícil de mantener.

## 6. Horizonte 3 — Traveler identity y biblioteca de viajes

### Objetivo

Dar a Sendero una identidad persistente propia y desacoplar definitivamente los viajes de la conversación original.

### Capacidades

- cuenta Sendero;
- login web;
- perfil básico;
- workspace personal;
- biblioteca “Mis viajes”;
- estados upcoming, in progress, completed y archived;
- owner estable del viaje;
- asociación o migración de viajes existentes;
- sesiones y recuperación de cuenta;
- configuración de privacidad;
- administración de share links;
- posibilidad de duplicar un itinerario compartido.

### Pregunta que resuelve

> “¿Dónde vive mi viaje cuando ya no estoy en el chat donde lo creé?”

### Criterio de salida

El owner puede entrar a Sendero desde la web, ver todos sus viajes y administrar sus links sin depender del historial de ChatGPT.

## 7. Horizonte 4 — colaboración Traveler

### Objetivo

Permitir que un viaje pase de ser propiedad operativa de una persona a ser un recurso administrado por un grupo.

### Fase 4A — memberships read-only

- invitaciones;
- roles owner/viewer;
- viaje en “Compartidos conmigo”;
- revocación;
- acceso autenticado desde página;
- preferencias personales separadas.

### Fase 4B — editor

- rol editor;
- edición web;
- tools WebMCP write según rol;
- commands compartidos por UI/MCP/WebMCP;
- optimistic concurrency;
- idempotencia;
- audit log;
- historial y undo acotado.

### Fase 4C — acceso desde chats arbitrarios

- remote MCP con identidad de cuenta;
- `list_accessible_trips`;
- resolución por destino, owner, fechas y rol;
- scopes de lectura/escritura;
- manejo de ambigüedad.

### Criterio de salida

Un editor puede aceptar una invitación, abrir el viaje en la web y modificarlo con WebMCP sin plugin. Opcionalmente, puede conectar Sendero para administrar el mismo viaje desde cualquier chat.

## 8. Horizonte 5 — Traveler execution

### Objetivo

Pasar de planificar a acompañar el viaje mientras ocurre.

### Capacidades candidatas

- vista “Hoy”;
- modo mobile de baja fricción;
- próximos traslados;
- puntos de encuentro;
- reservas y requirements;
- estados de item;
- cambios del owner o colaboradores;
- alertas opt-in;
- acceso offline parcial;
- exportación a calendario y mapas;
- información de última verificación;
- repair localizado ante cierre, clima o demora;
- locks para reservas;
- preview/apply/undo cuando un cambio afecte varias decisiones.

### Dependencias

- modelo de datos temporal correcto;
- versionado;
- roles;
- procedencia/frescura;
- fuentes externas confiables.

### Criterio de salida

Sendero sigue siendo útil durante el viaje y no solo durante la planificación.

## 9. Horizonte 6 — monetización Traveler

### Objetivo

Cobrar en momentos de valor sin degradar la experiencia gratuita ni depender de publicidad.

### Hipótesis a validar

#### Free

- creación y lectura básica;
- compartir;
- WebMCP read-only esencial;
- límites razonables de viajes o uso.

#### Trip Pass — USD 12–15 por viaje

Posibles entitlements:

- colaboración avanzada;
- exports;
- alertas;
- offline;
- verificaciones adicionales;
- replanning durante el viaje;
- mayor historial/versionado.

#### Frequent Traveler — USD 39–49 por año

Posibles entitlements:

- varios viajes activos;
- beneficios del Trip Pass;
- preferencias reutilizables;
- mayor storage e historial;
- prioridad operativa o soporte, sin prometer resultados externos.

### Trabajo previo a cobrar

- eventos de valor;
- costos por viaje;
- límites y entitlements;
- billing propio fuera de superficies donde la política no permita vender;
- refunds y soporte;
- experimentos de willingness to pay.

### Criterio de salida

Existe evidencia de recurrencia o valor episódico suficiente; el precio no se decide solo por comparación competitiva.

## 10. Horizonte 7 — Sendero for Hosts

### Objetivo

Permitir que alojamientos y anfitriones creen una experiencia personalizada para huéspedes usando el mismo núcleo de viaje.

### MVP

- workspace Host;
- propiedad/alojamiento;
- información de check-in/check-out;
- guía y recomendaciones propias;
- plantilla por estadía;
- link privado para huésped;
- preferencias básicas;
- itinerary around accommodation;
- branding ligero;
- analítica básica.

### Distribución

El host incorpora al huésped a Sendero. El huésped puede conservar su cuenta y continuar como Traveler.

### Monetización candidata

- pago por propiedad;
- pago por estadía activa;
- plan para portfolios;
- setup o onboarding para operadores.

### Criterio de salida

Un host reduce trabajo repetitivo y un huésped recibe un companion útil sin que Sendero se convierta en una guidebook estática.

## 11. Horizonte 8 — Sendero Ready

### Objetivo

Ayudar a restaurantes, bares, eventos, talleres, experiencias y alojamientos a mantener una presencia estructurada, verificable y accionable para buscadores, motores generativos, agentes y Sendero.

### MVP

- business workspace;
- URL scanner;
- clasificación vertical asistida por IA;
- extracción de datos existentes;
- entrevista adaptativa;
- ficha canónica;
- revisión y aprobación;
- snippet único administrado;
- datos estructurados;
- herramientas WebMCP read-only;
- perfil en índice de Sendero;
- verificación de dominio;
- estado de frescura;
- sello Sendero Ready.

### Regla

El business paga por infraestructura, configuración, actualización y verificación. Nunca paga por prioridad orgánica ni por entrar a un itinerario.

### Criterio de salida

El producto produce datos más confiables para el business y para Traveler, sin realizar promesas falsas de ranking o aparición en respuestas de terceros.

## 12. Dependencias entre horizontes

```text
Shared page estable
    ├── WebMCP challenge
    └── Traveler identity
             ↓
        Memberships
             ↓
     Collaboration + versioning
             ↓
       Traveler execution
             ↓
      Traveler monetization
             ↓
       Hosts / Business

Canonical places + provenance
             ↓
        Sendero Ready
             ↓
 Mejores datos para Traveler y Hosts
```

## 13. Roadmap de capacidades transversales

### Seguridad

- proyección pública mínima;
- token hashing y rotación;
- autorización server-side;
- rate limiting;
- prompt-injection tests;
- scopes;
- auditoría.

### Calidad de datos

- timezone explícito;
- IDs estables;
- procedencia;
- freshness;
- status de eventos;
- deduplicación de lugares.

### Plataforma

- commands/queries compartidos;
- versionado;
- idempotencia;
- feature flags;
- observabilidad;
- evals de tools.

### Growth

- CTA desde itinerarios compartidos;
- duplicar/adaptar;
- loop invitados → cuenta;
- contenido público útil;
- hosts como canal B2B2C.

## 14. Métricas por etapa

| Etapa | Métrica principal | Señales secundarias |
|---|---|---|
| Challenge | demo completa y reproducible | tool success, cero mutación canónica |
| Shared Companion | utilidad para invitados | preguntas por visita, regreso al link |
| Identity | viajes recuperados fuera del chat | activación de biblioteca, links gestionados |
| Collaboration | grupos activos | invitaciones aceptadas, ediciones, conflictos |
| Execution | uso durante el viaje | sesiones diarias, acciones útiles, alertas |
| Monetization | ingreso por viaje/usuario | conversión, retención, margen, refunds |
| Hosts | propiedades activas | estadías, huéspedes activados, tiempo ahorrado |
| Ready | perfiles frescos y útiles | snippet activo, validaciones, consultas, renovaciones |

## 15. Reglas de priorización

1. Primero corregir problemas que afecten la fuente de verdad o la privacidad.
2. Después, completar el flujo principal de una audiencia.
3. Evitar features que solo demuestren IA sin resolver una necesidad real.
4. No duplicar lógica entre plugin, web y WebMCP.
5. Cada fase debe poder medir un comportamiento antes de iniciar la siguiente.
6. Mantener Business detrás de una frontera clara hasta que Traveler tenga una base operativa estable.
7. Una hipótesis comercial no se transforma en arquitectura irreversible antes de validarse.

## 16. Próxima decisión después del challenge

La primera decisión no será “qué feature grande construir”. Será revisar:

- qué preguntas hicieron realmente los invitados;
- qué tools usaron;
- qué información faltó;
- si la página compartida generó cuentas o intención;
- qué parte del modelo actual impide memberships;
- cuánto trabajo requiere una identidad propia consistente.

Con esa evidencia, el siguiente milestone recomendado es **Traveler Identity + Trip Library**, seguido por colaboración.
