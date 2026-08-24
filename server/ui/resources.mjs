import { itineraryWidgetHtml, tripIntakeWidgetHtml } from "./generated/widgets.mjs";

export const ITINERARY_UI_URI = "ui://sendero/itinerary-v2.html";
export const TRIP_INTAKE_UI_URI = "ui://sendero/trip-intake-v1.html";

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
