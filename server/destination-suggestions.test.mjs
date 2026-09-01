import assert from "node:assert/strict";
import test from "node:test";
import {
  DestinationSuggestionsError,
  destinationSuggestions,
  destinationSuggestionsRequestSchema,
} from "./destination-suggestions.mjs";

const sessionToken = "3dfb0938-9dc6-47ea-b945-75c87f1b9830";

test("requires at least three characters and a bounded autocomplete session token", () => {
  assert.throws(
    () => destinationSuggestionsRequestSchema.parse({ query: "ny", locale: "en", sessionToken }),
    /too small/i,
  );
  assert.throws(
    () => destinationSuggestionsRequestSchema.parse({ query: "new", sessionToken: "unsafe token" }),
    /invalid/i,
  );
});

test("fails closed when destination search has no server-side key", async () => {
  await assert.rejects(
    destinationSuggestions({ query: "new", locale: "en", sessionToken }, { apiKey: "" }),
    (error) => error instanceof DestinationSuggestionsError
      && error.code === "destination_search_unavailable",
  );
});

test("requests regional predictions and returns only canonical cities and countries", async () => {
  let captured;
  const result = await destinationSuggestions(
    { query: "san", locale: "es-AR", sessionToken },
    {
      apiKey: "server-only-test-key",
      async fetchImpl(url, options) {
        captured = { url, options };
        return new Response(JSON.stringify({
          suggestions: [
            {
              placePrediction: {
                placeId: "city-1",
                text: { text: "Santiago, Chile" },
                structuredFormat: {
                  mainText: { text: "Santiago" },
                  secondaryText: { text: "Chile" },
                },
                types: ["locality", "political"],
              },
            },
            {
              placePrediction: {
                placeId: "country-1",
                text: { text: "San Marino" },
                structuredFormat: { mainText: { text: "San Marino" } },
                types: ["country", "political"],
              },
            },
            {
              placePrediction: {
                placeId: "poi-1",
                text: { text: "Santiago Airport" },
                types: ["airport", "point_of_interest"],
              },
            },
          ],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      },
    },
  );

  assert.equal(captured.url, "https://places.googleapis.com/v1/places:autocomplete");
  assert.equal(captured.options.headers["X-Goog-Api-Key"], "server-only-test-key");
  assert.deepEqual(JSON.parse(captured.options.body), {
    input: "san",
    includeQueryPredictions: false,
    includedPrimaryTypes: ["(regions)"],
    languageCode: "es-AR",
    sessionToken,
  });
  assert.deepEqual(result, {
    suggestions: [
      {
        placeId: "city-1",
        label: "Santiago, Chile",
        primaryText: "Santiago",
        secondaryText: "Chile",
      },
      {
        placeId: "country-1",
        label: "San Marino",
        primaryText: "San Marino",
        secondaryText: "",
      },
    ],
  });
  assert.doesNotMatch(JSON.stringify(result), /server-only-test-key/);
});

test("sanitizes upstream failures", async () => {
  await assert.rejects(
    destinationSuggestions(
      { query: "par", locale: "fr", sessionToken },
      {
        apiKey: "server-only-test-key",
        async fetchImpl() {
          return new Response("provider secret details", { status: 403 });
        },
      },
    ),
    (error) => error instanceof DestinationSuggestionsError
      && error.code === "destination_search_failed"
      && !error.message.includes("provider secret details"),
  );
});
