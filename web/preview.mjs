import { createServer } from "node:http";
import { itineraryWidgetHtml, tripIntakeWidgetHtml } from "../server/ui/generated/widgets.mjs";

const port = Number(process.env.PORT || 4173);
const itinerary = {
  title: "Buenos Aires entre clásicos y barrios",
  destination: "Buenos Aires",
  startDate: "2026-08-13",
  endDate: "2026-08-15",
  days: [
    {
      date: "2026-08-13",
      title: "Centro histórico y Corrientes",
      area: "Monserrat · San Nicolás",
      summary: "Una primera mirada a la ciudad, sin apurar el día de llegada.",
      weather: { summary: "Fresco; llevar abrigo para la noche." },
      fallback: "Museo del Cabildo si llueve.",
      activities: [
        { id: "plaza", startTime: "10:30", title: "Plaza de Mayo", description: "Casa Rosada, Catedral y Cabildo.", location: { name: "Plaza de Mayo", address: "Balcarce 50" }, travelToNext: { durationMinutes: 12, mode: "walk" } },
        { id: "tortoni", startTime: "13:00", title: "Café con historia", description: "Elegir entre Tortoni y El Gato Negro según la espera.", location: { name: "Café Tortoni", address: "Av. de Mayo 825" }, reservation: { status: "suggested" }, travelToNext: { durationMinutes: 8, mode: "walk" } },
        { id: "corrientes", startTime: "19:30", title: "Avenida Corrientes", description: "Librerías, pizza porteña y marquesinas.", location: { name: "Obelisco", address: "Av. 9 de Julio y Corrientes" }, locked: true },
      ],
      route: { stops: ["Alojamiento provisional", "Plaza de Mayo", "Café Tortoni", "Obelisco"], mapUrl: "https://www.google.com/maps" },
    },
    {
      date: "2026-08-14",
      title: "San Telmo cotidiano",
      area: "San Telmo · Barracas",
      summary: "Mercado, arquitectura y una noche con música.",
      activities: [{ id: "mercado", startTime: "10:00", title: "Mercado y pasajes", location: { name: "Mercado de San Telmo", address: "Carlos Calvo 495" } }],
      route: { stops: ["Alojamiento provisional", "Mercado de San Telmo", "Pasaje Lanín"], mapUrl: "https://www.google.com/maps" },
    },
    {
      date: "2026-08-15",
      title: "Arte y vida de barrio",
      area: "Villa Crespo · Chacarita",
      summary: "Diseño independiente, cafés y bodegón.",
      activities: [{ id: "crespo", startTime: "11:00", title: "Paseo por Villa Crespo", location: { name: "Villa Crespo", address: "Av. Corrientes 5500" } }],
      route: { stops: ["Alojamiento provisional", "Villa Crespo", "Chacarita"], mapUrl: "https://www.google.com/maps" },
    },
  ],
};

function withBridge(html, toolOutput) {
  const safeOutput = (JSON.stringify(toolOutput) ?? "undefined").replaceAll("<", "\\u003c");
  const bridge = `<script>window.openai={toolOutput:${safeOutput},widgetState:{},setWidgetState:function(value){this.widgetState=value},sendFollowUpMessage:async function(){return {ok:true}},openExternal:function(){}};</script>`;
  return html.replace("<body>", `<body>${bridge}`);
}

const pages = {
  "/": withBridge(tripIntakeWidgetHtml, { actions: ["new", "open", "adjust", "refresh"] }),
  "/itinerary": withBridge(itineraryWidgetHtml, { itinerary, validation: { valid: true, warnings: ["Alojamiento pendiente: las rutas parten de una base provisional."] } }),
  "/itinerary-empty": withBridge(itineraryWidgetHtml, undefined),
};

createServer((request, response) => {
  const path = new URL(request.url, `http://${request.headers.host}`).pathname;
  if (path === "/favicon.ico") {
    response.writeHead(204);
    response.end();
    return;
  }
  const page = pages[path];
  response.writeHead(page ? 200 : 404, { "Content-Type": "text/html; charset=utf-8" });
  response.end(page || "Not found");
}).listen(port, "127.0.0.1", () => {
  console.log(`Sendero UI preview: http://127.0.0.1:${port}`);
});
