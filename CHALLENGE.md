# Sendero — WebMCP Challenge

## Submission snapshot

- **Project:** Sendero
- **Elevator pitch:** Turn a conversation into a live itinerary that people and AI agents can plan, validate, review, save, and share together.
- **Live URL:** https://sendero-alpha.vercel.app/app/new?lang=en
- **Repository:** https://github.com/manustudiodev/sendero
- **Submission branch:** `main`
- **Last commit before the challenge opened:** `5d370a506167690d3f87537934c7e1604d058cb1` (`2026-08-25T14:08:54-03:00`)
- **Production application verified at:** `454e26b717232aa86b826488338f44199367cde0`
- **Final repository state:** the public `main` branch linked from Devpost
- **Demo video:** add the public YouTube URL before submission

Once the repository is public, the complete challenge-period comparison will be available at:

https://github.com/manustudiodev/sendero/compare/5d370a506167690d3f87537934c7e1604d058cb1...main

## Why this is a WebMCP use case

Travel planning often breaks into two disconnected experiences: a conversation that produces recommendations and a web app that stores structured data. The traveler copies prompts, waits without page feedback, and cannot tell whether the result was merely written in chat, validated in the product, or actually saved.

Sendero uses WebMCP to make the open planning page part of the conversation. ChatGPT can pass the facts already supplied by the traveler to that exact page, follow Sendero's versioned planning contract, and stage a validated itinerary into the browser's visible review experience. The person and the agent then share one state instead of exchanging opaque text.

This page-scoped interaction matters because the useful context is local and immediate: the brief currently being prepared, the browser draft being reviewed, the visible day and route, the signed-in state, and the exact itinerary eligible to be saved or shared. A remote service alone cannot prove those UI transitions or operate on the browser-local anonymous draft.

## What people and agents can now do

- Start from a natural-language request without manually re-entering the same trip facts in a form.
- See generation progress on the Sendero page while ChatGPT researches and constructs the itinerary.
- Validate the generated object against a versioned protocol and canonical schema before presenting it.
- Review a single authoritative draft in list, calendar, route, map, reservation, and warning views.
- Keep an anonymous draft in the browser, discard it, or sign in later without losing it.
- Save only after explicit approval and receive the authoritative trip ID and version.
- Track exact reservations as booked or pending without claiming to buy from a provider.
- Publish a saved itinerary through a read-only link or invite an exact email as a private viewer or editor.
- Open a published trip and ask an agent to inspect a day, focus a map item, or preview a guest's late arrival without changing the owner's trip.

## WebMCP implementation

The creation page registers eight site tools:

1. `get_itinerary_planning_protocol`
2. `validate_and_stage_itinerary`
3. `get_staged_itinerary`
4. `update_itinerary_reservation_statuses`
5. `save_staged_itinerary`
6. `share_saved_itinerary_by_link`
7. `invite_saved_itinerary_member`
8. `discard_staged_itinerary`

The public shared-trip page registers six additional tools:

1. `get_shared_trip_context`
2. `get_day_itinerary`
3. `preview_guest_arrival`
4. `show_day_on_map`
5. `focus_itinerary_item`
6. `clear_guest_preview`

Both surfaces feature-detect `document.modelContext.registerTool`, register closed-schema definitions with an abortable lifecycle, and share a facade with their visible React UI. The page remains usable when WebMCP is absent.

The creation workflow keeps three states deliberately distinct:

- **Prepared:** the page has the user's brief and the planning protocol, but no itinerary yet.
- **Staged:** the itinerary passed validation and is cached in the browser for review, but is not a saved Sendero trip.
- **Saved:** an authenticated, explicitly approved operation returned an authoritative trip, web ID, and version.

Sharing, invitations, and reservation tracking apply separate authentication, ownership, role, and explicit-intent checks. A public link is always read-only; collaboration requires an email-bound invitation.

## What existed before the challenge

Before the challenge opened, Sendero already had a remote MCP travel-planning foundation, React components, saved trips, itinerary versions, invitation and publishing concepts, and a public web surface. The immutable pre-opening reference is `5d370a506167690d3f87537934c7e1604d058cb1`, committed at 10:08:54 Pacific time on August 25, 2026, before the 11:00 Pacific opening.

It did not yet provide the current WebMCP experience that lets the active page receive a conversational brief, expose the versioned planning protocol, stage an anonymous browser draft, synchronize visible progress and review, gate persistence behind authentication, manage reservation state through site tools, or control the published itinerary's route and map views.

## What was built during the challenge

The challenge-period work includes:

