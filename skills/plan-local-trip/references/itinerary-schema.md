# Canonical itinerary structure

Use this shape when calling `validate_itinerary` and `render_itinerary`. Optional fields may be omitted when they are genuinely unknown.

```json
{
  "locale": "en-GB",
  "title": "Seven days in Lisbon",
  "destination": "Lisbon, Portugal",
  "startDate": "2026-09-04",
  "endDate": "2026-09-10",
  "travellers": {
    "adults": 2,
    "children": 1,
    "childAges": [8],
    "seniors": 1,
    "seniorAges": [67]
  },
  "arrivalTime": "13:30",
  "departureTime": "18:00",
  "dailySchedule": {
    "earliestStartTime": "09:00",
    "latestEndTime": "21:30",
    "mealTimes": {
      "lunch": "13:00",
      "dinner": "19:30"
    }
  },
  "mobility": {
    "walkingTolerance": "moderate",
    "maxWalkingMinutes": 25,
    "avoidStairs": true,
    "wheelchairAccess": true,
    "restFrequency": "regular"
  },
  "accessibilityNeeds": ["Seating during longer visits"],
  "budget": {
    "amount": 900,
    "currency": "EUR",
    "scope": "total",
    "includes": ["activities", "food", "local_transport"],
    "flexibility": "target",
    "comfort": "medium"
  },
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
          "cost": {
            "category": "activities",
            "status": "verified",
            "currency": "EUR",
            "min": 10,
            "max": 10,
            "basis": "person",
            "sourceUrl": "https://example.com/museum-prices",
            "checkedAt": "2026-09-01T12:00:00Z"
          },
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
          "accessibility": {
            "status": "verified",
            "wheelchairAccessible": true,
            "stepFree": true,
            "seatingAvailable": true,
            "note": "The accessible entrance is on the east side.",
            "sourceUrl": "https://example.com/museum-accessibility",
            "checkedAt": "2026-09-01T12:00:00Z"
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
      "additionalCosts": [
        {
          "id": "daily-transit-pass",
          "label": "Daily public transport pass",
          "category": "local_transport",
          "status": "verified",
          "currency": "EUR",
          "min": 6.8,
          "max": 6.8,
          "basis": "person",
          "sourceUrl": "https://example.com/transit-fares",
          "checkedAt": "2026-09-01T12:00:00Z"
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

## Required minimum and optional profile

- The required brief fields are destination, start date, end date, at least one
  adult, and at least one transport mode.
- All other traveller-profile fields are optional. Omitted `children` and
  `seniors` normalize to zero. Omitted arrival/departure times, daily schedule,
  walking, rest, stairs, wheelchair, and accessibility fields create no matching
  restriction; do not invent values for them.
- Optional fields become enforceable constraints when present. `seniors` is the
  number of older travellers within `adults`, not an additional party count.
  `childAges` and `seniorAges` may be partial when only some ages are known.
- `arrivalTime` limits the first day's earliest activity and `departureTime`
  limits the final day's latest activity. `dailySchedule` applies on every day;
  its meal times are preferences, while its start/end boundaries are hard limits.
- `mobility.maxWalkingMinutes` limits each walking leg. `avoidStairs` and
  `wheelchairAccess` require positive accessibility facts on every physical
  activity location. `unknown` does not satisfy either constraint.
- `activity.accessibility.status` is `verified`, `reported`, or `unknown`.
  Verified facts require an absolute source URL; include `checkedAt` when known.
- Traveller ages, schedule, mobility, accessibility needs, monetary budget, and
  per-activity accessibility details are private planning context and are omitted
  from public share snapshots.

## Budget and costs

- `budget.amount` is a limit or target, not an estimate. Its `scope` is `total`,
  `per_person`, or `per_day`; `flexibility` is `strict`, `target`, or `flexible`.
- `budget.includes` explicitly controls which categories count against the limit:
  `activities`, `food`, `local_transport`, `lodging`,
  `long_distance_transport`, and `other`. Lodging and long-distance transport are
  excluded unless explicitly present.
- `activity.cost` describes the price attached to one scheduled item.
  `day.additionalCosts` contains only expenses not already represented by an
  activity. Never duplicate the same expense in both places.
- A priced item uses `estimated` or `verified`, a single three-letter currency,
  `min`, `max`, and `basis` (`party` or `person`). `verified` also requires a
  direct `sourceUrl`; include `checkedAt` whenever possible.
- Use `free` only when no payment is required. Use `unknown` when no defensible
  range exists. Missing or unknown costs are never treated as zero.
- Sendero derives the included trip range and compares it with the normalized
  budget. A strict budget blocks validation when its range can exceed the cap;
  target and flexible budgets return visible warnings.
- The budget constraint is private trip context and is intentionally omitted from
  public share snapshots.

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
