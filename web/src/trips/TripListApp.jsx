import { useEffect, useRef, useState } from "react";
import { Button, SelectionReceipt } from "../components.jsx";
import { callTool, sendFollowUpMessage, setWidgetState, updateModelContext, useToolOutput, widgetState } from "../bridge.js";
import { tripSelectionContinuation } from "../conversation.js";
import { ItineraryApp } from "../itinerary/ItineraryApp.jsx";
import { formatDate, localeLanguage, resolveContentLocale, setDocumentLocale } from "../i18n/index.js";
import { normalizeToolOutput } from "../tool-output.js";

const COPY = {
  en: {
    purpose: {
      open: { eyebrow: "Your trips", title: "Which one would you like to open?", action: "Open", selected: "Selected trip" },
      adjust: { eyebrow: "Adjust trip", title: "Which one would you like to reorganize?", action: "Adjust", selected: "Trip to adjust" },
      refresh: { eyebrow: "Refresh trip", title: "Which one would you like to refresh?", action: "Refresh", selected: "Trip to refresh" },
    },
    roles: { owner: "Owner", editor: "Editor", viewer: "View only" },
    pending: "The continuation is still pending. You can try again.",
    opening: "Opening the trip…",
    continuing: "Continuing in the conversation…",
    chooseTrip: "Choose the trip you want to open.",
    missingTrip: "We couldn't find that trip. It may have been deleted or you may no longer have access.",
    opened: "Trip opened.",
    selected: "Selection sent.",
    openFailed: "We couldn't open this trip. Your selection is still here; try again.",
    continueFailed: "We couldn't continue yet. Your selection is still here; try again.",
    searching: "Looking for your trips…",
    listFailed: "We couldn't load your trips. Try again.",
    creating: "Opening a new trip…",
    createPrompt: "I want to create a new trip. Help me complete the essentials and continue from there.",
    createFailed: "We couldn't start the trip yet. Try again.",
    retry: "Try again",
    back: "Back to my trips",
    notFoundTitle: "We couldn't find that trip",
    viewTrips: "View my trips",
    emptyTitle: "You don't have any saved trips yet",
    emptyDetail: "Create one and Sendero will keep it ready for you to continue later.",
    create: "Create trip",
    chooseCard: "Choose a card and we'll continue from there.",
    version: "Version",
    savedTrip: "Saved trip",
  },
  es: {
    purpose: {
      open: { eyebrow: "Tus viajes", title: "¿Cuál quieres abrir?", action: "Abrir", selected: "Viaje elegido" },
      adjust: { eyebrow: "Ajustar viaje", title: "¿Cuál quieres reorganizar?", action: "Ajustar", selected: "Viaje para ajustar" },
      refresh: { eyebrow: "Actualizar viaje", title: "¿Cuál quieres actualizar?", action: "Actualizar", selected: "Viaje para actualizar" },
    },
    roles: { owner: "Propietario", editor: "Editor", viewer: "Solo lectura" },
    pending: "La continuación quedó pendiente. Puedes intentarlo otra vez.",
    opening: "Abriendo el viaje…",
    continuing: "Continuando en la conversación…",
    chooseTrip: "Elige el viaje que quieres abrir.",
    missingTrip: "No encontramos ese viaje. Puede que se haya eliminado o que ya no tengas acceso.",
    opened: "Viaje abierto.",
    selected: "Selección enviada.",
    openFailed: "No pudimos abrir este viaje. Tu elección sigue aquí; inténtalo de nuevo.",
    continueFailed: "No pudimos continuar todavía. Tu elección sigue aquí; inténtalo de nuevo.",
    searching: "Buscando tus viajes…",
    listFailed: "No pudimos cargar tus viajes. Inténtalo de nuevo.",
    creating: "Abriendo un nuevo viaje…",
    createPrompt: "Quiero crear un viaje nuevo. Ayúdame a completar lo esencial y continúa desde ahí.",
    createFailed: "No pudimos iniciar el viaje todavía. Inténtalo de nuevo.",
    retry: "Reintentar",
    back: "Volver a mis viajes",
    notFoundTitle: "No encontramos ese viaje",
    viewTrips: "Ver mis viajes",
    emptyTitle: "Todavía no tienes viajes guardados",
    emptyDetail: "Crea uno y Sendero lo dejará listo para retomarlo después.",
    create: "Crear viaje",
    chooseCard: "Elige una tarjeta y continuamos desde ahí.",
    version: "Versión",
    savedTrip: "Viaje guardado",
  },
  pt: {
    purpose: {
      open: { eyebrow: "Suas viagens", title: "Qual você quer abrir?", action: "Abrir", selected: "Viagem escolhida" },
      adjust: { eyebrow: "Ajustar viagem", title: "Qual você quer reorganizar?", action: "Ajustar", selected: "Viagem para ajustar" },
      refresh: { eyebrow: "Atualizar viagem", title: "Qual você quer atualizar?", action: "Atualizar", selected: "Viagem para atualizar" },
    },
    roles: { owner: "Proprietário", editor: "Editor", viewer: "Somente leitura" },
    pending: "A continuação ficou pendente. Você pode tentar novamente.",
    opening: "Abrindo a viagem…",
    continuing: "Continuando na conversa…",
    chooseTrip: "Escolha a viagem que você quer abrir.",
    missingTrip: "Não encontramos essa viagem. Ela pode ter sido excluída ou você pode não ter mais acesso.",
    opened: "Viagem aberta.",
    selected: "Seleção enviada.",
    openFailed: "Não foi possível abrir esta viagem. Sua seleção continua aqui; tente novamente.",
    continueFailed: "Ainda não foi possível continuar. Sua seleção continua aqui; tente novamente.",
    searching: "Buscando suas viagens…",
    listFailed: "Não foi possível carregar suas viagens. Tente novamente.",
    creating: "Abrindo uma nova viagem…",
    createPrompt: "Quero criar uma nova viagem. Ajude-me a completar o essencial e continue a partir daí.",
    createFailed: "Ainda não foi possível iniciar a viagem. Tente novamente.",
    retry: "Tentar novamente",
    back: "Voltar às minhas viagens",
    notFoundTitle: "Não encontramos essa viagem",
    viewTrips: "Ver minhas viagens",
    emptyTitle: "Você ainda não tem viagens salvas",
    emptyDetail: "Crie uma e o Sendero a deixará pronta para você continuar depois.",
    create: "Criar viagem",
    chooseCard: "Escolha um cartão e continuaremos a partir daí.",
    version: "Versão",
    savedTrip: "Viagem salva",
  },
};

