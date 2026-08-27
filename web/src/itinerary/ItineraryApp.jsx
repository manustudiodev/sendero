import { useEffect, useRef, useState } from "react";
import { Button } from "../components.jsx";
import { callTool, openExternal, setWidgetState, useToolOutput, widgetState } from "../bridge.js";
import { ItineraryViewer } from "./ItineraryViewer.jsx";
import { reservationEntryKey } from "./presentation-utils.js";

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

function tripContext(output, itinerary) {
  const context = output?.tripContext || output?.trip || {};
  return {
    tripId: output?.tripId || context.tripId || context.id || itinerary?.tripId || itinerary?.id || "",
    version: output?.version || context.version || context.currentVersion || itinerary?.version || itinerary?.currentVersion || null,
    role: output?.role || context.role || itinerary?.role || "",
  };
}

function normalizedToolResult(value) {
  return value?.structuredContent || value || {};
}

function mergedWidgetState(patch) {
  return { ...widgetState(), ...patch };
}

function reservationReceiptKey(dayDate, activityId) {
  return `${dayDate}:${activityId}`;
}

function applyReservationReceipt(itinerary, receipt, context) {
  if (!itinerary || !receipt?.statuses) return itinerary;
  if (receipt.tripId && context?.tripId && receipt.tripId !== context.tripId) return itinerary;
  if (
    receipt.version != null
    && context?.version != null
    && Number(receipt.version) < Number(context.version)
  ) return itinerary;
  return {
    ...itinerary,
    days: itinerary.days.map((day) => ({
      ...day,
      activities: day.activities.map((activity) => {
        const status = receipt.statuses[reservationReceiptKey(day.date, activity.id)];
        if (!status || !activity.reservation) return activity;
        return { ...activity, reservation: { ...activity.reservation, status } };
      }),
    })),
  };
}

