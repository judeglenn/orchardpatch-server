# OrchardPatch -- Project Context

Last updated: June 12, 2026

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
  (NOTE: scheduled for removal in Phase 5 token lockdown, see Not Yet Built)

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

## Agent job execution model (IMPORTANT -- confirmed June 12)
- pollAndRunPatches in scheduler.js:
  1. fetchPendingPatches(deviceId) -- GET /pending-patches?device_id=...
     returns rows from pending_patches where claimed_at IS NULL
  2. claimPatch(patch.id) -- POST /pending-patches/:id/claim -- atomically
     sets claimed_at on pending_patches ONLY. Does NOT touch patch_jobs.status
     and does NOT delete the pending_patches row.
  3. Runs runPatchJob() -> Installomator executes
  4. waitForJob(job) -- waits for completion
  5. reportPatchJob(job) -- POSTs result to server, which updates
     patch_jobs.status to success or failed AND deletes the pending_patches row
- CRITICAL: patch_jobs.status NEVER transitions to "in_progress" or "running".
  It stays "queued" for the entire execution window, then jumps directly to
  success/failed on completion.
- Implication for cancel logic: a patch_jobs row with status="queued" (or any
  non-terminal status) and NO corresponding pending_patches row can ONLY mean
  the job was never enqueued (orphaned at insert time). It CANNOT mean "agent
  is actively running it" -- if the agent had it, the pending_patches row
  would still exist (with claimed_at set), since it's only deleted on
  completion (a terminal status, caught earlier in cancel logic).

## Two-table patch pattern (CRITICAL -- read before building any patch feature)
- pending_patches -- the agent work queue. Agent polls this table every 15 min.
  Every patch operation MUST write here or the agent will never execute it.
- patch_jobs -- the history/audit log. Every patch operation MUST also write
  here for history tracking.
- Both tables must be written atomically on every patch insertion -- Fruit,
  Branch, Bushel, Orchard all follow this pattern without exception.
- Fruit works via POST /patch which writes to both. Branch and Bushel follow
  the same pattern. Any future patch method must do the same or jobs will
  queue silently forever.
- CONFIRMED FAILURE MODE (June 12): 10 jobs from a May 12 ad-hoc curl test
  (8 orchard, 2 bushel) were written to patch_jobs but never to pending_patches,
  likely because the test bypassed the proper /patch-jobs/orchard endpoint.
  These sat as status="queued" for a month, permanently unrunnable, and the
  cancel endpoint couldn't clean them up (see Cancel endpoint fix below).
  All 10 have now been cancelled. The /patch-jobs/orchard, /bushel, /branch,
  /patch endpoints themselves are confirmed working correctly (atomic
  two-table writes verified) -- this was a one-time artifact of manual testing,
  not a recurring bug in the endpoints.

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
- Installomator is the only patch mechanism (1,137 supported labels as of
  June 12 catalog sync)
- Single-tenant for now -- multi-tenancy is a prerequisite for Cultivation
- Installomator fragments now at fragments/labels/ (not Labels/) in repo

## Patch naming hierarchy
- Fruit -- single app, single device (shipped)
- Branch -- all outdated apps, single device (shipped)
- Bushel -- single app, all devices (shipped)
- Orchard -- all outdated apps, entire fleet (shipped)
- Cultivation -- policy-based, automated, scheduled (enterprise tier, future)

## UI homes for each tier
- Fruit: app detail page fleet installations table (per-device Patch button)
- Branch: device detail page, "Patch This Device" button
- Bushel: app detail page, "Patch All Outdated (N)" button
- Orchard: Fleet Dashboard (/dashboard), "Patch All Outdated" card
- Catalog: /catalog page, deploy any label to any device (in progress)
- Cultivation: /orchard page, Coming Soon

