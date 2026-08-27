export interface PublicItinerarySnapshot {
  schemaVersion: 1;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  baseArea?: string;
  transport: { modes: PublicTransportMode[] };
  days: PublicDay[];
  sources?: PublicSource[];
}

export type PublicTransportMode =
  | "walk"
  | "bike"
  | "public_transit"
  | "taxi"
  | "car"
  | "train"
  | "boat"
  | "other";

export interface PublicLocation {
  name: string;
  address?: string;
}

export interface PublicTravel {
  mode: PublicTransportMode;
  durationMinutes: number;
  summary?: string;
}

export interface PublicActivity {
  startTime: string;
  endTime?: string;
  title: string;
  description?: string;
  guide?: PublicGuide;
  category?: string;
  location?: PublicLocation;
  sourceUrl?: string;
  travelToNext?: PublicTravel;
}

export interface PublicGuide {
  overview: string;
  highlights?: string[];
  sources: PublicSource[];
}

export interface PublicWeather {
  status: "forecast" | "seasonal" | "unknown";
  summary: string;
  sourceUrl?: string;
  checkedAt?: string;
}

export interface PublicRoute {
  origin: string;
  stops: string[];
  returnToLodging: boolean;
  mapUrl: string;
}

export interface PublicDay {
  date: string;
  title: string;
  area: string;
  summary?: string;
  weather?: PublicWeather;
  fallback?: string;
  activities: PublicActivity[];
  route?: PublicRoute;
}

export interface PublicSource {
  label: string;
  url: string;
  checkedAt?: string;
}

export function sanitizePublicSnapshot(snapshot: unknown): PublicItinerarySnapshot;
