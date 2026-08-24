import { useEffect, useMemo, useState } from "react";
import { Button, InlineNotice } from "../components.jsx";
import { openExternal, sendFollowUpMessage, setWidgetState, useToolOutput, widgetState } from "../bridge.js";

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
};

function formatDate(value, options) {
  try {
    const locale = document.documentElement.lang || "es";
    return new Intl.DateTimeFormat(locale, options).format(new Date(`${value}T12:00:00`));
  } catch {
    return value;
  }
}

function Activity({ activity }) {
  return (
    <div className="activity">
      <span className="activity-time">{activity.startTime}</span>
      <div>
        <strong>{activity.title}</strong>
        {activity.description ? <p>{activity.description}</p> : null}
        {activity.location ? <p>{activity.location.name} · {activity.location.address}</p> : null}
        <div className="badges">
          {activity.locked ? <span className="badge badge-locked">Fijo</span> : null}
          {activity.reservation?.status && activity.reservation.status !== "not_needed" ? (
            <span className="badge">Reserva: {reservationLabels[activity.reservation.status] || activity.reservation.status}</span>
          ) : null}
          {activity.travelToNext ? (
            <span className="badge">{activity.travelToNext.durationMinutes} min · {transportLabels[activity.travelToNext.mode] || activity.travelToNext.mode}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DayCard({ day, initiallyOpen }) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <article className={`day-card ${open ? "is-open" : ""}`}>
      <button className="day-button" onClick={() => setOpen((value) => !value)} type="button">
        <span className="day-date">{formatDate(day.date, { day: "2-digit", month: "short" }).toUpperCase()}</span>
        <span className="day-heading"><strong>{day.title}</strong><span>{day.area}</span></span>
        <span className="day-toggle">{open ? "−" : "+"}</span>
      </button>
      {open ? (
        <div className="day-details">
          <div className="timeline">{day.activities.map((activity) => <Activity activity={activity} key={activity.id} />)}</div>
          <aside className="aside">
            {day.weather ? <section><b>Clima</b><p>{day.weather.summary}</p></section> : null}
            {day.fallback ? <section><b>Alternativa</b><p>{day.fallback}</p></section> : null}
            {day.summary ? <section><b>En pocas palabras</b><p>{day.summary}</p></section> : null}
          </aside>
        </div>
      ) : null}
    </article>
  );
}

function ListView({ itinerary }) {
  return <div className="days">{itinerary.days.map((day, index) => <DayCard day={day} initiallyOpen={index === 0} key={day.date} />)}</div>;
}

function CalendarView({ itinerary }) {
  return (
    <div className="calendar">
      {itinerary.days.map((day) => (
        <article className="calendar-day" key={day.date}>
          <span>{formatDate(day.date, { weekday: "short" }).toUpperCase()}</span>
          <strong>{formatDate(day.date, { day: "numeric" })}</strong>
          <p>{day.title}</p>
        </article>
      ))}
    </div>
  );
}

function RoutesView({ itinerary }) {
  return (
    <div className="routes">
      {itinerary.days.map((day) => (
        <article className="route-card" key={day.date}>
          <span className="day-date">{formatDate(day.date, { weekday: "long", day: "numeric", month: "short" }).toUpperCase()}</span>
          <h2>{day.area}</h2>
          <ol>
            {(day.route?.stops?.length ? day.route.stops : ["Faltan ubicaciones para calcular la ruta"]).map((stop) => <li key={stop}>{stop}</li>)}
          </ol>
          {day.route?.mapUrl ? <Button onClick={() => openExternal(day.route.mapUrl)} variant="ghost">Abrir ruta completa ↗</Button> : null}
        </article>
      ))}
    </div>
  );
}

function LoadingState({ failed, onRetry }) {
  return (
    <div className="empty-state">
      <div>
        <strong>{failed ? "No pudimos cargar el itinerario" : "Preparando tu viaje…"}</strong>
        <span>{failed ? "Sendero no recibió los datos del resultado. Puedes intentar cargarlos nuevamente." : "Organizando días, reservas y recorridos."}</span>
        {failed ? <Button onClick={onRetry}>Reintentar</Button> : null}
      </div>
    </div>
  );
}

export function ItineraryApp() {
  const { output, refresh } = useToolOutput();
  const [timedOut, setTimedOut] = useState(false);
  const [activeView, setActiveView] = useState(() => widgetState().activeView || "list");
  const itinerary = output?.itinerary;
  const warnings = output?.validation?.warnings || [];

  useEffect(() => {
    if (itinerary) setTimedOut(false);
    else {
      const timeout = window.setTimeout(() => setTimedOut(true), 2500);
      return () => window.clearTimeout(timeout);
    }
  }, [itinerary]);

  const meta = useMemo(() => itinerary ? `${formatDate(itinerary.startDate, { day: "numeric", month: "long" })} — ${formatDate(itinerary.endDate, { day: "numeric", month: "long", year: "numeric" })} · ${itinerary.days.length} días` : "", [itinerary]);

  function changeView(next) {
    setActiveView(next);
    setWidgetState({ activeView: next });
  }

  if (!itinerary) return <main className="app-shell"><LoadingState failed={timedOut} onRetry={() => { setTimedOut(false); refresh(); }} /></main>;

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="header-copy">
          <p className="eyebrow">{itinerary.destination}</p>
          <h1>{itinerary.title}</h1>
          <p className="meta">{meta}</p>
        </div>
        <nav aria-label="Vistas del itinerario" className="tabs">
          {[{ id: "list", label: "Lista" }, { id: "calendar", label: "Calendario" }, { id: "routes", label: "Rutas" }].map((tab) => (
            <button className={activeView === tab.id ? "is-active" : ""} key={tab.id} onClick={() => changeView(tab.id)} type="button">{tab.label}</button>
          ))}
        </nav>
      </header>
      <section className="content">
        {warnings.length ? <InlineNotice tone="warning"><ul className="warning-list">{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></InlineNotice> : null}
        {activeView === "calendar" ? <CalendarView itinerary={itinerary} /> : activeView === "routes" ? <RoutesView itinerary={itinerary} /> : <ListView itinerary={itinerary} />}
        <div className="action-bar">
          <Button onClick={() => sendFollowUpMessage(`Quiero ajustar el itinerario “${itinerary.title}” sin perder actividades fijas ni reservas confirmadas.`)}>Ajustar viaje</Button>
          <Button onClick={() => sendFollowUpMessage(`Revisa todas las reservas pendientes del itinerario “${itinerary.title}”, con enlaces oficiales y fechas recomendadas.`)} variant="ghost">Revisar reservas</Button>
        </div>
      </section>
    </main>
  );
}
