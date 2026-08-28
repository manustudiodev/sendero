import { useEffect, useState } from "react";
import { BrandMark, Button } from "../components.jsx";
import { formatDate, localeLanguage, resolveContentLocale, setDocumentLocale } from "../i18n/index.js";
import { ItineraryViewer } from "../itinerary/ItineraryViewer.jsx";
import { normalizePublicShareToken, publicShareFromPayload } from "./public-share.js";

function shareToken() {
  return normalizePublicShareToken(window.location.hash);
}

const COPY = {
  en: {
    eyebrow: "Shared trip",
    unavailableTitle: "This link is no longer available",
    unavailableDetail: "It may have expired, been replaced, or been revoked by the person who shared it.",
    offlineTitle: "We couldn't connect",
    offlineDetail: "Check your connection and try again. The trip remains protected.",
    retry: "Try again",
    loadingTitle: "Preparing the itinerary…",
    loadingDetail: "We're loading the version that was shared with you.",
    documentTitle: "Shared trip",
    readOnly: "View only",
    sharedOn: (value) => `Shared on ${value}.`,
    sharedFallback: "Itinerary shared with Sendero.",
    expiresOn: (value) => ` Available until ${value}.`,
    readOnlyFooter: "This view does not allow changes to the trip.",
  },
  es: {
    eyebrow: "Viaje compartido",
    unavailableTitle: "Este enlace ya no está disponible",
    unavailableDetail: "Puede haber vencido, haber sido reemplazado o haber sido revocado por quien lo compartió.",
    offlineTitle: "No pudimos conectar",
    offlineDetail: "Revisa tu conexión e inténtalo nuevamente. El viaje sigue protegido.",
    retry: "Reintentar",
    loadingTitle: "Preparando el itinerario…",
    loadingDetail: "Estamos cargando la versión que compartieron contigo.",
    documentTitle: "Viaje compartido",
    readOnly: "Solo lectura",
    sharedOn: (value) => `Compartido el ${value}.`,
    sharedFallback: "Itinerario compartido con Sendero.",
    expiresOn: (value) => ` Disponible hasta el ${value}.`,
    readOnlyFooter: "Esta vista no permite modificar el viaje.",
  },
  pt: {
    eyebrow: "Viagem compartilhada",
    unavailableTitle: "Este link não está mais disponível",
    unavailableDetail: "Ele pode ter expirado, sido substituído ou revogado por quem o compartilhou.",
    offlineTitle: "Não foi possível conectar",
    offlineDetail: "Verifique sua conexão e tente novamente. A viagem continua protegida.",
    retry: "Tentar novamente",
    loadingTitle: "Preparando o roteiro…",
    loadingDetail: "Estamos carregando a versão que foi compartilhada com você.",
    documentTitle: "Viagem compartilhada",
    readOnly: "Somente leitura",
    sharedOn: (value) => `Compartilhado em ${value}.`,
    sharedFallback: "Roteiro compartilhado com o Sendero.",
    expiresOn: (value) => ` Disponível até ${value}.`,
    readOnlyFooter: "Esta visualização não permite alterar a viagem.",
  },
};

function copyFor(locale) {
  return COPY[localeLanguage(locale)] || COPY.en;
}

function readableTimestamp(value, locale) {
  return formatDate(locale, value, { day: "numeric", month: "long", year: "numeric" });
}

function ShareState({ kind, locale, onRetry }) {
  const unavailable = kind === "unavailable";
  const copy = copyFor(locale);
  return (
    <main className="public-share-shell public-share-state">
      <div className="public-brand"><BrandMark /><strong>Sendero</strong></div>
      <section aria-live="polite" className="public-state-card" role={unavailable ? "alert" : "status"}>
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1>{unavailable ? copy.unavailableTitle : copy.offlineTitle}</h1>
        <p>{unavailable
          ? copy.unavailableDetail
          : copy.offlineDetail}</p>
        {!unavailable ? <Button onClick={onRetry} variant="primary">{copy.retry}</Button> : null}
      </section>
    </main>
  );
}

function LoadingShare({ locale }) {
  const copy = copyFor(locale);
  return (
    <main aria-busy="true" className="public-share-shell public-share-state">
      <div className="public-brand"><BrandMark /><strong>Sendero</strong></div>
      <section aria-live="polite" className="public-state-card" role="status">
        <span aria-hidden="true" className="loading-dot" />
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1>{copy.loadingTitle}</h1>
        <p>{copy.loadingDetail}</p>
      </section>
    </main>
  );
}

export function PublicShareApp() {
  const [requestKey, setRequestKey] = useState(0);
  const [result, setResult] = useState({ state: "loading" });
  const [activeView, setActiveView] = useState("list");
  const [token, setToken] = useState(() => shareToken());
  const locale = resolveContentLocale(result.state === "ready" ? result.share.itinerary.locale : undefined);
  const copy = copyFor(locale);

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
    setDocumentLocale(locale);
    if (result.state === "ready") document.title = `${result.share.itinerary.title} · Sendero`;
    else document.title = `${copy.documentTitle} · Sendero`;
  }, [copy.documentTitle, locale, result]);

  if (result.state === "loading") return <LoadingShare locale={locale} />;
  if (result.state !== "ready") return <ShareState kind={result.state} locale={locale} onRetry={() => setRequestKey((value) => value + 1)} />;

  const { share } = result;
  const freshness = readableTimestamp(share.updatedAt || share.publishedAt, locale);
  const expiry = readableTimestamp(share.expiresAt, locale);
  return (
    <main className="public-share-shell">
      <div className="public-share-topbar">
        <div className="public-brand"><BrandMark /><strong>Sendero</strong></div>
        <span className="read-only-badge">{copy.readOnly}</span>
      </div>
      <ItineraryViewer
        activeView={activeView}
        itinerary={share.itinerary}
        onViewChange={setActiveView}
        variant="public"
      />
      <footer className="public-share-footer">
        <p>{freshness ? copy.sharedOn(freshness) : copy.sharedFallback}{expiry ? copy.expiresOn(expiry) : ""}</p>
        <p>{copy.readOnlyFooter}</p>
      </footer>
    </main>
  );
}
