import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const stylesUrl = new URL("./src/styles.css", import.meta.url);
const disclosureUrl = new URL("./src/DisclosurePanel.jsx", import.meta.url);
const itineraryUrl = new URL("./src/itinerary/ItineraryViewer.jsx", import.meta.url);

test("disclosures animate open and closed without leaving hidden controls interactive", async () => {
  const [styles, disclosure, itinerary] = await Promise.all([
    readFile(stylesUrl, "utf8"),
    readFile(disclosureUrl, "utf8"),
    readFile(itineraryUrl, "utf8"),
  ]);

  assert.match(styles, /\.disclosure-panel\s*\{[\s\S]*grid-template-rows:\s*0fr/);
  assert.match(styles, /\.disclosure-panel\.is-open\s*\{\s*grid-template-rows:\s*1fr/);
  assert.match(styles, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*\.disclosure-panel/);
  assert.match(disclosure, /aria-hidden=!\{?open\}?|aria-hidden=\{!open\}/);
  assert.match(disclosure, /inert=\{open \? undefined : ""\}/);
  assert.match(itinerary, /className="disclosure-toggle day-toggle"/);
  assert.match(itinerary, /className="calendar-toggle disclosure-toggle"/);
  assert.doesNotMatch(itinerary, /\{open \? "−" : "\+"\}/);
});

test("the embedded widget clips its own vertical overflow while ChatGPT resizes it", async () => {
  const styles = await readFile(stylesUrl, "utf8");
  assert.match(styles, /html\.widget-document body\s*\{?[\s\S]*overflow-y:\s*clip/);
});

test("the embedded route map clears its fallback timer after a successful load", async () => {
  const [styles, itinerary] = await Promise.all([
    readFile(stylesUrl, "utf8"),
    readFile(itineraryUrl, "utf8"),
  ]);

  assert.match(itinerary, /timeoutRef\.current = window\.setTimeout/);
  assert.match(itinerary, /function finish\(nextState\)\s*\{[\s\S]*window\.clearTimeout\(timeoutRef\.current\)/);
  assert.match(itinerary, /onLoad=\{\(\) => finish\("ready"\)\}/);
  assert.match(styles, /\.route-map-embed\s*\{[\s\S]*min-height:\s*260px/);
  assert.match(styles, /\.route-map-embed-ready iframe\s*\{\s*opacity:\s*1/);
});
