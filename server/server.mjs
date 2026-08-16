import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export const ITINERARY_UI_URI = "ui://sendero/itinerary-v1.html";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const isoTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM");
const url = z.string().url();

const transportMode = z.enum([
  "walk",
  "bike",
  "public_transit",
  "taxi",
  "car",
  "train",
  "boat",
  "other",
]);

const locationSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
});

const reservationSchema = z.object({
  status: z.enum(["not_needed", "suggested", "pending", "confirmed"]),
  url: url.optional(),
  deadline: z.string().optional(),
  note: z.string().optional(),
});

const activitySchema = z.object({
  id: z.string().min(1),
  startTime: isoTime,
  endTime: isoTime.optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  locked: z.boolean().optional(),
  location: locationSchema.optional(),
  sourceUrl: url.optional(),
  reservation: reservationSchema.optional(),
  travelToNext: z
    .object({
      mode: transportMode,
      durationMinutes: z.number().int().nonnegative(),
      summary: z.string().optional(),
    })
    .optional(),
});

const routeSchema = z.object({
  origin: z.string().min(1),
  stops: z.array(z.string().min(1)),
  returnToLodging: z.boolean(),
  totalMinutes: z.number().int().nonnegative().optional(),
  mapUrl: url.optional(),
});

const daySchema = z.object({
  date: isoDate,
  title: z.string().min(1),
  area: z.string().min(1),
  summary: z.string().optional(),
  weather: z
    .object({
      status: z.enum(["forecast", "seasonal", "unknown"]),
      summary: z.string().min(1),
      sourceUrl: url.optional(),
      checkedAt: z.string().optional(),
    })
    .optional(),
  fallback: z.string().optional(),
  activities: z.array(activitySchema),
  route: routeSchema.optional(),
});

export const itinerarySchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  destination: z.string().min(1),
  startDate: isoDate,
  endDate: isoDate,
  lodging: locationSchema.optional(),
  transport: z.object({
    modes: z.array(transportMode).min(1),
    hasLicense: z.boolean(),
    wantsCar: z.boolean(),
  }),
  days: z.array(daySchema).min(1),
  sources: z
    .array(
      z.object({
        label: z.string().min(1),
        url,
        checkedAt: z.string().optional(),
      }),
    )
    .optional(),
});

const tripBriefSchema = z.object({
  destination: z.string().optional(),
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
  lodging: locationSchema.optional(),
  travellers: z
    .object({
      adults: z.number().int().positive(),
      children: z.number().int().nonnegative().optional(),
    })
    .optional(),
  budget: z.enum(["low", "medium", "high", "flexible"]).optional(),
  pace: z.enum(["relaxed", "balanced", "intense"]).optional(),
  interests: z.array(z.string()).optional(),
  mustDo: z.array(z.string()).optional(),
  avoid: z.array(z.string()).optional(),
  dietaryNeeds: z.array(z.string()).optional(),
  accessibilityNeeds: z.array(z.string()).optional(),
  transport: z
    .object({
      modes: z.array(transportMode),
      hasLicense: z.boolean(),
      wantsCar: z.boolean(),
    })
    .optional(),
  fixedPlans: z
    .array(
      z.object({
        date: isoDate,
        startTime: isoTime.optional(),
        endTime: isoTime.optional(),
        title: z.string().min(1),
        reservationStatus: z.enum(["pending", "confirmed"]).optional(),
      }),
    )
    .optional(),
  notes: z.string().optional(),
});

const validationSchema = z.object({
  valid: z.boolean(),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
});

function minutes(time) {
  const [hours, mins] = time.split(":").map(Number);
  return hours * 60 + mins;
}

function dateInRange(date, start, end) {
  return date >= start && date <= end;
}

function googleTravelMode(mode) {
  if (mode === "walk") return "walking";
  if (mode === "bike") return "bicycling";
  if (mode === "public_transit" || mode === "train") return "transit";
  return "driving";
}

