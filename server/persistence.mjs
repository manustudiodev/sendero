import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

const listMine = makeFunctionReference("trips:listMine");
const openTrip = makeFunctionReference("trips:open");
const getTrip = makeFunctionReference("trips:get");
const getTripRevision = makeFunctionReference("trips:getRevision");
const saveTrip = makeFunctionReference("trips:save");
const updateReservationStatus = makeFunctionReference("trips:updateReservationStatus");
const shareTrip = makeFunctionReference("trips:share");
const restoreTripRevision = makeFunctionReference("trips:restoreRevision");
const previewPublicShare = makeFunctionReference("publicShares:preview");
const getPublicShareStatus = makeFunctionReference("publicShares:status");
const publishPublicShare = makeFunctionReference("publicShares:publish");
const updatePublicShare = makeFunctionReference("publicShares:update");
const rotatePublicShare = makeFunctionReference("publicShares:rotate");
const revokePublicShare = makeFunctionReference("publicShares:revoke");
const resolvePublicShare = makeFunctionReference("publicShareResolver:resolve");

function requireValue(value, message) {
  if (!value) throw new Error(message);
  return value;
}

export function createConvexPersistence({ convexUrl, authToken } = {}) {
  function client() {
    const url = requireValue(
      convexUrl,
      "Sendero storage is not configured. Set CONVEX_URL before using saved trips.",
    );
    const token = requireValue(
      authToken,
      "Sign in before accessing saved Sendero trips.",
    );
    const convex = new ConvexHttpClient(url);
    convex.setAuth(token);
    return convex;
  }

  function publicClient() {
    const url = requireValue(
      convexUrl,
      "Sendero storage is not configured. Set CONVEX_URL before opening a public trip.",
    );
    return new ConvexHttpClient(url);
  }

  return {
    async open(reference) {
      const result = await client().query(openTrip, { reference });
      if (result.state !== "opened") {
        return {
          state: result.state,
          trips: result.trips || [],
        };
      }
      return {
        state: "opened",
        id: result.trip._id,
        role: result.trip.role,
        version: result.trip.currentVersion,
        itinerary: result.trip.snapshot,
        revisions: (result.revisions || []).map((revision) => ({
          version: revision.version,
          reason: revision.reason,
          createdAt: revision.createdAt,
        })),
        trips: [],
      };
    },

    async list() {
      const trips = await client().query(listMine, {});
      return trips.map((trip) => ({
        id: trip._id,
        title: trip.title,
        destination: trip.destination,
        startDate: trip.startDate,
        endDate: trip.endDate,
        currentVersion: trip.currentVersion,
        role: trip.role,
        updatedAt: trip.updatedAt,
      }));
    },

    async get(tripId) {
      const trip = await client().query(getTrip, { tripId });
      return {
        id: trip._id,
        role: trip.role,
        version: trip.currentVersion,
        itinerary: trip.snapshot,
        revisions: trip.revisions.map((revision) => ({
          version: revision.version,
          reason: revision.reason,
          createdAt: revision.createdAt,
        })),
      };
    },

    async getRevision({ tripId, version }) {
      const revision = await client().query(getTripRevision, { tripId, version });
      return {
        tripId: revision.tripId,
        version: revision.version,
        role: revision.role,
        itinerary: revision.itinerary,
      };
    },

    async save({ tripId, itinerary, reason, expectedVersion, operationId }) {
      return client().mutation(saveTrip, {
        ...(tripId ? { tripId } : {}),
        itinerary,
        ...(reason ? { reason } : {}),
        ...(expectedVersion !== undefined ? { expectedVersion } : {}),
        operationId,
      });
    },

    async updateReservation({
      tripId,
      dayDate,
      activityId,
      status,
      expectedVersion,
      operationId,
    }) {
      return client().mutation(updateReservationStatus, {
        tripId,
        dayDate,
        activityId,
        status,
        expectedVersion,
        operationId,
      });
    },

    async share({ tripId, email, role }) {
      return client().mutation(shareTrip, { tripId, email, role });
    },

    async restore({ tripId, version, expectedVersion, operationId }) {
      return client().mutation(restoreTripRevision, {
        tripId,
        version,
        expectedVersion,
        operationId,
      });
    },

    async publicPreview(tripId) {
      return client().query(previewPublicShare, { tripId });
    },

    async publicStatus(tripId) {
      return client().query(getPublicShareStatus, { tripId });
    },

    async publishPublic({
      tripId,
      expectedVersion,
      tokenHash,
      expiresAt,
      operationId,
    }) {
      return client().mutation(publishPublicShare, {
        tripId,
        expectedVersion,
        tokenHash,
        expiresAt,
        operationId,
      });
    },

    async updatePublic({ tripId, expectedVersion, operationId }) {
      return client().mutation(updatePublicShare, {
        tripId,
        expectedVersion,
        operationId,
      });
    },

    async rotatePublic({ tripId, tokenHash, operationId }) {
      return client().mutation(rotatePublicShare, { tripId, tokenHash, operationId });
    },

    async revokePublic({ tripId, operationId }) {
      return client().mutation(revokePublicShare, { tripId, operationId });
    },

    async resolvePublic(token) {
      return publicClient().action(resolvePublicShare, { token });
    },
  };
}
