---
name: sendero-my-trips
description: List, select, reopen, and visualize itineraries saved in Sendero, including trips shared with the authenticated user. Use when the user asks to see, find, continue, or open one of their saved trips or its version history.
---

# Open My Sendero Trips

1. Treat explicit recency references such as “mi último viaje,” “el más reciente,” “el último que guardé,” “last saved,” “latest trip,” “most recent,” and natural equivalents as deterministic references to the saved itinerary with the latest update. This intent takes precedence over a different trip already present in conversation. Call `open_trip` once with `selector: "latest_updated"`; do not infer a title or destination and do not open a picker. The facade resolves, loads, and presents the unchanged authoritative snapshot in one read-only action.
2. If `open_trip` reports that no saved trip exists, say briefly that there are no saved trips yet and offer to create one conversationally. Open `render_trip_intake` with `mode: "new"` only if the user accepts the guided path or invokes the optional shortcut.
3. Outside the recency path, reuse the complete current itinerary snapshot when it is already in context and the user is merely continuing it. If the user naturally names a trip or destination, call `open_trip` with that reference and pass any exact start and end dates they supplied. If one trip resolves, the same facade presents it directly with its authoritative `tripId`, `version`, and `role`.
4. When `open_trip` reports a genuinely ambiguous reference, stop: that same result already renders the matching trips as clickable cards. Wait for the selection instead of calling `list_itineraries`. Use `list_itineraries` with `purpose: "open"` only when the user explicitly asks to browse without identifying a trip.
5. Do not repeat the trips in plain text, invent a typed command such as “Open X,” or ask the user to type a trip name. Wait for the component selection.
6. When the component returns a selected trip ID, consume the choice once, collapse the cards to an inert receipt, and call `open_trip` with that exact ID. Never expose the ID in visible prose.
7. In the browse path, if `list_itineraries` is empty, let the component's empty state and **Crear un viaje** action handle the response. Only if the component fails to render, say so briefly and offer to create one. Open `render_trip_intake` with `mode: "new"` only after the user accepts the guided path or invokes the optional shortcut.
8. Opening an unchanged saved trip is always read-only. Do not call `validate_itinerary`, `save_itinerary`, `render_itinerary`, or another mutation after a successful `open_trip`; the initial presentation already includes reservations and the complete current snapshot.
9. Mention available version history only when useful. Call `restore_itinerary_version` only after the user selects an exact version and explicitly asks to restore it. A successful restore creates a new authoritative revision and presents that restored snapshot in the same result; do not follow it with `get_itinerary` or `render_itinerary`.

`find_itineraries`, `list_itineraries`, `get_itinerary`, `validate_itinerary`, `render_itinerary`, and `save_itinerary` remain internal or compatibility primitives. `list_itineraries` is retained only for explicit browsing without a reference; `open_trip` owns its own ambiguity UI. Do not compose the other primitives into the ordinary user-facing open flow when an intent-level facade expresses it directly.

Do not expose trips that the authenticated user cannot access. Do not treat opening or viewing a trip as permission to modify it. Keep internal tool names, stable IDs, and structured payloads out of user-visible messages.
