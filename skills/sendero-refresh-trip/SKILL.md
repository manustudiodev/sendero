---
name: sendero-refresh-trip
description: Refresh an existing Sendero itinerary using current weather, local events, closures, schedules, transport disruptions, route conditions, and reservation availability. Use when a trip is approaching, conditions may have changed, or the user asks to update, verify, or recheck a saved plan.
---

# Refresh a Sendero Trip

1. Reuse the complete current itinerary snapshot when it is already in context. If the user naturally names a trip or destination but no stable ID is in context, call `find_itineraries`; when it returns one match, call `get_itinerary` directly. Only when the trip remains ambiguous, call `list_itineraries` with `purpose: "refresh"`; do not reproduce the list in text or ask the user to type a trip name. Wait for the clickable card selection, collapse it to an inert receipt, then call `get_itinerary` with the exact selected trip ID.
2. Determine which dates now fall inside a reliable forecast or event horizon.
3. Verify unstable facts with current official sources: weather, events, opening hours, closures, strikes, transport, prices, and reservation rules. Record source URLs and check dates.
4. Preserve confirmed reservations and locked activities. Propose alternatives before moving either one.
5. Update only affected facts and activities, and recalculate daily routes when locations or transport changed.
6. Finish through exactly one intent-level facade. If the user explicitly asked to persist the refresh, call `save_and_present_trip` once with the complete refreshed snapshot and a concise revision reason. Otherwise call `present_trip` once with only the refreshed snapshot. This unsaved refresh is deliberately non-editable: do not pass the source trip's `tripId`, `version`, `role`, or any other saved-trip context. Each facade validates strictly before presenting; correct any blocking result and retry only the same final action. The initial component must already contain the updated reservation tracker and official links; do not produce a second reservation list in prose.
7. Add at most one short sentence only for a material change or uncertainty that the component does not already show; otherwise end the turn after the component. Do not manually chain `validate_itinerary`, `save_itinerary`, and `render_itinerary`; those remain internal or compatibility primitives.

`find_itineraries`, `list_itineraries`, and `get_itinerary` are internal resolution primitives in this workflow. Their chain is justified only when a refresh names a saved trip that is not already loaded, because Sendero needs the authoritative source snapshot without presenting an unchanged intermediate itinerary. Keep the picker only for genuine ambiguity.

Label seasonal expectations, provisional events, and unconfirmed availability clearly. A Sendero status control updates only the trip's local tracker; never claim that a provider reservation was made or cancelled.

Keep the conversation natural. Never expose internal tool names, stable IDs, serialized payloads, or JSON, and never instruct the user to type a bot-like phrase when a component action is available.
