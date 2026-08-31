import { buenosAiresItinerary } from "../../fixtures/buenos-aires-itinerary.mjs";

const extraDays = [
  ["2026-08-16", "Domingo de río y mercado", "Tigre", [-34.4251, -58.5797], "Paseo por el Puerto de Frutos", "Delta y almuerzo junto al río"],
  ["2026-08-17", "Recoleta a pie", "Recoleta", [-34.5875, -58.3928], "Arquitectura y plazas de Recoleta", "Librerías y café de barrio"],
  ["2026-08-18", "Parques y diseño porteño", "Palermo", [-34.5743, -58.4201], "Bosques de Palermo", "Diseño independiente en Palermo Viejo"],
  ["2026-08-19", "Sur industrial y creativo", "La Boca · Barracas", [-34.6345, -58.3631], "Fundación Proa y Vuelta de Rocha", "Galpones y arte en Barracas"],
  ["2026-08-20", "Una ciudad menos obvia", "Chacarita · Villa Crespo", [-34.5876, -58.4544], "Patrimonio y memoria en Chacarita", "Merienda y comercios de Villa Crespo"],
  ["2026-08-21", "Barrio chino y costa norte", "Belgrano", [-34.5575, -58.4496], "Barrancas de Belgrano", "Cocinas y tiendas del Barrio Chino"],
  ["2026-08-22", "Horizonte abierto", "Puerto Madero", [-34.6132, -58.3508], "Reserva Ecológica Costanera Sur", "Atardecer junto a los diques"],
  ["2026-08-23", "Tradición popular", "Mataderos", [-34.656, -58.5007], "Feria y cultura criolla", "Regreso tranquilo por barrios del oeste"],
  ["2026-08-24", "Cafés, discos y librerías", "Colegiales · Chacarita", [-34.5745, -58.4482], "Mercado de las Pulgas", "Café y música en Chacarita"],
  ["2026-08-25", "Arte argentino en perspectiva", "Retiro · Recoleta", [-34.5827, -58.397], "Colecciones de arte argentino", "Paseo por plazas y palacios"],
  ["2026-08-26", "Últimas horas sin apuro", "Palermo", [-34.5868, -58.4247], "Desayuno y compras de despedida", "Cierre flexible antes de partir"],
];

function showcaseDay([date, title, area, [latitude, longitude], first, second]) {
  const firstId = `${date}-first`;
  const secondId = `${date}-second`;
  return {
    activities: [
      {
        description: "Una parada pensada para comprender el barrio y recorrerlo a un ritmo amable.",
        id: firstId,
        location: { latitude, longitude, name: first },
        startTime: "10:30",
        title: first,
        travelToNext: { durationMinutes: 18, mode: "public_transit" },
      },
      {
        description: "Tiempo abierto para comer, observar y ajustar el plan según la energía del día.",
        id: secondId,
        location: { latitude: latitude + 0.008, longitude: longitude + 0.008, name: second },
        startTime: "15:30",
        title: second,
      },
    ],
    area,
    date,
    fallback: "Si cambia el clima, Sendero propone una alternativa cercana y cubierta.",
    route: {
      origin: first,
      returnToLodging: false,
      stops: [first, second],
      totalMinutes: 18,
    },
    summary: "Dos momentos conectados por una ruta simple, con margen para descubrir el barrio.",
    title,
    weather: { status: "seasonal", summary: "Invierno fresco; conviene llevar una capa de abrigo." },
  };
}

export const landingShowcaseItinerary = Object.freeze({
  ...buenosAiresItinerary,
  endDate: "2026-08-26",
  locale: "es",
  title: "Buenos Aires entre clásicos y barrios",
  days: Object.freeze([
    ...buenosAiresItinerary.days,
    ...extraDays.map(showcaseDay),
  ]),
});
