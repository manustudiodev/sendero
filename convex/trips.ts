import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";

type Role = "owner" | "editor" | "viewer";
type ReadContext = QueryCtx | MutationCtx;

const roleRank: Record<Role, number> = { viewer: 1, editor: 2, owner: 3 };

function cleanEmail(value: string | undefined) {
  return value?.trim().toLowerCase() || undefined;
}

function customIdentityValue(
  identity: Record<string, unknown>,
  field: "email" | "name",
) {
  const namespace = process.env.AUTH0_CLAIMS_NAMESPACE?.replace(/\/$/, "");
  const value = namespace ? identity[`${namespace}/${field}`] : undefined;
  return typeof value === "string" ? value : undefined;
}

async function identity(ctx: ReadContext) {
  const value = await ctx.auth.getUserIdentity();
  if (!value) throw new Error("Unauthenticated");
  return value;
}

async function findCurrentUser(ctx: ReadContext) {
  const currentIdentity = await identity(ctx);
  const user = await ctx.db
    .query("users")
    .withIndex("by_token_identifier", (q) =>
      q.eq("tokenIdentifier", currentIdentity.tokenIdentifier),
    )
    .unique();
  return { currentIdentity, user };
}

async function ensureCurrentUser(ctx: MutationCtx) {
  const { currentIdentity, user } = await findCurrentUser(ctx);
  const now = Date.now();
  const identityClaims = currentIdentity as unknown as Record<string, unknown>;
  const email = cleanEmail(
    currentIdentity.email || customIdentityValue(identityClaims, "email"),
  );
  const name =
    (currentIdentity.name || customIdentityValue(identityClaims, "name"))?.trim() ||
    undefined;

  let userId = user?._id;
  if (!userId) {
    userId = await ctx.db.insert("users", {
      tokenIdentifier: currentIdentity.tokenIdentifier,
      email,
      name,
      createdAt: now,
      updatedAt: now,
    });
  } else if (user.email !== email || user.name !== name) {
    await ctx.db.patch(userId, { email, name, updatedAt: now });
  }

  if (email) {
    const invitations = await ctx.db
      .query("collaborators")
      .withIndex("by_invited_email", (q) => q.eq("invitedEmail", email))
      .collect();
    for (const invitation of invitations) {
      if (invitation.status === "pending") {
        await ctx.db.patch(invitation._id, {
          userId,
          status: "accepted",
          updatedAt: now,
        });
      }
    }
  }

  const ensured = await ctx.db.get(userId);
  if (!ensured) throw new Error("Unable to provision user");
  return ensured;
}

async function requireAccess(
  ctx: ReadContext,
  tripId: Id<"trips">,
  minimumRole: Role,
) {
  const trip = await ctx.db.get(tripId);
  if (!trip) throw new Error("Trip not found");

  const { user } = await findCurrentUser(ctx);
  if (!user) throw new Error("User profile not provisioned");

  if (trip.ownerId === user._id) return { trip, user, role: "owner" as const };

  const collaborator = await ctx.db
    .query("collaborators")
    .withIndex("by_trip_and_user", (q) => q.eq("tripId", tripId).eq("userId", user._id))
    .unique();
  if (!collaborator || collaborator.status !== "accepted") {
    throw new Error("Trip access denied");
  }
  if (roleRank[collaborator.role] < roleRank[minimumRole]) {
    throw new Error(`${minimumRole} access required`);
  }
  return { trip, user, role: collaborator.role };
}

function itineraryMetadata(snapshot: unknown) {
  if (!snapshot || typeof snapshot !== "object") throw new Error("Invalid itinerary snapshot");
  const itinerary = snapshot as Record<string, unknown>;
  for (const field of ["title", "destination", "startDate", "endDate"] as const) {
    if (typeof itinerary[field] !== "string" || itinerary[field].length === 0) {
      throw new Error(`Invalid itinerary ${field}`);
    }
  }
  return {
    title: itinerary.title as string,
    destination: itinerary.destination as string,
    startDate: itinerary.startDate as string,
    endDate: itinerary.endDate as string,
  };
}

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const { user } = await findCurrentUser(ctx);
    if (!user) return [];

    const owned = await ctx.db
      .query("trips")
      .withIndex("by_owner_and_status", (q) => q.eq("ownerId", user._id).eq("status", "active"))
      .collect();
    const memberships = await ctx.db
      .query("collaborators")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const results = new Map<string, Record<string, unknown>>();
    for (const trip of owned) {
      results.set(trip._id, { ...trip, role: "owner" });
    }
    for (const membership of memberships) {
      if (membership.status !== "accepted" || membership.role === "owner") continue;
      const trip = await ctx.db.get(membership.tripId);
      if (trip?.status === "active") {
        results.set(trip._id, { ...trip, role: membership.role });
      }
    }
    return [...results.values()].sort(
      (left, right) => Number(right.updatedAt) - Number(left.updatedAt),
    );
  },
});

