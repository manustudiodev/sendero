import { useEffect, useId, useRef, useState } from "react";
import { DisclosurePanel } from "../DisclosurePanel.jsx";
import { safeExternalUrl } from "../safe-url.js";
import { buildDayRouteUrls, coordinateCoverageForDay, routeStopsForDay } from "./route-utils.js";

const reservationLabels = {
  required: "Necesaria",
  recommended: "Recomendada",
  suggested: "Opcional",
  pending: "Por reservar",
  confirmed: "Confirmada",
  cancelled: "Cancelada",
};

const transportLabels = {
  walk: "a pie",
  public_transit: "transporte público",
  taxi: "taxi / app",
  bike: "bicicleta",
  car: "auto",
  train: "tren",
  boat: "barco",
  other: "otro",
};

const privateViews = [
  { id: "list", label: "Lista" },
  { id: "calendar", label: "Calendario" },
  { id: "routes", label: "Rutas" },
  { id: "reservations", label: "Reservas" },
];

const publicViews = privateViews.filter((view) => view.id !== "reservations");

export function formatItineraryDate(value, options) {
  if (!value) return "";
  try {
    const locale = document.documentElement.lang || "es";
    return new Intl.DateTimeFormat(locale, { timeZone: "UTC", ...options }).format(
      new Date(`${value}T00:00:00Z`),
    );
  } catch {
    return value;
  }
}

