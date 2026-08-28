# Sendero — checklist de entrega para The WebMCP Challenge

**Última verificación:** 2026-08-28
**Fuente normativa:** reglas oficiales de Devpost
**Deadline:** 3 de septiembre de 2026, 13:00 Pacific Time / 17:00 America/Argentina/Buenos_Aires

> Las reglas oficiales y cualquier actualización de Devpost prevalecen sobre este documento.

## 1. Definición de la submission

**Nombre de trabajo:** Sendero Shared Trip Companion
**Tagline:** A shared itinerary every guest can explore with their own AI agent.

### Demo principal

Un invitado abre un itinerary compartido, informa que llega tarde y su agente:

1. consulta el contexto exacto del viaje;
2. identifica qué actividades se perderá;
3. determina un punto de encuentro viable;
4. resalta los resultados en timeline y mapa;
5. no modifica el itinerario del owner.

## 2. Elegibilidad y registro

- [ ] Registro completado en Devpost antes del cierre.
- [ ] Perfil del participante usa información real.
- [ ] Residencia y elegibilidad revisadas contra las reglas actuales.
- [ ] Si participa un equipo, representante y miembros están definidos.
- [ ] Derechos sobre código, diseño, assets y datos confirmados.
- [ ] Uso de terceros cumple licencias y términos.

## 3. Evidencia de proyecto preexistente

Las reglas permiten proyectos existentes si fueron extendidos significativamente con WebMCP durante el período y se distingue el trabajo previo del nuevo.

- [ ] Último commit representativo anterior al trabajo WebMCP identificado.
- [ ] Baseline SHA documentado.
- [ ] Tag opcional `sendero-pre-webmcp` creado sin reescribir historia.
- [ ] `CHALLENGE.md` describe capacidades preexistentes.
- [ ] `CHALLENGE.md` enumera exclusivamente el delta nuevo.
- [ ] Commits de WebMCP fechados dentro del período.
- [ ] Compare base…head disponible.
- [ ] No se atribuye al challenge trabajo anterior.
- [ ] No se falsearon timestamps ni se hizo rebase destructivo.
- [ ] Capturas/deploys anteriores se guardaron como evidencia complementaria cuando existan.

### Commits sugeridos

```text
chore(challenge): document pre-WebMCP baseline
feat(shared-trip): add safe public trip projection
refactor(shared-trip): expose page facade for agent tools
feat(webmcp): register shared trip context tools
feat(webmcp): add guest arrival preview
feat(webmcp): synchronize itinerary and map focus
test(webmcp): cover shared companion flow
docs(challenge): add setup, architecture and submission notes
```

No crear commits artificiales por apariencia. Separar cambios según unidades reales de trabajo.

## 4. Alcance funcional P0

### Página

- [ ] Shared page abre mediante una URL accesible.
- [ ] Funciona normalmente sin WebMCP.
- [ ] Muestra itinerary y mapa o la visualización definida.
- [ ] Carga la versión actual del owner.
- [ ] Responsive en la resolución usada para demo.
- [ ] Estados loading, error y link inválido son claros.

### Tools

- [ ] `get_shared_trip_context`
- [ ] `get_day_itinerary`
- [ ] `preview_guest_arrival`
- [ ] `show_day_on_map`
- [ ] `focus_itinerary_item`
- [ ] `clear_guest_preview`

### Contratos

- [ ] Tools registradas mediante `document.modelContext.registerTool` en la top-level page.
- [ ] Feature detection implementado.
- [ ] Nombres y descriptions son precisos.
- [ ] Inputs usan schemas estrechos.
- [ ] Outputs permiten verificar el resultado.
- [ ] Read-only semantics expresadas donde la API lo permita.
- [ ] Lifecycle y cleanup funcionan al cambiar página/trip.

### Personalización del invitado

- [ ] Hora de llegada se interpreta en timezone correcto.
- [ ] Items perdidos se identifican de forma reproducible.
- [ ] Punto de encuentro usa un criterio documentado.
- [ ] Timeline cambia visualmente.
- [ ] Mapa enfoca el resultado.
- [ ] Clear restaura la vista.
- [ ] Refresh confirma que el viaje canónico no cambió.

## 5. Privacidad y seguridad

