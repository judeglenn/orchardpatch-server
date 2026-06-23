# OrchardPatch -- Project Context

Last updated: June 22, 2026 (Phase 6 fully complete on both machines; Patch History UI overhaul; GITHUB_TOKEN secured in config.json)

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
  - Local: ~/Projects/orchardpatch-waitlist
  - Deployed: https://orchardpatch.com (marketing/waitlist page)
  - NOTE: GitHub PAT does not scope to this repo. Push via SSH only.
- Marketing: https://orchardpatch.com

## Stack
- Fleet server: Node.js/Express on Railway
- Database: PostgreSQL (Railway-hosted), schema auto-migrates on startup
- Web app: Next.js 14 (App Router), TypeScript, Tailwind, deployed on Vercel
- Waitlist: Next.js 16.2.0, Tailwind v4, Resend, Google Sheets API, on Vercel
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

## Vercel environment variables (waitlist)
- RESEND_API_KEY -- Resend API key for owner notification emails
- WAITLIST_SHEET_ID -- Google Sheet ID for signup capture
- GOOGLE_SERVICE_KEY -- Google service account JSON key for Sheets API
  NOTE: All three confirmed set in Vercel production as of June 21.
  They are NOT in .env.local -- that is expected for local dev.

## Agent environment variables
- SERVER_URL -- fleet server URL
- SERVER_TOKEN -- matches fleet server
- VERSION_CHECK_INTERVAL -- check-ins between version runs (default: 10)
  NOTE: INSTALLOMATOR_PATH is NOT an env var -- agent discovers Installomator
  by checking a path list in order. See Installomator path section below.
  IMPORTANT: launchctl kickstart -k does NOT re-read plist EnvironmentVariables.
  Changing an env var in the plist requires a full unload/reload
  (bootout/bootstrap), not kickstart.
- GITHUB_TOKEN -- NO LONGER IN PLIST. As of June 22 (commit 9a2d75d),
  GITHUB_TOKEN is read from /etc/orchardpatch/config.json (githubToken field)
  via applyConfigEnv() in scheduler.js, which runs once at startup before any
  version check fires. Falls back to process.env.GITHUB_TOKEN if config field
  absent. Plist stays clean of secrets. config.json is root:wheel 600 on both
  machines. Renewed May 12, 2026, scoped to all public repos -- tighten to
  Installomator repo at next rotation.

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
- Agent loop split (Phase 6, fully shipped June 22):
  - Fast loop, 60s: polls pending_commands AND pending_patches. First tick
    fires 15s after startup (intentional: allows startup inventory to complete).
    Subsequent ticks every 60s. Worst-case command latency: 60s.
  - Slow loop, 15min: full inventory + version checks. Unchanged from pre-Phase 6
    except patch claiming moved OFF it onto the fast loop.
  - Two independent timers, no coupling. Fast loop must NOT serialize behind a
    running Installomator process -- fire the patch, let proc.on('close') report.
- Force check-in: server writes a 'check_in' row to pending_commands; the agent
  fast loop picks it up, runs the slow-loop inventory body immediately, marks
  the command complete.
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
- Agent secrets (SERVER_TOKEN, GITHUB_TOKEN) live in /etc/orchardpatch/config.json,
  root:wheel 600. Plist contains no secrets. applyConfigEnv() in scheduler.js
  reads config at startup and writes values into process.env so child processes
  (version-checker spawns) inherit them automatically.
- Exit code 23 from Installomator means "App previously installed from App
  Store -- Installomator respects the MAS installation and will not overwrite."
  This is correct behavior. MAS apps cannot be patched via Installomator.
  Bitwarden and Canva are MAS installs on Jude's machine.
- All fleet server calls from the frontend go through Next.js proxy routes.
  No direct browser-to-fleet-server calls exist as of June 16 (Phase 5).
  FLEET_SERVER_URL and FLEET_SERVER_TOKEN are server-side only env vars.

## Phase 6 force check-in -- FULLY SHIPPED (June 22, 2026)
Design settled in Architectural Deep Dives (Opus). Implementation complete
June 23. Both machines verified June 22. Phase 6 is done.

### What shipped
Server (commits 8757f09, cc9723d, 9ef0de5, 5543c27, 7fdc8f2):
- terminate_stuck_job(id, reason): shared recovery function using pool.connect()
  for correct transaction isolation. Called by both staleness sweeps.
