# Sendero — registro de decisiones

**Fecha:** 2026-08-28
**Estado:** referencia normativa
**Convención:** una decisión `superseded` no debe implementarse salvo que se reabra explícitamente

## ADR-001 — El viaje es un recurso de Sendero, no del chat

**Estado:** aceptada
**Decisión:** cada viaje posee un ID estable y estado persistente independiente de la conversación donde nació.
**Razón:** compartir, recuperar, colaborar, versionar y monetizar requieren continuidad fuera del historial de ChatGPT.
**Consecuencia:** ChatGPT y la web son clientes del mismo backend.

## ADR-002 — El backend es la fuente de verdad

**Estado:** aceptada
**Decisión:** permisos, itinerario canónico, versiones y membresías viven en Sendero.
**Razón:** el modelo y la UI no son autoridades consistentes.
**Consecuencia:** toda mutación termina en validación y persistencia server-side.

## ADR-003 — Plugin/MCP y WebMCP son complementarios

**Estado:** aceptada
**Decisión:** el MCP remoto sirve para capacidades independientes de una página; WebMCP para trabajar con la página viva y su sesión.
**Razón:** resuelven contextos distintos.
**Consecuencia:** comparten application services, pero no se duplican tools sin valor contextual.

## ADR-004 — Una persona en la página no necesita instalar el plugin

**Estado:** aceptada; corrige afirmación anterior
**Decisión:** un viewer o colaborador puede usar las site tools de una página Sendero sin conectar el MCP remoto.
**Razón:** WebMCP permite que el agente descubra tools cuando visita la página.
**Consecuencia:** la colaboración web puede existir antes del acceso global desde chats arbitrarios.

## ADR-005 — El MCP remoto es opcional para colaboración y útil para acceso global

**Estado:** aceptada
**Decisión:** conectar Sendero a ChatGPT será necesario únicamente cuando el usuario quiera listar o administrar recursos privados desde una conversación sin abrir la página correspondiente.
**Razón:** en ese contexto no existe page-scoped state ni site tools.
**Consecuencia:** no bloquear invitaciones ni edición web detrás de instalación del plugin.

## ADR-006 — El challenge se centra en el invitado de una página compartida

**Estado:** aceptada
**Decisión:** la propuesta es `Sendero Shared Trip Companion`, no un workspace completo del owner.
**Razón:** aprovecha la página compartida ya planificada e implementada y produce un before/after claro.
**Consecuencia:** P0 es read-only canónico con personalización local.

## ADR-007 — Live Repair no es el alcance inmediato del challenge

**Estado:** superseded para P0; permanece en roadmap
**Decisión anterior:** construir reparación persistente, locks, preview/apply y undo como demo principal.
**Razón de supersesión:** gran parte puede hacerse con el MCP existente y expande demasiado el producto.
**Consecuencia:** Live Repair pasa a Traveler Execution posterior.

## ADR-008 — El challenge no muta el itinerario canónico

**Estado:** aceptada
**Decisión:** las tools P0 leen el viaje y modifican únicamente el estado visual/local del invitado.
**Razón:** protege al owner, reduce permisos y hace viable el plazo.
**Consecuencia:** no se requieren memberships ni versioning completo para la submission.

## ADR-009 — La llegada tardía es el escenario principal de demo

**Estado:** aceptada
**Decisión:** demostrar cómo un invitado descubre qué se pierde y dónde reunirse con el grupo.
**Razón:** problema específico, entendible y ligado a una página compartida.
**Consecuencia:** las tools y la UI deben optimizar este recorrido antes de agregar más casos.

## ADR-010 — La página normal debe funcionar sin WebMCP

**Estado:** aceptada
**Decisión:** WebMCP es progressive enhancement.
**Razón:** compatibilidad, accesibilidad y resiliencia.
**Consecuencia:** no esconder información esencial detrás de site tools.

## ADR-011 — UI y site tools usan una facade común

**Estado:** aceptada
**Decisión:** WebMCP no lee el DOM para reconstruir el viaje.
**Razón:** fragilidad, semántica y testabilidad.
**Consecuencia:** extraer `SharedTripFacade` o equivalente sobre el estado real de la app.

