---
name: sendero-conversation-orchestrator
description: Route broad, ambiguous, resumed, or multi-step Sendero conversations into the correct create, open, adjust, refresh, or public-sharing workflow while preserving component state and conversational continuity. Use when the user invokes Sendero without a single clear specialized workflow, changes intent mid-conversation, or continues after a Sendero component selection. Do not replace a clearly matched specialized Sendero skill.
---

# Sendero Conversation Orchestrator

Keep Sendero feeling like one continuous travel-planning conversation. Route the latest user intent to the narrowest existing Sendero workflow and keep only one unresolved component interaction active.

## Route the current intent

| Current intent | Entry action | Specialized workflow |
| --- | --- | --- |
| Create or start a trip | Extract every supplied trip fact and call `prepare_trip_brief`; continue directly when ready or render one grouped requirements component for all known critical gaps | `plan-local-trip` |
| Ask what Sendero can do or remain genuinely ambiguous | Call `render_trip_intake` with `mode: "menu"` | Wait for the component choice |
| See, find, continue, or open saved trips | Call `open_trip` for an explicit latest, exact, or named reference; its own result handles ambiguity. Use `list_itineraries` with `purpose: "open"` only when the user asks to browse without a reference | `sendero-my-trips` |
| Move, add, remove, replace, or reschedule saved plans | Continue with an exact known trip; otherwise call `list_itineraries` with `purpose: "adjust"` | `sendero-adjust-trip` |
| Recheck weather, events, closures, schedules, transport, or availability | Continue with an exact known trip; otherwise call `list_itineraries` with `purpose: "refresh"` | `sendero-refresh-trip` |
| Publish or share a public read-only link, or update its published copy | Call `share_trip_publicly` once with the human trip reference; preview only when the user explicitly asks to inspect what would be exposed | `sendero-share-trip` |
| Review private access, invite or resend by email, revoke an invitation, change a role, or remove private access | Use the one dedicated access operation that matches the complete request; the complete imperative is authorization and does not need a second confirmation | `sendero-collaborate-trip` |
| Replace or revoke a public link | Resolve the exact saved trip and use the dedicated rotate or revoke action only after the user's explicit request | `sendero-share-trip` |

Resolve trip context in this order:

1. First resolve an explicit recency reference such as “último,” “más reciente,” “el último que guardé,” “last saved,” “latest trip,” “most recent,” or a natural equivalent. It always means the most recently updated saved itinerary, not merely the trip most recently discussed. Call `open_trip` once with `selector: "latest_updated"`, even when another itinerary is already in context. It resolves, loads, and presents the unchanged saved snapshot with authoritative `tripId`, `version`, and `role`. Skip the picker and do not validate, save, or modify anything.
2. If `open_trip` reports no saved trip, say briefly that there are no saved trips yet and offer to create one conversationally. Do not show an empty picker or open the guided intake unless the user asks for it or accepts that path.
3. Otherwise, if the complete current itinerary snapshot is already in context, continue from it without calling `get_itinerary` again. This preserves changes that may not have been saved yet.
4. If the user is opening a named trip or destination but no stable ID is in context, call `open_trip` with that natural reference and any exact dates supplied. If one trip resolves, the facade presents it directly. If the request instead intends to adjust or refresh the trip, the specialized workflow may use the lower-level lookup and load primitives internally so it can produce only the final revised component.
5. If an open reference is ambiguous, stop and wait for the clickable cards already returned by `open_trip`; do not issue a second list call. If no trip is identified because the user explicitly asked to browse, show `list_itineraries` with the purpose that matches the latest intent. For an open selection, call `open_trip` with the selected stable ID; for adjust or refresh, let the specialized workflow load it internally.

The latest explicit user intent selects the workflow; an earlier component `purpose` does not lock the conversation. Preserve the selected trip identity while changing from open to adjust or refresh.

When the user directly matches one specialized workflow, follow that skill without showing Sendero's general menu. The natural conversation is Sendero's primary interface; the `/` entries are optional shortcuts, not required commands. This orchestrator exists for routing and continuity, not to compete with focused skills.

For trip creation, extract the entire brief already present in the conversation before calling `prepare_trip_brief`. If it reports one or several critical gaps, render a single `render_trip_requirements` component containing the complete currently known set as the final action of the turn. Do not ask those fields over several turns and do not add assistant prose after the component. Only a conditionally relevant field may wait for an earlier answer that determines whether it is needed.

Infer and carry `brief.locale` from the user's predominant language for every new trip; never infer language from the destination, and default to English when the language is ambiguous or unsupported. Once an itinerary exists, its saved `locale` governs generated content and component copy across open, adjust, refresh, restore, and share flows. Preserve it unless the user explicitly requests a different language, in which case the new revision must translate all user-visible itinerary copy together and save with `changeLanguage: true`. Omit that flag for ordinary revisions.

## Treat component events as conversation state

