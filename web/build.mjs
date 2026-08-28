import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const webRoot = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(webRoot, "..");
const generatedPath = process.env.SENDERO_UI_OUTPUT_PATH
  ? resolve(process.env.SENDERO_UI_OUTPUT_PATH)
  : resolve(projectRoot, "server/ui/generated/widgets.mjs");
const styles = await readFile(resolve(webRoot, "src/styles.css"), "utf8");

const widgets = [
  { exportName: "itineraryWidgetHtml", entry: "src/itinerary/index.jsx", documentClass: "widget-document" },
  { exportName: "tripIntakeWidgetHtml", entry: "src/intake/index.jsx", documentClass: "widget-document" },
  { exportName: "tripListWidgetHtml", entry: "src/trips/index.jsx", documentClass: "widget-document" },
  { exportName: "tripRequirementsWidgetHtml", entry: "src/requirements/index.jsx", documentClass: "widget-document" },
  { exportName: "publicShareControlWidgetHtml", entry: "src/share-control/index.jsx", documentClass: "widget-document" },
];

const publicWebUrl = normalizedBaseUrl(process.env.PUBLIC_WEB_URL);
const chatGptUrl = normalizedHttpsUrl(process.env.SENDERO_CHATGPT_URL) || "https://chatgpt.com/";

const pages = [
  {
    exportName: "publicSharePageHtml",
    entry: "src/share/index.jsx",
    metadata: {
      description: "Consulta un itinerario compartido de Sendero.",
      robots: "noindex,nofollow,noarchive",
      title: "Viaje compartido · Sendero",
    },
  },
  {
    exportName: "landingPageHtml",
    entry: "src/landing/index.jsx",
    documentClass: "site-document",
    metadata: {
      canonicalPath: "/",
      description: "Sendero convierte una conversación en un itinerario real, con contexto local, rutas, reservas y una vista lista para compartir.",
      jsonLd: {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "WebSite",
            name: "Sendero",
            description: "Planificación de viajes conversacional con itinerarios visuales para compartir.",
          },
          {
            "@type": "SoftwareApplication",
            name: "Sendero",
            applicationCategory: "TravelApplication",
            operatingSystem: "Web, ChatGPT",
            description: "Crea y ajusta viajes conversando; compártelos como itinerarios visuales.",
          },
        ],
      },
      title: "Sendero · Planifica conversando",
    },
  },
  {
    exportName: "privacyPageHtml",
    entry: "src/legal/privacy.jsx",
    documentClass: "site-document",
    metadata: {
      canonicalPath: "/privacy",
      description: "Cómo Sendero trata la información de cuentas, viajes y enlaces compartidos.",
      title: "Privacidad · Sendero",
    },
  },
  {
    exportName: "termsPageHtml",
    entry: "src/legal/terms.jsx",
    documentClass: "site-document",
    metadata: {
      canonicalPath: "/terms",
      description: "Condiciones de uso de Sendero.",
      title: "Términos · Sendero",
    },
  },
  {
    exportName: "accountPageHtml",
    entry: "src/account/index.jsx",
    documentClass: "web-document",
    metadata: {
      description: "Consulta los viajes propios y compartidos contigo en Sendero.",
      robots: "noindex,nofollow,noarchive",
      title: "Tus viajes · Sendero",
    },
  },
  {
    exportName: "invitePageHtml",
    entry: "src/invite/index.jsx",
    documentClass: "web-document",
    metadata: {
      description: "Revisa una invitación privada a un viaje de Sendero.",
      robots: "noindex,nofollow,noarchive",
      title: "Invitación · Sendero",
    },
  },
  {
    exportName: "restrictedTripPageHtml",
    entry: "src/restricted/index.jsx",
    documentClass: "web-document",
    metadata: {
      description: "Consulta un itinerario privado compartido contigo en Sendero.",
      robots: "noindex,nofollow,noarchive",
      title: "Itinerario privado · Sendero",
    },
  },
];

function normalizedBaseUrl(value) {
  const url = normalizedHttpsUrl(value);
  return url ? url.replace(/\/$/, "") : "";
}

function normalizedHttpsUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function pageHead(metadata = {}) {
  const title = metadata.title || "Sendero";
  const description = metadata.description || "Planifica y comparte viajes con Sendero.";
  const canonical = publicWebUrl && metadata.canonicalPath !== undefined
    ? new URL(metadata.canonicalPath || "/", `${publicWebUrl}/`).href
    : "";
  const structuredData = metadata.jsonLd
    ? `<script type="application/ld+json">${JSON.stringify(metadata.jsonLd).replaceAll("<", "\\u003c")}</script>`
    : "";
  const canonicalTag = canonical ? `<link rel="canonical" href="${escapeHtml(canonical)}" />` : "";
  const ogUrl = canonical ? `<meta property="og:url" content="${escapeHtml(canonical)}" />` : "";
  return `
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="robots" content="${escapeHtml(metadata.robots || "index,follow")}" />
    <meta name="theme-color" media="(prefers-color-scheme: light)" content="#f6f2e4" />
    <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#001817" />
    <meta name="sendero-chatgpt-url" content="${escapeHtml(chatGptUrl)}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Sendero" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta name="twitter:card" content="summary" />
    ${canonicalTag}
    ${ogUrl}
    ${structuredData}`;
}

function safeInlineScript(source) {
  return source.replaceAll("</script", "<\\/script");
}

async function bundleDocument(entry, documentClass = "", metadata = null) {
  const result = await build({
    entryPoints: [resolve(webRoot, entry)],
    bundle: true,
    format: "iife",
    jsx: "automatic",
    minify: true,
    target: ["es2020"],
    write: false,
    define: { "process.env.NODE_ENV": '"production"' },
  });
  const javascript = result.outputFiles.find((file) => file.path.endsWith(".js")) || result.outputFiles[0];
  if (!javascript) throw new Error(`No JavaScript output generated for ${entry}`);
  const documentClassAttribute = documentClass ? ` class="${documentClass}"` : "";
  return `<!doctype html>
<html${documentClassAttribute} lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    ${metadata ? pageHead(metadata) : ""}
    <style>${styles}</style>
  </head>
  <body>
    <div id="root"></div>
    <script>${safeInlineScript(javascript.text)}</script>
  </body>
</html>`;
}

const outputs = [];
for (const app of [...widgets, ...pages]) {
  outputs.push({ ...app, html: await bundleDocument(app.entry, app.documentClass, app.metadata) });
}

const generated = [
  "// Generated by npm run build:ui. Edit web/src instead.",
  ...outputs.map(({ exportName, html }) => `export const ${exportName} = ${JSON.stringify(html)};`),
  "",
].join("\n");

await mkdir(dirname(generatedPath), { recursive: true });
await writeFile(generatedPath, generated);
console.log(`Built ${widgets.length} Sendero UI components and ${pages.length} web pages.`);
