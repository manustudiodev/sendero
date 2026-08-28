import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("keeps indirect trip-planning discovery metadata and golden prompts aligned", async () => {
  const [manifestText, skillText, skillInterfaceText, evalText] = await Promise.all([
    readFile(new URL("../.codex-plugin/plugin.json", import.meta.url), "utf8"),
    readFile(new URL("../skills/plan-local-trip/SKILL.md", import.meta.url), "utf8"),
    readFile(new URL("../skills/plan-local-trip/agents/openai.yaml", import.meta.url), "utf8"),
    readFile(new URL("../evals/tool-discovery.json", import.meta.url), "utf8"),
  ]);

  const manifest = JSON.parse(manifestText);
  const discovery = JSON.parse(evalText);
  const santiago = discovery.cases.find((entry) => /Santiago de Chile/.test(entry.prompt));

  assert.equal(santiago.expectedTool, "prepare_trip_brief");
  assert.equal(santiago.kind, "indirect");
  assert.ok(discovery.cases.some((entry) => entry.expectedTool === "open_trip"));
  assert.ok(discovery.cases.filter((entry) => entry.kind === "negative" && entry.expectedTool === null).length >= 3);
  assert.match(manifest.description, /aunque la persona no mencione Sendero/i);
  assert.ok(manifest.keywords.includes("itinerario"));
  assert.match(manifest.interface.longDescription, /even without naming Sendero/i);
  assert.match(skillText, /even when they do not mention Sendero/i);
  assert.match(skillText, /viajo a Santiago el mes que viene/i);
  assert.doesNotMatch(skillInterfaceText, /\$plan-local-trip/);
});
