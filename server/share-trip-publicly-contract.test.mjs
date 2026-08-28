import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { AUTH_SCOPES } from "./auth.mjs";
import {
  derivePublicShareToken,
  hashPublicShareToken,
} from "./public-sharing.mjs";
import { PUBLIC_SHARE_UI_URI, createTripPlannerServer } from "./server.mjs";
import { sanitizePublicSnapshot } from "../shared/public-snapshot.mjs";

const itinerary = {
  title: "Buenos Aires entre cafés y barrios",
  destination: "Buenos Aires, Argentina",
  startDate: "2026-08-13",
  endDate: "2026-08-13",
  lodging: {
    name: "Alojamiento",
    area: "Palermo",
    status: "area_only",
  },
  transport: {
    modes: ["walk", "public_transit", "taxi"],
    hasLicense: false,
    wantsCar: false,
  },
  days: [
    {
      date: "2026-08-13",
      title: "Centro histórico y café porteño",
      area: "Monserrat",
      activities: [
        {
          id: "plaza-de-mayo",
          startTime: "10:00",
          title: "Plaza de Mayo",
          location: {
            name: "Plaza de Mayo",
            address: "Plaza de Mayo, Buenos Aires, Argentina",
          },
        },
      ],
    },
  ],
};

async function connectedClient(options = {}) {
  const server = createTripPlannerServer(options);
  const client = new Client({ name: "sendero-direct-share-contract", version: "0.1.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return { client, server };
}

test("advertises one model-visible idempotent facade for an explicit public-share intent", async () => {
  const { client, server } = await connectedClient();
  const { tools } = await client.listTools();
  const direct = tools.find((tool) => tool.name === "share_trip_publicly");
  const preview = tools.find((tool) => tool.name === "preview_public_share");
  const reservation = tools.find((tool) => tool.name === "update_reservation_status");

  assert.ok(direct, "share_trip_publicly must be registered");
  assert.deepEqual(direct._meta.ui.visibility, ["model", "app"]);
  assert.equal(direct._meta.ui.resourceUri, PUBLIC_SHARE_UI_URI);
  assert.equal(direct._meta["openai/outputTemplate"], PUBLIC_SHARE_UI_URI);
  assert.deepEqual(direct._meta.securitySchemes, [
    { type: "oauth2", scopes: [AUTH_SCOPES.share] },
  ]);
  assert.deepEqual(direct.annotations, {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  });
  assert.deepEqual(Object.keys(direct.inputSchema.properties).sort(), [
    "endDate",
    "expiresInDays",
    "operationId",
    "query",
    "reference",
    "selector",
    "startDate",
    "tripId",
  ]);
  assert.equal(direct.inputSchema.required.includes("operationId"), true);
  assert.equal(direct.inputSchema.properties.operationId.maxLength, 128);
  assert.equal(direct.inputSchema.properties.operationId.pattern, "^[A-Za-z0-9._:-]+$");
  assert.deepEqual(direct.inputSchema.properties.selector.enum, ["latest_updated"]);
  assert.doesNotMatch(direct.description, /always use .*preview|wait for .*confirm/i);

  assert.ok(preview, "the opt-in preview remains available");
  assert.equal(preview.annotations.readOnlyHint, true);
  assert.equal(preview.annotations.destructiveHint, false);
  assert.match(preview.description, /(?:asks|request|inspect|review)/i);
  assert.doesNotMatch(preview.description, /always use this before/i);

  assert.ok(reservation, "the conversational reservation update remains available");
  assert.deepEqual(reservation._meta.ui.visibility, ["model", "app"]);
  assert.equal(reservation.annotations.readOnlyHint, false);
  assert.equal(reservation.annotations.idempotentHint, true);

  await client.close();
  await server.close();
});

test("publishes latest_updated directly with a public URL and final receipt, then replays safely", async () => {
  const calls = [];
  let publication;
  const publicItinerary = sanitizePublicSnapshot(itinerary);
  const summary = {
    title: itinerary.title,
    destination: itinerary.destination,
    startDate: itinerary.startDate,
    endDate: itinerary.endDate,
  };
  const sharing = () => ({
    status: publication ? "active" : "not_published",
    currentVersion: 3,
    ...(publication
      ? {
          publishedVersion: 3,
          publishedAt: publication.publishedAt,
          updatedAt: publication.publishedAt,
          expiresAt: publication.expiresAt,
          isStale: false,
          summary,
          tokenHash: publication.tokenHash,
          tokenDerivation: {
            purpose: "publish",
            operationId: publication.operationId,
          },
        }
      : { isStale: false }),
  });
  const persistence = {
    async open(reference) {
      calls.push(["open", structuredClone(reference)]);
      return {
        state: "opened",
        id: "trip_latest",
        version: 3,
        role: "owner",
        itinerary,
        revisions: [],
        trips: [],
      };
    },
    async publicPreview(tripId) {
      calls.push(["preview", tripId]);
      return { itinerary: publicItinerary, version: 3, sharing: sharing() };
    },
    async publicStatus(tripId) {
      calls.push(["status", tripId]);
      return sharing();
    },
    async publishPublic(input) {
      calls.push(["publish", structuredClone(input)]);
      publication ||= {
        operationId: input.operationId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
        publishedAt: 1_800_000_000_000,
      };
      assert.equal(input.operationId, publication.operationId);
      assert.equal(input.tokenHash, publication.tokenHash);
      return sharing();
    },
    async updatePublic(input) {
      calls.push(["update", structuredClone(input)]);
      return sharing();
    },
  };
  const { client, server } = await connectedClient({
    persistence,
    publicWebUrl: "https://sendero.example",
    publicShareSecret: "sendero-contract-secret-with-at-least-32-bytes",
    auth: {
      authenticated: true,
      scopes: [AUTH_SCOPES.read, AUTH_SCOPES.share],
      resourceMetadataUrl: "https://sendero.example/.well-known/oauth-protected-resource",
    },
  });
  const args = {
    selector: "latest_updated",
    expiresInDays: 14,
    operationId: "share-latest-updated-001",
  };

  const first = await client.callTool({ name: "share_trip_publicly", arguments: args });
  const replay = await client.callTool({ name: "share_trip_publicly", arguments: args });
  const later = await client.callTool({
    name: "share_trip_publicly",
    arguments: { ...args, operationId: "share-latest-updated-002" },
  });

  assert.equal(first.isError, undefined);
  assert.equal(first.structuredContent.state, "published");
  assert.equal(first.structuredContent.tripId, "trip_latest");
  assert.match(first.structuredContent.publicUrl, /^https:\/\/sendero\.example\/share#[A-Za-z0-9_-]{43}$/);
  assert.equal("operationId" in first.structuredContent, false);
  assert.equal(replay.structuredContent.publicUrl, first.structuredContent.publicUrl);
  assert.equal(later.structuredContent.publicUrl, first.structuredContent.publicUrl);
  assert.equal(replay.structuredContent.state, "active");
  assert.equal(later.structuredContent.state, "active");
  assert.equal("operationId" in replay.structuredContent, false);
  assert.ok(first.content.some((item) => item.type === "text" && item.text.includes(first.structuredContent.publicUrl)));
  assert.doesNotMatch(
    first.content.map((item) => item.text || "").join(" "),
    /preview|vista previa|confirma|operationId|share-latest-updated-001/i,
  );
  assert.deepEqual(
    calls.filter(([name]) => name === "open").map(([, reference]) => reference),
    [{ selector: "latest_updated" }, { selector: "latest_updated" }, { selector: "latest_updated" }],
  );
  assert.equal(calls.filter(([name]) => name === "publish").length, 1);
  assert.equal(calls.some(([name]) => name === "update"), false);

  await client.close();
  await server.close();
});

test("returns a concurrent winner without an unnecessary update", async () => {
  const calls = [];
  const publicItinerary = sanitizePublicSnapshot(itinerary);
  const secret = "sendero-contract-secret-with-at-least-32-bytes";
  const winnerOperationId = "sendero-share:publish:concurrent-winner-1";
  const winnerToken = derivePublicShareToken({
    secret,
    purpose: "publish",
    tripId: "trip_latest",
    operationId: winnerOperationId,
  });
  const winner = {
    status: "active",
    currentVersion: 3,
    publishedVersion: 3,
    isStale: false,
    publishedAt: 1_800_000_000_000,
    updatedAt: 1_800_000_000_000,
    expiresAt: 1_900_000_000_000,
    summary: {
      title: publicItinerary.title,
      destination: publicItinerary.destination,
      startDate: publicItinerary.startDate,
      endDate: publicItinerary.endDate,
    },
    tokenHash: hashPublicShareToken(winnerToken),
    tokenDerivation: {
      purpose: "publish",
      operationId: winnerOperationId,
    },
  };
  const persistence = {
    async open(reference) {
      calls.push(["open", reference]);
      return {
        state: "opened",
        id: "trip_latest",
        version: 3,
        role: "owner",
        itinerary,
        revisions: [],
        trips: [],
      };
    },
    async publicPreview(tripId) {
      calls.push(["preview", tripId]);
      return {
        itinerary: publicItinerary,
        version: 3,
        sharing: { status: "not_published", currentVersion: 3, isStale: false },
      };
    },
    async publicStatus(tripId) {
      calls.push(["status", tripId]);
      return winner;
    },
    async publishPublic(input) {
      calls.push(["publish", input]);
      throw new Error("This trip already has an active public link; update or rotate it instead");
    },
    async updatePublic(input) {
      calls.push(["update", input]);
      throw new Error("A current concurrent publication must not be updated");
    },
  };
  const { client, server } = await connectedClient({
    persistence,
    publicWebUrl: "https://sendero.example",
    publicShareSecret: secret,
    auth: {
      authenticated: true,
      scopes: [AUTH_SCOPES.read, AUTH_SCOPES.share],
      resourceMetadataUrl: "https://sendero.example/.well-known/oauth-protected-resource",
    },
  });

  const result = await client.callTool({
    name: "share_trip_publicly",
    arguments: {
      selector: "latest_updated",
      operationId: "share-concurrent-loser-001",
    },
  });
  assert.equal(result.isError, undefined);
  assert.equal(result.structuredContent.state, "active");
  assert.equal(
    result.structuredContent.publicUrl,
    `https://sendero.example/share#${winnerToken}`,
  );
  assert.equal(calls.filter(([name]) => name === "publish").length, 1);
  assert.equal(calls.filter(([name]) => name === "status").length, 1);
  assert.equal(calls.some(([name]) => name === "update"), false);

  await client.close();
  await server.close();
});