## Frontend routing structure
- / -- redirects to /dashboard
- /dashboard -- Fleet Dashboard (homepage)
- /apps -- App Inventory (was at / before May 12 session)
- /apps/[id] -- App detail page
- /catalog -- Software Catalog (in progress, backend ready as of June 12)
- /devices -- Device list
- /devices/[id] -- Device detail page
- /patch-history (also referenced as /patches in deployed frontend) -- Patch History
- /orchard -- Cultivation Coming Soon page

## Patch mode values (standardized)
- silent -- force quit, no prompts. NOTIFY=silent, BLOCKING=kill
- managed -- notifies user to quit. NOTIFY=success, BLOCKING=tell_user
- prompted -- user chooses when. NOTIFY=all, BLOCKING=prompt_user
Note: 'prompted' is the production value -- do not use 'prompt_user'.
If app is already closed, Installomator installs silently regardless of mode.
Orchard modal defaults to 'silent' -- managed floods all users with
notifications simultaneously during fleet-wide patches. Branch and Bushel
default to managed.

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
- Chip pushes via SSH (account-level SSH key "Chip (OpenClaw)" on GitHub)
  - Key lives at ~/.ssh/id_ed25519 on Chip's machine (user: chip)
  - SSH push auth fixed permanently June 12: the exec environment that runs
    git operations runs as root (/var/root/.ssh/), but Chip's key lives at
    /Users/chip/.ssh/id_ed25519. Wrote /var/root/.ssh/config:
      Host github.com
        IdentityFile /Users/chip/.ssh/id_ed25519
        StrictHostKeyChecking no
    Verified via git ls-remote with no GIT_SSH_COMMAND override needed.
  - NOTE: a machine reboot on June 11/12 invalidated the previous SSH key
    registration on GitHub. Old key removed, new key added June 12. If
    pushes start failing again after a future reboot, check this first.
  - Works for all orchardpatch repos -- no per-repo deploy keys needed
  - Next PAT rotation: tighten GITHUB_TOKEN scope to Installomator repo only
- Chip's git identity: user.name=Chip, user.email=chip@openclaw
- orchardpatch-server has local override: Jude Glenn / judeglenn@example.com
- File ownership on Chip's machine: run `sudo chown -R chip:staff ~/Projects`
  if root-ownership recurs (git ops were previously run as sudo, causing this).
  Fixed May 12 for all three repos -- standing rule: never sudo git.
- Edit tool fails on JS/TS files containing template literals (backticks).
  Use Python file replacement for any substantial JS/TS edits on Chip's machine.
- CRITICAL: when using Python to write JS/TS files, avoid JS template literals
  with dollar signs (${}). Python's string handling can mangle them. Use plain
  string concatenation or var assignments instead. This caused a server crash
  loop on May 19 when catalog endpoint SQL used $${} syntax.
- Always run `npm run build` locally before pushing any new page or component.
  Catches TypeScript and import errors before they burn a Vercel deploy.
- Context is lost when Chip compacts -- use this file to restore
- Start Claude.ai sessions by opening OrchardPatch project (CONTEXT.md loaded)
- End every session: ask Claude.ai to update CONTEXT.md, paste to Chip, commit
- Standing rule: always fix bugs at root cause. Never suggest manual
  workarounds. If a workaround is needed to unblock testing, flag it
  explicitly as tech debt before moving on.
- Standing rule: all fixes and updates should be resolvable through
  OrchardPatch itself. Don't suggest manual CLI commands on machines when
  OrchardPatch should handle it (e.g., updating Installomator via the
  catalog, not via manual curl).
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
- device-GJM7N0XGL0: Jude's MacBook Pro (Mac16,1 · macOS 26.4 · ~93 apps as
  of June 12 inventory)
- device-C02D52QTML85: Chip's MacBook Pro (MacBookPro16,2 · macOS 26.3.2 · 61 apps · 2020 13" 2.3GHz Quad-Core Intel i7 16GB)
- Agent installed via .pkg on both machines
- Agent install path: /usr/local/orchardpatch/agent/
- Config: /etc/orchardpatch/config.json
- Logs: /var/log/orchardpatch/agent.log
- Device ID persisted to /var/root/.orchardpatch/device-id.json
- Phantom "Mac" device (device-Mac) deleted via migration -- was duplicate
  registration of Jude's Mac from pre-persistence-fix era
