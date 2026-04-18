# OrchardPatch — Project Context

Last updated: April 18, 2026

## What OrchardPatch is
A Mac admin tool providing complete visibility into managed macOS fleet apps
and patching via Installomator — without touching your MDM. Tagline:
"See Everything. Patch Anything. Break Nothing."

## Repos
- Fleet server: github.com/judeglenn/orchardpatch-server
  - Local: ~/Projects/orchardpatch-server
  - Deployed: https://orchardpatch-server-production.up.railway.app
- Agent: github.com/judeglenn/orchardpatch-agent
  - Local: ~/Projects/orchardpatch-agent
- Web app (frontend): github.com/judeglenn/orchardpatch
  - Local: ~/Projects/orchardpatch
  - Deployed: https://orchardpatch.vercel.app
- Waitlist: github.com/judeglenn/orchardpatch-waitlist
- Marketing: https://orchardpatch.com

## Stack
- Fleet server: Node.js/Express on Railway
- Database: PostgreSQL (Railway-hosted), schema auto-migrates on startup
- Web app: Next.js 14 (App Router), TypeScript, Tailwind, deployed on Vercel
- Agent: Node.js LaunchDaemon (root), local HTTP on port 47652
- Auth: x-orchardpatch-token header, SERVER_TOKEN env var

## Environment variables (Railway — fleet server)
- DATABASE_URL — PostgreSQL connection (Railway env ref)
- SERVER_TOKEN — auth token for all API endpoints
- GITHUB_TOKEN — fine-grained PAT for catalog-sync GitHub API calls
- PORT — set by Railway
- DATA_DIR — data directory

## Vercel environment variables (frontend)
- LOGIN_PASSWORD — passphrase users enter to access the app
- SESSION_SECRET — static random string stored in session cookie, validated by middleware
- NEXT_PUBLIC_FLEET_SERVER_URL — Railway fleet server URL
- NEXT_PUBLIC_FLEET_SERVER_TOKEN — token for direct browser-to-Railway calls

## Agent environment variables
- SERVER_URL — fleet server URL
- SERVER_TOKEN — matches fleet server
- INSTALLOMATOR_PATH — /usr/local/bin/Installomator.sh
- VERSION_CHECK_INTERVAL — check-ins between version runs (default: 10)

## Architecture decisions
- Agent to server: REST polling only, no WebSocket
- Server cannot reach agents directly (Railway to NAT'd agent doesn't work)
- Version data is agent-initiated push, not server-pull
- Agent polls every 15 min; version checks run every 10 check-ins (~2.5 hrs)
- Patching via Installomator only — no MDM conflicts, no Secure Token needed
- Post-patch: agent immediately ingests confirmed version to latest_versions,
  then triggers inventory check-in — no staleness window after patching
- Vercel deploys automatically via GitHub integration on push to main — no CLI needed
- Auth wall: Next.js middleware with two-env-var design (LOGIN_PASSWORD +
  SESSION_SECRET). Placeholder until multi-tenancy is built. Real auth
  (SSO, 2FA, user management) lives in Settings > Security when built.

## Version comparison philosophy
"Latest version" in OrchardPatch = latest version Installomator knows how
to install, not manufacturer's current release. This ensures outdated always
means "patchable right now." Occasional 1-2 day lag between vendor release
and Installomator catching up is by design.

## System app classification philosophy
"System" in OrchardPatch = any app signed by Apple (com.apple.* bundle ID)
or resident under /System/. These are not patchable via Installomator and
are tracked separately from unknown. Unknown means "third-party app with no
Installomator label yet." System means "Apple-managed, not our job."
Future: may add softwareupdate CLI or other sources for system app patching.

