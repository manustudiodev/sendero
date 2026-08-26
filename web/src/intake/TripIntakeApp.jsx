import { useEffect, useRef, useState } from "react";
import { Button, ChoiceChips, Field, InlineNotice, SegmentedControl, SelectionReceipt } from "../components.jsx";
import { DateRangePicker } from "../DateRangePicker.jsx";
import { callTool, sendFollowUpMessage, setWidgetState, updateModelContext, useToolOutput, widgetState } from "../bridge.js";
import { tripIntakeContinuation } from "../conversation.js";
import { normalizeToolOutput } from "../tool-output.js";

const launcherActions = [
  { id: "new", title: "Nuevo viaje", description: "Fechas, gustos y logística" },
  { id: "open", title: "Mis viajes", description: "Abrir un plan guardado" },
  { id: "adjust", title: "Ajustar", description: "Reorganizar sin perder reservas" },
  { id: "refresh", title: "Actualizar", description: "Clima, eventos y cierres" },
];

const defaultDraft = {
  destination: "",
  startDate: "",
  endDate: "",
  adults: 2,
  children: 0,
  lodgingStatus: "undecided",
  lodgingValue: "",
  transportModes: ["walk", "public_transit"],
  hasLicense: false,
  pace: "balanced",
  interests: "",
};

function draftFromBrief(brief = {}) {
  const lodgingStatus = brief.lodging?.status || (brief.lodging?.address ? "confirmed" : brief.lodging?.area ? "area_only" : "undecided");
  return {
    ...defaultDraft,
    destination: brief.destination || "",
    startDate: brief.startDate || "",
    endDate: brief.endDate || "",
    adults: brief.travellers?.adults || 2,
    children: brief.travellers?.children || 0,
    lodgingStatus,
    lodgingValue: brief.lodging?.address || brief.lodging?.area || "",
    transportModes: brief.transport?.modes?.length ? brief.transport.modes : defaultDraft.transportModes,
    hasLicense: brief.transport?.hasLicense || false,
    pace: brief.pace || "balanced",
    interests: brief.interests?.join(", ") || "",
  };
}

function toBrief(draft, baseBrief = {}) {
  const lodging = draft.lodgingStatus === "confirmed"
    ? { status: "confirmed", name: "Alojamiento", address: draft.lodgingValue.trim() }
    : draft.lodgingStatus === "area_only"
      ? { status: "area_only", name: "Zona provisional", area: draft.lodgingValue.trim() }
      : { status: "undecided", name: "Alojamiento por definir" };
  return {
    ...baseBrief,
    destination: draft.destination.trim(),
    startDate: draft.startDate,
    endDate: draft.endDate,
    lodging,
    travellers: {
      ...(baseBrief.travellers || {}),
      adults: Number(draft.adults),
      children: Number(draft.children),
    },
    pace: draft.pace,
    interests: draft.interests.split(",").map((value) => value.trim()).filter(Boolean),
    transport: {
      ...(baseBrief.transport || {}),
      modes: draft.transportModes,
      hasLicense: Boolean(draft.hasLicense),
      wantsCar: draft.transportModes.includes("car"),
    },
  };
}

function initialStatus(saved) {
  if (saved.continuation?.phase === "sent") {
    return { state: "sent", message: "Datos enviados. Sendero continúa en la conversación." };
  }
  if (["dispatching", "uncertain", "delivery_failed"].includes(saved.continuation?.phase)) {
    return {
      state: "error",
      message: "No pudimos confirmar la entrega. Si el chat no continúa, dímelo con tus palabras.",
    };
  }
  if (saved.status?.state === "sending") {
    return { state: "error", message: "La validación quedó pendiente. Puedes intentarlo otra vez." };
  }
  return saved.status || { state: "idle", message: "" };
}

