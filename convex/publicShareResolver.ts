"use node";

import { createHash } from "node:crypto";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const HASH_DOMAIN = "sendero-share:v1:";

type PublicShareResolution =
  | { status: "not_found" | "unavailable" | "expired" }
  | {
      status: "active";
      itinerary: unknown;
      share: {
        sourceVersion: number;
        generation: number;
        publishedAt: number;
        updatedAt: number;
        expiresAt: number;
      };
    };

export const resolve = action({
  args: { token: v.string() },
  returns: v.union(
    v.object({ status: v.literal("not_found") }),
    v.object({ status: v.literal("unavailable") }),
    v.object({ status: v.literal("expired") }),
    v.object({
      status: v.literal("active"),
      itinerary: v.any(),
      share: v.object({
        sourceVersion: v.number(),
        generation: v.number(),
        publishedAt: v.number(),
        updatedAt: v.number(),
        expiresAt: v.number(),
      }),
    }),
  ),
  handler: async (ctx, { token }): Promise<PublicShareResolution> => {
    if (!TOKEN_PATTERN.test(token)) return { status: "not_found" as const };
    const tokenHash = createHash("sha256")
      .update(`${HASH_DOMAIN}${token}`, "utf8")
      .digest("base64url");
    return ctx.runQuery(internal.publicShares.resolveByTokenHash, { tokenHash });
  },
});
