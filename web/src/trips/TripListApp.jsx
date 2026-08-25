import { useRef, useState } from "react";
import { Button, SelectionReceipt } from "../components.jsx";
import { sendFollowUpMessage, setWidgetState, updateModelContext, useToolOutput, widgetState } from "../bridge.js";
import { tripSelectionContinuation } from "../conversation.js";

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
  const trips = output?.trips || [];
  const purpose = output?.purpose || "open";
  const copy = purposeCopy[purpose] || purposeCopy.open;
  const pendingRef = useRef(false);
  const [selectedTrip, setSelectedTrip] = useState(saved.selectedTrip || null);
  const [status, setStatus] = useState(() => restoredStatus(saved));

  async function selectTrip(trip) {
    if (pendingRef.current) return;
    const selection = { ...trip, purpose };
    setSelectedTrip(selection);
    pendingRef.current = true;
    const loading = { state: "loading", message: "Continuando en la conversación…" };
    setStatus(loading);
    setWidgetState({ selectedTrip: selection, status: loading });
    const continuation = tripSelectionContinuation({ trip, purpose });
    try {
      await updateModelContext(continuation.context);
      await sendFollowUpMessage(continuation.visibleMessage);
      const success = { state: "success", message: "Selección enviada." };
      setStatus(success);
      setWidgetState({ selectedTrip: selection, status: success });
    } catch {
      const failure = {
        state: "error",
        message: "No pudimos continuar todavía. Tu elección sigue aquí; inténtalo de nuevo.",
      };
      setStatus(failure);
      setWidgetState({ selectedTrip: selection, status: failure });
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
        </SelectionReceipt>
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
