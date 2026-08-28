---
name: sendero-collaborate-trip
description: Review and manage private access to a saved Sendero trip through natural language. Use when the owner wants to invite a viewer or collaborator by email, resend or revoke an invitation, change a member role, remove access, or see who can access a trip. Do not use for public read-only links.
---

# Collaborate on a Private Sendero Trip

Treat a complete natural-language request as the action itself. Do not show a generic access launcher or ask for a second ritual confirmation when the owner already supplied the trip, person, permission, and requested outcome.

## Distinguish private access from public sharing

- An email invitation for a named person as `viewer` or `collaborator` is private collaboration.
- A link that anyone may open without signing in is public read-only sharing and belongs to `sendero-share-trip`.
- If “share” is genuinely ambiguous, ask one grouped question that distinguishes public link versus email invitation and collects any missing email or role at the same time.

## Resolve human references internally

Use the dedicated access operation that matches the complete user intent. Pass a stable trip ID already present in authoritative context. When the user says “my latest trip” or names a trip and no stable ID is loaded, resolve that natural trip reference without showing cards unless multiple trips genuinely match.

For a member or invitation, prefer the supplied email as the human reference. Never ask the user for a Sendero member ID, invitation ID, trip ID, operation ID, or tool name. When exactly one active member or invitation matches the email, continue directly. Show a choice only if several valid records remain ambiguous after considering status and the latest request.

## Execute one intent-level action

- **Review access:** return the owner, active members, pending invitations, roles, and delivery states.
- **Invite:** when trip, email, and role are explicit, send or queue the invitation immediately. The request itself is authorization; do not ask “are you sure?”.
- **Resend or renew:** rotate the invitation token and queue a new delivery only when the user explicitly asks to resend or renew it.
- **Revoke an invitation:** revoke the unaccepted invitation named by the user. Do not remove an accepted member instead.
- **Change role:** apply the exact requested `viewer` or `collaborator` role to the named active member.
- **Remove access:** remove the named active member when the request explicitly says to remove their access.

Generate and reuse an idempotent operation ID for the exact action. A retry after reconnect or a transient failure must not create a duplicate invitation or repeat a mutation.

## Report authoritative results

Use the successful server result as completion evidence. For invitations, report the real delivery state: sent, queued, retrying, not configured, or failed. Never say that an email was delivered merely because the invitation record exists.

The final result is a compact receipt, not another decision surface. Do not offer pseudo-commands such as “type Invite Ana”. Do not repeat email, role, and trip details in a second prose block when the component or tool receipt already shows them.

ChatGPT may independently request permission for an external or destructive tool call. That host permission is not a Sendero confirmation and must not cause Sendero to ask the same question again. If authentication expires, preserve the exact pending action and resume it once after the integration reconnects.
