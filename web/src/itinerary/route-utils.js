const provisionalStopPattern = /(?:base|alojamiento|hospedaje)\s+(?:provisional|por decidir)|(?:provisional|por decidir)\s+(?:base|alojamiento|hospedaje)/i;

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
  const preferred = modes.find((mode) => ["walk", "bike", "public_transit", "train", "taxi", "car"].includes(mode));
  if (preferred === "bike") return "bicycling";
  if (preferred === "public_transit" || preferred === "train") return "transit";
  if (preferred === "taxi" || preferred === "car") return "driving";
  return "walking";
}

function confirmedLodgingAddress(itinerary) {
  if (itinerary?.lodging?.status !== "confirmed" || !normalizedText(itinerary.lodging.address)) return "";
  return googlePlaceQuery(itinerary.lodging.address, itinerary.destination);
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

export function buildDayRouteUrls(itinerary, day) {
  const stops = routeStopsForDay(day).map((stop) => googlePlaceQuery(stop, itinerary?.destination));
  if (!stops.length) return [];
  const lodgingAddress = confirmedLodgingAddress(itinerary);
  const shouldReturnToLodging = Boolean(day?.route?.returnToLodging && lodgingAddress);
  const routeStops = shouldReturnToLodging ? [lodgingAddress, ...stops, lodgingAddress] : stops;
  if (routeStops.length === 1) {
    const params = new URLSearchParams({ api: "1", query: routeStops[0] });
    return [`https://www.google.com/maps/search/?${params}`];
  }
  const urls = [];
  for (let start = 0; start < routeStops.length - 1; start += 4) {
    const segment = routeStops.slice(start, start + 5);
    if (segment.length < 2) break;
    urls.push(buildDirectionsUrl(segment, itinerary?.transport?.modes || []));
  }
  return urls;
}

export function buildDayRouteUrl(itinerary, day) {
  return buildDayRouteUrls(itinerary, day)[0] || "";
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

export function coordinateCoverageForDay(itinerary, day) {
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
  const lodgingAddress = confirmedLodgingAddress(itinerary);
  const shouldReturnToLodging = Boolean(day?.route?.returnToLodging && lodgingAddress);
  const lodgingPoint = shouldReturnToLodging
    ? coordinatePoint(itinerary.lodging, "lodging", normalizedText(itinerary.lodging.name) || "Alojamiento")
    : null;
  const requiredCount = activityEntries.length + fallbackStops.length + (shouldReturnToLodging ? 2 : 0);
  const points = shouldReturnToLodging && lodgingPoint
    ? [lodgingPoint, ...activityPoints, { ...lodgingPoint, id: "lodging-return" }]
    : activityPoints;
  return {
    complete: requiredCount > 0 && points.length === requiredCount,
    locatedCount: points.length,
    points,
    requiredCount,
  };
}
