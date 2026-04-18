# OrchardPatch — Project Context
Last updated: April 17, 2026

## What OrchardPatch is
A Mac admin tool providing complete visibility into managed macOS fleet apps and patching via Installomator — without touching your MDM. Tagline: "See Everything. Patch Anything. Break Nothing."

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

## Architecture decisions
- Agent ↔ server: REST polling only, no WebSocket
- Server cannot reach agents directly (Railway → NAT'd agent doesn't work)
- Version data is agent-initiated push, not server-pull
- Agent polls every 15 min; version checks run every 10 check-ins (~2.5 hrs)
- Patching via Installomator only — no MDM conflicts, no Secure Token needed
- Post-patch: agent immediately ingests confirmed version to latest_versions, then triggers inventory check-in — no staleness window after patching

## Version comparison philosophy
"Latest version" in OrchardPatch = latest version Installomator knows how to install, not manufacturer's current release. This ensures 🔴 outdated always means "patchable right now." Occasional 1-2 day lag between vendor release and Installomator catching up is by design.

## Fleet
- 2 devices in production fleet
- device-GJM7N0XGL0: Jude's MacBook Pro (Mac16,1 · macOS 26.4 · 84 apps)
- device-C02D52QTML85: Chip's MacBook Pro (MacBookPro16,2 · macOS 26.3.2 · 60 apps · 2020 13" 2.3GHz Quad-Core Intel i7 16GB)
- Agent installed via .pkg on both machines
- Agent install path: /usr/local/orchardpatch/agent/
- Config: /etc/orchardpatch/config.json
- Logs: /var/log/orchardpatch/agent.log
- Device ID persisted to /var/root/.orchardpatch/device-id.json (written by checkin.js after every successful checkin)

## Feature status

