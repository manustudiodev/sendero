import { useEffect, useId, useRef, useState } from "react";
import { DisclosurePanel } from "../DisclosurePanel.jsx";
import { safeExternalUrl } from "../safe-url.js";
import {
  buildMonthPage,
  monthKeyFromDate,
  monthKeysInRange,
  resolveMonthPage,
} from "./calendar-model.js";
import {
  contextualItineraryTitle,
  hasReservationManagement,
  reservationEntryKey,
  reservationNavigationLabel,
  reservationPresentation,
} from "./presentation-utils.js";
import {
  buildDayEmbedMapUrl,
  buildDayAppleRouteUrls,
  buildDayRouteUrls,
  coordinateCoverageForDay,
  routeStopsForDay,
} from "./route-utils.js";

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

const primaryViews = [
  { id: "list", label: "Lista" },
  { id: "calendar", label: "Calendario" },
  { id: "routes", label: "Rutas" },
];

function ViewIcon({ view }) {
  if (view === "calendar") {
    return (
      <svg aria-hidden="true" className="view-icon" fill="none" focusable="false" viewBox="0 0 20 20">
        <rect height="14" rx="2" stroke="currentColor" strokeWidth="1.5" width="15" x="2.5" y="3.5" />
        <path d="M6 2.5v3M14 2.5v3M2.5 8h15M6 11h2M11 11h2M6 14h2M11 14h2" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
      </svg>
    );
  }
  if (view === "routes") {
    return (
      <svg aria-hidden="true" className="view-icon" fill="none" focusable="false" viewBox="0 0 20 20">
        <circle cx="5" cy="5" r="2.25" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="15" cy="15" r="2.25" stroke="currentColor" strokeWidth="1.5" />
        <path d="M6.75 6.4c4.4 1.1 1.2 5.1 5.4 6.7" stroke="currentColor" strokeDasharray="2 2" strokeLinecap="round" strokeWidth="1.5" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" className="view-icon" fill="none" focusable="false" viewBox="0 0 20 20">
      <circle cx="4" cy="5" fill="currentColor" r="1" />
      <circle cx="4" cy="10" fill="currentColor" r="1" />
      <circle cx="4" cy="15" fill="currentColor" r="1" />
      <path d="M7 5h9M7 10h9M7 15h9" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    </svg>
  );
}

function TicketIcon() {
  return (
    <svg aria-hidden="true" className="activity-reservation-icon" fill="none" focusable="false" viewBox="0 0 20 20">
      <path d="M3.5 6.25A2.75 2.75 0 0 0 6.25 3.5h7.25a1 1 0 0 1 1 1v2a2.75 2.75 0 0 0 0 5.5v2a1 1 0 0 1-1 1H6.25A2.75 2.75 0 0 0 3.5 12.25v-6Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.5" />
      <path d="M9.75 6.25v1.5m0 2v1.5m0 2v.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    </svg>
  );
}

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

function Activity({ activity, dayDate, onOpenExternal, onReservationOpen, variant }) {
  const showPrivateStatus = variant !== "public";
  const location = activity.location;
  const sourceUrl = safeExternalUrl(activity.sourceUrl);
  const hasReservation = showPrivateStatus && hasReservationManagement(activity);
  const reservationEntry = hasReservation ? { activity, reservation: activity.reservation } : null;
  const reservationLabel = reservationEntry ? reservationNavigationLabel(reservationEntry) : "";
  const hasBadges = (showPrivateStatus && activity.locked) || activity.travelToNext;
  return (
    <li className="activity">
      <time className="activity-time" dateTime={activity.startTime}>{activity.startTime}</time>
      <div>
        <div className="activity-title-row">
          <strong>{activity.title}</strong>
          {hasReservation && onReservationOpen ? (
            <button
              aria-label={reservationLabel}
              className="activity-reservation-link"
              onClick={() => onReservationOpen({ activityId: activity.id, dayDate })}
              title={reservationLabel}
              type="button"
            >
              <TicketIcon />
            </button>
          ) : null}
        </div>
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
          >Ver fuente ↗</a>
        ) : null}
        {hasBadges ? (
          <div className="badges">
            {showPrivateStatus && activity.locked ? <span className="badge badge-locked">Fijo</span> : null}
            {activity.travelToNext ? (
              <span className="badge">{activity.travelToNext.durationMinutes} min · {transportLabels[activity.travelToNext.mode] || activity.travelToNext.mode}</span>
            ) : null}
          </div>
        ) : null}
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

function DayGuide({ day, onOpenExternal }) {
  const guideActivities = day.activities.filter((activity) =>
    Boolean(activity.location?.name?.trim() || activity.guide),
  );

  return (
    <div className="day-guide">
      <ol aria-label={`Guía de lugares para ${day.title}`} className="day-guide-stops">
        {guideActivities.map((activity, index) => {
          const placeTitle = activity.location?.name?.trim() || activity.title;
          const guide = activity.guide;
          const overview = typeof guide?.overview === "string" ? guide.overview.trim() : "";
          const highlights = Array.isArray(guide?.highlights)
            ? guide.highlights.filter((highlight) => typeof highlight === "string" && highlight.trim()).map((highlight) => highlight.trim())
            : [];
          const guideSources = Array.isArray(guide?.sources)
            ? guide.sources.flatMap((source, sourceIndex) => {
              const url = safeExternalUrl(typeof source === "string" ? source : source?.url);
              if (!url) return [];
              const sourceLabel = typeof source === "object" && source ? source.label || source.title : "";
              const suppliedLabel = typeof sourceLabel === "string" ? sourceLabel.trim() : "";
              return [{ label: suppliedLabel || `Fuente ${sourceIndex + 1}`, url }];
            })
            : [];
          const officialSourceUrl = safeExternalUrl(activity.sourceUrl);
          const sources = guideSources.length
            ? guideSources
            : officialSourceUrl
              ? [{ label: "Fuente oficial", url: officialSourceUrl }]
              : [];
          const hasEditorialGuide = Boolean(overview || highlights.length);
          return (
            <li className="day-guide-stop" key={activity.id || `${day.date}-guide-${index}`}>
              <article>
                <h3>{placeTitle}</h3>
                {overview ? <p className="day-guide-overview">{overview}</p> : null}
                {highlights.length ? (
                  <ul className="day-guide-highlights">
                    {highlights.map((highlight, highlightIndex) => (
                      <li key={`${activity.id || index}-highlight-${highlightIndex}`}>{highlight}</li>
                    ))}
                  </ul>
                ) : null}
                {!hasEditorialGuide ? (
                  <p className="day-guide-legacy-note">Todavía no hay una reseña editorial verificada para este lugar.</p>
                ) : null}
                {sources.length ? (
                  <ul aria-label={`Fuentes sobre ${placeTitle}`} className="day-guide-sources">
                    {sources.map((source, sourceIndex) => (
                      <li key={`${source.label}-${source.url}-${sourceIndex}`}>
                        <a
                          aria-label={`${source.label} sobre ${placeTitle}`}
                          className="day-guide-source"
                          href={source.url}
                          onClick={onOpenExternal ? (event) => { event.preventDefault(); onOpenExternal(source.url); } : undefined}
                          rel="noreferrer noopener"
                          target="_blank"
                        >{source.label} ↗</a>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function DayDetails({ day, labelledBy, onOpenExternal, onReservationOpen, variant }) {
  const [detailView, setDetailView] = useState("route");
  const detailId = useId();
  const detailTabRefs = useRef([]);
  const detailViews = [
    { id: "route", label: "Recorrido" },
    { id: "description", label: "Descripción" },
  ];

  function selectDetailView(view, focus = false) {
    setDetailView(view.id);
    if (focus) window.requestAnimationFrame(() => detailTabRefs.current[detailViews.indexOf(view)]?.focus());
  }

  function handleDetailTabKeyDown(event, index) {
    let nextIndex;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % detailViews.length;
    else if (event.key === "ArrowLeft") nextIndex = (index - 1 + detailViews.length) % detailViews.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = detailViews.length - 1;
    else return;
    event.preventDefault();
    selectDetailView(detailViews[nextIndex], true);
  }

  return (
    <div aria-labelledby={labelledBy} className="day-details" role="region">
      <div aria-label={`Detalle de ${day.title}`} className="day-detail-tabs" role="tablist">
        {detailViews.map((view, index) => (
          <button
            aria-controls={`${detailId}-${view.id}-panel`}
            aria-selected={detailView === view.id}
            className={detailView === view.id ? "is-active" : ""}
            id={`${detailId}-${view.id}-tab`}
            key={view.id}
            onClick={() => selectDetailView(view)}
            onKeyDown={(event) => handleDetailTabKeyDown(event, index)}
            ref={(node) => { detailTabRefs.current[index] = node; }}
            role="tab"
            tabIndex={detailView === view.id ? 0 : -1}
            type="button"
          >{view.label}</button>
        ))}
      </div>
      <div
        aria-labelledby={`${detailId}-route-tab`}
        className="day-detail-panel day-detail-panel-route"
        hidden={detailView !== "route"}
        id={`${detailId}-route-panel`}
        role="tabpanel"
      >
        <div className="day-route-content">
          <ol className="timeline">
            {day.activities.map((activity, index) => (
              <Activity
                activity={activity}
                dayDate={day.date}
                key={activity.id || `${day.date}-${index}`}
                onOpenExternal={onOpenExternal}
                onReservationOpen={onReservationOpen}
                variant={variant}
              />
            ))}
          </ol>
          <DayContext day={day} onOpenExternal={onOpenExternal} />
        </div>
      </div>
      <div
        aria-labelledby={`${detailId}-description-tab`}
        className="day-detail-panel day-detail-panel-description"
        hidden={detailView !== "description"}
        id={`${detailId}-description-panel`}
        role="tabpanel"
      >
        <DayGuide day={day} onOpenExternal={onOpenExternal} />
      </div>
    </div>
  );
}

function DayCard({ day, initiallyOpen, onOpenExternal, onReservationOpen, variant }) {
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
        <DayDetails day={day} labelledBy={controlId} onOpenExternal={onOpenExternal} onReservationOpen={onReservationOpen} variant={variant} />
      </DisclosurePanel>
    </article>
  );
}

function ListView({ itinerary, onOpenExternal, onReservationOpen, variant }) {
  return <div className="days">{itinerary.days.map((day, index) => <DayCard day={day} initiallyOpen={index === 0} key={day.date} onOpenExternal={onOpenExternal} onReservationOpen={onReservationOpen} variant={variant} />)}</div>;
}

function CalendarWeek({ currentDate, onOpenExternal, onReservationOpen, selectDate, variant, week }) {
  const expandedDay = week.find((cell) => cell.day?.date === currentDate)?.day;
  const lastExpandedDay = useRef(expandedDay || null);
  if (expandedDay) lastExpandedDay.current = expandedDay;
  const displayedDay = expandedDay || lastExpandedDay.current;
  const panelId = displayedDay ? `calendar-${displayedDay.date}-panel` : undefined;

  return (
    <section className="calendar-row">
      <div className="calendar-cells">
        {week.map((cell) => {
          const day = cell.day;
          if (!cell.inMonth) {
            return <div aria-hidden="true" className="calendar-day is-outside-month" key={cell.date}><strong>{cell.dayNumber}</strong></div>;
          }
          if (!day) {
            return <div className="calendar-day is-inactive" key={cell.date}><time dateTime={cell.date}><strong>{cell.dayNumber}</strong></time></div>;
          }
          const open = currentDate === day.date;
          const controlId = `calendar-${day.date}`;
          return (
            <button
              aria-controls={`${controlId}-panel`}
              aria-expanded={open}
              aria-label={`${formatItineraryDate(day.date, { weekday: "long", day: "numeric", month: "long" })}: ${day.title}`}
              className={`calendar-day ${open ? "is-selected" : ""}`}
              id={controlId}
              key={day.date}
              onClick={() => selectDate(day.date)}
              type="button"
            >
              <time dateTime={day.date}>
                <strong>{formatItineraryDate(day.date, { day: "numeric" })}</strong>
              </time>
              <p>{day.title}</p>
              <span aria-hidden="true" className="calendar-toggle disclosure-toggle" />
            </button>
          );
        })}
      </div>
      {displayedDay ? (
        <DisclosurePanel className="calendar-disclosure" id={panelId} open={Boolean(expandedDay)}>
          <div className="calendar-day-detail">
            <DayDetails
              day={displayedDay}
              labelledBy={`calendar-${displayedDay.date}`}
              onOpenExternal={onOpenExternal}
              onReservationOpen={onReservationOpen}
              variant={variant}
            />
          </div>
        </DisclosurePanel>
      ) : null}
    </section>
  );
}

function CalendarView({
  itinerary,
  onOpenExternal,
  onReservationOpen,
  onSelectedDateChange,
  onSelectedMonthChange,
  selectedDate,
  selectedMonth,
  variant,
}) {
  const [localDate, setLocalDate] = useState("");
  const monthKeys = monthKeysInRange(itinerary.startDate, itinerary.endDate);
  const requestedMonth = monthKeys.includes(selectedMonth)
    ? selectedMonth
    : monthKeys.includes(monthKeyFromDate(selectedDate))
      ? monthKeyFromDate(selectedDate)
      : monthKeys[0];
  const [localMonth, setLocalMonth] = useState(requestedMonth || "");
  const currentDate = selectedDate ?? localDate;
  const monthState = resolveMonthPage(monthKeys, selectedMonth || localMonth || requestedMonth);
  const page = buildMonthPage({ days: itinerary.days, monthKey: monthState.key });

  useEffect(() => {
    if (selectedMonth && monthKeys.includes(selectedMonth)) setLocalMonth(selectedMonth);
  }, [monthKeys.join("|"), selectedMonth]);

  useEffect(() => {
    const dateMonth = monthKeyFromDate(selectedDate);
    if (!dateMonth || !monthKeys.includes(dateMonth) || dateMonth === monthState.key) return;
    setLocalMonth(dateMonth);
    onSelectedMonthChange?.(dateMonth);
  }, [monthKeys.join("|"), monthState.key, onSelectedMonthChange, selectedDate]);

  function selectDate(date) {
    const next = currentDate === date ? "" : date;
    setLocalDate(next);
    onSelectedDateChange?.(next);
  }

  function selectMonth(monthKey) {
    if (!monthKey) return;
    setLocalMonth(monthKey);
    onSelectedMonthChange?.(monthKey);
    setLocalDate("");
    onSelectedDateChange?.("");
  }

  if (!page) return null;
  const rawMonthLabel = formatItineraryDate(`${page.key}-01`, { month: "long", year: "numeric" });
  const monthLabel = rawMonthLabel ? `${rawMonthLabel.charAt(0).toLocaleUpperCase("es")}${rawMonthLabel.slice(1)}` : rawMonthLabel;
  const weekdayLabels = Array.from({ length: 7 }, (_, index) => formatItineraryDate(`2024-01-0${index + 1}`, { weekday: "short" }));

  return (
    <div aria-label="Calendario del viaje" className="calendar">
      <header className="calendar-toolbar">
        <div>
          <p className="eyebrow">Mes {monthState.index + 1} de {monthKeys.length}</p>
          <h2>{monthLabel}</h2>
        </div>
        <div className="calendar-pagination">
          <button aria-label="Mes anterior" disabled={!monthState.previousKey} onClick={() => selectMonth(monthState.previousKey)} type="button">←</button>
          <button aria-label="Mes siguiente" disabled={!monthState.nextKey} onClick={() => selectMonth(monthState.nextKey)} type="button">→</button>
        </div>
      </header>
      <div aria-hidden="true" className="calendar-weekdays">
        {weekdayLabels.map((label) => <span key={label}>{label}</span>)}
      </div>
      {page.weeks.map((week) => (
        <CalendarWeek
          currentDate={currentDate}
          key={week[0]?.date}
          onOpenExternal={onOpenExternal}
          onReservationOpen={onReservationOpen}
          selectDate={selectDate}
          variant={variant}
          week={week}
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
      ? "Todavía no podemos dibujar este recorrido completo aquí. Ábrelo en tu app de mapas para verlo."
      : "No hay paradas suficientes para dibujar este recorrido.";
    return (
      <div className="route-map-empty">
        <span aria-hidden="true" className="route-map-pin">⌖</span>
        <strong>Vista previa no disponible</strong>
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
      <p>Vista esquemática del recorrido entre las actividades del día.</p>
    </div>
  );
}

function mapsEmbedApiKey() {
  return document.querySelector('meta[name="sendero-google-maps-embed-key"]')?.content?.trim() || "";
}

function GoogleRouteMap({ day, embedUrl, itinerary }) {
  const [state, setState] = useState("loading");
  const timeoutRef = useRef();

  useEffect(() => {
    timeoutRef.current = window.setTimeout(() => setState("failed"), 10000);
    return () => window.clearTimeout(timeoutRef.current);
  }, [embedUrl]);

  function finish(nextState) {
    window.clearTimeout(timeoutRef.current);
    setState(nextState);
  }

  if (state === "failed") return <RouteSchematic day={day} itinerary={itinerary} />;
  return (
    <div className={`route-map-embed route-map-embed-${state}`}>
      {state === "loading" ? <div aria-live="polite" className="route-map-loading" role="status">Cargando mapa…</div> : null}
      <iframe
        allowFullScreen
        loading="lazy"
        onError={() => finish("failed")}
        onLoad={() => finish("ready")}
        referrerPolicy="strict-origin-when-cross-origin"
        src={embedUrl}
        title={`Mapa de la ruta: ${day.title}`}
      />
    </div>
  );
}

function RoutesView({ itinerary, onOpenExternal, onSelectedDateChange, selectedDate }) {
  const [localDate, setLocalDate] = useState(itinerary.days[0]?.date || "");
  const validSelectedDate = itinerary.days.some((day) => day.date === selectedDate) ? selectedDate : "";
  const currentDate = validSelectedDate || localDate || itinerary.days[0]?.date;
  const day = itinerary.days.find((candidate) => candidate.date === currentDate) || itinerary.days[0];
  const stops = routeStopsForDay(day);
  const googleRouteUrls = buildDayRouteUrls(itinerary, day);
  const appleRouteUrls = buildDayAppleRouteUrls(itinerary, day);
  const embedUrl = buildDayEmbedMapUrl(
    mapsEmbedApiKey(),
    itinerary,
    day,
    { language: (document.documentElement.lang || "es").split("-")[0] },
  );

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
          {embedUrl ? (
            <GoogleRouteMap day={day} embedUrl={embedUrl} itinerary={itinerary} key={embedUrl} />
          ) : (
            <RouteSchematic day={day} itinerary={itinerary} />
          )}
          {stops.length ? (
            <ol className="route-stops">
              {stops.map((stop, index) => <li key={`${stop}-${index}`}><span>{index + 1}</span>{stop}</li>)}
            </ol>
          ) : <p className="route-empty">Todavía no hay suficientes ubicaciones para trazar este día.</p>}
          <div className="route-external-links">
            {googleRouteUrls.map((routeUrl, index) => (
              <RouteLink
                href={routeUrl}
                key={routeUrl}
                label={googleRouteUrls.length === 1 ? "Abrir en Google Maps" : `Google Maps · tramo ${index + 1}`}
                onOpenExternal={onOpenExternal}
              />
            ))}
            {appleRouteUrls.map((routeUrl, index) => (
              <RouteLink
                href={routeUrl}
                key={routeUrl}
                label={appleRouteUrls.length === 1 ? "Abrir en Apple Maps" : `Apple Maps · tramo ${index + 1}`}
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
    if (!hasReservationManagement(activity)) return [];
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
  const presentation = reservationPresentation(entry);
  const actions = [presentation.nextAction];

  async function update(nextStatus) {
    setBusy(true);
    setError("");
    try {
      await onStatusChange({ activityId: entry.activity.id, dayDate: entry.day.date, status: nextStatus });
    } catch (caught) {
      setError(caught?.message || "No pudimos actualizar esta gestión.");
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

function ReservationsView({ itinerary, onOpenExternal, onStatusChange, selectedReservationKey, writable }) {
  const entries = reservationEntries(itinerary);
  const targetReservationRef = useRef(null);

  useEffect(() => {
    if (!selectedReservationKey) return undefined;
    const frame = window.requestAnimationFrame(() => {
      const target = targetReservationRef.current;
      if (!target) return;
      target.focus({ preventScroll: true });
      const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
      target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selectedReservationKey]);

  if (!entries.length) {
    return (
      <div className="reservations-empty">
        <strong>No hay reservas ni boletos por gestionar</strong>
        <p>Las actividades de este viaje no tienen gestiones pendientes registradas.</p>
      </div>
    );
  }
  return (
    <div className="reservations-view">
      <header className="reservations-header">
        <div>
          <p className="eyebrow">Todo en un solo lugar</p>
          <h2>Reservas y boletos</h2>
          <p>Enlaces, fechas y estado actual, sin generar otra respuesta en el chat.</p>
          {writable ? <small>Los controles actualizan Sendero; no compran ni cancelan con el proveedor.</small> : null}
        </div>
        <span>{entries.length} {entries.length === 1 ? "gestión" : "gestiones"}</span>
      </header>
      <div className="reservation-list">
        {entries.map((entry, index) => {
          const href = reservationUrl(entry);
          const presentation = reservationPresentation(entry);
          const entryKey = reservationEntryKey(entry.day.date, entry.activity.id);
          const isTargeted = Boolean(selectedReservationKey && selectedReservationKey === entryKey);
          return (
            <article
              aria-current={isTargeted ? "true" : undefined}
              className={`reservation-card ${isTargeted ? "is-targeted" : ""}`}
              data-reservation-key={entryKey}
              key={entry.activity.id || `${entry.day.date}-${index}`}
              ref={isTargeted ? targetReservationRef : undefined}
              tabIndex={isTargeted ? -1 : undefined}
            >
              <div className="reservation-date">
                <time dateTime={entry.day.date}>{formatItineraryDate(entry.day.date, { weekday: "short", day: "numeric", month: "short" })}</time>
                <span>{entry.activity.startTime}</span>
              </div>
              <div className="reservation-copy">
                <div className="reservation-title-row">
                  <div className="reservation-name">
                    <h3>{entry.activity.title}</h3>
                    <span className={`reservation-requirement-pill reservation-requirement-${presentation.requirement}`}>
                      {presentation.requirementLabel}
                    </span>
                  </div>
                  <span className={`reservation-pill reservation-status-${presentation.status}`}>{presentation.statusLabel}</span>
                </div>
                {entry.activity.location ? <p>{[entry.activity.location.name, entry.activity.location.address].filter(Boolean).join(" · ")}</p> : null}
                {entry.reservation.deadline ? <p><strong>{presentation.deadlineLabel}:</strong> {entry.reservation.deadline}</p> : null}
                {entry.reservation.note ? <p>{entry.reservation.note}</p> : null}
                <div className="reservation-actions">
                  <div className="reservation-provider-row">
                    {href ? <RouteLink href={href} label={presentation.externalActionLabel} onOpenExternal={onOpenExternal} /> : <span className="reservation-missing-link">Sin enlace oficial verificado</span>}
                  </div>
                  {writable && onStatusChange ? (
                    <div className="reservation-status-row">
                      <ReservationActions entry={entry} onStatusChange={onStatusChange} writable={writable} />
                    </div>
                  ) : null}
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
  itinerary,
  onCalendarDayChange,
  onCalendarMonthChange,
  onOpenExternal,
  onReservationOpen,
  onReservationStatusChange,
  onRouteDayChange,
  onViewChange,
  reservationWritable = false,
  selectedCalendarDate,
  selectedCalendarMonth,
  selectedReservationKey,
  selectedRouteDate,
  variant = "chat",
}) {
  const viewerId = useId();
  const tabRefs = useRef([]);
  const supportsReservations = variant !== "public";
  const availableViewIds = supportsReservations
    ? [...primaryViews.map((view) => view.id), "reservations"]
    : primaryViews.map((view) => view.id);
  const currentView = availableViewIds.includes(activeView) ? activeView : "list";
  const currentPanelLabelId = currentView === "reservations"
    ? `${viewerId}-reservations-button`
    : `${viewerId}-${currentView}-tab`;
  const contextualTitle = contextualItineraryTitle(itinerary.title, itinerary.destination);
  const meta = `${formatItineraryDate(itinerary.startDate, { day: "numeric", month: "long" })} — ${formatItineraryDate(itinerary.endDate, { day: "numeric", month: "long", year: "numeric" })} · ${itinerary.days.length} ${itinerary.days.length === 1 ? "día" : "días"}`;

  function selectView(view, focus = false) {
    onViewChange?.(view.id);
    if (focus) window.requestAnimationFrame(() => tabRefs.current[primaryViews.indexOf(view)]?.focus());
  }

  function handleTabKeyDown(event, index) {
    let nextIndex;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % primaryViews.length;
    else if (event.key === "ArrowLeft") nextIndex = (index - 1 + primaryViews.length) % primaryViews.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = primaryViews.length - 1;
    else return;
    event.preventDefault();
    selectView(primaryViews[nextIndex], true);
  }

  return (
    <div className={`itinerary-viewer itinerary-viewer-${variant}`}>
      <header className="app-header">
        <div className="header-copy">
          <p className="eyebrow">{itinerary.destination}</p>
          <h1>{contextualTitle}</h1>
          <p className="meta">{meta}</p>
        </div>
        <div className="view-navigation">
          <nav aria-label="Vistas del itinerario" className="tabs">
            <div role="tablist">
              {primaryViews.map((view, index) => (
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
                  tabIndex={currentView === "reservations" ? (index === 0 ? 0 : -1) : (currentView === view.id ? 0 : -1)}
                  type="button"
                >
                  <ViewIcon view={view.id} />
                  <span className="view-label">{view.label}</span>
                </button>
              ))}
            </div>
          </nav>
          {supportsReservations ? (
            <button
              aria-controls={`${viewerId}-reservations-panel`}
              aria-current={currentView === "reservations" ? "page" : undefined}
              className={`reservations-link ${currentView === "reservations" ? "is-active" : ""}`}
              id={`${viewerId}-reservations-button`}
              onClick={() => {
                if (onReservationOpen) onReservationOpen(null);
                else onViewChange?.("reservations");
              }}
              type="button"
            >Reservas</button>
          ) : null}
        </div>
      </header>
      <section className="content">
        <div
          aria-labelledby={currentPanelLabelId}
          id={`${viewerId}-${currentView}-panel`}
          role={currentView === "reservations" ? "region" : "tabpanel"}
          tabIndex="0"
        >
          {currentView === "calendar" ? (
            <CalendarView
              itinerary={itinerary}
              onOpenExternal={onOpenExternal}
              onReservationOpen={onReservationOpen}
              onSelectedDateChange={onCalendarDayChange}
              onSelectedMonthChange={onCalendarMonthChange}
              selectedDate={selectedCalendarDate}
              selectedMonth={selectedCalendarMonth}
              variant={variant}
            />
          ) : currentView === "routes" ? (
            <RoutesView itinerary={itinerary} onOpenExternal={onOpenExternal} onSelectedDateChange={onRouteDayChange} selectedDate={selectedRouteDate} />
          ) : currentView === "reservations" ? (
            <ReservationsView
              itinerary={itinerary}
              onOpenExternal={onOpenExternal}
              onStatusChange={onReservationStatusChange}
              selectedReservationKey={selectedReservationKey}
              writable={reservationWritable}
            />
          ) : <ListView itinerary={itinerary} onOpenExternal={onOpenExternal} onReservationOpen={onReservationOpen} variant={variant} />}
        </div>
        <SourcesPanel itinerary={itinerary} onOpenExternal={onOpenExternal} />
      </section>
    </div>
  );
}
