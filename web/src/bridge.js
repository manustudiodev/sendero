import { useCallback, useEffect, useState } from "react";
import { initialToolOutput, normalizeToolOutput } from "./tool-output.js";

const pendingRequests = new Map();
let nextRequestId = 1;
let resizeAnimationFrame = 0;
let resizeObserver;
let lastReportedHeight = 0;
let lastReportedWidth = 0;
let resizeReportGeneration = 0;

function normalizedTheme(value) {
  return value === "dark" || value === "light" ? value : "";
}

function fallbackTheme() {
  if (typeof window.matchMedia !== "function") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyHostTheme(value) {
  const theme = normalizedTheme(value) || fallbackTheme();
  if (!document.documentElement) return;
  document.documentElement.dataset.theme = theme;
}

function installThemeSync() {
  applyHostTheme(window.openai?.theme);
  window.addEventListener("openai:set_globals", (event) => {
    const theme = normalizedTheme(event.detail?.globals?.theme);
    if (theme) applyHostTheme(theme);
  }, { passive: true });
}

function postSizeChanged(width, height) {
  window.parent.postMessage({
    jsonrpc: "2.0",
    method: "ui/notifications/size-changed",
    params: { width, height },
  }, "*");
}

function reportIntrinsicHeight() {
  resizeAnimationFrame = 0;
  const root = document.getElementById("root");
  if (!root) return;
  const bounds = root.getBoundingClientRect();
  const width = Math.ceil(bounds.width);
  const height = Math.ceil(Math.max(root.scrollHeight, bounds.height));
  if (width <= 0 || height <= 0 || height === lastReportedHeight) return;
  lastReportedWidth = width;
  lastReportedHeight = height;
  const generation = ++resizeReportGeneration;

  if (window.openai?.notifyIntrinsicHeight) {
    try {
      const result = window.openai.notifyIntrinsicHeight(height);
      if (result?.catch) {
        result.catch(() => {
          if (generation === resizeReportGeneration && height === lastReportedHeight) {
            postSizeChanged(lastReportedWidth, lastReportedHeight);
          }
        });
      }
      return;
    } catch {
      // Fall through to the portable MCP Apps notification.
    }
  }
  postSizeChanged(width, height);
}

function scheduleIntrinsicHeight() {
  if (resizeAnimationFrame) return;
  resizeAnimationFrame = window.requestAnimationFrame(reportIntrinsicHeight);
}

function installIntrinsicHeightSync() {
  const start = () => {
    const root = document.getElementById("root");
    if (!root || resizeObserver) return;
    if (typeof ResizeObserver === "function") {
      resizeObserver = new ResizeObserver(scheduleIntrinsicHeight);
      resizeObserver.observe(root);
    }
    scheduleIntrinsicHeight();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
  window.addEventListener("load", scheduleIntrinsicHeight, { once: true, passive: true });
}

function currentToolOutput() {
  return initialToolOutput(window.openai);
}

function handleBridgeResponse(event) {
  if (event.source !== window.parent) return;
  const message = event.data;
  if (!message || message.jsonrpc !== "2.0" || message.id === undefined) return;
  const pending = pendingRequests.get(message.id);
  if (!pending) return;
  pendingRequests.delete(message.id);
  clearTimeout(pending.timeout);
  if (message.error) pending.reject(message.error);
  else pending.resolve(message.result);
}

window.addEventListener("message", handleBridgeResponse, { passive: true });
installThemeSync();
installIntrinsicHeightSync();

function request(method, params, timeoutMs = 8000) {
  const id = nextRequestId++;
  window.parent.postMessage({ jsonrpc: "2.0", id, method, params }, "*");
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error("Sendero no recibió respuesta de ChatGPT."));
    }, timeoutMs);
    pendingRequests.set(id, { resolve, reject, timeout });
  });
}

export function useToolOutput() {
  const [output, setOutput] = useState(() => currentToolOutput());

  const refresh = useCallback(() => {
    const next = currentToolOutput();
    if (next) setOutput(next);
    return next;
  }, []);

  useEffect(() => {
    const onMessage = (event) => {
      if (event.source !== window.parent) return;
      const message = event.data;
      if (!message || message.jsonrpc !== "2.0") return;
      if (message.method === "ui/notifications/tool-result") {
        setOutput(normalizeToolOutput(message.params?.structuredContent));
      }
    };
    const onGlobals = (event) => {
      const next = normalizeToolOutput(event.detail?.globals?.toolOutput);
      if (next) setOutput(next);
    };

    window.addEventListener("message", onMessage, { passive: true });
    window.addEventListener("openai:set_globals", onGlobals, { passive: true });
    refresh();
    return () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener("openai:set_globals", onGlobals);
    };
  }, [refresh]);

  return { output, refresh };
}

export function widgetState() {
  return window.openai?.widgetState ?? {};
}

export function setWidgetState(state) {
  return window.openai?.setWidgetState?.(state);
}

export async function sendFollowUpMessage(prompt) {
  if (window.openai?.sendFollowUpMessage) {
    return window.openai.sendFollowUpMessage({ prompt, scrollToBottom: true });
  }
  return request("ui/message", {
    role: "user",
    content: { type: "text", text: prompt },
  });
}

export async function updateModelContext({ content, structuredContent }) {
  const params = {
    ...(content ? { content } : {}),
    ...(structuredContent ? { structuredContent } : {}),
  };
  if (window.openai?.updateModelContext) {
    return window.openai.updateModelContext(params);
  }
  return request("ui/update-model-context", params, 4000);
}

export async function callTool(name, args) {
  if (window.openai?.callTool) return window.openai.callTool(name, args);
  return request("tools/call", { name, arguments: args });
}

export async function openExternal(href) {
  if (window.openai?.openExternal) return window.openai.openExternal({ href });
  window.open(href, "_blank", "noopener,noreferrer");
}
