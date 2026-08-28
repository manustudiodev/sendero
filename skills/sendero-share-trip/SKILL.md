---
name: sendero-share-trip
description: Publish, inspect, update, rotate, or revoke a secure read-only Sendero itinerary link for people who may not use ChatGPT or have a Sendero account. Use for public-link sharing. Do not use when the user wants to invite a collaborator by email as an editor or authenticated viewer.
---

# Share a Sendero Trip Publicly

Create a deliberate, read-only projection of a saved trip. The private trip remains authoritative; the public page is a frozen copy that changes only after an explicit update.

## Distinguish public links from collaboration

- A request such as “send my friend a link,” “share this with someone without ChatGPT,” or “make a view-only page” means public-link sharing.
- A request to add a named person by email as an editor or authenticated viewer means collaborator invitation instead.
- If the intent remains ambiguous and the difference matters, ask one short natural-language question. Never expose tool names or implementation details.

Resolve the trip exactly as the other saved-trip workflows do: reuse the current stable trip ID, search a natural title or destination when exact, and show clickable trip cards only when disambiguation is genuinely necessary.

## Publish or update in one direct action

When the owner explicitly says “compártelo”, “publica mi último viaje”, “crea un enlace público”, “actualiza la versión pública”, or an equivalent imperative, call `share_trip_publicly` once with the human trip reference and one fresh operation ID. The request itself is authorization. Do not render a preview first, do not ask “are you sure?”, and do not compose lookup, preview, publish, or update primitives around the facade.

The facade resolves an exact ID, a latest or last-saved reference, a natural trip name or destination, and any exact dates internally. It also derives the sanitized, version-protected public snapshot and decides whether to create a new link or update the existing public copy. Reuse the same operation ID unchanged after reconnect or an exact transient retry. If several saved trips genuinely match, ask which one the owner means before retrying; never ask for a stable trip ID.

Only call `preview_public_share` when the owner explicitly asks to inspect what would be exposed before deciding, such as “muéstrame primero la vista pública” or “quiero revisar qué se compartiría”. The preview omits the exact lodging, personal data, private reservation notes, collaborators, version history, and private route origins. It does not publish or update anything. If the owner then explicitly approves publication, call `share_trip_publicly`; do not call the compatibility publish or update primitives.

## Manage the public lifecycle

- **Publish:** Create a new opaque link through `share_trip_publicly` when the owner explicitly asks. Default to 30 days unless the user chose another period; allowed duration is 1–365 days.
- **Reuse:** If a current public link already exists, `share_trip_publicly` returns that same recoverable URL with state `active` and performs no write. If the public snapshot is stale, it updates the snapshot in place and returns state `updated` without changing the URL.
- **Update:** Refresh the frozen public copy through the same facade when the owner explicitly asks. Normal trip saves and restores must not silently change the public page.
- **Rotate:** When the owner explicitly asks to replace a lost or exposed link, keep the currently published snapshot, invalidate the old link immediately, and return the new link once. Do not ask for a second confirmation.
- **Revoke:** When the owner explicitly asks to disable the public page, revoke it directly. Treat repeated revocation safely, do not ask for a second confirmation, and do not imply that the private trip was deleted.
- **Status and recovery:** It is safe to report whether a publication is active, stale, expired, or absent. For current publications, Sendero reconstructs the same URL from its protected derivation descriptor and verifies it against the stored hash; return that stable link instead of publishing or rotating again. A truly legacy hash-only publication may remain active but unrecoverable. In that exceptional case, explain the limitation and replace it only after the owner explicitly requests a new link.

Only the trip owner may publish, update, rotate, or revoke. An editor or viewer may open the trip but cannot manage its public projection, even when their OAuth token contains the sharing scope.

## Keep the handoff conversational

The public receipt may offer local actions to copy or open a newly created link. Do not place the secret link in widget state or later model-context updates. When component UI does not render, the successful tool response must still provide the same newly created link in ordinary prose; never retry publication merely to make the UI appear.

Describe the public page as a Sendero link, not a ChatGPT login. Viewers need no ChatGPT, Auth0, or Sendero account. Invalid, expired, revoked, and rotated links all receive the same generic unavailable state.