export function buildDailyRouteUrl(itinerary, day) {
  const lodgingAddress = itinerary.lodging?.address;
  const route = day.route;
  const origin = route?.origin || lodgingAddress;
  const activityStops = day.activities
    .map((activity) => activity.location?.address || activity.location?.name)
    .filter(Boolean);
  const stops = route?.stops?.length ? route.stops : activityStops;

  if (!origin || stops.length === 0) return undefined;

  const returnToLodging = route?.returnToLodging ?? true;
  const destination = returnToLodging && lodgingAddress ? lodgingAddress : stops.at(-1);
  const waypoints = returnToLodging ? stops : stops.slice(0, -1);
  const preferredMode = itinerary.transport.modes.find((mode) =>
    ["walk", "bike", "public_transit", "train", "taxi", "car"].includes(mode),
  );
  const params = new URLSearchParams({
    api: "1",
    origin,
    destination,
    travelmode: googleTravelMode(preferredMode || "public_transit"),
  });
  if (waypoints.length) params.set("waypoints", waypoints.join("|"));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function normalizeItinerary(itinerary) {
  return {
    ...itinerary,
    days: [...itinerary.days]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((day) => ({
        ...day,
        activities: [...day.activities].sort((a, b) => a.startTime.localeCompare(b.startTime)),
        route: {
          origin: day.route?.origin || itinerary.lodging?.address || itinerary.destination,
          stops:
            day.route?.stops?.length
              ? day.route.stops
              : day.activities
                  .map((activity) => activity.location?.address || activity.location?.name)
                  .filter(Boolean),
          returnToLodging: day.route?.returnToLodging ?? true,
          ...(day.route?.totalMinutes !== undefined
            ? { totalMinutes: day.route.totalMinutes }
            : {}),
          ...(day.route?.mapUrl || buildDailyRouteUrl(itinerary, day)
            ? { mapUrl: day.route?.mapUrl || buildDailyRouteUrl(itinerary, day) }
            : {}),
        },
      })),
  };
}

export function validateItinerary(itinerary) {
  const errors = [];
  const warnings = [];

  if (itinerary.startDate > itinerary.endDate) {
    errors.push("The trip start date is after the end date.");
  }
  if (
    (itinerary.transport.wantsCar || itinerary.transport.modes.includes("car")) &&
    !itinerary.transport.hasLicense
  ) {
    errors.push("The plan includes a car even though no valid driving license is available.");
  }
  if (!itinerary.lodging?.address) {
    warnings.push("Add the lodging address to calculate useful daily routes and travel times.");
  }

  const seenDates = new Set();
  let previousDate = "";
  for (const day of itinerary.days) {
    if (!dateInRange(day.date, itinerary.startDate, itinerary.endDate)) {
      errors.push(`${day.date}: day falls outside the trip dates.`);
    }
    if (seenDates.has(day.date)) errors.push(`${day.date}: duplicate itinerary day.`);
    seenDates.add(day.date);
    if (previousDate && day.date < previousDate) {
      warnings.push("Itinerary days are not in chronological order.");
    }
    previousDate = day.date;

    const intervals = [];
    for (const activity of day.activities) {
      if (activity.endTime && minutes(activity.endTime) <= minutes(activity.startTime)) {
        errors.push(`${day.date} · ${activity.title}: end time must be after start time.`);
      }
      if (activity.endTime) {
        intervals.push({
          title: activity.title,
          start: minutes(activity.startTime),
          end: minutes(activity.endTime),
        });
      }
      if (!activity.location && !["rest", "free_time"].includes(activity.category || "")) {
        warnings.push(`${day.date} · ${activity.title}: add a location for route planning.`);
      }
      if (
        ["suggested", "pending"].includes(activity.reservation?.status || "") &&
        !activity.reservation?.url
      ) {
        warnings.push(`${day.date} · ${activity.title}: reservation needs an official URL.`);
      }
      if (activity.reservation?.status === "confirmed" && !activity.locked) {
        warnings.push(`${day.date} · ${activity.title}: confirmed reservation should normally be locked.`);
      }
    }

    intervals.sort((a, b) => a.start - b.start);
    for (let index = 1; index < intervals.length; index += 1) {
      if (intervals[index].start < intervals[index - 1].end) {
        errors.push(
          `${day.date}: ${intervals[index - 1].title} overlaps ${intervals[index].title}.`,
        );
      }
    }

    if (day.weather && day.weather.status !== "unknown" && !day.weather.sourceUrl) {
      warnings.push(`${day.date}: weather information has no source URL.`);
    }
    if (!day.fallback && day.weather?.summary) {
      warnings.push(`${day.date}: add a weather or capacity fallback.`);
    }
  }

  return { valid: errors.length === 0, errors, warnings: [...new Set(warnings)] };
}

function prepareTripBrief(brief) {
  const missing = [];
  const warnings = [];
  if (!brief.destination) missing.push("destination");
  if (!brief.startDate) missing.push("startDate");
  if (!brief.endDate) missing.push("endDate");
  if (!brief.lodging?.address) missing.push("lodging.address");
  if (!brief.travellers?.adults) missing.push("travellers.adults");
  if (!brief.transport?.modes?.length) missing.push("transport.modes");
  if (brief.transport?.wantsCar && !brief.transport.hasLicense) {
    warnings.push("A car was requested but no valid driving license is available.");
  }
  if (brief.startDate && brief.endDate && brief.startDate > brief.endDate) {
    warnings.push("The start date is after the end date.");
  }

  return {
    ready: missing.length === 0 && warnings.length === 0,
    missing,
    warnings,
    brief: {
      budget: "flexible",
      pace: "balanced",
      interests: [],
      mustDo: [],
      avoid: [],
      dietaryNeeds: [],
      accessibilityNeeds: [],
      fixedPlans: [],
      ...brief,
    },
  };
}

const widgetHtml = String.raw`<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root { color-scheme: light; --ink:#202124; --muted:#777874; --line:#e8e8e6; --soft:#f7f7f5; --blue:#2383e2; --lime:#d7f064; }
      * { box-sizing:border-box; }
      body { margin:0; background:#fff; color:var(--ink); font:14px/1.45 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      button, a { font:inherit; }
      .shell { min-height:320px; padding:20px; }
      .header { display:flex; align-items:flex-end; justify-content:space-between; gap:20px; padding-bottom:18px; border-bottom:1px solid var(--line); }
      .eyebrow { margin:0 0 6px; color:var(--muted); font-size:11px; text-transform:uppercase; letter-spacing:.08em; }
      h1 { margin:0; font-size:clamp(24px,4vw,38px); line-height:1; letter-spacing:-.04em; font-weight:650; }
      .meta { margin:9px 0 0; color:var(--muted); font-size:12px; }
      .tabs { display:flex; gap:3px; padding:3px; border-radius:10px; background:var(--soft); }
      .tab { border:0; border-radius:8px; padding:8px 12px; background:transparent; color:var(--muted); cursor:pointer; }
      .tab.active { background:#fff; color:var(--ink); box-shadow:0 1px 3px rgba(15,15,15,.1); }
      .view { padding-top:18px; }
      .days { display:grid; gap:9px; }
      .day { border:1px solid var(--line); border-radius:14px; overflow:hidden; }
      .day-head { width:100%; display:grid; grid-template-columns:72px minmax(0,1fr) auto; gap:14px; align-items:center; padding:15px; border:0; background:#fff; text-align:left; cursor:pointer; }
      .day-head:hover { background:#fbfbfa; }
      .date { color:var(--muted); font-size:10px; font-weight:650; }
      .day-title { display:grid; gap:3px; }
      .day-title strong { font-size:15px; letter-spacing:-.01em; }
      .day-title span { color:var(--muted); font-size:11px; }
      .chevron { width:28px; height:28px; display:grid; place-items:center; border-radius:50%; background:var(--soft); }
      .day.open .chevron { background:var(--lime); }
      .details { display:none; grid-template-columns:minmax(0,1.3fr) minmax(210px,.7fr); gap:24px; padding:18px 15px 20px 101px; border-top:1px solid var(--line); }
      .day.open .details { display:grid; }
      .timeline { display:grid; gap:10px; }
      .activity { display:grid; grid-template-columns:66px minmax(0,1fr); gap:12px; }
      .time { align-self:start; padding:6px 7px; border-radius:8px; background:var(--soft); text-align:center; font-size:10px; }
      .activity strong { display:block; margin:3px 0; font-size:12px; }
      .activity p, .aside p { margin:3px 0 0; color:var(--muted); font-size:10px; }
      .badges { display:flex; flex-wrap:wrap; gap:5px; margin-top:6px; }
      .badge { padding:3px 6px; border-radius:99px; background:var(--soft); color:var(--muted); font-size:8px; }
      .badge.locked { background:#f3f7e4; color:#4d5e1c; }
      .aside { display:grid; gap:9px; align-content:start; }
      .aside section { padding:12px; border-radius:11px; background:var(--soft); }
      .aside b { font-size:9px; text-transform:uppercase; letter-spacing:.06em; }
      .calendar { display:grid; grid-template-columns:repeat(7,minmax(90px,1fr)); gap:1px; overflow:auto; border:1px solid var(--line); border-radius:14px; background:var(--line); }
      .calendar-day { min-height:118px; padding:12px; background:#fff; }
      .calendar-day span { color:var(--muted); font-size:9px; }
      .calendar-day strong { display:block; margin:8px 0 18px; font-size:28px; letter-spacing:-.04em; }
      .calendar-day p { margin:0; font-size:10px; font-weight:600; }
      .routes { display:grid; grid-template-columns:repeat(auto-fit,minmax(230px,1fr)); gap:10px; }
      .route { display:flex; flex-direction:column; min-height:190px; padding:16px; border:1px solid var(--line); border-radius:14px; }
      .route h2 { margin:6px 0 12px; font-size:17px; letter-spacing:-.02em; }
      .stops { margin:0; padding:0; list-style:none; display:grid; gap:7px; color:var(--muted); font-size:10px; }
      .stops li::before { content:"•"; color:var(--blue); margin-right:7px; }
      .route a { margin-top:auto; padding-top:14px; color:var(--blue); font-size:11px; font-weight:600; text-decoration:none; }
      .empty { padding:40px 0; color:var(--muted); text-align:center; }
      @media (max-width:720px) { .header { align-items:flex-start; flex-direction:column; } .details { grid-template-columns:1fr; padding-left:15px; } .calendar { grid-template-columns:repeat(2,minmax(130px,1fr)); } }
    </style>
  </head>
  <body>
    <main class="shell">
      <header class="header">
        <div><p class="eyebrow" id="destination">Itinerario</p><h1 id="title">Preparando tu viaje…</h1><p class="meta" id="meta"></p></div>
        <nav class="tabs" aria-label="Vistas del itinerario">
          <button class="tab active" data-view="list" type="button">Lista</button>
          <button class="tab" data-view="calendar" type="button">Calendario</button>
          <button class="tab" data-view="map" type="button">Mapa</button>
        </nav>
      </header>
      <section class="view" id="view"><p class="empty">Esperando el itinerario…</p></section>
    </main>
    <script>
      const view = document.getElementById("view");
      const title = document.getElementById("title");
      const destination = document.getElementById("destination");
      const meta = document.getElementById("meta");
      let itinerary;
      let activeView = window.openai?.widgetState?.activeView || "list";

      function node(tag, className, text) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (text !== undefined) element.textContent = String(text);
        return element;
      }

      function formatDate(value, options) {
        try { return new Intl.DateTimeFormat(document.documentElement.lang || "es", options).format(new Date(value + "T12:00:00")); }
        catch { return value; }
      }

      function renderList() {
        const container = node("div", "days");
        itinerary.days.forEach((day, index) => {
          const card = node("article", "day" + (index === 0 ? " open" : ""));
          const head = node("button", "day-head"); head.type = "button";
          head.append(node("span", "date", formatDate(day.date, { day:"2-digit", month:"short" }).toUpperCase()));
          const heading = node("span", "day-title");
          heading.append(node("strong", "", day.title), node("span", "", day.area));
          head.append(heading, node("span", "chevron", index === 0 ? "−" : "+"));
          head.onclick = () => {
            card.classList.toggle("open");
            head.lastChild.textContent = card.classList.contains("open") ? "−" : "+";
          };

          const details = node("div", "details");
          const timeline = node("div", "timeline");
          day.activities.forEach((activity) => {
            const row = node("div", "activity");
            row.append(node("span", "time", activity.startTime));
            const body = node("div"); body.append(node("strong", "", activity.title));
            if (activity.description) body.append(node("p", "", activity.description));
            if (activity.location) body.append(node("p", "", activity.location.name + " · " + activity.location.address));
            const badges = node("div", "badges");
            if (activity.locked) badges.append(node("span", "badge locked", "Fijo"));
            if (activity.reservation?.status && activity.reservation.status !== "not_needed") badges.append(node("span", "badge", "Reserva: " + activity.reservation.status));
            if (activity.travelToNext) badges.append(node("span", "badge", activity.travelToNext.durationMinutes + " min · " + activity.travelToNext.mode));
            if (badges.childNodes.length) body.append(badges);
            row.append(body); timeline.append(row);
          });
          const aside = node("aside", "aside");
          if (day.weather) { const section = node("section"); section.append(node("b", "", "Clima"), node("p", "", day.weather.summary)); aside.append(section); }
          if (day.fallback) { const section = node("section"); section.append(node("b", "", "Alternativa"), node("p", "", day.fallback)); aside.append(section); }
          if (day.summary) { const section = node("section"); section.append(node("b", "", "En pocas palabras"), node("p", "", day.summary)); aside.append(section); }
          details.append(timeline, aside); card.append(head, details); container.append(card);
        });
        view.replaceChildren(container);
      }

      function renderCalendar() {
        const calendar = node("div", "calendar");
        itinerary.days.forEach((day) => {
          const cell = node("article", "calendar-day");
          cell.append(node("span", "", formatDate(day.date, { weekday:"short" }).toUpperCase()));
          cell.append(node("strong", "", formatDate(day.date, { day:"numeric" })));
          cell.append(node("p", "", day.title));
          calendar.append(cell);
        });
        view.replaceChildren(calendar);
      }

      function renderMap() {
        const routes = node("div", "routes");
        itinerary.days.forEach((day) => {
          const route = node("article", "route");
          route.append(node("span", "date", formatDate(day.date, { weekday:"long", day:"numeric", month:"short" }).toUpperCase()));
          route.append(node("h2", "", day.area));
          const stops = node("ol", "stops");
          (day.route?.stops || []).forEach((stop) => stops.append(node("li", "", stop)));
          if (!stops.childNodes.length) stops.append(node("li", "", "Faltan ubicaciones para calcular la ruta"));
          route.append(stops);
          if (day.route?.mapUrl) {
            const link = node("a", "", "Abrir ruta completa ↗");
            link.href = day.route.mapUrl; link.target = "_blank"; link.rel = "noreferrer";
            route.append(link);
          }
          routes.append(route);
        });
        view.replaceChildren(routes);
      }

      function setView(next) {
        activeView = next;
        document.querySelectorAll(".tab").forEach((button) => button.classList.toggle("active", button.dataset.view === next));
        window.openai?.setWidgetState?.({ activeView: next });
        if (!itinerary) return;
        if (next === "calendar") renderCalendar(); else if (next === "map") renderMap(); else renderList();
      }

      function render(data) {
        itinerary = data?.itinerary;
        if (!itinerary) return;
        title.textContent = itinerary.title;
        destination.textContent = itinerary.destination;
        meta.textContent = formatDate(itinerary.startDate, { day:"numeric", month:"long" }) + " — " + formatDate(itinerary.endDate, { day:"numeric", month:"long", year:"numeric" }) + " · " + itinerary.days.length + " días";
        setView(activeView);
      }

      document.querySelectorAll(".tab").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
      window.addEventListener("message", (event) => {
        if (event.source !== window.parent) return;
        const message = event.data;
        if (!message || message.jsonrpc !== "2.0") return;
        if (message.method === "ui/notifications/tool-result") render(message.params?.structuredContent);
      }, { passive:true });
      setView(activeView);
    </script>
  </body>
</html>`;

export function createTripPlannerServer() {
  const server = new McpServer(
    { name: "sendero", version: "0.1.0" },
    {
      instructions:
        "Use prepare_trip_brief before planning, validate_itinerary before presenting, and render_itinerary once with the final snapshot. Preserve locked activities and confirmed reservations during changes. Never claim a forecast, event, schedule, route, or reservation is confirmed without a current source.",
    },
  );

  server.registerResource("itinerary-ui", ITINERARY_UI_URI, {}, async () => ({
    contents: [
      {
        uri: ITINERARY_UI_URI,
        mimeType: "text/html;profile=mcp-app",
        text: widgetHtml,
        _meta: { ui: { prefersBorder: false } },
      },
    ],
  }));

  server.registerTool(
    "prepare_trip_brief",
    {
      title: "Prepare trip brief",
      description:
        "Normalize the user's travel requirements and identify critical missing details before researching or scheduling the trip.",
      inputSchema: { brief: tripBriefSchema },
      outputSchema: {
        ready: z.boolean(),
        missing: z.array(z.string()),
        warnings: z.array(z.string()),
        brief: tripBriefSchema,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async ({ brief }) => {
      const result = prepareTripBrief(brief);
      return {
        structuredContent: result,
        content: [
          {
            type: "text",
            text: result.ready
              ? "The trip brief is ready for research and planning."
              : `The trip brief still needs: ${[...result.missing, ...result.warnings].join(", ")}.`,
          },
        ],
      };
    },
  );

  server.registerTool(
    "validate_itinerary",
    {
      title: "Validate itinerary",
      description:
        "Check a complete itinerary for date, transport, overlap, reservation, sourcing, location, and route problems before showing it.",
      inputSchema: { itinerary: itinerarySchema },
      outputSchema: { itinerary: itinerarySchema, validation: validationSchema },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async ({ itinerary }) => {
      const validation = validateItinerary(itinerary);
      const normalized = normalizeItinerary(itinerary);
      return {
        structuredContent: { itinerary: normalized, validation },
        content: [
          {
            type: "text",
            text: validation.valid
              ? `Itinerary is valid with ${validation.warnings.length} warning(s).`
              : `Itinerary has ${validation.errors.length} blocking issue(s) and ${validation.warnings.length} warning(s).`,
          },
        ],
      };
    },
  );

  server.registerTool(
    "render_itinerary",
    {
      title: "Render itinerary",
      description:
        "Render the final, already validated itinerary as an interactive list, calendar, and daily route view. Always call validate_itinerary first.",
      inputSchema: { itinerary: itinerarySchema },
      outputSchema: { itinerary: itinerarySchema, validation: validationSchema },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      _meta: {
        ui: { resourceUri: ITINERARY_UI_URI },
        "openai/toolInvocation/invoking": "Preparing itinerary…",
        "openai/toolInvocation/invoked": "Itinerary ready.",
      },
    },
    async ({ itinerary }) => {
      const normalized = normalizeItinerary(itinerary);
      const validation = validateItinerary(normalized);
      return {
        structuredContent: { itinerary: normalized, validation },
        content: [
          {
            type: "text",
            text: `Showing ${normalized.days.length} itinerary day(s) for ${normalized.destination}.`,
          },
        ],
      };
    },
  );

  return server;
}
