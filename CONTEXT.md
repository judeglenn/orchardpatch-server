# OrchardPatch -- Project Context

Last updated: April 24, 2026

## What OrchardPatch is
A Mac admin tool providing complete visibility into managed macOS fleet apps
and patching via Installomator -- without touching your MDM. Tagline:
"See Everything. Patch Anything. Break Nothing."

## Parent Brand (Future)
GraftKit -- the cross-platform umbrella brand when OrchardPatch expands beyond
macOS (Windows, Linux). OrchardPatch becomes the macOS product under the GraftKit
family. Competing at that scale: NinjaRMM, ConnectWise, Automox.
graftkit.com registered but parked. Focus on OrchardPatch first.

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

## Environment variables (Railway -- fleet server)
- DATABASE_URL -- PostgreSQL connection (Railway env ref)
- SERVER_TOKEN -- auth token for all API endpoints
- GITHUB_TOKEN -- fine-grained PAT for catalog-sync GitHub API calls
- PORT -- set by Railway
- DATA_DIR -- data directory

## Vercel environment variables (frontend)
- LOGIN_PASSWORD -- passphrase users enter to access the app
- SESSION_SECRET -- static random string stored in session cookie, validated by middleware
- NEXT_PUBLIC_FLEET_SERVER_URL -- Railway fleet server URL
- NEXT_PUBLIC_FLEET_SERVER_TOKEN -- token for direct browser-to-Railway calls

## Agent environment variables
- SERVER_URL -- fleet server URL
- SERVER_TOKEN -- matches fleet server
- INSTALLOMATOR_PATH -- /usr/local/bin/Installomator.sh
- VERSION_CHECK_INTERVAL -- check-ins between version runs (default: 10)

## Architecture decisions
- Agent to server: REST polling only, no WebSocket
- Server cannot reach agents directly (Railway to NAT'd agent doesn't work)
- Version data is agent-initiated push, not server-pull
- Agent polls every 15 min; version checks run every 10 check-ins (~2.5 hrs)
- Patching via Installomator only -- no MDM conflicts, no Secure Token needed
- Post-patch: agent immediately ingests confirmed version to latest_versions,
  then triggers inventory check-in -- no staleness window after patching
- Vercel deploys automatically via GitHub integration on push to main -- no CLI needed
- Auth wall: Next.js middleware with two-env-var design (LOGIN_PASSWORD +
  SESSION_SECRET). Placeholder until multi-tenancy is built. Real auth
  (SSO, 2FA, user management) lives in Settings > Security when built.

## Two-table patch pattern (CRITICAL -- read before building any patch feature)
- pending_patches -- the agent work queue. Agent polls this table every 15 min.
  Every patch operation MUST write here or the agent will never execute it.
- patch_jobs -- the history/audit log. Every patch operation MUST also write
  here for history tracking.
- Both tables must be written atomically on every patch insertion -- Fruit,
  Branch, Bushel, Orchard all follow this pattern without exception.
- Fruit works via POST /patch which writes to both. Branch fixed to match.
  Any future patch method must do the same or jobs will queue silently forever.

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
Bundle ID matching from fragments is not viable -- bundleID is effectively
absent from the Installomator fragment corpus. Label assignment uses a
priority chain in the agent:
1. Label overrides (hand-curated, /etc/orchardpatch/label-overrides.json)
2. Agent local catalog match by bundle ID (sparse but exact where it exists)
3. Agent local catalog match by normalized name (primary path for most apps)
4. null -- app stays Unknown
Unknown means genuinely unpatchable via Installomator, not a bug.
Future: "suggest label" UI on Unknown rows, community seed file for top 100 apps.

## Key design constraints
- Works in BeyondTrust / privilege management environments
- No sudo required -- LaunchDaemon runs as root
- No MDM conflicts -- agent pattern same as Jamf/Mosyle/Kandji
- Installomator is the only patch mechanism (1,083 supported apps)
- Single-tenant for now -- multi-tenancy is a prerequisite for Cultivation
- Installomator fragments now at fragments/labels/ (not Labels/) in repo

## Patch naming hierarchy
- Fruit -- single app, single device (shipped)
- Branch -- all outdated apps, single device (shipped)
- Bushel -- single app, all devices (partially built)
- Orchard -- all outdated apps, entire fleet (not yet built)
- Cultivation -- policy-based, automated, scheduled (enterprise tier, future)

