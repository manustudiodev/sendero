# Canonical itinerary structure

Use this shape when calling `validate_itinerary` and `render_itinerary`. Optional fields may be omitted when they are genuinely unknown.

```json
{
  "locale": "en-GB",
  "title": "Seven days in Lisbon",
  "destination": "Lisbon, Portugal",
  "startDate": "2026-09-04",
  "endDate": "2026-09-10",
  "lodging": {
    "name": "Apartment",
    "address": "Rua example 1, Lisbon",
    "status": "confirmed"
  },
  "transport": {
    "modes": ["walk", "public_transit", "taxi"],
    "hasLicense": false,
    "wantsCar": false
  },
  "days": [
    {
      "date": "2026-09-04",
      "title": "Arrival and neighborhood walk",
      "area": "Baixa",
      "summary": "A light arrival day close to the lodging.",
      "weather": {
        "status": "forecast",
        "summary": "Mild with possible showers",
        "sourceUrl": "https://example.com/weather",
        "checkedAt": "2026-09-01T12:00:00Z"
      },
      "activities": [
        {
          "id": "museum-visit",
          "startTime": "15:00",
          "endTime": "16:00",
          "title": "Visit the museum",
          "category": "culture",
          "locked": true,
          "description": "Arrive 10 minutes early and allow time for the cloakroom before the one-hour visit.",
          "guide": {
            "overview": "The museum presents a broad view of Portuguese art in a historic palace setting. This visit focuses on the works and rooms that best connect with the day's riverfront context.",
            "highlights": [
              "The museum's best-known collection rooms",
              "Views toward the Tagus from the surrounding quarter"
            ],
            "sources": [
              {
                "label": "Official museum guide",
                "url": "https://example.com/museum-guide",
                "checkedAt": "2026-09-01T12:00:00Z"
              }
            ]
          },
          "location": {
            "name": "Museu Nacional de Arte Antiga",
            "address": "Rua das Janelas Verdes, Lisbon",
            "latitude": 38.7043,
            "longitude": -9.1624
          },
          "reservation": {
            "kind": "ticket",
            "requirement": "required",
            "status": "confirmed",
            "note": "Official ticket received"
          },
          "travelToNext": {
            "mode": "walk",
            "durationMinutes": 12,
            "summary": "Walk toward the river"
          }
        }
      ],
      "route": {
        "origin": "Rua example 1, Lisbon",
        "stops": ["Rua das Janelas Verdes, Lisbon"],
        "returnToLodging": true
      }
    }
  ],
  "sources": [
    {
      "label": "Official venue page",
      "url": "https://example.com/venue",
      "checkedAt": "2026-09-01T12:00:00Z"
    }
  ]
}
```

`locale` is the BCP 47 language tag inferred from the user's predominant language. It is semantically required for every new itinerary, although the server supplies `en` as a compatibility fallback for legacy snapshots. All generated user-visible copy in the snapshot must use this locale consistently; official proper nouns may remain in their original form. Preserve the locale when revising, restoring, opening, or sharing a trip unless the user explicitly requests a language change.

## Activity editorial fields

- `activity.description` is concise logistics and operation: what happens during the stop, arrival or access guidance, timing constraints, meeting details, or other information needed to carry out the plan. Do not use it for historical background, general destination copy, or a mini travel guide.
- `activity.guide` is the source-backed visitor guide for the activity. Omit it when reliable guide material is unavailable; never fill it with unsupported prose.
  - `overview`: required when `guide` is present; 2–4 useful sentences explaining the place, its historical, cultural, architectural, or popular relevance, and why it fits the trip.
  - `highlights`: optional; zero to four concise items worth noticing or understanding during the visit.
  - `sources`: required when `guide` is present; one to four source objects with an absolute `url`, a useful `label`, and `checkedAt` when available. Every material guide claim must be supported by these sources.
- Keep operational claims and their sources separate from guide content. A source may appear in both places only when it genuinely supports both kinds of information.
- When revising an existing itinerary, preserve the complete `activity.guide` for retained activities unless guide content is explicitly verified. If explicit verification proves a claim stale or inaccurate, update only the affected overview, highlights, and supporting sources.

## Status values

- Weather: `forecast`, `seasonal`, `unknown`.
- Reservation or ticket lifecycle: `pending`, `confirmed`, `cancelled`.
- Transport modes: `walk`, `bike`, `public_transit`, `taxi`, `car`, `train`, `boat`, `other`.

Lifecycle status means:

- `pending`: booking or purchase remains to be completed outside Sendero.
- `confirmed`: the user has recorded the reservation as completed.
- `cancelled`: the user has recorded the reservation as cancelled.

Reservation type and necessity are separate from status:

- `kind`: `reservation` for a table, bar, or bookable experience; `ticket` for a museum, attraction, concert, cinema, or event.
- `requirement`: `required`, `recommended`, or `optional`.

Do not encode optionality as lifecycle state in new itineraries. Omit `reservation` entirely when no booking or purchase is needed. The legacy values `not_needed` and `suggested` remain accepted only for old snapshots; `not_needed` stays hidden and `suggested` is normalized to an optional pending item.

Changing `confirmed` or `cancelled` inside the itinerary updates Sendero's tracker only. It never performs the provider transaction. Use `reservation.url` for the official external booking or management page and make that boundary visible.

## Render context for saved trips

`tripId`, `version`, and `role` are not fields of the itinerary snapshot. Supply them alongside the snapshot when calling `render_itinerary` for an authoritative saved trip:

```json
{
  "itinerary": { "title": "...", "days": [] },
  "tripId": "stable trip identifier returned by Sendero",
  "version": 4,
  "role": "owner"
}
```

Only `owner` and `editor` roles may receive reservation-status controls. An unsaved snapshot or a `viewer` render remains read-only. The server still verifies every mutation; these render fields are continuation context, not authorization proof.

## Invariants

- Use ISO dates and 24-hour times.
- Keep every day within the trip range and order days chronologically.
- Give every activity a stable ID that is unique within its day so follow-up changes and reservation controls target exactly one activity.
- Keep `activity.description` operational and `activity.guide` editorial and source-backed according to the contract above.
- Mark existing reservations and fixed commitments as locked.
- Keep URLs absolute and user-openable.
- Use only `http://` or `https://` URLs for sources, reservations, and maps.
- Include an address or recognizable place for route stops whenever possible.
- For public activity locations, include both `latitude` and `longitude` only when they were verified from a source; omit both when uncertain. Never invent coordinates, and never expose an exact lodging coordinate in a public snapshot.
- Build daily routes from the day's actual activity locations. A provisional neighborhood or undecided lodging is context, not an activity stop and never the final destination. Preserve an explicit return to lodging only when an exact confirmed lodging address exists.
- Sendero rebuilds `route.mapUrl` and `route.mapUrls` from those canonical stops. `mapUrls` contains consecutive mobile-safe route segments when one Google Maps URL cannot carry the full day; do not copy stale links or durations into a revised route.
