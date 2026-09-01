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
  assert.throws(
    () => destinationSuggestionsRequestSchema.parse({
      kind: "lodging_area",
      query: "pal",
      sessionToken,
    }),
    /selected destination/i,
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

test("restricts lodging areas to the selected destination and caches its place context", async () => {
  const calls = [];
  const contextCache = new Map();
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (options.method === "GET") {
      return new Response(JSON.stringify({
        id: "destination-1",
        types: ["locality", "political"],
        location: { latitude: -34.6037, longitude: -58.3816 },
        viewport: {
          low: { latitude: -34.705, longitude: -58.531 },
          high: { latitude: -34.526, longitude: -58.335 },
        },
        addressComponents: [{ shortText: "AR", types: ["country", "political"] }],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({
      suggestions: [
        {
          placePrediction: {
            placeId: "area-1",
            text: { text: "Palermo, Buenos Aires, Argentina" },
            structuredFormat: {
              mainText: { text: "Palermo" },
              secondaryText: { text: "Buenos Aires, Argentina" },
            },
            types: ["neighborhood", "political"],
          },
        },
        {
          placePrediction: {
            placeId: "restaurant-1",
            text: { text: "Palermo Restaurant" },
            types: ["restaurant", "point_of_interest"],
          },
        },
      ],
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const input = {
    destinationPlaceId: "destination-1",
    kind: "lodging_area",
    locale: "es-AR",
    query: "pal",
    sessionToken,
  };

  const first = await destinationSuggestions(input, {
    apiKey: "server-only-test-key",
    contextCache,
    fetchImpl,
  });
  const second = await destinationSuggestions({ ...input, query: "reco" }, {
    apiKey: "server-only-test-key",
    contextCache,
    fetchImpl,
  });

  assert.match(calls[0].url, /^https:\/\/places\.googleapis\.com\/v1\/places\/destination-1\?languageCode=es-AR$/);
  assert.equal(calls.filter((call) => call.options.method === "GET").length, 1);
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    input: "pal",
    includeQueryPredictions: false,
    includedPrimaryTypes: ["(regions)"],
    locationRestriction: {
      rectangle: {
        low: { latitude: -34.705, longitude: -58.531 },
        high: { latitude: -34.526, longitude: -58.335 },
      },
    },
    languageCode: "es-AR",
    sessionToken,
  });
  assert.deepEqual(first.suggestions, [{
    placeId: "area-1",
    label: "Palermo, Buenos Aires, Argentina",
    primaryText: "Palermo",
    secondaryText: "Buenos Aires, Argentina",
  }]);
  assert.deepEqual(second.suggestions, first.suggestions);
});

test("searches lodging names and exact addresses inside a selected country", async () => {
  const calls = [];
  const result = await destinationSuggestions({
    destinationPlaceId: "country-1",
    kind: "lodging_address",
    locale: "en",
    query: "hilton",
    sessionToken,
  }, {
    apiKey: "server-only-test-key",
    contextCache: new Map(),
    async fetchImpl(url, options) {
      calls.push({ url, options });
      if (options.method === "GET") {
        return new Response(JSON.stringify({
          id: "country-1",
          types: ["country", "political"],
          addressComponents: [{ shortText: "AR", types: ["country", "political"] }],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({
        suggestions: [{
          placePrediction: {
            placeId: "hotel-1",
            text: { text: "Hilton Buenos Aires, Macacha Güemes, Buenos Aires" },
            structuredFormat: {
              mainText: { text: "Hilton Buenos Aires" },
              secondaryText: { text: "Macacha Güemes, Buenos Aires" },
            },
            types: ["lodging", "hotel", "point_of_interest"],
          },
        }],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    },
  });

  const autocompleteBody = JSON.parse(calls[1].options.body);
  assert.equal("includedPrimaryTypes" in autocompleteBody, false);
  assert.deepEqual(autocompleteBody.includedRegionCodes, ["ar"]);
  assert.equal(result.suggestions[0].placeId, "hotel-1");
});

test("rejects a non-destination place ID as lodging search context", async () => {
  let calls = 0;
  await assert.rejects(
    destinationSuggestions({
      destinationPlaceId: "hotel-used-as-destination",
      kind: "lodging_address",
      locale: "en",
      query: "main",
      sessionToken,
    }, {
      apiKey: "server-only-test-key",
      contextCache: new Map(),
      async fetchImpl() {
        calls += 1;
        return new Response(JSON.stringify({
          id: "hotel-used-as-destination",
          types: ["lodging", "hotel", "point_of_interest"],
          location: { latitude: 40.7, longitude: -74 },
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      },
    }),
    (error) => error instanceof DestinationSuggestionsError
      && error.code === "destination_search_failed",
  );
  assert.equal(calls, 1);
});
