import { useCallback, useEffect, useRef, useState } from "react";
import { WebButton, WebPageFrame, WebState } from "../account/PageFrame.jsx";
import {
  createStableOperationRegistry,
  loginUrl,
  normalizeRestrictedTrip,
  normalizeSession,
  requestJson,
} from "../account/web-client.js";
import { ItineraryViewer } from "../itinerary/ItineraryViewer.jsx";
import { reservationEntryKey } from "../itinerary/presentation-utils.js";
import { AccessPanel } from "./AccessPanel.jsx";

const restrictedStyles = `
.restricted-page { width: min(1500px, calc(100% - 28px)); }
.restricted-context { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin: -18px 0 18px; }
.restricted-context p { margin: 0; color: var(--web-muted); font-size: 14px; }
.restricted-context-actions { display: flex; align-items: center; justify-content: flex-end; gap: 10px; }
.restricted-chat-link { color: var(--web-forest); font-size: 14px; font-weight: 720; text-decoration: none; }
.restricted-chat-link:hover { text-decoration: underline; }
.restricted-viewer { overflow: hidden; border: 1px solid var(--web-line); border-radius: 24px; background: var(--web-surface); }
.restricted-viewer .itinerary-viewer {
  width: 100%;
  color-scheme: light;
  --ink: #1f1f1d;
  --muted: #787873;
  --subtle: #a3a39e;
  --line: #e9e9e6;
  --line-strong: #d8d8d4;
  --soft: #f7f7f5;
  --surface: #ffffff;
  --surface-hover: #fbfbfa;
  --on-strong: #ffffff;
  --strong-hover: #343431;
  --blue: var(--sendero-forest);
  --danger: #a33c35;
  --focus-border: #9a9a94;
  --focus-ring: rgba(47, 114, 196, .35);
  --field-ring: rgba(31, 31, 29, .05);
  --shadow: rgba(15, 15, 15, .1);
  --locked-bg: #f0f6d9;
  --locked-ink: #4d5e1c;
  --warning-bg: #fbf5df;
  --warning-ink: #6c5721;
  --danger-bg: #faecea;
  --public-muted: #62625d;
  background: var(--surface);
  color: var(--ink);
}
.restricted-update-error { margin: 12px 0; padding: 12px 14px; border-radius: 11px; background: #fff2ef; color: var(--web-danger); }
@media (prefers-color-scheme: dark) {
  .restricted-viewer .itinerary-viewer {
    color-scheme: dark;
    --ink: #f2f2ef;
    --muted: #aaa9a3;
    --subtle: #7f7f78;
    --line: #383834;
    --line-strong: #51514b;
    --soft: #292925;
    --surface: #20201e;
    --surface-hover: #2d2d29;
    --on-strong: #1b1b19;
    --strong-hover: #d8d8d3;
    --blue: var(--sendero-teal);
    --danger: #ff9c94;
    --focus-border: #85857e;
    --focus-ring: rgba(126, 181, 244, .45);
    --field-ring: rgba(255, 255, 255, .08);
    --shadow: rgba(0, 0, 0, .35);
    --locked-bg: #313b20;
    --locked-ink: #d9ef9c;
    --warning-bg: #3a321c;
    --warning-ink: #f2d681;
    --danger-bg: #412421;
    --public-muted: #b7b7b0;
  }
  .restricted-update-error { background: #382321; }
}
@media (max-width: 640px) { .restricted-page { width: min(100% - 14px, 1500px); } .restricted-context { align-items: flex-start; flex-direction: column; } .restricted-context-actions { width: 100%; justify-content: space-between; } .restricted-viewer { border-radius: 16px; } }
`;

const ROLE_LABEL = { editor: "Colaborador", owner: "Propietario", viewer: "Viewer" };

