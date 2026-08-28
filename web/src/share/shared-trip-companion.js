const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const LOCAL_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MAX_READY_AFTER_MINUTES = 720;

export class SharedTripCompanionError extends Error {
  constructor(code, message, { retryable = false } = {}) {
    super(message);
    this.name = "SharedTripCompanionError";
    this.code = code;
    this.retryable = retryable;
  }
}

function trimmed(value) {
  return typeof value === "string" ? value.trim() : "";
}

function finiteTimestamp(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function isoTimestamp(value) {
  const timestamp = finiteTimestamp(value);
  return timestamp ? new Date(timestamp).toISOString() : "";
}

function validTimezone(value) {
  const timezone = trimmed(value);
  if (!timezone) return "";
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone }).format(0);
    return timezone;
  } catch {
    return "";
  }
}

function publicItemId(day, activity, index) {
  const supplied = trimmed(activity?.publicId);
  return supplied || `${day.date}:activity:${index + 1}`;
}

export function decorateSharedItinerary(itinerary) {
  if (!itinerary || typeof itinerary !== "object" || !Array.isArray(itinerary.days)) {
    throw new SharedTripCompanionError("TRIP_NOT_AVAILABLE", "The shared trip is not available.");
  }
  return {
    ...itinerary,
    days: itinerary.days.map((day) => ({
      ...day,
      activities: Array.isArray(day.activities)
        ? day.activities.map((activity, index) => ({
          ...activity,
          publicId: publicItemId(day, activity, index),
        }))
        : [],
    })),
  };
}

function activityType(activity) {
  const category = trimmed(activity.category).toLocaleLowerCase("en");
  if (/breakfast|lunch|dinner|meal|restaurant|cafe|food|desayuno|almuerzo|cena|comida/.test(category)) {
    return "meal";
  }
  if (/transport|transfer|flight|train|bus|taxi|transit|traslado|vuelo/.test(category)) {
    return "transport";
  }
  if (/event|concert|show|theatre|festival|evento|concierto|teatro/.test(category)) {
    return "event";
  }
  if (activity.booking?.required) return "reservation";
  if (/free|break|rest|libre|descanso/.test(category)) return "free_time";
  return "activity";
}

function projectedLocation(location) {
  if (!location || typeof location !== "object") return undefined;
  const label = trimmed(location.name) || trimmed(location.address);
  if (!label) return undefined;
  const latitude = Number(location.latitude ?? location.lat);
  const longitude = Number(location.longitude ?? location.lng);
  return {
    label,
    ...(trimmed(location.address) ? { address: trimmed(location.address) } : {}),
    ...(Number.isFinite(latitude) && Number.isFinite(longitude)
      ? { latitude, longitude }
      : {}),
  };
}

function projectedItem(day, activity) {
  return {
    publicItemId: activity.publicId,
    type: activityType(activity),
    title: activity.title,
    ...(activity.startTime ? { startAt: `${day.date}T${activity.startTime}:00` } : {}),
    ...(activity.endTime ? { endAt: `${day.date}T${activity.endTime}:00` } : {}),
    timezone: validTimezone(day.timezone) || validTimezone(activity.timezone) || null,
    status: "planned",
    booking: {
      required: activity.booking?.required === true,
      confirmed: activity.booking?.confirmed === true,
    },
    ...(projectedLocation(activity.location) ? { location: projectedLocation(activity.location) } : {}),
    ...(trimmed(activity.description) ? { publicDescription: trimmed(activity.description) } : {}),
    ...(activity.travelToNext ? {
      transferToNext: {
        mode: activity.travelToNext.mode || "unknown",
        durationMinutes: Number.isInteger(activity.travelToNext.durationMinutes)
          ? activity.travelToNext.durationMinutes
          : undefined,
      },
    } : {}),
  };
}

export function buildSharedTripProjection(share) {
  const itinerary = decorateSharedItinerary(share?.itinerary);
  const timezone = validTimezone(itinerary.timezone);
  const sourceVersion = Number.isInteger(share?.sourceVersion) ? share.sourceVersion : null;
  const generation = Number.isInteger(share?.generation) ? share.generation : null;
  const publicVersion = sourceVersion !== null && generation !== null
    ? `${sourceVersion}.${generation}`
    : trimmed(share?.publicVersion) || isoTimestamp(share?.updatedAt || share?.publishedAt) || "legacy";
  return {
    trip: {
      publicId: "current-shared-trip",
      title: itinerary.title,
      destinationLabel: itinerary.destination,
      timezone: timezone || null,
      startDate: itinerary.startDate,
      endDate: itinerary.endDate,
      publicVersion,
      updatedAt: isoTimestamp(share?.updatedAt || share?.publishedAt) || null,
    },
    days: itinerary.days.map((day) => ({
      date: day.date,
      label: day.title,
      items: day.activities.map((activity) => ({
        ...projectedItem(day, activity),
        timezone: timezone || null,
      })),
    })),
    capabilities: {
      webmcp: true,
      guestArrivalPreview: Boolean(timezone),
      localViewActions: true,
      canonicalWriteAccess: false,
    },
  };
}

