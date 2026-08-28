import { useEffect, useState } from "react";
import { Button, InlineNotice } from "../components.jsx";
import { openExternal, setWidgetState, useToolOutput, widgetState } from "../bridge.js";
import { formatDate, localeLanguage, resolveContentLocale, setDocumentLocale } from "../i18n/index.js";
import { ItineraryViewer } from "../itinerary/ItineraryViewer.jsx";
import {
  hasPublicShareResultActions,
  publicSharePresentation,
} from "./share-control.js";

const COPY = {
  en: { trip: "Your trip", copied: "Link copied.", copyFailed: "We couldn't copy it. You can open it and copy it from the browser.", preview: "Preview", exact: "This is exactly what they will see", privacy: "The link will be public and view only. It will show titles, descriptions, alternatives, and public locations; it will not include the exact lodging, private notes, collaborators, or version history.", until: (value) => ` It will be available until ${value}.`, missingPreview: "We didn't receive the public view. Prepare it again before creating the link.", copy: "Copy link", open: "Open" },
  es: { trip: "Tu viaje", copied: "Enlace copiado.", copyFailed: "No pudimos copiarlo. Puedes abrirlo y copiarlo desde el navegador.", preview: "Vista previa", exact: "Esto es exactamente lo que verán", privacy: "El enlace será público y de solo lectura. Sí mostrará títulos, descripciones, alternativas y ubicaciones públicas; no incluirá alojamiento exacto, notas privadas, colaboradores ni historial de versiones.", until: (value) => ` Estará disponible hasta el ${value}.`, missingPreview: "No recibimos la vista pública. Vuelve a prepararla antes de crear el enlace.", copy: "Copiar enlace", open: "Abrir" },
  pt: { trip: "Sua viagem", copied: "Link copiado.", copyFailed: "Não foi possível copiar. Você pode abri-lo e copiá-lo no navegador.", preview: "Prévia", exact: "Isto é exatamente o que verão", privacy: "O link será público e somente para leitura. Ele mostrará títulos, descrições, alternativas e locais públicos; não incluirá hospedagem exata, notas privadas, colaboradores nem histórico de versões.", until: (value) => ` Estará disponível até ${value}.`, missingPreview: "Não recebemos a visualização pública. Prepare-a novamente antes de criar o link.", copy: "Copiar link", open: "Abrir" },
};

function copyFor(locale) { return COPY[localeLanguage(locale)] || COPY.en; }

function dateRange(startDate, endDate, locale) {
  if (!startDate || !endDate) return "";
  return `${formatDate(locale, startDate, { day: "numeric", month: "short", year: "numeric" })} — ${formatDate(locale, endDate, { day: "numeric", month: "short", year: "numeric" })}`;
}

function expiryLabel(value, locale) {
  if (!value) return "";
  try {
    return formatDate(locale, value, { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return "";
  }
}

function tripSummary(output, locale, copy) {
  const itinerary = output?.itinerary;
  const title = output?.title || itinerary?.title || copy.trip;
  const destination = output?.destination || itinerary?.destination || "";
  const range = dateRange(output?.startDate || itinerary?.startDate, output?.endDate || itinerary?.endDate, locale);
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
  const locale = resolveContentLocale(output?.itinerary?.locale || output?.locale);
  const copy = copyFor(locale);
  const summary = tripSummary(output, locale, copy);
  const publicUrl = output?.publicUrl;
  const expires = expiryLabel(output?.expiresAt, locale);

  useEffect(() => { setDocumentLocale(locale); }, [locale]);

  async function copyLink() {
    if (!publicUrl) return;
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(publicUrl);
      else if (!fallbackCopy(publicUrl)) throw new Error("Clipboard unavailable");
      setNotice(copy.copied);
      setWidgetState({ ...widgetState(), notice: copy.copied });
    } catch {
      if (fallbackCopy(publicUrl)) {
        setNotice(copy.copied);
        setWidgetState({ ...widgetState(), notice: copy.copied });
      } else {
        setNotice(copy.copyFailed);
      }
    }
  }

  if (state === "preview") {
    const proposedExpiry = output?.action === "publish"
      ? expiryLabel(output?.proposedExpiresAt, locale)
      : "";
    return (
      <main className="app-shell share-control-shell">
        <section className="share-control-card">
          <p className="eyebrow">{copy.preview}</p>
          <h2>{copy.exact}</h2>
          <p className="share-privacy-copy">{copy.privacy}{proposedExpiry ? copy.until(proposedExpiry) : ""}</p>
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
          ) : <InlineNotice tone="error">{copy.missingPreview}</InlineNotice>}
        </section>
      </main>
    );
  }

  const presentation = publicSharePresentation(output, locale);
  if (hasPublicShareResultActions(output)) {
    return (
      <main className="app-shell share-control-shell">
        <section aria-live="polite" className="share-control-card">
          <p className="eyebrow">{presentation.eyebrow}</p>
          <h1>{presentation.title}</h1>
          <p className="share-control-detail">{presentation.detail}{expires ? copy.until(expires) : ""}</p>
          <div className="share-trip-summary"><strong>{summary.title}</strong>{summary.description ? <span>{summary.description}</span> : null}</div>
          {notice ? <InlineNotice>{notice}</InlineNotice> : null}
          <div className="share-control-actions">
            <Button onClick={copyLink} variant="primary">{copy.copy}</Button>
            <Button onClick={() => openExternal(publicUrl)} variant="secondary">{copy.open} <span aria-hidden="true">↗</span></Button>
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