## UI homes for each tier
- Fruit: app detail page, scoped to one device
- Branch: device detail page, "Patch This Device" button
- Bushel: app detail page, fleet-wide action
- Orchard: fleet dashboard, "patch all outdated everywhere"
- Cultivation: /orchard page, Coming Soon

## Patch mode values (standardized)
- silent -- force quit, no prompts. NOTIFY=silent, BLOCKING=kill
- managed -- notifies user to quit. NOTIFY=success, BLOCKING=tell_user
- prompted -- user chooses when. NOTIFY=all, BLOCKING=prompt_user
Note: 'prompted' is the production value -- do not use 'prompt_user'.
If app is already closed, Installomator installs silently regardless of mode.

## Pricing tiers
- Free: Visibility only -- inventory dashboard
- Standard: Patch by the Fruit -- individual device/app patching
- Pro: Patch by the Bushel and Branch -- fleet patching
- Enterprise: Cultivation -- policy-based auto-remediation
Note: pricing model is conceptual, not yet enforced in product.
The /orchard (Cultivation) page correctly points to an Enterprise waitlist.
Consider a dedicated https://orchardpatch.com/enterprise landing page
for in-app waitlist links -- warmer leads than the general homepage.

## AI development workflow
- Primary dev assistant: Chip (OpenClaw, Claude API, has own MacBook Pro)
- Architecture / planning: Claude.ai (this project)
- Chip pushes via PAT embedded in remote URLs
- Chip's git identity: user.name=Chip, user.email=chip@openclaw
- orchardpatch-server has local override: Jude Glenn / judeglenn@example.com
- orchardpatch-server repo is root-owned -- Chip must use sudo for all git ops
- Context is lost when Chip compacts -- use this file to restore
- Start Claude.ai sessions by opening OrchardPatch project (CONTEXT.md loaded)
- End every session: ask Claude.ai to update CONTEXT.md, paste to Chip, commit
- Standing rule: always fix bugs at root cause. Never suggest manual
  workarounds. If a workaround is needed to unblock testing, flag it
  explicitly as tech debt before moving on.
- Claude.ai is better for: architecture decisions, code scaffolding,
  debugging topology/design issues, cross-repo reasoning
- Chip is better for: codebase-aware implementation, exact file locations,
  running commands, hot-deploying to installed agent
- Use Opus for: complex ambiguous architecture decisions, multi-tenancy
  design, Cultivation policy engine, YC application writing

## Go-to-market
- Target: MacAdmins Slack (70k+ members), Jamf Nation, PSU MacAdmins
- Distribution: bottom-up adoption, individual Mac admins champion internally
- YC Summer 2026 application deadline: May 4, 2026 -- actively evaluating
- Key pitch: "Jamf App Catalog shows you what you told it to track.
  OrchardPatch shows you everything that's actually on your fleet."
- Competitive window: 18-24 months before Jamf App Installers become a
  real threat. Build fast.

## Fleet
- 2 devices in production fleet
- device-GJM7N0XGL0: Jude's MacBook Pro (Mac16,1 · macOS 26.4 · 84 apps)
- device-C02D52QTML85: Chip's MacBook Pro (MacBookPro16,2 · macOS 26.3.2 · 61 apps · 2020 13" 2.3GHz Quad-Core Intel i7 16GB)
- Agent installed via .pkg on both machines
- Agent install path: /usr/local/orchardpatch/agent/
- Config: /etc/orchardpatch/config.json
- Logs: /var/log/orchardpatch/agent.log
- Device ID persisted to /var/root/.orchardpatch/device-id.json
- Phantom "Mac" device (device-Mac) deleted via migration -- was duplicate
  registration of Jude's Mac from pre-persistence-fix era

## DB schema (key tables)
- devices: id, hostname, device_id, last_seen, agent_version, agent_url (nullable)
- apps: id, device_id, bundle_id, name, version, latest_version (legacy/null),
  is_outdated (legacy/always 0 -- do not use), installomator_label, path, source
  source values: 'user' (third-party, patchable), 'system' (Apple-managed, N/A)
- latest_versions: label (PK), latest_version, last_checked, error
- app_catalog: label (PK), app_name, bundle_id, expected_team, last_synced
  NOTE: bundle_id is null for effectively all rows -- bundleID is absent from
  Installomator fragments. app_name population requires regex fix (see tech debt).