- Installomator version: v10.9beta (2025-12-23) on both machines -- outdated,
  should be updated via catalog deploy once Software Catalog page ships
- Agent confirmed healthy June 12: 15-min inventory/check-in loop running
  continuously, version-checker running every 10 check-ins (#280, #290
  observed), reporting to server successfully. Agent itself is NOT the
  source of any unwanted installs -- see Notification Storm tech debt below
  for what it IS doing.

## DB schema (key tables)
- devices: id, hostname, device_id, last_seen, agent_version, agent_url (nullable)
- apps: id, device_id, bundle_id, name, version, latest_version (legacy/null),
  is_outdated (legacy/always 0 -- do not use), installomator_label, path, source
  source values: 'user' (third-party, patchable), 'system' (Apple-managed, N/A)
- latest_versions: label (PK), latest_version, last_checked, error
- app_catalog: label (PK), app_name, bundle_id, expected_team, last_synced
  NOTE: bundle_id is null for effectively all rows -- bundleID is absent from
  Installomator fragments. app_name and expected_team now populated correctly
  after May 12 regex fix (1,137 rows with real data as of June 12).
- patch_jobs: id, device_id, app_name, label, mode, method, status, created_at,
  duration, log output
  method values: 'fruit', 'branch', 'bushel', 'orchard'
  mode values: 'silent', 'managed', 'prompted'
  status values: 'queued', 'success', 'failed', 'cancelled'
  ('running'/'in_progress' do NOT occur in normal operation -- see Agent job
  execution model above. A 'running' status seen June 12 was a data
  corruption artifact from the old cancel endpoint bug, now fixed and cleared.)
  initiated_by: nullable, always null until real auth exists
- pending_patches: agent work queue -- agent polls this every 15 min.
  Rows have a claimed_at column (set by claimPatch, never null once the
  agent has picked up the job). Row is deleted only on job completion.
  id matches patch_jobs.id (paired in dual-write)
- preferences: key (PK), value (text) -- single-tenant user preferences store.
  Not yet created. Needed for Pinned Apps persistence on Dashboard.

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
- POST /patch-jobs/bushel -- queue a Bushel patch job (writes to both tables)
  body: { label, mode: 'silent'|'managed'|'prompted' }
  finds all devices where label is installed, source='user', and version is outdated
  server validates label exists in latest_versions before querying devices
  returns { queued: N, devices: [{ device_id, hostname, current_version }] }
- POST /patch-jobs/orchard -- queue an Orchard patch job (writes to both tables)
  body: { mode: 'silent'|'managed'|'prompted' }
  finds all devices, all outdated user apps per device, queues atomically
  method = 'orchard' on all inserted jobs
  returns { queued: N, devices: [{ device_id, hostname, app_count }],
            apps: [{ label, app_name, device_count }] }
- POST /patch-jobs/:id/cancel -- cancel a pending patch job
  REWRITTEN June 12 (see Feature status -> Shipped for details). Correctly
  distinguishes "never enqueued" (orphaned, cancellable directly) from
  "agent has claimed and is actively running" (409, not cancellable) using
  pending_patches.claimed_at rather than mere row existence.
- GET /patch-jobs -- list jobs, supports ?device_id, ?method, ?mode, ?status filters
  LEFT JOINs devices for device_name (hostname)
- POST /api/version-sync/ingest -- ingest version data
- GET /api/version-sync -- full version cache
- GET /api/version-sync/:label -- single label lookup
- POST /api/catalog-sync -- sync Installomator catalog from GitHub
- GET /api/catalog -- browse catalog
  ?search= filters by label or app_name (FIXED June 12 -- was reading
  req.query.q, now reads req.query.search to match frontend contract)
  Pagination via limit/offset, total count included, no hard cap (1,137 rows
  confirmed reachable)

