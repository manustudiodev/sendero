import { canonicalLocale, localeLanguage } from "./locale.mjs";

const TRANSPORT_MODES = new Set([
  "walk",
  "bike",
  "public_transit",
  "taxi",
  "car",
  "train",
  "boat",
  "other",
]);

const WEATHER_STATUSES = new Set(["forecast", "seasonal", "unknown"]);
const ISO_CHECKED_AT_PATTERN =
  /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z)?$/;

const PUBLIC_SNAPSHOT_COPY = {
  en: {
    destination: "Destination",
    sharedTrip: "Shared trip",
  },
  es: {
    destination: "Destino",
    sharedTrip: "Viaje compartido",
  },
  pt: {
    destination: "Destino",
    sharedTrip: "Viagem compartilhada",
  },
};

function publicSnapshotCopy(locale) {
  return PUBLIC_SNAPSHOT_COPY[localeLanguage(locale)] || PUBLIC_SNAPSHOT_COPY.en;
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requiredString(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid public itinerary ${label}.`);
  }
  return value.trim();
}

function optionalString(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function optionalCheckedAt(value) {
  const checkedAt = optionalString(value);
  if (!checkedAt || !ISO_CHECKED_AT_PATTERN.test(checkedAt)) return undefined;
  return Number.isNaN(Date.parse(checkedAt)) ? undefined : checkedAt;
}

function optionalTimezone(value) {
  const timezone = optionalString(value);
  if (!timezone) return undefined;
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone }).format(0);
    return timezone;
  } catch {
    return undefined;
  }
}

function optionalHttpUrl(value) {
  if (typeof value !== "string") return undefined;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:"
      ? parsed.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

function optionalNonnegativeInteger(value) {
  return Number.isInteger(value) && value >= 0 ? value : undefined;
}

function optionalCoordinate(value, minimum, maximum) {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value >= minimum &&
    value <= maximum
    ? value
    : undefined;
}

function compact(record) {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined),
  );
}

function normalizedWords(value) {
  if (typeof value !== "string") return "";
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    // Malformed URL encoding is treated as ordinary text.
  }
  return decoded
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function containsPrivateText(value, privateValues) {
  const haystack = normalizedWords(value);
  if (!haystack) return false;
  return privateValues.some((privateValue) => {
    const needle = normalizedWords(privateValue);
    return needle && ` ${haystack} `.includes(` ${needle} `);
  });
}

function redactPrivateText(value, privateValues, replacement = "alojamiento") {
  const source = optionalString(value);
  if (!source) return undefined;
  // Drop the whole free-text field to a safe label when it contains a private
  // lodging value. This also covers case, accents, punctuation, and URL encoding
  // without trying to splice potentially ambiguous user-authored text.
  return containsPrivateText(source, privateValues) ? replacement : source;
}

function publicUrl(value, privateValues) {
  const url = optionalHttpUrl(value);
  return url && !containsPrivateText(url, privateValues) ? url : undefined;
}

function publicLocation(value, privateValues) {
  if (!isRecord(value)) return undefined;
  if (
    containsPrivateText(value.name, privateValues) ||
    containsPrivateText(value.address, privateValues)
  ) {
    return undefined;
  }
  const name = optionalString(value.name);
  const address = optionalString(value.address);
  if (!name && !address) return undefined;
  const latitude = optionalCoordinate(value.latitude ?? value.lat, -90, 90);
  const longitude = optionalCoordinate(value.longitude ?? value.lng, -180, 180);
  return compact({
    name: name || address,
    address,
    ...(latitude !== undefined && longitude !== undefined ? { latitude, longitude } : {}),
  });
}

function publicTravel(value, privateValues) {
  if (!isRecord(value) || !TRANSPORT_MODES.has(value.mode)) return undefined;
  const durationMinutes = optionalNonnegativeInteger(value.durationMinutes);
  if (durationMinutes === undefined) return undefined;
  return compact({
    mode: value.mode,
    durationMinutes,
    summary: redactPrivateText(value.summary, privateValues),
  });
}

function publicGuideSource(value, privateValues) {
  if (!isRecord(value)) return undefined;
  const label = optionalString(value.label);
  const url = publicUrl(value.url, privateValues);
  if (!label || containsPrivateText(label, privateValues) || !url) return undefined;
  return compact({ label, url, checkedAt: optionalCheckedAt(value.checkedAt) });
}

function publicGuide(value, privateValues) {
  if (!isRecord(value)) return undefined;
  const overview = optionalString(value.overview);
  if (!overview || containsPrivateText(overview, privateValues)) return undefined;

  const sources = Array.isArray(value.sources)
    ? value.sources.map((source) => publicGuideSource(source, privateValues)).filter(Boolean)
    : [];
  if (sources.length === 0) return undefined;

  const highlights = Array.isArray(value.highlights)
    ? value.highlights
      .map(optionalString)
      .filter((highlight) => highlight && !containsPrivateText(highlight, privateValues))
    : [];

  return compact({
    overview,
    highlights: highlights.length ? highlights : undefined,
    sources,
  });
}

function publicBooking(value) {
  if (!isRecord(value) || value.status === "not_needed") return undefined;
  const required = value.requirement === "required" || !value.requirement;
  return {
    required,
    confirmed: value.status === "confirmed",
  };
}

function publicActivity(value, dayIndex, activityIndex, dayDate, privateValues) {
  if (!isRecord(value)) {
    throw new Error(`Invalid public itinerary activity ${dayIndex + 1}.${activityIndex + 1}.`);
  }
  return compact({
    publicId: `${dayDate}:activity:${activityIndex + 1}`,
    startTime: requiredString(value.startTime, "activity start time"),
    endTime: optionalString(value.endTime),
    title: redactPrivateText(
      requiredString(value.title, "activity title"),
      privateValues,
    ),
    description: redactPrivateText(value.description, privateValues),
    guide: publicGuide(value.guide, privateValues),
    category: redactPrivateText(value.category, privateValues),
    location: publicLocation(value.location, privateValues),
    sourceUrl: publicUrl(value.sourceUrl, privateValues),
    booking: publicBooking(value.reservation),
    travelToNext: publicTravel(value.travelToNext, privateValues),
  });
}

function publicWeather(value, privateValues) {
  if (!isRecord(value) || !WEATHER_STATUSES.has(value.status)) return undefined;
  const summary = redactPrivateText(value.summary, privateValues);
  if (!summary) return undefined;
  return compact({
    status: value.status,
    summary,
    sourceUrl: publicUrl(value.sourceUrl, privateValues),
    checkedAt: optionalCheckedAt(value.checkedAt),
  });
}

function googleTravelMode(modes) {
  const preferred = modes.find((mode) =>
    ["walk", "bike", "public_transit", "train", "taxi", "car"].includes(mode),
  );
  if (preferred === "walk") return "walking";
  if (preferred === "bike") return "bicycling";
  if (preferred === "public_transit" || preferred === "train") return "transit";
  return "driving";
}

function withDestinationContext(value, destination) {
  const cleanValue = optionalString(value);
  if (!cleanValue) return undefined;
  const destinationCity = optionalString(destination)?.split(",")[0]?.trim();
  if (destinationCity && normalizedWords(cleanValue).includes(normalizedWords(destinationCity))) {
    return cleanValue;
  }
  return destination ? `${cleanValue}, ${destination}` : cleanValue;
}

function orderedPublicStops(activities, destination, baseArea) {
  const seen = new Set();
  const stops = [];
  for (const activity of activities) {
    const rawStop = activity.location?.address || activity.location?.name;
    const rawKey = normalizedWords(rawStop);
    if (
      !rawKey ||
      (baseArea && rawKey === normalizedWords(baseArea)) ||
      /\b(base provisional|provisional base|alojamiento provisional|provisional lodging|por decidir|undecided)\b/.test(
        rawKey,
      )
    ) {
      continue;
    }
    const stop = withDestinationContext(rawStop, destination);
    const key = normalizedWords(stop);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    stops.push(stop);
  }
  return stops;
}

function buildPublicRoute({ stops, modes }) {
  if (stops.length === 0) return undefined;
  if (stops.length === 1) {
    const params = new URLSearchParams({ api: "1", query: stops[0] });
    const mapUrl = `https://www.google.com/maps/search/?${params.toString()}`;
    return {
      origin: stops[0],
      stops,
      returnToLodging: false,
      mapUrl,
      mapUrls: [mapUrl],
    };
  }
  const mapUrls = [];
  for (let start = 0; start < stops.length - 1; start += 4) {
    const segment = stops.slice(start, start + 5);
    if (segment.length < 2) break;
    const params = new URLSearchParams({
      api: "1",
      origin: segment[0],
      destination: segment.at(-1),
      travelmode: googleTravelMode(modes),
    });
    if (segment.length > 2) params.set("waypoints", segment.slice(1, -1).join("|"));
    mapUrls.push(`https://www.google.com/maps/dir/?${params.toString()}`);
  }
  return {
    origin: stops[0],
    stops,
    returnToLodging: false,
    mapUrl: mapUrls[0],
    mapUrls,
  };
}

