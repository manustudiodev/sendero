import { useCallback, useEffect, useMemo, useState } from "react";
import { WebButton, WebPageFrame, WebState } from "./PageFrame.jsx";
import { hrefForLocale, useUiLocale } from "../i18n/LanguageSelector.jsx";
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

const COPY = {
  en: {
    roles: { editor: "Collaborator", owner: "Owner", viewer: "Viewer" },
    pendingDestination: "Destination to be confirmed",
    open: "Open",
    loading: "Finding your trips…",
    signIn: "Sign in",
    signedOutDetail: "Use your Sendero account to see trips you own and trips shared with you.",
    signedOutTitle: "Your trips are waiting",
    retry: "Try again",
    errorDetail: "Your trips are still saved. Try loading this page again.",
    errorTitle: "We couldn't show your trips",
    createChatgpt: "Create a trip in ChatGPT",
    emptyDetail: "When you create or accept a trip, it will appear here automatically.",
    emptyTitle: "No trips yet",
    eyebrow: "Your space",
    title: "Trips",
    description: "Open an itinerary or continue in ChatGPT to adjust it through conversation.",
    create: "Create a trip",
    owned: "My trips",
    shared: "Shared with me",
    documentTitle: "Your trips",
  },
  es: {
    roles: { editor: "Colaborador", owner: "Propietario", viewer: "Lector" },
    pendingDestination: "Destino por confirmar",
    open: "Abrir",
    loading: "Buscando tus viajes…",
    signIn: "Iniciar sesión",
    signedOutDetail: "Usa tu cuenta de Sendero para ver los itinerarios propios y compartidos contigo.",
    signedOutTitle: "Tus viajes te esperan",
    retry: "Intentar de nuevo",
    errorDetail: "Tus viajes siguen guardados. Intenta cargar esta página nuevamente.",
    errorTitle: "No pudimos mostrar tus viajes",
    createChatgpt: "Crear un viaje en ChatGPT",
    emptyDetail: "Cuando crees o aceptes un viaje, aparecerá aquí automáticamente.",
    emptyTitle: "Todavía no hay viajes",
    eyebrow: "Tu espacio",
    title: "Viajes",
    description: "Abre un itinerario o continúa en ChatGPT para ajustarlo conversando.",
    create: "Crear un viaje",
    owned: "Mis viajes",
    shared: "Compartidos conmigo",
    documentTitle: "Tus viajes",
  },
  pt: {
    roles: { editor: "Colaborador", owner: "Proprietário", viewer: "Visualizador" },
    pendingDestination: "Destino a confirmar",
    open: "Abrir",
    loading: "Buscando suas viagens…",
    signIn: "Entrar",
    signedOutDetail: "Use sua conta do Sendero para ver suas viagens e as que compartilharam com você.",
    signedOutTitle: "Suas viagens estão esperando",
    retry: "Tentar novamente",
    errorDetail: "Suas viagens continuam salvas. Tente carregar esta página novamente.",
    errorTitle: "Não foi possível mostrar suas viagens",
    createChatgpt: "Criar uma viagem no ChatGPT",
    emptyDetail: "Quando você criar ou aceitar uma viagem, ela aparecerá aqui automaticamente.",
    emptyTitle: "Ainda não há viagens",
    eyebrow: "Seu espaço",
    title: "Viagens",
    description: "Abra um roteiro ou continue no ChatGPT para ajustá-lo por conversa.",
    create: "Criar uma viagem",
    owned: "Minhas viagens",
    shared: "Compartilhadas comigo",
    documentTitle: "Suas viagens",
  },
  fr: {
    roles: { editor: "Collaborateur", owner: "Propriétaire", viewer: "Lecteur" },
    pendingDestination: "Destination à confirmer",
    open: "Ouvrir",
    loading: "Recherche de vos voyages…",
    signIn: "Se connecter",
    signedOutDetail: "Utilisez votre compte Sendero pour voir vos voyages et ceux qui ont été partagés avec vous.",
    signedOutTitle: "Vos voyages vous attendent",
    retry: "Réessayer",
    errorDetail: "Vos voyages sont toujours enregistrés. Essayez de recharger cette page.",
    errorTitle: "Impossible d’afficher vos voyages",
    createChatgpt: "Créer un voyage dans ChatGPT",
    emptyDetail: "Lorsque vous créerez ou accepterez un voyage, il apparaîtra automatiquement ici.",
    emptyTitle: "Aucun voyage pour le moment",
    eyebrow: "Votre espace",
    title: "Voyages",
    description: "Ouvrez un itinéraire ou poursuivez dans ChatGPT pour le modifier par la conversation.",
    create: "Créer un voyage",
    owned: "Mes voyages",
    shared: "Partagés avec moi",
    documentTitle: "Vos voyages",
  },
  de: {
    roles: { editor: "Mitwirkender", owner: "Eigentümer", viewer: "Leser" },
    pendingDestination: "Reiseziel noch zu bestätigen",
    open: "Öffnen",
    loading: "Deine Reisen werden gesucht…",
    signIn: "Anmelden",
    signedOutDetail: "Melde dich bei Sendero an, um eigene und mit dir geteilte Reisen zu sehen.",
    signedOutTitle: "Deine Reisen warten auf dich",
    retry: "Erneut versuchen",
    errorDetail: "Deine Reisen sind weiterhin gespeichert. Lade diese Seite erneut.",
    errorTitle: "Deine Reisen konnten nicht angezeigt werden",
    createChatgpt: "Reise in ChatGPT erstellen",
    emptyDetail: "Wenn du eine Reise erstellst oder annimmst, erscheint sie automatisch hier.",
    emptyTitle: "Noch keine Reisen",
    eyebrow: "Dein Bereich",
    title: "Reisen",
    description: "Öffne einen Reiseplan oder passe ihn im Gespräch mit ChatGPT an.",
    create: "Reise erstellen",
    owned: "Meine Reisen",
    shared: "Mit mir geteilt",
    documentTitle: "Deine Reisen",
  },
};

