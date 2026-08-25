import { useEffect, useMemo, useRef, useState } from "react";
import { BrandMark, Button, ChoiceChips, Field, InlineNotice, SelectionReceipt } from "../components.jsx";
import { sendFollowUpMessage, setWidgetState, updateModelContext, useToolOutput, widgetState } from "../bridge.js";
import { briefReceiptSummary, tripRequirementsContinuation } from "../conversation.js";

const criticalFields = ["destination", "startDate", "endDate", "travellers.adults", "transport.modes"];

const transportOptions = [
  { value: "walk", label: "A pie" },
  { value: "public_transit", label: "Transporte público" },
  { value: "taxi", label: "Taxi / app" },
  { value: "bike", label: "Bicicleta" },
  { value: "car", label: "Auto" },
];

function requestedFields(output) {
  const values = output?.fields || output?.criticalMissing || output?.missing || [];
  const requested = new Set(Array.isArray(values) ? values : []);
  return criticalFields.filter((field) => requested.has(field));
}

function draftFromBrief(brief = {}) {
  return {
    destination: brief.destination || "",
    startDate: brief.startDate || "",
    endDate: brief.endDate || "",
    adults: brief.travellers?.adults ?? "",
    transportModes: Array.isArray(brief.transport?.modes) ? brief.transport.modes : [],
    hasLicense: Boolean(brief.transport?.hasLicense),
  };
}

function mergeBrief(brief = {}, draft) {
  return {
    ...brief,
    destination: draft.destination.trim(),
    startDate: draft.startDate,
    endDate: draft.endDate,
    travellers: {
      ...(brief.travellers || {}),
      adults: Number(draft.adults),
    },
    transport: {
      ...(brief.transport || {}),
      modes: draft.transportModes,
      wantsCar: draft.transportModes.includes("car"),
      hasLicense: draft.transportModes.includes("car") ? Boolean(draft.hasLicense) : false,
    },
  };
}

function initialStatus(saved) {
  if (saved.status?.state === "loading") {
    return { state: "error", message: "La continuación quedó pendiente. Puedes intentarlo otra vez." };
  }
  return saved.status || { state: "idle", message: "" };
}

