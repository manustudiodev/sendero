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
  return compact({ name: name || address, address });
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

function publicActivity(value, dayIndex, activityIndex, privateValues) {
  if (!isRecord(value)) {
    throw new Error(`Invalid public itinerary activity ${dayIndex + 1}.${activityIndex + 1}.`);
  }
  return compact({
    startTime: requiredString(value.startTime, "activity start time"),
    endTime: optionalString(value.endTime),
    title: redactPrivateText(
      requiredString(value.title, "activity title"),
      privateValues,
    ),
    description: redactPrivateText(value.description, privateValues),
    category: redactPrivateText(value.category, privateValues),
    location: publicLocation(value.location, privateValues),
    sourceUrl: publicUrl(value.sourceUrl, privateValues),
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

function buildPublicRoute({ origin, stops, returnToBase, modes }) {
  if (!origin || stops.length === 0) return undefined;
  const destination = returnToBase ? origin : stops.at(-1);
  const waypoints = returnToBase ? stops : stops.slice(0, -1);
  const params = new URLSearchParams({
    api: "1",
    origin,
    destination,
    travelmode: googleTravelMode(modes),
  });
  if (waypoints.length) params.set("waypoints", waypoints.join("|"));
  return {
    origin,
    stops,
    returnToLodging: returnToBase,
    mapUrl: `https://www.google.com/maps/dir/?${params.toString()}`,
  };
}

function publicDay(value, dayIndex, { base, modes, privateValues }) {
  if (!isRecord(value) || !Array.isArray(value.activities)) {
    throw new Error(`Invalid public itinerary day ${dayIndex + 1}.`);
  }
  const activities = value.activities.map((activity, activityIndex) =>
    publicActivity(activity, dayIndex, activityIndex, privateValues),
  );
  const stops = activities
    .map((activity) => activity.location?.address || activity.location?.name)
    .filter(Boolean);
  const returnToBase = !isRecord(value.route) || value.route.returnToLodging !== false;

  return compact({
    date: requiredString(value.date, "day date"),
    title: redactPrivateText(requiredString(value.title, "day title"), privateValues),
    area: redactPrivateText(requiredString(value.area, "day area"), privateValues),
    summary: redactPrivateText(value.summary, privateValues),
    weather: publicWeather(value.weather, privateValues),
    fallback: redactPrivateText(value.fallback, privateValues),
    activities,
    // Never copy a private route origin, stop list, duration, or Maps URL.
    route: buildPublicRoute({ origin: base, stops, returnToBase, modes }),
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
  const destination = redactPrivateText(
    requiredString(snapshot.destination, "destination"),
    privateValues,
    "Destino",
  );
  const rawBaseArea = isRecord(snapshot.lodging) ? optionalString(snapshot.lodging.area) : undefined;
  const baseArea = rawBaseArea && !containsPrivateText(rawBaseArea, privateValues)
    ? rawBaseArea
    : undefined;
  const modes = isRecord(snapshot.transport) && Array.isArray(snapshot.transport.modes)
    ? [...new Set(snapshot.transport.modes.filter((mode) => TRANSPORT_MODES.has(mode)))]
    : [];
  if (modes.length === 0) modes.push("public_transit");
  const base = baseArea || destination;
  const sources = Array.isArray(snapshot.sources)
    ? snapshot.sources.map((source) => publicSource(source, privateValues)).filter(Boolean)
    : [];

  return compact({
    schemaVersion: 1,
    title: redactPrivateText(
      requiredString(snapshot.title, "title"),
      privateValues,
      "Viaje compartido",
    ),
    destination,
    startDate: requiredString(snapshot.startDate, "start date"),
    endDate: requiredString(snapshot.endDate, "end date"),
    baseArea,
    transport: { modes },
    days: snapshot.days.map((day, dayIndex) =>
      publicDay(day, dayIndex, { base, modes, privateValues }),
    ),
    sources: sources.length ? sources : undefined,
  });
}