- WebMCP registration and lifecycle for the creation and public shared-trip pages;
- an eight-tool itinerary-generation, staging, persistence, reservation, and sharing surface;
- a six-tool public Shared Trip Companion;
- anonymous planning with an infinite-lifetime TanStack Query cache persisted in the browser until the traveler discards or replaces the draft;
- sign-in continuity that promotes the reviewed browser draft into the user's account;
- visible generation status, a three-step planning flow, and automatic page handoff from ChatGPT;
- strict itinerary schemas, versioned protocol hashes, warnings, and source-aware uncertainty;
- specific multi-activity daily itineraries instead of vague research tasks;
- list, calendar, route, Google Maps, reservation, and description views;
- booking-status tracking, public links, and private email invitations exposed through permission-aware site tools;
- five-language product chrome, responsive layouts, light/dark themes, and accessible modal and notice behavior;
- production Auth0, Convex, Vercel, and Google Maps integration;
- automated tests and local/remote smoke coverage for the new boundaries.

The commit history and comparison link above provide dated evidence of the extension.

## Key implementation paths

```text
web/src/generate/webmcp.js                  creation site-tool definitions
web/src/generate/generation-client.js      creation facade and draft lifecycle
web/src/generate/GenerateTripApp.jsx        visible creation and review experience
web/src/generate/draft-cache.js             browser persistence via TanStack Query
web/src/share/webmcp.js                     shared-page site-tool definitions
web/src/share/shared-trip-companion.js      safe public facade and arrival preview
web/src/share/PublicShareApp.jsx            shared-trip UI feedback
web/src/itinerary/ItineraryViewer.jsx       list, calendar, route, map, and reservations
server/itinerary-planning.mjs               versioned generation and validation protocol
server/app.mjs                              HTTP, auth, capability, and API boundaries
convex/                                     authoritative persistence and permissions
```

## Safety and privacy

- Tool inputs use closed JSON schemas and are validated again by page facades.
- The agent receives concise errors rather than stack traces or source payloads.
- Itinerary copy is untrusted content and is never evaluated as instructions.
- An anonymous staged draft is not represented as a saved trip.
- Saving requires authentication and an explicit user request.
- Reservation status only records what the traveler says; Sendero never books, purchases, contacts, or cancels with a provider.
- Public snapshots use an allowlist and omit exact lodging, private notes and URLs, collaborators, internal IDs, and revision history.
- Public links grant read-only access. Editor access requires an identity-bound invitation.
- Public-page tools never receive the share token and never call a canonical mutation path.

## Verification boundary

Verified for production commit `454e26b717232aa86b826488338f44199367cde0`:

- 335 automated tests passed.
- Local smoke and remote production smoke passed.
- Generated UI matched its source files.
- Vercel reported the production deployment ready at `https://sendero-alpha.vercel.app`.
- The ChatGPT desktop in-app browser exposed all eight creation-page tools and completed end-to-end anonymous itinerary staging.
- The production Convex deployment was healthy and the production Auth0 flow was exercised.
- List, calendar, routes, Google Maps, reservations, draft discard, sign-in continuity, and responsive light/dark UI were manually reviewed.

Documentation changes made after that runtime commit do not change the deployed application. Run the complete repository gate before the final push:

```bash
npm run check
SENDERO_SMOKE_BASE_URL=https://sendero-alpha.vercel.app npm run smoke:remote
```

## Demo outline

The public video must remain under three minutes and use the English UI.

1. Open the production itinerary-creation URL in ChatGPT's desktop in-app browser.
2. Show the WebMCP indicator and its eight commands.
3. Describe a trip in natural language, including one meaningful constraint.
4. Show Sendero receive the brief automatically and display generation progress.
5. Let ChatGPT stage the itinerary and show the page transition to review.
6. Quickly switch between list, calendar, routes/map, and reservations.
7. Sign in, save the draft, and show the trip in the account.
8. If time permits, request a read-only share link or show an invited collaboration boundary.

Do not include private credentials, secrets, unlicensed music, or another person's copyrighted material in the recording.

## Known limits

- Generated itinerary content is stored in the language in which it was created. Changing the UI language translates product chrome but does not machine-translate the saved itinerary.
- Future schedules, prices, closures, events, and reservation requirements remain explicitly marked for reconfirmation when official information is unavailable.
- WebMCP capability depends on a compatible host. The verified production path is ChatGPT's desktop in-app browser.
- Google Maps requires the deployment's restricted Maps Embed key; normal list and route links remain usable if the embed is unavailable.

## License

Sendero's original source is licensed under the [MIT License](LICENSE). Dependencies remain under their own licenses. [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) documents the direct dependency licenses and GSAP's separate Standard No Charge terms.