### ✅ Shipped and production-ready
- App inventory collection and display
- Fleet view with device detail pages
- Patch by the Fruit (individual app patching, end-to-end, verified working)
- Patch job queue with real-time status polling
- Patch History with expandable logs — working, records jobs correctly
- Reports page with fleet health data
- PostgreSQL persistence
- Security hardening (parameterized queries, rate limiting, CORS)
- app_catalog table — 1,083 Installomator labels with bundle IDs and team IDs
- latest_versions table — self-populating via agent every ~2.5 hrs
- POST /api/version-sync/ingest — agent pushes version data up additively
- GET /api/version-sync and /api/version-sync/:label — cache lookups
- POST /api/catalog-sync — fetches full Installomator catalog from GitHub
- GET /api/catalog — browse/search catalog
- GET /apps/status — returns patch_status (current/outdated/unknown) + cache_age_seconds per app via latest_versions join, now correctly filters by device_id
- Agent src/version-checker.js — Installomator DEBUG=1 batch runner
- Agent scheduler hook — version checks every 10 check-ins, async, non-blocking
- Post-patch version ingest — after successful patch, agent parses actual installed version from Installomator output, POSTs to /ingest immediately
- Post-patch inventory refresh — runCollection() fires after successful patch
- 🔴/🟡/✅ status badges on inventory dashboard AppCards
- Clickable patch status filter bar on App Inventory page
- Fleet device list shows outdated count per device (via latest_versions join)
- Device detail page — fully rewritten to fetch from fleet server directly, no mock data, no agentStore dependency
- Device detail page shows Outdated / Up to Date / Unknown sections with correct counts and version arrows (e.g. 4.38.125 → 4.49.81)
- App detail page — Installed Devices table now uses /apps/status (real patch_status + latest_version), not raw /apps
- PatchStatusBadge component — reusable, hover shows latest version
- Fleet summary bar — "🔴 N outdated · ✅ N current · 🟡 N unknown"
- Patch History — records jobs correctly with app, mode, status, duration, expandable logs
- reportJobToServer — now properly awaited before resolve() fires; errors log to console
- checkin.js — saves deviceId to /var/root/.orchardpatch/device-id.json after every successful checkin
- Poller — uses saved deviceId from device-id.json, not hostname fallback
- reportPatchJob — uses saved deviceId, not hardcoded hostname
- Installomator path — /usr/local/bin/Installomator.sh baked into INSTALLOMATOR_PATHS, symlink not needed
- Duplicate /fleet/devices/[id] route — now redirects to canonical /devices/[id]
- Verified end-to-end: Slack 4.38.125 → patched → 4.49.81 confirmed (Chip's Mac), 1Password 7.9.10 → patched → 7.9.11 confirmed (Chip's Mac), Docker 4.54.0 → patched → 4.69.0 confirmed (Jude's Mac)
- HomePageInner now uses /apps/status instead of raw /apps; hasVersionConflict reads patch_status==='outdated' (was is_outdated===1, always false); patchAllOutdated dep array fixed [] → [apps]
- Patch History Device column fixed — normalization typo (deviceId:j.device_name) corrected to deviceId:j.device_id + deviceName:j.device_name||j.device_id; server already had JOIN, purely frontend fix
- Redundant raw /apps fetch removed from api/fleet/apps/[id]/route.ts; deviceNames lookup now built from /devices only
- Patch All button hidden on app detail page (Patch by the Bushel not yet built); TODO comment in code
- App rows on device detail page are now clickable links to app detail (/apps/[bundle-id-slug]); hover turns name green
- Outdated count badge on device detail page is now a clickable filter toggle; active state shows ring + tint; subtitle shows × clear; empty state with both filters active shows "Clear filter" link

### ⚠️ Partially built
- Patch by the Bushel (fleet patching) — UI exists, bulk dispatch not wired. "Patch All" button errors with "deviceId is required" — needs deviceId passed per device in the loop
- Jamf API integration — proxy exists, real Jamf trial access pending
- Multi-tenancy / org isolation — single-tenant only

### ❌ Not yet built
- Patch by the Orchard (policy-based auto-remediation, enterprise tier)
- Automated catalog-sync schedule (manual curl for now)
- CLI (orchardpatch recon, patch, status, connect)
- Homebrew tap
- User auth / login (no auth wall yet)
- Patch Policy UX (Silent/Notify/Scheduled/User-initiated — UI exists, not persisted as policies yet)
- Sentry / error monitoring
- DB indexes for fleet queries
- Version string normalization (minor version drift edge cases)
- System app handling (Calendar, Chess, Books etc. show as Unknown — should be filtered or tagged N/A)
- Patch job logs viewable in UI (agent logs visible in Patch History expandable rows but need better formatting)
- Device name column missing from Patch History job table
- Force check-in button on device detail page
- Clickable app rows on device detail page (should link to app detail)
- Clickable outdated count on device detail page

## Polish punch list (pre-demo)

### Batch 1 — Data fixes ✅ DONE (commit b6cc392)
- ~~Audit all routes still hitting raw /apps instead of /apps/status~~ ✅
- ~~"Patch All" button fix~~ → hidden (Patch by the Bushel not yet built) ✅
- Per-device Patch button should only show on outdated rows (currently shows on current rows too)
- ~~Device name column empty in Patch History~~ ✅

### Batch 2 — Device detail interactions ✅ DONE (commit 06ac2a7)
- ~~App rows not clickable~~ ✅
- ~~Outdated count not clickable/filterable~~ ✅
- Force check-in button — deferred (see Open Items)
- ~~Patch Now button on outdated app rows~~ ✅ (was already correct)

### Batch 3 — System apps
- Filter or tag system apps (Calendar, Chess, Books etc.) as N/A instead of Unknown
- Research softwareupdate CLI viability for macOS system app patching

### Batch 4 — Polish
- Patch job logs viewable in UI with better formatting
- Auth wall before sharing with anyone
- Ticketing system + AI triage agent (post-launch, when users exist)

## Patch naming hierarchy
- Patch by the Fruit — single app, single device
- Patch by the Bushel — batch/fleet patching (partially built)
- Patch by the Orchard — policy-based auto-remediation (enterprise, future)

## DB schema (key tables)
- devices: id, hostname, device_id, last_seen, agent_version, agent_url (nullable)
- apps: id, device_id, bundle_id, name, version, latest_version (legacy/null), is_outdated (legacy/always 0 — do not use), installomator_label, path, source
- latest_versions: label (PK), latest_version, last_checked, error
- app_catalog: label (PK), app_name, bundle_id, expected_team, last_synced
- patch_jobs: (existing)

## Key API endpoints
- POST /checkin — agent check-in, inventory push
- GET /devices — fleet list with outdated_count (latest_versions join)
- GET /apps — raw app rows (do not use for status — use /apps/status)
- GET /apps/status?device_id= — patch status per app with cache_age_seconds, filters by device_id
- GET /stats — fleet stats (latest_versions join)
- POST /patch-jobs — queue a patch job
- GET /patch-jobs — list jobs
- POST /api/version-sync/ingest — ingest version data (agent or Routines)
- GET /api/version-sync — full version cache
- GET /api/version-sync/:label — single label lookup
- POST /api/catalog-sync — sync Installomator catalog from GitHub
- GET /api/catalog — browse catalog

## Open items / tech debt
- **Force check-in button (device detail page):** Deferred from Batch 2. Requires a pending-commands pattern: new DB table (`pending_commands`), server endpoint (`POST /commands`), and agent changes to poll for and execute pending commands on each check-in cycle. Agent can't be reached directly from Railway (NAT). Design and build as one unit when ready.
- **Patch by the Bushel (app detail page):** "Patch All" button is hidden. Real fan-out requires fleet-wide dispatch from the server — POST /patch once per device that has the app installed as outdated. The `patchDeviceId=null` path in `handleConfirmPatch` in `apps/[id]/page.tsx` also uses the hardcoded `INSTALLOMATOR_LABELS` map instead of the `label` field from `/apps/status`. Both must be addressed together when Patch by the Bushel is built.

- GitHub PAT (orchardpatch-catalog-sync) scoped to all public repos — tighten to Installomator repo only
- agent_url column on devices unused — reserved for future server-initiated flows
- No DB indexes on fleet queries yet — will matter at scale
- Catalog auto-sync not automated — manual curl for now
- is_outdated field on apps table is legacy, never set by agent — ignore
- latest_version field on apps table is legacy — latest_versions table is source of truth
- "Patch All Outdated" button on app detail page has deviceId bug — do not use
- Version string normalization not implemented — edge case with minor builds
- Chrome may show falsely outdated due to stale seed data — self-corrects on next version check run

## Environment variables (Railway — fleet server)
- DATABASE_URL — PostgreSQL connection (Railway env ref)
- SERVER_TOKEN — auth token for all API endpoints
- GITHUB_TOKEN — fine-grained PAT for catalog-sync GitHub API calls
- PORT — set by Railway
- DATA_DIR — data directory

## Agent environment variables
- SERVER_URL — fleet server URL
- SERVER_TOKEN — matches fleet server
- INSTALLOMATOR_PATH — /usr/local/bin/Installomator.sh (also in INSTALLOMATOR_PATHS array in version-checker.js)
- VERSION_CHECK_INTERVAL — check-ins between version runs (default: 10)

## Key design constraints
- Works in BeyondTrust / privilege management environments
- No sudo required — LaunchDaemon runs as root
- No MDM conflicts — agent pattern same as Jamf/Mosyle/Kandji
- Installomator is the only patch mechanism (1,083 supported apps)
- Single-tenant for now — multi-tenancy prerequisite for Patch by the Orchard
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
- Standing rule: always fix bugs at root cause. Never suggest manual workarounds. If a workaround is needed to unblock testing, flag it explicitly as tech debt before moving on.
- Claude.ai is better for: architecture decisions, code scaffolding, debugging topology/design issues, cross-repo reasoning
- Chip is better for: codebase-aware implementation, exact file locations, running commands, hot-deploying to installed agent