## Label matching philosophy
Bundle ID matching from fragments is not viable — bundleID is effectively
absent from the Installomator fragment corpus. Label assignment uses a
priority chain in the agent:
1. Label overrides (hand-curated, /etc/orchardpatch/label-overrides.json)
2. Agent local catalog match by bundle ID (sparse but exact where it exists)
3. Agent local catalog match by normalized name (primary path for most apps)
4. null — app stays Unknown
Unknown means genuinely unpatchable via Installomator, not a bug.
Future: "suggest label" UI on Unknown rows, community seed file for top 100 apps.

## Key design constraints
- Works in BeyondTrust / privilege management environments
- No sudo required — LaunchDaemon runs as root
- No MDM conflicts — agent pattern same as Jamf/Mosyle/Kandji
- Installomator is the only patch mechanism (1,083 supported apps)
- Single-tenant for now — multi-tenancy is a prerequisite for
  Patch by the Orchard enterprise tier
- Installomator fragments now at fragments/labels/ (not Labels/) in repo

## AI development workflow
- Primary dev assistant: Chip (OpenClaw, Claude API, has own MacBook Pro)
- Architecture / planning: Claude.ai (this project)
- Chip pushes via PAT embedded in remote URLs
- Chip's git identity: user.name=Chip, user.email=chip@openclaw
- orchardpatch-server has local override: Jude Glenn / judeglenn@example.com
- Context is lost when Chip compacts — use this file to restore
- Start Claude.ai sessions by opening OrchardPatch project (CONTEXT.md loaded)
- End every session: ask Claude.ai to update CONTEXT.md, paste to Chip, commit
- Standing rule: always fix bugs at root cause. Never suggest manual
  workarounds. If a workaround is needed to unblock testing, flag it
  explicitly as tech debt before moving on.
- Claude.ai is better for: architecture decisions, code scaffolding,
  debugging topology/design issues, cross-repo reasoning
- Chip is better for: codebase-aware implementation, exact file locations,
  running commands, hot-deploying to installed agent

## Fleet
- 2 devices in production fleet
- device-GJM7N0XGL0: Jude's MacBook Pro (Mac16,1 · macOS 26.4 · 84 apps)
- device-C02D52QTML85: Chip's MacBook Pro (MacBookPro16,2 · macOS 26.3.2 · 60 apps · 2020 13" 2.3GHz Quad-Core Intel i7 16GB)
- Agent installed via .pkg on both machines
- Agent install path: /usr/local/orchardpatch/agent/
- Config: /etc/orchardpatch/config.json
- Logs: /var/log/orchardpatch/agent.log
- Device ID persisted to /var/root/.orchardpatch/device-id.json

## DB schema (key tables)
- devices: id, hostname, device_id, last_seen, agent_version, agent_url (nullable)
- apps: id, device_id, bundle_id, name, version, latest_version (legacy/null),
  is_outdated (legacy/always 0 — do not use), installomator_label, path, source
  source values: 'user' (third-party, patchable), 'system' (Apple-managed, N/A)
- latest_versions: label (PK), latest_version, last_checked, error
- app_catalog: label (PK), app_name, bundle_id, expected_team, last_synced
  NOTE: bundle_id is null for effectively all rows — bundleID is absent from
  Installomator fragments. app_name population requires regex fix (see tech debt).
- patch_jobs: device_id, device_name (hostname via JOIN on devices), app, mode,
  status, duration, log output

## Key API endpoints
- POST /checkin — agent check-in, inventory push (now includes installomator_label)
- GET /devices — fleet list with outdated_count (latest_versions join)
- GET /apps — raw app rows (do not use for status — use /apps/status)
- GET /apps/status?device_id= — patch status per app with cache_age_seconds
  patch_status values: 'outdated', 'current', 'unknown', 'na'
  'na' is returned when source = 'system' — skips latest_versions lookup entirely
