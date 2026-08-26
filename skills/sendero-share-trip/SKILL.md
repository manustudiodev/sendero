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

## Preview before publishing or updating

Before the first publication or before replacing the published snapshot:

1. Prepare the authoritative public preview for the exact saved trip.
2. Show the sanitized snapshot in the native Sendero component. The preview omits the exact lodging, personal data, private reservation notes, collaborators, version history, and private route origins.
3. Ensure the component itself states that free text and public venue details remain visible, that anyone with the link can view the page, and that nothing has been published or updated yet. Do not restate those facts in assistant prose when the preview rendered successfully.
4. Wait for explicit confirmation. A request merely to “see what sharing looks like” is not permission to publish.

Pass the preview's stable trip ID, expected version, operation ID, and chosen expiry internally. Never print those values. If the private version changed after preview, stop and generate a fresh preview instead of publishing unreviewed content.

## Manage the public lifecycle

- **Publish:** Create a new opaque link only after preview and explicit confirmation. Default to 30 days unless the user chose another period; allowed duration is 1–365 days.
- **Update:** Refresh the frozen public copy only after a new preview and explicit confirmation. Normal trip saves and restores must not silently change the public page.
- **Rotate:** Replace a lost or exposed link only after explicit confirmation. Keep the currently published snapshot, invalidate the old link immediately, and return the new link once.
- **Revoke:** Disable the public page only after explicit confirmation. Treat repeated revocation safely and do not imply that the private trip was deleted.
- **Status:** It is safe to report whether a publication is active, stale, expired, or absent. Because Sendero stores only the link's hash, an existing full URL cannot be reconstructed; if the owner lost it, offer rotation.

Only the trip owner may publish, update, rotate, or revoke. An editor or viewer may open the trip but cannot manage its public projection, even when their OAuth token contains the sharing scope.

## Keep the handoff conversational

The public receipt may offer local actions to copy or open a newly created link. Do not place the secret link in widget state or later model-context updates. When component UI does not render, the successful tool response must still provide the same newly created link in ordinary prose; never retry publication merely to make the UI appear.

Describe the public page as a Sendero link, not a ChatGPT login. Viewers need no ChatGPT, Auth0, or Sendero account. Invalid, expired, revoked, and rotated links all receive the same generic unavailable state.
