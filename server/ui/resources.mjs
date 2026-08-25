import {
  itineraryWidgetHtml,
  publicShareControlWidgetHtml,
  tripIntakeWidgetHtml,
  tripListWidgetHtml,
  tripRequirementsWidgetHtml,
} from "./generated/widgets.mjs";

export const ITINERARY_UI_URI = "ui://sendero/itinerary-v2.html";
export const TRIP_INTAKE_UI_URI = "ui://sendero/trip-intake-v2.html";
export const TRIP_LIST_UI_URI = "ui://sendero/trip-list-v1.html";
export const LEGACY_TRIP_REQUIREMENTS_UI_URI = "ui://sendero/trip-requirements-v1.html";
export const LEGACY_TRIP_REQUIREMENTS_V2_UI_URI = "ui://sendero/trip-requirements-v2.html";
export const TRIP_REQUIREMENTS_UI_URI = "ui://sendero/trip-requirements-v3.html";
export const PUBLIC_SHARE_UI_URI = "ui://sendero/public-share-control-v1.html";

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

export function itineraryResource(widgetOrigin) {
  return widgetResource({ uri: ITINERARY_UI_URI, html: itineraryWidgetHtml, widgetOrigin });
}

export function tripIntakeResource(widgetOrigin) {
  return widgetResource({ uri: TRIP_INTAKE_UI_URI, html: tripIntakeWidgetHtml, widgetOrigin, prefersBorder: true });
}

export function tripListResource(widgetOrigin) {
  return widgetResource({ uri: TRIP_LIST_UI_URI, html: tripListWidgetHtml, widgetOrigin, prefersBorder: true });
}

export function tripRequirementsResource(widgetOrigin, uri = TRIP_REQUIREMENTS_UI_URI) {
  return widgetResource({ uri, html: tripRequirementsWidgetHtml, widgetOrigin });
}

export function publicShareResource(widgetOrigin) {
  return widgetResource({
    uri: PUBLIC_SHARE_UI_URI,
    html: publicShareControlWidgetHtml,
    widgetOrigin,
    prefersBorder: true,
  });
}
