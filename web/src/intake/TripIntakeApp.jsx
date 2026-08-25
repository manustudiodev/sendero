import { useEffect, useRef, useState } from "react";
import { BrandMark, Button, ChoiceChips, Field, InlineNotice, SegmentedControl, SelectionReceipt } from "../components.jsx";
import { sendFollowUpMessage, setWidgetState, updateModelContext, useToolOutput, widgetState } from "../bridge.js";
import { tripIntakeContinuation } from "../conversation.js";

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

function toBrief(draft) {
  const lodging = draft.lodgingStatus === "confirmed"
    ? { status: "confirmed", name: "Alojamiento", address: draft.lodgingValue.trim() }
    : draft.lodgingStatus === "area_only"
      ? { status: "area_only", name: "Zona provisional", area: draft.lodgingValue.trim() }
      : { status: "undecided", name: "Alojamiento por definir" };
  return {
    destination: draft.destination.trim(),
    startDate: draft.startDate,
    endDate: draft.endDate,
    lodging,
    travellers: { adults: Number(draft.adults), children: Number(draft.children) },
    pace: draft.pace,
    interests: draft.interests.split(",").map((value) => value.trim()).filter(Boolean),
    transport: {
      modes: draft.transportModes,
      hasLicense: Boolean(draft.hasLicense),
      wantsCar: draft.transportModes.includes("car"),
    },
  };
}

export function TripIntakeApp() {
  const { output } = useToolOutput();
  const saved = widgetState();
  const pendingRef = useRef(false);
  const [view, setView] = useState(saved.view || output?.mode || "new");
  const [completedAction, setCompletedAction] = useState(saved.completedAction || null);
  const [draft, setDraft] = useState(() => saved.draft || draftFromBrief(output?.brief));
  const [status, setStatus] = useState(saved.status || { state: "idle", message: "" });

  useEffect(() => {
    if (output?.brief && !saved.draft) setDraft(draftFromBrief(output.brief));
  }, [output]);

  useEffect(() => {
    if (output?.mode && !saved.view) setView(output.mode);
  }, [output?.mode]);

  useEffect(() => {
    setWidgetState({ view, draft, completedAction, status });
  }, [view, draft, completedAction, status]);

  function update(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
    setStatus({ state: "idle", message: "" });
  }

  async function sendAction(action) {
    if (pendingRef.current) return;
    if (action === "new") {
      setView("new");
      setWidgetState({ view: "new", draft, completedAction: null });
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
    setWidgetState({ view: "complete", draft, completedAction: receipt });
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

  async function submit(event) {
    event.preventDefault();
    if (pendingRef.current) return;
    if (!draft.destination || !draft.startDate || !draft.endDate || !draft.transportModes.length) {
      setStatus({ state: "error", message: "Completa destino, fechas y al menos un medio de transporte." });
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

    const brief = toBrief(draft);
    const receipt = {
      id: "new",
      title: draft.destination.trim(),
      description: `${draft.startDate} — ${draft.endDate} · ${Number(draft.adults) + Number(draft.children)} viajero${Number(draft.adults) + Number(draft.children) === 1 ? "" : "s"}`,
    };
    setCompletedAction(receipt);
    setView("complete");
    setWidgetState({ view: "complete", draft, completedAction: receipt });
    pendingRef.current = true;
    setStatus({ state: "sending", message: "Preparando el itinerario…" });
    const continuation = tripIntakeContinuation(brief);
    try {
      let contextUpdated = false;
      try {
        await updateModelContext(continuation.context);
        contextUpdated = true;
      } catch {
        // Fall back to a readable message when the host cannot update model context.
      }
      await sendFollowUpMessage(contextUpdated
        ? continuation.visibleMessage
        : continuation.fallbackMessage);
      setStatus({ state: "sent", message: "Datos enviados. Sendero continúa en la conversación." });
    } catch {
      setStatus({ state: "error", message: "No pudimos iniciar el viaje todavía. Inténtalo de nuevo." });
    } finally {
      pendingRef.current = false;
    }
  }

  if (view === "complete" && completedAction) {
    return (
      <main className="app-shell intake-shell compact-shell">
        <div className="brand-line"><BrandMark /><span>Sendero</span></div>
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
      <div className="brand-line"><BrandMark /><span>Sendero</span></div>
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
            <Field label="Llegada"><input onChange={(event) => update("startDate", event.target.value)} required type="date" value={draft.startDate} /></Field>
            <Field label="Regreso"><input onChange={(event) => update("endDate", event.target.value)} required type="date" value={draft.endDate} /></Field>

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
