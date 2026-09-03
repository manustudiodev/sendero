import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const viewerUrl = new URL("./src/itinerary/ItineraryViewer.jsx", import.meta.url);
const appUrl = new URL("./src/itinerary/ItineraryApp.jsx", import.meta.url);
const stylesUrl = new URL("./src/styles.css", import.meta.url);

test("the itinerary exposes only a contextual ticket icon for reservation management", async () => {
  const viewer = await readFile(viewerUrl, "utf8");
  const activitySource = viewer.slice(
    viewer.indexOf("function Activity("),
    viewer.indexOf("function DayContext("),
  );

  assert.match(activitySource, /className="activity-title-row"/);
  assert.match(activitySource, /className="activity-reservation-link"/);
  assert.match(activitySource, /onReservationOpen\(\{ activityId: activity\.id, dayDate \}\)/);
  assert.doesNotMatch(activitySource, /reservation-requirement/);
  assert.doesNotMatch(activitySource, /reservation-status/);
});

test("reservation navigation persists the exact target and focuses its authoritative card", async () => {
  const [viewer, app] = await Promise.all([
    readFile(viewerUrl, "utf8"),
    readFile(appUrl, "utf8"),
  ]);

  assert.match(app, /persistWidgetState\(\{ activeView: "reservations", selectedReservationKey: nextKey \}\)/);
  assert.match(viewer, /data-reservation-key=\{entryKey\}/);
  assert.match(viewer, /target\.focus\(\{ preventScroll: true \}\)/);
  assert.match(viewer, /target\.scrollIntoView/);
  assert.match(viewer, /className=\{`reservation-card \$\{isTargeted \? "is-targeted" : ""\}`\}/);
});

test("reservation provider and the authenticated or sign-in status action use separate rows", async () => {
  const [viewer, styles] = await Promise.all([
    readFile(viewerUrl, "utf8"),
    readFile(stylesUrl, "utf8"),
  ]);

  assert.match(styles, /\.reservation-actions \{[^}]*display: grid;[^}]*justify-items: start;[^}]*align-items: start;/);
  assert.match(styles, /\.reservation-provider-row, \.reservation-status-row \{[^}]*display: flex;[^}]*min-width: 0;/);
  assert.match(styles, /\.reservation-controls \{[^}]*display: inline-flex;[^}]*width: auto;/);
  assert.match(styles, /\.external-text-link \{[^}]*text-decoration: underline;/);
  assert.match(viewer, /variant="text"/);
  assert.match(viewer, /const action = presentation\.nextAction;/);
  assert.match(viewer, /const canUpdate = writable && typeof onStatusChange === "function"/);
  assert.match(viewer, /if \(canUpdate\) update\(action\.status\);/);
  assert.match(viewer, /else onAuthenticationRequired\(\{ activityId: entry\.activity\.id, dayDate: entry\.day\.date \}\)/);
  assert.match(viewer, /onAuthenticationRequired=\{onReservationAuthenticationRequired\}/);
  assert.doesNotMatch(viewer, /actions\.map/);
  assert.doesNotMatch(viewer, /aria-pressed=/);
});
