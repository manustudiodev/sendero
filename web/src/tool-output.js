export function normalizeToolOutput(value) {
  if (!value || typeof value !== "object") return value ?? null;
  return "structuredContent" in value ? value.structuredContent : value;
}

export function initialToolOutput(openai) {
  return normalizeToolOutput(openai?.toolOutput);
}
