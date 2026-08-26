import { useEffect, useRef, useState } from "react";
import { Button, SelectionReceipt } from "../components.jsx";
import { callTool, sendFollowUpMessage, setWidgetState, updateModelContext, useToolOutput, widgetState } from "../bridge.js";
import { tripSelectionContinuation } from "../conversation.js";
import { ItineraryApp } from "../itinerary/ItineraryApp.jsx";
import { normalizeToolOutput } from "../tool-output.js";

const purposeCopy = {
  open: { eyebrow: "Tus viajes", title: "¿Cuál quieres abrir?", action: "Abrir", selected: "Viaje elegido" },
  adjust: { eyebrow: "Ajustar viaje", title: "¿Cuál quieres reorganizar?", action: "Ajustar", selected: "Viaje para ajustar" },
  refresh: { eyebrow: "Actualizar viaje", title: "¿Cuál quieres actualizar?", action: "Actualizar", selected: "Viaje para actualizar" },
};

const roleCopy = {
  owner: "Propietario",
  editor: "Editor",
  viewer: "Solo lectura",
};

function formatDates(startDate, endDate) {
  const formatter = new Intl.DateTimeFormat("es", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return `${formatter.format(new Date(`${startDate}T00:00:00Z`))} — ${formatter.format(new Date(`${endDate}T00:00:00Z`))}`;
}

function restoredStatus(saved) {
  if (typeof saved.status === "string") return { state: saved.status ? "idle" : "idle", message: saved.status };
  if (saved.status?.state === "loading") return { state: "error", message: "La continuación quedó pendiente. Puedes intentarlo otra vez." };
  return saved.status || { state: "idle", message: "" };
}

export function TripListApp() {
  const { output } = useToolOutput();
  const saved = widgetState();
  const [listedOutput, setListedOutput] = useState(null);
  const currentOutput = listedOutput || output;
  const trips = currentOutput?.trips || [];
  const purpose = currentOutput?.purpose || "open";
  const copy = purposeCopy[purpose] || purposeCopy.open;
  const pendingRef = useRef(false);
  const [selectedTrip, setSelectedTrip] = useState(saved.selectedTrip || null);
  const [status, setStatus] = useState(() => restoredStatus(saved));
  // Keep the full itinerary in memory only. Persisting a complete trip in widget
  // state can exceed host limits; a remount falls back to the inert selection receipt.
  const [openedTrip, setOpenedTrip] = useState(output?.state === "opened" ? output : null);

  useEffect(() => {
    if (output?.state === "opened" && output.itinerary) setOpenedTrip(output);
  }, [output]);

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
      message: purpose === "open" ? "Abriendo el viaje…" : "Continuando en la conversación…",
    };
    setStatus(loading);
    persistWidgetState({ selectedTrip: selection, openedTrip: null, status: loading });
    try {
      if (purpose === "open") {
        const opened = normalizeToolOutput(await callTool("open_trip", { tripId: trip.id }));
        if (opened?.state === "needs_selection") {
          const idle = { state: "idle", message: "Elige el viaje que quieres abrir." };
          setSelectedTrip(null);
          setStatus(idle);
          persistWidgetState({ selectedTrip: null, openedTrip: null, status: idle });
          return;
        }
        if (opened?.state === "empty" || opened?.state === "not_found") {
          const empty = {
            state: "empty",
            message: "No encontramos ese viaje. Puede que se haya eliminado o que ya no tengas acceso.",
          };
          setStatus(empty);
          persistWidgetState({ selectedTrip: selection, openedTrip: null, status: empty });
          return;
        }
        if (opened?.state !== "opened" || opened.tripId !== trip.id || !opened.itinerary) {
          throw new Error("Sendero no devolvió el viaje solicitado.");
        }
        const success = { state: "success", message: "Viaje abierto." };
        setOpenedTrip(opened);
        setStatus(success);
        persistWidgetState({ selectedTrip: selection, openedTrip: null, status: success });
        return;
      }

      const continuation = tripSelectionContinuation({ trip, purpose });
      await updateModelContext(continuation.context);
      await sendFollowUpMessage(continuation.visibleMessage);
      const success = { state: "success", message: "Selección enviada." };
      setStatus(success);
      persistWidgetState({ selectedTrip: selection, openedTrip: null, status: success });
    } catch {
      const failure = {
        state: "error",
        message: purpose === "open"
          ? "No pudimos abrir este viaje. Tu elección sigue aquí; inténtalo de nuevo."
          : "No pudimos continuar todavía. Tu elección sigue aquí; inténtalo de nuevo.",
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
    const loading = { state: "loading", message: "Buscando tus viajes…" };
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
      const failure = { state: "error", message: "No pudimos cargar tus viajes. Inténtalo de nuevo." };
      setStatus(failure);
      persistWidgetState({ selectedTrip: null, openedTrip: null, status: failure });
    } finally {
      pendingRef.current = false;
    }
  }

  async function createTrip() {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setStatus({ state: "loading", message: "Abriendo un nuevo viaje…" });
    try {
      await sendFollowUpMessage("Quiero crear un viaje nuevo. Ayúdame a completar lo esencial y continúa desde ahí.");
    } catch {
      setStatus({ state: "error", message: "No pudimos iniciar el viaje todavía. Inténtalo de nuevo." });
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
          description={`${selectedTrip.destination} · ${formatDates(selectedTrip.startDate, selectedTrip.endDate)}`}
          eyebrow={copy.selected}
          status={status.message}
          title={selectedTrip.title}
        >
          {status.state === "error" ? <Button onClick={() => selectTrip(selectedTrip)} variant="secondary">Reintentar</Button> : null}
          {status.state === "empty" ? <Button onClick={clearSelection} variant="secondary">Volver a mis viajes</Button> : null}
        </SelectionReceipt>
      </main>
    );
  }

  if (purpose === "open" && currentOutput?.state === "not_found") {
    return (
      <main className="app-shell trips-shell">
        <div className="empty-state">
          <div>
            <strong>No encontramos ese viaje</strong>
            <p>Puede que se haya eliminado o que ya no tengas acceso.</p>
            <Button disabled={status.state === "loading"} onClick={viewSavedTrips} variant="primary">Ver mis viajes</Button>
            {status.message ? <p role={status.state === "error" ? "alert" : undefined}>{status.message}</p> : null}
          </div>
        </div>
      </main>
    );
  }

  if (!trips.length) {
    return (
      <main className="app-shell trips-shell">
        <div className="empty-state"><div><strong>Todavía no tienes viajes guardados</strong><p>Crea uno y Sendero lo dejará listo para retomarlo después.</p><Button disabled={status.state === "loading"} onClick={createTrip} variant="primary">Crear viaje</Button>{status.message ? <p>{status.message}</p> : null}</div></div>
      </main>
    );
  }

  return (
    <main className="app-shell trips-shell">
      <header className="trip-list-header">
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <p className="meta">Elige una tarjeta y continuamos desde ahí.</p>
      </header>
      <div className="trip-list">
        {trips.map((trip) => (
          <button className="trip-card" disabled={status.state === "loading"} key={trip.id} onClick={() => selectTrip(trip)} type="button">
            <span className="trip-card-main"><strong>{trip.title}</strong><span>{trip.destination} · {formatDates(trip.startDate, trip.endDate)}</span></span>
            <span className="trip-card-meta"><small>Versión {trip.currentVersion} · {roleCopy[trip.role] || "Viaje guardado"}</small><b>{copy.action} <span aria-hidden="true">→</span></b></span>
          </button>
        ))}
      </div>
    </main>
  );
}
