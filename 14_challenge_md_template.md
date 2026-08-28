# Template — `CHALLENGE.md`

Copiar este contenido a la raíz del repositorio público y reemplazar todos los placeholders con evidencia real.

---

# Sendero — WebMCP Challenge Extension

## Submission

**Project:** Sendero Shared Trip Companion
**Submission period:** August 25, 2026 11:00 AM PT — September 3, 2026 1:00 PM PT
**Live demo:** `<LIVE_URL>`
**Baseline:** `<BASELINE_TAG_OR_SHA>`
**Submission:** `<SUBMISSION_TAG_OR_SHA>`
**Compare:** `<COMPARE_URL_OR_COMMAND>`

## What Sendero was before the challenge

Sendero was an existing travel product before the WebMCP Challenge. It already provided:

- `<CONFIRMED_PREEXISTING_CAPABILITY_1>`
- `<CONFIRMED_PREEXISTING_CAPABILITY_2>`
- `<CONFIRMED_PREEXISTING_CAPABILITY_3>`

Evidence:

| Capability | Path / deployment / commit |
|---|---|
| `<capability>` | `<evidence>` |

Do not list a capability unless it can be demonstrated before the challenge start.

## What was added during the challenge

The existing shared itinerary page was meaningfully extended with WebMCP so every guest can explore how the group plan applies to them without installing the Sendero plugin and without modifying the owner's itinerary.

New work:

- safe shared-trip projection;
- page application facade;
- WebMCP feature detection and lifecycle;
- `get_shared_trip_context`;
- `get_day_itinerary`;
- `preview_guest_arrival`;
- `show_day_on_map`;
- `focus_itinerary_item`;
- `clear_guest_preview`;
- synchronized timeline and map feedback;
- tests, security review, telemetry and documentation.

Replace this list with the exact implemented set.

## Before and after

### Before

A guest could open a read-only itinerary and manually interpret the same plan as everyone else.

### After

A guest can ask their agent a personal question such as:

> “I arrive at 5:30 PM. What will I miss, and where can I meet the group?”

The page exposes official tools for reading the exact trip, calculating the impact, and highlighting the result in the live itinerary and map. The owner's canonical plan remains unchanged.

## Why WebMCP

WebMCP is essential because the agent needs page-scoped context and actions:

- the exact shared trip currently open;
- the selected day and item;
- the live timeline and map;
- a temporary guest preview reflected in the same interface.

A remote MCP server can manage Sendero independently of a page. WebMCP lets the guest's agent work with the shared page itself without a separate Sendero plugin connection.

## Architecture

```text
Shared Trip Page
    ├── UI timeline and map
    ├── SharedTripFacade
    ├── WebMCP site tools
    └── Safe shared projection API
             └── Sendero canonical trip data
```

## Main tools

| Tool | Type | Purpose | Canonical write |
|---|---|---|---:|
| `get_shared_trip_context` | Read | Trip metadata and available days | No |
| `get_day_itinerary` | Read | Structured items for a day | No |
| `preview_guest_arrival` | Local UI | Missed items and first meetup | No |
| `show_day_on_map` | Local UI | Select and frame a day | No |
| `focus_itinerary_item` | Local UI | Focus card and map marker | No |
| `clear_guest_preview` | Local UI | Restore normal shared view | No |

## Repository comparison

```bash
git diff --stat <BASELINE>..<SUBMISSION>
git log --oneline <BASELINE>..<SUBMISSION>
```

Public compare URL:

```text
<COMPARE_URL>
```

## Key files added or changed

```text
<PATH_1> — <purpose>
<PATH_2> — <purpose>
<PATH_3> — <purpose>
```

## Run locally

```bash
<INSTALL_COMMAND>
<ENV_SETUP_COMMAND_OR_REFERENCE>
<DEV_COMMAND>
```

## Test WebMCP

1. `<OPEN_SUPPORTED_BROWSER>`
2. `<ENABLE_REQUIRED_SETTING_IF_APPLICABLE>`
3. Open `<LOCAL_OR_LIVE_URL>`.
4. Inspect available Site tools.
5. Ask: “I arrive at 5:30 PM. What will I miss, and where can I meet the group?”
6. Confirm timeline and map update.
7. Refresh and confirm the canonical itinerary is unchanged.

## Tests

```bash
<TEST_COMMAND>
<TYPECHECK_COMMAND>
<BUILD_COMMAND>
```

## Privacy and safety

- shared projection uses an allowlist;
- no reservation codes or private participant data are returned;
- tools validate inputs;
- itinerary content is treated as untrusted data;
- challenge tools do not perform canonical writes;
- the page remains usable without WebMCP.

## Known limitations

- `<LIMITATION_1>`
- `<LIMITATION_2>`

Be explicit. Do not describe future roadmap features as current capabilities.

## Work after the challenge

Potential future work, not included in this submission:

- Sendero accounts and trip library;
- memberships and editor roles;
- authenticated WebMCP write tools;
- remote MCP access to shared trips from arbitrary chats;
- Live Repair and versioned collaboration;
- Sendero for Hosts;
- Sendero Ready.

## License

`<LICENSE_NAME>` — see `LICENSE`.