## Next.js proxy routes (frontend)
- /api/patch-jobs/bushel
- /api/patch-jobs/orchard
- /api/patch-jobs/[id]/cancel
- /api/stats
- /api/devices
- /api/apps/status
- /api/catalog -- NOT YET BUILT, needed for Phase 3 (Software Catalog page),
  should be built proxied from the start per Phase 5 token lockdown goals

## Feature status

### Shipped
- App inventory collection and display
- Fleet view with device detail pages
- Patch by the Fruit (individual app patching, end-to-end, verified working)
- Patch by the Branch (all outdated apps, single device, end-to-end verified)
- Patch by the Bushel (single app, all outdated devices, end-to-end verified)
- Patch by the Orchard (all outdated apps, entire fleet, end-to-end verified)
- Patch job cancel (server + frontend, shipped May 19, REWRITTEN June 12)
  - Original implementation (May 19) had a logic bug: when no pending_patches
    row existed for a non-terminal job, it assumed "agent picked it up" and
    returned 409 -- AND as a side effect flipped patch_jobs.status to "running"
    if it was "queued", corrupting the row's status on every failed attempt.
  - June 12 fix: per the confirmed agent execution model (claimPatch never
    deletes pending_patches, only completion does, and completion is always
    terminal), a missing pending_patches row + non-terminal status can only
    mean "never enqueued." These jobs now cancel directly (status ->
    'cancelled', nothing to delete). A pending_patches row with claimed_at set
    correctly returns 409 "already picked up." The destructive "flip to
    running" side effect is removed entirely.
  - Used this fix to clear 10 orphaned jobs from a May 12 ad-hoc curl test
    (8 orchard, 2 bushel) that had been stuck in "queued" for a month with
    no pending_patches rows (never properly enqueued). Patch History queue
    is now clean.
- GET /api/catalog search fix (June 12)
  - Route was reading req.query.q while the documented frontend contract
    (and curl tests) use ?search=. Changed to req.query.search.
  - Verified: ?search=firefox returns 8 firefox-family labels (firefox,
    firefox_intl, firefoxesr, firefoxpkg, firefoxpkg_intl, etc.)
  - Pagination, total count (1,137), and absence of the old 200-row cap all
    confirmed working -- the May 19/20 catalog rewrite (commit 527e159,
    deployed as of 5056d17) is fully functional. Software Catalog frontend
    page (Phase 3) is unblocked.
- Fleet Dashboard (/dashboard) -- homepage after login
- App detail page
- App Inventory moved to /apps (was at / before May 12 session)
- Patch job queue with real-time status polling
- Patch history with expandable logs
- URL-driven patch history filters
- All patch methods redirect to Patch History after queuing (Fruit fixed May 19)
- Mode tooltips on all modals
- Reports page with fleet health data
- PostgreSQL persistence
- Security hardening (parameterized queries, rate limiting, CORS)
- app_catalog table -- 1,137 Installomator labels synced from GitHub
- latest_versions table -- self-populating via agent every ~2.5 hrs
- POST /api/version-sync/ingest -- agent pushes version data up additively
- GET /api/version-sync and /api/version-sync/:label -- cache lookups
- POST /api/catalog-sync -- fetches full Installomator catalog from GitHub
- GET /api/catalog -- browse/search catalog (search fixed June 12)
- GET /apps/status -- returns patch_status + cache_age_seconds per app,
  filters by device_id
