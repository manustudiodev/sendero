import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  createStableOperationRegistry,
  loginUrl,
  normalizeTripAccess,
  normalizeRestrictedTrip,
  normalizeSession,
  normalizeTrips,
  safeReturnTo,
} from "./src/account/web-client.js";

test("account contracts do not expose internal ids as web links", () => {
  assert.deepEqual(normalizeTrips({ trips: [
    { id: "convex-secret", title: "Internal only" },
    { webId: "sunlit-path", title: "Lisboa local", role: "editor" },
  ] }), [{
    destination: "",
    endDate: "",
    locale: "en",
    role: "editor",
    startDate: "",
    title: "Lisboa local",
    updatedAt: "",
    webId: "sunlit-path",
  }]);
});

test("session and login return paths fail closed", () => {
  assert.equal(normalizeSession({ authenticated: false }).authenticated, false);
  assert.equal(safeReturnTo("https://attacker.example"), "/app");
  assert.equal(safeReturnTo("//attacker.example"), "/app");
  assert.equal(loginUrl({}, "/app/trips/safe"), "/auth/login?returnTo=%2Fapp%2Ftrips%2Fsafe");
  assert.equal(
    loginUrl({ loginUrl: "/auth/login" }, "/app/trips/exact-web-id"),
    "/auth/login?returnTo=%2Fapp%2Ftrips%2Fexact-web-id",
  );
  assert.equal(
    loginUrl({ loginUrl: "/auth/login?connection=sendero" }, "/app/trips/exact-web-id"),
    "/auth/login?connection=sendero&returnTo=%2Fapp%2Ftrips%2Fexact-web-id",
  );
});

test("restricted trip permissions are role-bounded by default", () => {
  const viewer = normalizeRestrictedTrip({ webId: "trip", role: "viewer", itinerary: { days: [] } });
  const owner = normalizeRestrictedTrip({ webId: "trip", role: "owner", itinerary: { days: [] } });
  assert.equal(viewer.permissions.manageAccess, false);
  assert.equal(viewer.permissions.updateReservationStatus, false);
  assert.equal(owner.permissions.manageAccess, true);
  assert.equal(owner.permissions.updateReservationStatus, true);
});

test("explicit restricted-trip permissions are authoritative over role defaults", () => {
  const owner = normalizeRestrictedTrip({
    webId: "trip",
    role: "owner",
    itinerary: { days: [] },
    permissions: {
      editInSendero: false,
      manageAccess: false,
      publish: false,
      updateReservationStatus: false,
      view: false,
    },
  });
  assert.deepEqual(owner.permissions, {
    editInSendero: false,
    manageAccess: false,
    publish: false,
    updateReservationStatus: false,
    view: false,
  });
});

test("operation retries reuse their id and expected version until completion", () => {
  let sequence = 0;
  const registry = createStableOperationRegistry({
    createId: (prefix) => `${prefix}-${++sequence}`,
  });
  const first = registry.begin("trip:4:day:activity:confirmed", 4, "reservation");
  const retry = registry.begin("trip:4:day:activity:confirmed", 99, "reservation");
  assert.deepEqual(retry, first);
  assert.deepEqual(first, { expectedVersion: 4, operationId: "reservation-1" });

  registry.clear("trip:4:day:activity:confirmed");
  assert.deepEqual(
    registry.begin("trip:4:day:activity:confirmed", 5, "reservation"),
    { expectedVersion: 5, operationId: "reservation-2" },
  );
});

test("account page covers the authenticated state machine", () => {
  const source = readFileSync(new URL("./src/account/AccountApp.jsx", import.meta.url), "utf8");
  for (const state of ["loading", "signed_out", "empty", "error", "ready"]) {
    assert.match(source, new RegExp(`[\"']${state}[\"']`));
  }
  assert.match(source, /\/api\/session/);
  assert.match(source, /\/api\/trips/);
});

test("authenticated page frame exposes safe account switching and logout", () => {
  const source = readFileSync(new URL("./src/account/PageFrame.jsx", import.meta.url), "utf8");
  assert.match(source, /\/auth\/logout/);
  assert.match(source, /"X-CSRF-Token": csrfToken/);
  assert.match(source, /Cambiar cuenta/);
  assert.match(source, /Cerrar sesión/);
  assert.match(source, /No pudimos cerrar la sesión/);
});

test("access normalization preserves invitation state, expiration, and delivery", () => {
  const access = normalizeTripAccess({
    generalAccess: { mode: "public_link" },
    linkRecoverable: true,
    shareUrl: "https://sendero.example/share#AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    invitations: [{
      delivery: {
        attemptCount: 2,
        lastErrorCode: "provider_timeout",
        maxAttempts: 5,
        providerEvent: "delayed",
        status: "retry_scheduled",
        updatedAt: 1788187200000,
      },
      email: "friend@example.com",
      expiresAt: "2026-09-03T12:00:00.000Z",
      id: "invite-1",
      role: "editor",
      status: "expired",
    }],
    legacyInvitations: [{
      email: "legacy@example.com",
      id: "collaborator-legacy-1",
      role: "viewer",
    }],
  });
  assert.equal(access.generalAccess, "public_link");
  assert.equal(access.linkRecoverable, true);
  assert.equal(
    access.shareUrl,
    "https://sendero.example/share#AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  );
  assert.equal(access.invitations[0].status, "expired");
  assert.equal(access.invitations[0].expiresAt, "2026-09-03T12:00:00.000Z");
  assert.deepEqual(access.invitations[0].delivery, {
    attemptCount: 2,
    lastErrorCode: "provider_timeout",
    maxAttempts: 5,
    providerEvent: "delayed",
    status: "retry_scheduled",
    updatedAt: 1788187200000,
  });
  assert.deepEqual(access.legacyInvitations, [{
    id: "collaborator-legacy-1",
    email: "legacy@example.com",
    expiresAt: "",
    kind: "legacy_invitation",
    name: "",
    role: "viewer",
    status: "legacy_pending",
  }]);
  assert.equal(access.members.length, 0);
});
