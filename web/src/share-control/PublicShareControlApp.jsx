import { useRef, useState } from "react";
import { BrandMark, Button, InlineNotice, SelectionReceipt } from "../components.jsx";
import { openExternal, sendFollowUpMessage, setWidgetState, updateModelContext, useToolOutput, widgetState } from "../bridge.js";
import { ItineraryViewer, formatItineraryDate } from "../itinerary/ItineraryViewer.jsx";
import {
  activeShareAction,
  previewShareAction,
  shareConversationContext,
} from "./share-control.js";

const stateCopy = {
  published: { eyebrow: "Enlace creado", title: "Tu viaje ya se puede compartir", detail: "Solo muestra la versión pública de solo lectura." },
  updated: { eyebrow: "Enlace actualizado", title: "La vista pública está al día", detail: "El mismo enlace ahora muestra la versión que acabas de publicar." },
  rotated: { eyebrow: "Enlace reemplazado", title: "Ya tienes un enlace nuevo", detail: "El enlace anterior dejó de funcionar." },
};

function dateRange(startDate, endDate) {
  if (!startDate || !endDate) return "";
  return `${formatItineraryDate(startDate, { day: "numeric", month: "short", year: "numeric" })} — ${formatItineraryDate(endDate, { day: "numeric", month: "short", year: "numeric" })}`;
}

function expiryLabel(value) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("es", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(value));
  } catch {
    return "";
  }
}

function tripSummary(output) {
  const itinerary = output?.itinerary;
  const title = output?.title || itinerary?.title || "Tu viaje";
  const destination = output?.destination || itinerary?.destination || "";
  const range = dateRange(output?.startDate || itinerary?.startDate, output?.endDate || itinerary?.endDate);
  return { title, description: [destination, range].filter(Boolean).join(" · ") };
}

function actionCopy(intent, title) {
  if (intent === "preview_public_share") return `Quiero revisar qué se compartiría públicamente de “${title}”.`;
  if (intent === "update_public_share") return `Quiero actualizar la vista pública de “${title}” con su versión actual.`;
  if (intent === "revoke_public_share") return `Quiero revocar el enlace público de “${title}”.`;
  if (intent === "rotate_public_share") return `Quiero crear un enlace público nuevo para “${title}” e invalidar el anterior.`;
  return `Quiero crear un enlace público de solo lectura para “${title}”.`;
}

function fallbackCopy(value) {
  const field = document.createElement("textarea");
  field.value = value;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.appendChild(field);
  field.select();
  const copied = document.execCommand("copy");
  field.remove();
  return copied;
}

