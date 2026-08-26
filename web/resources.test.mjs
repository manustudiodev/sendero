import assert from "node:assert/strict";
import test from "node:test";
import {
  ITINERARY_UI_URI,
  LEGACY_ITINERARY_V4_UI_URI,
  LEGACY_ITINERARY_V5_UI_URI,
  itineraryResource,
} from "../server/ui/resources.mjs";

test("pins itinerary v6 while keeping earlier component resources addressable", () => {
  assert.equal(ITINERARY_UI_URI, "ui://sendero/itinerary-v6.html");
  assert.equal(LEGACY_ITINERARY_V4_UI_URI, "ui://sendero/itinerary-v4.html");
  assert.equal(LEGACY_ITINERARY_V5_UI_URI, "ui://sendero/itinerary-v5.html");

  const current = itineraryResource("https://sendero.example");
  const legacy = itineraryResource("https://sendero.example", LEGACY_ITINERARY_V5_UI_URI);
  assert.equal(current.contents[0].uri, ITINERARY_UI_URI);
  assert.equal(legacy.contents[0].uri, LEGACY_ITINERARY_V5_UI_URI);
  assert.equal(legacy.contents[0].text, current.contents[0].text);
});

test("describes the complete itinerary surface without unnecessary external origins", () => {
  const [resource] = itineraryResource("https://sendero.example").contents;
  assert.match(resource._meta["openai/widgetDescription"], /calendar/i);
  assert.match(resource._meta["openai/widgetDescription"], /route map/i);
  assert.match(resource._meta["openai/widgetDescription"], /reservation tracker/i);
  assert.match(resource._meta["openai/widgetDescription"], /never book or cancel/i);
  assert.deepEqual(resource._meta.ui.csp, {
    connectDomains: [],
    resourceDomains: [],
  });
});