- Agent src/version-checker.js -- Installomator DEBUG=1 batch runner
  Now validates version strings with /^\d+\.\d/ before storing -- rejects
  HTML responses and date strings. Deployed to Chip's machine. Needs deploy
  to Jude's machine (see tech debt).
  CONFIRMED RUNNING June 12: checked 44 labels twice in ~2.5hr window
  (Check-in #280, #290), ingested results to server successfully. BUT see
  Notification Storm tech debt -- this is the source of an active,
  high-priority issue.
- Agent scheduler hook -- version checks every 10 check-ins, async, non-blocking
- Post-patch version ingest -- agent parses installed version from Installomator
  output, POSTs to /ingest immediately after successful patch
- Post-patch inventory refresh -- runCollection() fires after successful patch
- Status badges on inventory dashboard AppCards
- Clickable patch status filter bar on App Inventory page
- Fleet device list shows outdated count per device
- Device detail page -- fetches from fleet server directly, no mock data
- PatchStatusBadge component -- reusable, hover shows latest version
- Fleet summary bar -- "N outdated . N current . N unknown"
- Patch History -- records jobs with app, mode, status, duration, expandable logs
- Auth wall -- Next.js middleware, LOGIN_PASSWORD + SESSION_SECRET env vars
- Label enrichment at check-in
- Cultivation page (/orchard) -- five-tier hierarchy, Enterprise banner

### Known genuine unknowns (Jude's device)
- ASUS Device Discovery
- Avidemux
- BlueBubbles
- DaVinci Resolve (check -- Installomator may have a label for this)
- DisplayLinkUserAgent (x2 -- driver component, not a patchable app)
- Google Docs, Sheets, Slides (browser shortcuts, not real binaries)

### In progress
- Software Catalog page (/catalog) -- browse and deploy from full Installomator
  catalog. Server-side is now READY (search fixed June 12, pagination/count
  confirmed working). Remaining work:
  - Frontend: new page, searchable table, deploy modal with device selector
    and mode picker, nav entry under Inventory
  - Needs Next.js proxy route /api/catalog (build with non-public
    FLEET_SERVER_TOKEN from the start, aligns with Phase 5 token lockdown)
  - Design principle: page is "Software Catalog" not "Installomator Catalog" --
    future-proofed for Homebrew, mas, and other package sources. Don't hardcode
    "Installomator" in logic, only in source badges.
  - Decide: does deploy-from-catalog reuse POST /patch (Fruit semantics)?
    Should work since Installomator installs regardless of current presence,
    but verify server doesn't reject labels absent from device inventory.
- Force check-in -- designed, not yet built. See architecture section below.

### Partially built
- Jamf API integration -- proxy exists, real Jamf trial access pending
- Multi-tenancy / org isolation -- single-tenant only

### Not yet built
- Force check-in / immediate agent poll -- architecture designed May 19:
  - Split agent into fast loop (60s) and slow loop (15min)
  - Fast loop: check pending_patches + new pending_commands table
    (lightweight SELECTs)
  - Slow loop: full inventory collection, version checks
  - New table: pending_commands (id, device_id, command, created_at,
    claimed_at, expires_at with 24hr default)
  - New endpoints: POST /devices/:id/commands, GET /pending-commands,
    POST /pending-commands/:id/claim
  - Deduplication: one outstanding command per type per device
  - Frontend: "Check In Now" button on device detail page
  - Eliminates 15-min patch execution lag
  - Phase 1 (server) specced, Phase 2 (agent), Phase 3 (frontend) designed
  - Spec lives in "Cancel, Catalog, and Nine Fixes" chat (May 19) if needed
- Patch job bulk cancel -- cancel multiple jobs at once. Lower priority now
  that the underlying cancel endpoint correctly handles orphaned jobs and
  the queue has been cleared; revisit if a large backlog forms again.
- Cultivation / policy-based auto-remediation -- Coming Soon page exists
- Pinned Apps on Dashboard -- UI empty state exists (3 ghost slots). Needs:
  preferences table (key/value text columns), pin icon on App Inventory rows,
  per-app mini donut widget showing current/outdated/unknown device counts.
- Graph reports -- patch success rate over time, fleet compliance trend,
  most patched apps, time-to-patch. Meaningful once more history data exists.
- Automated catalog-sync schedule
- CLI (orchardpatch recon, patch, status, connect)
- Homebrew tap
- Patch Policy UX persistence (Patch Policies section exists as informational
  display on app detail page, not persisted as policies -- Cultivation feature)
- Sentry / error monitoring
- DB indexes for fleet queries
- Version string normalization
- softwareupdate CLI research for system app patching
- "Suggest label" UI on Unknown app rows
- Community seed file for top 100 bundle ID -> label mappings
- SSO / proper auth
- orchardpatch.com/enterprise landing page
- mas integration (Mac App Store patching)
- Homebrew integration (extends Software Catalog with Homebrew source)
- AI-assisted patch approval workflows
- Auto-generate policy documentation / MDM deployment playbooks
- History auto-refresh / periodic polling (currently manual Refresh button)
- Server-side device typeahead (current is client-side, fine until fleet scale)
- Light mode / Apple Business aesthetic with glass accents and OrchardPatch
  green -- flagged as post-Orchard polish. Current hybrid (light main content,
  dark sidebar) is a good intermediate state.
- Cultivation page wayfinding -- page explains 5 tiers but doesn't link to
  where each lives. Add "where to find it" links per tier.
- Disabling native app auto-updaters (Microsoft AutoUpdate, Chrome/Edge
  built-in updaters, etc.) once OrchardPatch manages an app, so there's one
  source of truth for update timing instead of two systems independently
  deciding. Future consideration, not urgent. Noted June 12 during
  notification storm investigation -- native auto-updaters were ruled OUT
  as the cause of that issue, but remain a real product consideration.

## Open items / tech debt

### HIGH PRIORITY -- Version checker notification storm (found June 12)
The agent's version-checker runs every ~10 check-ins (~2.5 hrs) across all
44 catalog labels (13 local + 31 fleet-only) using `DEBUG=1 NOTIFY=silent`.
DEBUG correctly prevents actual installation (confirmed: notification-listed
apps like Microsoft Edge are NOT present in /Applications on Jude's machine).
However, Installomator's displaynotification "X installation/update complete!"
message fires anyway for most/all labels, via osascript -> ScriptEditor2,
producing a burst of misleading "installation complete" notifications on
Jude's actual daily-driver machine.

CONFIRMED June 12 via `sudo log show --predicate 'eventMessage CONTAINS
"osascript"' --last 4h --style compact`: a burst of ~26 osascript invocations
from 17:50:30 to 17:53:52 (one every 5-15 seconds), matching the agent.log's
"Check-in #290 -- triggering version check batch" (44 labels, concurrency 5)
exactly in timing and rough count.

This previously had a much milder tech debt entry ("some labels fire
displaynotification unconditionally, defer until post-launch") that
understated the severity -- this fires on essentially every label, every
~2.5 hours, on a real user's machine, with deceptive completion text for
apps that were never touched.

NEXT SESSION SHOULD START HERE, before Phase 3. Diagnostic path:
1. Read version-checker.js's exact Installomator invocation -- the literal
   env vars/flags passed (DEBUG=1 NOTIFY=silent as written vs. as exported
   to the subprocess)
2. Find where Installomator's displaynotification function is called for the
   final "installation/update complete" message, and what condition (if any)
   gates it on NOTIFY
3. Determine whether DEBUG=1 should suppress this notification too, or
   whether NOTIFY=silent needs different handling for this specific call
4. Root-cause fix, redeploy to both machines, verify next version-check
   cycle is silent

### Other open items
- **Patch history sort order:** jobs within day groupings may not be sorted
  by time -- ORIGINAL DIAGNOSIS INCONCLUSIVE (June 12). The filteredJobs sort
  comparator (startedAt descending, with createdAt fallback for null
  startedAt) looked structurally correct on inspection, and the component
  has NO date-grouping UI at all currently (renders flat), so "jobs within
  day groupings" doesn't map to current code. Cannot visually verify because
  the Started column shows relative time ("1mo ago") at too coarse a
  granularity. PARKED until Phase 4 generates fresh patch jobs with varied,
  recent timestamps to actually test against. If still relevant, re-test
  with real data before writing any fix.
- **Cancel button UX:** cancel button is at far right of row, status badge
  is in the middle. Spatial disconnect makes it hard to see the status change.
  Consider inline cancel icon next to status badge, or making status badge
  itself clickable for cancellable jobs. Design pass needed.
- **Canva patch failure:** Installomator exits with code 23 for canva label.
  Installomator version on both machines is v10.9beta (2025-12-23) -- over
  5 months old. Fix: update Installomator via Software Catalog page
  (self-update using 'installomator' label) once Phase 3/4 ship.
- **coconutBattery version string:** Installomator label scrapes
  coconut-flavour.com and gets HTML back instead of a version string.
  version-checker.js now rejects the result and stores null. Underlying
  label issue is an Installomator bug -- save for maintainer outreach.
- **version-checker.js deploy to Jude's machine:** validation fix committed
  and deployed to Chip's machine only. Should be deployable via OrchardPatch
  agent self-update mechanism when built. NOTE: this is now entangled with
  the notification storm investigation above -- whatever fix comes out of
  that should be deployed to both machines together with this existing fix.
  Manual steps if needed urgently:
  cd ~/Projects/orchardpatch-agent && git pull
  sudo cp src/version-checker.js /usr/local/orchardpatch/agent/src/version-checker.js
  sudo launchctl kickstart -k system/com.orchardpatch.agent
- **Initiated By column:** always null until real user accounts exist.
  Wire up when SSO/auth is built.
- **DaVinci Resolve:** may have an Installomator label -- verify and add
  label override if so.
- **GitHub PAT (GITHUB_TOKEN):** renewed May 12, 2026. Still scoped to all
  public repos -- tighten to Installomator repo only at next rotation.
- **agent_url column:** unused, reserved for future server-initiated flows.
- **No DB indexes** on fleet queries yet.
- **Catalog auto-sync** not automated.
- **is_outdated field:** legacy, never set -- ignore.
- **latest_version field on apps table:** legacy -- latest_versions is
  source of truth.
- **firefoxpkg label:** verify patches standard Firefox not ESR.
- **Server-side device typeahead:** current typeahead fetches all devices
  client-side. Needs server-side search at fleet scale (hundreds+ devices).
- **Dashboard --foreground override:** --foreground CSS var is #f0f8ec (light
  cream for dark theme). Dashboard explicitly uses text-gray-900/text-gray-600
  to override. Proper fix is a light/dark mode system -- deferred to light
  mode polish pass.

## Next session priority order
1. Version checker notification storm (HIGH PRIORITY, see tech debt above) --
   diagnose version-checker.js's Installomator invocation + Installomator's
   displaynotification gating logic, fix, deploy to both machines
2. Phase 3: Software Catalog frontend page (/catalog) -- server search is
   fixed and ready, build the page + /api/catalog proxy (non-public token)
3. Phase 4: Installomator self-update via catalog (depends on Phase 3),
   re-test Canva patch afterward
4. Phase 5: Token lockdown (NEXT_PUBLIC_FLEET_SERVER_TOKEN removal)
5. Phase 6: Force check-in Phases 1-2
6. Revisit patch history sort question with fresh data from Phase 4

## Lessons learned (June 12 session)
- The agent's job execution model has NO "in_progress" status -- patch_jobs
  stays "queued" through the entire execution window. Any cancel/status logic
  must account for this; "no pending_patches row" is NOT evidence of "agent
  has it," only completion (terminal status) or never-enqueued (orphaned)
  produce that state.
- When a "fixed" feature appears to misbehave again, verify with real
  evidence (system logs with timestamps) before either dismissing it or
  assuming the worst. Two false starts happened here (first "it's fine,"
  then "it's stale notifications") before the osascript timestamp correlation
  gave a real answer.
- `sudo log show --predicate` against the unified log, filtered by the actual
  mechanism (osascript, in this case) rather than the suspected script name
  (Installomator), was the key diagnostic. The unified log captures far more
  than application-specific log files.
- Two production root-cause fixes (catalog search param, cancel endpoint
  state logic) were both one-line-to-small-function changes once properly
  diagnosed -- the diagnose-first workflow paid off on both.