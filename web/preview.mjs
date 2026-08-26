import { createServer } from "node:http";
import {
  itineraryWidgetHtml,
  publicShareControlWidgetHtml,
  publicSharePageHtml,
  tripIntakeWidgetHtml,
  tripListWidgetHtml,
  tripRequirementsWidgetHtml,
} from "../server/ui/generated/widgets.mjs";
import { sanitizePublicSnapshot } from "../shared/public-snapshot.mjs";

const port = Number(process.env.PORT || 4173);
const previewToken = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const offlineToken = "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
const unavailableToken = "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC";
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
const publicItinerary = sanitizePublicSnapshot(itinerary);
const proposedExpiresAt = Date.UTC(2026, 8, 24);

function withBridge(html, toolOutput) {
  const safeOutput = (JSON.stringify(toolOutput) ?? "undefined").replaceAll("<", "\\u003c");
	  const bridge = `<script>{
	    const initialToolOutput = ${safeOutput};
	    const requestedTheme = new URLSearchParams(location.search).get("theme");
	    const initialTheme = requestedTheme === "dark" || requestedTheme === "light"
	      ? requestedTheme
	      : (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
	    const persistWidgetState = new URLSearchParams(location.search).has("persist");
    const widgetStateKey = "sendero-preview:" + location.pathname;
    let initialWidgetState = {};
    if (persistWidgetState) {
      try { initialWidgetState = JSON.parse(sessionStorage.getItem(widgetStateKey)) || {}; } catch {}
    }
	    window.openai = {
	      toolOutput: initialToolOutput,
	      theme: initialTheme,
      widgetState: initialWidgetState,
      calls: [],
      heightNotifications: [],
      setWidgetState: function(value) {
        this.widgetState = value;
        if (persistWidgetState) sessionStorage.setItem(widgetStateKey, JSON.stringify(value));
        this.calls.push({ method: "setWidgetState", value });
        queueMicrotask(() => window.dispatchEvent(new CustomEvent("openai:set_globals", {
	          detail: { globals: { theme: this.theme, toolOutput: structuredClone(initialToolOutput), widgetState: value } },
	        })));
      },
      updateModelContext: async function(value) {
        this.modelContext = value;
        this.calls.push({ method: "updateModelContext", value });
        return { ok: true };
      },
      sendFollowUpMessage: async function(value) {
        this.followUp = value;
        this.calls.push({ method: "sendFollowUpMessage", value });
        return { ok: true };
      },
      callTool: async function(name, args) {
        this.calls.push({ method: "callTool", name, args });
        if (name !== "prepare_trip_brief") throw new Error("Unsupported preview tool");
        return {
          structuredContent: {
            ready: true,
            missing: [],
            criticalFields: [],
            warnings: [],
            assumptions: [],
            brief: args.brief,
          },
        };
      },
      notifyIntrinsicHeight: function(height) {
        this.intrinsicHeight = height;
        this.heightNotifications.push(height);
      },
	      openExternal: function() {},
	    };
	    window.setSenderoPreviewTheme = function(theme) {
	      if (theme !== "dark" && theme !== "light") return;
	      window.openai.theme = theme;
	      window.dispatchEvent(new CustomEvent("openai:set_globals", { detail: { globals: { theme } } }));
	    };
	  }</script>`;
  return html.replace("<body>", `<body>${bridge}`);
}

