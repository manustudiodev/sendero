# Sendero — master brief de producto y negocio

**Fecha:** 2026-08-28
**Estado:** dirección estratégica aprobada; precios como hipótesis

## 1. Resumen ejecutivo

Sendero no debe competir por ser “la IA que genera itinerarios”. Los modelos generalistas ya pueden producir un buen primer plan y esa capacidad será cada vez más fácil de reproducir.

La oportunidad de Sendero comienza cuando la respuesta deja de ser texto y se transforma en un objeto de producto:

> **Sendero convierte una conversación sobre un viaje en un itinerario persistente, visual, compartible y listo para utilizarse por un grupo.**

La generación es la entrada. El valor acumulativo está en:

- conservar estado;
- organizar fechas, lugares y traslados;
- compartir una versión canónica;
- reflejar cambios del owner;
- permitir interpretaciones personales sin romper el plan del grupo;
- incorporar permisos y colaboración en etapas posteriores;
- conectar información temporal y verificable;
- ofrecer continuidad fuera de una conversación específica.

## 2. Problema

Un itinerario generado en una conversación puede ser excelente, pero suele tener limitaciones:

- queda enterrado en el historial de una sola persona;
- no tiene una URL útil para el resto del grupo;
- el grupo no comparte necesariamente el mismo contexto;
- las fechas y horarios pueden interpretarse mal;
- los cambios del organizador no se propagan como una fuente única;
- no distingue entre plan canónico y necesidades personales;
- puede ser difícil de usar durante el viaje;
- no posee por sí mismo identidad, permisos, versiones o continuidad comercial.

## 3. Tesis de producto

La fórmula central es:

```text
Conversación
+ estructura
+ persistencia
+ visualización
+ distribución
+ contexto temporal
+ permisos progresivos
= Sendero
```

El viaje puede nacer en ChatGPT, pero no debe depender del chat donde nació.

## 4. Audiencias

### 4.1 Organizador u owner

Persona que inicia el viaje, conversa con la IA, toma decisiones y comparte el resultado.

Jobs principales:

- convertir ideas dispersas en un plan;
- editarlo sin perder contexto;
- compartir una versión actualizada;
- evitar responder individualmente las mismas preguntas;
- mantener control sobre el plan del grupo.

### 4.2 Invitado o viewer

Persona que recibe el link y necesita comprender el viaje sin instalar Sendero.

Jobs principales:

- saber qué ocurre cada día;
- entender horarios, lugares y reservas;
- ver el mapa;
- consultar cómo sus circunstancias personales afectan el plan;
- recibir siempre la versión actualizada.

### 4.3 Colaborador futuro

Persona invitada con permiso para modificar el viaje.

Jobs principales:

- encontrar viajes compartidos aunque no tenga el chat original;
- editar desde la web o mediante un agente;
- trabajar sin sobrescribir cambios ajenos;
- comprender quién cambió qué;
- respetar permisos y elementos protegidos.

### 4.4 Viajero frecuente

Persona que planifica varios viajes al año y valora biblioteca, preferencias reutilizables, colaboración y herramientas premium.

### 4.5 Host o alojamiento

Airbnb host, alquiler temporal, hotel, hostel o administrador que quiere ofrecer información práctica e itinerarios personalizados a huéspedes.

### 4.6 Business local

Restaurante, bar, evento, taller, experiencia, museo, galería u otro negocio que necesita mantener información estructurada y utilizable por buscadores, agentes y Sendero.

## 5. Superficies del producto

### 5.1 Sendero Plugin + MCP remoto

Responsabilidad:

- crear viajes mediante conversación;
- consultar y modificar recursos de Sendero sin página abierta;
- listar viajes disponibles para una cuenta autenticada;
- actuar como canal de adquisición y uso dentro de ChatGPT.

### 5.2 Página compartida

Responsabilidad inmediata:

- mostrar el viaje a invitados;
- conservar una URL estable;
- reflejar cambios del owner;
- ofrecer agenda y mapa;
- funcionar sin instalación del plugin.

### 5.3 Página compartida + WebMCP

Responsabilidad inmediata para el challenge:

- exponer contexto estructurado del viaje abierto;
- permitir consultas exactas sobre ese viaje;
- controlar la vista local de agenda y mapa;
- crear una interpretación temporal para el invitado;
- no modificar el viaje canónico.

### 5.4 Aplicación autenticada de Traveler

Responsabilidad posterior:

- biblioteca de viajes;
- perfil y preferencias;
- owned/shared-with-me;
- invitaciones y memberships;
- colaboración;
- billing y entitlements.

### 5.5 Sendero for Hosts

Responsabilidad posterior:

- propiedades y estadías;
- información práctica;
- recomendaciones del host;
- generación personalizada por huésped;
- canal B2B2C hacia Traveler.

### 5.6 Sendero Ready

Responsabilidad posterior:

- wizard guiado por IA para negocios;
- ficha canónica;
- datos estructurados;
- preparación SEO/GEO medible;
- site tools WebMCP;
- snippet único;
- verificación y sello;
- publicación en el índice de Sendero.

## 6. Posicionamiento

### Sendero Traveler

> **Planifica conversando. Comparte un viaje que todos pueden entender y utilizar.**

Una definición más funcional:

> **Sendero transforma una conversación de viaje en un itinerario vivo, estructurado y compartible.**

### Shared Trip Companion

> **Cada invitado puede explorar el viaje compartido con su propio agente, sin modificar el plan del grupo.**

### Sendero for Hosts

> **Convierte el conocimiento local de un alojamiento en una experiencia personalizada para cada huésped.**

### Sendero Ready

> **Prepara la información de un negocio local para ser comprendida y utilizada por buscadores, agentes compatibles y Sendero.**

