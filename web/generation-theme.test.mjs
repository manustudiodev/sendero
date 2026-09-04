import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("bridges shared trip customization controls to the authenticated page theme", async () => {
  const source = await readFile(new URL("./src/generate/GenerateTripApp.jsx", import.meta.url), "utf8");
  const bridge = source.match(
    /\.generate-form > \.profile-editor, \.generate-form > \.budget-editor \{(?<body>[\s\S]*?)\n\}/,
  );

  assert.ok(bridge, "expected a scoped theme bridge for shared profile and budget controls");
  assert.match(bridge.groups.body, /--ink: var\(--web-ink\);/);
  assert.match(bridge.groups.body, /--muted: var\(--web-muted\);/);
  assert.match(bridge.groups.body, /--line: var\(--web-line\);/);
  assert.match(bridge.groups.body, /--surface: var\(--web-surface\);/);
  assert.match(bridge.groups.body, /--focus-border: var\(--web-forest\);/);
  assert.match(bridge.groups.body, /color: var\(--web-ink\);/);
});

test("bridges the itinerary preview to the authenticated page theme", async () => {
  const source = await readFile(new URL("./src/generate/GenerateTripApp.jsx", import.meta.url), "utf8");
  const bridge = source.match(
    /\.generate-preview \.itinerary-viewer \{(?<body>[\s\S]*?)\n\}/,
  );

  assert.ok(bridge, "expected a scoped theme bridge for the itinerary preview");
  assert.match(bridge.groups.body, /--ink: var\(--web-ink\);/);
  assert.match(bridge.groups.body, /--muted: var\(--web-muted\);/);
  assert.match(bridge.groups.body, /--line: var\(--web-line\);/);
  assert.match(bridge.groups.body, /--surface: var\(--web-surface\);/);
  assert.match(bridge.groups.body, /background: var\(--surface\);/);
  assert.match(bridge.groups.body, /color: var\(--ink\);/);
});
