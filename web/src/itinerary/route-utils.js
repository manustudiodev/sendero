const provisionalStopPattern = /\b(?:por decidir|undecided|(?:base|zona|alojamiento|hospedaje|lodging)\s+provisional|provisional\s+(?:base|zona|alojamiento|hospedaje|lodging))\b/i;

function normalizedText(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function searchKey(value) {
  return normalizedText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es");
}

function stopKey(value) {
  return searchKey(value);
}

function uniqueStops(values) {
  const seen = new Set();
  return values.filter((value) => {
    const key = stopKey(value);
    if (!key || seen.has(key) || provisionalStopPattern.test(value)) return false;
    seen.add(key);
    return true;
  });
}

function activityStopEntries(day) {
  const seen = new Set();
  return (day?.activities || []).flatMap((activity) => {
    const location = activity?.location;
    if (!location) return [];
    const label = [normalizedText(location.name), normalizedText(location.address)].filter(Boolean).join(" · ");
    const key = stopKey(label);
    if (!key || seen.has(key) || provisionalStopPattern.test(label)) return [];
    seen.add(key);
    return [{ activity, key, label, location }];
  });
}

export function routeStopsForDay(day) {
  const activityStops = activityStopEntries(day).map((entry) => entry.label);
  return activityStops.length ? activityStops : uniqueStops(day?.route?.stops || []);
}

function googlePlaceQuery(stop, destination) {
  const location = normalizedText(stop).replace(/\s*·\s*/g, ", ");
  const context = normalizedText(destination);
  const destinationCity = normalizedText(context.split(",")[0]);
  return context && destinationCity && !searchKey(location).includes(searchKey(destinationCity))
    ? `${location}, ${context}`
    : location;
}

function googleTravelMode(modes = []) {
  const preferred = modes.find((mode) => ["public_transit", "train", "taxi", "car", "bike", "walk"].includes(mode));
  if (preferred === "bike") return "bicycling";
  if (preferred === "public_transit" || preferred === "train") return "transit";
  if (preferred === "taxi" || preferred === "car") return "driving";
  return "walking";
}

function appleTravelMode(modes = []) {
  const preferred = modes.find((mode) => ["public_transit", "train", "taxi", "car", "bike", "walk"].includes(mode));
  if (preferred === "bike") return "cycling";
  if (preferred === "public_transit" || preferred === "train") return "transit";
  if (preferred === "taxi" || preferred === "car") return "driving";
  return "walking";
}

function routeModes(itinerary, day) {
  const activityModes = (day?.activities || [])
    .map((activity) => activity?.travelToNext?.mode)
    .filter(Boolean);
  const candidates = activityModes.length ? activityModes : (itinerary?.transport?.modes || []);
  const priority = ["public_transit", "train", "taxi", "car", "bike", "walk"];
  return priority.filter((mode) => candidates.includes(mode));
}

function confirmedLodgingAddress(itinerary) {
  if (itinerary?.lodging?.status !== "confirmed" || !normalizedText(itinerary.lodging.address)) return "";
  return googlePlaceQuery(itinerary.lodging.address, itinerary.destination);
}

function routeQueriesForDay(itinerary, day) {
  const stops = routeStopsForDay(day).map((stop) => googlePlaceQuery(stop, itinerary?.destination));
  if (!stops.length) return [];
  const lodgingAddress = confirmedLodgingAddress(itinerary);
  const shouldReturnToLodging = Boolean(day?.route?.returnToLodging && lodgingAddress);
  return shouldReturnToLodging ? [lodgingAddress, ...stops, lodgingAddress] : stops;
}

function inlineMapStopsForDay(itinerary, day) {
  const seen = new Set();
  const stops = [];

  for (const activity of day?.activities || []) {
    const location = activity?.location;
    if (!location) continue;

    const name = normalizedText(location.name);
    const address = normalizedText(location.address);
    const label = [name, address].filter(Boolean).join(" · ");
    if (provisionalStopPattern.test(label)) continue;

    const point = coordinatePoint(location, activity.id || label, name || address || "Parada");
    const stop = point
      ? `${point.latitude},${point.longitude}`
      : address
        ? googlePlaceQuery(label || address, itinerary?.destination)
        : "";

    // A named attraction without either coordinates or a canonical address is
    // not precise enough for an embedded route. Returning no map is safer than
    // drawing a plausible-looking route to the wrong place.
    if (!stop) return { complete: false, stops: [] };

    const key = stopKey(stop);
    if (!seen.has(key)) {
      seen.add(key);
      stops.push(stop);
    }
  }

  return { complete: stops.length > 0, stops };
}

function buildDirectionsUrl(stops, modes) {
  const params = new URLSearchParams({
    api: "1",
    origin: stops[0],
    destination: stops.at(-1),
    travelmode: googleTravelMode(modes),
  });
  if (stops.length > 2) params.set("waypoints", stops.slice(1, -1).join("|"));
  return `https://www.google.com/maps/dir/?${params}`;
}

function buildAppleDirectionsUrl(stops, modes) {
  const params = new URLSearchParams({
    source: stops[0],
    destination: stops.at(-1),
    mode: appleTravelMode(modes),
  });
  stops.slice(1, -1).forEach((stop) => params.append("waypoint", stop));
  return `https://maps.apple.com/directions?${params}`;
}

export function buildDayRouteUrls(itinerary, day) {
  const routeStops = routeQueriesForDay(itinerary, day);
  if (!routeStops.length) return [];
  if (routeStops.length === 1) {
    const params = new URLSearchParams({ api: "1", query: routeStops[0] });
    return [`https://www.google.com/maps/search/?${params}`];
  }
  const urls = [];
  for (let start = 0; start < routeStops.length - 1; start += 4) {
    const segment = routeStops.slice(start, start + 5);
    if (segment.length < 2) break;
    urls.push(buildDirectionsUrl(segment, routeModes(itinerary, day)));
  }
  return urls;
}

export function buildDayRouteUrl(itinerary, day) {
  return buildDayRouteUrls(itinerary, day)[0] || "";
}

export function buildDayEmbedMapUrl(apiKey, itinerary, day, { language = "es" } = {}) {
  const key = normalizedText(apiKey);
  const inlineRoute = inlineMapStopsForDay(itinerary, day);
  const routeStops = inlineRoute.complete ? inlineRoute.stops : [];
  if (!key || !routeStops.length || routeStops.length > 22) return "";
  if (routeStops.length === 1) {
    const params = new URLSearchParams({ key, q: routeStops[0], language });
    return `https://www.google.com/maps/embed/v1/place?${params}`;
  }
  const params = new URLSearchParams({
    key,
    origin: routeStops[0],
    destination: routeStops.at(-1),
    mode: googleTravelMode(routeModes(itinerary, day)),
    units: "metric",
    language,
  });
  if (routeStops.length > 2) params.set("waypoints", routeStops.slice(1, -1).join("|"));
  return `https://www.google.com/maps/embed/v1/directions?${params}`;
}

export function buildDayAppleRouteUrls(itinerary, day) {
  const routeStops = routeQueriesForDay(itinerary, day);
  if (!routeStops.length) return [];
  if (routeStops.length === 1) {
    const params = new URLSearchParams({ query: routeStops[0] });
    return [`https://maps.apple.com/search?${params}`];
  }
  const urls = [];
  for (let start = 0; start < routeStops.length - 1; start += 4) {
    const segment = routeStops.slice(start, start + 5);
    if (segment.length < 2) break;
    urls.push(buildAppleDirectionsUrl(segment, routeModes(itinerary, day)));
  }
  return urls;
}

export function buildDayAppleRouteUrl(itinerary, day) {
  return buildDayAppleRouteUrls(itinerary, day)[0] || "";
}

function coordinatePoint(location, id, label) {
  if (!location) return null;
  const rawLatitude = location.latitude ?? location.lat;
  const rawLongitude = location.longitude ?? location.lng;
  if (rawLatitude == null || rawLongitude == null || rawLatitude === "" || rawLongitude === "") return null;
  const latitude = Number(rawLatitude);
  const longitude = Number(rawLongitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null;
  return { id, label, latitude, longitude };
}

export function coordinateStopsForDay(day) {
  return (day?.activities || []).flatMap((activity) => {
    const location = activity?.location;
    const label = normalizedText(location?.name)
      || normalizedText(activity?.title)
      || normalizedText(location?.address)
      || "Parada";
    const point = coordinatePoint(
      location,
      activity.id || `${location?.latitude ?? location?.lat}:${location?.longitude ?? location?.lng}`,
      label,
    );
    return point ? [point] : [];
  });
}

export function coordinateCoverageForDay(_itinerary, day) {
  const activityEntries = activityStopEntries(day);
  const fallbackStops = activityEntries.length ? [] : routeStopsForDay(day);
  const activityPoints = activityEntries.flatMap(({ activity, label, location }) => {
    const point = coordinatePoint(
      location,
      activity.id || `${location.latitude ?? location.lat}:${location.longitude ?? location.lng}`,
      normalizedText(location.name) || normalizedText(activity.title) || label || "Parada",
    );
    return point ? [point] : [];
  });
  const requiredCount = activityEntries.length + fallbackStops.length;
  return {
    complete: requiredCount > 0 && activityPoints.length === requiredCount,
    locatedCount: activityPoints.length,
    points: activityPoints,
    requiredCount,
  };
}
