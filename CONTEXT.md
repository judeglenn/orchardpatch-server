# OrchardPatch -- Project Context

Last updated: June 16, 2026 (evening)

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
  - Deployed: https://app.orchardpatch.com (primary)
              https://orchardpatch.vercel.app (alias, still active)
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
- SERVER_TOKEN -- auth token for all API endpoints (rotated June 13, 2026)
- GITHUB_TOKEN -- fine-grained PAT for catalog-sync GitHub API calls
- PORT -- set by Railway
- DATA_DIR -- data directory

## Vercel environment variables (frontend)
- LOGIN_PASSWORD -- passphrase users enter to access the app
- SESSION_SECRET -- static random string stored in session cookie, validated
  by middleware
- FLEET_SERVER_URL -- Railway fleet server URL (non-public, server-side only)
- FLEET_SERVER_TOKEN -- token for proxy-to-fleet-server calls (non-public,
  server-side only, saved as sensitive in Vercel -- cannot be read back from UI)
  NOTE: Phase 5 complete as of June 16. NEXT_PUBLIC_ vars removed. Token
  confirmed absent from browser bundle. All fleet calls go through proxy layer.
  Token rotation note: save new token value in password manager before rotating
  -- Vercel sensitive vars cannot be retrieved after saving.

## Agent environment variables
- SERVER_URL -- fleet server URL
- SERVER_TOKEN -- matches fleet server
- VERSION_CHECK_INTERVAL -- check-ins between version runs (default: 10)
  NOTE: INSTALLOMATOR_PATH is NOT an env var -- agent discovers Installomator
  by checking a path list in order. See Installomator path section below.
  NOTE: VERSION_CHECK_INTERVAL=1 (temporary test setting on Chip's machine)
  was removed June 16 evening, agent reloaded, default 2.5hr cycle restored.
  IMPORTANT: launchctl kickstart -k does NOT re-read plist EnvironmentVariables.
  Changing an env var in the plist requires a full unload/reload
  (bootout/bootstrap), not kickstart.

## Installomator path and version
- Canonical pkg-managed path: /usr/local/Installomator/Installomator.sh
  This is where the Installomator pkg (deployed via catalog) installs.
- Legacy manual path: /usr/local/bin/Installomator.sh (do not rely on this)
- patcher.js INSTALLOMATOR_PATHS order (commit 8ad966f): pkg path first,
  /usr/local/bin/ second. This means catalog-managed updates take precedence.
- version-checker.js already had correct order before June 16.
- Current version on both machines: v10.8 (2025-03-28) -- stable release.
  Installed via catalog deploy June 16, replacing v10.9beta.
- The Installomator label in Installomator itself points to v10.8 pkg.
  v10.9beta (main branch) is what catalog sync pulls fragment data from.
  v10.8 (release branch) is the stable installed binary.
- OrchardPatch postinstall script installs Installomator to /usr/local/bin/
  which conflicts with pkg convention. Tech debt -- see open items.

## Architecture decisions
- Agent to server: REST polling only, no WebSocket
- Server cannot reach agents directly (Railway to NAT'd agent doesn't work)
- Version data is agent-initiated push, not server-pull
- Agent polls every 15 min; version checks run every 10 check-ins (~2.5 hrs)
- Patching via Installomator only -- no MDM conflicts, no Secure Token needed
- Post-patch: agent immediately ingests confirmed version to latest_versions,
  then triggers inventory check-in -- no staleness window after patching
- Vercel deploys automatically via GitHub integration on push to main
- Auth wall: Next.js middleware with two-env-var design (LOGIN_PASSWORD +
  SESSION_SECRET). Placeholder until multi-tenancy is built. Real auth
  (SSO, 2FA, user management) lives in Settings > Security when built.
- Installomator does NOT read NOTIFY, DEBUG, or other flags from the
  environment. It sets defaults at the top of the script, then a "rest of
  arguments" loop does eval $1 on any positional argument containing "=".
  Only positional KEY=VALUE arguments override defaults. patcher.js passes
  NOTIFY=${mode} etc as positional args (correct). NOTE: DEBUG=1 as a
  positional arg is read correctly, but DEBUG=1 only skips the INSTALL step,
  NOT the download. It does not give a download-free version check. See the
  version-checker.js section for the actual version-check approach.
- Agent token is stored in /etc/orchardpatch/config.json on each managed
  machine. Token rotation requires manual config edit + agent restart on
  every managed machine. This is a product gap -- needs a feature before
  real users are onboarded.
- All fleet server calls from the frontend go through Next.js proxy routes.
  No direct browser-to-fleet-server calls exist as of June 16 (Phase 5).
  FLEET_SERVER_URL and FLEET_SERVER_TOKEN are server-side only env vars.
- Exit code 23 from Installomator means "App previously installed from App
  Store -- Installomator respects the MAS installation and will not overwrite."
  This is correct behavior. MAS apps cannot be patched via Installomator.
  Bitwarden and Canva are MAS installs on Jude's machine.

## version-checker.js architecture (rewritten June 16 evening)
- CRITICAL CORRECTION: DEBUG=1 does NOT skip downloads. It only skips the
  install step. Installomator still downloads the full artifact in DEBUG mode.
  The earlier belief that DEBUG=1 = dry-run-no-download was wrong. That belief
  drove the spawnSync work (commit b873040), which did not fix the timeouts
  because the downloads were still happening.
- Why large labels timed out: they were genuinely downloading the artifact
  (Slack ~150MB, Office, Dropbox, etc.) and hitting the timeout before
  appNewVersion was ever logged. Chrome-class labels worked because their
  label fetches the version from an API (e.g. versionhistory.googleapis.com)
  BEFORE any download.
- ACTUAL FIX (commits 741add4, e071940): async spawn (not spawnSync), stream
  stdout line by line, and kill the Installomator process the moment
  appNewVersion= appears, before the download starts. 12s hard timeout as a
  backstop. Captured value is validated against a version-shaped guard
  (^\d+\.\d); non-matching captures (dates, HTML, stray strings) reject to null.
- This works for labels that compute appNewVersion before the download step
  (the majority). Labels that only know their version after downloading the
  artifact cannot be resolved this way and stay null by construction.
- STATUS: 33/45 labels populated in latest_versions. Confirmed working on
  Chip's machine (device-C02D52QTML85). Jude's machine (device-GJM7N0XGL0)
  still runs the prior version-checker -- redeploy of 741add4/e071940 pending,
  LOW urgency now that ingest is null-safe (see below).
- GITHUB_TOKEN still relevant: GitHub-API-backed labels are rate-limited to
  60/hr unauthenticated, causing intermittent failures. Adding GITHUB_TOKEN
  (passed as positional arg) lifts this to 5000/hr. Still queued.
- STRATEGIC NOTE: running Installomator per-agent to get the latest version is
  the wrong shape. Latest-version resolution is global, not per-device, and
  belongs on the server. The early-kill scrape is a flagged stopgap. A
  server-side, source-pluggable resolver is queued as an Architectural Deep
  Dive (problem statement written, parked behind Phase 6).

## Two-table write pattern (complete as of June 13)
- pending_patches -- the agent work queue. Agent polls this table every 15
  min. Every patch operation MUST write here or the agent will never execute.
- patch_jobs -- the history/audit log. Every patch operation MUST also write
  here for history tracking.
- All four methods (fruit, branch, bushel, orchard) create both rows
  atomically at queue time, with patch_jobs.id = pending_patches.id,
  status='queued'.
- COMPLETION SIDE: fixed June 13. patch.id threads through pollAndRunPatches
  -> runPatchJob -> createJob -> reportPatchJob. The ON CONFLICT(id) DO
  UPDATE in POST /patch-jobs now correctly transitions queued -> success/
  failed on the same row. pending_patches row deleted server-side in the
  same transaction on terminal status. started_at now populated.

## Agent job execution model (confirmed working June 13)
- pollAndRunPatches in scheduler.js:
  1. fetchPendingPatches(deviceId) -- GET /pending-patches?device_id=...
     returns rows from pending_patches where claimed_at IS NULL
  2. claimPatch(patch.id) -- POST /pending-patches/:id/claim -- atomically
     sets claimed_at on pending_patches only
  3. runPatchJob(label, appName, mode, deviceId, patch.id) -- now receives
     the server-assigned id as fifth argument. createJob uses patchId when
     present: const id = patchId || ('job-' + Date.now() + '-' + (++jobCounter));
  4. waitForJob(job) -- polls job.status in-memory every 2s, 10min timeout
  5. reportPatchJob(job) -- POSTs { jobId: job.id, ... } to POST /patch-jobs.
     job.id now equals patch.id, so ON CONFLICT matches the queued row.
- Two report paths exist and both are idempotent:
  - reportJobToServer() in patcher.js fires from proc.on("close") and
    proc.on("error") in _executePatch()
  - reportPatchJob() in checkin.js fires from scheduler after waitForJob
  Both post to POST /patch-jobs with job.id. Upsert is idempotent. DELETE
  pending_patches is a no-op if already deleted by the first report.
- pending_patches row is deleted server-side in POST /patch-jobs on terminal
  status, in the same transaction as the upsert. Confirmed June 13.
- UNRESOLVED: "claimed but abandoned" gap -- if agent crashes mid-run after
  claiming a pending_patches row, that row is permanently stuck (not re-
  fetchable since claimed_at is set, not cancellable -- 409). Phase 6
  design should include a claimed_at staleness timeout to self-heal.
- patch_jobs.status NEVER transitions to "in_progress" or "running" by
  design. Stays "queued" until cancelled or completion reported.
- Cancel logic (confirmed working June 12): non-terminal status + no
  pending_patches row -> "never enqueued", cancels directly. claimed_at set
  -> 409 "already picked up". claimed_at NULL -> cancels, deletes
  pending_patches, sets status='cancelled'.

## Version comparison philosophy
"Latest version" in OrchardPatch = latest version Installomator knows how
to install, not manufacturer's current release. This ensures outdated always
means "patchable right now." Occasional 1-2 day lag between vendor release
and Installomator catching up is by design.
NOTE: the queued version-resolver redesign (server-side, multi-source) puts
this invariant under tension -- sources like Homebrew/Sparkle/vendor APIs give
the manufacturer's current release, which can be AHEAD of what the
Installomator label installs. Reconciling "latest that exists" vs "latest
Installomator can deliver" is the central decision in that Deep Dive.

## System app classification philosophy
"System" = any app signed by Apple (com.apple.* bundle ID) or resident
under /System/. Not patchable via Installomator, tracked separately from
Unknown. Unknown means "third-party app with no Installomator label yet."

## MAS app classification
Apps installed from the Mac App Store have a _MASReceipt directory inside
their .app bundle. Installomator exits 23 on these -- correct behavior,
not a bug. MAS apps cannot be patched via Installomator regardless of version.
Check: ls /Applications/AppName.app/Contents/_MASReceipt/
Known MAS installs on Jude's machine: Bitwarden, Canva (and likely others).
UI gap: Patch button currently shows for MAS apps and fails with exit 23.
Fix needed: detect _MASReceipt at inventory time, set source='mas', hide
Patch button, show "Managed by App Store" instead. Requires mas CLI for
actual MAS patching (not yet built).

## Label matching philosophy
Bundle ID matching from fragments is not viable -- bundleID is effectively
absent from the Installomator fragment corpus. Label assignment priority:
1. Label overrides (hand-curated, /etc/orchardpatch/label-overrides.json)
2. Agent local catalog match by bundle ID (sparse but exact where it exists)
3. Agent local catalog match by normalized name (primary path for most apps)
4. null -- app stays Unknown
Unknown means genuinely unpatchable via Installomator, not a bug.

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
- Bushel: app detail page, "Patch All Outdated" button
- Orchard: Fleet Dashboard (/dashboard), "Patch All Outdated" card
- Catalog: /catalog page (SHIPPED June 13)
- Cultivation: /orchard page, Coming Soon

## Frontend routing structure
- / -- redirects to /dashboard
- /dashboard -- Fleet Dashboard (homepage)
- /apps -- App Inventory
- /apps/[id] -- App detail page
- /catalog -- Software Catalog (SHIPPED June 13)
- /devices -- Device list
- /devices/[id] -- Device detail page
- /patch-history (also /patches in deployed frontend) -- Patch History
- /orchard -- Cultivation Coming Soon page

## Patch mode values (standardized)
- silent -- force quit, no prompts. NOTIFY=silent, BLOCKING=kill
- managed -- notifies user to quit. NOTIFY=success, BLOCKING=tell_user
- prompted -- user chooses when. NOTIFY=all, BLOCKING=prompt_user
Note: 'prompted' is the production value -- do not use 'prompt_user'.
If app is already closed, Installomator installs silently regardless of mode.
Orchard modal defaults to 'silent'. Branch and Bushel default to managed.
Catalog deploy modal defaults to silent.

## Pricing tiers
- Free: Visibility only -- inventory dashboard
- Standard: Patch by the Fruit -- individual device/app patching
- Pro: Patch by the Bushel and Branch -- fleet patching
- Enterprise: Cultivation -- policy-based auto-remediation
Note: pricing model is conceptual, not yet enforced in product.

## Installomator maintainer outreach strategy
Planned, not yet executed. Gates: demo video, waitlist live, polished repo.

Approach: contribution-first, not announcement.
- Prominent attribution in UI and orchardpatch.com before reaching out --
  "Powered by Installomator" must already be there, not promised as future
- File real bug reports via GitHub (coconutBattery HTML response is a
  confirmed find, good opener for the relationship)
- Consider GitHub Sponsors if available
- Ask what roadmap items OrchardPatch's 2-device fleet could help test

Key framing: OrchardPatch is a UI layer that makes Installomator accessible
to orgs that would never run it from the command line. Not a competitor -- a
distribution channel that grows Installomator's reach and user base.

Future complexity: when Homebrew is added as a source, the relationship
context changes. Be upfront with maintainers early rather than surprising
them. Homebrew support should be org-level opt-in (security policy,
provenance concerns vary by org). Same applies to mas. The SourceBadge
component in /catalog is already extensible -- "Installomator" is a label,
not hardcoded in logic. Future sources slot in naturally.

## AI development workflow
- Primary dev assistant: Chip (OpenClaw, Claude API, has own MacBook Pro)
- Architecture / planning: Claude.ai (this project)
- Chip pushes via SSH (account-level SSH key "Chip (OpenClaw)" on GitHub)
  - Key lives at ~/.ssh/id_ed25519 on Chip's machine (user: chip)
  - Works for all orchardpatch repos -- no per-repo deploy keys needed
- Chip's git identity: user.name=Chip, user.email=chip@openclaw
- orchardpatch-server has local override: Jude Glenn / judeglenn@example.com
- File ownership on Chip's machine: run `sudo chown -R chip:staff ~/Projects`
  if root-ownership recurs. Standing rule: never sudo git.
- Edit tool fails on JS/TS files containing template literals (backticks).
  Use Python file replacement for any substantial JS/TS edits on Chip's
  machine.
- CRITICAL: when using Python to write JS/TS files, avoid JS template
  literals with dollar signs (${}). Use plain string concatenation.
  FURTHER (June 16): Python heredocs also mangle regex/SQL escape sequences
  (e.g. \n becomes a literal newline, crashing the file). For edits
  containing regex, SQL strings, or any escapes, use the direct file-edit
  tool, NOT Python.
- Context is lost when Chip compacts -- use this file to restore.
- Start Claude.ai sessions by opening OrchardPatch project (CONTEXT.md loaded)
- End every session: update CONTEXT.md, paste to Chip, commit. Also produce
  session handoff file for next session.
- Standing rule: always fix bugs at root cause. Never suggest workarounds.
  If a workaround is needed to unblock testing, flag it explicitly as tech
  debt before moving on.
- Standing rule: don't polish a mechanism you've already decided to replace
  (June 16 -- left the 6 false-match version labels as safe nulls rather than
  hand-fixing them, because the resolver redesign supersedes the scrape).
- Standing rule: all fixes should be resolvable through OrchardPatch itself.
  Don't suggest manual CLI commands on machines when OrchardPatch should
  handle it.
- Standing rule: avoid follow-mode / non-terminating commands (tail -f,
  --follow) in Chip prompts -- they block Chip's tool-call loop until
  timeout. Use bounded forms (tail -n 50, fixed-duration checks).
- Chip prompts go in code blocks so Jude can copy them directly.
- Claude.ai is better for: architecture decisions, code scaffolding,
  debugging topology/design issues, cross-repo reasoning, spec writing.
- Chip is better for: codebase-aware implementation, exact file locations,
  running commands, hot-deploying to installed agent.
- Use Opus for: complex ambiguous architecture decisions, multi-tenancy
  design, Cultivation policy engine, version-resolver redesign, YC
  application writing, decisions with multi-week downstream consequences.

## Three-channel chat architecture (OrchardPatch project)
1. "Architectural Deep Dives" -- Opus. Cross-repo architecture, multi-
   tenancy, Cultivation policy engine, version-resolver redesign, YC
   application, force check-in cancel-window design, multi-week-consequence
   decisions.
2. "Troubleshooting" -- Sonnet. Isolated bug fixes needing focused attention.
3. Daily implementation chat -- Sonnet. Ongoing dev work.

## Go-to-market
- Target: MacAdmins Slack (70k+ members), Jamf Nation, PSU MacAdmins
- Distribution: bottom-up adoption, individual Mac admins champion internally
- Key pitch: "Jamf App Catalog shows you what you told it to track.
  OrchardPatch shows you everything that's actually on your fleet."
- Competitive window: 18-24 months before Jamf App Installers become a
  real threat. Build fast.

## Fleet
- 2 devices in production fleet
- device-GJM7N0XGL0: Jude's MacBook Pro (Mac16,1 · macOS 26.4)
- device-C02D52QTML85: Chip's MacBook Pro (MacBookPro16,2 · macOS 26.3.2 ·
  61 apps · 2020 13" 2.3GHz Quad-Core Intel i7 16GB)
- Agent installed via .pkg on both machines
- Agent install path: /usr/local/orchardpatch/agent/
- Config: /etc/orchardpatch/config.json (token rotated June 13)
- Logs: /var/log/orchardpatch/agent.log (stdout),
  /var/log/orchardpatch/agent.error.log (stderr -- version-check ETIMEDOUT
  and "Command failed" lines land here, NOT in agent.log)
- Device ID persisted to /var/root/.orchardpatch/device-id.json
- Installomator: v10.8 (2025-03-28) on both machines, at
  /usr/local/Installomator/Installomator.sh. Updated June 16 via catalog.
- Both agents stable June 16.
- VERSION_CHECK_INTERVAL=1 removed from Chip's machine plist (June 16 evening),
  agent reloaded, default cycle restored.
- version-checker rewrite (741add4/e071940) is LIVE on Chip's machine
  (device-C02D52QTML85). Jude's machine (device-GJM7N0XGL0) still runs the
  prior version-checker -- redeploy pending, low urgency (ingest is null-safe).
- Known MAS apps (not patchable via Installomator): Bitwarden, Canva (Jude)
- Known outdated apps on device-C02D52QTML85: Ollama (large, avoid as test
  target), Slack (in active use, avoid), Telegram (label mismatch, see below)

## DB schema (key tables)
- devices: id, hostname, device_id, last_seen, agent_version, agent_url
  (nullable)
- apps: id, device_id, bundle_id, name, version, latest_version (legacy/
  null), is_outdated (legacy/always 0 -- do not use), installomator_label,
  path, source
  source values: 'user' (third-party, patchable), 'system' (Apple-managed)
- latest_versions: label (PK), latest_version, last_checked, error
  STATUS: 33/45 populated as of June 16 evening.
  INGEST IS NULL-SAFE (commit d96ea73): the ON CONFLICT upsert guards
  latest_version with CASE WHEN EXCLUDED.latest_version IS NOT NULL AND <> ''
  THEN EXCLUDED ELSE existing. error and last_checked always update. A failed
  check records its error against the last-known-good version instead of
  wiping it. (Open: "last-known-good held forever" staleness policy is a
  resolver-era question, not yet handled.)
  12 nulls, two categories:
   - Genuine no-version query (Installomator exits non-zero): capcut, claude,
     claudedesktop, darkroom, dropboxenterprise, trello. Several have Homebrew
     casks -- the resolver redesign should recover these.
   - False match / guard-rejected to null: boxdrive, chromeremotedesktop,
     microsoftteams, microsoftteams-rollingout, nomad (date or stray-string
     captures), coconutbattery (confirmed upstream HTML bug, outreach opener).
- app_catalog: label (PK), app_name, bundle_id, expected_team, last_synced
  NOTE: bundle_id is null for effectively all rows -- 1,137 rows with real
  app_name/expected_team data as of June 12.
- patch_jobs: id, device_id, app_name, label, mode, method, status,
  created_at, started_at, completed_at, exit_code, error, log
  method values: 'fruit', 'branch', 'bushel', 'orchard'
  mode values: 'silent', 'managed', 'prompted'
  status values: 'queued', 'success', 'failed', 'cancelled'
  ('running'/'in_progress' do NOT occur by design)
  initiated_by: nullable, always null until real auth exists
  AS OF JUNE 13: all four methods create this row at queue time with
  status='queued', AND the completion side now correctly updates the same
  row to success/failed. started_at is populated on completion.
  NOTE: POST /patch-jobs (completion endpoint) hardcodes method='fruit' in
  its INSERT VALUES. However the ON CONFLICT SET clause does not include
  method, so the queue-time method value is preserved on update. The
  hardcode only fires on INSERT (no pre-existing row) which should not occur
  in normal flow. Tech debt -- fix by having agent send method in body.
- pending_patches: agent work queue. Rows deleted server-side on terminal
  status (June 13 fix). 24h expiry cron still present as backup cleanup.
  claimed_at set by claimPatch. id matches patch_jobs.id for all methods.
- preferences: key (PK), value (text) -- not yet created. Needed for
  Pinned Apps persistence on Dashboard.

## Key API endpoints
- POST /checkin -- agent check-in, inventory push (includes installomator_label)
- GET /devices -- fleet list with outdated_count (latest_versions join)
- GET /apps -- raw app rows (do not use for status -- use /apps/status)
- GET /apps/status?device_id= -- patch status per app with cache_age_seconds
  patch_status values: 'outdated', 'current', 'unknown', 'na'
- GET /stats -- fleet stats
- POST /patch -- queue a Fruit patch job. No inventory/label validation --
  accepts any label/appName (required for catalog deploy). Writes both
  tables atomically. Required body: deviceId, label, appName. Optional:
  bundleId, mode (defaults 'managed'). Response: { ok, id, deviceId, label,
  appName, createdAt }.
- POST /patch-jobs/branch -- queue Branch (validates device + labels
  genuinely outdated via apps/latest_versions join before inserting)
- POST /patch-jobs/bushel -- queue Bushel (same pattern). Returns 400 if
  no devices have outdated versions of the label.
- POST /patch-jobs/orchard -- queue Orchard (same pattern)
- POST /patch-jobs -- agent completion-report endpoint. Upserts into
  patch_jobs via ON CONFLICT(id) DO UPDATE SET (status, exit_code, error,
  log, started_at, completed_at). Deletes pending_patches row on terminal
  status in same transaction. method hardcoded 'fruit' in INSERT VALUES
  (tech debt, safe -- see DB schema note above). Required: jobId, appName.
- POST /patch-jobs/:id/cancel -- cancel. Confirmed working: queued-not-
  claimed (deletes pending_patches, sets cancelled), never-enqueued (sets
  cancelled directly), claimed (409).
- GET /patch-jobs -- list jobs, supports ?device_id, ?method, ?mode, ?status
- POST /api/version-sync/ingest -- ingest version data. ON CONFLICT upsert is
  null-safe as of June 16 (commit d96ea73): null/empty latest_version
  preserves the stored value; error and last_checked always update.
- GET /api/version-sync and /api/version-sync/:label -- cache lookups
- POST /api/catalog-sync -- sync Installomator catalog from GitHub
- GET /api/catalog -- browse catalog, ?search= supported, pagination,
  1,137 total rows as of June 12 sync

## Next.js proxy routes (frontend)
All 13 proxy routes use FLEET_SERVER_TOKEN (non-public, server-side only)
as of June 16 (Phase 5 complete). Return 503 if env var missing.
No direct browser-to-fleet-server calls exist anywhere in the frontend.
- /api/patch -- forwards to POST /patch
- /api/patch-jobs -- forwards to GET /patch-jobs (NEW June 16)
- /api/patch-jobs/branch -- forwards to POST /patch-jobs/branch (NEW June 16)
- /api/patch-jobs/bushel
- /api/patch-jobs/orchard
- /api/patch-jobs/[id]/cancel
- /api/stats
- /api/devices
- /api/apps/status
- /api/catalog -- forwards to GET /api/catalog with search/page/limit
- /api/fleet/status
- /api/fleet/apps/[id]
- /api/fleet/devices/[id]

## Feature status

### Shipped (June 16)
- **Phase 4: Installomator self-update via catalog.** Both machines updated
  from v10.9beta to v10.8 stable via /catalog UI in silent mode. patcher.js
  INSTALLOMATOR_PATHS order fixed (pkg path first, commit 8ad966f). Chrome
  patched successfully on both machines as Phase 4 verification. Phase 1 fix
  confirmed holding in production (0 queued rows, 0 pending_patches after
  completion). Commits 8ad966f (agent).
- **Phase 5: Token lockdown.** All 5 client-side pages (patches, fleet,
  reports, devices/[id], HomePageInner) migrated from direct fleet server
  calls to proxy routes. 2 new proxy routes added: GET /api/patch-jobs,
  POST /api/patch-jobs/branch. fleetServer.ts deleted (dead code).
  NEXT_PUBLIC_FLEET_SERVER_URL and NEXT_PUBLIC_FLEET_SERVER_TOKEN removed
  from Vercel. FLEET_SERVER_URL and FLEET_SERVER_TOKEN added as non-public
  server-side vars. Token confirmed absent from browser bundle (devtools
  verified). Commits 4b509f6, 208ee22, 6b2e20c (frontend).
- **Catalog pagination.** Proxy now translates page+limit to offset for
  server, adds page/pages back to response. Component has page size selector
  (25/50/100, default 50) and prev/next page controls. Commit ee2a508.
- **Success rate null guard.** successRate returns null (not 0) when no
  terminal jobs exist, preventing false red coloring. Commit bbce1af.
- **version-checker.js rewrite (June 16 evening).** Root cause of 0/45 was
  that DEBUG=1 does NOT skip downloads, only the install step, so version
  checks downloaded full artifacts and timed out. Earlier DEBUG-as-positional
  and execSync->spawnSync changes (7acabfc, b873040) did not fix it for that
  reason. ACTUAL FIX (741add4, e071940): async spawn, stream stdout, kill the
  moment appNewVersion= appears (before download), 12s backstop, version-shape
  guard. RESULT: 33/45 populated. Live on Chip's machine; Jude's machine
  redeploy pending (low urgency). See version-checker.js architecture section.
- **Null-safe ingest (June 16 evening, commit d96ea73, server).** ON CONFLICT
  upsert no longer lets a transient null overwrite a good latest_version.
  Verified with a rolled-back transaction against live data. Closes the
  clobber risk from a mixed-version fleet.
- **app.orchardpatch.com custom domain.** Vercel domain + Cloudflare CNAME
  (DNS only, not proxied). Token confirmed absent from bundle. Safe to share
  externally.

### Shipped (June 13)
- **Phase 1: Job-completion id-threading fix.** Agent commit f181e8f,
  server commit 463f19b.
- **Phase 2: Agent deploy to both machines.**
- **Phase 3: Software Catalog page (/catalog).** Commits 1935b1f + 3e39223.
- **Security: Token rotation + hardcoded fallback removal.** Commit 3e39223.

### Previously shipped (carried forward)
- Dashboard at /dashboard, App Inventory at /apps
- App detail page with version distribution, patch policy display,
  per-device Fruit patch button (disabled when app is current)
- Device list and device detail pages
- Patch History with status filter, StatusBadge
- Branch, Bushel, Orchard patch modals
- Cancel endpoint and cancel buttons on queued jobs
- Auth wall (LOGIN_PASSWORD + SESSION_SECRET middleware)

### Known genuine unknowns (Jude's device)
- ASUS Device Discovery
- Avidemux
- BlueBubbles
- DaVinci Resolve (check -- Installomator may have a label)
- DisplayLinkUserAgent (driver component, not a patchable app)
- Google Docs, Sheets, Slides (browser shortcuts, not real binaries)

### Known label-matching issues
- coconutBattery: label scrapes coconut-flavour.com, gets HTML back.
  version-checker.js rejects and stores null. Underlying Installomator bug.
  Save for maintainer outreach -- good concrete opener.
- Telegram: "Telegram (Mac App Store)" and "Telegram Desktop" both mapped
  to label 'telegram' but have different versioning schemes. Not yet
  investigated.
- DaVinci Resolve: may have a label -- verify and add override if so.
- firefoxpkg: verify patches standard Firefox not ESR.
- Date/build-versioned labels (boxdrive, nomad, the Teams labels, etc.):
  the version-shape guard (^\d+\.\d) rejects date-style captures to null.
  Some of these may legitimately use CalVer/build versions. Version-string
  normalization across schemes is an open question for the resolver redesign,
  not a piecemeal fix now.

### In progress / Blocked
- Force reinstall option in catalog deploy modal -- deferred from Phase 3.
  Requires: schema change (add force_reinstall BOOLEAN DEFAULT FALSE to
  pending_patches), POST /patch body change (accept forceReinstall bool),
  agent change (read flag from pending_patches row, pass UNINSTALL=1 as
  positional arg to Installomator). Do not start until Phase 6 decision made.
- Bushel modal device count: pre-counts by installs not outdated status.
  Cosmetic -- batch into next frontend push.

### Not yet built
- Phase 6: Force check-in. TOP PRIORITY. Architecture: 60s fast loop +
  pending_commands table (server cannot push to NAT'd agents, so force
  check-in is a fast agent poll of a commands queue, not a server push).
  Cancel-window design decision required in Architectural Deep Dives (Opus)
  FIRST (grace period vs cancel-via-command). Should also resolve the
  claimed-but-abandoned staleness gap (a crashed agent leaves a claimed
  pending_patches row stuck; add a claimed_at staleness timeout to self-heal).
  The 15-minute poll cycle makes every verification loop cost up to 15
  minutes of waiting. This is actively painful during development.
- Phase 7: Force reinstall in catalog deploy modal.
- Version-resolver redesign: move latest-version sourcing off agents to a
  server-side, source-pluggable resolver. Architectural Deep Dive (problem
  statement written). AFTER Phase 6.
- MAS app detection: detect _MASReceipt at inventory time, set source='mas',
  show "Managed by App Store" instead of Patch button.
- Installomator version + Update button on device detail page. Agent reports
  installomatorVersion in check-in payload. Server stores in devices table
  (new column). Frontend shows version + amber Update button when outdated.
  Button triggers Fruit deploy of 'installomator' label to that device.
- Exit code descriptions in Patch History log viewer. Map common codes to
  plain English: 0=Success, 23=MAS install, 1=Label not found, 77=No URL.
- GITHUB_TOKEN for agent: pass as positional arg to Installomator version
  checks. Lifts GitHub API from 60/hr (unauthenticated) to 5000/hr. Needed
  for reliable version checking across GitHub-hosted labels.
- Agent token rotation as product feature
- Agent self-update path (no manual file copy)
- "Clear by status" bulk action in Patch History
- Pinned Apps on Dashboard (needs preferences table)
- Graph reports
- Automated catalog-sync schedule
- Cultivation / policy-based auto-remediation (Coming Soon page exists)
- Multi-tenancy / org isolation
- SSO / proper auth
- orchardpatch.com/enterprise landing page
- CLI / Homebrew tap
- mas integration (Mac App Store patching)
- Homebrew integration (org-level opt-in by design)
- Catalog table column alignment fix (cosmetic -- columns shift between pages)
- Light mode / Apple Business aesthetic
- Sentry / error monitoring
- DB indexes for fleet queries
- softwareupdate CLI research for system app patching

## Open items / tech debt

### Priority order for next session
1. Phase 6: Force check-in. Go to Architectural Deep Dives (Opus) FIRST for
   the cancel-window design decision (grace period vs cancel-via-command),
   which must also resolve the claimed-but-abandoned staleness gap. Settle the
   design before any code. This unblocks fast iteration on everything else.
   15-minute poll cycles are actively killing session velocity.
2. Version checker GITHUB_TOKEN: add to agent config, pass to Installomator.
   Lifts GitHub API rate limit from 60/hr to 5000/hr. Helps the GitHub-API
   labels and feeds the eventual server-side resolver.
3. Redeploy version-checker fix (741add4/e071940) to Jude's machine
   (device-GJM7N0XGL0). Low urgency -- ingest is null-safe -- fold into the
   next routine agent deploy.
4. Version-resolver redesign: Architectural Deep Dive (problem statement
   written). Move latest-version sourcing off agents to a server-side,
   source-pluggable resolver. AFTER Phase 6.
5. Phase 7: Force reinstall in catalog modal.
6. MAS app detection and UI flag.
7. Installomator version + Update button on device detail.
8. method='fruit' hardcode cleanup in POST /patch-jobs.
9. Bushel modal pre-count cosmetic fix.
10. Token rotation (token appeared in Chip diagnostic output June 16 session).
11. Agent token rotation product feature.
12. "Clear by status" bulk action in Patch History.

### Other open items
- GitHub PAT (GITHUB_TOKEN): renewed May 12, 2026, scoped to all public
  repos -- tighten to Installomator repo only at next rotation.
- agent_url column: unused, reserved for future server-initiated flows.
- No DB indexes on fleet queries yet.
- Catalog auto-sync not automated.
- is_outdated field / legacy latest_version on apps table: ignore.
- Server-side device typeahead: needs server-side search at fleet scale.
- Telegram label mismatch: see Known label-matching issues above.
- launchctl list can be misleading: exit-code/runs fields reflect history,
  not current state. Always confirm with ps aux for actual running PID.
- launchctl kickstart -k does not re-read plist EnvironmentVariables. Use a
  full unload/reload for env changes.
- "Claimed but abandoned" jobs have no recovery path. Phase 6 staleness
  timeout is the fix.
- postinstall script installs Installomator to /usr/local/bin/Installomator.sh
  which conflicts with pkg convention (/usr/local/Installomator/). Fix or
  remove the postinstall Installomator install step.
- Last-known-good version held forever: with null-safe ingest, a permanently
  failing label keeps its last good version while errors accumulate. Add a
  staleness policy in the resolver redesign.

## Next session priority order
See Open items section above. Item 0 (version checker) is CLOSED. Start with
Phase 6 (force check-in): go to Architectural Deep Dives (Opus) for the
cancel-window design decision FIRST, before any implementation.

## Lessons learned (June 12 late session)
- The single most valuable pattern: verify documented architecture against
  actual code before building on it.
- launchctl list's exit-code/runs fields reflect history, not current state.
  Always confirm with ps aux.
- Avoid follow-mode commands (tail -f) in Chip prompts.

## Lessons learned (June 13)
- Token rotation has three components, not two: Railway SERVER_TOKEN,
  Vercel token env var, AND /etc/orchardpatch/config.json on every managed
  machine. Missing the agent config breaks check-ins silently.
- Hardcoded secret fallbacks in source code are worse than NEXT_PUBLIC
  exposure: they live in git history permanently. Always fail loudly (503).
- Two report paths exist in the agent (reportJobToServer in patcher.js AND
  reportPatchJob in checkin.js). Both are idempotent.
- The 15-minute agent poll interval creates real testing friction. Phase 6
  is a prerequisite for fast iteration.

## Lessons learned (June 16)
- Installomator only reads KEY=VALUE flags from positional args (eval $1
  loop), never from the process environment. Passing flags as env vars
  silently does nothing. Always pass as positional args in the command string.
- execSync shells out via /bin/sh -c. In a LaunchDaemon root environment,
  /bin/sh spawn itself can ETIMEDOUT. Prefer spawn/spawnSync with an explicit
  args array over execSync.
- Exit code 23 from Installomator = "App installed from App Store -- will
  not overwrite." Not a version issue. MAS apps cannot be patched via
  Installomator regardless of which version is running.
- Installomator v10.8 (stable/release branch) and v10.9beta (main branch)
  coexist at different paths. The catalog deploys the pkg which installs to
  /usr/local/Installomator/. patcher.js and version-checker.js must check
  that path first. patcher.js had the wrong order (fixed June 16).
- Vercel NEXT_PUBLIC_ vars are inlined at build time into the browser bundle
  even when only referenced in server-side API route files. The prefix is
  the signal to Next.js to embed statically. Rename to non-prefixed vars to
  keep them server-side only.
- Token rotation: Vercel sensitive vars cannot be retrieved from the UI after
  saving. Always save the value in a password manager before setting.
- When the token appeared in Chip's diagnostic output during a session,
  rotate it. Treat session logs as potentially visible.
- Phase 6 (force check-in) is not a nice-to-have. Without it, every
  verification step costs up to 15 minutes.

## Lessons learned (June 16, continued / evening)
- DEBUG=1 does NOT skip downloads in Installomator. It only skips the install
  step. The artifact is still downloaded. This invalidated the earlier
  "DEBUG=1 = dry run" assumption and the spawnSync fix built on it.
- The working approach for download-free version checks: stream Installomator
  output and kill the process the instant appNewVersion= is logged, before the
  download begins (async spawn). Validate the captured value against a
  version-shaped guard so dates/HTML/stray strings reject to null. This is a
  flagged stopgap -- the real fix is a server-side resolver.
- launchctl kickstart -k does NOT re-read plist EnvironmentVariables. A plist
  env change needs a full unload/reload (bootout/bootstrap) to take effect.
  This likely explains why some earlier VERSION_CHECK_INTERVAL=1 test cycles
  never applied.
- Version-check error/timeout output lands in agent.error.log (stderr), not
  agent.log (stdout). Look there when diagnosing version checks.
- Python heredoc mangled a regex (\n became a literal newline), crashing the
  agent on startup. Substantial JS/TS edits with escapes, regex, or SQL
  strings go through direct file edits, never Python.
- An unconditional ON CONFLICT ... DO UPDATE SET lets a transient null clobber
  a good value. Guard the column (CASE WHEN incoming IS NOT NULL AND <> '');
  keep audit columns (error, last_checked) unconditional so failures are still
  recorded against the last-known-good value.
- Latest-version resolution is GLOBAL, not per-device. Running it on every
  agent via Installomator is the wrong shape and the source of most of this
  pain. The real fix is a server-side, source-pluggable resolver (Sparkle
  appcast, Homebrew cask JSON, vendor APIs, GitHub releases, Installomator
  label version-logic as fragile fallback). Queued as an Architectural Deep
  Dive, parked behind Phase 6.
- Don't polish a mechanism you've decided to replace. The 6 false-match null
  labels were left as safe nulls rather than hand-fixed.
