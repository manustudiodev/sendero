import assert from "node:assert/strict";
import test from "node:test";
import {
  ITINERARY_UI_URI,
  LEGACY_ITINERARY_V4_UI_URI,
  LEGACY_ITINERARY_V5_UI_URI,
  LEGACY_ITINERARY_V6_UI_URI,
  LEGACY_ITINERARY_V7_UI_URI,
  LEGACY_ITINERARY_V8_UI_URI,
  LEGACY_ITINERARY_V9_UI_URI,
  LEGACY_ITINERARY_V10_UI_URI,
  LEGACY_ITINERARY_V11_UI_URI,
  LEGACY_ITINERARY_V12_UI_URI,
  LEGACY_ITINERARY_V13_UI_URI,
  itineraryResource,
} from "../server/ui/resources.mjs";

test("pins itinerary v14 while keeping earlier component resources addressable", () => {
  assert.equal(ITINERARY_UI_URI, "ui://sendero/itinerary-v14.html");
  assert.equal(LEGACY_ITINERARY_V4_UI_URI, "ui://sendero/itinerary-v4.html");
  assert.equal(LEGACY_ITINERARY_V5_UI_URI, "ui://sendero/itinerary-v5.html");
  assert.equal(LEGACY_ITINERARY_V6_UI_URI, "ui://sendero/itinerary-v6.html");
  assert.equal(LEGACY_ITINERARY_V7_UI_URI, "ui://sendero/itinerary-v7.html");
  assert.equal(LEGACY_ITINERARY_V8_UI_URI, "ui://sendero/itinerary-v8.html");
  assert.equal(LEGACY_ITINERARY_V9_UI_URI, "ui://sendero/itinerary-v9.html");
  assert.equal(LEGACY_ITINERARY_V10_UI_URI, "ui://sendero/itinerary-v10.html");
  assert.equal(LEGACY_ITINERARY_V11_UI_URI, "ui://sendero/itinerary-v11.html");
  assert.equal(LEGACY_ITINERARY_V12_UI_URI, "ui://sendero/itinerary-v12.html");
  assert.equal(LEGACY_ITINERARY_V13_UI_URI, "ui://sendero/itinerary-v13.html");

  const current = itineraryResource("https://sendero.example");
  const legacy = itineraryResource("https://sendero.example", LEGACY_ITINERARY_V5_UI_URI);
  assert.equal(current.contents[0].uri, ITINERARY_UI_URI);
  assert.equal(legacy.contents[0].uri, LEGACY_ITINERARY_V5_UI_URI);
  assert.equal(legacy.contents[0].text, current.contents[0].text);
});

test("allows only the Google Maps iframe origin required by the itinerary", () => {
  const [resource] = itineraryResource("https://sendero.example").contents;
  assert.match(resource._meta["openai/widgetDescription"], /calendar/i);
  assert.match(resource._meta["openai/widgetDescription"], /daily route/i);
  assert.match(resource._meta["openai/widgetDescription"], /source-backed/i);
  assert.match(resource._meta["openai/widgetDescription"], /reservation and ticket tracker/i);
  assert.match(resource._meta["openai/widgetDescription"], /never book, purchase, or cancel/i);
  assert.deepEqual(resource._meta.ui.csp, {
    connectDomains: [],
    resourceDomains: [],
    frameDomains: ["https://www.google.com"],
  });
});

test("injects the Maps Embed key only when serving the itinerary resource", () => {
  const [withoutKey] = itineraryResource("https://sendero.example").contents;
  const [withKey] = itineraryResource(
    "https://sendero.example",
    ITINERARY_UI_URI,
    { mapsEmbedApiKey: 'test-key-<not-real>&"' },
  ).contents;

  assert.doesNotMatch(withoutKey.text, /<meta name="sendero-google-maps-embed-key"/);
  assert.match(withKey.text, /<meta name="sendero-google-maps-embed-key"/);
  assert.match(withKey.text, /test-key-&lt;not-real&gt;&amp;&quot;/);
  assert.doesNotMatch(withKey.text, /test-key-<not-real>/);
});
