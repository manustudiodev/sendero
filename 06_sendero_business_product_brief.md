# Sendero Business — product brief

**Fecha:** 2026-08-28
**Estado:** visión V2; no forma parte del challenge ni del alcance inmediato de Traveler
**Productos:** Sendero for Hosts y Sendero Ready

## 1. Resumen ejecutivo

Sendero Business es la vertical orientada a organizaciones y negocios que participan en la experiencia de un viaje.

No es una campaña publicitaria ni un marketplace de placements. Su propósito es ayudar a dos grupos:

1. **Hosts y alojamientos**, que quieren brindar información e itinerarios personalizados a huéspedes.
2. **Lugares, eventos y experiencias**, que necesitan mantener datos correctos, estructurados y utilizables por buscadores, motores generativos, agentes compatibles y el índice de Sendero.

La vertical se construye después de consolidar Sendero Traveler porque depende de:

- identidad;
- trips persistentes;
- shared pages;
- permisos;
- lugares/eventos canónicos;
- métricas de demanda;
- una API estable.

## 2. Tesis

La generación de una recomendación es fácil. Mantener una experiencia operativa correcta requiere:

- información actualizada;
- identidad de entidades;
- fechas y horarios;
- procedencia;
- permisos;
- integración;
- seguimiento;
- contexto del viajero.

Sendero Business conecta la oferta local con el viaje sin vender prioridad editorial.

```text
Traveler y grupos
    necesitan planes útiles y datos correctos
                  ↕
               Sendero
    conserva contexto, estado y confianza
                  ↕
Hosts, lugares y eventos
    mantienen información y capacidades
```

## 3. Modelo de cuenta y workspaces

Una persona debe tener una sola identidad y varios contextos de trabajo.

```text
Manuel Pacheco
├── Personal
│   └── Mis viajes
├── Host · Departamento Palermo
│   └── Propiedades y estadías
└── Business · Taller de cerámica
    └── Perfil, sitio y agent readiness
```

No convertir al usuario en un tipo irreversible `traveler` o `business`. La facturación, miembros y recursos pertenecen al workspace.

### Tipos de workspace

```text
personal
host
business
organization
```

### Roles business iniciales

```text
owner
admin
editor
analyst
viewer
```

## 4. Producto A — Sendero for Hosts

### 4.1 Audiencia

- hosts de Airbnb y alquiler temporario;
- pequeños administradores de propiedades;
- hostels;
- hoteles boutique;
- aparthoteles;
- empresas de relocation;
- alojamientos que hoy envían PDFs, mensajes o guidebooks estáticas.

### 4.2 Problema

El host responde repetidamente:

- cómo llegar;
- dónde comer;
- qué hacer cerca;
- qué abre según el día;
- qué hacer si llueve;
- dónde comprar o resolver necesidades prácticas;
- qué conviene para esa familia o grupo;
- cómo aprovechar una estadía corta.

Las respuestas suelen estar dispersas y no se adaptan a fechas, duración, movilidad, presupuesto o intereses.

### 4.3 Job to be done

> Cuando recibo un huésped, quiero ofrecerle información práctica y un plan local personalizado sin armar manualmente una guía distinta para cada reserva.

### 4.4 Propuesta de valor

- reduce preguntas repetitivas;
- mejora la experiencia antes y durante la estadía;
- combina alojamiento, barrio y viaje;
- personaliza según cada huésped;
- permite actualizar una recomendación una sola vez;
- convierte al huésped en potencial usuario de Traveler.

### 4.5 Experiencia del host

#### Configuración

- crear propiedad;
- dirección/zona;
- check-in y check-out;
- reglas;
- servicios;
- transporte;
- recomendaciones propias;
- información práctica;
- branding ligero;
- contacto y emergencias definidos por el host.

#### Por estadía

- crear estadía o importar datos autorizados;
- generar link privado;
- enviar al huésped;
- recopilar intereses y restricciones;
- generar un itinerario alrededor del alojamiento;
- actualizar información;
- ver señales de uso agregadas.

#### Huésped

- instrucciones de llegada;
- mapa del barrio;
- itinerary day-by-day;
- recomendaciones del host claramente identificadas;
- información de reservas;
- companion con WebMCP;
- continuidad hacia su propia cuenta Traveler.

