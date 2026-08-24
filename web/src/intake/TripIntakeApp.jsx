import { useEffect, useState } from "react";
import { BrandMark, Button, ChoiceChips, Field, InlineNotice, SegmentedControl } from "../components.jsx";
import { sendFollowUpMessage, setWidgetState, useToolOutput, widgetState } from "../bridge.js";

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
  const [activeAction, setActiveAction] = useState(saved.activeAction || "new");
  const [draft, setDraft] = useState(() => saved.draft || draftFromBrief(output?.brief));
  const [status, setStatus] = useState({ state: "idle", message: "" });

  useEffect(() => {
    if (output?.brief && !saved.draft) setDraft(draftFromBrief(output.brief));
  }, [output]);

  useEffect(() => {
    setWidgetState({ activeAction, draft });
  }, [activeAction, draft]);

  function update(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
    setStatus({ state: "idle", message: "" });
  }

  async function sendAction(action) {
    setActiveAction(action);
    if (action === "new") return;
    const prompts = {
      open: "Usa Sendero para listar mis viajes guardados. Muéstrame opciones para abrir uno.",
      adjust: "Quiero ajustar un viaje guardado en Sendero. Pregúntame cuál y qué necesito cambiar, preservando reservas confirmadas y actividades fijas.",
      refresh: "Quiero actualizar un viaje guardado en Sendero con clima, eventos, cierres, reservas y transporte vigentes. Pregúntame cuál viaje debo actualizar.",
    };
    setStatus({ state: "sending", message: "Enviando a ChatGPT…" });
    try {
      await sendFollowUpMessage(prompts[action]);
      setStatus({ state: "sent", message: "Listo. Sendero continuará en la conversación." });
    } catch (error) {
      setStatus({ state: "error", message: error.message || "No se pudo continuar en ChatGPT." });
    }
  }

  async function submit(event) {
    event.preventDefault();
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
    const prompt = `Quiero crear un nuevo viaje con Sendero. Usa prepare_trip_brief con estos datos, investiga información vigente, crea un itinerario local-first, valídalo y muéstralo con el componente de Sendero. Si el alojamiento no está decidido, usa una base provisional claramente indicada.\n\n${JSON.stringify(brief, null, 2)}`;
    setStatus({ state: "sending", message: "Enviando tu viaje a ChatGPT…" });
    try {
      await sendFollowUpMessage(prompt);
      setStatus({ state: "sent", message: "Listo. Sendero ya está preparando el itinerario." });
    } catch (error) {
      setStatus({ state: "error", message: error.message || "No se pudo iniciar el viaje." });
    }
  }

  return (
    <main className="app-shell intake-shell">
      <div className="brand-line"><BrandMark /><span>Sendero</span></div>
      <header className="app-header">
        <div className="header-copy"><p className="eyebrow">Planifica a tu manera</p><h1>¿Qué quieres hacer?</h1><p className="meta">Organiza viajes reales con contexto local, rutas y reservas.</p></div>
      </header>

      <nav aria-label="Acciones de Sendero" className="launcher-grid">
        {launcherActions.map((action) => (
          <button className={`launcher-card ${activeAction === action.id ? "is-active" : ""}`} key={action.id} onClick={() => sendAction(action.id)} type="button">
            <strong>{action.title}</strong><span>{action.description}</span>
          </button>
        ))}
      </nav>

      {activeAction === "new" ? (
        <form className="form-card" onSubmit={submit}>
          <div className="form-heading"><div><h2>Cuéntanos lo esencial</h2><p>Puedes completar el resto conversando después.</p></div></div>
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
      ) : status.message ? <InlineNotice tone={status.state === "error" ? "error" : "neutral"}>{status.message}</InlineNotice> : null}
    </main>
  );
}
