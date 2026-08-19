import type { AuthConfig } from "convex/server";

function required(name: "AUTH0_ISSUER" | "AUTH0_AUDIENCE") {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required to deploy Sendero authentication.`);
  return value;
}

const issuerValue = required("AUTH0_ISSUER");
const issuer = issuerValue.endsWith("/") ? issuerValue : `${issuerValue}/`;

export default {
  providers: [
    {
      type: "customJwt",
      issuer,
      jwks: new URL(".well-known/jwks.json", issuer).toString(),
      algorithm: "RS256",
      applicationID: required("AUTH0_AUDIENCE"),
    },
  ],
} satisfies AuthConfig;
