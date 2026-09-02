import { useEffect, useRef, useState } from "react";
import { Button, ChoiceChips, Field, InlineNotice, SegmentedControl, SelectionReceipt } from "../components.jsx";
import { DateRangePicker } from "../DateRangePicker.jsx";
import { callTool, sendFollowUpMessage, setWidgetState, updateModelContext, useComponentLocale, useToolOutput, widgetState } from "../bridge.js";
import { tripIntakeContinuation } from "../conversation.js";
import { resolveContentLocale, t } from "../i18n/index.js";
import { normalizeToolOutput } from "../tool-output.js";
import {
  BudgetFields,
  budgetDraftFromValue,
  budgetValueFromDraft,
} from "../budget/BudgetFields.jsx";
import {
  TripProfileFields,
  tripProfileDraftFromBrief,
  tripProfileValueFromDraft,
} from "../profile/TripProfileFields.jsx";

const launcherActionIds = ["new", "open", "adjust", "refresh"];
const transportValues = ["walk", "public_transit", "taxi", "bike", "car"];

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
  budget: budgetDraftFromValue(),
  profile: tripProfileDraftFromBrief(),
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
    budget: budgetDraftFromValue(brief.budget),
    profile: tripProfileDraftFromBrief(brief),
  };
}

function toBrief(draft, baseBrief = {}, localeValue) {
  const locale = resolveContentLocale(baseBrief.locale || localeValue);
  const {
    accessibilityNeeds: _accessibilityNeeds,
    arrivalTime: _arrivalTime,
    dailySchedule: _dailySchedule,
    departureTime: _departureTime,
    mobility: _mobility,
    travellers: _travellers,
    ...briefBase
  } = baseBrief;
  const profile = tripProfileValueFromDraft(draft.profile);
  const lodging = draft.lodgingStatus === "confirmed"
    ? { status: "confirmed", name: t(locale, "intake.lodgingName"), address: draft.lodgingValue.trim() }
    : draft.lodgingStatus === "area_only"
      ? { status: "area_only", name: t(locale, "intake.lodgingAreaName"), area: draft.lodgingValue.trim() }
      : { status: "undecided", name: t(locale, "intake.lodgingUndecidedName") };
  return {
    ...briefBase,
    ...profile,
    locale,
    destination: draft.destination.trim(),
    startDate: draft.startDate,
    endDate: draft.endDate,
    lodging,
    travellers: {
      adults: Number(draft.adults),
      children: Number(draft.children),
      ...profile.travellers,
    },
    pace: draft.pace,
    budget: budgetValueFromDraft(draft.budget),
    interests: draft.interests.split(",").map((value) => value.trim()).filter(Boolean),
    transport: {
      ...(baseBrief.transport || {}),
      modes: draft.transportModes,
      hasLicense: Boolean(draft.hasLicense),
      wantsCar: draft.transportModes.includes("car"),
    },
  };
}

