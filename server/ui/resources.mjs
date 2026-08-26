import {
  itineraryWidgetHtml,
  publicShareControlWidgetHtml,
  tripIntakeWidgetHtml,
  tripListWidgetHtml,
  tripRequirementsWidgetHtml,
} from "./generated/widgets.mjs";

export const LEGACY_ITINERARY_UI_URI = "ui://sendero/itinerary-v2.html";
export const LEGACY_ITINERARY_V3_UI_URI = "ui://sendero/itinerary-v3.html";
export const LEGACY_ITINERARY_V4_UI_URI = "ui://sendero/itinerary-v4.html";
export const LEGACY_ITINERARY_V5_UI_URI = "ui://sendero/itinerary-v5.html";
export const ITINERARY_UI_URI = "ui://sendero/itinerary-v6.html";
export const LEGACY_TRIP_INTAKE_UI_URI = "ui://sendero/trip-intake-v2.html";
export const LEGACY_TRIP_INTAKE_V3_UI_URI = "ui://sendero/trip-intake-v3.html";
export const LEGACY_TRIP_INTAKE_V4_UI_URI = "ui://sendero/trip-intake-v4.html";
export const TRIP_INTAKE_UI_URI = "ui://sendero/trip-intake-v5.html";
export const LEGACY_TRIP_LIST_UI_URI = "ui://sendero/trip-list-v1.html";
export const LEGACY_TRIP_LIST_V2_UI_URI = "ui://sendero/trip-list-v2.html";
export const LEGACY_TRIP_LIST_V3_UI_URI = "ui://sendero/trip-list-v3.html";
export const TRIP_LIST_UI_URI = "ui://sendero/trip-list-v4.html";
export const LEGACY_TRIP_REQUIREMENTS_UI_URI = "ui://sendero/trip-requirements-v1.html";
export const LEGACY_TRIP_REQUIREMENTS_V2_UI_URI = "ui://sendero/trip-requirements-v2.html";
export const LEGACY_TRIP_REQUIREMENTS_V3_UI_URI = "ui://sendero/trip-requirements-v3.html";
export const LEGACY_TRIP_REQUIREMENTS_V4_UI_URI = "ui://sendero/trip-requirements-v4.html";
export const LEGACY_TRIP_REQUIREMENTS_V5_UI_URI = "ui://sendero/trip-requirements-v5.html";
export const TRIP_REQUIREMENTS_UI_URI = "ui://sendero/trip-requirements-v6.html";
export const LEGACY_PUBLIC_SHARE_UI_URI = "ui://sendero/public-share-control-v1.html";
export const LEGACY_PUBLIC_SHARE_V2_UI_URI = "ui://sendero/public-share-control-v2.html";
export const LEGACY_PUBLIC_SHARE_V3_UI_URI = "ui://sendero/public-share-control-v3.html";
export const PUBLIC_SHARE_UI_URI = "ui://sendero/public-share-control-v4.html";

const widgetDescriptions = {
  itinerary: "Complete Sendero itinerary with daily list, expandable calendar, route map, and reservation tracker views. Reservation status controls update Sendero only and never book or cancel with a provider. The component is the primary answer; do not summarize its visible contents in prose.",
  intake: "Interactive Sendero trip intake or action menu. The component itself collects or presents the next choice; do not repeat its fields or options in prose.",
  trips: "Interactive saved-trip picker. The component itself presents every matching choice; do not enumerate or describe the trips in prose.",
  requirements: "Interactive form containing every currently missing essential trip detail in one place. The component itself asks the complete question; do not repeat known facts, fields, or next steps in prose.",
  share: "Interactive review, confirmation, status, and receipt for a public read-only trip link. The component is the primary answer; mention only a safety-critical caveat or link fallback not already shown.",
};

function originFrom(value) {
  try {
    return value ? new URL(value).origin : undefined;
  } catch {
    return undefined;
  }
}

export function widgetResource({ uri, html, widgetOrigin, description, prefersBorder = false }) {
  const domain = originFrom(widgetOrigin);
  return {
    contents: [
      {
        uri,
        mimeType: "text/html;profile=mcp-app",
        text: html,
        _meta: {
          "openai/widgetDescription": description,
          ui: {
            prefersBorder,
            ...(domain ? { domain } : {}),
            csp: { connectDomains: [], resourceDomains: [] },
          },
        },
      },
    ],
  };
}

export function itineraryResource(widgetOrigin, uri = ITINERARY_UI_URI) {
  return widgetResource({ uri, html: itineraryWidgetHtml, widgetOrigin, description: widgetDescriptions.itinerary });
}

export function tripIntakeResource(widgetOrigin, uri = TRIP_INTAKE_UI_URI) {
  return widgetResource({ uri, html: tripIntakeWidgetHtml, widgetOrigin, description: widgetDescriptions.intake });
}

export function tripListResource(widgetOrigin, uri = TRIP_LIST_UI_URI) {
  return widgetResource({ uri, html: tripListWidgetHtml, widgetOrigin, description: widgetDescriptions.trips });
}

export function tripRequirementsResource(widgetOrigin, uri = TRIP_REQUIREMENTS_UI_URI) {
  return widgetResource({ uri, html: tripRequirementsWidgetHtml, widgetOrigin, description: widgetDescriptions.requirements });
}

export function publicShareResource(widgetOrigin, uri = PUBLIC_SHARE_UI_URI) {
  return widgetResource({ uri, html: publicShareControlWidgetHtml, widgetOrigin, description: widgetDescriptions.share });
}