- 30-min staleness sweep (5-min cadence): marks abandoned claimed rows as
  failed with greppable "abandoned: ..." error string.
- 24h expiry cron: fixed to route through terminate_stuck_job (was orphaning
  patch_jobs rows). Added claimed_at IS NULL guard (was nuking live claimed rows).
- pending_commands table (id, device_id, command, created_at, claimed_at,
  completed_at, result TEXT).
- ENQUEUE_ALLOWED = new Set(['check_in']) -- the allowlist IS the auth boundary.
  Comment is the spec. Adding a command type is a "design auth first" trigger.
- Four endpoints: GET /pending-commands, POST /pending-commands/:id/claim,
  POST /pending-commands/:id/complete (persists result), POST /api/force-checkin.
- Cancel handler rewritten with SELECT ... FOR UPDATE on pending_patches.
  Three cases: undo window (Case A, no pending_patches row), claimed (409),
  unclaimed (delete + cancel).
- Deferred enqueue for silent patches: POST /patch withholds pending_patches
  row for 15s when mode === 'silent'. patch_jobs written immediately. setTimeout
  guard checks patch_jobs.status before inserting -- skips if cancelled.
- KNOWN RACE documented in code: ~1ms window between SELECT status and INSERT
  in the deferred enqueue guard. Acceptable at current fleet scale. Fix before
  multi-tenancy: wrap SELECT + INSERT in FOR UPDATE transaction.

Agent (commit 9a2d75d and Phase 6 commit):
- Slow loop body extracted to runInventoryAndVersionCheck() -- called by both
  the slow timer and the check_in command handler.
- Fast loop: 15s initial delay, then every 60s. Polls pending_commands and
  pending_patches. Fires patches without awaiting (proc.on('close') is the
  report path). Unknown command types logged and marked complete with
  "ignored: unknown command type".
- Conditional claim: returns null on 409, fast loop skips on null.
- applyConfigEnv(): reads githubToken from config.json at startup, writes to
  process.env so version-checker spawns inherit it. Falls back to existing
  process.env.GITHUB_TOKEN if config field absent.
- GITHUB_TOKEN now sourced from config.json (root:wheel 600), NOT plist.

Frontend (commits b8d6ee2, 401ade9):
- /api/force-checkin proxy route.
- Force check-in button on device detail page header panel. Three states:
  idle, loading ("Checking in..."), success/error (auto-clears after 3s).
  "Results appear within 60 seconds" note below button.
