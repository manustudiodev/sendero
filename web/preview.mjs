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

function googleRoute(stops, travelmode = "walking") {
  const places = stops.filter(Boolean);
  if (places.length < 2) return places[0]
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(places[0])}`
    : undefined;
  const parameters = new URLSearchParams({
    api: "1",
    origin: places[0],
    destination: places.at(-1),
    travelmode,
  });
  if (places.length > 2) parameters.set("waypoints", places.slice(1, -1).join("|"));
  return `https://www.google.com/maps/dir/?${parameters}`;
}

const itinerary = {
  title: "Buenos Aires entre clásicos y barrios",
  destination: "Buenos Aires, Argentina",
  startDate: "2026-08-13",
  endDate: "2026-08-15",
  timezone: "America/Argentina/Buenos_Aires",
  lodging: {
    name: "Base provisional en Palermo",
    area: "Palermo, Buenos Aires",
    status: "area_only",
  },
  transport: {
    modes: ["walk", "public_transit", "taxi"],
    hasLicense: false,
    wantsCar: false,
  },
  days: [
    {
      date: "2026-08-13",
      title: "Centro histórico y Corrientes",
      area: "Monserrat · San Nicolás",
      summary: "Una primera mirada a la ciudad, sin apurar el día de llegada.",
      weather: { status: "seasonal", summary: "Fresco; llevar abrigo para la noche." },
      fallback: "Museo del Cabildo si llueve.",
      activities: [
        {
          id: "plaza",
          startTime: "10:30",
          title: "Plaza de Mayo",
          description: "Casa Rosada, Catedral y Cabildo.",
          location: { name: "Plaza de Mayo", address: "Balcarce 50, Buenos Aires, Argentina", latitude: -34.6081, longitude: -58.3702 },
          sourceUrl: "https://turismo.buenosaires.gob.ar/es/otros-establecimientos/plaza-de-mayo",
          guide: {
            overview: "Plaza de Mayo es el centro cívico y simbólico de Buenos Aires: alrededor de ella se concentran la Casa Rosada, el Cabildo y la Catedral Metropolitana. Su forma actual nació al unirse las antiguas plazas de la Victoria y del Fuerte, y desde entonces fue escenario de celebraciones, protestas y momentos decisivos de la vida política argentina.",
            highlights: [
              "Busca la Pirámide de Mayo, el primer monumento patrio de la ciudad.",
              "Las rondas de las Madres de Plaza de Mayo dejaron una marca permanente en este espacio.",
            ],
            sources: [{ label: "Turismo de Buenos Aires", url: "https://turismo.buenosaires.gob.ar/es/otros-establecimientos/plaza-de-mayo", checkedAt: "2026-08-01T12:00:00Z" }],
          },
          travelToNext: { durationMinutes: 12, mode: "walk" },
        },
        {
          id: "tortoni",
          startTime: "13:00",
          title: "Café con historia",
          description: "Café Tortoni y una caminata por Avenida de Mayo.",
          location: { name: "Café Tortoni", address: "Av. de Mayo 825, Buenos Aires, Argentina", latitude: -34.6087, longitude: -58.3782 },
          sourceUrl: "https://www.cafetortoni.com.ar/",
          guide: {
            overview: "Fundado en 1858, el Tortoni es uno de los cafés históricos más reconocibles de Buenos Aires. Sus salones quedaron asociados a escritores, artistas y peñas culturales, y conservan vitrales, mármoles, maderas y retratos que cuentan buena parte de la vida intelectual porteña.",
            highlights: [
              "Mira el salón del fondo y la colección de fotografías antes de sentarte.",
              "La experiencia importa tanto por el edificio y su memoria como por el café.",
            ],
            sources: [{ label: "Café Tortoni", url: "https://www.cafetortoni.com.ar/", checkedAt: "2026-08-01T12:00:00Z" }],
          },
          reservation: { kind: "reservation", requirement: "optional", status: "pending", url: "https://www.cafetortoni.com.ar/", note: "Consultar el canal oficial si prefieren evitar la espera." },
          travelToNext: { durationMinutes: 12, mode: "walk" },
        },
        {
          id: "colon-tour",
          startTime: "16:00",
          title: "Visita guiada al Teatro Colón",
          description: "Recorrido por la sala, el foyer y las galerías.",
          location: { name: "Teatro Colón", address: "Cerrito 628, Buenos Aires, Argentina", latitude: -34.6011, longitude: -58.383 },
          sourceUrl: "https://teatrocolon.org.ar/es/visitas-guiadas",
          guide: {
            overview: "El edificio actual del Teatro Colón abrió en 1908 y combina influencias del academicismo europeo con una sala en forma de herradura. Es célebre por su acústica y por los talleres propios donde se producen escenografías, vestuario y utilería para ópera, ballet y conciertos.",
            highlights: [
              "Observa la cúpula pintada por Raúl Soldi y la disposición de los palcos.",
              "El foyer y el Salón Dorado muestran el carácter ceremonial del teatro más allá de la sala principal.",
            ],
            sources: [{ label: "Teatro Colón", url: "https://teatrocolon.org.ar/es/visitas-guiadas", checkedAt: "2026-08-01T12:00:00Z" }],
          },
          reservation: {
            kind: "ticket",
            requirement: "required",
            status: "pending",
            url: "https://teatrocolon.org.ar/es/visitas-guiadas",
            deadline: "Reservar antes del 8 de agosto",
            note: "La disponibilidad y la política de cambios se confirman en el canal oficial.",
          },
        },
      ],
      route: {
        origin: "Balcarce 50, Buenos Aires, Argentina",
        stops: ["Balcarce 50, Buenos Aires, Argentina", "Av. de Mayo 825, Buenos Aires, Argentina", "Cerrito 628, Buenos Aires, Argentina"],
        returnToLodging: false,
        totalMinutes: 24,
        mapUrl: googleRoute(["Balcarce 50, Buenos Aires, Argentina", "Av. de Mayo 825, Buenos Aires, Argentina", "Cerrito 628, Buenos Aires, Argentina"]),
      },
    },
    {
      date: "2026-08-14",
      title: "San Telmo cotidiano",
      area: "San Telmo · Barracas",
      summary: "Mercado, arquitectura y una noche con música.",
      weather: { status: "seasonal", summary: "Día fresco y potencialmente húmedo." },
      fallback: "Cambiar la caminata por el Museo de Arte Moderno.",
      activities: [
        {
          id: "mercado",
          startTime: "10:00",
          title: "Mercado y pasajes",
          description: "Puestos históricos y comercios de barrio antes del horario más concurrido.",
          location: { name: "Mercado de San Telmo", address: "Carlos Calvo 495, Buenos Aires, Argentina", latitude: -34.621, longitude: -58.3716 },
          sourceUrl: "https://mercadodesantelmo.com/",
          guide: {
            overview: "El Mercado de San Telmo fue inaugurado en 1897 para abastecer a la población creciente del barrio. Su gran estructura de hierro, chapa y vidrio conserva el espíritu de los mercados urbanos de fines del siglo XIX, aunque hoy conviven verdulerías y anticuarios con cafés y cocinas contemporáneas.",
            highlights: [
              "Levanta la vista hacia la cúpula central y la modulación de hierro del edificio.",
              "Los puestos tradicionales permiten ver la diferencia entre el mercado cotidiano y su capa turística más reciente.",
            ],
            sources: [{ label: "Mercado de San Telmo", url: "https://mercadodesantelmo.com/", checkedAt: "2026-08-01T12:00:00Z" }],
          },
          travelToNext: { durationMinutes: 8, mode: "walk" },
        },
        {
          id: "mamba",
          startTime: "12:15",
          title: "Museo de Arte Moderno",
          location: { name: "Museo de Arte Moderno de Buenos Aires", address: "Av. San Juan 350, Buenos Aires, Argentina", latitude: -34.622, longitude: -58.3703 },
          sourceUrl: "https://museomoderno.org/",
          guide: {
            overview: "El Museo de Arte Moderno de Buenos Aires nació en 1956 por iniciativa de Rafael Squirru y fue clave para legitimar nuevas prácticas artísticas en la ciudad. Su sede en una antigua fábrica de tabaco de San Telmo conecta patrimonio industrial con exposiciones de arte argentino e internacional de los siglos XX y XXI.",
            highlights: [
              "Presta atención al diálogo entre la envolvente de ladrillo histórica y la ampliación contemporánea.",
              "La colección ayuda a leer cómo cambiaron las ideas de modernidad y vanguardia en Argentina.",
            ],
            sources: [{ label: "Museo Moderno", url: "https://museomoderno.org/", checkedAt: "2026-08-01T12:00:00Z" }],
          },
          reservation: { kind: "ticket", requirement: "required", status: "confirmed", url: "https://museomoderno.org/", note: "Entrada registrada en Sendero; conservar el comprobante del proveedor." },
          locked: true,
          travelToNext: { durationMinutes: 18, mode: "taxi" },
        },
        {
          id: "usina",
          startTime: "17:00",
          title: "Programación en la Usina del Arte",
          location: { name: "Usina del Arte", address: "Agustín R. Caffarena 1, Buenos Aires, Argentina", latitude: -34.6282, longitude: -58.3578 },
          sourceUrl: "https://usinadelarte.ar/",
          guide: {
            overview: "La Usina del Arte ocupa una antigua central eléctrica levantada para la Compañía Ítalo Argentina de Electricidad en el área portuaria de La Boca. La recuperación del conjunto preservó su monumental fachada de ladrillo y lo convirtió en un centro cultural dedicado a música, artes visuales y actividades familiares.",
            highlights: [
              "La escala de las naves permite reconocer el pasado industrial incluso después de la reconversión.",
              "Su arquitectura de inspiración florentina contrasta con los galpones y la historia obrera del entorno.",
            ],
            sources: [{ label: "Usina del Arte", url: "https://usinadelarte.ar/", checkedAt: "2026-08-01T12:00:00Z" }],
          },
          reservation: { kind: "ticket", requirement: "optional", status: "cancelled", url: "https://usinadelarte.ar/", note: "Marcada como cancelada en Sendero; verificar cualquier gestión real con el organizador." },
        },
      ],
      route: {
        origin: "Carlos Calvo 495, Buenos Aires, Argentina",
        stops: ["Carlos Calvo 495, Buenos Aires, Argentina", "Av. San Juan 350, Buenos Aires, Argentina", "Agustín R. Caffarena 1, Buenos Aires, Argentina"],
        returnToLodging: false,
        totalMinutes: 26,
        mapUrl: googleRoute(["Carlos Calvo 495, Buenos Aires, Argentina", "Av. San Juan 350, Buenos Aires, Argentina", "Agustín R. Caffarena 1, Buenos Aires, Argentina"]),
      },
    },
    {
      date: "2026-08-15",
      title: "Recoleta, jardines y despedida",
      area: "Recoleta · Palermo · Villa Crespo",
      summary: "Arte, un paseo exterior corto y una cena especial.",
      activities: [
        {
          id: "bellas-artes",
          startTime: "10:30",
          title: "Museo Nacional de Bellas Artes",
          location: { name: "Museo Nacional de Bellas Artes", address: "Av. del Libertador 1473, Buenos Aires, Argentina", latitude: -34.583, longitude: -58.3928 },
          sourceUrl: "https://www.bellasartes.gob.ar/",
          guide: {
            overview: "Creado en 1895, el Museo Nacional de Bellas Artes reúne una de las colecciones públicas más importantes de Argentina. Su sede de Recoleta fue adaptada por Alejandro Bustillo a partir de un antiguo edificio de servicios sanitarios, y permite recorrer arte europeo, latinoamericano y argentino en una misma visita.",
            highlights: [
              "Busca las salas de arte argentino para seguir la construcción visual del país entre los siglos XIX y XX.",
              "La entrada principal y las proporciones interiores revelan la intervención racionalista de Bustillo.",
            ],
            sources: [{ label: "Museo Nacional de Bellas Artes", url: "https://www.bellasartes.gob.ar/", checkedAt: "2026-08-01T12:00:00Z" }],
          },
          travelToNext: { durationMinutes: 20, mode: "public_transit" },
        },
        {
          id: "jardin-japones",
          startTime: "14:30",
          title: "Jardín Japonés",
          location: { name: "Jardín Japonés", address: "Av. Casares 3401, Buenos Aires, Argentina", latitude: -34.5753, longitude: -58.4093 },
          sourceUrl: "https://jardinjapones.org.ar/",
          guide: {
            overview: "El Jardín Japonés fue creado en 1967 como expresión de los vínculos entre Japón y Argentina. Más que un parque ornamental, organiza puentes, agua, rocas y vegetación según principios paisajísticos japoneses y funciona también como espacio de difusión cultural.",
            highlights: [
              "Recorre los puentes con calma: las vistas están compuestas para cambiar a medida que avanzas.",
              "Las especies, faroles y elementos simbólicos ayudan a entender el jardín como una secuencia, no como una sola postal.",
            ],
            sources: [{ label: "Jardín Japonés", url: "https://jardinjapones.org.ar/", checkedAt: "2026-08-01T12:00:00Z" }],
          },
          reservation: { kind: "ticket", requirement: "recommended", status: "pending", url: "https://jardinjapones.org.ar/", deadline: "Revisar entradas durante la semana del viaje" },
          travelToNext: { durationMinutes: 18, mode: "taxi" },
        },
        {
          id: "chui-dinner",
          startTime: "20:30",
          title: "Cena de despedida en Chuí",
          location: { name: "Chuí", address: "Loyola 1250, Buenos Aires, Argentina", latitude: -34.5929, longitude: -58.4432 },
          sourceUrl: "https://www.instagram.com/chui.ba/",
          guide: {
            overview: "Chuí propone una cocina centrada en vegetales, fuego y productos de estación dentro de un jardín urbano en Villa Crespo. El espacio y la comida se piensan juntos: mesas al aire libre, vegetación abundante y una cocina visible construyen una experiencia muy distinta a la de un restaurante porteño tradicional.",
            highlights: [
              "Observa cómo el patio y la vegetación funcionan como parte del salón.",
              "El menú cambia con la temporada, por lo que conviene leer la propuesta del día sin buscar platos fijos.",
            ],
            sources: [{ label: "Chuí", url: "https://www.instagram.com/chui.ba/", checkedAt: "2026-08-01T12:00:00Z" }],
          },
          reservation: { kind: "reservation", requirement: "required", status: "pending", url: "https://www.instagram.com/chui.ba/", deadline: "Reservar una semana antes", note: "Confirmar el canal de reservas y la política de cancelación con el restaurante." },
          locked: true,
        },
      ],
      route: {
        origin: "Av. del Libertador 1473, Buenos Aires, Argentina",
        stops: ["Av. del Libertador 1473, Buenos Aires, Argentina", "Av. Casares 3401, Buenos Aires, Argentina", "Loyola 1250, Buenos Aires, Argentina"],
        returnToLodging: false,
        totalMinutes: 38,
        mapUrl: googleRoute(["Av. del Libertador 1473, Buenos Aires, Argentina", "Av. Casares 3401, Buenos Aires, Argentina", "Loyola 1250, Buenos Aires, Argentina"]),
      },
    },
  ],
  sources: [
    { label: "Turismo de Buenos Aires", url: "https://turismo.buenosaires.gob.ar/", checkedAt: "2026-08-01T12:00:00Z" },
    { label: "Teatro Colón", url: "https://teatrocolon.org.ar/es/visitas-guiadas", checkedAt: "2026-08-01T12:00:00Z" },
  ],
};
const publicItinerary = sanitizePublicSnapshot(itinerary);
const proposedExpiresAt = Date.UTC(2026, 8, 24);

