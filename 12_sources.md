# Sendero — fuentes y referencias

**Última revisión:** 2026-08-28
**Nota:** estándares, compatibilidad, políticas y reglas pueden cambiar. Verificar nuevamente antes de implementar o enviar la submission.

## 1. WebMCP / Site tools de OpenAI

### Site tools

https://developers.openai.com/codex/webmcp

Respalda:

- Site tools es la implementación de WebMCP en ChatGPT.
- La página y el agente trabajan con la misma página viva y sesión autenticada.
- El agente descubre las tools cuando visita la página.
- No se requiere instalar un MCP separado para usar capacidades expuestas por esa página.
- MCP remoto puede funcionar sin una página abierta.
- Una web puede soportar ambos.
- Las tools pertenecen a la página y pueden desaparecer al navegar.
- Actualmente deben registrarse mediante JavaScript en la top-level page para el browser integrado documentado.
- Recomendación de reutilizar autenticación, autorización, validación y lógica existente.

### OpenAI plugin authentication

https://developers.openai.com/plugins/build/auth

Respalda, para una fase futura:

- OAuth/PKCE y tokens para acceder a recursos privados mediante un MCP remoto.
- La necesidad de autenticar explícitamente cuando se opera desde un chat sin una página/session de Sendero.

### OpenAI plugin development

https://developers.openai.com/plugins/build/mcp-server

https://developers.openai.com/plugins/deploy/connect-chatgpt

Respalda:

- MCP como server adapter de capacidades live/controladas.
- tool definitions y testing de selección.
- conexión y refresh de metadata.

## 2. WebMCP standard y Chrome

### Specification / proposal

https://webmachinelearning.github.io/webmcp/

https://github.com/webmachinelearning/webmcp

Respalda:

- WebMCP como interfaz para que páginas expongan funcionalidad a agentes.
- registro de tools;
- schemas;
- lifecycle;
- annotations;
- evolución del estándar.

### Chrome WebMCP documentation

https://developer.chrome.com/docs/ai/webmcp

Respalda:

- implementación y pruebas en Chrome;
- herramientas programáticas/declarativas según soporte;
- integración con aplicaciones web.

### Security guidance

https://developer.chrome.com/docs/ai/webmcp/security

Respalda:

- trust boundaries;
- prompt injection;
- tool metadata y outputs como contenido no confiable;
- controles para tools read/write.

### Evals/debugging

https://developer.chrome.com/docs/ai/webmcp/evals

https://developer.chrome.com/docs/ai/webmcp/debug

Respalda:

- evaluación y debugging de tools antes de publicar.

La ruta exacta de las guías puede cambiar; consultar el Resources tab del challenge si un enlace redirige.

## 3. The WebMCP Challenge

### Overview

https://webmcp.devpost.com/

Respalda:

- objetivo del challenge;
- build/deploy/test;
- working live URL;
- descripción;
- video;
- repositorio público y licencia.

### Official Rules

https://webmcp.devpost.com/rules

Es la fuente normativa para:

- submission period: 25 de agosto de 2026, 11:00 PT a 3 de septiembre de 2026, 13:00 PT;
- proyectos nuevos o preexistentes;
- extensión significativa con WebMCP;
- evidencia mediante commits fechados o equivalente;
- evaluación solo del trabajo nuevo en proyectos preexistentes;
- live URL;
- repo público;
- licencia open source visible;
- video público en YouTube menor a tres minutos y con audio;
- criterios de judging;
- restricciones después del cierre.

### Resources

https://webmcp.devpost.com/resources

Respalda:

- instrucciones de testing;
- links a spec, Chrome docs, security, evals y ejemplos;
- recursos de supporters.

## 4. SEO, GEO y AI search

### Google — optimizing for generative AI

https://developers.google.com/search/docs/fundamentals/ai-optimization-guide

Respalda:

- AEO/GEO como términos de industria;
- desde la perspectiva de Google, optimizar para generative AI search sigue siendo SEO;
- fundamentos de contenido y búsqueda;
- cautela con promesas de terceros.

### Google — AI features and your website

https://developers.google.com/search/docs/appearance/ai-features

Respalda:

- no existen requisitos técnicos adicionales especiales para aparecer en AI Overviews/AI Mode;
- la página debe ser indexada y elegible en Search;
- crawling/indexing/serving no están garantizados;
- structured data debe coincidir con contenido visible;
- query fan-out y supporting links.

### Google — third-party SEO tools

https://developers.google.com/search/docs/fundamentals/third-party-seo

Respalda:

- cautela ante servicios que prometen rankings o mejoras GEO/AEO;
- usar una herramienta no garantiza éxito.

### Google — JavaScript SEO

https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics

Respalda:

- capacidades y limitaciones del rendering JavaScript;
- razón por la que un snippet no resuelve toda la indexación.

### Google structured data

https://developers.google.com/search/docs/appearance/structured-data/local-business

https://developers.google.com/search/docs/appearance/structured-data/event

https://developers.google.com/search/docs/appearance/structured-data/sd-policies

Respalda:

- modelos LocalBusiness/Event;
- propiedades;
- validación;
- coherencia con contenido visible;
- ausencia de garantía de rich result.

## 5. OpenAI crawling/search

### OpenAI crawlers

https://developers.openai.com/api/docs/bots

Respalda:

- `OAI-SearchBot` se utiliza para mostrar sitios en respuestas de búsqueda de ChatGPT;
- es distinto de otros crawlers y controles;
- permitir crawling no garantiza recomendación ni ranking.

## 6. Fuentes de mercado e hipótesis de precios

Los rangos de precios del brief son hipótesis, no conclusiones normativas. Antes de cobrar, realizar:

- entrevistas;
- análisis de costos de IA/infraestructura;
- experimentos de willingness to pay;
- pruebas por viaje vs suscripción;
- cohortes de retención;
- comparación con productos vigentes.

No basar una decisión final solo en referencias de 2026 porque precios y planes cambian con frecuencia.

## 7. Fuentes internas de este paquete

Las decisiones derivan de:

- hechos confirmados por Manuel Pacheco en la conversación;
- documentos Sendero generados el 26 de agosto de 2026;
- correcciones posteriores sobre el alcance del challenge;
- aclaración de que la landing y shared pages ya están implementadas;
- decisión de priorizar Traveler antes de Business;
- descarte de publicidad y placements patrocinados;
- decisión de un snippet único para Sendero Ready.

No se pudo inspeccionar el repositorio real de Sendero desde la conexión de GitHub disponible al crear el paquete. Por eso el estado técnico permanece sujeto a `AS_IS_AUDIT.md`.
