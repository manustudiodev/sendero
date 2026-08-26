---
name: plan-local-trip
description: Create, research, validate, and visualize a new local-first travel itinerary. Use when a user wants a new trip plan, day-by-day schedule, local or alternative experiences, weather-aware planning, event discovery, transport and driving constraints, reservation planning, lodging-based travel times, or daily routes. Use the specialized Sendero adjustment or refresh skill for changes to an existing saved itinerary.
---

# Plan a New Local Trip

Create practical plans that balance essential sights with neighborhood life, independent culture, alternative venues, and realistic travel time.

## Workflow

### 1. Capture the trip brief

Start from the user's natural-language request. Extract every supplied fact before opening a component or asking a question. Collect or infer:

- Destination, dates, party size, ages when relevant, budget, pace, and interests.
- Lodging name or address. Use it as the origin and default end point of each day.
- Preferred transport modes, driving-license status, willingness to rent a car, accessibility needs, and walking tolerance.
- Must-do items, unwanted activities, dietary needs, existing reservations, fixed commitments, and intentionally free time.

Pass the extracted values to `prepare_trip_brief` before deciding what to ask next. Then follow its complete critical-missing-field result:

- If no critical fields are missing, continue directly to research and planning. Do not open an intake form merely because the user said “create a trip.”
- If one or several critical fields are missing, call `render_trip_requirements` once with the normalized brief as the final action of the turn. The server recomputes the complete currently known set and the component presents that full batch in one interaction, preserves known values, and omits fields already answered. End the turn immediately after the component without assistant prose.
- If component UI is unavailable, ask for that same complete batch in one concise message. Do not split destination, dates, party size, transport, or other already-known blockers into successive turns.
- Defer a question only when whether it is needed depends on an answer that is not known yet. For example, ask about a driving licence in the same component when car travel is already selected; otherwise wait until the user chooses a car before asking it.

After the user submits the grouped requirements or the guided intake, disable duplicate submission immediately and replace the editable controls with a compact, inert receipt of what was provided before sending exactly one continuation.

Treat a component continuation marked `sendero.stage: "brief_ready"` as the validated replacement for the earlier missing-fields result from the same interaction. Continue from its complete brief and do not ask for or render those fields again. Only reopen requirements if a fresh `prepare_trip_brief` call on that exact brief still reports critical fields.

Use `render_trip_intake` with `mode: "new"` only when the user deliberately selects the optional guided **Nuevo viaje** shortcut or explicitly asks for the full setup form. Use `mode: "menu"` only when the user asks what Sendero can do or their intent remains genuinely ambiguous. Treat a rendered component as the complete answer for that turn: do not repeat its fields or controls in text, and add no prose afterward unless one short safety-critical caveat is missing from the UI.

Do not block when a safe provisional assumption can be labeled clearly; a neighborhood or clearly identified central base is enough until the exact lodging is known.

Component continuations must carry structured context internally. In visible prose, respond naturally; never show tool names, stable IDs, serialized payloads, JSON, or instructions to type a pseudo-command.

### 2. Research current conditions

Research before making time-sensitive claims:

- Weather by date. Use a forecast only inside the provider's reliable horizon; otherwise label seasonal or historical expectations.
- Official event calendars, local cultural agendas, holidays, closures, demonstrations, and major sporting events.
- Current opening hours, reservation rules, performance schedules, prices, and transport disruptions.
- Local and alternative options such as neighborhood markets, independent venues, live music, contemporary culture, milongas, bodegones, community events, and places residents actually use.

Prefer official sources for operational facts. Use reputable local sources for discovery, then verify important logistics. Preserve a URL and check date for every unstable fact. Never present a provisional event, screening, train, booking, or forecast as confirmed.

### 3. Build a geographically coherent itinerary

- Give the trip a contextual title based on its interests, mood, or purpose. The destination already has its own field, so do not repeat the full place name as the title or use it as a redundant prefix.
- Group each day by area and start from the lodging.
- Mix well-known highlights with local and alternative experiences selected for the user's interests; do not add obscure places merely to appear original.
- Include morning, afternoon, and evening when the trip length and pace allow it.
- Budget realistic visit, meal, transfer, rest, and queue time.
- Choose transport per leg. Do not plan driving when nobody has a valid license or wants a car.
- Add one useful fallback for weather-sensitive or capacity-limited activities.
- Keep departure and arrival days lighter unless the user requests otherwise.
- Mark fixed activities as locked and preserve them during later changes.
- Give every public venue or activity a precise, recognizable address. Add `latitude` and `longitude` only when both coordinates are backed by a current source; never guess coordinates. Do not add exact lodging coordinates merely to draw a map.

Use the canonical structure in [itinerary-schema.md](references/itinerary-schema.md). Call `validate_itinerary` before presenting the result and correct blocking issues. When the user asked to save the trip, save the validated snapshot before the final render so the response provides the authoritative `tripId`, `version`, and `role`; pass those three values with the final snapshot to `render_itinerary`. If the trip remains unsaved, render the complete snapshot without inventing persistence context.

### 4. Handle reservations safely

For every actionable item, first determine whether the user needs a **reservation** (restaurants, bars, tables, or bookable experiences) or a **ticket** (museums, attractions, concerts, cinema, or events). Store that as `reservation.kind`. Separately classify whether it is `required`, `recommended`, or `optional` in `reservation.requirement`; never use optionality as the item's lifecycle status. Then include the current tracking status, official URL, recommended deadline, cancellation note when known, and what remains unconfirmed. Offer multiple restaurant, cafe, or activity options when the user has not selected one.

The first final `render_itinerary` result must already contain the complete reservation tracker together with the list, calendar, and routes. Do not add a separate “review reservations” turn, reproduce the reservations as prose, or wait for another research pass merely because the user opens that view.

Reservation and ticket controls inside Sendero change only Sendero's tracking status. **Ya reservé** or **Ya compré** records what the user says they completed; **Reserva cancelada** or **Boleto cancelado** records its local cancellation state. Neither action books, purchases, contacts, nor cancels with the provider. The official link is the explicit handoff to the external provider, and the component must state this boundary.

Do not purchase, book, cancel, or send personal information without explicit confirmation immediately before the external action. A recommendation or draft itinerary is not permission to transact.

### 5. Hand off later changes

If the user moves, adds, removes, replaces, or reschedules activities in an existing saved trip, continue with `sendero-adjust-trip`. If the request is primarily to recheck unstable facts such as weather, events, closures, schedules, transport, or availability, continue with `sendero-refresh-trip`. Do not keep this creation workflow active after that handoff.

## Quality bar

- Distinguish confirmed, likely, provisional, and suggested information.
- Cite time-sensitive sources near the relevant recommendation.
- Avoid impossible overlaps, closed venues, excessive cross-city travel, and unlicensed driving.
- Show approximate travel time and transport for each meaningful leg.
- Keep the visible itinerary concise; place operational detail in activity notes, reservations, routes, and sources.