function minutesFromLocalTime(value) {
  const match = LOCAL_TIME_PATTERN.exec(trimmed(value));
  if (!match) {
    throw new SharedTripCompanionError("INVALID_LOCAL_TIME", "Use a local time in HH:mm format.");
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

function timeFromMinutes(value) {
  if (!Number.isInteger(value) || value < 0 || value >= 24 * 60) return null;
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

function localDateTimeFromMinutes(date, value) {
  if (!Number.isInteger(value) || value < 0) return null;
  const nextDate = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(nextDate.valueOf())) return null;
  nextDate.setUTCDate(nextDate.getUTCDate() + Math.floor(value / (24 * 60)));
  const time = timeFromMinutes(value % (24 * 60));
  return time ? `${nextDate.toISOString().slice(0, 10)}T${time}:00` : null;
}

function itemLocalMinutes(item, field) {
  const value = item[field];
  if (!value) return null;
  const time = value.slice(11, 16);
  return LOCAL_TIME_PATTERN.test(time) ? minutesFromLocalTime(time) : null;
}

function initialViewState() {
  return {
    activeView: "list",
    selectedDate: null,
    focusedItemId: null,
    mapBoundsMode: "trip",
    guestPreview: null,
    dimmedItemIds: [],
    highlightedItemIds: [],
    meetingPointItemId: null,
    lastAgentAction: null,
  };
}

function copyViewState(state) {
  return {
    ...state,
    dimmedItemIds: [...state.dimmedItemIds],
    highlightedItemIds: [...state.highlightedItemIds],
  };
}

function contextResult(projection) {
  return {
    trip: { ...projection.trip },
    days: projection.days.map((day) => {
      const timedItems = day.items.filter((item) => item.startAt);
      return {
        date: day.date,
        itemCount: day.items.length,
        ...(timedItems[0]?.startAt ? { firstStartAt: timedItems[0].startAt } : {}),
        ...(timedItems.at(-1)?.endAt ? { lastEndAt: timedItems.at(-1).endAt } : {}),
      };
    }),
    permissions: { view: true, changeLocalView: true, modifyCanonicalTrip: false },
  };
}

export function createSharedTripFacade(share, { onStateChange, now = () => Date.now() } = {}) {
  const itinerary = decorateSharedItinerary(share?.itinerary);
  const projection = buildSharedTripProjection({ ...share, itinerary });
  let viewState = initialViewState();

  function emit(next, toolName) {
    viewState = {
      ...viewState,
      ...next,
      lastAgentAction: toolName
        ? { toolName, executedAt: new Date(now()).toISOString() }
        : viewState.lastAgentAction,
    };
    onStateChange?.(copyViewState(viewState));
    return copyViewState(viewState);
  }

  function dayFor(date) {
    const normalized = trimmed(date);
    if (!ISO_DATE_PATTERN.test(normalized)) {
      throw new SharedTripCompanionError("DATE_OUTSIDE_TRIP", "Use a date from the currently open trip in YYYY-MM-DD format.");
    }
    const day = projection.days.find((candidate) => candidate.date === normalized);
    if (!day) {
      throw new SharedTripCompanionError("DATE_OUTSIDE_TRIP", "That date is not part of the currently open trip.");
    }
    return day;
  }

  function itemFor(publicItemId) {
    const requestedId = trimmed(publicItemId);
    for (const day of projection.days) {
      const item = day.items.find((candidate) => candidate.publicItemId === requestedId);
      if (item) return { day, item };
    }
    throw new SharedTripCompanionError("ITEM_NOT_FOUND", "That item is not part of the currently open trip.");
  }

  return {
    getProjection: () => projection,
    getItinerary: () => itinerary,
    getViewState: () => copyViewState(viewState),
    getContext: () => contextResult(projection),
    getDay(date) {
      const day = dayFor(date);
      return {
        date: day.date,
        timezone: projection.trip.timezone,
        items: day.items,
        warnings: projection.trip.timezone ? [] : [{
          code: "TIMEZONE_UNAVAILABLE",
          message: "This legacy publication does not declare an IANA timezone.",
        }],
      };
    },
    showDayOnMap(date) {
      const day = dayFor(date);
      const state = emit({
        activeView: "routes",
        selectedDate: day.date,
        focusedItemId: null,
        mapBoundsMode: "day",
      }, "show_day_on_map");
      return {
        selectedDate: state.selectedDate,
        focusedItemId: state.focusedItemId,
        mapMode: state.mapBoundsMode,
        affectedItemIds: day.items.map((item) => item.publicItemId),
        canonicalTripChanged: false,
      };
    },
    focusItem(publicItemId) {
      const { day, item } = itemFor(publicItemId);
      const state = emit({
        activeView: "routes",
        selectedDate: day.date,
        focusedItemId: item.publicItemId,
        mapBoundsMode: "item",
        highlightedItemIds: [item.publicItemId],
      }, "focus_itinerary_item");
      return {
        selectedDate: state.selectedDate,
        focusedItemId: state.focusedItemId,
        mapMode: state.mapBoundsMode,
        affectedItemIds: [item.publicItemId],
        item: { publicItemId: item.publicItemId, title: item.title, date: day.date },
        canonicalTripChanged: false,
      };
    },
    previewGuestArrival(input = {}) {
      const day = dayFor(input.date);
      if (!projection.trip.timezone) {
        throw new SharedTripCompanionError(
          "TIMEZONE_UNAVAILABLE",
          "This shared publication needs an IANA timezone before an arrival preview can be calculated.",
        );
      }
      const arrivalMinutes = minutesFromLocalTime(input.arrivalLocalTime);
      if (!Number.isInteger(input.readyAfterMinutes)
        || input.readyAfterMinutes < 0
        || input.readyAfterMinutes > MAX_READY_AFTER_MINUTES) {
        throw new SharedTripCompanionError(
          "INVALID_READY_AFTER_MINUTES",
          `readyAfterMinutes must be an integer between 0 and ${MAX_READY_AFTER_MINUTES}.`,
        );
      }
      if (input.originLabel !== undefined
        && (typeof input.originLabel !== "string" || trimmed(input.originLabel).length > 120)) {
        throw new SharedTripCompanionError("INVALID_ORIGIN_LABEL", "originLabel must be 120 characters or fewer.");
      }
      const originLabel = trimmed(input.originLabel);

      const availableMinutes = arrivalMinutes + input.readyAfterMinutes;
      const availableFrom = localDateTimeFromMinutes(day.date, availableMinutes);
      const availableLocalTime = availableFrom?.slice(11, 16) || null;
      const missedItemIds = [];
      const unreachableItemIds = [];
      const reachableItems = [];

      for (const item of day.items) {
        const start = itemLocalMinutes(item, "startAt");
        const end = itemLocalMinutes(item, "endAt");
        if (start === null) continue;
        if ((end !== null && end <= availableMinutes) || (end === null && start < availableMinutes)) {
          missedItemIds.push(item.publicItemId);
        } else if (start < availableMinutes) {
          unreachableItemIds.push(item.publicItemId);
        } else {
          reachableItems.push(item);
        }
      }

      const earliestJoinable = reachableItems.find((item) => item.location) || reachableItems[0];
      const previewId = `arrival:${day.date}:${trimmed(input.arrivalLocalTime)}:${input.readyAfterMinutes}`;
      const preview = {
        previewId,
        date: day.date,
        timezone: projection.trip.timezone,
        availableFrom,
        ...(originLabel ? { originLabel } : {}),
        missedItemIds,
        unreachableItemIds,
        reachableItemIds: reachableItems.map((item) => item.publicItemId),
        ...(earliestJoinable ? {
          earliestJoinableItem: {
            publicItemId: earliestJoinable.publicItemId,
            title: earliestJoinable.title,
            ...(earliestJoinable.startAt ? { startAt: earliestJoinable.startAt } : {}),
            ...(earliestJoinable.location ? { location: earliestJoinable.location } : {}),
            ...(availableFrom ? { estimatedReadyAt: availableFrom } : {}),
          },
        } : {}),
        rationale: [
          `The guest is ready at ${availableFrom || "an unavailable local time"} in ${projection.trip.timezone}.`,
          `${missedItemIds.length + unreachableItemIds.length} earlier item(s) are not treated as joinable.`,
          earliestJoinable
            ? `The first future published item is ${earliestJoinable.title}.`
            : "No future published item is available as a meeting point.",
        ],
        confidence: "schedule_only",
        uiApplied: true,
        canonicalTripChanged: false,
      };

      emit({
        activeView: "routes",
        selectedDate: day.date,
        focusedItemId: earliestJoinable?.publicItemId || null,
        mapBoundsMode: "guest_preview",
        guestPreview: preview,
        dimmedItemIds: [...missedItemIds, ...unreachableItemIds],
        highlightedItemIds: earliestJoinable ? [earliestJoinable.publicItemId] : [],
        meetingPointItemId: earliestJoinable?.publicItemId || null,
      }, "preview_guest_arrival");
      return preview;
    },
    clearGuestPreview() {
      const state = emit({
        focusedItemId: null,
        mapBoundsMode: viewState.selectedDate ? "day" : "trip",
        guestPreview: null,
        dimmedItemIds: [],
        highlightedItemIds: [],
        meetingPointItemId: null,
      }, "clear_guest_preview");
      return {
        selectedDate: state.selectedDate,
        focusedItemId: state.focusedItemId,
        mapMode: state.mapBoundsMode,
        affectedItemIds: [],
        canonicalTripChanged: false,
      };
    },
  };
}

export function siteToolErrorResult(error, publicVersion) {
  const expected = error instanceof SharedTripCompanionError;
  return {
    ok: false,
    error: {
      code: expected ? error.code : "UNEXPECTED_ERROR",
      message: expected ? error.message : "The shared trip companion could not complete that action.",
      retryable: expected ? error.retryable : false,
      ...(publicVersion ? { currentPublicVersion: publicVersion } : {}),
    },
  };
}
