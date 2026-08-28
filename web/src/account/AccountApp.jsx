import { useCallback, useEffect, useMemo, useState } from "react";
import { WebButton, WebPageFrame, WebState } from "./PageFrame.jsx";
import {
  loginUrl,
  normalizeSession,
  normalizeTrips,
  readableTripDates,
  requestJson,
} from "./web-client.js";

const accountStyles = `
.account-groups { display: grid; gap: 34px; }
.account-section-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; margin-bottom: 12px; }
.account-section-heading h2 { margin: 0; font-size: 19px; letter-spacing: -.02em; }
.account-section-heading span { color: var(--web-muted); font-size: 14px; }
.account-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 310px), 1fr)); gap: 12px; }
.account-trip { display: grid; min-height: 174px; align-content: space-between; gap: 24px; border: 1px solid var(--web-line); border-radius: 18px; padding: 20px; background: var(--web-surface); color: inherit; text-decoration: none; transition: border-color .16s ease, transform .16s ease; }
.account-trip:hover { border-color: var(--web-forest); transform: translateY(-2px); }
.account-trip h3 { margin: 0; font-size: 21px; letter-spacing: -.025em; line-height: 1.15; }
.account-trip p { margin: 8px 0 0; color: var(--web-muted); }
.account-trip-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.account-open { color: var(--web-forest); font-weight: 720; }
@media (prefers-reduced-motion: reduce) { .account-trip { transition: none; } }
`;

const ROLE_LABEL = { editor: "Colaborador", owner: "Propietario", viewer: "Viewer" };

function TripCard({ trip }) {
  return (
    <a className="account-trip" href={`/app/trips/${encodeURIComponent(trip.webId)}`}>
      <div>
        <h3>{trip.title}</h3>
        <p>{trip.destination || "Destino por confirmar"}</p>
        <p>{readableTripDates(trip.startDate, trip.endDate)}</p>
      </div>
      <div className="account-trip-footer">
        <span className="web-role-badge">{ROLE_LABEL[trip.role]}</span>
        <span className="account-open">Abrir →</span>
      </div>
    </a>
  );
}

function TripGroup({ label, trips }) {
  if (!trips.length) return null;
  return (
    <section>
      <div className="account-section-heading">
        <h2>{label}</h2>
        <span>{trips.length}</span>
      </div>
      <div className="account-grid">{trips.map((trip) => <TripCard key={trip.webId} trip={trip} />)}</div>
    </section>
  );
}

export function AccountApp() {
  const [state, setState] = useState({ kind: "loading" });

  const load = useCallback(async () => {
    const controller = new AbortController();
    setState({ kind: "loading" });
    try {
      const session = normalizeSession(await requestJson("/api/session", { signal: controller.signal }));
      if (!session.authenticated) {
        setState({ kind: "signed_out", session });
        return;
      }
      const trips = normalizeTrips(await requestJson("/api/trips", { signal: controller.signal }));
      setState({ kind: trips.length ? "ready" : "empty", session, trips });
    } catch (error) {
      if (error?.name !== "AbortError") setState({ error, kind: "error" });
    }
    return () => controller.abort();
  }, []);

  useEffect(() => { load(); }, [load]);

  const grouped = useMemo(() => {
    const trips = state.trips || [];
    return {
      owned: trips.filter((trip) => trip.role === "owner"),
      shared: trips.filter((trip) => trip.role !== "owner"),
    };
  }, [state.trips]);

  if (state.kind === "loading") return <WebState kind="loading" title="Buscando tus viajes…" />;
  if (state.kind === "signed_out") {
    return <WebState action={<a className="web-button web-button-primary" href={loginUrl(state.session, "/app")}>Iniciar sesión</a>} detail="Usa tu cuenta de Sendero para ver los itinerarios propios y compartidos contigo." title="Tus viajes te esperan" />;
  }
  if (state.kind === "error") {
    return <WebState action={<WebButton onClick={load}>Intentar de nuevo</WebButton>} detail="Tus viajes siguen guardados. Intenta cargar esta página nuevamente." kind="error" title="No pudimos mostrar tus viajes" />;
  }
  if (state.kind === "empty") {
    return <WebState action={<a className="web-button web-button-primary" href={document.querySelector('meta[name="sendero-chatgpt-url"]')?.content || "https://chatgpt.com/"}>Crear un viaje en ChatGPT</a>} detail="Cuando crees o aceptes un viaje, aparecerá aquí automáticamente." title="Todavía no hay viajes" />;
  }

  return (
    <WebPageFrame csrfToken={state.session.csrfToken} user={state.session.user}>
      <style>{accountStyles}</style>
      <header className="web-heading">
        <p className="web-eyebrow">Tu espacio</p>
        <h1>Viajes</h1>
        <p>Abre un itinerario o continúa en ChatGPT para ajustarlo conversando.</p>
      </header>
      <div className="account-groups">
        <TripGroup label="Mis viajes" trips={grouped.owned} />
        <TripGroup label="Compartidos conmigo" trips={grouped.shared} />
      </div>
    </WebPageFrame>
  );
}