function withBridge(html, toolOutput, previewWidgetState = {}) {
  const safeOutput = (JSON.stringify(toolOutput) ?? "undefined").replaceAll("<", "\\u003c");
  const safeWidgetState = JSON.stringify(previewWidgetState).replaceAll("<", "\\u003c");
  const bridge = `<script>{
    const initialToolOutput = ${safeOutput};
    let liveToolOutput = structuredClone(initialToolOutput);
    const requestedTheme = new URLSearchParams(location.search).get("theme");
    const initialTheme = requestedTheme === "dark" || requestedTheme === "light"
      ? requestedTheme
      : (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const persistWidgetState = new URLSearchParams(location.search).has("persist");
    const widgetStateKey = "sendero-preview:" + location.pathname;
    const toolOutputStateKey = widgetStateKey + ":tool-output";
    let initialWidgetState = ${safeWidgetState};
    if (persistWidgetState) {
      try { initialWidgetState = JSON.parse(sessionStorage.getItem(widgetStateKey)) || initialWidgetState; } catch {}
      try { liveToolOutput = JSON.parse(sessionStorage.getItem(toolOutputStateKey)) || liveToolOutput; } catch {}
    }
    window.openai = {
      toolOutput: liveToolOutput,
      theme: initialTheme,
      widgetState: initialWidgetState,
      calls: [],
      heightNotifications: [],
      setWidgetState: function(value) {
        this.widgetState = value;
        if (persistWidgetState) sessionStorage.setItem(widgetStateKey, JSON.stringify(value));
        this.calls.push({ method: "setWidgetState", value });
        queueMicrotask(() => window.dispatchEvent(new CustomEvent("openai:set_globals", {
          detail: { globals: { theme: this.theme, toolOutput: structuredClone(liveToolOutput), widgetState: value } },
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
        if (name === "get_itinerary") {
          const version = liveToolOutput.version || liveToolOutput.currentVersion || 1;
          return {
            structuredContent: {
              id: liveToolOutput.tripId || args.tripId,
              tripId: liveToolOutput.tripId || args.tripId,
              version,
              currentVersion: version,
              role: liveToolOutput.role || "owner",
              itinerary: structuredClone(liveToolOutput.itinerary),
            },
          };
        }
        if (name === "prepare_trip_brief") {
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
        }
        if (name === "update_reservation_status") {
          const targetStatus = args.status || args.reservationStatus;
          if (!new Set(["pending", "confirmed", "cancelled"]).has(targetStatus)) {
            throw new Error("Unsupported preview reservation status");
          }
          const activity = liveToolOutput?.itinerary?.days
            ?.flatMap((day) => day.activities || [])
            .find((item) => item.id === args.activityId);
          if (!activity) throw new Error("Preview activity not found");
          const currentVersion = liveToolOutput.version || liveToolOutput.currentVersion || 1;
          const alreadyApplied = activity.reservation?.status === targetStatus;
          if (!alreadyApplied && args.expectedVersion != null && args.expectedVersion !== currentVersion) {
            throw new Error("Preview version conflict; refresh the itinerary");
          }
          if (!alreadyApplied) {
            activity.reservation = { ...(activity.reservation || {}), status: targetStatus };
            activity.locked = targetStatus === "confirmed" ? true : targetStatus === "cancelled" ? false : activity.locked;
          }
          const version = alreadyApplied ? currentVersion : currentVersion + 1;
          liveToolOutput = {
            ...liveToolOutput,
            itinerary: structuredClone(liveToolOutput.itinerary),
            version,
            currentVersion: version,
          };
          if (persistWidgetState) sessionStorage.setItem(toolOutputStateKey, JSON.stringify(liveToolOutput));
          this.toolOutput = liveToolOutput;
          return {
            structuredContent: {
              tripId: liveToolOutput.tripId || args.tripId,
              version,
              currentVersion: version,
              role: liveToolOutput.role || "owner",
              changed: !alreadyApplied,
              itinerary: structuredClone(liveToolOutput.itinerary),
            },
          };
        }
        throw new Error("Unsupported preview tool");
      },
      notifyIntrinsicHeight: function(height) {
        this.intrinsicHeight = height;
        this.heightNotifications.push(height);
      },
      openExternal: function(value) {
        this.externalUrl = typeof value === "string" ? value : value?.href;
        this.calls.push({ method: "openExternal", value });
      },
    };
    window.setSenderoPreviewTheme = function(theme) {
      if (theme !== "dark" && theme !== "light") return;
      window.openai.theme = theme;
      window.dispatchEvent(new CustomEvent("openai:set_globals", { detail: { globals: { theme } } }));
    };
  }</script>`;
  return html.replace("<body>", `<body>${bridge}`);
}

