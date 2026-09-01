import assert from "node:assert/strict";
import test from "node:test";
import {
  destinationQueryReady,
  normalizeDestinationSuggestions,
  requestDestinationSuggestions,
} from "./src/generate/destination-client.js";

test("starts destination search only after three normalized characters", () => {
  assert.equal(destinationQueryReady(" pa "), false);
  assert.equal(destinationQueryReady(" par "), true);
});

test("posts a normalized destination query with the authenticated CSRF token", async () => {
  let captured;
  const suggestions = await requestDestinationSuggestions({
    csrfToken: "csrf-token",
    locale: "fr-FR",
    query: "  New   York ",
    sessionToken: "3dfb0938-9dc6-47ea-b945-75c87f1b9830",
    async request(path, options) {
      captured = { path, options };
      return { suggestions: [{ placeId: "place-1", label: "New York, NY, USA" }] };
    },
  });
  assert.deepEqual(captured, {
    path: "/api/destination-suggestions",
    options: {
      body: {
        locale: "fr-FR",
        query: "New York",
        sessionToken: "3dfb0938-9dc6-47ea-b945-75c87f1b9830",
      },
      csrfToken: "csrf-token",
      method: "POST",
      signal: undefined,
    },
  });
  assert.deepEqual(suggestions, [{
    placeId: "place-1",
    label: "New York, NY, USA",
    primaryText: "New York, NY, USA",
    secondaryText: "",
  }]);
});

test("drops malformed and duplicate client suggestions", () => {
  assert.deepEqual(normalizeDestinationSuggestions({ suggestions: [
    { placeId: "place-1", label: "Paris, France", primaryText: "Paris", secondaryText: "France" },
    { placeId: "place-1", label: "Duplicate" },
    { placeId: "", label: "Missing ID" },
  ] }), [{
    placeId: "place-1",
    label: "Paris, France",
    primaryText: "Paris",
    secondaryText: "France",
  }]);
});
