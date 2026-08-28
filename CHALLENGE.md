# Sendero — WebMCP Challenge Extension

## Submission status

**Project:** Sendero Shared Trip Companion
**Challenge implementation baseline:** `a8ebc826c5814d3dfc7a88e658ffade748eb039f`
**Last pre-challenge-opening reference:** `123bd07bf91ef69e3182646a6f550a4c614c7465`
**Implementation commit:** `48dcf1ca652b435ed087db1778cb0240749650ad`
**Production application:** https://sendero-alpha.vercel.app
**Live challenge walkthrough:** pending a durable active public-share URL and demo video
**Public repository and license:** pending owner decision

This file describes the implementation deployed from the commit above. The final active share URL, video, public-repository status, license, and submission SHA must be added before the Devpost submission.

## What Sendero was before the challenge

Sendero was an existing conversational travel planner. Before this WebMCP extension it already provided:

- a remote MCP server and ChatGPT components for planning and managing trips;
- saved trips, immutable revisions, collaboration, invitations, and role-based permissions;
- frozen public itinerary publications with opaque fragment tokens and a strict privacy allowlist;
- a standalone read-only `/share` page with list, calendar, route, and map views;
- responsive public pages, localization, route fallbacks, and a broad automated test suite.

The existing deployment and the implementation baseline did not contain `document.modelContext`, browser `registerTool` calls, a guest-arrival preview, or page-scoped agent actions.

## What was added during the challenge

The public shared-trip page now has a page-scoped companion built on WebMCP:

- an agent-ready projection with IANA timezone, public item IDs, safe booking booleans, and publication version metadata;
- a `SharedTripFacade` shared by tool callbacks and the visible page state;
- WebMCP feature detection, registration lifecycle, and `AbortController` cleanup;
- exactly six site tools:
  - `get_shared_trip_context`;
  - `get_day_itinerary`;
  - `preview_guest_arrival`;
  - `show_day_on_map`;
  - `focus_itinerary_item`;
  - `clear_guest_preview`;
- a deterministic guest-arrival preview that identifies earlier items and a first future meeting point from the published schedule;
- synchronized day and item focus in the route/map view;
- an explicit temporary-view receipt and a clear action;
- privacy, contract, fallback, timezone, map-focus, responsive, and browser-flow verification.

The new tools never call a mutation endpoint and never modify the owner's canonical itinerary.

## Before and after

### Before

```text
Open shared link
  → read the common itinerary
  → interpret arrival impact manually
  → open routes and calculate a meeting point
```

### After

```text
Open shared link
  → ask the page-aware agent about a late arrival
  → agent reads the exact published trip through site tools
  → page shows missed items and focuses a published meeting point
  → guest clears the temporary view; the owner's trip is unchanged
```

## Why WebMCP is essential

The useful context exists on the page: the exact shared publication currently open, its public version, the active day, and the live route/map view. A remote MCP server can manage Sendero independently, but it cannot by itself provide this page-scoped human-agent interaction. WebMCP lets the guest's agent use narrow capabilities from the open page without requiring the Sendero plugin or granting canonical write access.

## Architecture

```text
Public /share page
    ├── Itinerary UI and route/map feedback
    ├── SharedTripFacade and temporary view state
    ├── six WebMCP site tools
    └── safe public projection response
             └── frozen Sendero publication in Convex
```

## Main tools

| Tool | Type | Purpose | Canonical write |
|---|---|---|---:|
| `get_shared_trip_context` | Read | Public trip metadata, version, days, and permissions | No |
| `get_day_itinerary` | Read | Ordered public items for one trip date | No |
| `preview_guest_arrival` | Local UI | Missed items and first future meeting point | No |
| `show_day_on_map` | Local UI | Select and frame one published day | No |
| `focus_itinerary_item` | Local UI | Focus one public item and its map location | No |
| `clear_guest_preview` | Local UI | Restore the normal shared view | No |

## Key implementation paths

```text
shared/public-snapshot.mjs                 safe public projection
web/src/share/shared-trip-companion.js    page facade and arrival algorithm
web/src/share/webmcp.js                    site-tool contracts and lifecycle
web/src/share/PublicShareApp.jsx           WebMCP registration and visible receipt
web/src/itinerary/ItineraryViewer.jsx      controlled day/item/map feedback
web/src/itinerary/route-utils.js           public item map focus
web/shared-trip-companion.test.mjs         facade and privacy contracts
web/webmcp.test.mjs                        site-tool registration contracts
```

## Run locally

Use Node.js 22 from the repository root:

```bash
npm install
npm test
npm run preview:ui
```

Open the public sample at:

```text
http://127.0.0.1:4173/share#AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
```

The page remains fully usable in an ordinary browser. To exercise the site tools, use a browser or ChatGPT in-app browser version that supports the imperative WebMCP API.

## Verification completed

```bash
npm test
npm run smoke:local
SENDERO_SMOKE_BASE_URL=https://sendero-alpha.vercel.app npm run smoke:remote
npm run check:generated
npm run check:diff
```

- 254 automated tests pass.
- The local smoke test passes.
- The GitHub `verify` workflow passed for the implementation commit.
- Vercel completed the production deployment and the remote smoke passed against `https://sendero-alpha.vercel.app`.
- The deployed `/share` bundle exposes the WebMCP registration path and challenge tool names.
- Generated UI matches its sources.
- A real-browser check registered exactly six tools and executed `preview_guest_arrival` against the public sample.
- Desktop and 390 px mobile checks showed the temporary receipt and focused route without horizontal overflow.
- Clearing the preview restored normal state, and manual route navigation still worked afterward.

## Privacy and safety

- The public snapshot is created with an allowlist.
- Public item IDs never reuse private database IDs.
- Reservation URLs, codes, notes, deadlines, participant data, auth claims, and the share token are absent from tool outputs.
- Tool inputs use closed JSON schemas and are validated again by the facade.
- Expected failures return compact error objects without stack traces or source payloads.
- Telemetry events contain tool names, result codes, counts, and durations only.
- Itinerary text is returned as untrusted data; it is never evaluated as instructions.
- The public page has no canonical trip mutation path and continues to work without WebMCP.

## Known limitations

- The arrival preview is schedule-only. It adds the guest's supplied readiness estimate and does not claim to calculate live traffic or an unverified transfer.
- Publications created before timezone support must be republished before arrival preview is available; read tools continue to work.
- The current implementation focuses a public place or a schematic marker; it does not draw a guest-origin route.
- The production application is live, but the final challenge walkthrough still needs a durable active public-share URL and a demo video.
- The repository is currently private and has no selected open-source license, so it is not submission-ready yet.

## Repository comparison

The immutable implementation delta is:

https://github.com/manustudiodev/sendero/compare/a8ebc826c5814d3dfc7a88e658ffade748eb039f...48dcf1ca652b435ed087db1778cb0240749650ad

## License

Pending owner decision. A recognized open-source license and a public repository are required before submission.
