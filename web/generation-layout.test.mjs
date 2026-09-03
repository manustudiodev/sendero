import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("places lodging search on a full row while pace keeps one column", async () => {
  const source = await readFile(new URL("./src/generate/GenerateTripApp.jsx", import.meta.url), "utf8");
  const nameIndex = source.indexOf('name="lodging-address-search"');
  const startIndex = source.lastIndexOf("<DestinationCombobox", nameIndex);
  const endIndex = source.indexOf("/>", nameIndex);
  const lodgingSearch = source.slice(startIndex, endIndex + 2);

  assert.ok(nameIndex > -1 && startIndex > -1 && endIndex > -1, "expected the lodging address combobox");
  assert.match(lodgingSearch, /\n\s+wide\n/);
  assert.match(source, /<label className="generate-field"><span>\{copy\.pace\}<\/span>/);
  assert.doesNotMatch(source, /<label className="generate-field generate-field-wide"><span>\{copy\.pace\}<\/span>/);
});

test("keeps authentication in the top bar and opens WebMCP commands from a compact modal trigger", async () => {
  const source = await readFile(new URL("./src/generate/GenerateTripApp.jsx", import.meta.url), "utf8");

  assert.match(source, /signIn: "Ingresar"/);
  assert.match(source, /const topbarAction = page\.session\.authenticated/);
  assert.match(source, /<WebPageFrame[\s\S]{0,180}?topbarAction=\{topbarAction\}/);
  assert.match(source, /aria-haspopup="dialog"/);
  assert.match(source, /aria-label=\{`\$\{model\.label\}: \$\{model\.status\}\. \$\{model\.count\}`\}/);
  assert.match(source, /<dialog[\s\S]{0,220}?aria-labelledby="generate-webmcp-dialog-title"/);
  assert.match(source, /dialog\.showModal\(\)/);
  assert.match(source, /onClose=\{\(\) => triggerRef\.current\?\.focus\(\)\}/);
  assert.match(source, /\.generate-webmcp-modal-header \{ position: sticky;[^}]*top: 0;/);
  assert.match(source, /background: var\(--web-surface\);/);
  assert.doesNotMatch(source, /<details className=\{`generate-webmcp/);
  assert.match(source, /<WebMcpIndicator language=\{language\} status=\{generationStatus\} \/>/);
  assert.doesNotMatch(source, /<div className="web-actions">[\s\S]{0,250}?copy\.signIn/);
});

test("uses a concise localized label for the prompt generation action", async () => {
  const source = await readFile(new URL("./src/generate/GenerateTripApp.jsx", import.meta.url), "utf8");

  assert.match(source, /prepare: "Generate prompt"/);
  assert.match(source, /prepare: "Generar prompt"/);
  assert.match(source, /prepare: "Gerar prompt"/);
  assert.match(source, /prepare: "Générer le prompt"/);
  assert.match(source, /prepare: "Prompt generieren"/);
  assert.doesNotMatch(source, /prepare: "Crear prompt para ChatGPT"/);
});

test("uses neutral sign-in copy for saving without assuming the visitor needs a new account", async () => {
  const source = await readFile(new URL("./src/generate/GenerateTripApp.jsx", import.meta.url), "utf8");

  assert.match(source, /signInToSave: "Ingresa para guardar y compartir"/);
  assert.match(source, />\{copy\.signInToSave\}<\/a>/);
  assert.doesNotMatch(source, /Crear cuenta para guardar y compartir/);
  assert.doesNotMatch(source, /createAccountToSave/);
});

test("makes transient generation notices dismissible and keeps errors assertive", async () => {
  const source = await readFile(new URL("./src/generate/GenerateTripApp.jsx", import.meta.url), "utf8");

  assert.match(source, /dismissNotice: "Cerrar aviso"/);
  assert.match(source, /role=\{notice\.kind === "error" \? "alert" : "status"\}/);
  assert.match(source, /aria-live=\{notice\.kind === "error" \? "assertive" : "polite"\}/);
  assert.match(source, /className="generate-notice-dismiss" onClick=\{\(\) => setNotice\(null\)\}/);
  assert.match(source, /\.generate-notice-dismiss:hover/);
});

test("uses an interactive back step and separates automatic WebMCP generation from the manual prompt fallback", async () => {
  const source = await readFile(new URL("./src/generate/GenerateTripApp.jsx", import.meta.url), "utf8");
  const comboboxSource = await readFile(new URL("./src/generate/DestinationCombobox.jsx", import.meta.url), "utf8");

  assert.match(source, /progress: \["Datos del viaje", "Generación del itinerario", "Revisar y guardar"\]/);
  assert.doesNotMatch(source, /progress: \[[^\n]*"Continuar en ChatGPT"/);
  assert.match(source, /step === 1 && activeStep > 1/);
  assert.match(source, /<button className="generate-step-content" onClick=\{onReturnToBrief\}/);
  assert.match(source, /const automatic = mode === "automatic"/);
  assert.match(source, /automatic \? <p className="generate-automatic-note"/);
  assert.match(source, /No necesitas copiar ningún prompt/);
  assert.match(source, /onBriefPrepared: \(prepared\) =>/);
  assert.match(source, /setGenerationMode\("automatic"\)/);
  assert.match(source, /setActiveStep\(2\)/);
  assert.match(source, /destinationAccepted: Boolean\(value\.destination && !value\.destinationPlaceId\)/);
  assert.match(source, /accepted=\{brief\.destinationAccepted\}/);
  assert.match(comboboxSource, /\(value\.placeId \|\| accepted\) && value\.label === query/);
});

test("keeps step three concise and places draft persistence context below the itinerary title", async () => {
  const generationSource = await readFile(new URL("./src/generate/GenerateTripApp.jsx", import.meta.url), "utf8");
  const viewerSource = await readFile(new URL("./src/itinerary/ItineraryViewer.jsx", import.meta.url), "utf8");

  assert.match(generationSource, /id="generate-preview-title" tabIndex=\{-1\}>\{copy\.previewEyebrow\}/);
  assert.doesNotMatch(generationSource, /<h2 id="generate-preview-title"/);
  assert.doesNotMatch(generationSource, /draft\.warnings\?\.length/);
  assert.doesNotMatch(generationSource, /className="generate-steps"/);
  assert.match(generationSource, /<ItineraryViewer[\s\S]{0,1800}?headerDetail=\{draft\.status === "saved"/);
  assert.match(viewerSource, /<HeadingTag className="itinerary-title">\{contextualTitle\}<\/HeadingTag>[\s\S]{0,140}?itinerary-header-detail/);
});

test("keeps every itinerary preview view interactive and preserves its local selection state", async () => {
  const source = await readFile(new URL("./src/generate/GenerateTripApp.jsx", import.meta.url), "utf8");

  assert.match(source, /const \[previewView, setPreviewView\] = useState\("list"\)/);
  assert.match(source, /function openPreviewReservation\(target\)/);
  assert.match(source, /activeView=\{previewView\}/);
  assert.match(source, /onCalendarDayChange=\{setSelectedCalendarDate\}/);
  assert.match(source, /onCalendarMonthChange=\{setSelectedCalendarMonth\}/);
  assert.match(source, /onReservationOpen=\{openPreviewReservation\}/);
  assert.match(source, /onRouteDayChange=\{setSelectedRouteDate\}/);
  assert.match(source, /onViewChange=\{\(view\) => \{/);
  assert.match(source, /selectedReservationKey=\{selectedReservationKey\}/);
  assert.match(source, /onReservationAuthenticationRequired=\{draft\.status === "valid" && !page\.session\.authenticated/);
  assert.match(source, /onReservationStatusChange=\{draft\.status === "valid" && page\.session\.authenticated/);
  assert.match(source, /reservationWritable=\{draft\.status === "valid" && page\.session\.authenticated\}/);
  assert.match(source, /reservationAuthTitle: "Ingresa para registrar tus reservas"/);
  assert.match(source, /<ReservationAuthenticationDialog/);
  assert.match(source, /loginHref=\{loginUrl\(page\.session, currentGenerateReturnTo\(locale\)\)\}/);
});

test("hides budget summaries that do not contain a useful monetary total", async () => {
  const viewer = await readFile(new URL("./src/itinerary/ItineraryViewer.jsx", import.meta.url), "utf8");

  assert.match(viewer, /const hasUsefulEstimate = Boolean\(/);
  assert.match(viewer, /summary\.estimatedMin > 0 \|\| summary\.estimatedMax > 0/);
  assert.match(viewer, /if \(!hasUsefulEstimate\) return null;/);
});
