import { useEffect, useState } from "react";
import { Button } from "../components.jsx";
import { openExternal, sendFollowUpMessage, setWidgetState, useToolOutput, widgetState } from "../bridge.js";
import { ItineraryViewer } from "./ItineraryViewer.jsx";

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

  function changeView(next) {
    setActiveView(next);
    setWidgetState({ activeView: next });
  }

  if (!itinerary) return <main className="app-shell"><LoadingState failed={timedOut} onRetry={() => { setTimedOut(false); refresh(); }} /></main>;

  return (
    <main className="app-shell">
      <ItineraryViewer
        actions={(
          <>
          <Button onClick={() => sendFollowUpMessage(`Quiero ajustar el itinerario “${itinerary.title}” sin perder actividades fijas ni reservas confirmadas.`)}>Ajustar viaje</Button>
          <Button onClick={() => sendFollowUpMessage(`Revisa todas las reservas pendientes del itinerario “${itinerary.title}”, con enlaces oficiales y fechas recomendadas.`)} variant="ghost">Revisar reservas</Button>
          </>
        )}
        activeView={activeView}
        itinerary={itinerary}
        onOpenExternal={openExternal}
        onViewChange={changeView}
        variant="chat"
        warnings={warnings}
      />
    </main>
  );
}
