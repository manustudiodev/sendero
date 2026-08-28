import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

export type MemberRole = "editor" | "viewer";
export type AccessRole = "owner" | MemberRole;
export type ReadContext = QueryCtx | MutationCtx;

const roleRank: Record<AccessRole, number> = { viewer: 1, editor: 2, owner: 3 };

export function cleanEmail(value: string | undefined) {
  return value?.trim().toLowerCase() || undefined;
}

export function isMemberRole(value: unknown): value is MemberRole {
  return value === "editor" || value === "viewer";
}

function customIdentityValue(identity: Record<string, unknown>, field: string) {
  const namespace = process.env.AUTH0_CLAIMS_NAMESPACE?.replace(/\/$/, "");
  return namespace ? identity[`${namespace}/${field}`] : undefined;
}

function stringClaim(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function booleanClaim(value: unknown) {
  return value === true || value === "true";
}

export async function identity(ctx: ReadContext) {
  const value = await ctx.auth.getUserIdentity();
  if (!value) throw new Error("Unauthenticated");
  return value;
}

export function identityProfile(currentIdentity: Awaited<ReturnType<typeof identity>>) {
  const claims = currentIdentity as unknown as Record<string, unknown>;
  const email = cleanEmail(
    stringClaim(claims.email) || stringClaim(customIdentityValue(claims, "email")),
  );
  const name =
    stringClaim(claims.name) || stringClaim(customIdentityValue(claims, "name"));
  const emailVerified =
    booleanClaim(claims.emailVerified) ||
    booleanClaim(claims.email_verified) ||
    booleanClaim(customIdentityValue(claims, "email_verified"));
  return { email, name, emailVerified };
}

export async function findCurrentUser(ctx: ReadContext) {
  const currentIdentity = await identity(ctx);
  const user = await ctx.db
    .query("users")
    .withIndex("by_token_identifier", (q) =>
      q.eq("tokenIdentifier", currentIdentity.tokenIdentifier),
    )
    .unique();
  return { currentIdentity, user };
}

export async function upsertAcceptedCollaborator(
  ctx: MutationCtx,
  {
    tripId,
    userId,
    invitedEmail,
    role,
    now = Date.now(),
  }: {
    tripId: Id<"trips">;
    userId: Id<"users">;
    invitedEmail: string;
    role: MemberRole;
    now?: number;
  },
) {
  const trip = await ctx.db.get(tripId);
  if (!trip) throw new Error("Trip not found");
  if (trip.ownerId === userId) {
    return { collaboratorId: undefined, changed: false, owner: true as const };
  }

  const existing = await ctx.db
    .query("collaborators")
    .withIndex("by_trip_and_user", (q) => q.eq("tripId", tripId).eq("userId", userId))
    .collect();
  const target =
    existing.find((entry) => entry.status === "accepted" && isMemberRole(entry.role)) ||
    existing.find((entry) => isMemberRole(entry.role)) ||
    existing[0];

  let collaboratorId: Id<"collaborators">;
  let changed = true;
  if (target) {
    collaboratorId = target._id;
    changed =
      target.userId !== userId ||
      target.invitedEmail !== invitedEmail ||
      target.role !== role ||
      target.status !== "accepted";
    if (changed) {
      await ctx.db.patch(target._id, {
        userId,
        invitedEmail,
        role,
        status: "accepted",
        updatedAt: now,
      });
    }
  } else {
    collaboratorId = await ctx.db.insert("collaborators", {
      tripId,
      userId,
      invitedEmail,
      role,
      status: "accepted",
      createdAt: now,
      updatedAt: now,
    });
  }

  for (const duplicate of existing) {
    if (duplicate._id !== collaboratorId && duplicate.status !== "revoked") {
      await ctx.db.patch(duplicate._id, { status: "revoked", updatedAt: now });
    }
  }
  return { collaboratorId, changed, owner: false as const };
}

export async function provisionCurrentUser(ctx: MutationCtx) {
  const { currentIdentity, user } = await findCurrentUser(ctx);
  const now = Date.now();
  const profile = identityProfile(currentIdentity);
  let userId = user?._id;
  if (!userId) {
    userId = await ctx.db.insert("users", {
      tokenIdentifier: currentIdentity.tokenIdentifier,
      email: profile.email,
      emailVerified: profile.emailVerified,
      name: profile.name,
      createdAt: now,
      updatedAt: now,
    });
  } else if (
    user.email !== profile.email ||
    user.emailVerified !== profile.emailVerified ||
    user.name !== profile.name
  ) {
    await ctx.db.patch(userId, {
      email: profile.email,
      emailVerified: profile.emailVerified,
      name: profile.name,
      updatedAt: now,
    });
  }
  const provisioned = await ctx.db.get(userId);
  if (!provisioned) throw new Error("Unable to provision user");
  return provisioned;
}

export async function bootstrapCurrentUser(ctx: MutationCtx) {
  const user = await provisionCurrentUser(ctx);
  return { user };
}

export async function ensureCurrentUser(ctx: MutationCtx) {
  const result = await bootstrapCurrentUser(ctx);
  return result.user;
}

export async function requireAccess(
  ctx: ReadContext,
  tripId: Id<"trips">,
  minimumRole: AccessRole,
) {
  const trip = await ctx.db.get(tripId);
  if (!trip) throw new Error("Trip not found");
  const { user } = await findCurrentUser(ctx);
  if (!user) throw new Error("User profile not provisioned");
  if (trip.ownerId === user._id) return { trip, user, role: "owner" as const };
  if (minimumRole === "owner") throw new Error("Owner access required");

  const memberships = await ctx.db
    .query("collaborators")
    .withIndex("by_trip_and_user", (q) => q.eq("tripId", tripId).eq("userId", user._id))
    .collect();
  const collaborator = memberships
    .filter((entry) => entry.status === "accepted" && isMemberRole(entry.role))
    .sort((left, right) => roleRank[right.role] - roleRank[left.role])[0];
  if (!collaborator) throw new Error("Trip access denied");
  if (roleRank[collaborator.role] < roleRank[minimumRole]) {
    throw new Error(`${minimumRole} access required`);
  }
  return { trip, user, role: collaborator.role };
}

export async function listAccessibleTrips(ctx: ReadContext) {
  const { user } = await findCurrentUser(ctx);
  if (!user) return [];
  const owned = await ctx.db
    .query("trips")
    .withIndex("by_owner_and_status", (q) =>
      q.eq("ownerId", user._id).eq("status", "active"),
    )
    .collect();
  const memberships = await ctx.db
    .query("collaborators")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .collect();

  const results = new Map<string, Record<string, unknown>>();
  for (const trip of owned) results.set(trip._id, { ...trip, role: "owner" });
  for (const membership of memberships) {
    if (membership.status !== "accepted" || !isMemberRole(membership.role)) continue;
    const trip = await ctx.db.get(membership.tripId);
    if (trip?.status === "active" && trip.ownerId !== user._id) {
      results.set(trip._id, { ...trip, role: membership.role });
    }
  }
  return [...results.values()].sort(
    (left, right) =>
      Number(right.updatedAt) - Number(left.updatedAt) ||
      String(left._id).localeCompare(String(right._id)),
  );
}