- patch_jobs: device_id, device_name (hostname via JOIN on devices), app, mode,
  method, initiated_by, status, duration, log output
  method values: 'fruit', 'branch', 'bushel', 'orchard'
  mode values: 'silent', 'managed', 'prompted'
  initiated_by: nullable, always null until real auth exists
- pending_patches: agent work queue -- agent polls this every 15 min

## Key API endpoints
- POST /checkin -- agent check-in, inventory push (now includes installomator_label)
- GET /devices -- fleet list with outdated_count (latest_versions join)
- GET /apps -- raw app rows (do not use for status -- use /apps/status)
- GET /apps/status?device_id= -- patch status per app with cache_age_seconds
  patch_status values: 'outdated', 'current', 'unknown', 'na'
  'na' is returned when source = 'system' -- skips latest_versions lookup entirely
- GET /stats -- fleet stats
- POST /patch -- queue a Fruit patch job (writes to both pending_patches and patch_jobs)
- POST /patch-jobs/branch -- queue a Branch patch job (writes to both tables)
  body: { device_id, labels: string[], mode: 'silent'|'managed'|'prompted' }
  server validates each label is genuinely outdated before inserting
  defaults mode to 'managed' if omitted
- GET /patch-jobs -- list jobs, supports ?device_id, ?method, ?mode, ?status filters
- POST /api/version-sync/ingest -- ingest version data
- GET /api/version-sync -- full version cache
- GET /api/version-sync/:label -- single label lookup
- POST /api/catalog-sync -- sync Installomator catalog from GitHub
- GET /api/catalog -- browse catalog (hard-capped at 200 rows)

## Feature status

### Shipped
- App inventory collection and display
- Fleet view with device detail pages
- Patch by the Fruit (individual app patching, end-to-end, verified working)
- Patch by the Branch (all outdated apps, single device, end-to-end verified)
  - "Patch This Device" button on device detail page
  - Modal with outdated app checklist, all pre-checked, live count
  - Deployment Mode selector: Silent / Managed (default) / User Prompted
  - Server-side validation: each label verified genuinely outdated before insert
  - Atomic transaction: all-or-nothing job insertion
  - Redirects to patch history filtered by device on confirm
  - Verified: Firefox 149->150, Ollama, Telegram on Chip's Mac
- Patch job queue with real-time status polling
- Patch history with expandable logs
- Method and Mode columns in patch history
  - Method: Fruit 🍎 / Branch 🌿 / Bushel 🧺 / Orchard 🌳 with tooltips
  - Mode: Silent / Managed / User Prompted
  - Initiated By column (placeholder, always -- until real auth)
- URL-driven patch history filters
  - Device typeahead (client-side, portal-rendered dropdown)
  - Method, Mode, Status, Date Range, App/Label dropdowns
  - All filters in URL params -- shareable and bookmarkable
  - Auto-applies device filter when redirected from Branch modal
- Reports page with fleet health data
- PostgreSQL persistence
- Security hardening (parameterized queries, rate limiting, CORS)
- app_catalog table -- 1,083 Installomator labels synced from GitHub
- latest_versions table -- self-populating via agent every ~2.5 hrs
- POST /api/version-sync/ingest -- agent pushes version data up additively
- GET /api/version-sync and /api/version-sync/:label -- cache lookups
- POST /api/catalog-sync -- fetches full Installomator catalog from GitHub
- GET /api/catalog -- browse/search catalog
- GET /apps/status -- returns patch_status + cache_age_seconds per app,
  filters by device_id
- Agent src/version-checker.js -- Installomator DEBUG=1 batch runner
- Agent scheduler hook -- version checks every 10 check-ins, async, non-blocking
- Post-patch version ingest -- agent parses installed version from Installomator
  output, POSTs to /ingest immediately after successful patch
- Post-patch inventory refresh -- runCollection() fires after successful patch
- Status badges on inventory dashboard AppCards
- Clickable patch status filter bar on App Inventory page
- Fleet device list shows outdated count per device
- Device detail page -- fetches from fleet server directly, no mock data
- App detail page -- uses /apps/status (real patch_status + latest_version)
- PatchStatusBadge component -- reusable, hover shows latest version
- Fleet summary bar -- "N outdated · N current · N unknown"
- Patch History -- records jobs with app, mode, status, duration, expandable logs
- Auth wall -- Next.js middleware, LOGIN_PASSWORD + SESSION_SECRET env vars
- Label enrichment at check-in
- Version checker NOTIFY=silent fix (partially effective -- see tech debt)
- Cultivation page (/orchard) -- five-tier hierarchy, Enterprise banner