function initialStatus(saved, locale) {
  if (saved.continuation?.phase === "sent") {
    return { state: "sent", message: t(locale, "intake.actionSent") };
  }
  if (["dispatching", "uncertain", "delivery_failed"].includes(saved.continuation?.phase)) {
    return {
      state: "error",
      message: t(locale, "status.deliveryUncertain"),
    };
  }
  if (saved.status?.state === "sending") {
    return { state: "error", message: t(locale, "status.validationPending") };
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
  const localeBrief = baseBrief || output?.brief;
  const locale = useComponentLocale(localeBrief ? resolveContentLocale(localeBrief.locale) : undefined);
  const [draft, setDraft] = useState(() => {
    const initialDraft = saved.draft || draftFromBrief(output?.brief);
    return {
      ...defaultDraft,
      ...initialDraft,
      budget: initialDraft.budget || budgetDraftFromValue(),
      profile: initialDraft.profile || tripProfileDraftFromBrief(saved.baseBrief || output?.brief),
    };
  });
  const [continuation, setContinuation] = useState(saved.continuation || null);
  const [status, setStatus] = useState(() => initialStatus(saved, locale));
  const launcherActions = launcherActionIds.map((id) => ({
    id,
    title: t(locale, `intake.launcher.${id}.title`),
    description: t(locale, `intake.launcher.${id}.description`),
  }));
  const transportOptions = transportValues.map((value) => ({ value, label: t(locale, `transport.${value}`) }));
  const budgetCopy = {
    title: t(locale, "budget.title"),
    description: t(locale, "budget.description"),
    comfort: t(locale, "budget.comfort"),
    comforts: Object.fromEntries(["flexible", "low", "medium", "high"].map((value) => [value, t(locale, `budget.comfort.${value}`)])),
    amount: t(locale, "budget.amount"),
    amountExample: t(locale, "budget.amountExample"),
    optional: t(locale, "budget.optional"),
    currency: t(locale, "budget.currency"),
    currencyPlaceholder: t(locale, "budget.currencyPlaceholder"),
    scope: t(locale, "budget.scope"),
    scopes: Object.fromEntries(["total", "per_person", "per_day"].map((value) => [value, t(locale, `budget.scope.${value}`)])),
    flexibility: t(locale, "budget.flexibility"),
    flexibilities: Object.fromEntries(["strict", "target", "flexible"].map((value) => [value, t(locale, `budget.flexibility.${value}`)])),
    includes: t(locale, "budget.includes"),
    categories: Object.fromEntries(["activities", "food", "local_transport", "lodging", "long_distance_transport"].map((value) => [value, t(locale, `budget.category.${value}`)])),
    note: t(locale, "budget.note"),
  };
  const profileCopy = {
    title: t(locale, "profile.title"), optional: t(locale, "profile.optional"), description: t(locale, "profile.description"),
    tripTimes: t(locale, "profile.tripTimes"), arrivalTime: t(locale, "profile.arrivalTime"), departureTime: t(locale, "profile.departureTime"),
    party: t(locale, "profile.party"), childAges: t(locale, "profile.childAges"), seniors: t(locale, "profile.seniors"), seniorAges: t(locale, "profile.seniorAges"), agesPlaceholder: t(locale, "profile.agesPlaceholder"), seniorAgesPlaceholder: t(locale, "profile.seniorAgesPlaceholder"), seniorsHint: t(locale, "profile.seniorsHint"),
    dailySchedule: t(locale, "profile.dailySchedule"), earliestStart: t(locale, "profile.earliestStart"), latestEnd: t(locale, "profile.latestEnd"), breakfast: t(locale, "profile.breakfast"), lunch: t(locale, "profile.lunch"), dinner: t(locale, "profile.dinner"),
    mobility: t(locale, "profile.mobility"), walkingTolerance: t(locale, "profile.walkingTolerance"),
    walkingOptions: Object.fromEntries(["none", "low", "moderate", "high"].map((value) => [value, t(locale, `profile.walking.${value}`)])),
    maxWalkingMinutes: t(locale, "profile.maxWalkingMinutes"), minutesPlaceholder: t(locale, "profile.minutesPlaceholder"), restFrequency: t(locale, "profile.restFrequency"),
    restOptions: Object.fromEntries(["none", "frequent", "regular", "minimal"].map((value) => [value, t(locale, `profile.rest.${value}`)])),
    avoidStairs: t(locale, "profile.avoidStairs"), wheelchairAccess: t(locale, "profile.wheelchairAccess"), accessibilityNeeds: t(locale, "profile.accessibilityNeeds"), accessibilityPlaceholder: t(locale, "profile.accessibilityPlaceholder"), note: t(locale, "profile.note"),
  };

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
      open: t(locale, "intake.actionOpen"),
      adjust: t(locale, "intake.actionAdjust"),
      refresh: t(locale, "intake.actionRefresh"),
    };
    pendingRef.current = true;
    setStatus({ state: "sending", message: t(locale, "status.continuing") });
    try {
      await sendFollowUpMessage(prompts[action]);
      setStatus({ state: "sent", message: t(locale, "intake.actionSent") });
    } catch {
      setStatus({ state: "error", message: t(locale, "intake.validation.failed") });
    } finally {
      pendingRef.current = false;
    }
  }

  async function deliverContinuation(nextContinuation, receipt) {
    const dispatching = { ...nextContinuation, phase: "dispatching" };
    const sending = { state: "sending", message: t(locale, "intake.status.preparing") };
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
      const success = { state: "sent", message: t(locale, "intake.actionSent") };
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
        message: t(locale, "status.deliveryUncertain"),
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
      setStatus({ state: "error", message: t(locale, "intake.validation.required") });
      return;
    }
    if (!Number.isInteger(Number(draft.adults)) || Number(draft.adults) < 1 || !Number.isInteger(Number(draft.children)) || Number(draft.children) < 0) {
      setStatus({ state: "error", message: t(locale, "intake.validation.travellers") });
      return;
    }
    if (draft.startDate > draft.endDate) {
      setStatus({ state: "error", message: t(locale, "intake.validation.dateOrder") });
      return;
    }
    if (draft.lodgingStatus !== "undecided" && !draft.lodgingValue.trim()) {
      setStatus({ state: "error", message: t(locale, "intake.validation.lodging") });
      return;
    }
    if (draft.transportModes.includes("car") && !draft.hasLicense) {
      setStatus({ state: "error", message: t(locale, "intake.validation.license") });
      return;
    }
    if (draft.budget.amount && !/^[A-Za-z]{3}$/.test(draft.budget.currency.trim())) {
      setStatus({ state: "error", message: t(locale, "intake.validation.budget") });
      return;
    }
    const profile = tripProfileValueFromDraft(draft.profile);
    if (profile.travellers.seniors > Number(draft.adults)) {
      setStatus({ state: "error", message: t(locale, "intake.validation.seniors") });
      return;
    }
    if ((profile.travellers.childAges?.length || 0) > Number(draft.children)) {
      setStatus({ state: "error", message: t(locale, "intake.validation.childAges") });
      return;
    }
    if ((profile.travellers.seniorAges?.length || 0) > profile.travellers.seniors) {
      setStatus({ state: "error", message: t(locale, "intake.validation.seniorAges") });
      return;
    }
    if (
      profile.dailySchedule?.earliestStartTime
      && profile.dailySchedule?.latestEndTime
      && profile.dailySchedule.earliestStartTime >= profile.dailySchedule.latestEndTime
    ) {
      setStatus({ state: "error", message: t(locale, "intake.validation.dailySchedule") });
      return;
    }

    pendingRef.current = true;
    setStatus({ state: "sending", message: t(locale, "status.validating") });
    try {
      const prepared = normalizeToolOutput(await callTool("prepare_trip_brief", {
        brief: toBrief(draft, baseBrief || {}, locale),
      }));
      if (!prepared?.brief || prepared.ready !== true || prepared.criticalFields?.length) {
        const normalizedBrief = prepared?.brief || toBrief(draft, baseBrief || {}, locale);
        const failure = {
          state: "error",
          message: t(locale, "intake.validation.essential"),
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
        description: `${brief.startDate} — ${brief.endDate} · ${t(locale, "intake.receipt.travellers", { count: Number(brief.travellers.adults) + Number(brief.travellers.children || 0) })}`,
      };
      const nextContinuation = { brief, phase: "validated" };
      setBaseBrief(brief);
      setCompletedAction(receipt);
      setView("complete");
      setContinuation(nextContinuation);
      await deliverContinuation(nextContinuation, receipt);
    } catch {
      const failure = { state: "error", message: t(locale, "intake.validation.failed") };
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
          eyebrow={t(locale, completedAction.id === "new" ? "intake.receipt.requested" : "intake.receipt.selected")}
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
            <div className="header-copy"><p className="eyebrow">{t(locale, "intake.menu.eyebrow")}</p><h1>{t(locale, "intake.menu.title")}</h1><p className="meta">{t(locale, "intake.menu.description")}</p></div>
          </header>
          <nav aria-label={t(locale, "intake.menu.aria")} className="launcher-grid">
            {launcherActions.map((action) => (
              <button className="launcher-card" key={action.id} onClick={() => sendAction(action.id)} type="button">
                <strong>{action.title}</strong><span>{action.description}</span>
              </button>
            ))}
          </nav>
        </>
      ) : (
        <form className="form-card" onSubmit={submit}>
          <div className="form-heading"><div><p className="eyebrow">{t(locale, "intake.form.eyebrow")}</p><h1>{t(locale, "intake.form.title")}</h1><p>{t(locale, "intake.form.description")}</p></div></div>
          <div className="form-grid">
            <Field label={t(locale, "intake.destination")}><input onChange={(event) => update("destination", event.target.value)} placeholder={t(locale, "intake.destinationPlaceholder")} required value={draft.destination} /></Field>
            <div className="number-row">
              <Field label={t(locale, "intake.adults")}><input min="1" onChange={(event) => update("adults", event.target.value)} type="number" value={draft.adults} /></Field>
              <Field label={t(locale, "intake.children")}><input min="0" onChange={(event) => update("children", event.target.value)} type="number" value={draft.children} /></Field>
            </div>
            <DateRangePicker endDate={draft.endDate} locale={locale} onChange={updateDates} startDate={draft.startDate} />

            <div className="lodging-fields">
              <SegmentedControl label={t(locale, "intake.lodging")} onChange={(value) => update("lodgingStatus", value)} options={[{ value: "confirmed", label: t(locale, "intake.lodging.confirmed") }, { value: "area_only", label: t(locale, "intake.lodging.area") }, { value: "undecided", label: t(locale, "intake.lodging.undecided") }]} value={draft.lodgingStatus} />
              {draft.lodgingStatus !== "undecided" ? <Field label={t(locale, draft.lodgingStatus === "confirmed" ? "intake.lodging.confirmedLabel" : "intake.lodging.areaLabel")}><input onChange={(event) => update("lodgingValue", event.target.value)} placeholder={t(locale, draft.lodgingStatus === "confirmed" ? "intake.lodging.confirmedPlaceholder" : "intake.lodging.areaPlaceholder")} value={draft.lodgingValue} /></Field> : <InlineNotice>{t(locale, "intake.lodging.notice")}</InlineNotice>}
            </div>

            <div className="field-wide"><ChoiceChips label={t(locale, "intake.transport")} onChange={(value) => update("transportModes", value)} options={transportOptions} values={draft.transportModes} /></div>
            {draft.transportModes.includes("car") ? <label className="check-row field-wide"><input checked={draft.hasLicense} onChange={(event) => update("hasLicense", event.target.checked)} type="checkbox" />{t(locale, "intake.license")}</label> : null}
            <div className="field-wide"><SegmentedControl label={t(locale, "intake.pace")} onChange={(value) => update("pace", value)} options={[{ value: "relaxed", label: t(locale, "intake.pace.relaxed") }, { value: "balanced", label: t(locale, "intake.pace.balanced") }, { value: "intense", label: t(locale, "intake.pace.intense") }]} value={draft.pace} /></div>
            <TripProfileFields adultsCount={draft.adults} childrenCount={draft.children} copy={profileCopy} onChange={(value) => update("profile", value)} value={draft.profile} />
            <BudgetFields copy={budgetCopy} locale={locale} onChange={(value) => update("budget", value)} value={draft.budget} />
            <Field className="field-wide" hint={t(locale, "intake.interestsHint")} label={t(locale, "intake.interests")}><textarea onChange={(event) => update("interests", event.target.value)} placeholder={t(locale, "intake.interestsPlaceholder")} value={draft.interests} /></Field>
          </div>
          {status.message ? <InlineNotice tone={status.state === "error" ? "error" : "neutral"}>{status.message}</InlineNotice> : null}
          <footer className="form-footer"><p>{t(locale, "intake.footer")}</p><Button disabled={status.state === "sending"} variant="primary" type="submit">{t(locale, status.state === "sending" ? "intake.creating" : "intake.create")}</Button></footer>
        </form>
      )}
    </main>
  );
}
