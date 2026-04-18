# OrchardPatch — Project Context

Last updated: April 17, 2026

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

## Architecture decisions
- Agent ↔ server: REST polling only, no WebSocket
- Server cannot reach agents directly (Railway → NAT'd agent doesn't work)
- Version data is agent-initiated push, not server-pull
- Agent polls every 15 min; version checks run every 10 check-ins (~2.5 hrs)
- Patching via Installomator only — no MDM conflicts, no Secure Token needed
- Post-patch: agent immediately ingests confirmed version to latest_versions,
  then triggers inventory check-in — no staleness window after patching

## Version comparison philosophy
"Latest version" in OrchardPatch = latest version Installomator knows how
to install, not manufacturer's current release. This ensures 🔴 outdated
always means "patchable right now." Occasional 1-2 day lag between vendor
release and Installomator catching up is by design.

## Fleet
- 2 devices in production fleet
- device-GJM7N0XGL0: Jude's MacBook Pro (Mac16,1 · macOS 26.4 · 84 apps)
- device-C02D52QTML85: Chip's MacBook Pro (MacBookPro16,2 · macOS 26.3.2 ·
  58 apps · 2020 13" 2.3GHz Quad-Core Intel i7 16GB)
- Agent installed via .pkg on both machines
- Agent install path: /usr/local/orchardpatch/agent/
- Config: /etc/orchardpatch/config.json
- Logs: /var/log/orchardpatch/agent.log

## Feature status

### ✅ Shipped and production-ready
- App inventory collection and display
- Fleet view with device detail pages
- Patch by the Fruit (individual app patching, end-to-end, verified working)
- Patch job queue with real-time status polling
- Patch history with expandable logs
- Reports page with fleet health data
- PostgreSQL persistence
- Security hardening (parameterized queries, rate limiting, CORS)
- app_catalog table — 1,083 Installomator labels with bundle IDs and team IDs
  (labels now at fragments/labels/ not Labels/ in Installomator repo)
- latest_versions table — self-populating via agent every ~2.5 hrs
- POST /api/version-sync/ingest — agent pushes version data up additively
- GET /api/version-sync and /api/version-sync/:label — cache lookups
- POST /api/catalog-sync — fetches full Installomator catalog from GitHub
- GET /api/catalog — browse/search catalog
- GET /apps/status — returns patch_status (current/outdated/unknown) +
  cache_age_seconds per app via latest_versions join
- Agent src/version-checker.js — Installomator DEBUG=1 batch runner
- Agent scheduler hook — version checks every 10 check-ins, async,
  non-blocking (VERSION_CHECK_INTERVAL env var, default 10)
- Post-patch version ingest — after successful patch, agent parses actual
  installed version from Installomator output, POSTs to /ingest immediately
  with source: "post-patch"
- Post-patch inventory refresh — runCollection() fires after successful patch
- 🔴/🟡/✅ status badges on inventory dashboard AppCards
- Clickable patch status filter bar (🔴/✅/🟡 filters app list)
- Fleet device list shows outdated count per device (via latest_versions join,
  not legacy is_outdated field)
- Device detail page shows real Latest version and Status columns
- PatchStatusBadge component — reusable, hover shows latest version
- Fleet summary bar — "🔴 N outdated · ✅ N current · 🟡 N unknown"
- Verified end-to-end: Chrome 87.x detected → patched → 147.x confirmed

### ⚠️ Partially built
- Patch by the Bushel (fleet patching) — UI exists, bulk dispatch not wired
  "Patch All" button on app detail has deviceId bug, do not use
- Jamf API integration — proxy exists, real Jamf trial access pending
- Multi-tenancy / org isolation — single-tenant only

### ❌ Not yet built
- Patch by the Orchard (policy-based auto-remediation, enterprise tier)
- Automated catalog-sync schedule (Routine or cron — manual curl for now)
- CLI (orchardpatch recon, patch, status, connect)
- Homebrew tap
- User auth / login (no auth wall yet)
- Patch Policy UX (Silent/Notify/Scheduled/User-initiated — UI exists,
  not persisted as policies yet)
