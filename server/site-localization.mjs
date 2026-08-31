import { localizedCanonicalPath, landingStructuredData, pageMetadata } from "../shared/site-metadata.mjs";
import { SUPPORTED_UI_LANGUAGES, uiLanguage } from "../shared/ui-locale.mjs";

function escapeAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function replaceMeta(html, attribute, name, content) {
  const pattern = new RegExp(`<meta ${attribute}="${name}" content="[^"]*" \\/>`);
  return html.replace(pattern, `<meta ${attribute}="${name}" content="${escapeAttribute(content)}" />`);
}

function absoluteUrl(publicWebUrl, path) {
  if (!publicWebUrl) return "";
  try {
    return new URL(path, `${publicWebUrl.replace(/\/$/, "")}/`).href;
  } catch {
    return "";
  }
}

export function localizePageHtml(html, { locale, page, publicWebUrl = "" }) {
  const language = uiLanguage(locale);
  const metadata = pageMetadata(page, language);
  const development = html.includes('name="sendero-environment" content="development"');
  const title = development ? `${metadata.title} · Dev` : metadata.title;
  let localized = html
    .replace(/(<html\b[^>]*\blang=")[^"]*(")/, `$1${escapeAttribute(locale)}$2`)
    .replace(/<title>[^<]*<\/title>/, `<title>${escapeAttribute(title)}</title>`);
  localized = replaceMeta(localized, "name", "description", metadata.description);
  localized = replaceMeta(localized, "property", "og:title", title);
  localized = replaceMeta(localized, "property", "og:description", metadata.description);

  const canonicalPath = localizedCanonicalPath(page, language);
  if (canonicalPath) {
    const canonical = absoluteUrl(publicWebUrl, canonicalPath);
    if (canonical) {
      const canonicalTag = `<link rel="canonical" href="${escapeAttribute(canonical)}" />`;
      localized = /<link rel="canonical"/.test(localized)
        ? localized.replace(/<link rel="canonical" href="[^"]*" \/>/, canonicalTag)
        : localized.replace("</head>", `    ${canonicalTag}\n  </head>`);
      localized = /<meta property="og:url"/.test(localized)
        ? replaceMeta(localized, "property", "og:url", canonical)
        : localized.replace("</head>", `    <meta property="og:url" content="${escapeAttribute(canonical)}" />\n  </head>`);
      const alternates = [
        ...SUPPORTED_UI_LANGUAGES.map((alternate) => `<link rel="alternate" hreflang="${alternate}" href="${escapeAttribute(absoluteUrl(publicWebUrl, localizedCanonicalPath(page, alternate)))}" />`),
        `<link rel="alternate" hreflang="x-default" href="${escapeAttribute(absoluteUrl(publicWebUrl, localizedCanonicalPath(page, "es")))}" />`,
      ].join("\n    ");
      localized = localized.replace("</head>", `    ${alternates}\n  </head>`);
    }
  }

  if (page === "landing") {
    const structured = JSON.stringify(landingStructuredData(language)).replaceAll("<", "\\u003c");
    localized = localized.replace(
      /<script type="application\/ld\+json">[\s\S]*?<\/script>/,
      `<script type="application/ld+json">${structured}</script>`,
    );
  }

  return localized.replace(
    "</head>",
    `    <meta name="sendero-initial-locale" content="${escapeAttribute(locale)}" />\n  </head>`,
  );
}
