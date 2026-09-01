import assert from "node:assert/strict";
import test from "node:test";
import {
  CHATGPT_SITE_TOOLS_GUIDE_URL,
  createItineraryHandoffPrompt,
} from "./src/generate/handoff-prompt.js";

const brief = {
  locale: "es",
  destination: "París, Francia",
  startDate: "2026-10-03",
  endDate: "2026-10-08",
  travellers: { adults: 2, children: 0, seniors: 0 },
  transport: { modes: ["walk", "public_transit"], hasLicense: false, wantsCar: false },
  budget: { comfort: "medium", scope: "total", flexibility: "target", includes: ["activities", "food"] },
};

test("builds a portable prompt with the exact normalized brief and both Sendero paths", () => {
  const prompt = createItineraryHandoffPrompt(brief, "es");
  assert.match(prompt, /get_itinerary_planning_protocol/);
  assert.match(prompt, /validate_and_stage_itinerary/);
  assert.match(prompt, /plugin conectado de Sendero/);
  assert.match(prompt, /No lo guardes hasta que yo lo apruebe explícitamente/);
  assert.match(prompt, /"destination": "París, Francia"/);
  assert.match(prompt, /"comfort": "medium"/);
  assert.equal(prompt.includes("csrf"), false);
  assert.equal(prompt.includes("accessToken"), false);
});

test("localizes the handoff instructions and falls back to English", () => {
  assert.match(createItineraryHandoffPrompt(brief, "fr"), /plugin Sendero connecté/);
  assert.match(createItineraryHandoffPrompt(brief, "de"), /verbundene Sendero-Plugin/);
  assert.match(createItineraryHandoffPrompt(brief, "unknown"), /Create a complete travel itinerary/);
});

test("uses the official ChatGPT site-tools guide", () => {
  assert.equal(
    CHATGPT_SITE_TOOLS_GUIDE_URL,
    "https://help.openai.com/en/articles/20001423-using-site-tools-in-the-chatgpt-desktop-app",
  );
});