## ADR-012 — La proyección shared es una frontera explícita

**Estado:** aceptada
**Decisión:** shared page y WebMCP consumen una proyección allowlisted, no el agregado privado.
**Razón:** privacidad y estabilidad de contrato.
**Consecuencia:** códigos de reserva, contactos y notas privadas quedan excluidos.

## ADR-013 — Share link no equivale a membership

**Estado:** aceptada
**Decisión:** links, invitations y memberships son entidades separadas.
**Razón:** ver una página no debe otorgar rol persistente.
**Consecuencia:** la colaboración futura requiere aceptación y usuario estable.

## ADR-014 — Roles legibles, capabilities autoritativas

**Estado:** aceptada
**Decisión:** owner/editor/viewer simplifican UX; el backend valida capacidades atómicas.
**Razón:** evitar que editor implique administrar miembros o eliminar viajes.
**Consecuencia:** tool registration y endpoints se basan en capabilities.

## ADR-015 — WebMCP registra tools según la sesión y el rol

**Estado:** aceptada para colaboración futura
**Decisión:** un viewer recibe read tools; un editor autenticado puede recibir write tools.
**Razón:** minimizar exposición y hacer affordances coherentes.
**Consecuencia:** el registro del cliente no sustituye autorización server-side.

## ADR-016 — Todas las mutaciones futuras usan versioning e idempotencia

**Estado:** aceptada
**Decisión:** expected version + idempotency key para writes multi-superficie.
**Razón:** colaboración y agentes pueden repetir o competir.
**Consecuencia:** conflictos se devuelven explícitamente; no sobrescritura silenciosa.

## ADR-017 — Traveler se completa antes de Business

**Estado:** aceptada
**Decisión:** challenge, identity, collaboration y base premium preceden Host/Ready.
**Razón:** Business depende del núcleo de trips, usuarios y demanda.
**Consecuencia:** no mezclar wizard/snippet business con P0.

## ADR-018 — Sendero tendrá una identidad propia

**Estado:** aceptada como roadmap
**Decisión:** cuenta y biblioteca web de viajes.
**Razón:** los usuarios deben recuperar y administrar viajes fuera del chat.
**Consecuencia:** migración de ownership y sessions será un milestone dedicado.

## ADR-019 — Una cuenta puede participar en varios workspaces

**Estado:** aceptada
**Decisión:** personal, host, business y organization son workspaces, no tipos irreversibles de usuario.
**Razón:** una persona puede ser viajero, host y dueño de un negocio.
**Consecuencia:** memberships y billing pertenecen al workspace.

## ADR-020 — No habrá publicidad ni recomendaciones patrocinadas

**Estado:** aceptada
**Decisión:** negocios no pueden comprar presencia dentro de itinerarios ni ranking orgánico.
**Razón:** confianza, políticas de plataforma y alineación de producto.
**Consecuencia:** monetización business se basa en infraestructura y operación.

## ADR-021 — Sendero Ready usa un único snippet administrado

**Estado:** aceptada
**Decisión:** no habrá paquete descargable en el MVP.
**Razón:** el buyer es un business, no un desarrollador; las actualizaciones deben gestionarse centralmente.
**Consecuencia:** loader pequeño + configuración alojada + panel.

## ADR-022 — El snippet no activa SEO ni GEO

**Estado:** aceptada
**Decisión:** la UI comunica estados concretos: schema válido, WebMCP activo, dominio verificado, datos frescos, acciones pendientes.
**Razón:** indexación y ranking dependen de terceros.
**Consecuencia:** prohibido marketing como “GEO ON” o “garantizado en ChatGPT”.

## ADR-023 — WebMCP no es discovery ni scraping

**Estado:** aceptada
**Decisión:** WebMCP expone operaciones oficiales después de que el agente visita la página.
**Razón:** no indexa ni encuentra sitios por sí solo.
**Consecuencia:** SEO/GEO, crawlers, índice de Sendero y WebMCP permanecen como capas separadas.

## ADR-024 — Sendero Ready certifica condiciones, no calidad

