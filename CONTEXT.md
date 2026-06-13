# OrchardPatch -- Project Context

Last updated: June 12, 2026 (late session)

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
- Installomator does NOT read NOTIFY, DEBUG, or other flags from the
  environment. It sets defaults (e.g. NOTIFY=success) at the top of the
  script, then a "rest of arguments" loop does `eval $1` on any positional
  argument containing "=". Only positional KEY=VALUE arguments override
  defaults -- env vars passed alongside the invocation are silently ignored
  for these. patcher.js has always done this correctly (passes
  NOTIFY=${mode} etc as positional args). version-checker.js did not (fixed
  tonight, see Shipped).

## CRITICAL OPEN ISSUE -- Job completion never links back to its queued row
(found June 12, late session -- TOP PRIORITY for next session)

**The bug:** In the agent's shared poll loop (`pollAndRunPatches` in
scheduler.js), `patch.id` (the server-assigned id, shared between
`pending_patches.id` and `patch_jobs.id` at queue time for branch/bushel/
orchard, and now also fruit as of tonight's fix) is used ONLY for
`claimPatch(patch.id)`. It is never passed into `runPatchJob`.
`runPatchJob` -> `createJob` generates its own independent id:
`job-${Date.now()}-${++jobCounter}`. `reportPatchJob` (in checkin.js) then
POSTs `jobId: job.id` (the `job-...` id) to `POST /patch-jobs`, which does
`INSERT ... ON CONFLICT(id) DO UPDATE`. Since `job-...` never matches the
`patch-.../branch-.../bushel-.../orchard-...` id created at queue time, the
upsert always INSERTs a brand-new, disconnected row instead of updating the
"queued" one.

**Impact (confirmed via DB tonight):**
- All 23 branch/bushel/orchard patch_jobs rows that have ever existed are
  status='cancelled', completed_at=null. None have ever reached
  success/failed. 10 of these were the May 12 ad-hoc-test orphans (no
  pending_patches row ever existed). The other 13 were cancelled while
  still queued/unclaimed (claimed_at NULL), before the agent ever reached
  them -- so this bug never got a chance to manifest for those methods,
  they were caught earlier in the lifecycle.
- All 35 success + 8 failed patch_jobs rows are method='fruit' with
  `job-...` ids, created via the OLD pre-tonight flow where POST /patch
  never created a "queued" row at all -- so the disconnected INSERT was the
  *only* record, and "worked" by coincidence (no conflict, no orphan).
- Tonight's Fruit two-table fix (see Shipped) created the first-ever
  shared-id "queued" row that the agent actually claimed (Ollama test).
  Agent crashed mid-download for an unrelated reason (see Lessons Learned),
  leaving patch_jobs row patch-1781320769990-xj3d6t stuck at status='queued'
  with its pending_patches row stuck at claimed_at=set. Manually cleaned up
  (deleted the pending_patches row, then hit the cancel endpoint which
  correctly took the "never enqueued" path and set status='cancelled').

**Why this is good news, not a disaster:** it's a single fix point (the
shared poll loop), affects all four methods identically, and has never
caused damage before because the precondition (shared-id queued row +
agent actually claims and runs it) never co-occurred until tonight. Caught
before Catalog (Phase 3) would have made every single deploy hit this.

**The fix (next session, in this order):**
1. FIRST, before editing anything: search both the agent (scheduler.js,
   checkin.js, patcher.js) and server (orchardpatch-server) for any
   `DELETE FROM pending_patches` or equivalent endpoint. CONTEXT.md
   previously claimed `POST /patch-jobs` "deletes the pending_patches row"
   on completion, but the actual handler (lines 545-573) does not. Need to
   know if pending_patches cleanup-on-completion exists ANYWHERE, or if
   that's a second half of this same fix (completed jobs would leave stale
   claimed rows behind otherwise -- DB clutter, not re-execution risk,
   since fetchPendingPatches filters on claimed_at IS NULL).
