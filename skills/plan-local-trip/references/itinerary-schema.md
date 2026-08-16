# Canonical itinerary structure

Use this shape when calling `validate_itinerary` and `render_itinerary`. Optional fields may be omitted when they are genuinely unknown.

```json
{
  "title": "Seven days in Lisbon",
  "destination": "Lisbon, Portugal",
  "startDate": "2026-09-04",
  "endDate": "2026-09-10",
  "lodging": {
    "label": "Apartment",
    "address": "Rua example 1, Lisbon"
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
          "id": "check-in",
          "startTime": "15:00",
          "endTime": "16:00",
          "title": "Check in",
          "category": "logistics",
          "locked": true,
          "location": {
            "name": "Apartment",
            "address": "Rua example 1, Lisbon"
          },
          "reservation": {
            "status": "confirmed",
            "note": "Host has confirmed the arrival time"
          },
          "travelToNext": {
            "mode": "walk",
            "durationMinutes": 12,
            "summary": "Walk downhill"
          }
        }
      ],
      "route": {
        "origin": "Rua example 1, Lisbon",
        "stops": ["Praca do Comercio, Lisbon"],
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
- Reservation: `not_needed`, `suggested`, `pending`, `confirmed`.
- Transport modes: `walk`, `bike`, `public_transit`, `taxi`, `car`, `train`, `boat`, `other`.

## Invariants

- Use ISO dates and 24-hour times.
- Keep every day within the trip range and order days chronologically.
- Give every activity a stable ID so follow-up changes can refer to it.
- Mark existing reservations and fixed commitments as locked.
- Keep URLs absolute and user-openable.
- Include an address or recognizable place for route stops whenever possible.
