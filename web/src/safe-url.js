export function safeExternalUrl(href) {
  try {
    const parsed = new URL(href);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : "";
  } catch {
    return "";
  }
}