## 7. Modelo de negocio

Las cifras son hipótesis que deben validarse.

### 7.1 Traveler Free

Puede incluir:

- creación básica;
- página compartida;
- cantidad limitada de viajes activos;
- funcionalidades esenciales del plugin;
- Shared Trip Companion básico.

Objetivo: demostrar el valor antes de cobrar y convertir cada itinerario compartido en distribución.

### 7.2 Trip Pass — hipótesis USD 12–15 por viaje

Pago único para una necesidad episódica.

Candidatos a premium:

- colaboración avanzada;
- acceso offline;
- exportaciones;
- verificación y actualizaciones más profundas;
- alertas durante el viaje;
- historial y restauración;
- mayor cantidad de participantes o personalizaciones.

La propuesta debe vender un viaje más ejecutable, no “más tokens de IA”.

### 7.3 Frequent Traveler — hipótesis USD 39–49 por año

Para usuarios recurrentes:

- múltiples viajes;
- biblioteca;
- preferencias reutilizables;
- colaboración;
- beneficios premium en todos los viajes;
- acceso anticipado a nuevas capacidades.

### 7.4 Hosts

Modelos a validar:

- pago por propiedad;
- pago por estadía activa;
- suscripción por portfolio;
- plan profesional para administradores.

### 7.5 Sendero Ready

Hipótesis iniciales:

- Free/Listed;
- Managed: USD 15–29 por ubicación/mes;
- Pro: USD 59–99/mes para varias ubicaciones, integraciones y equipos.

El negocio paga por infraestructura, mantenimiento, validación y sincronización. No compra ranking ni inclusión preferencial.

## 8. Modelo expresamente descartado

Sendero no tendrá:

- anuncios dentro del plugin;
- anuncios dentro del itinerario;
- sugerencias patrocinadas;
- pago por aparecer en un recorrido;
- ranking orgánico comprado;
- una operación cuyo incentivo sea recomendar algo menos relevante porque pagó.

Esto protege la confianza del viajero y evita que la vertical Business contamine la calidad de Traveler.

## 9. Distribución

### 9.1 El itinerario compartido como adquisición

Cada shared page puede demostrar el producto sin explicar su stack.

Posibles CTAs posteriores:

- “Crear mi viaje en Sendero”.
- “Duplicar y adaptar este itinerario”.
- “Guardar en mi cuenta”.

### 9.2 ChatGPT como canal

El plugin reduce la fricción inicial porque el usuario ya está conversando. Sendero no necesita convencerlo de abandonar la IA; convierte el resultado en producto.

### 9.3 Invitados como loop orgánico

Cada owner puede introducir varias personas nuevas a Sendero mediante un link. WebMCP aumenta el valor para el invitado sin exigir instalación.

### 9.4 Hosts como distribución B2B2C

El alojamiento entrega Sendero al huésped. El huésped recibe utilidad y luego puede conservar el producto para viajes propios.

### 9.5 Creadores y curadores

Itinerarios públicos de personas con criterio local pueden convertirse en contenido duplicable y compartible. El valor no es solamente el número de lugares, sino el criterio y el contexto.

## 10. Ventaja acumulativa

Las funciones visuales pueden copiarse. La ventaja debe construirse alrededor de activos acumulativos:

- viajes persistentes y relaciones entre participantes;
- historial de decisiones;
- preferencias reutilizables;
- red de shared pages;
- datos de lugares y eventos con procedencia;
- información confirmada por hosts y negocios;
- memberships y colaboración;
- reputación de que el plan funciona en la realidad;
- integración natural entre conversación, web, agentes y datos.

## 11. Secuencia de producto

```text
Fase inmediata
Plugin + API + shared page existentes
        ↓
WebMCP Shared Trip Companion
        ↓
Estabilización de Traveler
        ↓
Cuentas, biblioteca y colaboración
        ↓
Monetización Traveler
        ↓
Sendero for Hosts
        ↓
Sendero Ready
```

No construir simultáneamente un marketplace bilateral. Primero debe existir demanda real de viajeros y una base de producto sólida.

## 12. Métricas

### Challenge y Shared Trip Companion

- shared pages con site tools activas;
- éxito de registro de tools;
- preguntas resueltas mediante WebMCP;
- previews de llegada completados;
- interacción con mapa/timeline después de una tool call;
- errores por incompatibilidad o datos incompletos.

### Traveler

- viaje creado;
- link compartido;
- viewers únicos por viaje;
- viewers que interactúan;
- owner que vuelve a editar;
- trips duplicados o guardados;
- conversión a cuenta;
- uso durante las fechas del viaje;
- conversión a pago.

### Colaboración

- invitaciones enviadas y aceptadas;
- viajes con más de un editor;
- conflictos de versión;
- cambios revertidos;
- tiempo desde invitación hasta primera contribución.

### Business

- propiedades activas;
- estadías atendidas;
- negocios onboarded;
- perfiles actualizados;
- herramientas WebMCP válidas;
- información vencida detectada;
- retención de suscripciones.

## 13. Principios no negociables

- La API de Sendero es la fuente de verdad.
- Un chat no es el sistema de permisos.
- Un link público no convierte a alguien en miembro.
- Las herramientas del agente no deben tener más permisos que la sesión humana.
- El challenge debe demostrar una mejora real, no solo devolver JSON.
- La página normal debe funcionar aunque WebMCP no esté disponible.
- La información privada no debe filtrarse en una proyección pública.
- La vertical Business no compra relevancia en Traveler.
- El snippet de Ready es un método de instalación, no el producto completo.
- Ninguna interfaz debe prometer “SEO activado” o “GEO garantizado”.
