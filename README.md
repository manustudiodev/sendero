# Sendero

Sendero es un plugin de planificación de viajes que convierte fechas, alojamiento, intereses, transporte, reservas y compromisos fijos en un itinerario local-first. Su interfaz muestra el resultado como lista diaria, calendario y rutas por día.

## Qué incluye

- Un skill que guía la investigación de clima, eventos, horarios, reservas y experiencias locales.
- `prepare_trip_brief` para normalizar las preferencias y detectar información crítica faltante.
- `validate_itinerary` para controlar fechas, solapamientos, transporte, reservas, fuentes y actividades fijas.
- `render_itinerary` para mostrar el itinerario en una interfaz MCP Apps con vistas de lista, calendario y mapa.
- Rutas diarias generadas para Google Maps desde el alojamiento, sin asumir que el viajero conduce.

## Desarrollo local

Desde la raíz del proyecto:

```bash
npm install
npm test
npm run dev
```

El servidor HTTP queda disponible en `http://localhost:8788/mcp` y su comprobación de salud en `http://localhost:8788/health`.

Para uso local mediante entrada y salida estándar, la configuración está en `.mcp.json`.

## Alcance actual

Esta primera versión estructura, valida y visualiza itinerarios. El skill indica al asistente cómo investigar información cambiante y conservar sus fuentes, pero todavía no incluye cuentas de usuario, almacenamiento permanente ni conexiones propias con proveedores de clima, eventos o reservas.

Publicación, alojamiento remoto y persistencia se mantienen fuera de este paquete hasta elegir la infraestructura y autorizar su despliegue.
