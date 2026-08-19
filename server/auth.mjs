import { createRemoteJWKSet, jwtVerify } from "jose";

export const AUTH_SCOPES = Object.freeze({
  read: "trips:read",
  write: "trips:write",
  share: "trips:share",
});

export const SUPPORTED_AUTH_SCOPES = Object.freeze(Object.values(AUTH_SCOPES));

const remoteJwks = new Map();

function absoluteUrl(value, label) {
  if (!value) return undefined;
  try {
    return new URL(value).toString();
  } catch {
    throw new Error(`${label} must be an absolute URL.`);
  }
}

function issuerUrl(value) {
  const url = absoluteUrl(value, "AUTH0_ISSUER");
  if (!url) return undefined;
  return url.endsWith("/") ? url : `${url}/`;
}

export function createAuthConfig({ issuer, audience, resourceServerUrl } = {}) {
  const normalizedIssuer = issuerUrl(issuer);
  const normalizedAudience = absoluteUrl(audience, "AUTH0_AUDIENCE");
  const resource = absoluteUrl(
    resourceServerUrl || normalizedAudience || "http://localhost:8788/mcp",
    "MCP_SERVER_URL",
  );
  const origin = new URL(resource).origin;

  return {
    issuer: normalizedIssuer,
    audience: normalizedAudience,
    resourceServerUrl: resource,
    resourceMetadataUrl: `${origin}/.well-known/oauth-protected-resource`,
    configured: Boolean(normalizedIssuer && normalizedAudience),
  };
}

export function protectedResourceMetadata(config) {
  return {
    resource: config.resourceServerUrl,
    ...(config.issuer ? { authorization_servers: [config.issuer] } : {}),
    scopes_supported: [...SUPPORTED_AUTH_SCOPES],
    bearer_methods_supported: ["header"],
    resource_name: "Sendero",
  };
}

function jwksFor(issuer) {
  if (!remoteJwks.has(issuer)) {
    remoteJwks.set(issuer, createRemoteJWKSet(new URL(".well-known/jwks.json", issuer)));
  }
  return remoteJwks.get(issuer);
}

function tokenScopes(payload) {
  const scopes = new Set();
  if (typeof payload.scope === "string") {
    for (const scope of payload.scope.split(/\s+/).filter(Boolean)) scopes.add(scope);
  }
  if (Array.isArray(payload.permissions)) {
    for (const permission of payload.permissions) {
      if (typeof permission === "string" && permission) scopes.add(permission);
    }
  }
  return [...scopes];
}

export async function verifyAccessToken(token, config) {
  if (!config.configured) {
    throw new Error("Sendero OAuth is not configured.");
  }

  const { payload } = await jwtVerify(token, jwksFor(config.issuer), {
    issuer: config.issuer,
    audience: config.audience,
    algorithms: ["RS256"],
  });

  return {
    authenticated: true,
    subject: payload.sub,
    scopes: tokenScopes(payload),
    claims: payload,
  };
}

function quoteChallengeValue(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

export function bearerChallenge(
  config,
  { error, description, scopes = [] } = {},
) {
  const parameters = [`resource_metadata="${quoteChallengeValue(config.resourceMetadataUrl)}"`];
  if (error) parameters.push(`error="${quoteChallengeValue(error)}"`);
  if (description) {
    parameters.push(`error_description="${quoteChallengeValue(description)}"`);
  }
  if (scopes.length) parameters.push(`scope="${quoteChallengeValue(scopes.join(" "))}"`);
  return `Bearer ${parameters.join(", ")}`;
}

export function toolSecuritySchemes(scopes = []) {
  return scopes.length
    ? [{ type: "oauth2", scopes }]
    : [{ type: "noauth" }];
}

export function authorizeTool(auth, requiredScopes) {
  const metadataUrl =
    auth?.resourceMetadataUrl ||
    "http://localhost:8788/.well-known/oauth-protected-resource";
  const challengeConfig = { resourceMetadataUrl: metadataUrl };

  if (!auth?.authenticated) {
    return {
      content: [{ type: "text", text: "Sign in to access saved Sendero trips." }],
      isError: true,
      _meta: {
        "mcp/www_authenticate": [
          bearerChallenge(challengeConfig, {
            error: "invalid_token",
            description: "Authentication is required.",
            scopes: requiredScopes,
          }),
        ],
      },
    };
  }

  const granted = new Set(auth.scopes || []);
  const missing = requiredScopes.filter((scope) => !granted.has(scope));
  if (missing.length) {
    return {
      content: [
        {
          type: "text",
          text: `Additional permission required: ${missing.join(", ")}.`,
        },
      ],
      isError: true,
      _meta: {
        "mcp/www_authenticate": [
          bearerChallenge(challengeConfig, {
            error: "insufficient_scope",
            description: "The access token does not include the required permission.",
            scopes: requiredScopes,
          }),
        ],
      },
    };
  }

  return undefined;
}
