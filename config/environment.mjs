export const deploymentProfiles = Object.freeze(["local", "preview", "production"]);

export const senderoEnvironments = Object.freeze(["development", "production"]);

export function normalizeSenderoEnvironment(value) {
  const environment = String(value || "production").trim().toLowerCase();
  if (!senderoEnvironments.includes(environment)) {
    throw new Error(
      `Unknown SENDERO_ENVIRONMENT \"${environment}\". Expected one of: ${senderoEnvironments.join(", ")}.`,
    );
  }
  return environment;
}

export function senderoEnvironmentIdentity(value) {
  const environment = normalizeSenderoEnvironment(value);
  return environment === "development"
    ? {
        environment,
        badge: "DEV",
        displayName: "Sendero Dev",
        mcpServerName: "sendero-dev",
      }
    : {
        environment,
        badge: "",
        displayName: "Sendero",
        mcpServerName: "sendero",
      };
}

export const environmentVariables = Object.freeze([
  {
    name: "SENDERO_ENVIRONMENT",
    kind: "config",
    allowedValues: senderoEnvironments,
    description: "Logical Sendero environment displayed by the web and MCP app.",
    requiredIn: [],
  },
  {
    name: "CONVEX_URL",
    kind: "url",
    description: "Convex deployment URL used by the Hono runtime.",
    requiredIn: ["preview", "production"],
  },
  {
    name: "CONVEX_SITE_URL",
    kind: "url",
    description: "Convex HTTP Actions URL reserved for direct Convex HTTP integrations.",
    requiredIn: [],
  },
  {
    name: "CONVEX_DEPLOY_KEY",
    kind: "secret",
    description: "Environment-scoped Convex deploy key used only by the Vercel build.",
    requiredIn: ["preview", "production"],
  },
  {
    name: "MCP_SERVER_URL",
    kind: "url",
    description: "Canonical public MCP endpoint.",
    requiredIn: ["preview", "production"],
  },
  {
    name: "PUBLIC_WEB_URL",
    kind: "url",
    description: "Canonical origin for web pages, callbacks, and share links.",
    requiredIn: ["preview", "production"],
    convexRequiredIn: ["preview", "production"],
  },
  {
    name: "SENDERO_CHATGPT_URL",
    kind: "url",
    description: "Optional ChatGPT destination used by web calls to action.",
    requiredIn: [],
  },
  {
    name: "SENDERO_WEBMCP_PLANNING_ENABLED",
    kind: "config",
    allowedValues: ["true", "false"],
    description: "Feature flag for authenticated page-level WebMCP itinerary generation.",
    requiredIn: [],
  },
  {
    name: "SENDERO_SHARE_SECRET",
    kind: "secret",
    minBytes: 32,
    description: "Secret used to derive retry-safe public share tokens.",
    requiredIn: ["preview", "production"],
  },
  {
    name: "GOOGLE_MAPS_EMBED_API_KEY",
    kind: "secret",
    description: "Browser-visible, API-restricted key for Maps Embed API.",
    requiredIn: [],
    recommendedIn: ["preview", "production"],
  },
  {
    name: "AUTH0_ISSUER",
    kind: "url",
    description: "Auth0 tenant issuer, including its trailing slash.",
    requiredIn: ["preview", "production"],
    convexRequiredIn: ["preview", "production"],
  },
  {
    name: "AUTH0_AUDIENCE",
    kind: "url",
    description: "Audience of the Sendero Auth0 API.",
    requiredIn: ["preview", "production"],
    convexRequiredIn: ["preview", "production"],
  },
  {
    name: "AUTH0_CLAIMS_NAMESPACE",
    kind: "url",
    description: "Namespace used by the Auth0 Action for Sendero claims.",
    requiredIn: ["preview", "production"],
    convexRequiredIn: ["preview", "production"],
  },
  {
    name: "AUTH0_WEB_CLIENT_ID",
    kind: "config",
    description: "Client ID of the Auth0 Regular Web Application.",
    requiredIn: ["preview", "production"],
  },
  {
    name: "AUTH0_WEB_CLIENT_SECRET",
    kind: "secret",
    description: "Client secret of the Auth0 Regular Web Application.",
    requiredIn: ["preview", "production"],
  },
  {
    name: "AUTH0_WEB_SCOPES",
    kind: "config",
    description: "Space-separated scopes requested by the web application.",
    requiredIn: ["preview", "production"],
  },
  {
    name: "SENDERO_WEB_SESSION_KEY",
    kind: "secret",
    minBytes: 32,
    description: "Key used to encrypt Sendero web sessions.",
    requiredIn: ["preview", "production"],
  },
  {
    name: "SENDERO_INVITE_TOKEN_PEPPER",
    kind: "secret",
    minBytes: 32,
    description: "Pepper used when hashing invitation tokens.",
    requiredIn: ["preview", "production"],
    convexRequiredIn: ["preview", "production"],
  },
  {
    name: "RESEND_API_KEY",
    kind: "secret",
    description: "Resend API key for invitation delivery.",
    requiredIn: [],
    convexRequiredIn: ["production"],
    convexRecommendedIn: ["preview"],
  },
  {
    name: "SENDERO_EMAIL_FROM",
    kind: "config",
    description: "Verified Sendero sender identity used by Resend.",
    requiredIn: [],
    convexRequiredIn: ["production"],
    convexRecommendedIn: ["preview"],
  },
  {
    name: "MCP_PORT",
    kind: "config",
    description: "Optional port for the local Node server.",
    requiredIn: [],
  },
]);
