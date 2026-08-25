---
name: sendero-adjust-trip
description: Reorganize an existing Sendero itinerary while preserving confirmed reservations, locked activities, user priorities, realistic travel time, and version history. Use when the user wants to move, replace, remove, add, or reschedule activities or entire days in a saved or current trip.
---

# Adjust a Sendero Trip

1. Reuse the complete current itinerary snapshot when it is already in context. If the user naturally names a trip or destination but no stable ID is in context, call `find_itineraries`; when it returns one match, call `get_itinerary` directly. Only when the trip remains ambiguous, call `list_itineraries` with `purpose: "adjust"`; do not reproduce the list in text or ask the user to type a trip name. Wait for the clickable card selection, collapse it to an inert receipt, then call `get_itinerary` with the exact selected trip ID.
2. Identify the requested change, affected dates, locked activities, and confirmed reservations. Never silently remove a requested activity.
3. Preserve unaffected days. Recheck current opening hours, transport, weather, or availability only where the change depends on them.
4. Recluster affected activities geographically and recalculate their transfers and daily routes.
5. Call `validate_itinerary`, correct blocking errors, and call `render_itinerary` once with the complete updated snapshot.
6. Briefly explain material differences. Call `save_itinerary` only when the user explicitly asked to persist the adjustment; include a concise revision reason.

Do not book, cancel, or change a reservation without explicit confirmation immediately before that external action.

Keep the conversation natural. Never expose internal tool names, stable IDs, serialized payloads, or JSON, and never instruct the user to type a bot-like phrase when a component action is available.
