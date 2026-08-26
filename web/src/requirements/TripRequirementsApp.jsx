import { useEffect, useRef, useState } from "react";
import { Button, ChoiceChips, Field, InlineNotice, SelectionReceipt } from "../components.jsx";
import { DateRangePicker } from "../DateRangePicker.jsx";
import { callTool, sendFollowUpMessage, setWidgetState, updateModelContext, useToolOutput, widgetState } from "../bridge.js";
import { briefReceiptSummary, tripRequirementsContinuation } from "../conversation.js";
import { normalizeToolOutput } from "../tool-output.js";
import { draftFromBrief, initialRequirementsStatus, mergeBrief, requestedFields } from "./state.js";

const transportOptions = [
  { value: "walk", label: "A pie" },
  { value: "public_transit", label: "Transporte público" },
  { value: "taxi", label: "Taxi / app" },
  { value: "bike", label: "Bicicleta" },
  { value: "car", label: "Auto" },
];

export function TripRequirementsApp() {
  const { output } = useToolOutput();
  const saved = useRef(widgetState()).current;
  const pendingRef = useRef(false);
  const interactionIdRef = useRef(saved.interactionId || output?.interactionId);
  const outputHydratedRef = useRef(Boolean(output?.brief));
  const draftTouchedRef = useRef(false);
  const [fields, setFields] = useState(() => saved.fields || requestedFields(output));
  const [baseBrief, setBaseBrief] = useState(() => saved.baseBrief || output?.brief || null);
  const [draft, setDraft] = useState(() => saved.draft || draftFromBrief(output?.brief));
  const [completed, setCompleted] = useState(saved.completed || null);
  const [continuation, setContinuation] = useState(saved.continuation || null);
  const [status, setStatus] = useState(() => initialRequirementsStatus(saved));

  useEffect(() => {
    if (!output?.brief || outputHydratedRef.current) return;
    outputHydratedRef.current = true;
    if (!interactionIdRef.current && output.interactionId) interactionIdRef.current = output.interactionId;
    if (!saved.fields?.length) setFields(requestedFields(output));
    if (!saved.baseBrief && output.brief) setBaseBrief(output.brief);
    if (!saved.draft && !draftTouchedRef.current) setDraft(draftFromBrief(output.brief));
  }, [output, saved.baseBrief, saved.draft, saved.fields]);

  useEffect(() => {
    setWidgetState({
      interactionId: interactionIdRef.current,
      fields,
      baseBrief,
      draft,
      completed,
      continuation,
      status,
    });
  }, [baseBrief, completed, continuation, draft, fields, status]);

  function update(field, value) {
    draftTouchedRef.current = true;
    setDraft((current) => ({ ...current, [field]: value }));
    setStatus({ state: "idle", message: "" });
  }

  function updateDates(nextDates) {
    draftTouchedRef.current = true;
    setDraft((current) => ({ ...current, ...nextDates }));
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

  async function deliverContinuation(nextContinuation, receipt) {
    const dispatching = { ...nextContinuation, phase: "dispatching" };
    const sending = { state: "loading", message: "Continuando con tu viaje…" };
    setContinuation(dispatching);
    setStatus(sending);
    await Promise.resolve(setWidgetState({
      interactionId: interactionIdRef.current,
      fields,
      baseBrief: nextContinuation.brief,
      draft,
      completed: receipt,
      continuation: dispatching,
      status: sending,
    }));

    const next = tripRequirementsContinuation({
      brief: nextContinuation.brief,
      fields: nextContinuation.fields,
      interactionId: interactionIdRef.current,
    });
    try {
      try {
        await updateModelContext(next.context);
      } catch {
        // The self-contained follow-up below carries the same critical details.
      }
      await sendFollowUpMessage(next.visibleMessage);
      const success = { state: "success", message: "Listo. Sendero continúa en la conversación." };
      const sent = { ...dispatching, phase: "sent" };
      setContinuation(sent);
      setStatus(success);
      try {
        await Promise.resolve(setWidgetState({
          interactionId: interactionIdRef.current,
          fields,
          baseBrief: nextContinuation.brief,
          draft,
          completed: receipt,
          continuation: sent,
          status: success,
        }));
      } catch {
        // The message was already acknowledged; never downgrade to a retryable state.
      }
    } catch {
      const uncertainStatus = {
        state: "error",
        message: "No pudimos confirmar la entrega. Si el chat no continúa, dímelo con tus palabras.",
      };
      const uncertain = { ...dispatching, phase: "uncertain" };
      setContinuation(uncertain);
      setStatus(uncertainStatus);
      try {
        await Promise.resolve(setWidgetState({
          interactionId: interactionIdRef.current,
          fields,
          baseBrief: nextContinuation.brief,
          draft,
          completed: receipt,
          continuation: uncertain,
          status: uncertainStatus,
        }));
      } catch {
        // Keep the local receipt uncertain; the persisted dispatching phase is also non-retryable.
      }
    }
  }

  async function continueConversation(candidateBrief) {
    if (pendingRef.current) return;
    pendingRef.current = true;
    const validating = { state: "loading", message: "Validando tus datos…" };
    setStatus(validating);
    try {
      const prepared = normalizeToolOutput(await callTool("prepare_trip_brief", { brief: candidateBrief }));
      if (!prepared?.brief || prepared.ready !== true || prepared.criticalFields?.length) {
        const nextFields = requestedFields({ fields: prepared?.criticalFields || [] });
        const normalizedBrief = prepared?.brief || candidateBrief;
        const nextDraft = draftFromBrief(normalizedBrief);
        const failure = {
          state: "error",
          message: "Todavía falta corregir algún dato esencial. Revísalo y vuelve a continuar.",
        };
        setFields(nextFields);
        setBaseBrief(normalizedBrief);
        setDraft(nextDraft);
        setCompleted(null);
        setContinuation(null);
        setStatus(failure);
        await Promise.resolve(setWidgetState({
          interactionId: interactionIdRef.current,
          fields: nextFields,
          baseBrief: normalizedBrief,
          draft: nextDraft,
          completed: null,
          continuation: null,
          status: failure,
        }));
        return;
      }

      const brief = prepared.brief;
      const receipt = { brief, description: briefReceiptSummary(brief) };
      const nextContinuation = { brief, fields, phase: "validated" };
      setBaseBrief(brief);
      setCompleted(receipt);
      setContinuation(nextContinuation);
      await deliverContinuation(nextContinuation, receipt);
    } catch {
      const failure = {
        state: "error",
        message: "No pudimos validar tus datos todavía. Tus respuestas siguen aquí; inténtalo de nuevo.",
      };
      setCompleted(null);
      setContinuation(null);
      setStatus(failure);
      await Promise.resolve(setWidgetState({
        interactionId: interactionIdRef.current,
        fields,
        baseBrief,
        draft,
        completed: null,
        continuation: null,
        status: failure,
      }));
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
    if (!baseBrief) {
      setStatus({ state: "error", message: "Estamos recuperando el contexto del viaje. Inténtalo de nuevo en un momento." });
      return;
    }
    await continueConversation(mergeBrief(baseBrief, draft));
  }

  if (completed) {
    return (
      <main className="app-shell requirements-shell compact-shell">
        <SelectionReceipt
          description={completed.description}
          eyebrow="Datos del viaje completados"
          status={status.message}
          title="Ya tenemos lo esencial"
        />
      </main>
    );
  }

  if (!fields.length) {
    return (
      <main className="app-shell requirements-shell compact-shell">
        <InlineNotice tone="warning">No recibimos los datos que faltan. Puedes continuar describiendo el viaje en el chat.</InlineNotice>
      </main>
    );
  }

  return (
    <main className="app-shell requirements-shell">
      <form className="requirements-card" onSubmit={submit}>
        <header className="requirements-heading">
          <p className="eyebrow">{fields.length === 1 ? "Un dato más" : "Completemos lo esencial"}</p>
          <h1>{fields.length === 1 ? "Solo falta esto" : "Faltan estos datos"}</h1>
          <p>Respóndelos juntos y seguimos con el itinerario.</p>
        </header>
        <div className="requirements-grid">
          {fields.includes("destination") ? <Field className="field-wide" label="¿A dónde quieren viajar?"><input autoComplete="off" autoFocus onChange={(event) => update("destination", event.target.value)} placeholder="Sevilla, España" required value={draft.destination} /></Field> : null}
          {fields.includes("startDate") || fields.includes("endDate") ? <DateRangePicker endDate={draft.endDate} onChange={updateDates} startDate={draft.startDate} /> : null}
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
