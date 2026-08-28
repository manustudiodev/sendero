import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  formatInvitationExpiry,
  invitationWebId,
  inviteTokenFromHash,
  normalizeInvitationInspection,
  urlWithoutFragment,
} from "./src/invite/invitation.js";

test("invitation token is read only from a valid fragment", () => {
  const token = "a_secure_invitation_token.1234567890";
  assert.equal(inviteTokenFromHash(`#token=${token}`), token);
  assert.equal(inviteTokenFromHash("#token=short"), "");
  assert.equal(invitationWebId({ pathname: "/invite/trip_web_1234567890" }), "trip_web_1234567890");
  assert.equal(urlWithoutFragment({ pathname: "/invite/trip", search: "?source=email" }), "/invite/trip?source=email");
});

test("invitation states are normalized without retaining its secret", () => {
  const inspection = normalizeInvitationInspection({ data: { state: "ready", invitation: { title: "Viaje", role: "editor", webId: "public-ref", token: "must-not-survive" } } });
  assert.equal(inspection.state, "ready");
  assert.equal(inspection.invitation.role, "editor");
  assert.equal(inspection.invitation.webId, "public-ref");
  assert.equal("token" in inspection.invitation, false);
});

test("invitation expiry has a readable fallback", () => {
  assert.equal(formatInvitationExpiry(""), "Date unavailable");
  assert.equal(formatInvitationExpiry("not-a-date"), "Date unavailable");
  assert.match(formatInvitationExpiry("2026-09-03T12:00:00.000Z", "es"), /2026/);
});

test("invite UI clears the fragment before inspecting and replaces choices with a receipt", () => {
  const source = readFileSync(new URL("./src/invite/InviteApp.jsx", import.meta.url), "utf8");
  const clearAt = source.indexOf("history.replaceState");
  const inspectAt = source.indexOf('requestJson("/api/invitations/inspect"');
  assert.ok(clearAt >= 0 && clearAt < inspectAt);
  assert.match(source, /actionStarted\.current/);
  assert.match(source, /kind:\s*"receipt"/);
  assert.match(source, /result\.status !== decision/);
  assert.match(source, /invitation_unavailable/);
  assert.match(source, /\/api\/invitations\/\$\{decision === "accepted" \? "accept" : "decline"\}/);
  assert.match(source, /Usar otra cuenta/);
  assert.match(source, /Invitado por/);
  assert.match(source, /Válida hasta/);
  assert.match(source, /endSenderoSession/);
  assert.match(source, /reauthenticate:\s*true/);
  assert.doesNotMatch(source, /window\.location\.reload\(\)/);
});