function Activity({ activity, onOpenExternal, variant }) {
  const showPrivateStatus = variant !== "public";
  const location = activity.location;
  const sourceUrl = safeExternalUrl(activity.sourceUrl);
  return (
    <li className="activity">
      <time className="activity-time" dateTime={activity.startTime}>{activity.startTime}</time>
      <div>
        <strong>{activity.title}</strong>
        {activity.description ? <p>{activity.description}</p> : null}
        {location ? (
          <p className="activity-location">
            {[location.name, location.address].filter(Boolean).join(" · ")}
          </p>
        ) : null}
        {sourceUrl ? (
          <a
            className="activity-source"
            href={sourceUrl}
            onClick={onOpenExternal ? (event) => { event.preventDefault(); onOpenExternal(sourceUrl); } : undefined}
            rel="noreferrer noopener"
            target="_blank"
          >Fuente oficial ↗</a>
        ) : null}
        <div className="badges">
          {showPrivateStatus && activity.locked ? <span className="badge badge-locked">Fijo</span> : null}
          {showPrivateStatus && activity.reservation?.status && activity.reservation.status !== "not_needed" ? (
            <span className={`badge reservation-status reservation-status-${activity.reservation.status}`}>
              Reserva: {reservationLabels[activity.reservation.status] || activity.reservation.status}
            </span>
          ) : null}
          {activity.travelToNext ? (
            <span className="badge">{activity.travelToNext.durationMinutes} min · {transportLabels[activity.travelToNext.mode] || activity.travelToNext.mode}</span>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function DayContext({ day, onOpenExternal }) {
  const weatherLabel = day.weather?.status === "seasonal"
    ? "Clima estacional"
    : day.weather?.status === "unknown"
      ? "Clima por confirmar"
      : "Clima";
  const context = [
    day.weather?.summary ? {
      checkedAt: day.weather.checkedAt,
      label: weatherLabel,
      missingSource: day.weather.status === "forecast" && !day.weather.sourceUrl,
      sourceUrl: day.weather.sourceUrl,
      value: day.weather.summary,
    } : null,
    day.fallback ? { label: "Alternativa", value: day.fallback } : null,
    day.summary ? { label: "En pocas palabras", value: day.summary } : null,
  ].filter(Boolean);
  if (!context.length) return null;
  return (
    <aside className="day-context" aria-label={`Información útil para ${day.title}`}>
      {context.map((item) => {
        const sourceUrl = safeExternalUrl(item.sourceUrl);
        const checkedAt = item.checkedAt
          ? formatItineraryDate(item.checkedAt.slice(0, 10), { day: "numeric", month: "short" })
          : "";
        return (
        <section className="day-context-item" key={item.label}>
          <b>{item.label}</b>
          <p>{item.value}</p>
          {sourceUrl ? (
            <a
              className="day-context-source"
              href={sourceUrl}
              onClick={onOpenExternal ? (event) => { event.preventDefault(); onOpenExternal(sourceUrl); } : undefined}
              rel="noreferrer noopener"
              target="_blank"
            >Fuente{checkedAt ? ` · ${checkedAt}` : ""} ↗</a>
          ) : item.missingSource ? <small>Fuente por verificar</small> : null}
        </section>
        );
      })}
    </aside>
  );
}

function DayDetails({ day, labelledBy, onOpenExternal, variant }) {
  return (
    <div aria-labelledby={labelledBy} className="day-details" role="region">
      <ol className="timeline">
        {day.activities.map((activity, index) => (
          <Activity activity={activity} key={activity.id || `${day.date}-${index}`} onOpenExternal={onOpenExternal} variant={variant} />
        ))}
      </ol>
      <DayContext day={day} onOpenExternal={onOpenExternal} />
    </div>
  );
}

function DayCard({ day, initiallyOpen, onOpenExternal, variant }) {
  const [open, setOpen] = useState(initiallyOpen);
  const controlId = useId();
  const panelId = `${controlId}-panel`;
  return (
    <article className={`day-card ${open ? "is-open" : ""}`}>
      <h2 className="day-card-title">
        <button
          aria-controls={panelId}
          aria-expanded={open}
          className="day-button"
          id={controlId}
          onClick={() => setOpen((value) => !value)}
          type="button"
        >
          <time className="day-date" dateTime={day.date}>{formatItineraryDate(day.date, { day: "2-digit", month: "short" }).toUpperCase()}</time>
          <span className="day-heading"><strong>{day.title}</strong><span>{day.area}</span></span>
          <span aria-hidden="true" className="disclosure-toggle day-toggle" />
        </button>
      </h2>
      <DisclosurePanel className="day-disclosure" id={panelId} open={open}>
        <DayDetails day={day} labelledBy={controlId} onOpenExternal={onOpenExternal} variant={variant} />
      </DisclosurePanel>
    </article>
  );
}

function ListView({ itinerary, onOpenExternal, variant }) {
  return <div className="days">{itinerary.days.map((day, index) => <DayCard day={day} initiallyOpen={index === 0} key={day.date} onOpenExternal={onOpenExternal} variant={variant} />)}</div>;
}

function useCalendarColumns() {
  const getColumns = () => {
    if (typeof window === "undefined") return 7;
    if (window.innerWidth <= 720) return 2;
    if (window.innerWidth <= 1040) return 4;
    return 7;
  };
  const [columns, setColumns] = useState(getColumns);
  useEffect(() => {
    const update = () => setColumns(getColumns());
    window.addEventListener("resize", update, { passive: true });
    return () => window.removeEventListener("resize", update);
  }, []);
  return columns;
}

function CalendarRow({ columns, currentDate, onOpenExternal, row, selectDate, variant }) {
  const expandedDay = row.find((day) => day.date === currentDate);
  const lastExpandedDay = useRef(expandedDay || null);
  if (expandedDay) lastExpandedDay.current = expandedDay;
  const displayedDay = expandedDay || lastExpandedDay.current;
  const panelId = displayedDay ? `calendar-${displayedDay.date}-panel` : undefined;

  return (
    <section className="calendar-row">
      <div className="calendar-cells" style={{ "--calendar-columns": columns }}>
        {row.map((day) => {
          const open = currentDate === day.date;
          const controlId = `calendar-${day.date}`;
          return (
            <button
              aria-controls={`${controlId}-panel`}
              aria-expanded={open}
              className={`calendar-day ${open ? "is-selected" : ""}`}
              id={controlId}
              key={day.date}
              onClick={() => selectDate(day.date)}
              type="button"
            >
              <time dateTime={day.date}>
                <span>{formatItineraryDate(day.date, { weekday: "short" }).toUpperCase()}</span>
                <strong>{formatItineraryDate(day.date, { day: "numeric" })}</strong>
              </time>
              <p>{day.title}</p>
              <small>{day.area}</small>
              <span aria-hidden="true" className="calendar-toggle disclosure-toggle" />
            </button>
          );
        })}
      </div>
      {displayedDay ? (
        <DisclosurePanel className="calendar-disclosure" id={panelId} open={Boolean(expandedDay)}>
          <div className="calendar-day-detail">
            <DayDetails day={displayedDay} labelledBy={`calendar-${displayedDay.date}`} onOpenExternal={onOpenExternal} variant={variant} />
          </div>
        </DisclosurePanel>
      ) : null}
    </section>
  );
}

function CalendarView({ itinerary, onOpenExternal, onSelectedDateChange, selectedDate, variant }) {
  const [localDate, setLocalDate] = useState("");
  const columns = useCalendarColumns();
  const currentDate = selectedDate ?? localDate;
  const rows = [];
  for (let index = 0; index < itinerary.days.length; index += columns) rows.push(itinerary.days.slice(index, index + columns));

  function selectDate(date) {
    const next = currentDate === date ? "" : date;
    setLocalDate(next);
    onSelectedDateChange?.(next);
  }

  return (
    <div aria-label="Calendario del viaje" className="calendar">
      {rows.map((row) => (
        <CalendarRow
          columns={columns}
          currentDate={currentDate}
          key={row[0]?.date}
          onOpenExternal={onOpenExternal}
          row={row}
          selectDate={selectDate}
          variant={variant}
        />
      ))}
    </div>
  );
}

function RouteLink({ href, label = "Abrir sitio oficial", onOpenExternal }) {
  const safeHref = safeExternalUrl(href);
  if (!safeHref) return null;
  return (
    <a
      className="button button-secondary route-link"
      href={safeHref}
      onClick={onOpenExternal ? (event) => { event.preventDefault(); onOpenExternal(safeHref); } : undefined}
      referrerPolicy="no-referrer"
      rel="noreferrer noopener"
      target="_blank"
    >
      {label} <span aria-hidden="true">↗</span>
    </a>
  );
}

function RouteSchematic({ day, itinerary }) {
  const coverage = coordinateCoverageForDay(itinerary, day);
  if (!coverage.complete) {
    const coverageCopy = coverage.requiredCount
      ? `${coverage.locatedCount} de ${coverage.requiredCount} puntos del recorrido tienen coordenadas. Para no mostrar una ruta parcial, ocultamos el esquema.`
      : "No hay paradas suficientes para dibujar este recorrido.";
    return (
      <div className="route-map-empty">
        <span aria-hidden="true" className="route-map-pin">⌖</span>
        <strong>Mapa completo no disponible</strong>
        <p>{coverageCopy}</p>
      </div>
    );
  }
  const points = coverage.points;
  const minLat = Math.min(...points.map((point) => point.latitude));
  const maxLat = Math.max(...points.map((point) => point.latitude));
  const minLng = Math.min(...points.map((point) => point.longitude));
  const maxLng = Math.max(...points.map((point) => point.longitude));
  const latRange = maxLat - minLat || 1;
  const lngRange = maxLng - minLng || 1;
  const projected = points.map((point) => ({
    ...point,
    x: 12 + ((point.longitude - minLng) / lngRange) * 76,
    y: 88 - ((point.latitude - minLat) / latRange) * 76,
  }));
  return (
    <div className="route-map-graphic">
      <svg aria-label={`Vista esquemática completa de ${points.length} puntos del recorrido`} role="img" viewBox="0 0 100 100">
        <path className="route-map-grid" d="M0 25H100M0 50H100M0 75H100M25 0V100M50 0V100M75 0V100" />
        {projected.length > 1 ? <polyline className="route-map-line" points={projected.map((point) => `${point.x},${point.y}`).join(" ")} /> : null}
        {projected.map((point, index) => (
          <g key={point.id}>
            <circle className="route-map-point" cx={point.x} cy={point.y} r="4.5" />
            <text className="route-map-number" dominantBaseline="middle" textAnchor="middle" x={point.x} y={point.y}>{index + 1}</text>
          </g>
        ))}
      </svg>
      <p>Cobertura completa: {coverage.locatedCount} de {coverage.requiredCount} puntos con coordenadas.</p>
    </div>
  );
}

function RoutesView({ itinerary, onOpenExternal, onSelectedDateChange, selectedDate }) {
  const [localDate, setLocalDate] = useState(itinerary.days[0]?.date || "");
  const validSelectedDate = itinerary.days.some((day) => day.date === selectedDate) ? selectedDate : "";
  const currentDate = validSelectedDate || localDate || itinerary.days[0]?.date;
  const day = itinerary.days.find((candidate) => candidate.date === currentDate) || itinerary.days[0];
  const stops = routeStopsForDay(day);
  const routeUrls = buildDayRouteUrls(itinerary, day);

  function selectDate(date) {
    setLocalDate(date);
    onSelectedDateChange?.(date);
  }

  return (
    <div className="routes-split">
      <nav aria-label="Rutas por día" className="route-list">
        {itinerary.days.map((candidate) => {
          const stopCount = routeStopsForDay(candidate).length;
          return (
            <button
              aria-current={candidate.date === day?.date ? "true" : undefined}
              className={candidate.date === day?.date ? "is-selected" : ""}
              key={candidate.date}
              onClick={() => selectDate(candidate.date)}
              type="button"
            >
              <time dateTime={candidate.date}>{formatItineraryDate(candidate.date, { weekday: "short", day: "numeric", month: "short" })}</time>
              <strong>{candidate.area}</strong>
              <span>{stopCount} {stopCount === 1 ? "parada" : "paradas"}</span>
            </button>
          );
        })}
      </nav>
      {day ? (
        <section className="route-map-panel" aria-label={`Ruta del ${formatItineraryDate(day.date, { day: "numeric", month: "long" })}`}>
          <header>
            <div>
              <p className="eyebrow">{formatItineraryDate(day.date, { weekday: "long", day: "numeric", month: "long" })}</p>
              <h2>{day.title}</h2>
            </div>
            {day.route?.totalMinutes ? <span className="route-duration">{day.route.totalMinutes} min aprox.</span> : null}
          </header>
          <RouteSchematic day={day} itinerary={itinerary} />
          {stops.length ? (
            <ol className="route-stops">
              {stops.map((stop, index) => <li key={`${stop}-${index}`}><span>{index + 1}</span>{stop}</li>)}
            </ol>
          ) : <p className="route-empty">Todavía no hay suficientes ubicaciones para trazar este día.</p>}
          <div className="route-external-links">
            {routeUrls.map((routeUrl, index) => (
              <RouteLink
                href={routeUrl}
                key={routeUrl}
                label={routeUrls.length === 1 ? "Abrir en Google Maps" : `Abrir tramo ${index + 1} en Google Maps`}
                onOpenExternal={onOpenExternal}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function reservationEntries(itinerary) {
  return itinerary.days.flatMap((day) => day.activities.flatMap((activity) => {
    const reservation = activity.reservation;
    if (!reservation || !reservation.status || reservation.status === "not_needed") return [];
    return [{ activity, day, reservation }];
  }));
}

function reservationUrl(entry) {
  return entry.reservation.url || entry.reservation.officialUrl || entry.reservation.bookingUrl || entry.activity.sourceUrl || "";
}

function ReservationActions({ entry, onStatusChange, writable }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!writable || !onStatusChange) return null;
  const status = entry.reservation.status;
  const actions = status === "confirmed"
    ? [{ label: "Marcar cancelada en Sendero", status: "cancelled" }]
    : status === "cancelled"
      ? [{ label: "Marcar por reservar en Sendero", status: "pending" }]
      : status === "suggested"
        ? [{ label: "Marcar por reservar en Sendero", status: "pending" }, { label: "Marcar confirmada en Sendero", status: "confirmed" }]
        : [{ label: "Marcar confirmada en Sendero", status: "confirmed" }];

  async function update(nextStatus) {
    setBusy(true);
    setError("");
    try {
      await onStatusChange({ activityId: entry.activity.id, dayDate: entry.day.date, status: nextStatus });
    } catch (caught) {
      setError(caught?.message || "No pudimos actualizar esta reserva.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="reservation-controls">
      {actions.map((action) => (
        <button className="button button-secondary" disabled={busy} key={action.status} onClick={() => update(action.status)} type="button">
          {busy ? "Actualizando…" : action.label}
        </button>
      ))}
      {error ? <p className="reservation-error" role="alert">{error}</p> : null}
    </div>
  );
}

function ReservationsView({ itinerary, onOpenExternal, onStatusChange, writable }) {
  const entries = reservationEntries(itinerary);
  if (!entries.length) {
    return (
      <div className="reservations-empty">
        <strong>No hay reservas por gestionar</strong>
        <p>Las actividades de este viaje no requieren una reserva registrada.</p>
      </div>
    );
  }
  return (
    <div className="reservations-view">
      <header className="reservations-header">
        <div>
          <p className="eyebrow">Todo en un solo lugar</p>
          <h2>Reservas del viaje</h2>
          <p>Enlaces, fechas y estado actual, sin generar otra respuesta en el chat.</p>
          {writable ? <small>Los controles actualizan Sendero; no compran ni cancelan con el proveedor.</small> : null}
        </div>
        <span>{entries.length} {entries.length === 1 ? "reserva" : "reservas"}</span>
      </header>
      <div className="reservation-list">
        {entries.map((entry, index) => {
          const href = reservationUrl(entry);
          const status = entry.reservation.status;
          return (
            <article className="reservation-card" key={entry.activity.id || `${entry.day.date}-${index}`}>
              <div className="reservation-date">
                <time dateTime={entry.day.date}>{formatItineraryDate(entry.day.date, { weekday: "short", day: "numeric", month: "short" })}</time>
                <span>{entry.activity.startTime}</span>
              </div>
              <div className="reservation-copy">
                <div className="reservation-title-row">
                  <h3>{entry.activity.title}</h3>
                  <span className={`reservation-pill reservation-status-${status}`}>{reservationLabels[status] || status}</span>
                </div>
                {entry.activity.location ? <p>{[entry.activity.location.name, entry.activity.location.address].filter(Boolean).join(" · ")}</p> : null}
                {entry.reservation.deadline ? <p><strong>Reservar antes de:</strong> {entry.reservation.deadline}</p> : null}
                {entry.reservation.note ? <p>{entry.reservation.note}</p> : null}
                <div className="reservation-actions">
                  {href ? <RouteLink href={href} onOpenExternal={onOpenExternal} /> : <span className="reservation-missing-link">Sin enlace oficial verificado</span>}
                  <ReservationActions entry={entry} onStatusChange={onStatusChange} writable={writable} />
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function SourcesPanel({ itinerary, onOpenExternal }) {
  const sources = (itinerary.sources || [])
    .map((source) => ({ ...source, safeUrl: safeExternalUrl(source.url) }))
    .filter((source) => source.safeUrl);
  if (!sources.length) return null;
  return (
    <details className="itinerary-sources">
      <summary>Fuentes verificadas ({sources.length})</summary>
      <ul>
        {sources.map((source) => (
          <li key={`${source.label}-${source.safeUrl}`}>
            <a
              href={source.safeUrl}
              onClick={onOpenExternal ? (event) => { event.preventDefault(); onOpenExternal(source.safeUrl); } : undefined}
              rel="noreferrer noopener"
              target="_blank"
            >{source.label} ↗</a>
            {source.checkedAt ? <small>Comprobada {formatItineraryDate(source.checkedAt.slice(0, 10), { day: "numeric", month: "short" })}</small> : null}
          </li>
        ))}
      </ul>
    </details>
  );
}

export function ItineraryViewer({
  activeView = "list",
  actions,
  itinerary,
  onCalendarDayChange,
  onOpenExternal,
  onReservationStatusChange,
  onRouteDayChange,
  onViewChange,
  reservationWritable = false,
  selectedCalendarDate,
  selectedRouteDate,
  variant = "chat",
}) {
  const viewerId = useId();
  const tabRefs = useRef([]);
  const views = variant === "public" ? publicViews : privateViews;
  const currentView = views.some((view) => view.id === activeView) ? activeView : "list";
  const meta = `${formatItineraryDate(itinerary.startDate, { day: "numeric", month: "long" })} — ${formatItineraryDate(itinerary.endDate, { day: "numeric", month: "long", year: "numeric" })} · ${itinerary.days.length} ${itinerary.days.length === 1 ? "día" : "días"}`;

  function selectView(view, focus = false) {
    onViewChange?.(view.id);
    if (focus) window.requestAnimationFrame(() => tabRefs.current[views.indexOf(view)]?.focus());
  }

  function handleTabKeyDown(event, index) {
    let nextIndex;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % views.length;
    else if (event.key === "ArrowLeft") nextIndex = (index - 1 + views.length) % views.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = views.length - 1;
    else return;
    event.preventDefault();
    selectView(views[nextIndex], true);
  }

  return (
    <div className={`itinerary-viewer itinerary-viewer-${variant}`}>
      <header className="app-header">
        <div className="header-copy">
          <p className="eyebrow">{itinerary.destination}</p>
          <h1>{itinerary.title}</h1>
          <p className="meta">{meta}</p>
        </div>
        <nav aria-label="Vistas del itinerario" className="tabs">
          <div role="tablist">
            {views.map((view, index) => (
              <button
                aria-controls={`${viewerId}-${view.id}-panel`}
                aria-selected={currentView === view.id}
                className={currentView === view.id ? "is-active" : ""}
                id={`${viewerId}-${view.id}-tab`}
                key={view.id}
                onClick={() => selectView(view)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
                ref={(node) => { tabRefs.current[index] = node; }}
                role="tab"
                tabIndex={currentView === view.id ? 0 : -1}
                type="button"
              >
                {view.label}
              </button>
            ))}
          </div>
        </nav>
      </header>
      <section className="content">
        <div
          aria-labelledby={`${viewerId}-${currentView}-tab`}
          id={`${viewerId}-${currentView}-panel`}
          role="tabpanel"
          tabIndex="0"
        >
          {currentView === "calendar" ? (
            <CalendarView itinerary={itinerary} onOpenExternal={onOpenExternal} onSelectedDateChange={onCalendarDayChange} selectedDate={selectedCalendarDate} variant={variant} />
          ) : currentView === "routes" ? (
            <RoutesView itinerary={itinerary} onOpenExternal={onOpenExternal} onSelectedDateChange={onRouteDayChange} selectedDate={selectedRouteDate} />
          ) : currentView === "reservations" ? (
            <ReservationsView itinerary={itinerary} onOpenExternal={onOpenExternal} onStatusChange={onReservationStatusChange} writable={reservationWritable} />
          ) : <ListView itinerary={itinerary} onOpenExternal={onOpenExternal} variant={variant} />}
        </div>
        <SourcesPanel itinerary={itinerary} onOpenExternal={onOpenExternal} />
        {actions ? <div className="action-bar">{actions}</div> : null}
      </section>
    </div>
  );
}