### 4.6 Monetización candidata

- tarifa mensual por propiedad;
- tarifa por estadía activa;
- tier para portfolios;
- onboarding o setup para operadores;
- servicios de integración para hoteles más grandes.

Los precios requieren entrevistas y pilotos. No heredarlos automáticamente de Traveler.

### 4.7 MVP de Hosts

- un tipo de propiedad;
- configuración manual;
- una plantilla;
- un link por estadía;
- preferencias básicas;
- guía + itinerary;
- branding ligero;
- analytics básicos;
- sin integración directa con marketplaces en P0.

## 5. Producto B — Sendero Ready

### 5.1 Audiencia

- restaurantes;
- bares;
- eventos y productores;
- talleres y clases;
- experiencias turísticas;
- museos y galerías;
- espacios culturales;
- hoteles y alojamientos;
- negocios locales con información temporal relevante.

### 5.2 Problema

Hoy un business debe configurar y mantener por separado:

- contenido visible;
- fundamentos SEO;
- datos estructurados;
- horarios y excepciones;
- páginas de eventos;
- controles de crawlers;
- señales para motores generativos;
- WebMCP;
- perfiles y listings externos;
- analítica.

La información se contradice o envejece. Las herramientas son técnicas y horizontales. El propietario del negocio no sabe qué atributos necesita su rubro ni cómo comprobar que la implementación sigue vigente.

### 5.3 Propuesta de valor

> Sendero Ready prepara y mantiene la presencia digital de un negocio local para que pueda ser encontrada, comprendida y utilizada por personas, buscadores y agentes compatibles.

No prometer:

- aparecer en ChatGPT;
- ranking específico;
- “activar GEO”;
- inclusión automática en itinerarios;
- recomendación editorial.

Sí prometer capacidades comprobables:

- identidad canónica;
- datos completos;
- structured data válido;
- información visible coherente;
- WebMCP activo;
- dominio verificado;
- frescura medida;
- perfil consultable en Sendero;
- alertas y monitoreo.

## 6. Wizard de Sendero Ready

### Paso 1 — URL

El business ingresa su sitio.

Sendero analiza:

- contenido visible;
- tecnología;
- metadatos;
- datos estructurados;
- páginas clave;
- horarios;
- ubicación;
- eventos;
- reservas;
- sitemap y robots observables;
- contradicciones.

### Paso 2 — clasificación

La IA propone el vertical:

```text
restaurant
bar
venue
event
workshop
experience
accommodation
museum
gallery
other
```

El owner confirma o corrige.

### Paso 3 — extracción y procedencia

Cada dato detectado conserva fuente y confianza.

```json
{
  "field": "openingHours.sunday",
  "value": "10:00-23:00",
  "sourceUrl": "https://example.com/contact",
  "status": "detected",
  "observedAt": "2026-08-28T14:00:00Z"
}
```

Estados:

```text
detected
inferred
confirmed
verified
conflicting
stale
```

### Paso 4 — entrevista adaptativa

La IA pregunta solo lo faltante o conflictivo:

- “Encontré dos horarios distintos para el domingo. ¿Cuál es correcto?”
- “¿El menú publicado continúa vigente?”
- “¿Aceptan reservas?”
- “¿Qué opciones alimentarias están disponibles?”
- “¿Deseas que los agentes solo consulten o también inicien una reserva?”

### Paso 5 — ficha canónica

El owner revisa una ficha humana antes de publicar. Los hechos críticos no se aprueban automáticamente por inferencia.

### Paso 6 — snippet

Se genera una única instalación:

```html
<script
  async
  src="https://cdn.sendero.app/ready.js"
  data-sendero-site="site_01K...">
</script>
```

No habrá paquete descargable en el MVP.

### Paso 7 — validación

Sendero comprueba:

- carga del snippet;
- dominio correcto;
- schemas;
- coherencia con contenido visible;
- tools WebMCP;
- errores de permisos/origin;
- datos mínimos;
- frescura;
- perfil en Sendero.

### Paso 8 — operación continua

El business modifica horarios, eventos o servicios desde Sendero. El snippet consume la configuración administrada sin requerir tocar nuevamente el código del sitio.

