import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { setCookie } from "hono/cookie";
import { senderoEnvironmentIdentity } from "../config/environment.mjs";
import {
  canonicalSupportedUiLocale,
  resolveUiLocale,
  SUPPORTED_UI_LANGUAGES,
  UI_LOCALE_COOKIE,
  uiLanguage,
} from "../shared/ui-locale.mjs";
import {
  accountPageHtml,
  generateTripPageHtml,
  invitePageHtml,
  landingPageHtml,
  privacyPageHtml,
  publicSharePageHtml,
  restrictedTripPageHtml,
  termsPageHtml,
} from "./ui/generated/widgets.mjs";
import {
  bearerChallenge,
  createAuthConfig,
  protectedResourceMetadata,
  verifyAccessToken as verifyJwtAccessToken,
} from "./auth.mjs";
import { createConvexPersistence } from "./persistence.mjs";
import { isValidPublicShareToken } from "./public-sharing.mjs";
import { createTripPlannerServer, publicItinerarySchema } from "./server.mjs";
import { withGoogleMapsEmbedKey } from "./ui/resources.mjs";
import { createWebAuth, registerWebAuthRoutes } from "./web-auth.mjs";
import { registerWebApiRoutes } from "./web-api.mjs";
import { localizePageHtml } from "./site-localization.mjs";

function authorizationToken(request) {
  const authorization = request.header("Authorization");
  if (!authorization) return {};
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return { malformed: true };
  return { token: match[1] };
}

function defaultResourceServerUrl() {
  if (process.env.MCP_SERVER_URL) return process.env.MCP_SERVER_URL;
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  return vercelHost ? `https://${vercelHost}/mcp` : "http://localhost:8788/mcp";
}

function defaultPublicWebUrl(resourceServerUrl) {
  if (process.env.PUBLIC_WEB_URL) return process.env.PUBLIC_WEB_URL;
  return new URL(resourceServerUrl).origin;
}

function requestUiLocale(context, explicitPathLocale = "") {
  const url = new URL(context.req.url);
  return resolveUiLocale({
    acceptLanguage: context.req.header("Accept-Language") || "",
    cookie: context.req.header("Cookie") || "",
    pathname: explicitPathLocale ? `/${explicitPathLocale}` : url.pathname,
    search: url.search,
  });
}

function rememberUiLocale(context, locale) {
  setCookie(context, UI_LOCALE_COOKIE, uiLanguage(locale), {
    httpOnly: false,
    maxAge: 31_536_000,
    path: "/",
    sameSite: "Lax",
    secure: new URL(context.req.url).protocol === "https:",
  });
}

const publicSecurityHeaders = Object.freeze({
  "Cache-Control": "no-store, max-age=0",
  "Content-Security-Policy":
    "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src data:; font-src 'self' data:; frame-src https://www.google.com; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=()",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
});

const siteSecurityHeaders = Object.freeze({
  "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
  "Content-Security-Policy":
    "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; font-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
});

const authenticatedPageSecurityHeaders = Object.freeze({
  "Cache-Control": "private, no-store, max-age=0",
  "Content-Security-Policy":
    "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; font-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=()",
  "Referrer-Policy": "same-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
});