- Sentry / error monitoring
- DB indexes for fleet queries
- Version string normalization (minor version drift edge cases)

## Patch naming hierarchy
- Patch by the Fruit — single app, single device
- Patch by the Bushel — batch/fleet patching (partially built)
- Patch by the Orchard — policy-based auto-remediation (enterprise, future)

## Patch by the Orchard vision
Policy-based auto-remediation — "always keep Chrome within 1 version of
latest." Enterprise tier. Needs multi-tenancy first. Version cache is the
foundational dependency (shipped). Routines integration planned as the
scheduling/execution layer for policy runs.

## DB schema (key tables)
- devices: id, hostname, device_id, last_seen, agent_version, agent_url (nullable)
- apps: id, device_id, bundle_id, name, version, latest_version (legacy/null),
  is_outdated (legacy/always 0 — do not use), installomator_label, path, source
- latest_versions: label (PK), latest_version, last_checked, error
- app_catalog: label (PK), app_name, bundle_id, expected_team, last_synced
- patch_jobs: (existing)

## Key API endpoints
- POST /checkin — agent check-in, inventory push
- GET /devices — fleet list with outdated_count (latest_versions join)
- GET /apps — raw app rows
- GET /apps/status — patch status per app with cache_age_seconds
- GET /stats — fleet stats (latest_versions join)
- POST /patch-jobs — queue a patch job
- GET /patch-jobs — list jobs
- POST /api/version-sync/ingest — ingest version data (agent or Routines)
- GET /api/version-sync — full version cache
- GET /api/version-sync/:label — single label lookup
- POST /api/catalog-sync — sync Installomator catalog from GitHub
- GET /api/catalog — browse catalog

## Open items / tech debt
- GitHub PAT (orchardpatch-catalog-sync) scoped to all public repos —
  tighten to Installomator repo only
- agent_url column on devices unused — reserved for future server-initiated flows
- No DB indexes on fleet queries yet — will matter at scale
- Catalog auto-sync not automated — manual curl for now
- Routines integration planned for catalog-sync (weekly schedule)
- is_outdated field on apps table is legacy, never set by agent — ignore
- latest_version field on apps table is legacy — latest_versions table is
  source of truth
- "Patch All Outdated" button on app detail page has deviceId bug — do not use
- Version string normalization not implemented — edge case with minor builds
- Update CONTEXT.md at end of every session and commit to orchardpatch-server

## Environment variables (Railway — fleet server)
- DATABASE_URL — PostgreSQL connection (Railway env ref)
- SERVER_TOKEN — auth token for all API endpoints
- GITHUB_TOKEN — fine-grained PAT for catalog-sync GitHub API calls
  (tighten scope to Installomator repo only when convenient)
- PORT — set by Railway
- DATA_DIR — data directory

## Agent environment variables
- SERVER_URL — fleet server URL
- SERVER_TOKEN — matches fleet server
- INSTALLOMATOR_PATH — default: /usr/local/Installomator/Installomator.sh
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
- Chip pushes via PAT embedded in remote URLs (orchardpatch-server and
  orchardpatch-agent remotes have working PAT — do not change)
- Chip's git identity: user.name=Chip, user.email=chip@openclaw
  orchardpatch-server has local override: Jude Glenn / judeglenn@example.com
- Context is lost when Chip compacts — use this file to restore
- Start Claude.ai sessions by opening OrchardPatch project (CONTEXT.md loaded)
- End every session: ask Claude.ai to update CONTEXT.md, paste to Chip, commit
- Claude.ai is better for: architecture decisions, code scaffolding,
  debugging topology/design issues, cross-repo reasoning
- Chip is better for: codebase-aware implementation, knowing exact file
  locations, running commands, hot-deploying to installed agent