export function PublicShareControlApp() {
  const { output } = useToolOutput();
  const saved = widgetState();
  const pendingRef = useRef(false);
  const [notice, setNotice] = useState(saved.notice || "");
  const [previewView, setPreviewView] = useState(saved.previewView || "list");
  const [selectedAction, setSelectedAction] = useState(saved.selectedAction || null);
  const [status, setStatus] = useState(saved.status || "idle");
  const state = output?.state || "not_published";
  const summary = tripSummary(output);
  const publicUrl = output?.publicUrl;
  const expires = expiryLabel(output?.expiresAt);

  async function continueConversation(intent, label) {
    if (pendingRef.current) return;
    pendingRef.current = true;
    const selection = { intent, label };
    setSelectedAction(selection);
    setStatus("loading");
    setWidgetState({ selectedAction: selection, status: "loading", notice: "" });
    try {
      try {
        await updateModelContext({
          content: [{ type: "text", text: `La persona eligió “${label}” para la publicación de “${summary.title}”.` }],
          structuredContent: {
            sendero: shareConversationContext(output, intent, summary.title),
          },
        });
      } catch {
        // The visible continuation still preserves the user's intent.
      }
      await sendFollowUpMessage(actionCopy(intent, summary.title));
      setStatus("success");
      setWidgetState({ selectedAction: selection, status: "success", notice: "" });
    } catch {
      setStatus("error");
      setWidgetState({ selectedAction: selection, status: "error", notice: "" });
    } finally {
      pendingRef.current = false;
    }
  }

  async function copyLink() {
    if (!publicUrl) return;
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(publicUrl);
      else if (!fallbackCopy(publicUrl)) throw new Error("Clipboard unavailable");
      setNotice("Enlace copiado.");
      setWidgetState({ ...widgetState(), notice: "Enlace copiado." });
    } catch {
      if (fallbackCopy(publicUrl)) {
        setNotice("Enlace copiado.");
        setWidgetState({ ...widgetState(), notice: "Enlace copiado." });
      } else {
        setNotice("No pudimos copiarlo. Puedes abrirlo y copiarlo desde el navegador.");
      }
    }
  }

  if (selectedAction) {
    return (
      <main className="app-shell share-control-shell compact-shell">
        <div className="brand-line"><BrandMark /><span>Sendero</span></div>
        <SelectionReceipt
          description={summary.description}
          eyebrow="Solicitud recibida"
          status={status === "loading" ? "Continuando en la conversación…" : status === "error" ? "No pudimos continuar todavía." : "Sendero continúa en la conversación."}
          title={selectedAction.label}
        >
          {status === "error" ? <Button onClick={() => continueConversation(selectedAction.intent, selectedAction.label)} variant="secondary">Reintentar</Button> : null}
        </SelectionReceipt>
      </main>
    );
  }

  if (state === "preview") {
    const preview = previewShareAction(output);
    const proposedExpiry = output?.action === "publish"
      ? expiryLabel(output?.proposedExpiresAt)
      : "";
    return (
      <main className="app-shell share-control-shell">
        <div className="brand-line"><BrandMark /><span>Sendero</span></div>
        <section className="share-control-card">
          <p className="eyebrow">Vista previa</p>
          <h2>Esto es exactamente lo que verán</h2>
          <p className="share-privacy-copy">El enlace será público y de solo lectura. Sí mostrará títulos, descripciones, alternativas y ubicaciones públicas; no incluirá alojamiento exacto, notas privadas, colaboradores ni historial de versiones.{proposedExpiry ? ` Estará disponible hasta el ${proposedExpiry}.` : ""}</p>
          {output?.itinerary ? (
            <div className="share-exact-preview">
              <ItineraryViewer
                activeView={previewView}
                itinerary={output.itinerary}
                onViewChange={(view) => {
                  setPreviewView(view);
                  setWidgetState({ ...widgetState(), previewView: view });
                }}
                variant="public"
              />
            </div>
          ) : <InlineNotice tone="error">No recibimos la vista pública. Vuelve a prepararla antes de crear el enlace.</InlineNotice>}
          <div className="share-control-actions"><Button disabled={preview.disabled} onClick={() => continueConversation(preview.intent, preview.label)} variant="primary">{preview.label}</Button></div>
        </section>
      </main>
    );
  }

  if (state === "updated" && !publicUrl) {
    return (
      <main className="app-shell share-control-shell">
        <div className="brand-line"><BrandMark /><span>Sendero</span></div>
        <section aria-live="polite" className="share-control-card">
          <p className="eyebrow">Enlace actualizado</p>
          <h1>La vista pública está al día</h1>
          <p className="share-control-detail">El mismo enlace ahora muestra la versión que acabas de revisar.</p>
          <div className="share-trip-summary"><strong>{summary.title}</strong>{summary.description ? <span>{summary.description}</span> : null}</div>
        </section>
      </main>
    );
  }

  if (["published", "updated", "rotated"].includes(state) && publicUrl) {
    const copy = stateCopy[state];
    return (
      <main className="app-shell share-control-shell">
        <div className="brand-line"><BrandMark /><span>Sendero</span></div>
        <section aria-live="polite" className="share-control-card">
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p className="share-control-detail">{copy.detail}{expires ? ` Estará disponible hasta el ${expires}.` : ""}</p>
          <div className="share-trip-summary"><strong>{summary.title}</strong>{summary.description ? <span>{summary.description}</span> : null}</div>
          {notice ? <InlineNotice>{notice}</InlineNotice> : null}
          <div className="share-control-actions">
            <Button onClick={copyLink} variant="primary">Copiar enlace</Button>
            <Button onClick={() => openExternal(publicUrl)} variant="secondary">Abrir <span aria-hidden="true">↗</span></Button>
          </div>
        </section>
      </main>
    );
  }

  if (state === "active") {
    const primaryAction = activeShareAction(output);
    return (
      <main className="app-shell share-control-shell">
        <div className="brand-line"><BrandMark /><span>Sendero</span></div>
        <section className="share-control-card">
          <p className="eyebrow">Enlace activo</p>
          <h1>{output?.isStale ? "Hay cambios sin publicar" : "La vista pública está al día"}</h1>
          <div className="share-trip-summary"><strong>{summary.title}</strong>{summary.description ? <span>{summary.description}</span> : null}</div>
          <p className="share-control-detail">{output?.isStale ? `El enlace muestra la versión ${output.publishedVersion}; tu viaje ya está en la ${output.currentVersion}.` : "Quien tenga el enlace puede ver la versión pública de solo lectura."}</p>
          <div className="share-control-actions">
            <Button onClick={() => continueConversation(primaryAction.intent, primaryAction.label)} variant="primary">{primaryAction.label}</Button>
            <Button onClick={() => continueConversation("revoke_public_share", "Revocar enlace")} variant="secondary">Revocar</Button>
          </div>
        </section>
      </main>
    );
  }

  const expired = state === "expired";
  const revoked = state === "revoked";
  return (
    <main className="app-shell share-control-shell">
      <div className="brand-line"><BrandMark /><span>Sendero</span></div>
      <section className="share-control-card">
        <p className="eyebrow">{expired ? "Enlace vencido" : revoked ? "Enlace revocado" : "Compartir viaje"}</p>
        <h1>{expired ? "Este enlace ya venció" : revoked ? "El viaje ya no es público" : "Todavía no hay un enlace público"}</h1>
        <p className="share-control-detail">{expired || revoked ? "Puedes crear uno nuevo cuando quieras." : "Crea una vista pública de solo lectura para compartirla con cualquier persona."}</p>
        <div className="share-trip-summary"><strong>{summary.title}</strong>{summary.description ? <span>{summary.description}</span> : null}</div>
        <div className="share-control-actions"><Button onClick={() => continueConversation("preview_public_share", "Revisar publicación")} variant="primary">Revisar y compartir</Button></div>
      </section>
    </main>
  );
}
