import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const tripListUrl = new URL("./src/trips/TripListApp.jsx", import.meta.url);

test("opens a selected trip directly and renders it without a model continuation", async () => {
  const source = await readFile(tripListUrl, "utf8");
  const directOpenStart = source.indexOf('if (purpose === "open")');
  const conversationalContinuationStart = source.indexOf(
    "const continuation = tripSelectionContinuation",
    directOpenStart,
  );

  assert.ok(directOpenStart >= 0, "the open-purpose branch must be explicit");
  assert.ok(
    conversationalContinuationStart > directOpenStart,
    "the direct open branch must finish before conversational purposes continue",
  );

  const directOpenBranch = source.slice(directOpenStart, conversationalContinuationStart);
  assert.match(directOpenBranch, /callTool\("open_trip", \{ tripId: trip\.id \}\)/);
  assert.match(directOpenBranch, /opened\?\.state !== "opened"/);
  assert.match(directOpenBranch, /opened\.tripId !== trip\.id/);
  assert.match(directOpenBranch, /!opened\.itinerary/);
  assert.doesNotMatch(directOpenBranch, /sendFollowUpMessage|updateModelContext/);

  assert.match(source, /<ItineraryApp initialOutput=\{openedTrip\}/);
  assert.match(source, /opening: "Abriendo el viaje…"/);
  assert.match(source, /message: purpose === "open" \? strings\.opening : strings\.continuing/);
  assert.match(source, /status\.state === "error"[\s\S]*strings\.retry/);
});

test("keeps adjust and refresh selections conversational", async () => {
  const source = await readFile(tripListUrl, "utf8");
  const directOpenStart = source.indexOf('if (purpose === "open")');
  const conversationalContinuationStart = source.indexOf(
    "const continuation = tripSelectionContinuation",
    directOpenStart,
  );
  const conversationalBranch = source.slice(conversationalContinuationStart);

  assert.match(conversationalBranch, /updateModelContext\(continuation\.context\)/);
  assert.match(conversationalBranch, /sendFollowUpMessage\(continuation\.visibleMessage\)/);
});

test("distinguishes an unavailable requested trip from an empty library", async () => {
  const source = await readFile(tripListUrl, "utf8");
  const unavailableStart = source.indexOf('if (purpose === "open" && currentOutput?.state === "not_found")');
  const emptyLibraryStart = source.indexOf("if (!trips.length)", unavailableStart);

  assert.ok(unavailableStart >= 0, "the initial open_trip not-found state must be explicit");
  assert.ok(
    emptyLibraryStart > unavailableStart,
    "the requested-trip recovery must render before the generic empty-library state",
  );

  const unavailableBranch = source.slice(unavailableStart, emptyLibraryStart);
  assert.match(source, /notFoundTitle: "No encontramos ese viaje"/);
  assert.match(source, /missingTrip: "No encontramos ese viaje\. Puede que se haya eliminado o que ya no tengas acceso\."/);
  assert.match(unavailableBranch, /onClick=\{viewSavedTrips\}[\s\S]*strings\.viewTrips/);
  assert.doesNotMatch(unavailableBranch, /strings\.emptyTitle/);
});

test("recovers by loading saved trips directly without a model continuation", async () => {
  const source = await readFile(tripListUrl, "utf8");
  const recoveryStart = source.indexOf("async function viewSavedTrips()");
  const createTripStart = source.indexOf("async function createTrip()", recoveryStart);

  assert.ok(recoveryStart >= 0, "the unavailable-trip state needs a recovery action");
  const recovery = source.slice(recoveryStart, createTripStart);
  assert.match(source, /searching: "Buscando tus viajes…"/);
  assert.match(recovery, /state: "loading", message: strings\.searching/);
  assert.match(recovery, /callTool\("list_itineraries", \{ purpose: "open" \}\)/);
  assert.match(recovery, /setListedOutput\(\{ \.\.\.listed, purpose: "open" \}\)/);
  assert.match(source, /listFailed: "No pudimos cargar tus viajes\. Inténtalo de nuevo\."/);
  assert.match(recovery, /message: strings\.listFailed/);
  assert.doesNotMatch(recovery, /sendFollowUpMessage|updateModelContext/);
  assert.doesNotMatch(recovery, /callTool\("(?:save|update|delete|publish)/);
});