function publicDay(value, dayIndex, { destination, baseArea, modes, privateValues }) {
  if (!isRecord(value) || !Array.isArray(value.activities)) {
    throw new Error(`Invalid public itinerary day ${dayIndex + 1}.`);
  }
  const date = requiredString(value.date, "day date");
  const activities = value.activities.map((activity, activityIndex) =>
    publicActivity(activity, dayIndex, activityIndex, date, privateValues),
  );
  const stops = orderedPublicStops(activities, destination, baseArea);

  return compact({
    date,
    title: redactPrivateText(requiredString(value.title, "day title"), privateValues),
    area: redactPrivateText(requiredString(value.area, "day area"), privateValues),
    summary: redactPrivateText(value.summary, privateValues),
    weather: publicWeather(value.weather, privateValues),
    fallback: redactPrivateText(value.fallback, privateValues),
    activities,
    // Never copy a private route origin, stop list, duration, or Maps URL.
    // Public directions only contain public activity locations and never a lodging/base point.
    route: buildPublicRoute({ stops, modes }),
  });
}

function publicSource(value, privateValues) {
  if (!isRecord(value)) return undefined;
  const label = redactPrivateText(value.label, privateValues);
  const url = publicUrl(value.url, privateValues);
  if (!label || !url) return undefined;
  return compact({ label, url, checkedAt: optionalCheckedAt(value.checkedAt) });
}

