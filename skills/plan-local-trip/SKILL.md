---
name: plan-local-trip
description: Create, research, validate, visualize, and reorganize local-first travel itineraries. Use when a user wants a trip plan, day-by-day schedule, local or alternative experiences, weather-aware planning, event discovery, transport and driving constraints, reservation tracking, lodging-based travel times, daily routes, or changes to an existing itinerary.
---

# Plan Local Trip

Create practical plans that balance essential sights with neighborhood life, independent culture, alternative venues, and realistic travel time. Treat the itinerary as a living plan rather than a one-time answer.

## Workflow

### 1. Capture the trip brief

Collect or infer:

- Destination, dates, party size, ages when relevant, budget, pace, and interests.
- Lodging name or address. Use it as the origin and default end point of each day.
- Preferred transport modes, driving-license status, willingness to rent a car, accessibility needs, and walking tolerance.
- Must-do items, unwanted activities, dietary needs, existing reservations, fixed commitments, and intentionally free time.

When critical details are missing and component UI is available, call `render_trip_intake` once instead of asking several setup questions in plain text. Otherwise ask no more than three concise questions at once. Do not block when a safe provisional assumption can be labeled clearly; a neighborhood or clearly identified central base is enough until the exact lodging is known. Before planning, call `prepare_trip_brief` to expose critical missing fields, assumptions, and incompatible transport choices.

### 2. Research current conditions

Research before making time-sensitive claims:

- Weather by date. Use a forecast only inside the provider's reliable horizon; otherwise label seasonal or historical expectations.
- Official event calendars, local cultural agendas, holidays, closures, demonstrations, and major sporting events.
- Current opening hours, reservation rules, performance schedules, prices, and transport disruptions.
- Local and alternative options such as neighborhood markets, independent venues, live music, contemporary culture, milongas, bodegones, community events, and places residents actually use.

Prefer official sources for operational facts. Use reputable local sources for discovery, then verify important logistics. Preserve a URL and check date for every unstable fact. Never present a provisional event, screening, train, booking, or forecast as confirmed.

### 3. Build a geographically coherent itinerary

- Group each day by area and start from the lodging.
- Mix well-known highlights with local and alternative experiences selected for the user's interests; do not add obscure places merely to appear original.
- Include morning, afternoon, and evening when the trip length and pace allow it.
- Budget realistic visit, meal, transfer, rest, and queue time.
- Choose transport per leg. Do not plan driving when nobody has a valid license or wants a car.
- Add one useful fallback for weather-sensitive or capacity-limited activities.
- Keep departure and arrival days lighter unless the user requests otherwise.
- Mark fixed activities as locked and preserve them during later changes.

Use the canonical structure in [itinerary-schema.md](references/itinerary-schema.md). Call `validate_itinerary` before presenting the result, correct blocking issues, then call `render_itinerary` once with the final snapshot.

### 4. Handle reservations safely

For every reservable item, include status, official URL, recommended deadline, cancellation note when known, and what remains unconfirmed. Offer multiple restaurant, cafe, or activity options when the user has not selected one.

Do not purchase, book, cancel, or send personal information without explicit confirmation immediately before the external action. A recommendation or draft itinerary is not permission to transact.

### 5. Reorganize without losing intent

When weather, availability, delays, or user preferences change:

1. Identify the affected dates and locked items.
2. Preserve confirmed reservations unless the user explicitly permits moving them.
3. Recluster only the affected activities by area and opening hours.
4. Recalculate transfers and daily routes from the lodging.
5. Revalidate operational facts that may have changed.
6. Explain the material differences briefly and render the updated snapshot.

Never silently drop a requested activity. Move it, replace it with an agreed alternative, or list it as unresolved.

## Quality bar

- Distinguish confirmed, likely, provisional, and suggested information.
- Cite time-sensitive sources near the relevant recommendation.
- Avoid impossible overlaps, closed venues, excessive cross-city travel, and unlicensed driving.
- Show approximate travel time and transport for each meaningful leg.
- Keep the visible itinerary concise; place operational detail in activity notes, reservations, routes, and sources.
