import assert from "node:assert/strict";
import test from "node:test";

test("coalesces intrinsic height changes and never falls back to a stale size", async () => {
  const reportedHeights = [];
  const postedMessages = [];
  const animationFrames = [];
  const cancelledFrames = [];
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
    cancelAnimationFrame(frame) {
      cancelledFrames.push(frame);
    },
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
  onResize();
  assert.equal(animationFrames.length, 1);
  animationFrames.shift()();
  assert.deepEqual(reportedHeights, [489, 124]);
  assert.deepEqual(cancelledFrames, []);

  root.width = 980;
  onResize();
  animationFrames.shift()();
  assert.deepEqual(reportedHeights, [489, 124]);

  const rejections = [];
  window.openai.notifyIntrinsicHeight = (height) => {
    reportedHeights.push(height);
    return new Promise((resolve, reject) => rejections.push(reject));
  };
  root.height = 200;
  root.scrollHeight = 200;
  onResize();
  animationFrames.shift()();
  root.height = 220;
  root.scrollHeight = 220;
  onResize();
  animationFrames.shift()();
  rejections[0](new Error("stale"));
  await Promise.resolve();
  assert.deepEqual(postedMessages, []);
  rejections[1](new Error("current"));
  await Promise.resolve();
  assert.deepEqual(postedMessages, [{
    jsonrpc: "2.0",
    method: "ui/notifications/size-changed",
    params: { width: 980, height: 220 },
  }]);

  delete window.openai.notifyIntrinsicHeight;
  root.height = 160;
  root.scrollHeight = 160;
  onResize();
  animationFrames.shift()();
  assert.deepEqual(postedMessages, [
    {
      jsonrpc: "2.0",
      method: "ui/notifications/size-changed",
      params: { width: 980, height: 220 },
    },
    {
      jsonrpc: "2.0",
      method: "ui/notifications/size-changed",
      params: { width: 980, height: 160 },
    },
  ]);

  delete globalThis.ResizeObserver;
  delete globalThis.document;
  delete globalThis.window;
});
