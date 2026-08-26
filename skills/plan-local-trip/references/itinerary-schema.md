# Canonical itinerary structure

Use this shape when calling `validate_itinerary` and `render_itinerary`. Optional fields may be omitted when they are genuinely unknown.

```json
{
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
          "location": {
            "name": "Museu Nacional de Arte Antiga",
            "address": "Rua das Janelas Verdes, Lisbon",
            "latitude": 38.7043,
            "longitude": -9.1624
          },
          "reservation": {
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

## Status values

- Weather: `forecast`, `seasonal`, `unknown`.
- Reservation: `not_needed`, `suggested`, `pending`, `confirmed`, `cancelled`.
- Transport modes: `walk`, `bike`, `public_transit`, `taxi`, `car`, `train`, `boat`, `other`.

Reservation status means:

- `not_needed`: no booking or purchase is needed.
- `suggested`: booking is optional but may help.
- `pending`: booking or purchase remains to be completed outside Sendero.
- `confirmed`: the user has recorded the reservation as completed.
- `cancelled`: the user has recorded the reservation as cancelled.

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
- Mark existing reservations and fixed commitments as locked.
- Keep URLs absolute and user-openable.
- Use only `http://` or `https://` URLs for sources, reservations, and maps.
- Include an address or recognizable place for route stops whenever possible.
- For public activity locations, include both `latitude` and `longitude` only when they were verified from a source; omit both when uncertain. Never invent coordinates, and never expose an exact lodging coordinate in a public snapshot.
- Build daily routes from the day's actual activity locations. A provisional neighborhood or undecided lodging is context, not an activity stop and never the final destination. Preserve an explicit return to lodging only when an exact confirmed lodging address exists.
- Sendero rebuilds `route.mapUrl` and `route.mapUrls` from those canonical stops. `mapUrls` contains consecutive mobile-safe route segments when one Google Maps URL cannot carry the full day; do not copy stale links or durations into a revised route.