- Undo affordance in Patch History: amber countdown button for queued silent
  jobs within 15s of created_at. tick useEffect only runs when an in-window
  job exists (zero performance cost at idle). undoSecondsLeft helper computed
  in PatchesPageInner, passed as prop to JobRows. Amber (#fbbf24) vs red
  Cancel for visual distinction.

### Verified end to end (both machines)
- Force check-in: POST /api/force-checkin -> pending_commands row created ->
  agent fast loop picks up within 15s -> inventory runs -> completed_at set.
- Deferred enqueue: patch_jobs written immediately, pending_patches empty for
  15s, row appears after window expires.
- Undo cancel during window: cancel Case A path, patch_jobs flipped to
  cancelled, setTimeout guard skips the deferred insert.
- Amber countdown button: visually confirmed in Patch History browser UI.
- Both machines: "slow loop: 15min, fast loop: 60s" confirmed in agent.log.
  "GITHUB_TOKEN loaded from config" confirmed on Chip's machine.

## Patch History UI (overhauled June 22, 2026)
- Flat chronological list, sorted by startedAt DESC (createdAt fallback for
  queued jobs). No day grouping -- date is always visible on each row.
- Started column: formatDateTime(job.startedAt) -- "Jun 22, 2026 at 6:32 PM".
  Browser local timezone (toLocaleTimeString with no explicit timezone override).
  Returns "--" for null/undefined.
- Last Patch stat card: uses formatDateTime instead of formatRelativeDate.
- TL;DR summary above raw log in expanded row. Shows human-readable exit code
  interpretation. Mac admins appreciate not having to decode Installomator output.
- exitCode field added to PatchJob type (was mapped in normalizer but absent
  from type). getJobSummary(status, exitCode) in utils.ts:
  - cancelled -> "Cancelled before execution"
  - queued -> "Waiting to be picked up by the agent"
  - exit 0 -> "Patch completed successfully"
  - exit 23 -> "App is managed by the Mac App Store. Installomator cannot patch MAS installs."
  - exit 16 -> "Download failed. Check network connectivity or try again."
  - exit 11 -> "Checksum mismatch. Downloaded file may be corrupted. Try again."
  - other non-zero -> "Patch failed (exit code N). See log for details."
  - fallback -> "No details available."

## version-checker.js architecture (rewritten June 16 evening)
- CRITICAL CORRECTION: DEBUG=1 does NOT skip downloads. It only skips the
  install step. Installomator still downloads the full artifact in DEBUG mode.
- Why large labels timed out: they were genuinely downloading the artifact
  (Slack ~150MB, Office, Dropbox, etc.) and hitting the timeout before
  appNewVersion was ever logged. Chrome-class labels worked because their
  label fetches the version from an API before any download.
- ACTUAL FIX (commits 741add4, e071940): async spawn (not spawnSync), stream
  stdout line by line, and kill the Installomator process the moment
  appNewVersion= appears, before the download starts. 12s hard timeout as a
  backstop. Captured value is validated against a version-shaped guard
  (^\d+\.\d); non-matching captures (dates, HTML, stray strings) reject to null.
- This works for labels that compute appNewVersion before the download step
  (the majority). Labels that only know their version after downloading the
  artifact cannot be resolved this way and stay null by construction.
- STATUS: 34/47 labels populated as of June 22 (up from 33/45 -- fleet labels
  expanding as catalog grows). Both machines now running the rewritten
  version-checker. GITHUB_TOKEN active on both (from config.json).
- STRATEGIC NOTE: running Installomator per-agent to get the latest version is
  the wrong shape. Latest-version resolution is global, not per-device, and
  belongs on the server. The early-kill scrape is a flagged stopgap. A
  server-side, source-pluggable resolver is queued as an Architectural Deep
  Dive (problem statement written, ready to schedule).

## Two-table write pattern (complete as of June 13)
- pending_patches -- the agent work queue. Agent polls this table via the fast
  loop (every 60s after Phase 6). Every patch operation MUST write here or the
  agent will never execute.
- patch_jobs -- the history/audit log. Every patch operation MUST also write
  here for history tracking.
- All four methods (fruit, branch, bushel, orchard) create both rows
  atomically at queue time, with patch_jobs.id = pending_patches.id,
  status='queued'.
  NOTE (Phase 6): for silent patches, the pending_patches row is WITHHELD for
  the 15-second undo window. The patch_jobs row is still written immediately
  at queue time.
- COMPLETION SIDE: fixed June 13. patch.id threads through pollAndRunPatches
  -> runPatchJob -> createJob -> reportPatchJob. The ON CONFLICT(id) DO
  UPDATE in POST /patch-jobs now correctly transitions queued -> success/
  failed on the same row. pending_patches row deleted server-side in the
  same transaction on terminal status. started_at now populated.

## Agent job execution model (confirmed working June 13, updated Phase 6)
- Fast loop (60s) in scheduler.js:
  1. fetchPendingPatches(deviceId) -- GET /pending-patches?device_id=...
  2. For each unclaimed row: claimPatch(patch.id) -- returns null on 409
     (already claimed). Agent skips on null.
  3. runPatchJob(...) -- fired WITHOUT await. proc.on('close') in patcher.js
     is the report path. waitForJob is no longer called from the fast loop.
  4. GET /pending-commands?device_id=... -- poll for commands
  5. For each command: claim, execute, complete.
     check_in: runs runInventoryAndVersionCheck() immediately.
     unknown: logs, marks complete with "ignored: unknown command type".
- Two report paths exist and both are idempotent:
  - reportJobToServer() in patcher.js fires from proc.on("close") -- PRIMARY
  - reportPatchJob() in checkin.js -- now unreachable from fast loop (waitForJob
    no longer called). Kept in codebase but effectively dead. Clean up later.
- pending_patches row is deleted server-side in POST /patch-jobs on terminal
  status, in the same transaction as the upsert. Confirmed June 13.
- "Claimed but abandoned" gap -- RESOLVED IN PHASE 6. 30-min staleness sweep
  + terminate_stuck_job handles crashed agents.
- patch_jobs.status NEVER transitions to "in_progress" or "running" by design.
  Stays "queued" until cancelled or completion reported.
- Cancel logic (Phase 6): SELECT ... FOR UPDATE on pending_patches serializes
  claim/cancel. Three cases: undo window (Case A), claimed (409), unclaimed.

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
TL;DR summary surfaces "App is managed by the Mac App Store" on exit 23, which
mitigates the UX problem until proper detection is built.
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
  NOTE: Cultivation is the future home for bounded retry-with-attempts per
  Phase 6 fork 2 decision.

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
- /devices/[id] -- Device detail page (Force Check-in button added Phase 6)
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
NOTE (Phase 6): mode is the axis the undo window keys on. silent gets the
deferred-enqueue undo window (N=15s); managed/prompted do not.

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

NOTE: installomator.com is a third-party SEO content site, not the official
project. Official Installomator lives at github.com/Installomator/Installomator.
All outreach goes to GitHub and MacAdmins Slack.

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
  session handoff file for next session. PREFERENCE: full CONTEXT.md rewrites
  at session end, not insertion blocks.
- Standing rule: always fix bugs at root cause. Never suggest workarounds.
  If a workaround is needed to unblock testing, flag it explicitly as tech
  debt before moving on.
- Standing rule: don't polish a mechanism you've already decided to replace.
- Standing rule: all fixes should be resolvable through OrchardPatch itself.
  Don't suggest manual CLI commands on machines when OrchardPatch should
  handle it.
- Standing rule: avoid follow-mode / non-terminating commands (tail -f,
  --follow) in Chip prompts -- they block Chip's tool-call loop until
  timeout. Use bounded forms (tail -n 50, fixed-duration checks).
- Chip prompts go in code blocks so Jude can copy them directly.
- For large output from Chip: ask Chip to write to a file on the Desktop
  so Jude can copy from a text editor (Telegram blocks large clipboard copies).
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
   application, multi-week-consequence decisions.
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
- Config: /etc/orchardpatch/config.json (token rotated June 13; githubToken
  added June 22). File is root:wheel 600 on both machines.
- Logs: /var/log/orchardpatch/agent.log (stdout),
  /var/log/orchardpatch/agent.error.log (stderr -- version-check ETIMEDOUT
  and "Command failed" lines land here, NOT in agent.log)
- Device ID persisted to /var/root/.orchardpatch/device-id.json
- Installomator: v10.8 (2025-03-28) on both machines, at
  /usr/local/Installomator/Installomator.sh. Updated June 16 via catalog.
- Both machines: Phase 6 agent fully deployed and verified as of June 22.
  Fast loop confirmed. version-checker rewrite live. GITHUB_TOKEN sourced
  from config.json on both.
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
  STATUS: 34/47 populated as of June 22.
  INGEST IS NULL-SAFE (commit d96ea73): the ON CONFLICT upsert guards
  latest_version with CASE WHEN EXCLUDED.latest_version IS NOT NULL AND <> ''
  THEN EXCLUDED ELSE existing. error and last_checked always update. A failed
  check records its error against the last-known-good version instead of
  wiping it.
- app_catalog: label (PK), app_name, bundle_id, expected_team, last_synced
  NOTE: bundle_id is null for effectively all rows -- 1,137 rows with real
  app_name/expected_team data as of June 12.
- patch_jobs: id, device_id, app_name, label, mode, method, status,
  created_at, started_at, completed_at, exit_code, error, log
  method values: 'fruit', 'branch', 'bushel', 'orchard'
  mode values: 'silent', 'managed', 'prompted'
  status values: 'queued', 'success', 'failed', 'cancelled'
  ('running'/'in_progress' do NOT occur by design)
  NOTE (Phase 6): abandoned claims reuse status='failed' with a greppable
  "abandoned: ..." error string. Promote to first-class status only if data
  shows it's frequent.
  initiated_by: nullable, always null until real auth exists
  Known exit codes in DB: 0 (success), 23 (MAS), 16 (download error),
  11 (checksum mismatch), null (queued/cancelled -- never ran).
- pending_patches: agent work queue. Rows deleted server-side on terminal
  status. 24h expiry cron routes through terminate_stuck_job (Phase 6 fix).
  claimed_at set server-side via now() in conditional UPDATE. id matches
  patch_jobs.id for all methods.
  NOTE (Phase 6): for silent patches the row is WITHHELD for the 15-second
  undo window before being written.
- pending_commands: NEW in Phase 6 (shipped June 22).
  id SERIAL PK, device_id TEXT, command TEXT, created_at TIMESTAMPTZ,
  claimed_at TIMESTAMPTZ, completed_at TIMESTAMPTZ, result TEXT.
  command is a string; allowlist { check_in } only for now.
  result TEXT persists agent outcome ("ignored: unknown command type" or
  empty string for check_in success).
- preferences: key (PK), value (text) -- not yet created. Needed for
  Pinned Apps persistence on Dashboard.

## Key API endpoints
- POST /checkin -- agent check-in, inventory push (includes installomator_label)
- GET /devices -- fleet list with outdated_count (latest_versions join)
- GET /apps -- raw app rows (do not use for status -- use /apps/status)
- GET /apps/status?device_id= -- patch status per app with cache_age_seconds
  patch_status values: 'outdated', 'current', 'unknown', 'na'
- GET /stats -- fleet stats
- POST /patch -- queue a Fruit patch job. Writes both tables atomically.
  NOTE (Phase 6): silent mode withholds pending_patches for 15s undo window.
  Required body: deviceId, label, appName. Optional: bundleId, mode.
  Response: { ok, id, deviceId, label, appName, createdAt }.
- POST /patch-jobs/branch -- queue Branch
- POST /patch-jobs/bushel -- queue Bushel
- POST /patch-jobs/orchard -- queue Orchard
- POST /patch-jobs -- agent completion-report endpoint. Upserts via ON CONFLICT.
- POST /patch-jobs/:id/cancel -- Phase 6: SELECT ... FOR UPDATE on
  pending_patches. Three cases: undo window (Case A), claimed (409), unclaimed.
- GET /patch-jobs -- list jobs, supports ?device_id, ?method, ?mode, ?status
- POST /api/version-sync/ingest -- ingest version data. Null-safe upsert.
- GET /api/version-sync and /api/version-sync/:label -- cache lookups
- POST /api/catalog-sync -- sync Installomator catalog from GitHub
- GET /api/catalog -- browse catalog, ?search= supported, pagination
- GET /pending-commands?device_id= -- agent polls for unclaimed commands
- POST /pending-commands/:id/claim -- conditional claim, returns 409 if lost
- POST /pending-commands/:id/complete -- persists result, always 200 (idempotent)
- POST /api/force-checkin -- enqueues check_in command. Body: { deviceId }.
  Validated against ENQUEUE_ALLOWED. Returns 201 { ok, id }.

## Next.js proxy routes (frontend)
All proxy routes use FLEET_SERVER_TOKEN (non-public, server-side only).
Return 503 if env var missing. 14 routes total as of Phase 6.
- /api/patch -- forwards to POST /patch
- /api/patch-jobs -- forwards to GET /patch-jobs
- /api/patch-jobs/branch
- /api/patch-jobs/bushel
- /api/patch-jobs/orchard
- /api/patch-jobs/[id]/cancel
- /api/stats
- /api/devices
- /api/apps/status
- /api/catalog
- /api/fleet/status
- /api/fleet/apps/[id]
- /api/fleet/devices/[id]
- /api/force-checkin -- NEW Phase 6. Forwards to POST /api/force-checkin.
NOTE (Phase 6): mode-based deferred-enqueue policy (silent = 15s window) lives
in the server POST /patch handler. The proxy passes mode through as-is.

## Feature status

### Shipped (June 22, 2026 -- this session)
- **Phase 6 fully verified on both machines.** Jude's machine agent deployed,
  fast loop confirmed, GITHUB_TOKEN confirmed loading from config.json.
- **GITHUB_TOKEN secured.** Moved from plist to /etc/orchardpatch/config.json
  (root:wheel 600) on both machines. applyConfigEnv() in scheduler.js reads
  at startup. Plist contains no secrets. (commit 9a2d75d, agent repo)
- **Patch History UI overhaul.** Flat list, formatDateTime ("Jun 22, 2026 at
  6:32 PM"), Last Patch stat card updated. TL;DR summary on expanded log rows
  with human-readable exit code mappings. exitCode added to PatchJob type.

### Shipped (June 23, 2026 -- Phase 6 implementation)
- **Phase 6: Force check-in.** Fast loop (60s) + slow loop (15min) agent
  split. pending_commands table + endpoints. Force check-in button on device
  detail page. Undo affordance (amber countdown) for silent queued jobs in
  Patch History. 30-min staleness sweep + terminate_stuck_job. 24h expiry
  orphan bug fixed. Cancel FOR UPDATE on pending_patches. Deferred enqueue
  for silent patches.

### Shipped (June 21-22, 2026 -- waitlist page)
- **Waitlist page overhaul.** Full visual redesign, copy overhaul, fleet size
  capture field, deduplication, privacy popover, contact copy-on-click.

### Shipped (June 16)
- **Phase 4: Installomator self-update via catalog.**
- **Phase 5: Token lockdown.** All fleet calls through proxy layer.
- **Catalog pagination.**
- **version-checker.js rewrite.** Async spawn, early-kill, 12s backstop.
- **Null-safe ingest (commit d96ea73).**
- **app.orchardpatch.com custom domain.**

### Shipped (June 13)
- **Phase 1-3: Job id-threading fix, agent deploy, Software Catalog page.**
- **Token rotation + hardcoded fallback removal.**

### Previously shipped
- Dashboard, App Inventory, App detail, Device list/detail, Patch History
- Branch, Bushel, Orchard patch modals. Cancel buttons. Auth wall.

### Designed, not built
- Version-resolver redesign: server-side, source-pluggable resolver. Problem
  statement written. Phase 6 now fully verified -- ready to schedule Opus Deep
  Dive in Architectural Deep Dives channel.

### Not yet built (priority order)
1. Version-resolver redesign -- Opus Deep Dive. READY TO SCHEDULE.
2. Phase 7: Force reinstall in catalog modal (UNINSTALL=1). Schema change
   (force_reinstall BOOLEAN on pending_patches), POST /patch body change,
   agent reads flag and passes UNINSTALL=1 positional arg.
3. MAS app detection: _MASReceipt at inventory time -> source='mas'. Hides
   Patch button, shows "Managed by App Store."
4. Installomator version + Update button on device detail.
5. Console UI redesign -- ELEVATED to outreach-gate. Decide sequencing in
   a Deep Dive. App UI must match waitlist aesthetic before screenshots.
6. Agent update mechanism -- pkg build pipeline. PRE-LAUNCH GATE. See tech debt.
7. Agent token rotation product feature.
8. method='fruit' hardcode cleanup in POST /patch-jobs.
9. Bushel modal pre-count cosmetic fix.
10. "Clear by status" bulk action in Patch History. Full scope: clear all
    failed, clear all cancelled, clear all queued, clear older than X (fixed
    options: 30/90/365 days), clear all. Design decisions needed: soft vs
    hard delete, fleet-wide vs filter-scoped, fixed date options vs date picker.
11. Pinned Apps on Dashboard (needs preferences table).
12. Automated catalog-sync schedule.
13. Cultivation / policy-based auto-remediation.
14. Multi-tenancy. PREREQUISITE for mutating pending_commands.
15. SSO / proper auth. PREREQUISITE for mutating pending_commands.
16. Graph reports, CLI/Homebrew tap, mas integration, Homebrew integration.

## Open items / tech debt
- **AGENT UPDATE MECHANISM -- PRE-LAUNCH GATE.** No pkg build pipeline exists
  for agent updates. Current process is manual file copy + bootout/bootstrap.
  This is not a viable user-facing update path. Required before real users are
  onboarded: a signed pkg with a postinstall script that handles file
  replacement, plist updates, and LaunchDaemon reload. Alternatively, a
  server-pushed self-update via pending_commands (plumbing exists as of Phase 6).
  Decision on which approach belongs in Architectural Deep Dives.
- reportPatchJob() / waitForJob() in the scheduler: now unreachable dead code
  since the fast loop does not await runPatchJob. Clean up in a future agent
  deploy.
- KNOWN RACE in deferred enqueue: ~1ms window between SELECT status and INSERT
  in setTimeout guard. Documented in code. Fix before multi-tenancy: wrap in
  FOR UPDATE transaction.
- postinstall script installs Installomator to /usr/local/bin/ -- conflicts
  with pkg convention. Fix or remove.
- method='fruit' hardcode in POST /patch-jobs INSERT VALUES. Safe (ON CONFLICT
  path preserves queue-time value) but dirty.
- DB indexes: none on fleet queries or pending_commands. Fine at 2 devices.
- agent_url column: unused, reserved for future server-initiated flows.
- Telegram label mismatch: "Telegram (Mac App Store)" vs "Telegram Desktop"
  both mapped to 'telegram'. Different versioning schemes. Not investigated.
- Last-known-good version held forever: staleness policy deferred to resolver.
- Console UI redesign deferred -- elevated to outreach-gate.
- GITHUB_TOKEN scoped to all public repos -- tighten to Installomator repo
  at next rotation (renewed May 12, 2026).

## Known label-matching issues
- coconutBattery: label scrapes coconut-flavour.com, gets HTML back.
  Upstream Installomator bug. Save for maintainer outreach opener.
- Telegram: see above.
- DaVinci Resolve: may have a label -- verify and add override if so.
- firefoxpkg: verify patches standard Firefox not ESR.
- Date/build-versioned labels (boxdrive, nomad, Teams): version-shape guard
  rejects to null. Version normalization deferred to resolver redesign.

## Next session priority order
1. Version-resolver redesign Deep Dive (Opus, Architectural Deep Dives channel).
   Phase 6 is fully verified -- this is now unblocked. Do NOT start in Sonnet.
2. Console UI redesign sequencing Deep Dive (Opus). Outreach gate.
3. Phase 7: Force reinstall (Sonnet, this chat).
4. MAS app detection (Sonnet, this chat).
5. Agent update mechanism -- pkg pipeline design (Opus, Architectural Deep Dives).

## Waitlist page (orchardpatch-waitlist repo)

### Current state (June 22, 2026)
Live at https://orchardpatch.com. 12 signups as of June 21 (organic).
Stack: Next.js 16.2.0, Tailwind v4, Resend, Google Sheets API.
Deploy: Vercel, auto-deploys on push to main.
GitHub PAT does not scope to this repo. Push via SSH only.

### Capture mechanism
- Resend: owner notification to info@orchardpatch.com on every signup.
- Google Sheets: dual-write confirmed working in production.
- Deduplication: reads column A before appending.
- Fleet size: optional dropdown (1-10, 11-50, 51-200, 201-1,000, 1,000+).

### Page structure (June 22 state)
1. Nav: white (#ffffff)
2. Hero (signup form): gray (#e8e8e8)
3. THE PROBLEM: white (#ffffff)
4. THE SOLUTION: gray (#e8e8e8)
5. PATCH GRANULARITY: white (#ffffff)
6. HOW IT WORKS: gray (#e8e8e8)
7. Bottom CTA (signup form): white (#ffffff)
8. Footer: gray (#e8e8e8)

### Design
- Light mode. macOS 27 Finder-inspired aesthetic.
- Cards: white (#ffffff), 1px solid #c5c5c7 border, rounded-3xl (24px).
- Green: #2d6e1f for feature card headings, #4a7c2f for CTA buttons,
  #7dd94a for logo "Patch" wordmark only.
- Section label pills: #1d1d1f fill, white text, font-semibold.
- Footer: "Built for Mac admins, by a Mac admin."
- Privacy popover + contact copy-on-click on email address.

### Copy principles
- No em dashes anywhere.
- Installomator mentioned in patching context only, never discovery.
- No vendor name-drops.
- Problem section frames a gap MDMs were not built to fill, not an MDM failure.
- Brand names (Fruit/Branch/Bushel/Orchard) kept off the page.
- Cultivation not mentioned.

## Brand color note
Current brand green: #7dd94a (bright lime). Hunter green (~#355E3B range)
is the preferred future direction. Full palette change deferred to a dedicated
brand session. No piecemeal color changes in the interim.

## Lessons learned (June 12-13)
- The single most valuable pattern: verify documented architecture against
  actual code before building on it.
- launchctl list's exit-code/runs fields reflect history, not current state.
  Always confirm with ps aux.
- Token rotation has three components: Railway SERVER_TOKEN, Vercel token env
  var, AND /etc/orchardpatch/config.json on every managed machine.
- Hardcoded secret fallbacks in source code are worse than NEXT_PUBLIC exposure.
  Always fail loudly (503).
- The 15-minute agent poll interval creates real testing friction. Phase 6 is
  a prerequisite for fast iteration. (Now resolved.)

## Lessons learned (June 16)
- Installomator only reads KEY=VALUE flags from positional args (eval $1 loop).
- execSync can ETIMEDOUT in a LaunchDaemon root environment. Prefer spawn.
- Exit code 23 = MAS install. Not a version issue.
- Vercel NEXT_PUBLIC_ vars are inlined at build time even in server-only files.
- Token rotation: Vercel sensitive vars cannot be retrieved after saving.
- DEBUG=1 does NOT skip downloads in Installomator. Only skips install step.
- Version-check errors land in agent.error.log (stderr), not agent.log.
- Python heredoc mangles regex/SQL escape sequences. Use direct file edits.
- Unconditional ON CONFLICT overwrites can clobber good values. Guard them.
- Latest-version resolution is global, not per-device. Per-agent is the wrong
  shape. Server-side resolver is the real fix.

## Lessons learned (June 21-22 -- waitlist)
- Installomator and app discovery are separate mechanisms. Keep copy distinct.
- installomator.com is a third-party SEO site. Official: github.com/Installomator.
- Frame MDM limitations as gaps, not failures.
- mailto + target="_blank" opens blank tabs. Never combine them.
- #7dd94a has insufficient contrast on white for text. Use #2d6e1f for text.
- Stats strips become redundant when page copy covers same claims in context.

## Lessons learned (June 23 -- Phase 6 design)
- A grace period is a guess; FOR UPDATE is a guarantee. When you can get a
  guarantee, do not ship a guess.
- Mechanism safety and human undo are SEPARATE concerns. Row lock handles
  collisions; deferred enqueue handles misclicks.
- Key the undo window on MODE (silent = uninterruptible surprise), not tier.
- Implement an undo window as ABSENCE of a queue row, not a flag on an
  existing row.
- A garbage collector must not make policy decisions. Mark failed, let
  inventory replace the guess with a fact.
- Jamf 3-retry is retry on a KNOWN failure. Our abandonment is an UNKNOWN
  outcome. Different risk profile -- do not copy it.
- Don't derive constants cross-repo. Breaks silently when the other side
  changes.
- An allowlist can BE an auth boundary. Make the deferral loud.
- Idempotency is a table-wide contract once re-delivery is possible.
- Decompose agent loops by FUNCTION (control plane vs heartbeat), not data type.

## Lessons learned (June 23 -- Phase 6 implementation)
- pool.query('BEGIN') does not guarantee all subsequent queries land on the
  same connection. Use pool.connect() + client.query() for all transactions.
  client.release() in a finally block is mandatory to avoid pool exhaustion.
- When Chip flags a correctness issue, fix it before committing. "Probably
  works" is not the bar for a cleanup function.
- Audit the exact codebase before implementing. Read before writing.
- claimed_at lives on pending_patches, not patch_jobs. FOR UPDATE must lock
  the table that holds the column you're branching on.
- Deferred enqueue (setTimeout) and the cancel handler interact. Ship both
  in the same commit.
- For large Chip output, ask Chip to write to a Desktop file so Jude can
  copy from a text editor. Telegram blocks large clipboard copies.

## Lessons learned (June 22 -- this session)
- LaunchDaemon plists are world-readable (644 by default). Never put secrets
  in EnvironmentVariables blocks. config.json at root:wheel 600 is the right
  home for agent secrets.
- process.env mutation at startup (applyConfigEnv) is the clean way to inject
  config-sourced secrets into child process environments without touching every
  spawn call site.
- Audit before writing: Chip correctly identified that the spawn was inside
  version-checker.js, not scheduler.js, which changed the implementation
  approach. Always understand the actual call graph first.
- Don't build UI features (day grouping) to paper over a data presentation
  problem (no timestamp on rows). The right fix was full datetime on every row.
- Verify Chip's exit code interpretations against CONTEXT.md. exit 23 is MAS,
  not "app was open." Wrong interpretation in the diff; caught before shipping.
- React.Fragment shorthand (<>) does not accept a key prop. Use
  <React.Fragment key={...}> for keyed fragment wrappers.
- A good TL;DR is personality, not just information. "TL;DR" lands better than
  "SUMMARY" for a Mac admin audience.
- Manual agent deploys are not a production update path. Every agent change
  currently requires a manual deploy -- this is a pre-launch gate, not a
  temporary inconvenience.