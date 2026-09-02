import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createItineraryHandoffPrompt } from "./src/generate/handoff-prompt.js";

const brief = {
  locale: "es",
  destination: "París, Francia",
  destinationPlaceId: "place-paris",
  startDate: "2026-10-03",
  endDate: "2026-10-08",
  travellers: { adults: 2, children: 0, seniors: 0 },
  transport: { modes: ["walk", "public_transit"], hasLicense: false, wantsCar: false },
  budget: { comfort: "medium", scope: "total", flexibility: "target", includes: ["activities", "food"] },
  lodging: { area: "Le Marais, París", areaPlaceId: "place-marais", status: "area_only" },
};

test("builds a portable plain-language prompt without hard-coding the Sendero integration path", () => {
  const prompt = createItineraryHandoffPrompt(brief, "es");
  assert.match(prompt, /itinerario de viaje completo con Sendero/);
  assert.match(prompt, /No lo guardes hasta que yo lo apruebe explícitamente/);
  assert.match(prompt, /Destino: París, Francia/);
  assert.match(prompt, /Fechas del viaje: 3 de octubre de 2026 al 8 de octubre de 2026/);
  assert.match(prompt, /Viajeros: 2 adultos/);
  assert.match(prompt, /Transporte: a pie y transporte público/);
  assert.match(prompt, /Alojamiento: zona preferida: Le Marais, París/);
  assert.match(prompt, /Presupuesto: sin monto fijo; gama media; para todo el viaje; objetivo; incluye actividades y comidas/);
  assert.doesNotMatch(prompt, /\(JSON\)|"destination"|\{|\}/);
  assert.doesNotMatch(prompt, /place-paris|place-marais|PlaceId/);
  assert.doesNotMatch(prompt, /plugin|WebMCP|herramientas|integración|narres tu proceso/i);
  assert.doesNotMatch(prompt, /get_itinerary_planning_protocol|validate_and_stage_itinerary/);
  assert.equal(prompt.includes("csrf"), false);
  assert.equal(prompt.includes("accessToken"), false);
});

test("localizes the handoff instructions and falls back to English", () => {
  assert.match(createItineraryHandoffPrompt(brief, "fr"), /itinéraire de voyage complet avec Sendero/);
  assert.match(createItineraryHandoffPrompt(brief, "de"), /mit Sendero.*vollständigen Reiseplan/);
  assert.match(createItineraryHandoffPrompt(brief, "unknown"), /Create a complete travel itinerary/);
});

test("keeps the ChatGPT integrated browser as the only WebMCP handoff path", async () => {
  const source = await readFile(new URL("./src/generate/GenerateTripApp.jsx", import.meta.url), "utf8");
  assert.match(source, /Continúa en el navegador integrado de ChatGPT/);
  assert.match(source, /navegador interno de la app de escritorio de ChatGPT/);
  assert.match(source, /herramientas WebMCP de esta página/);
  assert.match(source, /La extensión de ChatGPT para Chrome, ChatGPT web y los navegadores externos no ofrecen este flujo WebMCP integrado/);
  assert.match(source, /generationStatusFromEvent/);
  assert.match(source, /hrefForLocale\("\/app", locale\)/);
  assert.match(source, /Abre Sendero en el navegador integrado de ChatGPT/);
  assert.doesNotMatch(source, /Otra opción · ChatGPT web o escritorio/);
  assert.doesNotMatch(source, /con el plugin de Sendero conectado/);
  assert.doesNotMatch(source, /generate-secondary-path/);
  assert.doesNotMatch(source, /Utiliza el plugin conectado de Sendero y empieza a crear el itinerario directamente/);
  assert.doesNotMatch(source, /No describas qué herramientas o integración vas a usar ni narres tu proceso/);
  assert.equal((source.match(/name="lodging-address-search"/g) || []).length, 1);
  assert.doesNotMatch(source, /name="lodging-area-search"/);
  assert.match(source, /Dirección o zona de alojamiento/);
  assert.doesNotMatch(source, /generate-connection|chatGptUrl\(|CHATGPT_SITE_TOOLS_GUIDE_URL|openChatgpt/);
  assert.ok(source.indexOf("<aside className=\"generate-handoff-guide\">") < source.indexOf("<div className=\"generate-prompt\">"));
});
