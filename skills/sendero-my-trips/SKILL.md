---
name: sendero-my-trips
description: List, select, reopen, and visualize itineraries saved in Sendero, including trips shared with the authenticated user. Use when the user asks to see, find, continue, or open one of their saved trips or its version history.
---

# Open My Sendero Trips

1. Reuse the complete current itinerary snapshot when it is already in context. If the user naturally names a trip or destination but no stable ID is in context, call `find_itineraries`. When it returns one match, call `get_itinerary` with that stable ID and skip the picker.
2. Only when no exact trip is known, call `list_itineraries` with `purpose: "open"`. Its component renders accessible trips as clickable cards for disambiguation.
3. Do not repeat the trips in plain text, invent a typed command such as “Open X,” or ask the user to type a trip name. Wait for the component selection.
4. When the component returns a selected trip ID, consume the choice once, collapse the cards to an inert receipt, and call `get_itinerary` with that exact ID. Never expose the ID in visible prose.
5. If no trips exist, let the component's empty state and **Crear un viaje** action handle the response. Only if the component fails to render, say so briefly and offer to create one. Open `render_trip_intake` with `mode: "new"` only after the user accepts the guided path or invokes the optional shortcut.
6. After loading the trip, call `validate_itinerary` and then `render_itinerary` once with its complete current snapshot.
7. Mention available version history only when useful. Call `restore_itinerary_version` only after the user selects an exact version and explicitly asks to restore it.

Do not expose trips that the authenticated user cannot access. Do not treat opening or viewing a trip as permission to modify it. Keep internal tool names, stable IDs, and structured payloads out of user-visible messages.
