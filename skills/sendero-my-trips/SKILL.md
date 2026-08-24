---
name: sendero-my-trips
description: List, select, reopen, and visualize itineraries saved in Sendero, including trips shared with the authenticated user. Use when the user asks to see, find, continue, or open one of their saved trips or its version history.
---

# Open My Sendero Trips

1. Call `list_itineraries`.
2. If no trips exist, say so briefly and call `render_trip_intake` to offer a new trip.
3. If there is one clear match, call `get_itinerary`. If several trips match, present concise choices using title, destination, dates, version, and access role; wait for the selection.
4. After loading the trip, call `validate_itinerary` and then `render_itinerary` once with its complete current snapshot.
5. Mention available version history only when useful. Call `restore_itinerary_version` only after the user selects an exact version and explicitly asks to restore it.

Do not expose trips that the authenticated user cannot access. Do not treat opening or viewing a trip as permission to modify it.