export function restrictedWebId(locationLike = globalThis.location) {
  const fromMeta = globalThis.document?.querySelector('meta[name="sendero-trip-web-id"]')?.content?.trim();
  if (fromMeta) return fromMeta;
  const match = locationLike?.pathname?.match(/^\/app\/trips\/([^/?#]+)/);
  try { return match ? decodeURIComponent(match[1]) : ""; } catch { return ""; }
}

function externalUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch { return ""; }
}

function configuredChatgptUrl() {
  const url = externalUrl(document.querySelector('meta[name="sendero-chatgpt-url"]')?.content || "");
  if (!url) return "";
  const parsed = new URL(url);
  return parsed.hostname === "chatgpt.com" && parsed.pathname === "/" && !parsed.search && !parsed.hash
    ? ""
    : url;
}

export function RestrictedTripApp({ initialWebId = "" }) {
  const webId = initialWebId || restrictedWebId();
  const [state, setState] = useState({ kind: "loading" });
  const latestStateRef = useRef(state);
  const [activeView, setActiveView] = useState("list");
  const [selectedCalendarDate, setSelectedCalendarDate] = useState("");
  const [selectedCalendarMonth, setSelectedCalendarMonth] = useState("");
  const [selectedReservationKey, setSelectedReservationKey] = useState("");
  const [selectedRouteDate, setSelectedRouteDate] = useState("");
  const [updateError, setUpdateError] = useState("");
  const reservationQueue = useRef(Promise.resolve());
  const reservationOperations = useRef(createStableOperationRegistry());

  const commitState = useCallback((next) => {
    latestStateRef.current = next;
    setState(next);
  }, []);

  const loadTrip = useCallback(async ({ preserveSession } = {}) => {
    if (!webId) { commitState({ kind: "not_found" }); return; }
    try {
      let session = preserveSession || null;
      if (!session) {
        session = normalizeSession(await requestJson("/api/session"));
        if (!session.authenticated) { commitState({ kind: "signed_out", session }); return; }
      }
      const trip = normalizeRestrictedTrip(await requestJson(`/api/trips/${encodeURIComponent(webId)}`));
      if (!trip) throw new Error("invalid_trip");
      commitState({ kind: "ready", session, trip });
    } catch (error) {
      if (error?.status === 401) commitState({ kind: "signed_out", session: { authenticated: false } });
      else if (error?.status === 403) commitState({ kind: "forbidden" });
      else if (error?.status === 404) commitState({ kind: "not_found" });
      else commitState({ error, kind: "error" });
    }
  }, [commitState, webId]);

  useEffect(() => { loadTrip(); }, [loadTrip]);

  function openReservation(target) {
    setSelectedReservationKey(target ? reservationEntryKey(target.dayDate, target.activityId) : "");
    setActiveView("reservations");
  }

  function updateReservation({ activityId, dayDate, status }) {
    setUpdateError("");
    const operation = async () => {
      const current = latestStateRef.current;
      if (current.kind !== "ready") throw new Error("trip_not_ready");
      const operationKey = [webId, current.trip.version, dayDate, activityId, status].join(":");
      const reservationOperation = reservationOperations.current.begin(
        operationKey,
        current.trip.version,
        "reservation",
      );
      try {
        const result = await requestJson(`/api/trips/${encodeURIComponent(webId)}/reservations/status`, {
          body: {
            activityId,
            dayDate,
            expectedVersion: reservationOperation.expectedVersion,
            operationId: reservationOperation.operationId,
            status,
          },
          csrfToken: current.session.csrfToken,
          method: "PATCH",
        });
        const trip = normalizeRestrictedTrip(result);
        if (!trip) throw new Error("invalid_trip");
        reservationOperations.current.clear(operationKey);
        commitState({ ...current, trip });
        return trip;
      } catch (error) {
        if (error?.status === 409) {
          reservationOperations.current.clear(operationKey);
          await loadTrip({ preserveSession: current.session });
          setUpdateError("El itinerario cambió en otro lugar. Ya cargamos la versión más reciente; revisa el estado antes de intentar otra vez.");
        } else setUpdateError("No pudimos actualizar esta reserva. Intenta nuevamente.");
        throw error;
      }
    };
    const queued = reservationQueue.current.then(operation, operation);
    reservationQueue.current = queued.catch(() => {});
    return queued;
  }

  if (state.kind === "loading") return <WebState kind="loading" title="Abriendo el itinerario…" />;
  if (state.kind === "signed_out") return <WebState action={<a className="web-button web-button-primary" href={loginUrl(state.session, `/app/trips/${encodeURIComponent(webId)}`)}>Iniciar sesión</a>} detail="Este itinerario está disponible solo para personas invitadas." title="Inicia sesión para verlo" />;
  if (state.kind === "forbidden") return <WebState detail="Pide a la persona propietaria que te invite con el correo de tu cuenta de Sendero." title="No tienes acceso a este viaje" />;
  if (state.kind === "not_found") return <WebState action={<a className="web-button" href="/app">Volver a mis viajes</a>} detail="Puede haber sido eliminado o el enlace no es correcto." kind="error" title="No encontramos este viaje" />;
  if (state.kind === "error") return <WebState action={<WebButton onClick={() => loadTrip()}>Intentar de nuevo</WebButton>} detail="Tus datos siguen guardados; vuelve a intentarlo." kind="error" title="No pudimos abrir el itinerario" />;

  const { session, trip } = state;
  const chatgptUrl = configuredChatgptUrl();
  return (
    <WebPageFrame className="restricted-page" csrfToken={session.csrfToken} user={session.user}>
      <style>{restrictedStyles}</style>
      <div className="restricted-context">
        <p>Acceso restringido</p>
        <div className="restricted-context-actions">
          {trip.permissions.editInSendero && chatgptUrl ? <a className="restricted-chat-link" href={chatgptUrl} rel="noreferrer" target="_blank">Continuar este viaje en ChatGPT ↗</a> : null}
          <span className="web-role-badge">{ROLE_LABEL[trip.role]}</span>
        </div>
      </div>
      {updateError ? <p className="restricted-update-error" role="alert">{updateError}</p> : null}
      <div className="restricted-viewer">
        <ItineraryViewer
          activeView={activeView}
          itinerary={trip.itinerary}
          onCalendarDayChange={setSelectedCalendarDate}
          onCalendarMonthChange={setSelectedCalendarMonth}
          onOpenExternal={(url) => { const safe = externalUrl(url); if (safe) window.open(safe, "_blank", "noopener,noreferrer"); }}
          onReservationOpen={openReservation}
          onReservationStatusChange={updateReservation}
          onRouteDayChange={setSelectedRouteDate}
          onViewChange={(view) => { setActiveView(view); if (view !== "reservations") setSelectedReservationKey(""); }}
          reservationWritable={trip.permissions.updateReservationStatus}
          selectedCalendarDate={selectedCalendarDate}
          selectedCalendarMonth={selectedCalendarMonth}
          selectedReservationKey={selectedReservationKey}
          selectedRouteDate={selectedRouteDate}
          variant="restricted"
        />
      </div>
      {trip.permissions.manageAccess ? <AccessPanel csrfToken={session.csrfToken} webId={trip.webId} /> : null}
    </WebPageFrame>
  );
}