export function ItineraryApp({ initialOutput = null } = {}) {
  const toolOutput = useToolOutput();
  const output = initialOutput || toolOutput.output;
  const refresh = toolOutput.refresh;
  const incomingItinerary = output?.itinerary;
  const initialReceipt = widgetState().reservationReceipt || null;
  const incomingContext = tripContext(output, incomingItinerary);
  const [activeView, setActiveView] = useState(() => widgetState().activeView || "list");
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => widgetState().selectedCalendarDate || "");
  const [selectedCalendarMonth, setSelectedCalendarMonth] = useState(() => widgetState().selectedCalendarMonth || "");
  const [selectedReservationKey, setSelectedReservationKey] = useState(() => widgetState().selectedReservationKey || "");
  const [selectedRouteDate, setSelectedRouteDate] = useState(() => widgetState().selectedRouteDate || "");
  const [itinerary, setItinerary] = useState(() => applyReservationReceipt(incomingItinerary, initialReceipt, incomingContext) || null);
  const [context, setContext] = useState(() => incomingContext);
  const contextRef = useRef(context);
  const hydrationKeyRef = useRef("");
  const reservationQueueRef = useRef(Promise.resolve());
  const reservationOperationIdsRef = useRef(widgetState().reservationOperationIds || {});
  const reservationReceiptRef = useRef(initialReceipt);
  const sourceSignatureRef = useRef("");
  const sourceSignature = incomingItinerary ? JSON.stringify({
    itinerary: incomingItinerary,
    context: tripContext(output, incomingItinerary),
  }) : "";

  useEffect(() => {
    contextRef.current = context;
  }, [context]);

  useEffect(() => {
    if (!incomingItinerary || sourceSignatureRef.current === sourceSignature) return;
    sourceSignatureRef.current = sourceSignature;
    const nextContext = tripContext(output, incomingItinerary);
    const currentContext = contextRef.current;
    if (
      nextContext.tripId
      && nextContext.tripId === currentContext.tripId
      && Number(nextContext.version) <= Number(currentContext.version)
    ) return;
    setItinerary(applyReservationReceipt(incomingItinerary, reservationReceiptRef.current, nextContext));
    setContext(nextContext);
  }, [incomingItinerary, output, sourceSignature]);

  function persistWidgetState(patch) {
    setWidgetState(mergedWidgetState(patch));
  }

  function changeView(next) {
    setActiveView(next);
    if (next !== "reservations") setSelectedReservationKey("");
    persistWidgetState({
      activeView: next,
      ...(next !== "reservations" ? { selectedReservationKey: "" } : {}),
    });
  }

  function openReservation(target) {
    const nextKey = target
      ? reservationEntryKey(target.dayDate, target.activityId)
      : "";
    setSelectedReservationKey(nextKey);
    setActiveView("reservations");
    persistWidgetState({ activeView: "reservations", selectedReservationKey: nextKey });
  }

  function changeCalendarDay(next) {
    setSelectedCalendarDate(next);
    persistWidgetState({ selectedCalendarDate: next });
  }

  function changeCalendarMonth(next) {
    setSelectedCalendarMonth(next);
    persistWidgetState({ selectedCalendarMonth: next });
  }

  function changeRouteDay(next) {
    setSelectedRouteDate(next);
    persistWidgetState({ selectedRouteDate: next });
  }

  async function loadAuthoritativeTrip(tripId) {
    const result = normalizedToolResult(await callTool("get_itinerary", { tripId }));
    if (!result.itinerary || !result.version) throw new Error("Sendero no pudo recargar la última versión del viaje.");
    const nextContext = {
      tripId: result.id || tripId,
      version: result.version,
      role: result.role || contextRef.current.role,
    };
    if (
      nextContext.tripId === contextRef.current.tripId
      && Number(nextContext.version) < Number(contextRef.current.version)
    ) return result;
    contextRef.current = nextContext;
    const previousReceipt = reservationReceiptRef.current;
    const nextReceipt = {
      ...nextContext,
      statuses: previousReceipt?.tripId === nextContext.tripId ? previousReceipt.statuses || {} : {},
    };
    reservationReceiptRef.current = nextReceipt;
    setContext(nextContext);
    setItinerary(result.itinerary);
    persistWidgetState({ reservationReceipt: nextReceipt });
    return result;
  }

  useEffect(() => {
    const receipt = reservationReceiptRef.current;
    const incomingContext = tripContext(output, incomingItinerary);
    if (
      !receipt?.tripId
      || receipt.tripId !== incomingContext.tripId
      || Number(receipt.version) <= Number(incomingContext.version)
    ) return;
    const hydrationKey = `${receipt.tripId}:${receipt.version}`;
    if (hydrationKeyRef.current === hydrationKey) return;
    hydrationKeyRef.current = hydrationKey;
    loadAuthoritativeTrip(receipt.tripId).catch(() => undefined);
  }, [incomingItinerary, output]);

  async function performReservationStatusUpdate({ activityId, dayDate, status }) {
    const currentContext = contextRef.current;
    if (!currentContext.tripId || !currentContext.version) {
      throw new Error("Guarda el viaje antes de actualizar sus reservas.");
    }
    const operationKey = [currentContext.tripId, currentContext.version, dayDate, activityId, status].join(":");
    const operationIds = reservationOperationIdsRef.current;
    const operationId = operationIds[operationKey]
      || `sendero-reservation:${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
    if (!operationIds[operationKey]) {
      reservationOperationIdsRef.current = { ...operationIds, [operationKey]: operationId };
      persistWidgetState({ reservationOperationIds: reservationOperationIdsRef.current });
    }
    let result;
    try {
      result = normalizedToolResult(await callTool("update_reservation_status", {
        activityId,
        dayDate,
        expectedVersion: currentContext.version,
        operationId,
        status,
        tripId: currentContext.tripId,
      }));
    } catch (caught) {
      if (/version changed|refresh before updating/i.test(caught?.message || "")) {
        const remainingOperationIds = { ...reservationOperationIdsRef.current };
        delete remainingOperationIds[operationKey];
        reservationOperationIdsRef.current = remainingOperationIds;
        persistWidgetState({ reservationOperationIds: remainingOperationIds });
        await loadAuthoritativeTrip(currentContext.tripId);
        throw new Error("El viaje cambió en otro lugar. Ya cargamos la última versión; vuelve a intentarlo.");
      }
      throw caught;
    }
    if (!result.itinerary) throw new Error("Sendero no devolvió el viaje actualizado.");
    const remainingOperationIds = { ...reservationOperationIdsRef.current };
    delete remainingOperationIds[operationKey];
    reservationOperationIdsRef.current = remainingOperationIds;
    const nextContext = {
      ...currentContext,
      role: result.role || currentContext.role,
      version: result.version || currentContext.version,
    };
    contextRef.current = nextContext;
    const previousReceipt = reservationReceiptRef.current;
    const nextReceipt = {
      ...nextContext,
      statuses: {
        ...(previousReceipt?.tripId === nextContext.tripId ? previousReceipt.statuses || {} : {}),
        [reservationReceiptKey(dayDate, activityId)]: status,
      },
    };
    reservationReceiptRef.current = nextReceipt;
    persistWidgetState({
      reservationOperationIds: remainingOperationIds,
      reservationReceipt: nextReceipt,
    });
    setItinerary(result.itinerary);
    setContext(nextContext);
  }

  function updateReservationStatus(input) {
    const run = reservationQueueRef.current.then(
      () => performReservationStatusUpdate(input),
      () => performReservationStatusUpdate(input),
    );
    reservationQueueRef.current = run.catch(() => undefined);
    return run;
  }

  const explicitFailure = output?.state === "error" || Boolean(output?.error || output?.isError);
  if (!itinerary) return <main className="app-shell"><LoadingState failed={explicitFailure} onRetry={refresh} /></main>;
  const reservationWritable = Boolean(context.tripId && context.version && ["owner", "editor"].includes(context.role));

  return (
    <main className="app-shell">
      <ItineraryViewer
        activeView={activeView}
        itinerary={itinerary}
        onCalendarDayChange={changeCalendarDay}
        onCalendarMonthChange={changeCalendarMonth}
        onOpenExternal={openExternal}
        onReservationOpen={openReservation}
        onReservationStatusChange={updateReservationStatus}
        onRouteDayChange={changeRouteDay}
        onViewChange={changeView}
        reservationWritable={reservationWritable}
        selectedCalendarDate={selectedCalendarDate}
        selectedCalendarMonth={selectedCalendarMonth}
        selectedReservationKey={selectedReservationKey}
        selectedRouteDate={selectedRouteDate}
        variant="chat"
      />
    </main>
  );
}
