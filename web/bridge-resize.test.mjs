import assert from "node:assert/strict";
import test from "node:test";

test("reports every intrinsic widget height change to ChatGPT and the MCP Apps fallback", async () => {
  const reportedHeights = [];
  const postedMessages = [];
  const animationFrames = [];
  let onResize;
  const root = {
    width: 920,
    height: 489,
    scrollHeight: 489,
    getBoundingClientRect() {
      return { height: this.height, width: this.width };
    },
  };

  globalThis.document = {
    readyState: "complete",
    getElementById: (id) => (id === "root" ? root : null),
  };
  globalThis.ResizeObserver = class {
    constructor(callback) {
      onResize = callback;
    }
    observe() {}
  };
  globalThis.window = {
    openai: {
      notifyIntrinsicHeight: (height) => reportedHeights.push(height),
    },
    parent: {
      postMessage: (message) => postedMessages.push(message),
    },
    addEventListener() {},
    cancelAnimationFrame() {},
    requestAnimationFrame(callback) {
      animationFrames.push(callback);
      return animationFrames.length;
    },
  };

  await import(`./src/bridge.js?resize-test=${Date.now()}`);

  animationFrames.shift()();
  assert.deepEqual(reportedHeights, [489]);

  root.height = 123.2;
  root.scrollHeight = 124;
  onResize();
  animationFrames.shift()();
  assert.deepEqual(reportedHeights, [489, 124]);

  delete window.openai.notifyIntrinsicHeight;
  root.height = 160;
  root.scrollHeight = 160;
  onResize();
  animationFrames.shift()();
  assert.deepEqual(postedMessages, [{
    jsonrpc: "2.0",
    method: "ui/notifications/size-changed",
    params: { width: 920, height: 160 },
  }]);

  delete globalThis.ResizeObserver;
  delete globalThis.document;
  delete globalThis.window;
});