export const get = query({
  args: { tripId: v.id("trips") },
  handler: async (ctx, { tripId }) => {
    const access = await requireAccess(ctx, tripId, "viewer");
    const revisions = await ctx.db
      .query("tripRevisions")
      .withIndex("by_trip", (q) => q.eq("tripId", tripId))
      .collect();
    return {
      ...access.trip,
      role: access.role,
      revisions: revisions
        .map(({ _id, version, reason, createdAt }) => ({ _id, version, reason, createdAt }))
        .sort((a, b) => b.version - a.version),
    };
  },
});

export const save = mutation({
  args: {
    tripId: v.optional(v.id("trips")),
    itinerary: v.any(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { tripId, itinerary, reason }) => {
    const user = await ensureCurrentUser(ctx);
    const metadata = itineraryMetadata(itinerary);
    const now = Date.now();

    if (!tripId) {
      const createdTripId = await ctx.db.insert("trips", {
        ownerId: user._id,
        ...metadata,
        snapshot: itinerary,
        currentVersion: 1,
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("collaborators", {
        tripId: createdTripId,
        userId: user._id,
        invitedEmail: user.email,
        role: "owner",
        status: "accepted",
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("tripRevisions", {
        tripId: createdTripId,
        version: 1,
        snapshot: itinerary,
        actorId: user._id,
        reason: reason || "Trip created",
        createdAt: now,
      });
      return { tripId: createdTripId, version: 1, role: "owner" as const };
    }

    const access = await requireAccess(ctx, tripId, "editor");
    const version = access.trip.currentVersion + 1;
    await ctx.db.patch(tripId, {
      ...metadata,
      snapshot: itinerary,
      currentVersion: version,
      updatedAt: now,
    });
    await ctx.db.insert("tripRevisions", {
      tripId,
      version,
      snapshot: itinerary,
      actorId: user._id,
      reason: reason || "Itinerary updated",
      createdAt: now,
    });
    return { tripId, version, role: access.role };
  },
});

export const share = mutation({
  args: {
    tripId: v.id("trips"),
    email: v.string(),
    role: v.union(v.literal("editor"), v.literal("viewer")),
  },
  handler: async (ctx, { tripId, email, role }) => {
    await ensureCurrentUser(ctx);
    await requireAccess(ctx, tripId, "owner");
    const invitedEmail = cleanEmail(email);
    if (!invitedEmail) throw new Error("A valid email is required");

    const now = Date.now();
    const invitedUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", invitedEmail))
      .unique();
    const existing = await ctx.db
      .query("collaborators")
      .withIndex("by_trip_and_email", (q) =>
        q.eq("tripId", tripId).eq("invitedEmail", invitedEmail),
      )
      .unique();
    const status = invitedUser ? "accepted" : "pending";

    if (existing) {
      if (existing.role === "owner") throw new Error("The trip owner role cannot be changed");
      await ctx.db.patch(existing._id, {
        userId: invitedUser?._id,
        role,
        status,
        updatedAt: now,
      });
      return { collaboratorId: existing._id, role, status };
    }

    const collaboratorId = await ctx.db.insert("collaborators", {
      tripId,
      userId: invitedUser?._id,
      invitedEmail,
      role,
      status,
      createdAt: now,
      updatedAt: now,
    });
    return { collaboratorId, role, status };
  },
});

export const restoreRevision = mutation({
  args: { tripId: v.id("trips"), version: v.number() },
  handler: async (ctx, { tripId, version }) => {
    const user = await ensureCurrentUser(ctx);
    const access = await requireAccess(ctx, tripId, "editor");
    const revision = await ctx.db
      .query("tripRevisions")
      .withIndex("by_trip_and_version", (q) => q.eq("tripId", tripId).eq("version", version))
      .unique();
    if (!revision) throw new Error("Trip revision not found");

    const nextVersion = access.trip.currentVersion + 1;
    const now = Date.now();
    await ctx.db.patch(tripId, {
      ...itineraryMetadata(revision.snapshot),
      snapshot: revision.snapshot,
      currentVersion: nextVersion,
      updatedAt: now,
    });
    await ctx.db.insert("tripRevisions", {
      tripId,
      version: nextVersion,
      snapshot: revision.snapshot,
      actorId: user._id,
      reason: `Restored version ${version}`,
      createdAt: now,
    });
    return { tripId, version: nextVersion, restoredFrom: version, role: access.role };
  },
});