**Estado:** aceptada
**Decisión:** el sello indica qué se verificó y cuándo. No dice “recomendado”.
**Razón:** transparencia y ausencia de conflicto editorial.
**Consecuencia:** vigencia, alcance y página de verificación pública.

## ADR-025 — Tools business read-only primero

**Estado:** aceptada
**Decisión:** datos, horarios, eventos y booking options antes de transacciones.
**Razón:** compras/reservas introducen consentimiento, seguridad y reconciliación.
**Consecuencia:** writes requieren una fase y threat model propios.

## ADR-026 — Precios son hipótesis

**Estado:** aceptada
**Decisión:** Trip Pass USD 12–15, annual USD 39–49 y tiers Ready son rangos de prueba, no contrato de producto.
**Razón:** falta validación de willingness to pay, costos y retención.
**Consecuencia:** la arquitectura usa entitlements configurables, no hardcode de paquetes.

## ADR-027 — El repositorio se audita antes de planificar migraciones

**Estado:** aceptada
**Decisión:** producir `AS_IS_AUDIT.md` y comparar evidencia con target.
**Razón:** la documentación previa mezcló visión con estado implementado.
**Consecuencia:** ningún agente debe inventar rutas, entidades o carencias.

## ADR-028 — El proyecto preexistente debe tener baseline verificable

**Estado:** aceptada y urgente
**Decisión:** identificar commit/tag pre-WebMCP y documentar el delta del challenge.
**Razón:** las reglas evalúan solo trabajo nuevo en proyectos preexistentes.
**Consecuencia:** no reescribir historia ni atribuir trabajo anterior al período.

## ADR-029 — La submission debe poder abrirse públicamente

**Estado:** aceptada y urgente
**Decisión:** live URL, repo público, licencia open source, instrucciones y video reproducible.
**Razón:** requisitos del challenge.
**Consecuencia:** separar secretos/código propietario si el repo actual no puede publicarse completo.

## ADR-030 — No congelar el producto alrededor de WebMCP

**Estado:** aceptada
**Decisión:** el resultado del challenge debe quedar como una mejora mantenible, no como arquitectura central exclusiva.
**Razón:** estándar y disponibilidad todavía evolucionan.
**Consecuencia:** adapters finos, feature detection, fallback y contracts propios de Sendero.

## ADR-031 — Shared Trip Companion será una superficie de adquisición

**Estado:** aceptada como hipótesis
**Decisión:** los links compartidos pueden ofrecer CTA para crear, duplicar o adaptar un viaje.
**Razón:** cada invitado ya recibe valor antes de conocer el producto.
**Consecuencia:** medir conversión sin interrumpir la consulta del itinerary.

## ADR-032 — Las preferencias personales no modifican el viaje del grupo

**Estado:** aceptada
**Decisión:** arrival, dieta o movilidad de un viewer viven primero como overlay local/personal.
**Razón:** una necesidad individual no debe sobrescribir el plan canónico.
**Consecuencia:** una propuesta al grupo será una acción explícita futura.

## ADR-033 — Agent activity debe ser atribuible

**Estado:** aceptada para writes futuros
**Decisión:** audit events registran actor humano, superficie, tool/command y versión.
**Razón:** confianza, conflictos y undo.
**Consecuencia:** no almacenar prompts sensibles completos por defecto.

## ADR-034 — Places/events requieren procedencia y frescura

**Estado:** aceptada como arquitectura futura
**Decisión:** hechos temporales guardan fuente, observación, status y vigencia.
**Razón:** itinerarios fallan cuando horarios/eventos envejecen.
**Consecuencia:** canonical entity se separa de observations.

## ADR-035 — Los documentos del 28 de agosto sustituyen el alcance anterior del challenge

**Estado:** aceptada
**Decisión:** para challenge, usar `02_webmcp_challenge_product_brief.md` y `03_webmcp_shared_page_technical_spec.md` de este paquete.
**Razón:** reflejan el estado real confirmado y la corrección sobre invitados sin plugin.
**Consecuencia:** ignorar P0 anterior de Live Repair, locks y undo salvo como roadmap.