- GET /stats — fleet stats
- POST /patch-jobs — queue a patch job
- GET /patch-jobs — list jobs (includes device_name via JOIN on devices)
- POST /api/version-sync/ingest — ingest version data
- GET /api/version-sync — full version cache
- GET /api/version-sync/:label — single label lookup
- POST /api/catalog-sync — sync Installomator catalog from GitHub
- GET /api/catalog — browse catalog (hard-capped at 200 rows)

## Feature status

### Shipped
- App inventory collection and display
- Fleet view with device detail pages
- Patch by the Fruit (individual app patching, end-to-end, verified working)
- Patch job queue with real-time status polling
- Patch history with expandable logs — records jobs correctly
- Reports page with fleet health data
- PostgreSQL persistence
- Security hardening (parameterized queries, rate limiting, CORS)
- app_catalog table — 1,083 Installomator labels synced from GitHub
- latest_versions table — self-populating via agent every ~2.5 hrs
- POST /api/version-sync/ingest — agent pushes version data up additively
- GET /api/version-sync and /api/version-sync/:label — cache lookups
- POST /api/catalog-sync — fetches full Installomator catalog from GitHub
- GET /api/catalog — browse/search catalog
- GET /apps/status — returns patch_status + cache_age_seconds per app,
  filters by device_id
- Agent src/version-checker.js — Installomator DEBUG=1 batch runner
- Agent scheduler hook — version checks every 10 check-ins, async, non-blocking
- Post-patch version ingest — agent parses installed version from Installomator
  output, POSTs to /ingest immediately after successful patch
- Post-patch inventory refresh — runCollection() fires after successful patch
- Status badges on inventory dashboard AppCards
- Clickable patch status filter bar on App Inventory page — four pills:
  Outdated, Current, Unknown, System
- Fleet device list shows outdated count per device
- Device detail page — fetches from fleet server directly, no mock data
- Device detail page shows Outdated / Up to Date / Unknown / System sections
- App detail page — uses /apps/status (real patch_status + latest_version)
- PatchStatusBadge component — reusable, hover shows latest version
  Statuses: current (green), outdated (red), unknown (yellow), system (gray gear)
