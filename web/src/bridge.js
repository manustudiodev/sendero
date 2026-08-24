import { useCallback, useEffect, useState } from "react";
import { initialToolOutput, normalizeToolOutput } from "./tool-output.js";

const pendingRequests = new Map();
let nextRequestId = 1;

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
  window.openai?.setWidgetState?.(state);
}

export async function sendFollowUpMessage(prompt) {
  if (window.openai?.sendFollowUpMessage) {
    return window.openai.sendFollowUpMessage({ prompt, scrollToBottom: true });
  }
  return request("ui/message", {
    role: "user",
    content: [{ type: "text", text: prompt }],
  });
}

export async function callTool(name, args) {
  if (window.openai?.callTool) return window.openai.callTool(name, args);
  return request("tools/call", { name, arguments: args });
}

export async function openExternal(href) {
  if (window.openai?.openExternal) return window.openai.openExternal({ href });
  window.open(href, "_blank", "noopener,noreferrer");
}
