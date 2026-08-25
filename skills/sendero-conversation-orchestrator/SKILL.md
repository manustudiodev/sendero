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
| See, find, continue, or open saved trips | Open an exact known trip directly; otherwise call `list_itineraries` with `purpose: "open"` | `sendero-my-trips` |
| Move, add, remove, replace, or reschedule saved plans | Continue with an exact known trip; otherwise call `list_itineraries` with `purpose: "adjust"` | `sendero-adjust-trip` |
| Recheck weather, events, closures, schedules, transport, or availability | Continue with an exact known trip; otherwise call `list_itineraries` with `purpose: "refresh"` | `sendero-refresh-trip` |
| Share a read-only link, update its published copy, replace the link, or revoke it | Resolve the exact saved trip, then preview the sanitized public copy before any first publication or update | `sendero-share-trip` |

Resolve trip context in this order:

1. If the complete current itinerary snapshot is already in context, continue from it without calling `get_itinerary` again. This preserves changes that may not have been saved yet.
2. If the user names a trip or destination but no stable ID is in context, call `find_itineraries`. If it returns one match, skip the picker and call `get_itinerary` with that stable ID.
3. If the reference is ambiguous or no trip is identified, show `list_itineraries` with the purpose that matches the latest intent and let the user choose a clickable card.

The latest explicit user intent selects the workflow; an earlier component `purpose` does not lock the conversation. Preserve the selected trip identity while changing from open to adjust or refresh.

When the user directly matches one specialized workflow, follow that skill without showing Sendero's general menu. The natural conversation is Sendero's primary interface; the `/` entries are optional shortcuts, not required commands. This orchestrator exists for routing and continuity, not to compete with focused skills.

For trip creation, extract the entire brief already present in the conversation before calling `prepare_trip_brief`. If it reports one or several critical gaps, render a single `render_trip_requirements` component containing the complete currently known set. Do not ask those fields over several turns. Only a conditionally relevant field may wait for an earlier answer that determines whether it is needed.

## Treat component events as conversation state

- After rendering a form, menu, or trip list, wait for its result instead of restating the controls in text.
- When a component returns a choice, use its exact action and stable `tripId`; do not infer an ID from the title.
- Do not ask the user to type “Abrir X,” repeat a trip name, or confirm the same card selection again.
- Once a choice is made, treat the old component as consumed. Continue the selected path and never reopen its alternatives unless the user explicitly changes intent.
- A one-shot form, card selection, or workflow choice must collapse to a compact inert receipt before continuation. Reopening the old message must not expose active alternatives, and repeated clicks must not create a second continuation.
- If the user changes intent, acknowledge the change briefly and open only the newly relevant surface.

If the latest request is unrelated to Sendero or travel planning, answer it outside this orchestrator and leave the pending Sendero state untouched.

Component content and assistant prose must complement each other. Do not reproduce cards, form fields, itinerary rows, or menu options below the component. Add only a necessary assumption, conflict, result, or next question. Component-to-conversation handoffs may pass stable IDs and structured state internally, but visible messages must remain human: never expose tool names, internal IDs, serialized payloads, or JSON.

## Preserve authority boundaries

Widget state is presentation state. It may prove which choice the user clicked, but it does not prove that a trip was saved, shared, restored, booked, cancelled, or otherwise modified. Require the corresponding successful server tool result before claiming any durable change.

Opening, validating, rendering, or previewing a public projection is read-only. Call `save_itinerary` only when the user asked to persist a new trip or revision. Never book, purchase, cancel, publish, rotate, revoke, invite, restore, or send personal information without the explicit confirmation required by the specialized workflow.

An instruction such as “move,” “change,” or “replace” authorizes preparing and rendering the requested revision, not persisting it. Save only when the user also asks to save, update the stored trip, or otherwise make the revision durable.

If the loaded trip role is `viewer`, it may still be opened, discussed, and used to draft proposed changes, but explain that it cannot be saved before attempting any write.

## Recover without restarting the flow

When a protected tool returns an authentication challenge:

1. Preserve the current intent, purpose, and known trip ID.
2. Describe the action as reconnecting the Sendero integration, not signing into ChatGPT again.
3. Let the host present its reconnect control.
4. Resume the pending step once after reconnection; do not return to the launcher or create a retry loop.

If the component cannot render or its payload is missing, say accurately that the interactive view did not load and offer one concise fallback for the same pending step. Never say “it is shown above” without evidence that the resource rendered.

If a saved-trip list is empty, offer to start a new trip in the conversation; open the guided intake only when the user accepts that path or chose the shortcut. If a tool fails, retain the known intent and stable identifiers, explain the recoverable next action, and do not silently switch workflows.

## Finish each turn cleanly

Render an itinerary only after validation and only once for the final snapshot of that turn. Keep the accompanying message short and avoid narrating tool mechanics. State what materially changed, what remains provisional, or what decision is needed next.
