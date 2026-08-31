import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { canonicalLocale, DEFAULT_LOCALE } from "../shared/locale.mjs";

const listMine = makeFunctionReference("trips:listMine");
const bootstrapSession = makeFunctionReference("trips:bootstrapSession");
const openTrip = makeFunctionReference("trips:open");
const getTrip = makeFunctionReference("trips:get");
const getTripByWebId = makeFunctionReference("trips:getByWebId");
const ensureTripWebId = makeFunctionReference("trips:ensureWebId");
const getTripRevision = makeFunctionReference("trips:getRevision");
const saveTrip = makeFunctionReference("trips:save");
const updateReservationStatus = makeFunctionReference("trips:updateReservationStatus");
const restoreTripRevision = makeFunctionReference("trips:restoreRevision");
const previewPublicShare = makeFunctionReference("publicShares:preview");
const getPublicShareStatus = makeFunctionReference("publicShares:status");
const publishPublicShare = makeFunctionReference("publicShares:publish");
const updatePublicShare = makeFunctionReference("publicShares:update");
const rotatePublicShare = makeFunctionReference("publicShares:rotate");
const revokePublicShare = makeFunctionReference("publicShares:revoke");
const resolvePublicShare = makeFunctionReference("publicShareResolver:resolve");
const listMyInvitations = makeFunctionReference("tripInvitations:listMine");
const inspectTripInvitation = makeFunctionReference("tripInvitations:inspect");
const listTripAccess = makeFunctionReference("tripInvitations:listAccess");
const getLegacyTripInvitationForMigration = makeFunctionReference("tripInvitations:getLegacyInvitationForMigration");
const listTripAccessAudit = makeFunctionReference("tripInvitations:listAudit");
const inviteTripMember = makeFunctionReference("tripInvitations:invite");
const migrateLegacyTripInvitation = makeFunctionReference("tripInvitations:migrateLegacyInvitation");
const resendTripInvitation = makeFunctionReference("tripInvitations:resendInvitation");
const changeTripMemberRole = makeFunctionReference("tripInvitations:changeRole");
const removeTripMember = makeFunctionReference("tripInvitations:removeCollaborator");
const revokeTripInvitation = makeFunctionReference("tripInvitations:revokeInvitation");
const acceptTripInvitation = makeFunctionReference("tripInvitations:accept");
const declineTripInvitation = makeFunctionReference("tripInvitations:decline");
const stageItineraryDraft = makeFunctionReference("itineraryDrafts:stage");
const getItineraryDraft = makeFunctionReference("itineraryDrafts:get");
const saveItineraryDraft = makeFunctionReference("itineraryDrafts:save");
const discardItineraryDraft = makeFunctionReference("itineraryDrafts:discard");

function requireValue(value, message) {
  if (!value) throw new Error(message);
  return value;
}

function itineraryWithLocale(itinerary, fallback = DEFAULT_LOCALE) {
  if (!itinerary || typeof itinerary !== "object" || Array.isArray(itinerary)) {
    return itinerary;
  }
  return {
    ...itinerary,
    locale: canonicalLocale(itinerary.locale, fallback),
  };
}

