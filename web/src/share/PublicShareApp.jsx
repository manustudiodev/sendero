import { useEffect, useState } from "react";
import { BrandMark, Button } from "../components.jsx";
import { ItineraryViewer } from "../itinerary/ItineraryViewer.jsx";
import { normalizePublicShareToken, publicShareFromPayload } from "./public-share.js";

function shareToken() {
  return normalizePublicShareToken(window.location.hash);
}

function readableTimestamp(value) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat(document.documentElement.lang || "es", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(value));
  } catch {
    return "";
  }
}

function ShareState({ kind, onRetry }) {
  const unavailable = kind === "unavailable";
  return (
    <main className="public-share-shell public-share-state">
      <div className="public-brand"><BrandMark /><strong>Sendero</strong></div>
      <section aria-live="polite" className="public-state-card" role={unavailable ? "alert" : "status"}>
        <p className="eyebrow">Viaje compartido</p>
        <h1>{unavailable ? "Este enlace ya no está disponible" : "No pudimos conectar"}</h1>
        <p>{unavailable
          ? "Puede haber vencido, haber sido reemplazado o haber sido revocado por quien lo compartió."
          : "Revisa tu conexión e inténtalo nuevamente. El viaje sigue protegido."}</p>
        {!unavailable ? <Button onClick={onRetry} variant="primary">Reintentar</Button> : null}
      </section>
    </main>
  );
}

function LoadingShare() {
  return (
    <main aria-busy="true" className="public-share-shell public-share-state">
      <div className="public-brand"><BrandMark /><strong>Sendero</strong></div>
      <section aria-live="polite" className="public-state-card" role="status">
        <span aria-hidden="true" className="loading-dot" />
        <p className="eyebrow">Viaje compartido</p>
        <h1>Preparando el itinerario…</h1>
        <p>Estamos cargando la versión que compartieron contigo.</p>
      </section>
    </main>
  );
}

export function PublicShareApp() {
  const [requestKey, setRequestKey] = useState(0);
  const [result, setResult] = useState({ state: "loading" });
  const [activeView, setActiveView] = useState("list");
  const [token, setToken] = useState(() => shareToken());

  useEffect(() => {
    const handleHashChange = () => {
      setToken(shareToken());
      setActiveView("list");
    };
    window.addEventListener("hashchange", handleHashChange, { passive: true });
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    if (!token) {
      setResult({ state: "unavailable" });
      return undefined;
    }

    const controller = new AbortController();
    setResult({ state: "loading" });
    fetch("/api/public-shares/resolve", {
      body: JSON.stringify({ token }),
      cache: "no-store",
      credentials: "omit",
      headers: { "Content-Type": "application/json" },
      method: "POST",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const error = new Error("Share unavailable");
          error.kind = response.status >= 500 ? "offline" : "unavailable";
          throw error;
        }
        return response.json();
      })
      .then((payload) => {
        const share = publicShareFromPayload(payload);
        if (!share) {
          const error = new Error("Malformed public share");
          error.kind = "unavailable";
          throw error;
        }
        setResult({ state: "ready", share });
      })
      .catch((error) => {
        if (error.name === "AbortError") return;
        setResult({ state: error.kind || "offline" });
      });

    return () => controller.abort();
  }, [requestKey, token]);

  useEffect(() => {
    if (result.state === "ready") document.title = `${result.share.itinerary.title} · Sendero`;
    else document.title = "Viaje compartido · Sendero";
  }, [result]);

  if (result.state === "loading") return <LoadingShare />;
  if (result.state !== "ready") return <ShareState kind={result.state} onRetry={() => setRequestKey((value) => value + 1)} />;

  const { share } = result;
  const freshness = readableTimestamp(share.updatedAt || share.publishedAt);
  const expiry = readableTimestamp(share.expiresAt);
  return (
    <main className="public-share-shell">
      <div className="public-share-topbar">
        <div className="public-brand"><BrandMark /><strong>Sendero</strong></div>
        <span className="read-only-badge">Solo lectura</span>
      </div>
      <ItineraryViewer
        activeView={activeView}
        itinerary={share.itinerary}
        onViewChange={setActiveView}
        variant="public"
      />
      <footer className="public-share-footer">
        <p>{freshness ? `Compartido el ${freshness}.` : "Itinerario compartido con Sendero."}{expiry ? ` Disponible hasta el ${expiry}.` : ""}</p>
        <p>Esta vista no permite modificar el viaje.</p>
      </footer>
    </main>
  );
}