## 7. Qué hace el snippet

- identifica site y página;
- obtiene configuración vigente;
- registra WebMCP tools compatibles;
- inserta o sincroniza structured data cuando sea técnicamente apropiado;
- muestra el sello o componente acordado;
- conecta con el perfil canónico;
- reporta errores técnicos;
- registra métricas permitidas;
- activa componentes visibles opcionales;
- usa feature detection y progressive enhancement.

## 8. Qué no puede resolver el snippet por sí solo

- cambiar de forma universal `robots.txt`;
- corregir códigos HTTP;
- controlar redirects del servidor;
- reparar arquitectura de URLs;
- mejorar reputación externa;
- modificar Google Business Profile;
- garantizar crawling o indexación;
- conseguir menciones auténticas;
- garantizar citas de modelos;
- arreglar performance estructural del sitio;
- ejecutar en crawlers que no procesan JavaScript.

El panel debe separar:

```text
Aplicado automáticamente
Requiere acción guiada
No controlable por Sendero
```

## 9. SEO, GEO y WebMCP dentro de Ready

### SEO

Sendero ayuda a mejorar descubribilidad y comprensión mediante fundamentos técnicos, contenido visible, entidades, structured data y diagnóstico.

### GEO/AEO

No existe un switch universal. Sendero mejora las condiciones para que la información sea recuperable y utilizable:

- claridad;
- hechos concretos;
- autoridad oficial;
- coherencia;
- actualidad;
- evidencia;
- indexabilidad.

### WebMCP

Permite que un agente interactúe con la página después de visitarla. No sustituye discovery, crawling, SEO ni el índice de Sendero.

### Índice de Sendero

Sendero sí puede garantizar que una entidad aprobada esté publicada y consultable dentro de su propio sistema, sujeta a las reglas de visibilidad del producto.

## 10. Modelos verticales mínimos

### Restaurant / Bar

- nombre;
- categoría/cocina;
- dirección y coordenadas;
- timezone;
- horarios y excepciones;
- rango de precios;
- menú;
- opciones alimentarias;
- accesibilidad;
- reservas;
- grupos;
- eventos;
- última actualización.

### Event

- nombre;
- organizador;
- venue;
- inicio y fin;
- timezone;
- status;
- precio;
- tickets;
- capacidad;
- edad mínima;
- accesibilidad;
- participantes;
- última actualización.

### Workshop / Experience

- nivel;
- duración;
- horarios;
- cupos;
- precio;
- materiales incluidos;
- idioma;
- ubicación;
- política de cancelación;
- booking;
- accesibilidad.

### Accommodation

- tipo;
- ubicación;
- check-in/out;
- capacidad;
- amenities;
- reglas;
- accesibilidad;
- transporte;
- booking/contacto;
- recomendaciones del host, cuando corresponda.

## 11. Tools read-only iniciales

### Restaurante o bar

```text
get_business_details
get_opening_hours
get_exceptional_hours
get_menu
get_dietary_options
list_upcoming_events
get_reservation_options
get_accessibility_information
```

### Evento

```text
get_event_details
get_event_status
get_schedule
get_ticket_options
get_venue_details
get_accessibility_information
```

### Taller o experiencia

```text
list_sessions
get_session_details
get_price
get_materials_included
get_booking_options
get_accessibility_information
```

Las acciones transaccionales se incorporan después de validar seguridad, consentimiento, disponibilidad y reconciliación.

## 12. Sello Sendero Ready

El sello certifica condiciones técnicas y de información, no calidad editorial.

### Estados

```text
Listed on Sendero
Sendero Ready
Sendero Verified
Stale / Action required
Suspended
```

### Sendero Ready significa

- identidad canónica;
- implementación detectada;
- datos mínimos completos;
- structured data válido dentro del alcance;
- tools WebMCP comprobadas;
- información actualizada en el umbral definido;
- perfil consultable en Sendero.

### Sendero Verified agrega

- control de dominio o entidad;
- campos específicos verificados;
- método y fecha visibles.

### Nunca significa

- recomendado por Sendero;
- mejor de su categoría;
- aparecerá en ChatGPT;
- mejor ranking;
- inclusión automática en itinerarios.

El sello debe enlazar a una página verificable con alcance y vigencia.