const pages = {
  "/": withBridge(tripIntakeWidgetHtml, { mode: "new", actions: [] }),
  "/intake-empty": withBridge(tripIntakeWidgetHtml, undefined),
  "/menu": withBridge(tripIntakeWidgetHtml, { mode: "menu", actions: ["new", "open", "adjust", "refresh"] }),
  "/trips": withBridge(tripListWidgetHtml, { purpose: "open", trips: [
    { id: "trip_sevilla", title: "Sevilla histórica y alternativa — Semana Santa 2027", destination: "Sevilla, España", startDate: "2027-03-21", endDate: "2027-03-27", currentVersion: 2, role: "owner", updatedAt: 1786900000000 },
    { id: "trip_ba", title: "Buenos Aires con amigos", destination: "Buenos Aires, Argentina", startDate: "2026-08-13", endDate: "2026-08-26", currentVersion: 4, role: "editor", updatedAt: 1787000000000 },
  ] }),
  "/requirements": withBridge(tripRequirementsWidgetHtml, {
    interactionId: "preview_create_trip",
    fields: ["destination", "startDate", "endDate", "travellers.adults", "transport.modes"],
    brief: { travellers: { children: 0 }, transport: {} },
  }),
  "/requirements-car": withBridge(tripRequirementsWidgetHtml, {
    interactionId: "preview_create_trip_car",
    fields: ["transport.modes"],
    brief: { destination: "Sevilla, España", startDate: "2027-03-21", endDate: "2027-03-27", travellers: { adults: 2, children: 0 }, transport: { modes: ["car"] } },
  }),
  "/itinerary": withBridge(itineraryWidgetHtml, { itinerary, validation: { valid: true, warnings: ["Alojamiento pendiente: las rutas parten de una base provisional."] } }),
  "/itinerary-empty": withBridge(itineraryWidgetHtml, undefined),
  "/share": publicSharePageHtml,
  "/share-control-preview": withBridge(publicShareControlWidgetHtml, { state: "preview", action: "publish", itinerary: publicItinerary, tripId: "trip-preview", operationId: "preview-share", expectedVersion: 4, expiresInDays: 30, proposedExpiresAt }),
  "/share-control-update": withBridge(publicShareControlWidgetHtml, { state: "preview", action: "update", itinerary: publicItinerary, tripId: "trip-preview", operationId: "preview-update", expectedVersion: 5, expiresInDays: 30, proposedExpiresAt }),
  "/share-control-preview-missing": withBridge(publicShareControlWidgetHtml, { state: "preview", action: "publish", tripId: "trip-preview", operationId: "preview-missing", expectedVersion: 4, expiresInDays: 30, proposedExpiresAt }),
  "/share-control-published": withBridge(publicShareControlWidgetHtml, { state: "published", title: itinerary.title, destination: itinerary.destination, startDate: itinerary.startDate, endDate: itinerary.endDate, publicUrl: `http://127.0.0.1:${port}/share#${previewToken}`, publishedAt: 1787600000000, expiresAt: 1790200000000 }),
  "/share-control-active": withBridge(publicShareControlWidgetHtml, { state: "active", title: itinerary.title, destination: itinerary.destination, startDate: itinerary.startDate, endDate: itinerary.endDate, publishedVersion: 3, currentVersion: 4, isStale: true, operationId: "active-share" }),
  "/share-control-active-fresh": withBridge(publicShareControlWidgetHtml, { state: "active", title: itinerary.title, destination: itinerary.destination, startDate: itinerary.startDate, endDate: itinerary.endDate, publishedVersion: 4, currentVersion: 4, isStale: false, operationId: "active-share-fresh" }),
  "/share-control-revoked": withBridge(publicShareControlWidgetHtml, { state: "revoked", title: itinerary.title, destination: itinerary.destination, startDate: itinerary.startDate, endDate: itinerary.endDate, operationId: "revoked-share" }),
};

async function jsonBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return {};
  }
}

createServer(async (request, response) => {
  const path = new URL(request.url, `http://${request.headers.host}`).pathname;
  if (path === "/favicon.ico") {
    response.writeHead(204);
    response.end();
    return;
  }
  if (path === "/api/public-shares/resolve" && request.method === "POST") {
    const { token } = await jsonBody(request);
    if (token === offlineToken) {
      response.writeHead(503, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      response.end(JSON.stringify({ error: "temporarily_unavailable" }));
      return;
    }
    if (!token || token === unavailableToken) {
      response.writeHead(410, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      response.end(JSON.stringify({ error: "share_unavailable" }));
      return;
    }
    response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    response.end(JSON.stringify({ share: { itinerary: publicItinerary, publishedAt: 1787600000000, updatedAt: 1787800000000, expiresAt: 1790200000000 } }));
    return;
  }
  const page = pages[path];
  response.writeHead(page ? 200 : 404, { "Content-Type": "text/html; charset=utf-8" });
  response.end(page || "Not found");
}).listen(port, "127.0.0.1", () => {
  console.log(`Sendero UI preview: http://127.0.0.1:${port}`);
});