2. Thread `patch.id` through `runPatchJob` so `job.id` (or at minimum
   whatever `reportPatchJob` sends as `jobId`) equals `patch.id`. This
   makes the existing `ON CONFLICT(id) DO UPDATE` in POST /patch-jobs
   correctly transition queued -> success/failed for all methods.
3. Verify end-to-end with a small re-queue. Bitwarden is a good candidate
   (already proven to queue correctly tonight) -- ideally pick something
   already at latest_version so the real Installomator run is a fast
   "already up to date" exit rather than a real download. Confirm: queued
   row appears immediately (already working), agent claims it
   (pending_patches.claimed_at set), agent completes, patch_jobs.status
   transitions to success/failed on the SAME row (not a new one), and
   pending_patches row is cleaned up.

**Blocks Phase 3.** Catalog-deploy reusing POST /patch is safe from a
validation standpoint (confirmed, no inventory checks), but would inherit
this exact orphaning pattern at scale (1,137 labels) if built before this
fix lands. Do not start Phase 3 until this is fixed and verified.

## Two-table write pattern (CRITICAL -- read before building any patch feature)
- pending_patches -- the agent work queue. Agent polls this table every 15 min.
  Every patch operation MUST write here or the agent will never execute it.
- patch_jobs -- the history/audit log. Every patch operation MUST also write
  here for history tracking, AS OF TONIGHT this includes Fruit.
- All four methods (fruit, branch, bushel, orchard) now create both rows
  atomically at queue time, with patch_jobs.id = pending_patches.id,
  status='queued'. Branch/Bushel/Orchard use an explicit transaction
  (BEGIN/COMMIT/ROLLBACK); Fruit's POST /patch was updated tonight to match
  this exact pattern (commit d6f0ed0).
- THE REMAINING GAP is on the completion side, see "CRITICAL OPEN ISSUE"
  above -- the shared id created here is never threaded through to the
  agent's completion report, so the "queued" row never updates.

## Agent job execution model (confirmed June 12, revised late session)
- pollAndRunPatches in scheduler.js:
  1. fetchPendingPatches(deviceId) -- GET /pending-patches?device_id=...
     returns rows from pending_patches where claimed_at IS NULL
  2. claimPatch(patch.id) -- POST /pending-patches/:id/claim -- atomically
     sets claimed_at on pending_patches ONLY. Does NOT touch patch_jobs.status
     and does NOT delete the pending_patches row.
  3. runPatchJob(label, appName, mode, deviceId) -> generates its OWN id via
     createJob (job-<timestamp>-<counter>), completely independent of
     patch.id. Runs Installomator.
  4. waitForJob(job) -- polls job.status in-memory every 2s, 10min timeout
  5. reportPatchJob(job) -- POSTs { jobId: job.id, ... } to POST /patch-jobs.
     Because job.id != patch.id, this INSERTs a new disconnected row instead
     of updating the "queued" row created at transaction time. See CRITICAL
     OPEN ISSUE.
- UNCONFIRMED: whether pending_patches row deletion on completion happens
  anywhere. Needs checking next session as part of the fix above.
- CRITICAL: patch_jobs.status NEVER transitions to "in_progress" or "running"
  by design. It stays "queued" until either (a) cancelled, or (b) [currently
  broken] the agent reports completion against the matching id.
- Cancel logic (rewritten June 12, confirmed working tonight): a patch_jobs
  row with non-terminal status and no corresponding pending_patches row ->
  "never enqueued", cancels directly. A pending_patches row with claimed_at
  set -> 409 "already picked up, not cancellable". A pending_patches row
  with claimed_at NULL (queued, not yet claimed) -> cancels correctly,
  deletes the pending_patches row, sets patch_jobs.status='cancelled'.
  Confirmed tonight via live Bitwarden test (queue -> immediate "Queued" in
  UI -> cancel -> patch_jobs.status='cancelled', pending_patches row gone).

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
- Catalog: /catalog page, deploy any label to any device (BLOCKED, see
  CRITICAL OPEN ISSUE)
- Cultivation: /orchard page, Coming Soon

