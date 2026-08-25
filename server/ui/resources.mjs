import {
  itineraryWidgetHtml,
  publicShareControlWidgetHtml,
  tripIntakeWidgetHtml,
  tripListWidgetHtml,
  tripRequirementsWidgetHtml,
} from "./generated/widgets.mjs";

export const LEGACY_ITINERARY_UI_URI = "ui://sendero/itinerary-v2.html";
export const ITINERARY_UI_URI = "ui://sendero/itinerary-v3.html";
export const LEGACY_TRIP_INTAKE_UI_URI = "ui://sendero/trip-intake-v2.html";
export const TRIP_INTAKE_UI_URI = "ui://sendero/trip-intake-v3.html";
export const LEGACY_TRIP_LIST_UI_URI = "ui://sendero/trip-list-v1.html";
export const TRIP_LIST_UI_URI = "ui://sendero/trip-list-v2.html";
export const LEGACY_TRIP_REQUIREMENTS_UI_URI = "ui://sendero/trip-requirements-v1.html";
export const LEGACY_TRIP_REQUIREMENTS_V2_UI_URI = "ui://sendero/trip-requirements-v2.html";
export const LEGACY_TRIP_REQUIREMENTS_V3_UI_URI = "ui://sendero/trip-requirements-v3.html";
export const TRIP_REQUIREMENTS_UI_URI = "ui://sendero/trip-requirements-v4.html";
export const LEGACY_PUBLIC_SHARE_UI_URI = "ui://sendero/public-share-control-v1.html";
export const PUBLIC_SHARE_UI_URI = "ui://sendero/public-share-control-v2.html";

function originFrom(value) {
  try {
    return value ? new URL(value).origin : undefined;
  } catch {
    return undefined;
  }
}

export function widgetResource({ uri, html, widgetOrigin, prefersBorder = false }) {
  const domain = originFrom(widgetOrigin);
  return {
    contents: [
      {
        uri,
        mimeType: "text/html;profile=mcp-app",
        text: html,
        _meta: {
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
  return widgetResource({ uri, html: itineraryWidgetHtml, widgetOrigin });
}

export function tripIntakeResource(widgetOrigin, uri = TRIP_INTAKE_UI_URI) {
  return widgetResource({ uri, html: tripIntakeWidgetHtml, widgetOrigin });
}

export function tripListResource(widgetOrigin, uri = TRIP_LIST_UI_URI) {
  return widgetResource({ uri, html: tripListWidgetHtml, widgetOrigin });
}

export function tripRequirementsResource(widgetOrigin, uri = TRIP_REQUIREMENTS_UI_URI) {
  return widgetResource({ uri, html: tripRequirementsWidgetHtml, widgetOrigin });
}

export function publicShareResource(widgetOrigin, uri = PUBLIC_SHARE_UI_URI) {
  return widgetResource({ uri, html: publicShareControlWidgetHtml, widgetOrigin });
}
