---
name: sendero-refresh-trip
description: Refresh an existing Sendero itinerary using current weather, local events, closures, schedules, transport disruptions, route conditions, and reservation availability. Use when a trip is approaching, conditions may have changed, or the user asks to update, verify, or recheck a saved plan.
---

# Refresh a Sendero Trip

1. Reuse the complete current itinerary snapshot when it is already in context. If the user naturally names a trip or destination but no stable ID is in context, call `find_itineraries`; when it returns one match, call `get_itinerary` directly. Only when the trip remains ambiguous, call `list_itineraries` with `purpose: "refresh"`; do not reproduce the list in text or ask the user to type a trip name. Wait for the clickable card selection, collapse it to an inert receipt, then call `get_itinerary` with the exact selected trip ID.
2. Determine which dates now fall inside a reliable forecast or event horizon.
3. Verify unstable facts with current official sources: weather, events, opening hours, closures, strikes, transport, prices, and reservation rules. Record source URLs and check dates.
4. Preserve confirmed reservations and locked activities. Propose alternatives before moving either one.
5. Update only affected facts and activities, recalculate daily routes when locations or transport changed, then call `validate_itinerary`.
6. Call `render_itinerary` once with the refreshed complete snapshot. Add at most one short sentence only for a material change or uncertainty that the component does not already show; otherwise end the turn after the component.
7. Call `save_itinerary` only when the user explicitly asked to persist the refresh; include a concise revision reason.

Label seasonal expectations, provisional events, and unconfirmed availability clearly. Never claim that a reservation was made.

Keep the conversation natural. Never expose internal tool names, stable IDs, serialized payloads, or JSON, and never instruct the user to type a bot-like phrase when a component action is available.
