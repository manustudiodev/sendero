# Devpost Submission Draft

This is the English source of truth for the final Devpost entry. Do not commit passwords or paste private credentials into public repository fields. Add the judge account only to Devpost's private **testing instructions** field.

## Project overview

**Project name**

Sendero

**Elevator pitch**

Turn a conversation into a live itinerary that people and AI agents can plan, validate, review, save, and share together.

**Thumbnail**

Upload [`docs/assets/sendero-devpost-thumbnail.png`](assets/sendero-devpost-thumbnail.png). It is a clean 1440×960 (3:2) capture of the English production landing page and contains no credentials, browser profiles, private email addresses, or draft tokens.

## About the project

### Inspiration

Travel planning is conversational, but the result usually gets trapped in chat. People then copy recommendations into another app, lose the connection between research and structured data, and cannot tell whether an itinerary was merely suggested, validated, or actually saved.

Sendero makes the open travel page part of the conversation. ChatGPT and the traveler work on the same browser-scoped itinerary, with visible progress and explicit boundaries between generation, validation, saving, booking status, and sharing.

### What it does

A traveler opens Sendero in ChatGPT's desktop in-app browser and describes a trip naturally. The page exposes eight WebMCP tools that let ChatGPT pass the known facts directly into Sendero, load a versioned planning protocol and JSON schema, and stage a complete validated itinerary. The result appears in Sendero's list, calendar, route, Google Maps, reservation, and description views without prompt copying or manual form re-entry.

Anonymous travelers can generate and review a draft. The draft persists in that browser until it is discarded or replaced. Authentication is requested only when the traveler wants to save the itinerary, track completed reservations, invite a private viewer or editor, or publish a read-only link.

A published trip exposes six more page-scoped tools. A person opening the published trip can ask an agent to read a day, focus an activity on the map, or preview how a late arrival affects the published schedule. These actions change only the temporary view and never modify the owner's itinerary.

### Why WebMCP

The important context is on the page: the brief currently being prepared, the browser-local anonymous draft, the visible review state, the selected route, and the exact trip eligible for persistence. A remote integration alone cannot safely prove or synchronize those states.

WebMCP gives ChatGPT narrow capabilities from the page that the person is actively viewing. Both the agent and the React UI use the same facade, so tool execution produces immediate, inspectable UI feedback. Closed schemas, explicit authentication gates, and authoritative return values prevent the experience from confusing a suggestion with a saved, shared, invited, booked, or purchased result.

### How we built it

Sendero is a JavaScript/React application served by Hono on Vercel. It feature-detects `document.modelContext.registerTool` and registers abortable, page-scoped tool definitions with closed JSON schemas. TanStack Query provides the in-page cache and anonymous draft continuity. Convex stores authenticated trips, immutable versions, permissions, invitations, public snapshots, and reservation status. Auth0 handles account identity, and Google Maps presents daily routes.

The itinerary protocol is versioned and hashed. ChatGPT must construct an object matching the returned schema before `validate_and_stage_itinerary` accepts it. The UI distinguishes prepared, staged, and saved states, and persistence tools require both authentication and explicit user intent. Public snapshots use an allowlist and their six WebMCP tools have no canonical write path.

### Challenges we ran into

The hardest problem was not registering tools; it was preserving truthful state across the conversation and the page. A browser draft had to survive navigation and sign-in without being mistaken for an authoritative saved trip. Reservation controls had to record what the traveler reported without implying that Sendero bought a ticket. Public sharing needed useful agent context without exposing exact lodging, private notes, provider URLs, internal IDs, or invitation tokens.

We also had to make uncertainty useful. For future festivals and schedules, the itinerary names a concrete place and action while clearly identifying exactly what must be reconfirmed later, instead of giving the traveler vague instructions to research their own plan.

### Accomplishments that we are proud of

- A natural-language request can drive the open page without duplicate form entry or prompt copying.
- The traveler sees generation, validation, and review transitions in the product while ChatGPT works.
- Anonymous planning remains genuinely useful and can be promoted into an account after sign-in.
- Eight creation tools cover planning, staging, reading, reservation state, saving, publishing, invitations, and discard with explicit safety boundaries.
- Six public tools let guests inspect and temporarily adapt a shared itinerary without modifying it.
- The same validated itinerary supports list, calendar, route, map, reservations, localization, responsive layouts, and dark mode.

### What we learned

WebMCP works best when the page exposes domain capabilities rather than DOM automation. The tool should express "stage this validated itinerary" or "focus this published item," while the page owns state, permissions, presentation, and the authoritative receipt. We also learned that visible feedback is part of the protocol: users need to see whether the agent is preparing, validating, or saving, and every irreversible or external-facing action needs a separate intent boundary.

### What's next for Sendero