const itineraryOutput = {
  itinerary,
  validation: { valid: true, warnings: [] },
  tripId: "trip-preview",
  version: 4,
  currentVersion: 4,
  role: "owner",
};

const longTripStart = new Date("2026-12-20T00:00:00Z");
const longTripDays = Array.from({ length: 22 }, (_, index) => {
  const date = new Date(longTripStart);
  date.setUTCDate(longTripStart.getUTCDate() + index);
  const dateKey = date.toISOString().slice(0, 10);
  return {
    date: dateKey,
    title: index === 5 ? "Navidad entre barrios" : index === 11 ? "Último día del año, sin carreras" : `Plan local ${index + 1}`,
    area: index % 2 ? "Roma Norte · Condesa" : "Centro · Juárez",
    summary: "Un día equilibrado, con tiempo para improvisar.",
    activities: [{ id: `long-${index + 1}`, startTime: "10:00", title: `Actividad del día ${index + 1}`, category: "walk" }],
  };
});
const longItineraryOutput = {
  ...itineraryOutput,
  itinerary: {
    ...itinerary,
    title: "Ciudad de México — local, diseño y música",
    destination: "Ciudad de México, México",
    startDate: "2026-12-20",
    endDate: "2027-01-10",
    days: longTripDays,
  },
};

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
  "/itinerary": withBridge(itineraryWidgetHtml, itineraryOutput),
  "/itinerary-calendar": withBridge(itineraryWidgetHtml, itineraryOutput, { activeView: "calendar", selectedCalendarDate: "2026-08-14" }),
  "/itinerary-calendar-long": withBridge(itineraryWidgetHtml, longItineraryOutput, { activeView: "calendar", selectedCalendarDate: "2026-12-31", selectedCalendarMonth: "2026-12" }),
  "/itinerary-reservations": withBridge(itineraryWidgetHtml, itineraryOutput, { activeView: "reservations" }),
  "/itinerary-routes": withBridge(itineraryWidgetHtml, itineraryOutput, { activeView: "routes", selectedRouteDate: "2026-08-14" }),
  "/itinerary-dense": withBridge(itineraryWidgetHtml, itineraryOutput, { activeView: "list", expandedDays: ["2026-08-13", "2026-08-14"] }),
  "/itinerary-warnings": withBridge(itineraryWidgetHtml, {
    ...itineraryOutput,
    validation: {
      valid: true,
      warnings: [
        "Daily routes use a provisional area until an exact address is available.",
        "A venue needs a current official reservation URL.",
        "An activity is missing a routable location.",
      ],
    },
  }),
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
    response.end(JSON.stringify({ share: { itinerary: publicItinerary, sourceVersion: 4, generation: 1, publishedAt: 1787600000000, updatedAt: 1787800000000, expiresAt: 1790200000000 } }));
    return;
  }
  const page = pages[path];
  response.writeHead(page ? 200 : 404, { "Content-Type": "text/html; charset=utf-8" });
  response.end(page || "Not found");
}).listen(port, "127.0.0.1", () => {
  console.log(`Sendero UI preview: http://127.0.0.1:${port}`);
});