## Frontend routing structure
- / -- redirects to /dashboard
- /dashboard -- Fleet Dashboard (homepage)
- /apps -- App Inventory (was at / before May 12 session)
- /apps/[id] -- App detail page
- /catalog -- Software Catalog (BLOCKED, see CRITICAL OPEN ISSUE -- server
  side ready, frontend not started)
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
  - SSH push auth fixed permanently June 12 (see prior notes, still valid)
  - Works for all orchardpatch repos -- no per-repo deploy keys needed
  - Next PAT rotation: tighten GITHUB_TOKEN scope to Installomator repo only
- Chip's git identity: user.name=Chip, user.email=chip@openclaw
- orchardpatch-server has local override: Jude Glenn / judeglenn@example.com
- File ownership on Chip's machine: run `sudo chown -R chip:staff ~/Projects`
  if root-ownership recurs. Standing rule: never sudo git.
- Edit tool fails on JS/TS files containing template literals (backticks).
  Use Python file replacement for any substantial JS/TS edits on Chip's machine.
- CRITICAL: when using Python to write JS/TS files, avoid JS template literals
  with dollar signs (${}). Use plain string concatenation or var assignments.
- Always run `npm run build` locally before pushing any new page or component
  (frontend repo only -- agent/server are plain Node, no build step, but
  run `node --check <file>` to confirm syntax after edits).
- Context is lost when Chip compacts -- use this file to restore
- Start Claude.ai sessions by opening OrchardPatch project (CONTEXT.md loaded)
- End every session: ask Claude.ai to update CONTEXT.md, paste to Chip, commit
- Standing rule: always fix bugs at root cause. Never suggest manual
  workarounds. If a workaround is needed to unblock testing, flag it
  explicitly as tech debt before moving on.
- Standing rule: all fixes and updates should be resolvable through
  OrchardPatch itself. Don't suggest manual CLI commands on machines when
  OrchardPatch should handle it.
- Standing rule (NEW): avoid follow-mode / non-terminating commands
  (`tail -f`, `--follow`) in Chip prompts -- they block Chip's tool-call loop
  until timeout. Use bounded forms (`tail -n 50`, fixed-duration checks).
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
- Installomator version: v10.9beta (2025-12-23) on both machines -- outdated,
  should be updated via catalog deploy once Phase 3/4 ship (BLOCKED)
- Agent on Chip's machine confirmed stable as of tonight: PID 41881, running
  as root, bound to 127.0.0.1:47652, clean log (inventory collected, poller
  started, checked in successfully). See Lessons Learned for the restart
  confusion that preceded this.
- Known outdated apps on device-C02D52QTML85 as of tonight: Ollama
  (0.24.0 -> 0.30.8, ~900MB, large download), Slack (4.49.89 -> 4.50.128,
  in active use, avoid as test target), Telegram MAS (12.7 -> 12.8) and
  Telegram Desktop (6.7.6 -> 12.8) -- see Open Items re: label mismatch.

## DB schema (key tables)
- devices: id, hostname, device_id, last_seen, agent_version, agent_url (nullable)
- apps: id, device_id, bundle_id, name, version, latest_version (legacy/null),
  is_outdated (legacy/always 0 -- do not use), installomator_label, path, source
  source values: 'user' (third-party, patchable), 'system' (Apple-managed, N/A)
- latest_versions: label (PK), latest_version, last_checked, error
- app_catalog: label (PK), app_name, bundle_id, expected_team, last_synced
  NOTE: bundle_id is null for effectively all rows -- 1,137 rows with real
  app_name/expected_team data as of June 12.
