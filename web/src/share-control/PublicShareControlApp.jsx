import { useState } from "react";
import { Button, InlineNotice } from "../components.jsx";
import { openExternal, setWidgetState, useToolOutput, widgetState } from "../bridge.js";
import { ItineraryViewer, formatItineraryDate } from "../itinerary/ItineraryViewer.jsx";
import {
  hasPublicShareResultActions,
  publicSharePresentation,
} from "./share-control.js";

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
  const [notice, setNotice] = useState(saved.notice || "");
  const [previewView, setPreviewView] = useState(saved.previewView || "list");
  const state = output?.state || "not_published";
  const summary = tripSummary(output);
  const publicUrl = output?.publicUrl;
  const expires = expiryLabel(output?.expiresAt);

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

  if (state === "preview") {
    const proposedExpiry = output?.action === "publish"
      ? expiryLabel(output?.proposedExpiresAt)
      : "";
    return (
      <main className="app-shell share-control-shell">
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
        </section>
      </main>
    );
  }

  const presentation = publicSharePresentation(output);
  if (hasPublicShareResultActions(output)) {
    return (
      <main className="app-shell share-control-shell">
        <section aria-live="polite" className="share-control-card">
          <p className="eyebrow">{presentation.eyebrow}</p>
          <h1>{presentation.title}</h1>
          <p className="share-control-detail">{presentation.detail}{expires ? ` Estará disponible hasta el ${expires}.` : ""}</p>
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

  return (
    <main className="app-shell share-control-shell">
      <section aria-live="polite" className="share-control-card">
        <p className="eyebrow">{presentation.eyebrow}</p>
        <h1>{presentation.title}</h1>
        <p className="share-control-detail">{presentation.detail}</p>
        <div className="share-trip-summary"><strong>{summary.title}</strong>{summary.description ? <span>{summary.description}</span> : null}</div>
      </section>
    </main>
  );
}
