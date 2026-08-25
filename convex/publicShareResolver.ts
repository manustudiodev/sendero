"use node";

import { createHash } from "node:crypto";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const HASH_DOMAIN = "sendero-share:v1:";

export const resolve = action({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    if (!TOKEN_PATTERN.test(token)) return { status: "not_found" as const };
    const tokenHash = createHash("sha256")
      .update(`${HASH_DOMAIN}${token}`, "utf8")
      .digest("base64url");
    return ctx.runQuery(internal.publicShares.resolveByTokenHash, { tokenHash });
  },
});
