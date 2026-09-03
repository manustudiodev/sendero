---
name: plan-local-trip
description: Create, research, validate, and visualize a new local-first travel itinerary. Use whenever a user wants to create, plan, organize, or draft a trip, vacation, itinerary, day-by-day schedule, sightseeing plan, or a way to make the most of each travel day, even when they do not mention Sendero. Match indirect Spanish requests such as “viajo a Santiago el mes que viene y quiero un itinerario” as well as requests for local or alternative experiences, weather-aware planning, event discovery, transport and driving constraints, reservation planning, lodging-based travel times, or daily routes. Use the specialized Sendero adjustment or refresh skill for changes to an existing saved itinerary.
---

# Plan a New Local Trip

Create practical plans that balance essential sights with neighborhood life, independent culture, alternative venues, and realistic travel time.

Before starting, read [planning-core.md](references/planning-core.md) completely.
It is the authoritative platform-neutral planning protocol shared by the Sendero
plugin and the authenticated WebMCP page. The workflow below defines the plugin's
tool and component choreography; when guidance overlaps, follow the shared protocol.

## Workflow

### 1. Capture the trip brief

Start from the user's natural-language request. Extract every supplied fact before opening a component or asking a question. Collect or infer:

- The predominant language and the most appropriate BCP 47 locale. Always set `brief.locale` (for example `es`, `es-AR`, `en`, `en-GB`, or `pt-BR`) without asking the user. If there is not enough linguistic evidence, use English.
- Destination, dates, party size, ages when relevant, budget, pace, and interests.
- Known arrival and departure times; preferred daily start/end and meal times.
- Lodging name or address. Use it as the origin and default end point of each day.
- Preferred transport modes, driving-license status, willingness to rent a car,
  accessibility needs, walking tolerance or maximum walking-leg duration, stairs
  and wheelchair constraints, and desired rest frequency.
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

The critical minimum is destination, start date, end date, at least one adult,
and at least one transport mode. All other profile fields are optional
customization: omission means no corresponding constraint, while omitted children
and seniors normalize to zero. Never infer an arrival time, departure time, age,
mobility need, or accessibility requirement from absence. Once the user supplies
an optional value, preserve and enforce it throughout research, generation, and
validation.

Treat a budget as a real constraint when the user supplies an amount. Normalize
the amount, ISO 4217 currency, scope (`total`, `per_person`, or `per_day`), included
categories, and flexibility. Never silently include or exclude lodging and
long-distance transport. If the user only gives a qualitative preference, retain
it as `budget.comfort`; do not invent a monetary cap.

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
- Respect supplied arrival/departure times, daily start/end windows, meal-time
  preferences, maximum walking-leg duration, and rest frequency. Keep arrival and
  departure days lighter when their usable windows are short.
- Model financial costs as ranges in the budget currency. Add `activity.cost` for
  priced activities and meals, and `day.additionalCosts` for non-activity expenses.
  Mark prices as verified only with a direct source and check date. Use `unknown`
  when a useful range cannot be supported; never treat missing costs as free.
- Do not double-count expenses. The server expands per-person costs using the
  itinerary traveller counts and evaluates only the categories listed in
  `budget.includes`.
- Choose transport per leg. Do not plan driving when nobody has a valid license or wants a car.
- If wheelchair or step-free access is requested, verify the relevant accessibility
  facts for each physical venue and store the source with the activity. Unknown
  access is not suitable evidence that the constraint is satisfied.
- Add one useful fallback for weather-sensitive or capacity-limited activities.
- Keep departure and arrival days lighter unless the user requests otherwise.
- Mark fixed activities as locked and preserve them during later changes.
- Give every public venue or activity a precise, recognizable address. Add `latitude` and `longitude` only when both coordinates are backed by a current source; never guess coordinates. Do not add exact lodging coordinates merely to draw a map.
- Use specific, recognizable activity titles and named entrances, meeting points, or viewing areas. Never use vague placeholders such as “desde un sector”, “escoger una ubicación”, “confirmar después”, or “zona por definir” as if they were executable itinerary steps.
- An itinerary item must tell the traveller what to do; it cannot be a research, decision, or preparation task. Never schedule “confirmar el calendario”, “revisar transporte”, “elegir con el anfitrión”, “preparar la logística”, or “ver si se puede entrar”. Confirmation language may appear later in the description only after a concrete recommendation and action are already clear.
- Use the full recognizable event name on first mention. For meals, provide at least one named restaurant, market, or food venue with a real address instead of an undecided neighborhood. Anchor deliberately free time to a named area and give concrete options there; reserve a whole rest day only when recovery is intentional rather than a substitute for missing research.
- Use `activity.description` only for the concise operational context needed to execute the plan: what the stop involves, exactly where to go or meet, how to carry it out, access or timing constraints, and what remains provisional. Explain local terminology and customs for a first-time visitor instead of assuming prior knowledge. Do not turn the description into historical or destination-guide copy.
- Put the source-backed visitor guide in `activity.guide`. Every substantive sightseeing, cultural, food, or event stop needs an overview of 2–4 useful sentences about the place, its context, or why it matters for this trip; `highlights` is optional and may contain at most four concise items; `sources` must contain 1–4 sources that directly support the guide. Prefer official, institutional, or reputable cultural sources. Omit `guide` only for transit, rest, deliberately free time, or an unnamed placeholder; never invent unsupported copy.
- If a future event has not published its final route or schedule, label the plan as provisional but still choose a specific known base or viewing area, explain what the traveller will do there, name the exact unresolved fact, state when and where to recheck it, and include a practical fallback that remains useful if the event is unavailable. Do not disguise missing research as an instruction to “choose” or “verify” later.