- [ ] La proyección pública usa allowlist.
- [ ] No expone códigos de reserva.
- [ ] No expone emails/teléfonos de participantes.
- [ ] No expone notas privadas.
- [ ] No expone tokens o IDs sensibles.
- [ ] Share token no aparece en logs o analytics.
- [ ] Inputs de tool son validados.
- [ ] Contenido del itinerary se trata como untrusted data.
- [ ] Prompt injection básica probada.
- [ ] Rate limits o protecciones existentes revisadas.
- [ ] No hay endpoints de mutación en el flujo P0.

## 6. Calidad técnica

- [ ] Build de producción pasa.
- [ ] Typecheck pasa.
- [ ] Lint pasa o fallos preexistentes están documentados.
- [ ] Tests unitarios del arrival preview pasan.
- [ ] Tests de timezone pasan.
- [ ] Contract tests de tools pasan.
- [ ] Integration test projection → facade → UI pasa.
- [ ] E2E principal pasa contra deployment.
- [ ] Fallback sin WebMCP se probó.
- [ ] Errores observables tienen request ID o señal equivalente.

## 7. Prueba en entornos de jueces

La página debe poder probarse en:

- ChatGPT in-app browser con Site tools disponibles; o
- Google Chrome compatible con WebMCP testing habilitado según la guía vigente.

Checklist:

- [ ] Desktop app/browser actualizado.
- [ ] Modelo/modo compatible seleccionado según documentación vigente.
- [ ] Site tools aparecen como disponibles.
- [ ] Cada tool puede inspeccionarse.
- [ ] Main prompt invoca las tools correctas.
- [ ] No depende de una sesión local privada no entregada.
- [ ] Si hay autenticación, credenciales de juez están en el submission form.
- [ ] HTTPS y secure context funcionan.
- [ ] No hay dependencia de localhost.

## 8. Live URL

- [ ] URL pública estable.
- [ ] Deployment corresponde al SHA de submission.
- [ ] No requiere VPN.
- [ ] No depende de IP allowlist personal.
- [ ] CORS/CSP permiten el comportamiento esperado.
- [ ] Datos seed son legales y suficientes.
- [ ] Servicios externos tienen fallback o datos controlados.
- [ ] Health check final ejecutado desde sesión limpia.
- [ ] Link probado por otra persona o perfil de navegador limpio.

## 9. Repositorio público

Las reglas exigen una URL a un repositorio público con código, assets e instrucciones suficientes y una licencia open source visible.

- [ ] Repo público en GitHub, GitLab o Bitbucket.
- [ ] LICENSE incluida.
- [ ] Licencia detectada/visible en la página del repo.
- [ ] README con descripción.
- [ ] Requisitos y versiones.
- [ ] Instalación local.
- [ ] Variables de entorno documentadas sin valores secretos.
- [ ] Comandos de dev/build/test.
- [ ] Instrucciones para habilitar/probar WebMCP.
- [ ] Arquitectura breve.
- [ ] `CHALLENGE.md`.
- [ ] Baseline y compare.
- [ ] Código de `registerTool` visible.
- [ ] No hay claves o datos privados en historia Git.
- [ ] Assets tienen derechos/licencias.
- [ ] El repo reproduce lo mostrado en el video.

## 10. `CHALLENGE.md`

- [ ] Estado del producto antes del 25 de agosto.
- [ ] Baseline commit/tag.
- [ ] Lista de capacidades preexistentes.
- [ ] Lista exacta de capacidades WebMCP nuevas.
- [ ] Paths principales del código nuevo.
- [ ] Diagrama before/after.
- [ ] Instrucción de compare.
- [ ] Limitaciones conocidas.
- [ ] Declaración honesta del alcance.

Usar `14_challenge_md_template.md` como base.

## 11. Video de demo

Las reglas exigen un video público en YouTube, con audio y duración menor a tres minutos.

### Estructura sugerida

**0:00–0:15 — problema**

> Sendero already turns a ChatGPT conversation into a shared itinerary. But every guest sees the same plan even when their arrival or constraints differ.

**0:15–0:30 — estado previo**

- mostrar itinerario generado por el owner;
- abrir link read-only como invitado.

**0:30–1:50 — demo WebMCP**

- mostrar site tools disponibles;
- preguntar por llegada tardía;
- mostrar tool calls/resultados;
- timeline atenúa items perdidos;
- mapa enfoca punto de encuentro;
- consultar un item o día adicional si el tiempo permite.

**1:50–2:20 — garantía**

- limpiar preview;
- refresh;
- demostrar que el canonical itinerary no cambió.

