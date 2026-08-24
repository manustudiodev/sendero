---
name: sendero-adjust-trip
description: Reorganize an existing Sendero itinerary while preserving confirmed reservations, locked activities, user priorities, realistic travel time, and version history. Use when the user wants to move, replace, remove, add, or reschedule activities or entire days in a saved or current trip.
---

# Adjust a Sendero Trip

1. If the trip is not already in context, call `list_itineraries`, let the user choose when ambiguous, then call `get_itinerary`.
2. Identify the requested change, affected dates, locked activities, and confirmed reservations. Never silently remove a requested activity.
3. Preserve unaffected days. Recheck current opening hours, transport, weather, or availability only where the change depends on them.
4. Recluster affected activities geographically and recalculate their transfers and daily routes.
5. Call `validate_itinerary`, correct blocking errors, and call `render_itinerary` once with the complete updated snapshot.
6. Briefly explain material differences. Call `save_itinerary` only when the user explicitly asked to persist the adjustment; include a concise revision reason.

Do not book, cancel, or change a reservation without explicit confirmation immediately before that external action.