/**
 * Build a version-specific public projection from a private Sendero itinerary.
 * This is deliberately an allowlist: unknown and private fields are never copied.
 */
export function sanitizePublicSnapshot(snapshot) {
  if (!isRecord(snapshot) || !Array.isArray(snapshot.days)) {
    throw new Error("Invalid private itinerary snapshot.");
  }

  const privateValues = isRecord(snapshot.lodging)
    ? [snapshot.lodging.name, snapshot.lodging.address].map(optionalString).filter(Boolean)
    : [];
  const locale = canonicalLocale(snapshot.locale);
  const copy = publicSnapshotCopy(locale);
  const destination = redactPrivateText(
    requiredString(snapshot.destination, "destination"),
    privateValues,
    copy.destination,
  );
  const rawBaseArea = isRecord(snapshot.lodging) ? optionalString(snapshot.lodging.area) : undefined;
  const baseArea = rawBaseArea && !containsPrivateText(rawBaseArea, privateValues)
    ? rawBaseArea
    : undefined;
  const modes = isRecord(snapshot.transport) && Array.isArray(snapshot.transport.modes)
    ? [...new Set(snapshot.transport.modes.filter((mode) => TRANSPORT_MODES.has(mode)))]
    : [];
  if (modes.length === 0) modes.push("public_transit");
  const sources = Array.isArray(snapshot.sources)
    ? snapshot.sources.map((source) => publicSource(source, privateValues)).filter(Boolean)
    : [];

  return compact({
    schemaVersion: 1,
    locale,
    title: redactPrivateText(
      requiredString(snapshot.title, "title"),
      privateValues,
      copy.sharedTrip,
    ),
    destination,
    startDate: requiredString(snapshot.startDate, "start date"),
    endDate: requiredString(snapshot.endDate, "end date"),
    timezone: optionalTimezone(snapshot.timezone),
    baseArea,
    transport: { modes },
    days: snapshot.days.map((day, dayIndex) =>
      publicDay(day, dayIndex, { destination, baseArea, modes, privateValues }),
    ),
    sources: sources.length ? sources : undefined,
  });
}
