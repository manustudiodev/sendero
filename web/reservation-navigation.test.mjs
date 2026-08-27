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

test("reservation provider and status actions share one responsive row", async () => {
  const styles = await readFile(stylesUrl, "utf8");

  assert.match(styles, /\.reservation-actions \{[^}]*display: flex;[^}]*flex-wrap: nowrap;[^}]*align-items: center;/);
  assert.match(styles, /\.reservation-provider-row, \.reservation-status-row \{[^}]*display: inline-flex;[^}]*flex: 0 1 auto;/);
  assert.match(styles, /\.reservation-controls \{[^}]*display: inline-flex;[^}]*width: auto;/);
  assert.doesNotMatch(styles, /\.reservation-provider-row, \.reservation-status-row \{[^}]*width: 100%;/);
});