function localeForTrip(trip) {
  return canonicalLocale(
    trip?.locale,
    canonicalLocale(trip?.snapshot?.locale, DEFAULT_LOCALE),
  );
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
    async bootstrap() {
      return client().mutation(bootstrapSession, {});
    },

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
        webId: result.trip.webId,
        locale: localeForTrip(result.trip),
        role: result.trip.role,
        version: result.trip.currentVersion,
        itinerary: itineraryWithLocale(result.trip.snapshot, localeForTrip(result.trip)),
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
        webId: trip.webId,
        locale: localeForTrip(trip),
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
        webId: trip.webId,
        locale: localeForTrip(trip),
        role: trip.role,
        version: trip.currentVersion,
        itinerary: itineraryWithLocale(trip.snapshot, localeForTrip(trip)),
        revisions: trip.revisions.map((revision) => ({
          version: revision.version,
          reason: revision.reason,
          createdAt: revision.createdAt,
        })),
      };
    },

    async getByWebId(webId) {
      const trip = await client().query(getTripByWebId, { webId });
      return {
        id: trip._id,
        webId: trip.webId,
        locale: localeForTrip(trip),
        role: trip.role,
        version: trip.currentVersion,
        updatedAt: trip.updatedAt,
        itinerary: itineraryWithLocale(trip.snapshot, localeForTrip(trip)),
        revisions: trip.revisions.map((revision) => ({
          version: revision.version,
          reason: revision.reason,
          createdAt: revision.createdAt,
        })),
      };
    },

    async ensureWebId(tripId) {
      return client().mutation(ensureTripWebId, { tripId });
    },

    async getRevision({ tripId, version }) {
      const revision = await client().query(getTripRevision, { tripId, version });
      return {
        tripId: revision.tripId,
        version: revision.version,
        role: revision.role,
        itinerary: itineraryWithLocale(revision.itinerary),
      };
    },

    async save({ tripId, itinerary, reason, expectedVersion, changeLanguage = false, operationId }) {
      const normalizedItinerary = itineraryWithLocale(itinerary);
      const result = await client().mutation(saveTrip, {
        ...(tripId ? { tripId } : {}),
        itinerary: normalizedItinerary,
        ...(reason ? { reason } : {}),
        ...(expectedVersion !== undefined ? { expectedVersion } : {}),
        ...(changeLanguage ? { changeLanguage: true } : {}),
        operationId,
      });
      return result?.itinerary
        ? { ...result, itinerary: itineraryWithLocale(result.itinerary) }
        : result;
    },

    async stageDraft({
      brief,
      briefHash,
      itinerary,
      itineraryHash,
      operationId,
      protocolHash,
      protocolVersion,
      warnings,
    }) {
      return client().mutation(stageItineraryDraft, {
        brief,
        briefHash,
        itinerary: itineraryWithLocale(itinerary),
        itineraryHash,
        operationId,
        protocolHash,
        protocolVersion,
        warnings,
      });
    },

    async getDraft(draftId) {
      return client().query(getItineraryDraft, { draftId });
    },

    async saveDraft({ draftId, operationId }) {
      return client().mutation(saveItineraryDraft, { draftId, operationId });
    },

    async discardDraft(draftId) {
      return client().mutation(discardItineraryDraft, { draftId });
    },

    async updateReservation({
      tripId,
      dayDate,
      activityId,
      status,
      expectedVersion,
      operationId,
    }) {
      const result = await client().mutation(updateReservationStatus, {
        tripId,
        dayDate,
        activityId,
        status,
        expectedVersion,
        operationId,
      });
      return result?.itinerary
        ? { ...result, itinerary: itineraryWithLocale(result.itinerary) }
        : result;
    },

    async listInvitations() {
      return client().query(listMyInvitations, {});
    },

    async inspectInvitation({ webId, tokenHash }) {
      return publicClient().query(inspectTripInvitation, { webId, tokenHash });
    },

    async listAccess(tripId) {
      return client().query(listTripAccess, { tripId });
    },

    async getLegacyInvitationForMigration({ tripId, collaboratorId }) {
      return client().query(getLegacyTripInvitationForMigration, {
        tripId,
        collaboratorId,
      });
    },

    async listAccessAudit(tripId) {
      return client().query(listTripAccessAudit, { tripId });
    },

    async invite({ tripId, email, role, expiresAt, tokenHash, operationId }) {
      return client().mutation(inviteTripMember, {
        tripId,
        email,
        role,
        ...(expiresAt !== undefined ? { expiresAt } : {}),
        tokenHash,
        operationId,
      });
    },

    async migrateLegacyInvitation({
      tripId,
      collaboratorId,
      tokenHash,
      expiresAt,
      operationId,
    }) {
      return client().mutation(migrateLegacyTripInvitation, {
        tripId,
        collaboratorId,
        tokenHash,
        ...(expiresAt !== undefined ? { expiresAt } : {}),
        operationId,
      });
    },

    async resendInvitation({ tripId, invitationId, tokenHash, expiresAt, operationId }) {
      return client().mutation(resendTripInvitation, {
        tripId,
        invitationId,
        tokenHash,
        ...(expiresAt !== undefined ? { expiresAt } : {}),
        operationId,
      });
    },

    async changeRole({ tripId, collaboratorId, role, operationId }) {
      return client().mutation(changeTripMemberRole, {
        tripId,
        collaboratorId,
        role,
        operationId,
      });
    },

    async removeCollaborator({ tripId, collaboratorId, operationId }) {
      return client().mutation(removeTripMember, {
        tripId,
        collaboratorId,
        operationId,
      });
    },

    async revokeInvitation({ tripId, invitationId, operationId }) {
      return client().mutation(revokeTripInvitation, {
        tripId,
        invitationId,
        operationId,
      });
    },

    async acceptInvitation({ invitationId, tokenHash, operationId }) {
      return client().mutation(acceptTripInvitation, {
        invitationId,
        ...(tokenHash ? { tokenHash } : {}),
        operationId,
      });
    },

    async declineInvitation({ invitationId, tokenHash, operationId }) {
      return client().mutation(declineTripInvitation, {
        invitationId,
        ...(tokenHash ? { tokenHash } : {}),
        operationId,
      });
    },

    async restore({ tripId, version, expectedVersion, operationId }) {
      const result = await client().mutation(restoreTripRevision, {
        tripId,
        version,
        expectedVersion,
        operationId,
      });
      return result?.itinerary
        ? { ...result, itinerary: itineraryWithLocale(result.itinerary) }
        : result;
    },

    async publicPreview(tripId) {
      return client().query(previewPublicShare, { tripId });
    },

    async publicStatus(tripId) {
      const convex = client();
      const [status, trip] = await Promise.all([
        convex.query(getPublicShareStatus, { tripId }),
        convex.query(getTrip, { tripId }),
      ]);
      return status?.summary
        ? {
            ...status,
            summary: {
              ...status.summary,
              locale: localeForTrip(trip),
            },
          }
        : status;
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
