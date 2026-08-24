import assert from "node:assert/strict";
import test from "node:test";
import { initialToolOutput, normalizeToolOutput } from "./src/tool-output.js";

test("reads structured content already present when a widget mounts", () => {
  const itinerary = { title: "Sevilla local" };
  assert.deepEqual(initialToolOutput({ toolOutput: { itinerary } }), { itinerary });
  assert.deepEqual(
    normalizeToolOutput({ structuredContent: { itinerary } }),
    { itinerary },
  );
});

test("treats an absent initial result as pending", () => {
  assert.equal(initialToolOutput(undefined), null);
  assert.equal(normalizeToolOutput(null), null);
});