### Known genuine unknowns (Jude's device)
- ASUS Device Discovery
- Avidemux
- BlueBubbles
- DaVinci Resolve (check -- Installomator may have a label for this)
- DisplayLinkUserAgent (x2 -- driver component, not a patchable app)
- Google Docs, Sheets, Slides (browser shortcuts, not real binaries)

### Partially built
- Patch by the Bushel (single app, all devices) -- UI exists on app detail
  page, "Patch All" button hidden, label source bug not fixed, fan-out
  dispatch not wired
- Jamf API integration -- proxy exists, real Jamf trial access pending
- Multi-tenancy / org isolation -- single-tenant only

### Not yet built
- Patch by the Orchard (all outdated, entire fleet) -- lives on fleet dashboard
- Cultivation / policy-based auto-remediation -- Coming Soon page exists
- Dashboard homepage -- fleet health at a glance, method definitions key,
  quick actions. Natural landing page once real customers exist.
- Graph reports -- patch success rate over time, fleet compliance trend,
  most patched apps, time-to-patch. Meaningful once more history data exists.
- Automated catalog-sync schedule
- CLI (orchardpatch recon, patch, status, connect)
- Homebrew tap
- Patch Policy UX persistence (UI exists, not persisted as policies)
- Sentry / error monitoring
- DB indexes for fleet queries
- Version string normalization
- Force check-in button on device detail page
- softwareupdate CLI research for system app patching
- "Suggest label" UI on Unknown app rows
- Community seed file for top 100 bundle ID -> label mappings
- SSO / proper auth
- orchardpatch.com/enterprise landing page
- mas integration (Mac App Store patching)
- AI-assisted patch approval workflows
- Auto-generate policy documentation / MDM deployment playbooks
- History auto-refresh / periodic polling (currently manual Refresh button)
- Server-side device typeahead (current is client-side, fine until fleet scale)

## Open items / tech debt
- **PatchJob type mismatch:** resolved -- log typed as string[] to match
  normalizer. method and initiated_by fields added to type.
- **coconutBattery version string:** version checker returning <body> for
  this label -- HTML page fetched instead of version string. Shows as
  outdated with <body> as latest version. Root cause in version-checker.js.
- **Chrome version string:** version checker returning a date (2026-04-23)
  instead of version number. Same root cause category as coconutBattery.
- **User Prompted mode tooltip:** Branch modal mode cards need helper text
  explaining that if the app is already closed, Installomator installs
  silently regardless of mode selection. UX note, not a functional bug.
- **Initiated By column:** always null until real user accounts exist.
  Wire up when SSO/auth is built.
- **app_catalog regex fix:** parseFragment() regex uses ^ anchors but
  fragment fields are indented. app_name and expected_team not populating
  correctly for most rows.
- **GET /api/catalog hard cap:** returns max 200 rows regardless of limit param.
- **DaVinci Resolve:** may have an Installomator label -- verify and add
  label override if so.
- **Force check-in button:** requires pending-commands pattern.
- **Patch by the Bushel:** "Patch All" button hidden. Fan-out requires
  fleet-wide dispatch. Label source bug in handleConfirmPatch also uses
  hardcoded map instead of label from /apps/status. Fix both together.
- **orchardpatch-server root ownership:** root-owned on Chip's machine.
- **GitHub PAT:** scoped to all public repos -- tighten to Installomator
  repo only. Expires May 17, 2026.
- **agent_url column:** unused, reserved for future server-initiated flows.
- **No DB indexes** on fleet queries yet.
- **Catalog auto-sync** not automated.
- **is_outdated field:** legacy, never set -- ignore.
- **latest_version field on apps table:** legacy -- latest_versions is
  source of truth.
- **firefoxpkg label:** verify patches standard Firefox not ESR.
- **Version checker notifications:** NOTIFY=silent incomplete -- some labels
  fire displaynotification unconditionally. Defer until post-launch.
- **Server-side device typeahead:** current typeahead fetches all devices
  client-side. Needs server-side search at fleet scale (hundreds+ devices).
