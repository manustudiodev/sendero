---
name: sendero-refresh-trip
description: Refresh an existing Sendero itinerary using current weather, local events, closures, schedules, transport disruptions, route conditions, and reservation availability. Use when a trip is approaching, conditions may have changed, or the user asks to update, verify, or recheck a saved plan.
---

# Refresh a Sendero Trip

1. If the trip is not already in context, call `list_itineraries`, let the user choose when ambiguous, then call `get_itinerary`.
2. Determine which dates now fall inside a reliable forecast or event horizon.
3. Verify unstable facts with current official sources: weather, events, opening hours, closures, strikes, transport, prices, and reservation rules. Record source URLs and check dates.
4. Preserve confirmed reservations and locked activities. Propose alternatives before moving either one.
5. Update only affected facts and activities, recalculate daily routes when locations or transport changed, then call `validate_itinerary`.
6. Call `render_itinerary` once with the refreshed complete snapshot and summarize material changes and remaining uncertainties.
7. Call `save_itinerary` only when the user explicitly asked to persist the refresh; include a concise revision reason.

Label seasonal expectations, provisional events, and unconfirmed availability clearly. Never claim that a reservation was made.