Next steps include optional translation of user-generated itinerary content, richer live transit and disruption updates, refresh flows that revalidate future events close to departure, and broader page-scoped editing for authenticated collaborators. The same contracts can also support more capable agents without weakening the current validation, privacy, and approval boundaries.

## Built with

Use these Devpost tags, up to the form's limit of 25:

`WebMCP`, `JavaScript`, `React`, `TanStack Query`, `Hono`, `Convex`, `Auth0`, `Vercel`, `Google Maps`, `Model Context Protocol`, `JSON Schema`, `Node.js`, `GSAP`

## Try it out

- Live WebMCP page: https://sendero-alpha.vercel.app/app/new?lang=en
- Public code repository: https://github.com/manustudiodev/sendero

## Video demo

Paste the public YouTube URL here after uploading the final video. Keep it under three minutes, include audio, use the English UI, and demonstrate the real working application.

`<PUBLIC_YOUTUBE_URL>`

## Additional information

**Submitter Type**

Individual

**Country of residence**

Select the submitter's actual country of residence in Devpost. Do not infer it from the current timezone.

**Organization name**

Leave blank unless the submission is formally on behalf of an organization.

**App Status**

Existing

**What was updated during the submission period**

Sendero existed before the challenge as a conversational travel planner with remote MCP foundations, structured itineraries, accounts, collaboration concepts, and public web pages. During the submission period it was meaningfully extended with two page-scoped WebMCP experiences: an eight-tool itinerary creation flow and a six-tool public Shared Trip Companion. The work added automatic brief handoff, a versioned planning protocol and schema, anonymous browser staging through TanStack Query, visible generation and review state, sign-in continuity, authenticated save and reservation tracking, public link and email invitation tools, map/day/item control for shared trips, privacy allowlists, production integrations, five-language product chrome, responsive UI, and comprehensive verification. The pre-opening baseline and dated comparison are documented in CHALLENGE.md.

**Live URL**

https://sendero-alpha.vercel.app/app/new?lang=en

**Private testing instructions**

Open the live URL in ChatGPT's desktop in-app browser. The WebMCP indicator should show eight commands. Ask ChatGPT to create an itinerary from a natural-language request and keep Sendero open while it works. The page should receive the brief automatically, show generation progress, and transition to the validated review with list, calendar, routes, map, and reservations.

Anonymous generation and review require no account. To test saving and the pre-populated challenge itinerary, sign in with the private judge account below. These credentials must be pasted directly into Devpost and must never be committed to the public repository:

```text
Email: <PASTE_PRIVATE_JUDGE_EMAIL_IN_DEVPOST_ONLY>
Password: <PASTE_PRIVATE_JUDGE_PASSWORD_IN_DEVPOST_ONLY>
```

Saving, reservation tracking, link publishing, and email invitations require explicit user instructions. Sendero does not purchase or reserve anything with a provider.

**Public code repository**

https://github.com/manustudiodev/sendero

**Agents or clients tested**

ChatGPT desktop in-app browser with its active ChatGPT conversation. The normal web UI and fallback flow were also tested in standard desktop and mobile browsers; the verified WebMCP execution path for the submission is ChatGPT's in-app browser.

**AI tools leveraged while building**

ChatGPT and Codex were used for implementation support, research, iterative UI review, automated test authoring, and browser verification. Product behavior, safety boundaries, content decisions, deployment configuration, and final validation were directed and reviewed by the submitter.

**Level of learning derived from the project**

Select **Significant**. The project required learning how to design page-scoped domain tools, synchronize agent execution with visible React state, distinguish anonymous browser drafts from authoritative persistence, and combine WebMCP with authentication, permissions, validation, maps, localization, and production deployment.

**Career value gained**

Yes. The work produced reusable patterns for agent-accessible web applications: narrow domain tools instead of DOM automation, closed schemas, shared UI/tool facades, explicit intent gates, truthful receipts, browser-to-account continuity, and privacy-preserving public projections.

## Final checklist

- [ ] Record and upload a public YouTube demo under three minutes.
- [ ] Add the video URL to Devpost and this document.
- [ ] Select the actual country of residence.
- [ ] Paste the private judge account only into Devpost testing instructions.
- [x] Prepare a 3:2 project thumbnail without credentials or private data.
- [x] Run `npm run check` (335 tests, local smoke, generated UI, and diff checks passed).
- [x] Run the production remote smoke test against `https://sendero-alpha.vercel.app`.
- [ ] Commit the documentation and license.
- [ ] Push the final commit and wait for the production deployment to be ready.
- [ ] Change the GitHub repository visibility from private to public.
- [ ] Confirm the public repository exposes `LICENSE`, source, setup instructions, and the challenge history.
- [ ] Paste the prepared English copy into every required Devpost field.
- [ ] Preview the submission while signed out or in a private browser.
- [ ] Submit before the extended deadline.