function copyFor(locale) {
  return COPY[localeLanguage(locale)] || COPY.en;
}

function formatDates(startDate, endDate, locale) {
  return `${formatDate(locale, startDate, { day: "numeric", month: "short", year: "numeric" })} — ${formatDate(locale, endDate, { day: "numeric", month: "short", year: "numeric" })}`;
}

function restoredStatus(saved, copy) {
  if (typeof saved.status === "string") return { state: saved.status ? "idle" : "idle", message: saved.status };
  if (saved.status?.state === "loading") return { state: "error", message: copy.pending };
  return saved.status || { state: "idle", message: "" };
}

export function TripListApp() {
  const { output } = useToolOutput();
  const saved = widgetState();
  const [listedOutput, setListedOutput] = useState(null);
  const currentOutput = listedOutput || output;
  const trips = currentOutput?.trips || [];
  const purpose = currentOutput?.purpose || "open";
  const pendingRef = useRef(false);
  const [selectedTrip, setSelectedTrip] = useState(saved.selectedTrip || null);
  const [status, setStatus] = useState(() => restoredStatus(saved, copyFor(resolveContentLocale(saved.selectedTrip?.locale || output?.locale || output?.trips?.[0]?.locale))));
  // Keep the full itinerary in memory only. Persisting a complete trip in widget
  // state can exceed host limits; a remount falls back to the inert selection receipt.
  const [openedTrip, setOpenedTrip] = useState(output?.state === "opened" ? output : null);
  const locale = resolveContentLocale(openedTrip?.itinerary?.locale || selectedTrip?.locale || currentOutput?.locale || trips[0]?.locale);
  const strings = copyFor(locale);
  const copy = strings.purpose[purpose] || strings.purpose.open;

  useEffect(() => {
    if (output?.state === "opened" && output.itinerary) setOpenedTrip(output);
  }, [output]);

  useEffect(() => { setDocumentLocale(locale); }, [locale]);

  function persistWidgetState(patch) {
    setWidgetState({
      ...widgetState(),
      selectedTrip,
      status,
      ...patch,
    });
  }

  function clearSelection() {
    const idle = { state: "idle", message: "" };
    setSelectedTrip(null);
    setOpenedTrip(null);
    setStatus(idle);
    persistWidgetState({ selectedTrip: null, openedTrip: null, status: idle });
  }

  async function selectTrip(trip) {
    if (pendingRef.current) return;
    const selection = { ...trip, purpose };
    setSelectedTrip(selection);
    setOpenedTrip(null);
    pendingRef.current = true;
    const loading = {
      state: "loading",
      message: purpose === "open" ? strings.opening : strings.continuing,
    };
    setStatus(loading);
    persistWidgetState({ selectedTrip: selection, openedTrip: null, status: loading });
    try {
      if (purpose === "open") {
        const opened = normalizeToolOutput(await callTool("open_trip", { tripId: trip.id }));
        if (opened?.state === "needs_selection") {
          const idle = { state: "idle", message: strings.chooseTrip };
          setSelectedTrip(null);
          setStatus(idle);
          persistWidgetState({ selectedTrip: null, openedTrip: null, status: idle });
          return;
        }
        if (opened?.state === "empty" || opened?.state === "not_found") {
          const empty = {
            state: "empty",
            message: strings.missingTrip,
          };
          setStatus(empty);
          persistWidgetState({ selectedTrip: selection, openedTrip: null, status: empty });
          return;
        }
        if (opened?.state !== "opened" || opened.tripId !== trip.id || !opened.itinerary) {
          throw new Error("Sendero no devolvió el viaje solicitado.");
        }
        const success = { state: "success", message: strings.opened };
        setOpenedTrip(opened);
        setStatus(success);
        persistWidgetState({ selectedTrip: selection, openedTrip: null, status: success });
        return;
      }

      const continuation = tripSelectionContinuation({ trip, purpose });
      await updateModelContext(continuation.context);
      await sendFollowUpMessage(continuation.visibleMessage);
      const success = { state: "success", message: strings.selected };
      setStatus(success);
      persistWidgetState({ selectedTrip: selection, openedTrip: null, status: success });
    } catch {
      const failure = {
        state: "error",
        message: purpose === "open"
          ? strings.openFailed
          : strings.continueFailed,
      };
      setStatus(failure);
      persistWidgetState({ selectedTrip: selection, openedTrip: null, status: failure });
    } finally {
      pendingRef.current = false;
    }
  }

  async function viewSavedTrips() {
    if (pendingRef.current) return;
    pendingRef.current = true;
    const loading = { state: "loading", message: strings.searching };
    setStatus(loading);
    persistWidgetState({ selectedTrip: null, openedTrip: null, status: loading });
    try {
      const listed = normalizeToolOutput(
        await callTool("list_itineraries", { purpose: "open" }),
      );
      if (!listed || !Array.isArray(listed.trips)) {
        throw new Error("Sendero no devolvió la lista de viajes.");
      }
      setListedOutput({ ...listed, purpose: "open" });
      const success = { state: "idle", message: "" };
      setStatus(success);
      persistWidgetState({ selectedTrip: null, openedTrip: null, status: success });
    } catch {
      const failure = { state: "error", message: strings.listFailed };
      setStatus(failure);
      persistWidgetState({ selectedTrip: null, openedTrip: null, status: failure });
    } finally {
      pendingRef.current = false;
    }
  }

  async function createTrip() {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setStatus({ state: "loading", message: strings.creating });
    try {
      await sendFollowUpMessage(strings.createPrompt);
    } catch {
      setStatus({ state: "error", message: strings.createFailed });
    } finally {
      pendingRef.current = false;
    }
  }

  if (openedTrip?.state === "opened" && openedTrip.itinerary) {
    return <ItineraryApp initialOutput={openedTrip} />;
  }

  if (selectedTrip) {
    return (
      <main className="app-shell trips-shell compact-shell">
        <SelectionReceipt
          description={`${selectedTrip.destination} · ${formatDates(selectedTrip.startDate, selectedTrip.endDate, locale)}`}
          eyebrow={copy.selected}
          status={status.message}
          title={selectedTrip.title}
        >
          {status.state === "error" ? <Button onClick={() => selectTrip(selectedTrip)} variant="secondary">{strings.retry}</Button> : null}
          {status.state === "empty" ? <Button onClick={clearSelection} variant="secondary">{strings.back}</Button> : null}
        </SelectionReceipt>
      </main>
    );
  }

  if (purpose === "open" && currentOutput?.state === "not_found") {
    return (
      <main className="app-shell trips-shell">
        <div className="empty-state">
          <div>
            <strong>{strings.notFoundTitle}</strong>
            <p>{strings.missingTrip}</p>
            <Button disabled={status.state === "loading"} onClick={viewSavedTrips} variant="primary">{strings.viewTrips}</Button>
            {status.message ? <p role={status.state === "error" ? "alert" : undefined}>{status.message}</p> : null}
          </div>
        </div>
      </main>
    );
  }

  if (!trips.length) {
    return (
      <main className="app-shell trips-shell">
        <div className="empty-state"><div><strong>{strings.emptyTitle}</strong><p>{strings.emptyDetail}</p><Button disabled={status.state === "loading"} onClick={createTrip} variant="primary">{strings.create}</Button>{status.message ? <p>{status.message}</p> : null}</div></div>
      </main>
    );
  }

  return (
    <main className="app-shell trips-shell">
      <header className="trip-list-header">
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <p className="meta">{strings.chooseCard}</p>
      </header>
      <div className="trip-list">
        {trips.map((trip) => (
          <button className="trip-card" disabled={status.state === "loading"} key={trip.id} onClick={() => selectTrip(trip)} type="button">
            <span className="trip-card-main"><strong>{trip.title}</strong><span>{trip.destination} · {formatDates(trip.startDate, trip.endDate, resolveContentLocale(trip.locale))}</span></span>
            <span className="trip-card-meta"><small>{strings.version} {trip.currentVersion} · {strings.roles[trip.role] || strings.savedTrip}</small><b>{copy.action} <span aria-hidden="true">→</span></b></span>
          </button>
        ))}
      </div>
    </main>
  );
}
