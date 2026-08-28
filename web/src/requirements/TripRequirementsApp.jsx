import { useEffect, useRef, useState } from "react";
import { Button, ChoiceChips, Field, InlineNotice, SelectionReceipt } from "../components.jsx";
import { DateRangePicker } from "../DateRangePicker.jsx";
import { callTool, sendFollowUpMessage, setWidgetState, updateModelContext, useComponentLocale, useToolOutput, widgetState } from "../bridge.js";
import { briefReceiptSummary, tripRequirementsContinuation } from "../conversation.js";
import { resolveContentLocale, t } from "../i18n/index.js";
import { normalizeToolOutput } from "../tool-output.js";
import { draftFromBrief, initialRequirementsStatus, mergeBrief, requestedFields } from "./state.js";

const transportValues = ["walk", "public_transit", "taxi", "bike", "car"];

export function TripRequirementsApp() {
  const { output } = useToolOutput();
  const saved = useRef(widgetState()).current;
  const pendingRef = useRef(false);
  const interactionIdRef = useRef(saved.interactionId || output?.interactionId);
  const outputHydratedRef = useRef(Boolean(output?.brief));
  const draftTouchedRef = useRef(false);
  const [fields, setFields] = useState(() => saved.fields || requestedFields(output));
  const [baseBrief, setBaseBrief] = useState(() => saved.baseBrief || output?.brief || null);
  const localeBrief = baseBrief || output?.brief;
  const locale = useComponentLocale(localeBrief ? resolveContentLocale(localeBrief.locale) : undefined);
  const [draft, setDraft] = useState(() => saved.draft || draftFromBrief(output?.brief));
  const [completed, setCompleted] = useState(saved.completed || null);
  const [continuation, setContinuation] = useState(saved.continuation || null);
  const [status, setStatus] = useState(() => initialRequirementsStatus(saved, saved.baseBrief?.locale || output?.brief?.locale));
  const transportOptions = transportValues.map((value) => ({ value, label: t(locale, `transport.${value}`) }));

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
    if (fields.includes("destination") && !draft.destination.trim()) return t(locale, "requirements.validation.destination");
    if (fields.includes("startDate") && !draft.startDate) return t(locale, "requirements.validation.startDate");
    if (fields.includes("endDate") && !draft.endDate) return t(locale, "requirements.validation.endDate");
    if (draft.startDate && draft.endDate && draft.startDate > draft.endDate) return t(locale, "requirements.validation.dateOrder");
    if (fields.includes("travellers.adults") && (!Number.isInteger(Number(draft.adults)) || Number(draft.adults) < 1)) return t(locale, "requirements.validation.adults");
    if (fields.includes("transport.modes") && !draft.transportModes.length) return t(locale, "requirements.validation.transport");
    if (draft.transportModes.includes("car") && !draft.hasLicense) return t(locale, "requirements.validation.license");
    return "";
  }

  async function deliverContinuation(nextContinuation, receipt) {
    const dispatching = { ...nextContinuation, phase: "dispatching" };
    const sending = { state: "loading", message: t(locale, "status.continuing") };
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
      const success = { state: "success", message: t(locale, "status.success") };
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
        message: t(locale, "status.deliveryUncertain"),
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
    const validating = { state: "loading", message: t(locale, "status.validating") };
    setStatus(validating);
    try {
      const prepared = normalizeToolOutput(await callTool("prepare_trip_brief", { brief: candidateBrief }));
      if (!prepared?.brief || prepared.ready !== true || prepared.criticalFields?.length) {
        const nextFields = requestedFields({ fields: prepared?.criticalFields || [] });
        const normalizedBrief = prepared?.brief || candidateBrief;
        const nextDraft = draftFromBrief(normalizedBrief);
        const failure = {
          state: "error",
          message: t(locale, "status.essentialCorrection"),
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
        message: t(locale, "status.validationFailed"),
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
      setStatus({ state: "error", message: t(locale, "status.contextLoading") });
      return;
    }
    await continueConversation(mergeBrief(baseBrief, draft));
  }

  if (completed) {
    return (
      <main className="app-shell requirements-shell compact-shell">
        <SelectionReceipt
          description={completed.description}
          eyebrow={t(locale, "requirements.receipt.eyebrow")}
          status={status.message}
          title={t(locale, "requirements.receipt.title")}
        />
      </main>
    );
  }

  if (!fields.length) {
    return (
      <main className="app-shell requirements-shell compact-shell">
        <InlineNotice tone="warning">{t(locale, "requirements.empty")}</InlineNotice>
      </main>
    );
  }

  return (
    <main className="app-shell requirements-shell">
      <form className="requirements-card" onSubmit={submit}>
        <header className="requirements-heading">
          <p className="eyebrow">{t(locale, fields.length === 1 ? "requirements.eyebrow.one" : "requirements.eyebrow.many")}</p>
          <h1>{t(locale, fields.length === 1 ? "requirements.title.one" : "requirements.title.many")}</h1>
          <p>{t(locale, "requirements.description")}</p>
        </header>
        <div className="requirements-grid">
          {fields.includes("destination") ? <Field className="field-wide" label={t(locale, "requirements.destinationLabel")}><input autoComplete="off" autoFocus onChange={(event) => update("destination", event.target.value)} placeholder={t(locale, "requirements.destinationPlaceholder")} required value={draft.destination} /></Field> : null}
          {fields.includes("startDate") || fields.includes("endDate") ? <DateRangePicker endDate={draft.endDate} locale={locale} onChange={updateDates} startDate={draft.startDate} /> : null}
          {fields.includes("travellers.adults") ? <Field className={fields.length === 1 ? "field-wide" : ""} label={t(locale, "requirements.adultsLabel")}><input inputMode="numeric" min="1" onChange={(event) => update("adults", event.target.value)} required type="number" value={draft.adults} /></Field> : null}
          {fields.includes("transport.modes") ? <div className="field-wide"><ChoiceChips label={t(locale, "requirements.transportLabel")} onChange={(value) => update("transportModes", value)} options={transportOptions} values={draft.transportModes} /></div> : null}
          {draft.transportModes.includes("car") ? <label className="check-row field-wide"><input checked={draft.hasLicense} onChange={(event) => update("hasLicense", event.target.checked)} type="checkbox" />{t(locale, "requirements.licenseLabel")}</label> : null}
        </div>
        {status.message ? <InlineNotice tone={status.state === "error" ? "error" : "neutral"}>{status.message}</InlineNotice> : null}
        <footer className="form-footer"><p>{t(locale, "requirements.footer")}</p><Button disabled={status.state === "loading"} variant="primary" type="submit">{t(locale, status.state === "loading" ? "requirements.continuing" : "requirements.continue")}</Button></footer>
      </form>
    </main>
  );
}
