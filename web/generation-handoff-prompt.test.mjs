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

test("builds a portable plain-language prompt that prioritizes the Sendero plugin", () => {
  const prompt = createItineraryHandoffPrompt(brief, "es");
  assert.match(prompt, /plugin conectado de Sendero/);
  assert.match(prompt, /empieza a crear el itinerario directamente/i);
  assert.match(prompt, /ni narres tu proceso/i);
  assert.match(prompt, /No lo guardes hasta que yo lo apruebe explícitamente/);
  assert.match(prompt, /Destino: París, Francia/);
  assert.match(prompt, /Fechas del viaje: 3 de octubre de 2026 al 8 de octubre de 2026/);
  assert.match(prompt, /Viajeros: 2 adultos/);
  assert.match(prompt, /Transporte: a pie y transporte público/);
  assert.match(prompt, /Alojamiento: zona preferida: Le Marais, París/);
  assert.match(prompt, /Presupuesto: sin monto fijo; gama media; para todo el viaje; objetivo; incluye actividades y comidas/);
  assert.doesNotMatch(prompt, /\(JSON\)|"destination"|\{|\}/);
  assert.doesNotMatch(prompt, /place-paris|place-marais|PlaceId/);
  assert.doesNotMatch(prompt, /get_itinerary_planning_protocol|validate_and_stage_itinerary/);
  assert.equal(prompt.includes("csrf"), false);
  assert.equal(prompt.includes("accessToken"), false);
});

test("localizes the handoff instructions and falls back to English", () => {
  assert.match(createItineraryHandoffPrompt(brief, "fr"), /plugin Sendero connecté/);
  assert.match(createItineraryHandoffPrompt(brief, "de"), /verbundene Sendero-Plugin/);
  assert.match(createItineraryHandoffPrompt(brief, "unknown"), /Create a complete travel itinerary/);
});

test("keeps the browser extension path primary without a ChatGPT exit button or capability banner", async () => {
  const source = await readFile(new URL("./src/generate/GenerateTripApp.jsx", import.meta.url), "utf8");
  assert.match(source, /Usa ChatGPT en este navegador/);
  assert.match(source, /Otra opción · ChatGPT web o escritorio/);
  assert.match(source, /plugin de Sendero esté conectado/);
  assert.doesNotMatch(source, /generate-connection|chatGptUrl\(|CHATGPT_SITE_TOOLS_GUIDE_URL|openChatgpt/);
  assert.ok(source.indexOf("<aside className=\"generate-handoff-guide\">") < source.indexOf("<div className=\"generate-prompt\">"));
});