- Fleet summary bar — "N outdated · N current · N unknown"
- Patch History — records jobs with app, mode, status, duration, expandable logs
- checkin.js — saves deviceId to /var/root/.orchardpatch/device-id.json
- Poller — uses saved deviceId from device-id.json
- reportPatchJob — uses saved deviceId
- Installomator path — /usr/local/bin/Installomator.sh baked into INSTALLOMATOR_PATHS
- Verified end-to-end: Slack 4.38.125 → 4.49.81 (Chip's Mac),
  1Password 7.9.10 → 7.9.11 (Chip's Mac), Docker 4.54.0 → 4.69.0 (Jude's Mac)
- HomePageInner uses /apps/status; patch_status === 'outdated' drives conflict count
- System app classification — source column used fleet-wide
- App rows on device detail page are clickable links to app detail
- Outdated count badge on device detail page is a clickable filter toggle
- Fleet-aware version checker (agent) — buildLabelList() now async, fetches
  all labels from /api/version-sync after building local list, unions additively.
  Falls back to local-only on fetch failure. Commit f51c69c. Both agents deployed.
- Patch job log formatting — line-by-line rendering, scrollable 320px container,
  color coded (red=error, yellow=warn, green=success), wraps long lines
- Auth wall — Next.js middleware, LOGIN_PASSWORD + SESSION_SECRET env vars,
  httpOnly secure cookie, 7-day expiry. Protects UI shell only; fleet server
  data gate remains SERVER_TOKEN on Railway.
- Label enrichment at check-in — checkin.js now calls enrichAppsWithLabels()
  before building payload. installomator_label populated on check-in for all
  apps the agent catalog can match. Jude's device: 31 labeled, 9 genuine unknowns.
- Verified label matches on Jude's device: firefox→ firefoxpkg, bitwarden→bitwarden,
  microsoftteams→microsoftteams-rollingout, telegram→telegram, slack→slack

### Known genuine unknowns (Jude's device)
These apps have no Installomator label and will stay Unknown until Installomator
adds support or a label override is added manually:
- ASUS Device Discovery
- Avidemux
- BlueBubbles
- DaVinci Resolve (check — Installomator may have a label for this)
- DisplayLinkUserAgent (x2 — driver component, not a patchable app)
- Google Docs, Sheets, Slides (browser shortcuts, not real binaries)

### Partially built
- Patch by the Bushel (fleet patching) — UI exists, bulk dispatch not wired;
  "Patch All" button on app detail page is hidden pending proper implementation
- Jamf API integration — proxy exists, real Jamf trial access pending
- Multi-tenancy / org isolation — single-tenant only

### Not yet built
- Patch by the Orchard (policy-based auto-remediation, enterprise tier)
- Automated catalog-sync schedule (manual curl for now)
- CLI (orchardpatch recon, patch, status, connect)
- Homebrew tap
- Patch Policy UX (Silent/Notify/Scheduled/User-initiated — UI exists,
  not persisted as policies yet)
- Sentry / error monitoring
- DB indexes for fleet queries
- Version string normalization (minor version drift edge cases)
- Force check-in button on device detail page
- softwareupdate CLI research for system app patching (Batch 3 follow-up)
- "Suggest label" UI on Unknown app rows
- Community seed file for top 100 bundle ID → label mappings
- SSO / proper auth (Settings > Security — placeholder passphrase auth wall
  is current implementation)

## Patch naming hierarchy
- Patch by the Fruit — single app, single device
- Patch by the Bushel — batch/fleet patching (partially built)
- Patch by the Orchard — policy-based auto-remediation (enterprise, future)

## Future UX consideration
- App variant grouping: if Teams and Teams classic are both installed, show
  them grouped in a fleet-wide view but tracked and patched individually.
  Do not build yet — foundation must be solid first.

## Open items / tech debt
- **PatchJob type mismatch:** PatchJob type declares log?: string but the
  fetchJobs normalizer converts it to string[]. Render handles both at runtime
  but the type is a lie. Fix during next cleanup pass.
- **app_catalog regex fix:** parseFragment() regex uses ^ anchors but fragment
  fields are indented. app_name and expected_team are not populating correctly
  for most rows. Fix: add \s* before each key in the regex. Low urgency since
  label matching uses the agent's local catalog, not the server's app_catalog.
  High value for making the catalog browsable in the UI.
- **GET /api/catalog hard cap:** endpoint returns max 200 rows regardless of
  limit param. Fix when catalog browsing UI needs full dataset.
- **DaVinci Resolve:** may have an Installomator label — verify and add label
  override if so.
- **Force check-in button (device detail page):** Requires pending-commands
  pattern: new DB table (pending_commands), server endpoint (POST /commands),
  agent changes to poll for and execute pending commands on each check-in cycle.
  Agent cannot be reached directly from Railway (NAT). Design and build as one unit.
- **Patch by the Bushel (app detail page):** "Patch All" button is hidden.
  Real fan-out requires fleet-wide dispatch from the server. The
  patchDeviceId=null path in handleConfirmPatch in apps/[id]/page.tsx also
  uses the hardcoded INSTALLOMATOR_LABELS map instead of the label field
  from /apps/status. Both must be addressed together.
- GitHub PAT (orchardpatch-catalog-sync) scoped to all public repos —
  tighten to Installomator repo only
- agent_url column on devices table unused — reserved for future
  server-initiated flows
- No DB indexes on fleet queries yet — will matter at scale
- Catalog auto-sync not automated — manual curl for now
- is_outdated field on apps table is legacy, never set by agent — ignore
- latest_version field on apps table is legacy — latest_versions table
  is source of truth
- Version string normalization not implemented — edge case with minor builds
- firefoxpkg label on Jude's device — verify this patches standard Firefox
  correctly (not ESR) when the time comes