- After rendering a form, menu, or trip list, wait for its result instead of restating the controls in text.
- When a component returns a choice, use its exact action and stable `tripId`; do not infer an ID from the title.
- Do not ask the user to type “Abrir X,” repeat a trip name, or confirm the same card selection again.
- Once a choice is made, treat the old component as consumed. Continue the selected path and never reopen its alternatives unless the user explicitly changes intent.
- When a trip form continues with `sendero.stage: "brief_ready"`, its validated brief supersedes the earlier missing-fields result for that interaction. Continue from it without reopening the form or asking for the same fields; only a fresh validation result may prove that something is still missing.
- A one-shot form, card selection, or workflow choice must collapse to a compact inert receipt before continuation. Reopening the old message must not expose active alternatives, and repeated clicks must not create a second continuation.
- List, calendar, routes, reservation tracking, and other reversible itinerary views remain available in the same rendered component. Opening one of those views is not a new conversational command and must not trigger a second prose summary or another research pass.
- Authoritative `tripId`, `version`, and `role` belong only to a saved snapshot presented by `open_trip`, `save_and_present_trip`, or a successful restore. Never pass them to `present_trip`, invent them for an unsaved plan, or treat them as authorization proof.
- If the user changes intent, acknowledge the change briefly and open only the newly relevant surface.

If the latest request is unrelated to Sendero or travel planning, answer it outside this orchestrator and leave the pending Sendero state untouched.

A successful Sendero component is the complete user-facing answer for that turn. End without assistant prose when it already contains the result or question. Only add one short sentence for a blocker, safety-critical caveat, required citation, or next action that is not visible in the component. Never reproduce cards, form fields, itinerary rows, menu options, labels, or known values below it. Component-to-conversation handoffs may pass stable IDs and structured state internally, but visible messages must remain human: never expose tool names, internal IDs, serialized payloads, or JSON.

## Preserve authority boundaries

Widget state is presentation state. It may prove which choice the user clicked, but it does not prove that a trip was saved, shared, restored, booked, cancelled, or otherwise modified. Require the corresponding successful server tool result before claiming any durable change.

A reservation-status control is a narrow Sendero tracking mutation. It may record `confirmed` or `cancelled` only after the user activates that explicit control and the server accepts the current trip version. It does not book, purchase, contact, or cancel with the provider. The component must show this boundary and use the official external link for provider actions.

`open_trip` and `present_trip` are read-only, but they serve different states. `open_trip` presents an unchanged authoritative saved snapshot with its saved-trip context. `present_trip` validates and presents an unsaved result as deliberately non-editable and must receive no `tripId`, `version`, or `role`. `save_and_present_trip` is the normal durable completion path only when the user asked to persist a new trip or revision. `restore_itinerary_version` is a durable action and, after explicit confirmation of the exact version, returns and presents the authoritative restored snapshot as a new revision. A complete imperative such as “publica este viaje”, “invita a Ana como viewer”, “cambia su rol”, or “quítale acceso” is already the explicit authorization required by its specialized workflow; do not ask for a second ritual confirmation. Never infer authorization from an unrelated or incomplete message, and never claim that Sendero booked, purchased, contacted, or cancelled with a provider.

Opening the latest or most recently saved trip is always read-only. The recency wording authorizes only lookup, load, and render; it never authorizes validation, saving a new version, or any mutation.

An instruction such as “move,” “change,” or “replace” authorizes preparing and rendering the requested revision, not persisting it. Save only when the user also asks to save, update the stored trip, or otherwise make the revision durable.

If the loaded trip role is `viewer`, it may still be opened, discussed, and used to draft proposed changes, but explain that it cannot be saved before attempting any write.

`find_itineraries`, `list_itineraries`, `get_itinerary`, `validate_itinerary`, `render_itinerary`, and `save_itinerary` remain internal or compatibility primitives. Use `list_itineraries` only for explicit browsing without a trip reference, because `open_trip` already renders its own ambiguous matches. Use the other primitives only for specialized resolution, diagnostics, or recovery; do not recreate an intent-level facade by chaining them in the ordinary open or completion path.

## Recover without restarting the flow

When a protected tool returns an authentication challenge:

1. Preserve the current intent, purpose, and known trip ID.
2. Describe the action as reconnecting the Sendero integration, not signing into ChatGPT again.
3. Let the host present its reconnect control.
4. Resume the pending step once after reconnection; do not return to the launcher or create a retry loop.

If the component cannot render or its payload is missing, say accurately that the interactive view did not load and offer one concise fallback for the same pending step. Never say “it is shown above” without evidence that the resource rendered.

If a saved-trip list is empty, offer to start a new trip in the conversation; open the guided intake only when the user accepts that path or chose the shortcut. If a tool fails, retain the known intent and stable identifiers, explain the recoverable next action, and do not silently switch workflows.

## Finish each turn cleanly

Present an itinerary only once for the final snapshot of that turn. Use `present_trip` for a validated, non-editable unsaved result without saved-trip context; use `save_and_present_trip` when explicit persistence is part of the request; use `open_trip` for an unchanged saved trip. Keep the accompanying message short and avoid narrating tool mechanics. State what materially changed, what remains provisional, or what decision is needed next.