const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="18" fill="#a2d45e"/><path fill="#003834" d="M43 18H29c-7 0-12 4-12 11 0 6 5 10 12 10h6c3 0 4 1 4 3 0 3-2 4-5 4H20v8h15c8 0 13-5 13-12 0-7-5-11-12-11h-7c-2 0-3-1-3-2 0-2 1-3 3-3h14z"/></svg>`;

function setPublicSecurityHeaders(context) {
  for (const [name, value] of Object.entries(publicSecurityHeaders)) {
    context.header(name, value);
  }
}

function setSiteSecurityHeaders(context) {
  for (const [name, value] of Object.entries(siteSecurityHeaders)) {
    context.header(name, value);
  }
}

function setAuthenticatedPageSecurityHeaders(context, { includeMaps = false } = {}) {
  for (const [name, value] of Object.entries(authenticatedPageSecurityHeaders)) {
    context.header(
      name,
      includeMaps && name === "Content-Security-Policy"
        ? value.replace("frame-ancestors", "frame-src https://www.google.com; frame-ancestors")
        : value,
    );
  }
}

function authFailureDetails(error, authConfig) {
  return {
    code: typeof error?.code === "string" ? error.code : "token_verification_failed",
    claim: typeof error?.claim === "string" ? error.claim : undefined,
    issuer: authConfig.issuer,
    audience: authConfig.audience,
  };
}

export function createApp({
  convexUrl = process.env.CONVEX_URL,
  authConfig = createAuthConfig({
    issuer: process.env.AUTH0_ISSUER,
    audience: process.env.AUTH0_AUDIENCE,
    resourceServerUrl: defaultResourceServerUrl(),
  }),
  verifyAccessToken = verifyJwtAccessToken,
  persistenceFactory = createConvexPersistence,
  publicWebUrl,
  publicShareSecret = process.env.SENDERO_SHARE_SECRET,
  invitePepper = process.env.SENDERO_INVITE_TOKEN_PEPPER,
  mapsEmbedApiKey = process.env.GOOGLE_MAPS_EMBED_API_KEY,
  placesApiKey = process.env.GOOGLE_PLACES_API_KEY,
  placesFetch = globalThis.fetch,
  webAuth,
  logger = console,
  app = new Hono(),
  environment = process.env.SENDERO_ENVIRONMENT,
  planningEnabled = process.env.SENDERO_WEBMCP_PLANNING_ENABLED === "true",
} = {}) {
  const environmentIdentity = senderoEnvironmentIdentity(environment);
  const mcpCors = cors({
    origin: "*",
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowHeaders: [
      "Authorization",
      "Content-Type",
      "mcp-session-id",
      "Last-Event-ID",
      "mcp-protocol-version",
    ],
    exposeHeaders: ["mcp-session-id", "mcp-protocol-version", "WWW-Authenticate"],
  });
  app.use("/mcp", mcpCors);
  app.use("/.well-known/*", mcpCors);

  const metadata = protectedResourceMetadata(authConfig, { environment: environmentIdentity.environment });
  const resolvedPublicWebUrl = publicWebUrl || defaultPublicWebUrl(authConfig.resourceServerUrl);
  const resolvedWebAuth = webAuth || createWebAuth({
    issuer: process.env.AUTH0_ISSUER,
    audience: process.env.AUTH0_AUDIENCE,
    clientId: process.env.AUTH0_WEB_CLIENT_ID,
    clientSecret: process.env.AUTH0_WEB_CLIENT_SECRET,
    publicWebUrl: resolvedPublicWebUrl,
    sessionSecret: process.env.SENDERO_WEB_SESSION_KEY,
    onAuthenticated: async ({ accessToken }) => {
      await persistenceFactory({ convexUrl, authToken: accessToken }).bootstrap();
    },
    ...(process.env.AUTH0_WEB_SCOPES
      ? { scopes: process.env.AUTH0_WEB_SCOPES.split(/\s+/).filter(Boolean) }
      : {}),
  });

  app.get("/.well-known/oauth-protected-resource", (context) => context.json(metadata));
  app.get("/.well-known/oauth-protected-resource/mcp", (context) => context.json(metadata));
  registerWebAuthRoutes(app, resolvedWebAuth);
  registerWebApiRoutes(app, {
    convexUrl,
    invitePepper,
    logger,
    persistenceFactory,
    planningEnabled,
    placesApiKey,
    placesFetch,
    publicShareSecret,
    publicWebUrl: resolvedPublicWebUrl,
    webAuth: resolvedWebAuth,
  });

  const renderSitePage = (html, page, explicitPathLocale) => (context) => {
    const locale = requestUiLocale(context, explicitPathLocale);
    setSiteSecurityHeaders(context);
    return context.html(localizePageHtml(html, {
      locale,
      page,
      publicWebUrl: resolvedPublicWebUrl,
    }));
  };
  const redirectToLocalizedSitePage = (page) => (context) => {
    const locale = requestUiLocale(context);
    const suffix = page === "landing" ? "" : `/${page}`;
    setSiteSecurityHeaders(context);
    context.header("Cache-Control", "private, no-store, max-age=0");
    context.header("Vary", "Accept-Language, Cookie");
    return context.redirect(`/${uiLanguage(locale)}${suffix}`, 307);
  };
  app.get("/", redirectToLocalizedSitePage("landing"));
  app.get("/privacy", redirectToLocalizedSitePage("privacy"));
  app.get("/terms", redirectToLocalizedSitePage("terms"));
  for (const locale of SUPPORTED_UI_LANGUAGES) {
    app.get(`/${locale}`, renderSitePage(landingPageHtml, "landing", locale));
    app.get(`/${locale}/privacy`, renderSitePage(privacyPageHtml, "privacy", locale));
    app.get(`/${locale}/terms`, renderSitePage(termsPageHtml, "terms", locale));
  }
  app.get("/favicon.ico", (context) => {
    context.header("Cache-Control", "public, max-age=86400");
    context.header("Content-Type", "image/svg+xml");
    context.header("X-Content-Type-Options", "nosniff");
    return context.body(faviconSvg);
  });

  const renderAuthenticatedPage = (html, { includeMaps = false, page = "account" } = {}) => (context) => {
    const locale = requestUiLocale(context);
    if (canonicalSupportedUiLocale(context.req.query("lang"))) rememberUiLocale(context, locale);
    setAuthenticatedPageSecurityHeaders(context, { includeMaps });
    const pageHtml = includeMaps ? withGoogleMapsEmbedKey(html, mapsEmbedApiKey) : html;
    return context.html(localizePageHtml(pageHtml, { locale, page, publicWebUrl: resolvedPublicWebUrl }));
  };
  app.get("/app", renderAuthenticatedPage(accountPageHtml, { page: "account" }));
  app.get("/app/new", renderAuthenticatedPage(generateTripPageHtml, { includeMaps: true, page: "generate" }));
  app.get("/invite", renderAuthenticatedPage(invitePageHtml, { page: "invite" }));
  app.get("/invite/:webId", renderAuthenticatedPage(invitePageHtml, { page: "invite" }));
  app.get(
    "/app/trips/:webId",
    renderAuthenticatedPage(restrictedTripPageHtml, { includeMaps: true, page: "restricted" }),
  );

  app.get("/health", (context) =>
    context.json({
      status: "ok",
      service: "sendero",
      environment: environmentIdentity.environment,
      storage: convexUrl ? "configured" : "not_configured",
      authentication: authConfig.configured ? "configured" : "not_configured",
      webAuthentication: resolvedWebAuth.configured ? "configured" : "not_configured",
      publicSharing:
        typeof publicShareSecret === "string" && Buffer.byteLength(publicShareSecret, "utf8") >= 32
          ? "configured"
          : "not_configured",
      mapsEmbed: typeof mapsEmbedApiKey === "string" && mapsEmbedApiKey.trim()
        ? "configured"
        : "not_configured",
      placesAutocomplete: typeof placesApiKey === "string" && placesApiKey.trim()
        ? "configured"
        : "not_configured",
      webMcpPlanning: planningEnabled ? "enabled" : "disabled",
    }),
  );

  app.get("/share", (context) => {
    const locale = requestUiLocale(context);
    if (canonicalSupportedUiLocale(context.req.query("lang"))) rememberUiLocale(context, locale);
    setPublicSecurityHeaders(context);
    return context.html(localizePageHtml(
      withGoogleMapsEmbedKey(publicSharePageHtml, mapsEmbedApiKey),
      { locale, page: "share", publicWebUrl: resolvedPublicWebUrl },
    ));
  });

  app.post("/api/public-shares/resolve", async (context) => {
    setPublicSecurityHeaders(context);
    if (!context.req.header("Content-Type")?.toLowerCase().startsWith("application/json")) {
      return context.json({ error: "share_unavailable" }, 404);
    }
    const declaredLength = Number(context.req.header("Content-Length") || 0);
    if (declaredLength > 1024) {
      return context.json({ error: "share_unavailable" }, 404);
    }

    let body;
    try {
      const raw = await context.req.text();
      if (raw.length > 1024) return context.json({ error: "share_unavailable" }, 404);
      body = JSON.parse(raw);
    } catch {
      return context.json({ error: "share_unavailable" }, 404);
    }
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      !isValidPublicShareToken(body.token)
    ) {
      return context.json({ error: "share_unavailable" }, 404);
    }

    try {
      const persistence = persistenceFactory({ convexUrl });
      const result = await persistence.resolvePublic(body.token);
      if (result?.status !== "active") {
        return context.json({ error: "share_unavailable" }, 404);
      }
      const itinerary = publicItinerarySchema.parse(result.itinerary);
      return context.json({
        share: {
          itinerary,
          sourceVersion: result.share?.sourceVersion ?? result.sourceVersion,
          generation: result.share?.generation ?? result.generation,
          publishedAt: result.share?.publishedAt ?? result.publishedAt,
          updatedAt: result.share?.updatedAt ?? result.updatedAt,
          expiresAt: result.share?.expiresAt ?? result.expiresAt,
        },
      });
    } catch {
      logger.warn?.("[sendero.public-share] resolver unavailable", {
        code: "resolver_failed",
      });
      return context.json({ error: "temporarily_unavailable" }, 503);
    }
  });

  app.all("/mcp", async (context) => {
    const authorization = authorizationToken(context.req);
    if (authorization.malformed) {
      context.header(
        "WWW-Authenticate",
        bearerChallenge(authConfig, {
          error: "invalid_token",
          description: "Use an Authorization: Bearer token.",
        }),
      );
      return context.json({ error: "invalid_token" }, 401);
    }

    let auth = {
      authenticated: false,
      scopes: [],
      resourceMetadataUrl: authConfig.resourceMetadataUrl,
    };
    if (authorization.token) {
      try {
        auth = {
          ...(await verifyAccessToken(authorization.token, authConfig)),
          resourceMetadataUrl: authConfig.resourceMetadataUrl,
        };
      } catch (error) {
        logger.warn?.("[sendero.auth] access token rejected", authFailureDetails(error, authConfig));
        context.header(
          "WWW-Authenticate",
          bearerChallenge(authConfig, {
            error: "invalid_token",
            description: "The access token is invalid or expired.",
          }),
        );
        return context.json({ error: "invalid_token" }, 401);
      }
    }

    const persistence = persistenceFactory({
      convexUrl,
      authToken: authorization.token,
    });
    const server = createTripPlannerServer({
      persistence,
      auth,
      widgetOrigin: authConfig.resourceServerUrl,
      mapsEmbedApiKey,
      publicWebUrl: resolvedPublicWebUrl,
      publicShareSecret,
      invitationPepper: invitePepper,
      environment: environmentIdentity.environment,
    });
    const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
    await server.connect(transport);
    return transport.handleRequest(context.req.raw);
  });

  return app;
}

export default createApp();
