import assert from "node:assert/strict";
import test from "node:test";

test("inherits ChatGPT theme and responds to live host theme changes", async () => {
  const listeners = new Map();
  const animationFrames = [];
  const documentElement = { dataset: {} };
  const root = {
    scrollHeight: 100,
    getBoundingClientRect: () => ({ width: 600, height: 100 }),
  };

  globalThis.document = {
    documentElement,
    readyState: "complete",
    getElementById: (id) => (id === "root" ? root : null),
  };
  globalThis.window = {
    openai: { theme: "dark", notifyIntrinsicHeight() {} },
    parent: { postMessage() {} },
    addEventListener(name, listener) {
      const current = listeners.get(name) || [];
      current.push(listener);
      listeners.set(name, current);
    },
    cancelAnimationFrame() {},
    requestAnimationFrame(callback) {
      animationFrames.push(callback);
      return animationFrames.length;
    },
    matchMedia: () => ({ matches: false }),
  };

  await import(`./src/bridge.js?theme-test=${Date.now()}`);
  assert.equal(documentElement.dataset.theme, "dark");

  for (const listener of listeners.get("openai:set_globals") || []) {
    listener({ detail: { globals: { theme: "light" } } });
  }
  assert.equal(documentElement.dataset.theme, "light");

  for (const listener of listeners.get("openai:set_globals") || []) {
    listener({ detail: { globals: {} } });
  }
  assert.equal(documentElement.dataset.theme, "light");

  for (const listener of listeners.get("openai:set_globals") || []) {
    listener({ detail: { globals: { theme: "sepia" } } });
  }
  assert.equal(documentElement.dataset.theme, "light");

  delete globalThis.document;
  delete globalThis.window;
});

test("falls back to the operating-system theme when the host has no theme", async () => {
  const documentElement = { dataset: {} };
  const root = {
    scrollHeight: 100,
    getBoundingClientRect: () => ({ width: 600, height: 100 }),
  };

  globalThis.document = {
    documentElement,
    readyState: "complete",
    getElementById: (id) => (id === "root" ? root : null),
  };
  globalThis.window = {
    openai: { notifyIntrinsicHeight() {} },
    parent: { postMessage() {} },
    addEventListener() {},
    cancelAnimationFrame() {},
    requestAnimationFrame() { return 1; },
    matchMedia: () => ({ matches: true }),
  };

  await import(`./src/bridge.js?theme-fallback-test=${Date.now()}`);
  assert.equal(documentElement.dataset.theme, "dark");

  delete globalThis.document;
  delete globalThis.window;
});
