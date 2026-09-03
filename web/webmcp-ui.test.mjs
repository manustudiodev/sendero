import assert from "node:assert/strict";
import test from "node:test";
import { ITINERARY_GENERATION_TOOL_NAMES } from "./src/generate/webmcp.js";
import { webMcpIndicatorModel } from "./src/generate/webmcp-ui.js";

test("presents every registered creation command in every supported language", () => {
  for (const language of ["en", "es", "pt", "fr", "de"]) {
    const model = webMcpIndicatorModel(language, { kind: "ready" });
    assert.equal(model.state, "connected");
    assert.deepEqual(model.tools.map(({ name }) => name), ITINERARY_GENERATION_TOOL_NAMES);
    assert.equal(model.tools.every(({ description }) => typeof description === "string" && description.length > 20), true);
  }
});

test("distinguishes WebMCP discovery from operation failures", () => {
  assert.equal(webMcpIndicatorModel("es", { kind: "connecting" }).state, "checking");
  assert.equal(webMcpIndicatorModel("es", { kind: "unavailable" }).state, "unavailable");
  assert.equal(webMcpIndicatorModel("es", { kind: "error", code: "registration_failed" }).state, "error");
  assert.equal(webMcpIndicatorModel("es", { kind: "error", code: "itinerary_invalid" }).state, "connected");
  assert.equal(webMcpIndicatorModel("unknown", { kind: "ready" }).commands, "Comandos disponibles");
});