Use the canonical structure in [itinerary-schema.md](references/itinerary-schema.md). Once research and itinerary construction are complete, finish through exactly one intent-level facade:

- Set `itinerary.locale` to the prepared brief locale. Write every generated user-visible itinerary field in that language: trip and day titles, summaries, weather and fallback copy, activity titles and descriptions, guide text and highlights, reservation notes, and generic source labels. Keep official place names and other proper nouns in their official form. Do not mix in English or Spanish filler from schema examples.
- Preserve the saved locale on revisions and restored versions unless the user explicitly asks for a different language. If they do, translate the complete user-visible itinerary, update the locale together, and pass `changeLanguage: true` to the save facade. Omit that flag for ordinary revisions.

- If the user explicitly asked to save or otherwise persist the trip, call `save_and_present_trip` once with the complete snapshot and a concise revision reason. It validates strictly, persists the authoritative version, and presents that saved snapshot with its real `tripId`, `version`, and `role`.
- Otherwise call `present_trip` once with the complete snapshot. It validates strictly and presents the final unsaved plan as a deliberately non-editable preview, without `tripId`, `version`, `role`, or any other saved-trip context.

Correct any blocking validation result returned by the facade before trying the same final action again. Do not manually chain `validate_itinerary`, `save_itinerary`, and `render_itinerary` for the ordinary completion path; those tools remain internal or compatibility primitives for narrower diagnostics and recovery.

### 4. Handle reservations safely

For every actionable item, first determine whether the user needs a **reservation** (restaurants, bars, tables, or bookable experiences) or a **ticket** (museums, attractions, concerts, cinema, or events). Store that as `reservation.kind`. Separately classify whether it is `required`, `recommended`, or `optional` in `reservation.requirement`; never use optionality as the item's lifecycle status. Then include the current tracking status, official URL, recommended deadline, cancellation note when known, and what remains unconfirmed. Offer multiple restaurant, cafe, or activity options when the user has not selected one.

The first final itinerary component returned by `present_trip` or `save_and_present_trip` must already contain the complete reservation tracker together with the list, calendar, and routes. Do not add a separate “review reservations” turn, reproduce the reservations as prose, or wait for another research pass merely because the user opens that view.

Reservation and ticket controls inside Sendero change only Sendero's tracking status. **Ya reservé** or **Ya compré** records what the user says they completed; **Reserva cancelada** or **Boleto cancelado** records its local cancellation state. Neither action books, purchases, contacts, nor cancels with the provider. The official link is the explicit handoff to the external provider, and the component must state this boundary.

Do not purchase, book, cancel, or send personal information without explicit confirmation immediately before the external action. A recommendation or draft itinerary is not permission to transact.

### 5. Hand off later changes

If the user moves, adds, removes, replaces, or reschedules activities in an existing saved trip, continue with `sendero-adjust-trip`. If the request is primarily to recheck unstable facts such as weather, events, closures, schedules, transport, or availability, continue with `sendero-refresh-trip`. Do not keep this creation workflow active after that handoff.

## Quality bar

- Distinguish confirmed, likely, provisional, and suggested information.
- Cite time-sensitive sources near the relevant recommendation.
- Avoid impossible overlaps, closed venues, excessive cross-city travel, and unlicensed driving.
- Show approximate travel time and transport for each meaningful leg.
- Keep the visible itinerary concise. Place operational detail in `activity.description`, reservations, routes, and operational sources; keep historical, cultural, and popular context in the separate source-backed `activity.guide`.