## 13. Modelo de negocio de Ready

### Free / Listed

- análisis inicial;
- ficha básica;
- perfil en Sendero;
- configuración elemental;
- snippet;
- tools read-only limitadas;
- actualización manual.

### Managed — hipótesis USD 15–29 por ubicación/mes

- monitoreo;
- validación periódica;
- sello Ready;
- excepciones de horario;
- eventos;
- alertas de stale data;
- analytics básicos;
- historial.

### Pro — hipótesis USD 59–99/mes

- múltiples ubicaciones;
- catálogos/eventos dinámicos;
- API;
- integraciones;
- equipos;
- tools personalizadas;
- analytics ampliados;
- soporte prioritario.

El pago compra operación y mantenimiento. Nunca compra prioridad en recomendaciones.

## 14. Ventaja para Sendero

Ready puede crear un ciclo acumulativo:

```text
Business confirma información
        ↓
Sendero obtiene datos estructurados y frescos
        ↓
Traveler y Hosts generan planes más confiables
        ↓
Más viajes y consultas producen demanda
        ↓
Más business quieren mantener su presencia
```

La ventaja no es el snippet por sí solo. Es la combinación de:

- registro canónico;
- modelos verticales;
- procedencia;
- historial;
- verificación;
- índice;
- conexión con viajes reales;
- relaciones con hosts y negocios.

## 15. Distribución B2B

### Hosts

- pilotos con hosts individuales;
- administradores pequeños;
- hoteles boutique;
- demos personalizadas con su propiedad.

### Ready

- onboarding gratuito de negocios en una ciudad piloto;
- partners de diseño/web que instalan el snippet;
- plugins e integraciones futuras;
- casos de uso visibles;
- reportes de inconsistencias y mejoras concretas;
- conexión orgánica con itinerarios, sin paid placement.

## 16. Métricas

### Hosts

- propiedades activas;
- estadías creadas;
- huéspedes que abren el companion;
- preguntas resueltas;
- tiempo estimado ahorrado;
- conversión de huésped a Traveler;
- retención de host.

### Ready

- perfiles completados;
- dominios verificados;
- snippet activo;
- tool success rate;
- información stale corregida;
- negocios que publican eventos;
- renovación;
- consultas dentro de Sendero;
- errores de datos evitados.

## 17. Riesgos

### Construir Business demasiado pronto

Mitigación: mantenerlo fuera de V1 y exigir estabilidad en Traveler identity, shared pages y places/events.

### Vender una promesa de GEO engañosa

Mitigación: métricas verificables, lenguaje preciso y documentación de límites.

### Snippet convertido en commodity

Mitigación: competir por modelo vertical, datos, verificación, índice y distribución; no por una línea de JavaScript.

### Datos falsos o desactualizados

Mitigación: procedencia, confirmación, freshness, alertas, status y revocación del sello.

### Conflicto de interés en recomendaciones

Mitigación: prohibición de paid ranking y separación entre integración técnica y selección orgánica.

### Complejidad transaccional

Mitigación: tools read-only primero; escritura/reservas después de diseñar consentimiento, seguridad y reconciliación.

## 18. Criterios para comenzar Business

No iniciar implementación principal hasta que se cumplan, como mínimo:

- [ ] Traveler posee identidad de usuario estable.
- [ ] Los trips viven fuera del chat y tienen owner claro.
- [ ] Shared pages son confiables y medibles.
- [ ] Existe un modelo canónico inicial de places/events.
- [ ] La colaboración o el acceso por cuenta tiene un camino definido.
- [ ] Hay entrevistas con al menos una audiencia business concreta.
- [ ] Se eligió una ciudad o vertical piloto.
- [ ] Se identificó qué datos realmente mejoran Traveler.
- [ ] El equipo puede operar soporte y verificación.

## 19. Decisión final

Sendero Business no es “publicidad para negocios de viaje”. Es infraestructura para que alojamientos, lugares y eventos puedan aportar información y capacidades útiles a un ecosistema de viajes persistentes.

La secuencia correcta es:

```text
Traveler crea demanda y contexto
        ↓
Hosts distribuyen y personalizan
        ↓
Ready estructura y mantiene la oferta
```