**2:20–2:45 — arquitectura**

- shared projection;
- facade;
- WebMCP tools;
- API existente.

**2:45–2:58 — cierre**

> With WebMCP, a shared itinerary becomes a personal travel companion for every guest—without requiring the Sendero plugin and without changing the group plan.

### Checklist de grabación

- [ ] Menos de 3:00.
- [ ] Audio inteligible.
- [ ] Texto/UI legible.
- [ ] Sin información personal real.
- [ ] Sin copyrighted music no autorizada.
- [ ] Demo real, no solo mockup.
- [ ] No claims de colaboración/editing no implementados.
- [ ] Video público, no unlisted si las reglas exigen public visibility.
- [ ] Link abre sin login del juez.

## 12. Texto de Devpost

Debe explicar explícitamente:

- [ ] por qué es buen fit para WebMCP;
- [ ] cómo mejora la experiencia;
- [ ] qué hacen juntos persona y agente que antes era difícil;
- [ ] cómo se implementó WebMCP;
- [ ] qué era preexistente;
- [ ] qué fue nuevo durante el challenge.

### Borrador base

**What it does**

Sendero turns a trip created in ChatGPT into a live shared itinerary. With the Shared Trip Companion, every guest can open that itinerary and use their own AI agent to understand how the group plan applies to them.

**Why WebMCP**

The itinerary page exposes structured, page-scoped tools for reading the exact trip, selecting a day, focusing the map, and previewing a guest's late arrival. The agent and the guest work with the same live timeline and map without requiring a separate Sendero plugin connection.

**What becomes possible**

A guest can say, “I arrive at 5:30 PM—what will I miss, and where can I meet everyone?” Sendero highlights missed activities, identifies the first viable meeting point, and focuses the map while leaving the owner's itinerary unchanged.

**What was added during the challenge**

WebMCP site tools, a safe shared-trip projection, a page application facade, guest arrival preview, synchronized map/timeline actions, tests, and challenge documentation were added to the pre-existing Sendero plugin and shared itinerary experience.

Adaptar solo a lo efectivamente construido.

## 13. Mapeo a judging criteria

### WebMCP Leverage

- [ ] Site tools reales, no browser automation disfrazada.
- [ ] Contexto de página y UI compartidos.
- [ ] Varias tools coherentes.
- [ ] Resultados verificables.
- [ ] Implementación no trivial.

### Execution

- [ ] Flujo completo.
- [ ] Diseño coherente.
- [ ] Errores y loading.
- [ ] URL reproducible.
- [ ] README y tests.

### Potential Impact

- [ ] Audiencia real: invitados de un viaje.
- [ ] Problema específico: el plan compartido no contempla circunstancias individuales.
- [ ] Solución demuestra valor dentro del producto.
- [ ] Roadmap hacia colaboración sin prometerla en P0.

### Creativity & Ambition

- [ ] No es solo un planner editable.
- [ ] Cada invitado recibe una proyección personal temporal.
- [ ] No requiere instalar plugin.
- [ ] Conserva el plan canónico del grupo.
- [ ] Combina agente, timeline y mapa.

## 14. Entrega y freeze

- [ ] Submission draft creado antes de último momento.
- [ ] Todos los campos completos.
- [ ] Live URL final.
- [ ] Repo URL final.
- [ ] Video URL final.
- [ ] Screenshots correctos.
- [ ] Descripción revisada.
- [ ] Submission enviada antes de las 17:00 de Buenos Aires del 3 de septiembre.
- [ ] Confirmación de Devpost guardada.
- [ ] Tag final creado.
- [ ] SHA final registrado.
- [ ] Deployment y materiales de submission no se modifican después del cierre salvo permiso expreso de las reglas/organizador.
- [ ] Desarrollo posterior continúa en otra branch/fork si hace falta preservar la submission.

## 15. Go / no-go final

Enviar solo si:

- [ ] el judge puede abrir la página;
- [ ] WebMCP tools aparecen;
- [ ] el prompt principal funciona repetidamente;
- [ ] la UI cambia de forma visible;
- [ ] el itinerary del owner permanece intacto;
- [ ] el código nuevo se distingue del baseline;
- [ ] repo, licencia, video y descripción cumplen;
- [ ] no se exponen secretos o datos personales;
- [ ] todas las afirmaciones del submission pueden demostrarse.

Las capacidades secundarias que pongan en riesgo este núcleo deben eliminarse antes de entregar.