- patch_jobs: id, device_id, app_name, label, mode, method, status, created_at,
  started_at, completed_at, exit_code, error, log
  method values: 'fruit', 'branch', 'bushel', 'orchard'
  mode values: 'silent', 'managed', 'prompted'
  status values: 'queued', 'success', 'failed', 'cancelled'
  ('running'/'in_progress' do NOT occur by design)
  initiated_by: nullable, always null until real auth exists
  AS OF TONIGHT: all four methods create this row at queue time with
  status='queued'. THE COMPLETION SIDE IS BROKEN for all methods, see
  CRITICAL OPEN ISSUE. Current real DB state (as of ~9pm June 12): 35
  success + 8 failed (all method='fruit', all from the old pre-fix flow,
  disconnected job-... ids) + ~25 cancelled (10 from May 12 orphans, 13
  branch/bushel/orchard cancelled-while-queued, 1 Bitwarden from tonight's
  test, 1 Ollama orphan from tonight's test) + 0 queued.
- pending_patches: agent work queue -- agent polls this every 15 min.
  Rows have a claimed_at column (set by claimPatch, never null once the
  agent has picked up the job). id matches patch_jobs.id for ALL methods
  as of tonight (paired in dual-write). UNCONFIRMED whether anything
  deletes this row on successful completion -- check next session.
- preferences: key (PK), value (text) -- single-tenant user preferences store.
  Not yet created. Needed for Pinned Apps persistence on Dashboard.

## Key API endpoints
- POST /checkin -- agent check-in, inventory push (now includes installomator_label)
- GET /devices -- fleet list with outdated_count (latest_versions join)
- GET /apps -- raw app rows (do not use for status -- use /apps/status)
- GET /apps/status?device_id= -- patch status per app with cache_age_seconds
  patch_status values: 'outdated', 'current', 'unknown', 'na'
- GET /stats -- fleet stats
- POST /patch -- queue a Fruit patch job. AS OF TONIGHT (commit d6f0ed0):
  wraps both inserts in a transaction (BEGIN/COMMIT/ROLLBACK), inserts into
  patch_jobs first (status='queued', method='fruit'), then pending_patches,
  using the same generated id for both. No inventory/label validation --
  accepts any label/appName, which is required for Catalog deploy to work.
  Required body fields: deviceId, label, appName. Optional: bundleId, mode
  (defaults 'managed'). Response: { ok, id, deviceId, label, appName,
  createdAt } -- note field is `id` not `jobId` (frontend reads
  `data.jobId` in handleConfirmPatch, always undefined, but this feeds
  activeJobId which is dead code / never read, zero current impact).
- POST /patch-jobs/branch -- queue a Branch patch job (writes to both tables,
  transactional, validates device exists + labels genuinely outdated via
  apps/latest_versions join before inserting)
- POST /patch-jobs/bushel -- queue a Bushel patch job (same pattern)
- POST /patch-jobs/orchard -- queue an Orchard patch job (same pattern)
- POST /patch-jobs -- the AGENT's completion-report endpoint. Upserts into
  patch_jobs via ON CONFLICT(id) DO UPDATE (status, exit_code, error, log,
  completed_at). method is hardcoded to "fruit" regardless of caller --
  this is fine in isolation but is irrelevant until the id-threading fix
  lands, since the upsert currently never matches an existing row (see
  CRITICAL OPEN ISSUE). Required: jobId, appName.
- POST /patch-jobs/:id/cancel -- cancel a pending patch job. Confirmed
  working correctly tonight for the "queued, not yet claimed" case (deletes
  pending_patches row, sets patch_jobs.status='cancelled') and the "never
  enqueued" case (orphans, sets status='cancelled' directly). The
  "claimed_at set" case still returns 409, untested whether this is
  reachable in practice given the completion-reporting bug (a job that's
  claimed and actually completes never updates its queued row, so a 409
  here would currently mean "claimed, agent crashed or still running" --
  same ambiguity as before).
- GET /patch-jobs -- list jobs, supports ?device_id, ?method, ?mode, ?status filters
- POST /api/version-sync/ingest -- ingest version data
- GET /api/version-sync and /api/version-sync/:label -- cache lookups
- POST /api/catalog-sync -- sync Installomator catalog from GitHub
- GET /api/catalog -- browse catalog, ?search= (fixed June 12, confirmed
  working: pagination, 1,137 total, no row cap)

## Next.js proxy routes (frontend)
- /api/patch -- forwards to POST /patch (bundleId, label, appName, mode, deviceId)
- /api/patch-jobs/bushel
- /api/patch-jobs/orchard
- /api/patch-jobs/[id]/cancel
- /api/stats
- /api/devices
- /api/apps/status
- /api/catalog -- NOT YET BUILT (Phase 3, blocked, see CRITICAL OPEN ISSUE)

## Feature status

### Shipped (tonight, June 12 late session)
- **Version checker notification storm -- FIXED.** Root cause: Installomator
  ignores NOTIFY/DEBUG as env vars, only reads positional KEY=VALUE args
  (eval $1 loop). version-checker.js was passing `DEBUG=1 NOTIFY=silent` as
  a shell env-var prefix, which Installomator silently ignored, defaulting
  to NOTIFY=success and firing "X installation/update complete!" via
  osascript for every label where updateDetected=YES. Fixed: NOTIFY=silent
  now passed as a positional arg (`"$path" "$label" NOTIFY=silent`), DEBUG=1
  left in env (confirmed that part was already working). Committed 85e1b82,
  deployed to Chip's machine, verified via manual single-label test (firefox):
  zero osascript invocations, appNewVersion still parsed correctly. STILL
  PENDING: deploy to Jude's machine, bundled with the existing pending
  version-string-validation fix (HTML/malformed version rejection, committed
  previously, only on Chip's machine). Background full-cycle confirmation
  (next natural version-check batch, ~2.5hrs from tonight's agent restart)
  not yet observed.
- **Patch History StatusBadge bug -- FIXED.** 24 cancelled jobs were
  displaying as grey "Queued" due to an implicit fallthrough default.
  Rewrote with explicit cases for all real status values (success, failed,
  running, queued, cancelled) plus a loud "Unknown: {status}" fallback for
  anything unrecognized (defensive against future unhandled statuses).
  Added "Cancelled" option to status filter dropdown. Committed e8d53e5,
  pushed to main, Vercel auto-deployed.
- **Fruit two-table write -- FIXED.** POST /patch now creates the patch_jobs
  "queued" row at insert time (transactional, shared id with pending_patches),
  matching the pattern Branch/Bushel/Orchard already used correctly at queue
  time. Committed d6f0ed0, deployed to Railway, confirmed healthy
  post-deploy. Verified live: Bitwarden Fruit patch -> immediately visible
  as "Queued" in Patch History (previously invisible until agent completion)
  -> cancel button worked -> patch_jobs.status='cancelled',
  pending_patches row removed, confirmed via DB query.
- GET /api/catalog search fix (carried over from earlier tonight, see prior
  session notes) -- confirmed working, Software Catalog frontend (Phase 3)
  is server-ready but BLOCKED on the CRITICAL OPEN ISSUE above.
- All previously-shipped features (inventory, fleet view, Fruit/Branch/
  Bushel/Orchard queueing, Patch History, auth wall, etc.) remain shipped
  as before -- see prior CONTEXT.md revisions for full list. The completion-
  reporting bug does not affect queueing or visibility of the "queued"
  state, only the transition away from it.

### Known genuine unknowns (Jude's device)
- ASUS Device Discovery
- Avidemux
- BlueBubbles
- DaVinci Resolve (check -- Installomator may have a label for this)
- DisplayLinkUserAgent (x2 -- driver component, not a patchable app)
- Google Docs, Sheets, Slides (browser shortcuts, not real binaries)

### Known label-matching issues
- coconutBattery: label scrapes coconut-flavour.com, gets HTML back instead
  of version string. version-checker.js rejects and stores null. Underlying
  Installomator bug, save for maintainer outreach.
- DaVinci Resolve: may have a label, verify and add override if so.
- firefoxpkg: verify patches standard Firefox not ESR.
- NEW (found tonight): "Telegram (Mac App Store)" and "Telegram Desktop" are
  both mapped to label `telegram`, but have completely different versioning
  schemes (12.7/12.8 for MAS vs 6.7.6 for Desktop, compared against the same
  "latest 12.8"). Likely a label-matching mismatch, same class as the above.
  Not yet investigated further.

### In progress / Blocked
- **Software Catalog page (/catalog) -- BLOCKED on CRITICAL OPEN ISSUE.**
  Server-side ready (search fixed, pagination/count confirmed). Frontend not
  started. Do not start until job-completion id-threading fix is verified,
  see priority order below. When unblocked, design unchanged from prior
  session: searchable table of 1,137 labels, source badges ("Installomator"
  per row, don't hardcode in logic), deploy modal (device selector + mode
  picker), reuses POST /patch (confirmed safe re: validation tonight).
  New consideration added tonight: a "Force reinstall" option (uninstall
  then install, via Installomator's UNINSTALL=1 positional arg, same
  mechanism as NOTIFY) for apps whose own self-updater is stuck/unreliable
  -- ties into the existing "disabling native auto-updaters" roadmap item.
- Force check-in -- designed, not yet built (Phase 6). Note added tonight:
  once force check-in shrinks the agent pickup window from ~15min to ~60sec,
  revisit whether a deliberate grace-period delay is needed to preserve a
  meaningful cancel window (currently the ~15min poll gap provides this for
  free).

### Partially built
- Jamf API integration -- proxy exists, real Jamf trial access pending
- Multi-tenancy / org isolation -- single-tenant only

### Not yet built (additions tonight in bold)
- Force check-in / immediate agent poll (Phase 6, designed, see above)
- **"Clear by status" bulk action in Patch History** -- e.g. "Clear all
  Cancelled" / "Clear all Failed", scoped delete with confirmation. Directly
  motivated by tonight's manual cleanups (one-off SQL + cancel-endpoint
  combo for orphaned rows). Probably needs to be a soft-delete or at minimum
  a confirmation step since patch_jobs is also the audit history.
- Cultivation / policy-based auto-remediation -- Coming Soon page exists.
  NOTE: given tonight's finding that job-completion tracking has never
  worked end-to-end for ANY method, Cultivation's design (which presumably
  depends on knowing whether a policy-driven patch succeeded) should be
  revisited AFTER the completion-reporting fix lands and is verified, not
  before.
- Pinned Apps on Dashboard -- UI empty state exists, needs preferences table
- Graph reports -- patch success rate over time, etc. -- meaningful only
  once the completion-reporting fix lands (currently no jobs ever reach
  success/failed via the correct linked path)
- Automated catalog-sync schedule
- CLI (orchardpatch recon, patch, status, connect)
- Homebrew tap
- Patch Policy UX persistence (Cultivation feature)
- Sentry / error monitoring
- DB indexes for fleet queries
- Version string normalization
- softwareupdate CLI research for system app patching
- "Suggest label" UI on Unknown app rows
- Community seed file for top 100 bundle ID -> label mappings
- SSO / proper auth
- orchardpatch.com/enterprise landing page
- mas integration (Mac App Store patching)
- Homebrew integration
- AI-assisted patch approval workflows
- Auto-generate policy documentation / MDM deployment playbooks
- History auto-refresh / periodic polling (currently manual Refresh button)
- Server-side device typeahead
- Light mode / Apple Business aesthetic
- Cultivation page wayfinding (link each tier to where it lives in the UI)
- Disabling native app auto-updaters once OrchardPatch manages an app --
  reinforced tonight by the Ollama "reopen to update" anecdote (native
  updater silently failed; OrchardPatch's forced reinstall would be the
  recovery path)

## Open items / tech debt

### TOP PRIORITY -- see "CRITICAL OPEN ISSUE" section above
Job-completion id-threading fix. Blocks Phase 3 and meaningfully affects
Cultivation design. Well-scoped, single fix point, affects all methods.

### Other open items
- **version-checker.js deploy to Jude's machine:** TWO fixes now pending for
  this file (notification-storm fix from tonight + the earlier HTML/
  malformed-version-string validation fix), both only on Chip's machine.
  Bundle and deploy together.
- **Initiated By column:** always null until real user accounts exist.
- **GitHub PAT (GITHUB_TOKEN):** renewed May 12, 2026, scoped to all public
  repos -- tighten to Installomator repo only at next rotation.
- **agent_url column:** unused, reserved for future server-initiated flows.
- **No DB indexes** on fleet queries yet.
- **Catalog auto-sync** not automated.
- **is_outdated field / legacy latest_version on apps table:** ignore, see
  Version comparison philosophy.
- **Server-side device typeahead:** needs server-side search at fleet scale.
- **Dashboard --foreground override:** deferred to light mode polish pass.
- **Telegram label mismatch:** see Known label-matching issues above.
- **launchctl status can be misleading:** tonight, `launchctl list` showed
  exit code -15 (SIGTERM) and runs=3 for the agent, which looked like a
  crash loop, but `ps aux` confirmed a single healthy PID was actually
  running. The -15/runs count reflects the PREVIOUS run's exit, not current
  state. Multiple overlapping `kickstart -k` calls during testing caused
  EADDRINUSE collisions that added to the confusion. Agent itself was fine
  throughout. Don't over-trust `launchctl list` in isolation, confirm with
  `ps aux` for the actual current PID.
- **"Claimed but abandoned" jobs have no recovery path:** if the agent
  claims a pending_patches row (sets claimed_at) and then crashes/restarts
  before completing, that row is permanently stuck -- not re-fetchable
  (claimed_at is set), not cancellable (409 on claimed jobs). Tonight's
  Ollama orphan was manually cleaned up (delete pending_patches row, then
  cancel endpoint). This is a real robustness gap, likely a Phase 6 (Force
  check-in) design consideration -- e.g. a staleness timeout on claimed_at.

## Next session priority order
1. **TOP PRIORITY: Job-completion id-threading fix.** First, search for any
   existing pending_patches deletion-on-completion mechanism (agent or
   server) -- if none exists, that's part of this fix too. Then thread
   patch.id through pollAndRunPatches -> runPatchJob -> reportPatchJob for
   all methods. Verify end-to-end with a small re-queue (Bitwarden or
   similar, ideally something already at latest_version for a fast no-op
   run): confirm queued -> success/failed transitions on the SAME row, and
   pending_patches is cleaned up.
2. Once #1 is verified: Phase 3, Software Catalog frontend page (/catalog).
   Server-side ready. Include the "Force reinstall" (uninstall+install)
   option in the deploy modal design.
3. Phase 4: Installomator self-update via catalog on both machines, re-test
   Canva (exit code 23, stale Installomator v10.9beta).
4. Phase 5: Token lockdown (remove NEXT_PUBLIC_FLEET_SERVER_TOKEN).
5. Phase 6: Force check-in. Revisit the cancellation-window question here
   (deliberate grace period vs relying on poll interval).
6. Jude's machine: bundle-deploy version-checker.js fixes (notification
   storm + validation), and any agent-side changes from #1, in one pass.
7. Patch History "Clear by status" bulk action -- low priority, nice-to-have,
   whenever there's a natural frontend batching opportunity.

## Lessons learned (June 12 late session)
- The single most valuable pattern tonight, again: verify documented
  architecture against actual code before building on it. CONTEXT.md's
  claims about Fruit's two-table write and about POST /patch-jobs deleting
  pending_patches were both wrong (or at least unverified), discovered only
  by reading the real handlers and tracing a live test through the DB.
- "End-to-end verified" in prior session notes likely meant "the app
  actually updated on disk," checked manually -- not "the DB record
  completed correctly." These are different claims; the second one has
  apparently never been true for any method.
- A bug can exist in shared code for a long time without symptoms if the
  precondition for triggering it never occurs. Branch/Bushel/Orchard's
  queued rows were always cancelled before the agent claimed them, so the
  id-mismatch bug never fired. Tonight's Fruit fix was the first time the
  precondition was met.
- `launchctl list`'s exit-code/runs fields reflect history, not current
  state -- always confirm with `ps aux` for the actual running PID before
  concluding a daemon is down.
- Avoid follow-mode commands (`tail -f`) in Chip prompts -- they block the
  tool-call loop with no natural exit.