export function TripIntakeApp() {
  const { output } = useToolOutput();
  const saved = useRef(widgetState()).current;
  const pendingRef = useRef(false);
  const outputHydratedRef = useRef(Boolean(output?.brief));
  const dirtyFieldsRef = useRef(new Set());
  const [view, setView] = useState(saved.view || output?.mode || "new");
  const [completedAction, setCompletedAction] = useState(saved.completedAction || null);
  const [baseBrief, setBaseBrief] = useState(() => saved.baseBrief || output?.brief || null);
  const [draft, setDraft] = useState(() => saved.draft || draftFromBrief(output?.brief));
  const [continuation, setContinuation] = useState(saved.continuation || null);
  const [status, setStatus] = useState(() => initialStatus(saved));

  useEffect(() => {
    if (!output?.brief || outputHydratedRef.current) return;
    outputHydratedRef.current = true;
    if (output.brief && !saved.baseBrief) setBaseBrief(output.brief);
    if (output.brief && !saved.draft) {
      const hydrated = draftFromBrief(output.brief);
      setDraft((current) => Object.fromEntries(
        Object.entries(hydrated).map(([field, value]) => [
          field,
          dirtyFieldsRef.current.has(field) ? current[field] : value,
        ]),
      ));
    }
  }, [output, saved.baseBrief, saved.draft]);

  useEffect(() => {
    if (output?.mode && !saved.view) setView(output.mode);
  }, [output?.mode]);

  useEffect(() => {
    setWidgetState({ view, baseBrief, draft, completedAction, continuation, status });
  }, [baseBrief, completedAction, continuation, draft, status, view]);

  function update(field, value) {
    dirtyFieldsRef.current.add(field);
    setDraft((current) => ({ ...current, [field]: value }));
    setStatus({ state: "idle", message: "" });
  }

  function updateDates(nextDates) {
    setDraft((current) => {
      if (nextDates.startDate !== current.startDate) dirtyFieldsRef.current.add("startDate");
      if (nextDates.endDate !== current.endDate) dirtyFieldsRef.current.add("endDate");
      return { ...current, ...nextDates };
    });
    setStatus({ state: "idle", message: "" });
  }

  async function sendAction(action) {
    if (pendingRef.current) return;
    if (action === "new") {
      setView("new");
      setWidgetState({ view: "new", baseBrief, draft, completedAction: null, continuation: null });
      return;
    }
    const selected = launcherActions.find((item) => item.id === action);
    const receipt = {
      id: action,
      title: selected.title,
      description: selected.description,
    };
    setCompletedAction(receipt);
    setView("complete");
    setWidgetState({ view: "complete", baseBrief, draft, completedAction: receipt, continuation: null });
    const prompts = {
      open: "Muéstrame mis viajes guardados como opciones para elegir.",
      adjust: "Quiero elegir uno de mis viajes guardados para ajustarlo sin perder reservas confirmadas ni actividades fijas.",
      refresh: "Quiero elegir uno de mis viajes guardados para actualizar su clima, eventos, cierres, transporte y reservas vigentes.",
    };
    pendingRef.current = true;
    setStatus({ state: "sending", message: "Continuando en la conversación…" });
    try {
      await sendFollowUpMessage(prompts[action]);
      setStatus({ state: "sent", message: "Selección enviada." });
    } catch {
      setStatus({ state: "error", message: "No pudimos continuar todavía. Inténtalo de nuevo." });
    } finally {
      pendingRef.current = false;
    }
  }

  async function deliverContinuation(nextContinuation, receipt) {
    const dispatching = { ...nextContinuation, phase: "dispatching" };
    const sending = { state: "sending", message: "Preparando el itinerario…" };
    setContinuation(dispatching);
    setStatus(sending);
    await Promise.resolve(setWidgetState({
      view: "complete",
      baseBrief: nextContinuation.brief,
      draft,
      completedAction: receipt,
      continuation: dispatching,
      status: sending,
    }));

    const next = tripIntakeContinuation(nextContinuation.brief);
    try {
      try {
        await updateModelContext(next.context);
      } catch {
        // The self-contained follow-up below carries the same critical details.
      }
      await sendFollowUpMessage(next.visibleMessage);
      const sent = { ...dispatching, phase: "sent" };
      const success = { state: "sent", message: "Datos enviados. Sendero continúa en la conversación." };
      setContinuation(sent);
      setStatus(success);
      try {
        await Promise.resolve(setWidgetState({
          view: "complete",
          baseBrief: nextContinuation.brief,
          draft,
          completedAction: receipt,
          continuation: sent,
          status: success,
        }));
      } catch {
        // The message was already acknowledged; never downgrade to a retryable state.
      }
    } catch {
      const uncertain = { ...dispatching, phase: "uncertain" };
      const uncertainStatus = {
        state: "error",
        message: "No pudimos confirmar la entrega. Si el chat no continúa, dímelo con tus palabras.",
      };
      setContinuation(uncertain);
      setStatus(uncertainStatus);
      try {
        await Promise.resolve(setWidgetState({
          view: "complete",
          baseBrief: nextContinuation.brief,
          draft,
          completedAction: receipt,
          continuation: uncertain,
          status: uncertainStatus,
        }));
      } catch {
        // Keep the local receipt uncertain; the persisted dispatching phase is also non-retryable.
      }
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (pendingRef.current) return;
    if (!draft.destination || !draft.startDate || !draft.endDate || !draft.transportModes.length) {
      setStatus({ state: "error", message: "Completa destino, fechas y al menos un medio de transporte." });
      return;
    }
    if (!Number.isInteger(Number(draft.adults)) || Number(draft.adults) < 1 || !Number.isInteger(Number(draft.children)) || Number(draft.children) < 0) {
      setStatus({ state: "error", message: "Indica una cantidad válida de adultos y niños." });
      return;
    }
    if (draft.startDate > draft.endDate) {
      setStatus({ state: "error", message: "La fecha de regreso debe ser posterior a la de salida." });
      return;
    }
    if (draft.lodgingStatus !== "undecided" && !draft.lodgingValue.trim()) {
      setStatus({ state: "error", message: "Indica la dirección o zona, o selecciona “Todavía no lo elegí”." });
      return;
    }
    if (draft.transportModes.includes("car") && !draft.hasLicense) {
      setStatus({ state: "error", message: "Marcaste auto, pero todavía no confirmaste una licencia válida." });
      return;
    }

    pendingRef.current = true;
    setStatus({ state: "sending", message: "Validando tus datos…" });
    try {
      const prepared = normalizeToolOutput(await callTool("prepare_trip_brief", {
        brief: toBrief(draft, baseBrief || {}),
      }));
      if (!prepared?.brief || prepared.ready !== true || prepared.criticalFields?.length) {
        const normalizedBrief = prepared?.brief || toBrief(draft, baseBrief || {});
        const failure = {
          state: "error",
          message: "Todavía falta corregir algún dato esencial antes de crear el itinerario.",
        };
        setBaseBrief(normalizedBrief);
        setDraft(draftFromBrief(normalizedBrief));
        setStatus(failure);
        await Promise.resolve(setWidgetState({
          view: "new",
          baseBrief: normalizedBrief,
          draft: draftFromBrief(normalizedBrief),
          completedAction: null,
          continuation: null,
          status: failure,
        }));
        return;
      }

      const brief = prepared.brief;
      const receipt = {
        id: "new",
        title: brief.destination,
        description: `${brief.startDate} — ${brief.endDate} · ${Number(brief.travellers.adults) + Number(brief.travellers.children || 0)} viajero${Number(brief.travellers.adults) + Number(brief.travellers.children || 0) === 1 ? "" : "s"}`,
      };
      const nextContinuation = { brief, phase: "validated" };
      setBaseBrief(brief);
      setCompletedAction(receipt);
      setView("complete");
      setContinuation(nextContinuation);
      await deliverContinuation(nextContinuation, receipt);
    } catch {
      const failure = { state: "error", message: "No pudimos validar tus datos todavía. Inténtalo de nuevo." };
      setView("new");
      setCompletedAction(null);
      setContinuation(null);
      setStatus(failure);
      await Promise.resolve(setWidgetState({
        view: "new",
        baseBrief,
        draft,
        completedAction: null,
        continuation: null,
        status: failure,
      }));
    } finally {
      pendingRef.current = false;
    }
  }

  if (view === "complete" && completedAction) {
    return (
      <main className="app-shell intake-shell compact-shell">
        <SelectionReceipt
          description={completedAction.description}
          eyebrow={completedAction.id === "new" ? "Viaje solicitado" : "Opción elegida"}
          status={status.message}
          title={completedAction.title}
        />
      </main>
    );
  }

  return (
    <main className="app-shell intake-shell">
      {view === "menu" ? (
        <>
          <header className="app-header">
            <div className="header-copy"><p className="eyebrow">Planifica a tu manera</p><h1>¿Qué quieres hacer?</h1><p className="meta">Organiza viajes reales con contexto local, rutas y reservas.</p></div>
          </header>
          <nav aria-label="Acciones de Sendero" className="launcher-grid">
            {launcherActions.map((action) => (
              <button className="launcher-card" key={action.id} onClick={() => sendAction(action.id)} type="button">
                <strong>{action.title}</strong><span>{action.description}</span>
              </button>
            ))}
          </nav>
        </>
      ) : (
        <form className="form-card" onSubmit={submit}>
          <div className="form-heading"><div><p className="eyebrow">Nuevo viaje</p><h1>Cuéntanos lo esencial</h1><p>Puedes completar el resto conversando después.</p></div></div>
          <div className="form-grid">
            <Field label="Destino"><input onChange={(event) => update("destination", event.target.value)} placeholder="Sevilla, España" required value={draft.destination} /></Field>
            <div className="number-row">
              <Field label="Adultos"><input min="1" onChange={(event) => update("adults", event.target.value)} type="number" value={draft.adults} /></Field>
              <Field label="Niños"><input min="0" onChange={(event) => update("children", event.target.value)} type="number" value={draft.children} /></Field>
            </div>
            <DateRangePicker endDate={draft.endDate} onChange={updateDates} startDate={draft.startDate} />

            <div className="lodging-fields">
              <SegmentedControl label="Alojamiento" onChange={(value) => update("lodgingStatus", value)} options={[{ value: "confirmed", label: "Tengo dirección" }, { value: "area_only", label: "Solo sé la zona" }, { value: "undecided", label: "Todavía no lo elegí" }]} value={draft.lodgingStatus} />
              {draft.lodgingStatus !== "undecided" ? <Field label={draft.lodgingStatus === "confirmed" ? "Dirección o nombre" : "Barrio o zona"}><input onChange={(event) => update("lodgingValue", event.target.value)} placeholder={draft.lodgingStatus === "confirmed" ? "Hotel, calle y número" : "Prado / San Bernardo"} value={draft.lodgingValue} /></Field> : <InlineNotice>Usaremos una base provisional y la ajustaremos cuando elijas dónde quedarte.</InlineNotice>}
            </div>

            <div className="field-wide"><ChoiceChips label="Cómo quieren moverse" onChange={(value) => update("transportModes", value)} options={[{ value: "walk", label: "A pie" }, { value: "public_transit", label: "Transporte público" }, { value: "taxi", label: "Taxi / app" }, { value: "bike", label: "Bicicleta" }, { value: "car", label: "Auto" }]} values={draft.transportModes} /></div>
            {draft.transportModes.includes("car") ? <label className="check-row field-wide"><input checked={draft.hasLicense} onChange={(event) => update("hasLicense", event.target.checked)} type="checkbox" />Al menos una persona tiene licencia válida y quiere conducir</label> : null}
            <div className="field-wide"><SegmentedControl label="Ritmo del viaje" onChange={(value) => update("pace", value)} options={[{ value: "relaxed", label: "Tranquilo" }, { value: "balanced", label: "Equilibrado" }, { value: "intense", label: "Intenso" }]} value={draft.pace} /></div>
            <Field className="field-wide" hint="Separados por comas" label="Intereses"><textarea onChange={(event) => update("interests", event.target.value)} placeholder="Arquitectura, comida local, música en vivo…" value={draft.interests} /></Field>
          </div>
          {status.message ? <InlineNotice tone={status.state === "error" ? "error" : "neutral"}>{status.message}</InlineNotice> : null}
          <footer className="form-footer"><p>Ninguna reserva se realizará sin tu confirmación.</p><Button disabled={status.state === "sending"} variant="primary" type="submit">{status.state === "sending" ? "Preparando…" : "Crear itinerario"}</Button></footer>
        </form>
      )}
    </main>
  );
}