function TripCard({ copy, locale, trip }) {
  return (
    <a className="account-trip" href={hrefForLocale(`/app/trips/${encodeURIComponent(trip.webId)}`, locale)}>
      <div>
        <h3>{trip.title}</h3>
        <p>{trip.destination || copy.pendingDestination}</p>
        <p>{readableTripDates(trip.startDate, trip.endDate, locale)}</p>
      </div>
      <div className="account-trip-footer">
        <span className="web-role-badge">{copy.roles[trip.role]}</span>
        <span className="account-open">{copy.open} →</span>
      </div>
    </a>
  );
}

function TripGroup({ copy, label, locale, trips }) {
  if (!trips.length) return null;
  return (
    <section>
      <div className="account-section-heading">
        <h2>{label}</h2>
        <span>{trips.length}</span>
      </div>
      <div className="account-grid">{trips.map((trip) => <TripCard copy={copy} key={trip.webId} locale={locale} trip={trip} />)}</div>
    </section>
  );
}

export function AccountApp() {
  const [state, setState] = useState({ kind: "loading" });
  const { language, locale } = useUiLocale();
  const copy = COPY[language] || COPY.es;

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
  useEffect(() => { document.title = `${copy.documentTitle} · Sendero`; }, [copy.documentTitle]);

  const grouped = useMemo(() => {
    const trips = state.trips || [];
    return {
      owned: trips.filter((trip) => trip.role === "owner"),
      shared: trips.filter((trip) => trip.role !== "owner"),
    };
  }, [state.trips]);

  if (state.kind === "loading") return <WebState kind="loading" title={copy.loading} />;
  if (state.kind === "signed_out") {
    return <WebState action={<a className="web-button web-button-primary" href={loginUrl(state.session, hrefForLocale("/app", locale))}>{copy.signIn}</a>} detail={copy.signedOutDetail} title={copy.signedOutTitle} />;
  }
  if (state.kind === "error") {
    return <WebState action={<WebButton onClick={load}>{copy.retry}</WebButton>} detail={copy.errorDetail} kind="error" title={copy.errorTitle} />;
  }
  if (state.kind === "empty") {
    return <WebState action={<a className="web-button web-button-primary" href={document.querySelector('meta[name="sendero-chatgpt-url"]')?.content || "https://chatgpt.com/"}>{copy.createChatgpt}</a>} detail={copy.emptyDetail} title={copy.emptyTitle} />;
  }

  return (
    <WebPageFrame csrfToken={state.session.csrfToken} user={state.session.user}>
      <style>{accountStyles}</style>
      <header className="web-heading">
        <p className="web-eyebrow">{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <p>{copy.description}</p>
        <div className="web-actions"><a className="web-button web-button-primary" href={hrefForLocale("/app/new", locale)}>{copy.create}</a></div>
      </header>
      <div className="account-groups">
        <TripGroup copy={copy} label={copy.owned} locale={locale} trips={grouped.owned} />
        <TripGroup copy={copy} label={copy.shared} locale={locale} trips={grouped.shared} />
      </div>
    </WebPageFrame>
  );
}
