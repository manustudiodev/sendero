import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "./app.mjs";
import { createConvexPersistence } from "./persistence.mjs";

test("reports whether Convex storage is configured", async () => {
  const configured = createApp({ convexUrl: "https://example.convex.cloud" });
  const configuredResponse = await configured.request("/health");
  assert.equal(configuredResponse.status, 200);
  assert.deepEqual(await configuredResponse.json(), {
    status: "ok",
    service: "sendero",
    storage: "configured",
  });

  const unconfigured = createApp({ convexUrl: "" });
  assert.equal((await (await unconfigured.request("/health")).json()).storage, "not_configured");
});

test("requires an authenticated token before reading Convex", async () => {
  const persistence = createConvexPersistence({
    convexUrl: "https://example.convex.cloud",
  });
  await assert.rejects(() => persistence.list(), /Sign in before accessing/);
});