export function TripRequirementsApp() {
  const { output } = useToolOutput();
  const saved = useMemo(() => widgetState(), []);
  const pendingRef = useRef(false);
  const [fields, setFields] = useState(() => saved.fields || requestedFields(output));
  const [draft, setDraft] = useState(() => saved.draft || draftFromBrief(output?.brief));
  const [completed, setCompleted] = useState(saved.completed || null);
  const [status, setStatus] = useState(() => initialStatus(saved));

  useEffect(() => {
    if (!output) return;
    if (!saved.fields?.length) setFields(requestedFields(output));
    if (!saved.draft) setDraft(draftFromBrief(output.brief));
  }, [output, saved.draft, saved.fields]);

  useEffect(() => {
    setWidgetState({
      interactionId: output?.interactionId || saved.interactionId,
      fields,
      draft,
      completed,
      status,
    });
  }, [completed, draft, fields, output?.interactionId, saved.interactionId, status]);

  function update(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
    setStatus({ state: "idle", message: "" });
  }

  function validate() {
    if (fields.includes("destination") && !draft.destination.trim()) return "Indica el destino del viaje.";
    if (fields.includes("startDate") && !draft.startDate) return "Indica la fecha de llegada.";
    if (fields.includes("endDate") && !draft.endDate) return "Indica la fecha de regreso.";
    if (draft.startDate && draft.endDate && draft.startDate > draft.endDate) return "La fecha de regreso debe ser posterior a la de llegada.";
    if (fields.includes("travellers.adults") && (!Number.isInteger(Number(draft.adults)) || Number(draft.adults) < 1)) return "Indica cuántos adultos viajan.";
    if (fields.includes("transport.modes") && !draft.transportModes.length) return "Elige al menos una forma de moverse.";
    if (draft.transportModes.includes("car") && !draft.hasLicense) return "Para planificar con auto, confirma que alguien tenga una licencia válida.";
    return "";
  }

  async function continueConversation(brief) {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setStatus({ state: "loading", message: "Continuando con tu viaje…" });
    const continuation = tripRequirementsContinuation({ brief, fields, interactionId: output?.interactionId });
    try {
      let contextUpdated = false;
      try {
        await updateModelContext(continuation.context);
        contextUpdated = true;
      } catch {
        // The natural-language message below carries the same context on hosts
        // that do not yet implement ui/update-model-context.
      }
      await sendFollowUpMessage(contextUpdated
        ? continuation.visibleMessage
        : continuation.fallbackMessage);
      setStatus({ state: "success", message: "Listo. Sendero continúa en la conversación." });
    } catch {
      setStatus({
        state: "error",
        message: "No pudimos continuar todavía. Tus respuestas siguen aquí; inténtalo de nuevo.",
      });
    } finally {
      pendingRef.current = false;
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (pendingRef.current) return;
    const error = validate();
    if (error) {
      setStatus({ state: "error", message: error });
      return;
    }
    const brief = mergeBrief(output?.brief, draft);
    const receipt = { brief, description: briefReceiptSummary(brief) };
    setCompleted(receipt);
    setWidgetState({ interactionId: output?.interactionId, fields, draft, completed: receipt, status: { state: "loading", message: "Continuando con tu viaje…" } });
    await continueConversation(brief);
  }

  if (completed) {
    return (
      <main className="app-shell requirements-shell compact-shell">
        <div className="brand-line"><BrandMark /><span>Sendero</span></div>
        <SelectionReceipt
          description={completed.description}
          eyebrow="Datos del viaje completados"
          status={status.message}
          title="Ya tenemos lo esencial"
        >
          {status.state === "error" ? <Button disabled={pendingRef.current} onClick={() => continueConversation(completed.brief)} variant="secondary">Reintentar</Button> : null}
        </SelectionReceipt>
      </main>
    );
  }

  if (!fields.length) {
    return (
      <main className="app-shell requirements-shell compact-shell">
        <div className="brand-line"><BrandMark /><span>Sendero</span></div>
        <InlineNotice tone="warning">No recibimos los datos que faltan. Puedes continuar describiendo el viaje en el chat.</InlineNotice>
      </main>
    );
  }

  return (
    <main className="app-shell requirements-shell">
      <div className="brand-line"><BrandMark /><span>Sendero</span></div>
      <form className="requirements-card" onSubmit={submit}>
        <header className="requirements-heading">
          <p className="eyebrow">{fields.length === 1 ? "Un dato más" : "Completemos lo esencial"}</p>
          <h1>{fields.length === 1 ? "Solo falta esto" : "Faltan estos datos"}</h1>
          <p>Respóndelos juntos y seguimos con el itinerario.</p>
        </header>
        <div className="requirements-grid">
          {fields.includes("destination") ? <Field className="field-wide" label="¿A dónde quieren viajar?"><input autoComplete="off" autoFocus onChange={(event) => update("destination", event.target.value)} placeholder="Sevilla, España" required value={draft.destination} /></Field> : null}
          {fields.includes("startDate") ? <Field label="Llegada"><input onChange={(event) => update("startDate", event.target.value)} required type="date" value={draft.startDate} /></Field> : null}
          {fields.includes("endDate") ? <Field label="Regreso"><input onChange={(event) => update("endDate", event.target.value)} required type="date" value={draft.endDate} /></Field> : null}
          {fields.includes("travellers.adults") ? <Field className={fields.length === 1 ? "field-wide" : ""} label="Adultos"><input inputMode="numeric" min="1" onChange={(event) => update("adults", event.target.value)} required type="number" value={draft.adults} /></Field> : null}
          {fields.includes("transport.modes") ? <div className="field-wide"><ChoiceChips label="¿Cómo quieren moverse?" onChange={(value) => update("transportModes", value)} options={transportOptions} values={draft.transportModes} /></div> : null}
          {draft.transportModes.includes("car") ? <label className="check-row field-wide"><input checked={draft.hasLicense} onChange={(event) => update("hasLicense", event.target.checked)} type="checkbox" />Al menos una persona tiene licencia válida y quiere conducir</label> : null}
        </div>
        {status.message ? <InlineNotice tone={status.state === "error" ? "error" : "neutral"}>{status.message}</InlineNotice> : null}
        <footer className="form-footer"><p>Esto completa el contexto; todavía no guarda ni reserva nada.</p><Button disabled={status.state === "loading"} variant="primary" type="submit">{status.state === "loading" ? "Continuando…" : "Continuar"}</Button></footer>
      </form>
    </main>
  );
}
