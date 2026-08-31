/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as invitationEmailOutbox from "../invitationEmailOutbox.js";
import type * as invitationEmailOutboxNode from "../invitationEmailOutboxNode.js";
import type * as itineraryDrafts from "../itineraryDrafts.js";
import type * as publicShareResolver from "../publicShareResolver.js";
import type * as publicShares from "../publicShares.js";
import type * as tripAccess from "../tripAccess.js";
import type * as tripInvitations from "../tripInvitations.js";
import type * as tripWrites from "../tripWrites.js";
import type * as trips from "../trips.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  invitationEmailOutbox: typeof invitationEmailOutbox;
  invitationEmailOutboxNode: typeof invitationEmailOutboxNode;
  itineraryDrafts: typeof itineraryDrafts;
  publicShareResolver: typeof publicShareResolver;
  publicShares: typeof publicShares;
  tripAccess: typeof tripAccess;
  tripInvitations: typeof tripInvitations;
  tripWrites: typeof tripWrites;
  trips: typeof trips;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
