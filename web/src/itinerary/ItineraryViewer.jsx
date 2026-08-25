import { useId, useRef, useState } from "react";
import { InlineNotice } from "../components.jsx";

const reservationLabels = {
  required: "necesaria",
  recommended: "recomendada",
  suggested: "sugerida",
  pending: "pendiente",
  confirmed: "confirmada",
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

const views = [
  { id: "list", label: "Lista" },
  { id: "calendar", label: "Calendario" },
  { id: "routes", label: "Rutas" },
];

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

function Activity({ activity, variant }) {
  const showPrivateStatus = variant !== "public";
  const location = activity.location;
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
        <div className="badges">
          {showPrivateStatus && activity.locked ? <span className="badge badge-locked">Fijo</span> : null}
          {showPrivateStatus && activity.reservation?.status && activity.reservation.status !== "not_needed" ? (
            <span className="badge">Reserva: {reservationLabels[activity.reservation.status] || activity.reservation.status}</span>
          ) : null}
          {activity.travelToNext ? (
            <span className="badge">{activity.travelToNext.durationMinutes} min · {transportLabels[activity.travelToNext.mode] || activity.travelToNext.mode}</span>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function DayCard({ day, initiallyOpen, variant }) {
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
          <span aria-hidden="true" className="day-toggle">{open ? "−" : "+"}</span>
        </button>
      </h2>
      {open ? (
        <div aria-labelledby={controlId} className="day-details" id={panelId} role="region">
          <ol className="timeline">{day.activities.map((activity, index) => <Activity activity={activity} key={activity.id || `${day.date}-${index}`} variant={variant} />)}</ol>
          <aside className="aside" aria-label={`Información útil para ${day.title}`}>
            {day.weather ? <section><b>Clima</b><p>{day.weather.summary}</p></section> : null}
            {day.fallback ? <section><b>Alternativa</b><p>{day.fallback}</p></section> : null}
            {day.summary ? <section><b>En pocas palabras</b><p>{day.summary}</p></section> : null}
          </aside>
        </div>
      ) : null}
    </article>
  );
}

function ListView({ itinerary, variant }) {
  return <div className="days">{itinerary.days.map((day, index) => <DayCard day={day} initiallyOpen={index === 0} key={day.date} variant={variant} />)}</div>;
}

function CalendarView({ itinerary }) {
  return (
    <div aria-label="Calendario del viaje" className="calendar">
      {itinerary.days.map((day) => (
        <article className="calendar-day" key={day.date}>
          <time dateTime={day.date}>
            <span>{formatItineraryDate(day.date, { weekday: "short" }).toUpperCase()}</span>
            <strong>{formatItineraryDate(day.date, { day: "numeric" })}</strong>
          </time>
          <p>{day.title}</p>
          <small>{day.area}</small>
        </article>
      ))}
    </div>
  );
}

function RouteLink({ href, onOpenExternal }) {
  if (!href) return null;
  return (
    <a
      className="button button-secondary route-link"
      href={href}
      onClick={onOpenExternal ? (event) => { event.preventDefault(); onOpenExternal(href); } : undefined}
      referrerPolicy="no-referrer"
      rel="noreferrer noopener"
      target="_blank"
    >
      Abrir ruta completa <span aria-hidden="true">↗</span>
    </a>
  );
}

function RoutesView({ itinerary, onOpenExternal }) {
  return (
    <div className="routes">
      {itinerary.days.map((day) => {
        const stops = day.route?.stops?.length ? day.route.stops : [];
        return (
          <article className="route-card" key={day.date}>
            <time className="day-date" dateTime={day.date}>{formatItineraryDate(day.date, { weekday: "long", day: "numeric", month: "short" }).toUpperCase()}</time>
            <h2>{day.area}</h2>
            {stops.length ? (
              <ol>{stops.map((stop, index) => <li key={`${stop}-${index}`}>{stop}</li>)}</ol>
            ) : <p className="route-empty">Todavía no hay suficientes ubicaciones para trazar este día.</p>}
            {day.route?.totalMinutes ? <p className="route-duration">Tiempo estimado: {day.route.totalMinutes} min</p> : null}
            <RouteLink href={day.route?.mapUrl} onOpenExternal={onOpenExternal} />
          </article>
        );
      })}
    </div>
  );
}

export function ItineraryViewer({
  activeView = "list",
  actions,
  itinerary,
  onOpenExternal,
  onViewChange,
  variant = "chat",
  warnings = [],
}) {
  const viewerId = useId();
  const tabRefs = useRef([]);
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
        {warnings.length ? <InlineNotice tone="warning"><ul className="warning-list">{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></InlineNotice> : null}
        <div
          aria-labelledby={`${viewerId}-${currentView}-tab`}
          id={`${viewerId}-${currentView}-panel`}
          role="tabpanel"
          tabIndex="0"
        >
          {currentView === "calendar" ? <CalendarView itinerary={itinerary} /> : currentView === "routes" ? <RoutesView itinerary={itinerary} onOpenExternal={onOpenExternal} /> : <ListView itinerary={itinerary} variant={variant} />}
        </div>
        {actions ? <div className="action-bar">{actions}</div> : null}
      </section>
    </div>
  );
}
