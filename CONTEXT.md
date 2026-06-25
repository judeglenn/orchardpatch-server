# OrchardPatch -- Project Context

Last updated: June 25, 2026 (Console redesign COMPLETE. design/liquid-glass
merged to main via fast-forward. Tip of main: 45aa6b6. Production confirmed
clean at app.orchardpatch.com. Next: demo video, polished repo, outreach.)

## What OrchardPatch is
A Mac admin tool providing complete visibility into managed macOS fleet apps
and patching via Installomator -- without touching your MDM. Tagline:
"See Everything. Patch Anything. Break Nothing."

Category: endpoint/patch management software (agent-based SaaS). Not pure
SaaS -- requires a LaunchDaemon agent on each managed machine. Closest
analogues: Kandji, Mosyle, Addigy. Security angle is real: OrchardPatch
surfaces unknown apps, outdated apps with CVEs, and the lagging state (vendor
shipped a patch, Installomator hasn't caught up -- the exact window attackers
exploit). Security positioning is secondary to the Mac admin audience in UI
copy; save it for waitlist/outreach framing where there's room to make the case.

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

## config.json structure (CORRECTED June 22)
File: /etc/orchardpatch/config.json. root:wheel 600 on both machines.
Actual structure (confirmed by inspection June 22):
  {
    "server": {
      "url": "https://orchardpatch-server-production.up.railway.app",
      "token": "<SERVER_TOKEN>"
    },
    "githubToken": "<GITHUB_TOKEN>"
  }
To read the server token in a shell one-liner:
  python3 -c 'import json; d=json.load(open("/etc/orchardpatch/config.json")); print(d["server"]["token"])'
NOTE: Previous CONTEXT.md notes implied a flat 'serverToken' top-level key.
That was wrong. The actual path is d["server"]["token"].
applyConfigEnv() in scheduler.js reads config.server.token and config.githubToken
and writes them into process.env at startup.

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
  NOT the download. It does not give a download-free version check.
- Agent secrets (server token, GITHUB_TOKEN) live in /etc/orchardpatch/config.json,
  root:wheel 600. Plist contains no secrets. applyConfigEnv() in scheduler.js
  reads config at startup and writes values into process.env so child processes
  (version-checker spawns) inherit them automatically.
- Exit code 23 from Installomator means "App previously installed from App
  Store -- Installomator respects the MAS installation and will not overwrite."
  This is correct behavior. MAS apps cannot be patched via Installomator.
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
- applyConfigEnv(): reads server.token and githubToken from config.json at
  startup, writes to process.env so version-checker spawns inherit them.
  Falls back to existing process.env values if config fields absent.
- Agent secrets now sourced from config.json (root:wheel 600), NOT plist.

Frontend (commits b8d6ee2, 401ade9):
- /api/force-checkin proxy route.
- Force check-in button on device detail page header panel. Three states:
  idle, loading ("Checking In..."), success/error (auto-clears after 3s).
  "Results Appear Within 60 Seconds" note below button.
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
  server-side, source-pluggable resolver is the real fix (Phase B onward).

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

## Version model (REDESIGN DESIGN LOCKED June 22 -- see version-resolver-design.md)
The single-number invariant is being replaced by a two-number model. Full
design and rationale in version-resolver-design.md (committed alongside).
Summary of what was decided:

- Two numbers, two pipelines:
  - latest_patchable: what OrchardPatch can deliver now. Installomator-sourced
    (the existing latest_versions pipeline). UNCHANGED by the redesign.
  - latest_available: the newest release that exists from the vendor. NEW
    server-side, multi-source resolver (Homebrew, Sparkle, GitHub, vendor API,
    later mas).
- "Outdated" stops being a boolean. It is the relationship between three
  numbers: installed, patchable, available. Four states: current, patchable,
  lagging (vendor ahead of Installomator), unknown.
- "Show both, the gap is a feature." The lagging state is the OrchardPatch
  wedge made visible AND the automated Installomator-contribution signal
  (it shows which labels are behind their vendors).
- Identity keyed on the installed app's REAL bundle ID (CFBundleIdentifier from
  the installed .app, which the agent already reports). This is viable even
  though bundleID is dead in the Installomator FRAGMENT corpus -- two different
  corpora. A new app_identity mapping table maps bundle_id to each source's
  token. This identity model also dissolves the Telegram label mismatch (MAS
  vs Desktop have different bundle IDs) and absorbs MAS detection/patching.
- LOCKED DECISIONS: record all source candidates (JSONB) + trust-ranked winner
  + conflict flag (decide real precedence after real data); curated identity
  mappings live in DB rows (curated=true) with JSON export/import, NOT a file
  (multi-tenancy is the decider); Installomator scrape stays (server-side
  patchable resolution is deferred Phase E, out of scope); failed version
  coercion resolves to Unknown never Current (fail toward visibility); daily
  cron cadence with per-source politeness.
- Build order: Phase A SHIPPED. Phase B SHIPPED. Phase C SHIPPED.
  Phase D absorbed into console redesign. Phase E deferred and out of scope.
  A-D never touch the working patchable pipeline.

Old philosophy note (still true for the patchable number specifically):
"Latest patchable" = latest version Installomator knows how to install, not
manufacturer's current release. Occasional 1-2 day lag between vendor release
and Installomator catching up is expected. The redesign no longer HIDES that
lag; it surfaces it as the gap between patchable and available.

## Resolver architecture (Phase B + C shipped June 23, 2026)

### Files
- src/lib/resolvers/homebrew.js -- resolveHomebrew(pool). Fetches
  formulae.brew.sh/api/cask.json (~7725 casks), builds a multi-index lookup
  (by installomator_label/token, artifact .app name, cask name array), matches
  against all app_identity rows, writes homebrew_cask to app_identity, returns
  Map(bundle_id -> {source, token, version, url}).
- src/lib/resolvers/sparkle.js -- resolveSparkle(pool). Queries app_identity
  for sparkle_feed_url IS NOT NULL, fetches each feed XML, parses via
  fast-xml-parser, extracts sparkle:version or sparkle:shortVersionString from
  first enclosure/item. Returns Map(bundle_id -> {source, feedUrl, version, url}).
  10s per-feed timeout with AbortController.
- src/lib/resolvers/github.js -- resolveGitHub(pool). Queries app_identity for
  github_repo IS NOT NULL. Calls GitHub Releases API, strips leading 'v' from
  tag_name. Returns Map. Currently returns empty Map (no github_repo rows yet).
  Uses GITHUB_TOKEN from process.env for auth.
- src/lib/resolver-cron.js -- coordinator. Runs all three resolvers in parallel
  via Promise.all. Merges candidates per bundle_id across all source Maps. Picks
  winner by trust order. Writes resolved_versions once per bundle_id.

### Trust order (higher = wins)
  homebrew < github < sparkle

Sparkle is vendor-published (app's own update mechanism). GitHub is vendor-
published releases. Homebrew is human-curated and can lag.

### Candidate merge logic
- All source results collected into candidates array per bundle_id
- Winner = highest-trust candidate with a version
- conflict = true when two or more sources disagree on major or minor version
  (patch-level differences do not trigger conflict)
- Writes to resolved_versions with null-safe ON CONFLICT upsert
- Cron fires 30s after server startup, then every 24h

### Current state (June 25)
- resolved_versions: 30 rows, all from Homebrew initially; 2 rows have
  source updated to 'sparkle' (higher trust, took precedence)
- Homebrew: 30/36 app_identity rows matched
- Sparkle: 2/3 resolved on first run (1 feed failed to parse -- unknown which)
- GitHub: 0 (no github_repo entries yet)
- app_identity: homebrew_cask populated for 30 rows; sparkle_feed_url now
  populated from agent check-ins (Phase C agent deployed to both machines)

### Homebrew cask matching priority
1. installomator_label exact match against cask token (most reliable)
2. Normalized app_name vs artifact .app bundle name (strong)
3. Normalized app_name vs cask name array entries (good)
4. Normalized app_name vs cask token (weakest)
Normalization: lowercase, alphanumeric only, all other chars stripped.
Type guard in buildCaskIndex: typeof appFile !== 'string' -> continue
(Homebrew artifact arrays can contain objects, not just strings).

## /apps/status SQL update (June 25, 2026)
GET /apps/status now includes:
  LEFT JOIN resolved_versions rv ON rv.bundle_id = a.bundle_id
  rv.latest_available added to SELECT.
The /api/fleet/apps/[id] Next.js proxy route extracts latestAvailable from
the first non-null latest_available value across all rows for the bundle_id,
and returns it on the app object. This enables the lagging state in the
version hero card.

## Roadmap sequencing (DECIDED June 22, updated June 25)
Decision: RESOLVER-FIRST. Outreach is timed to the resolver (the
differentiator), not merely to the console.

Decided sequence:
1. Resolver Phase A -- SHIPPED June 22.
2. Resolver Phase B (Homebrew source, real data) -- SHIPPED June 23.
3. Resolver Phase C (Sparkle + GitHub + candidate recording) -- SHIPPED June 23.
4. Console redesign, all surfaces, fully tokenized -- SHIPPED June 25.
   Merged to main via fast-forward. Tip of main: 45aa6b6.
5. Demo video + polished repo.
6. Outreach (MacAdmins Slack + contribution-first maintainer contact).

## System app classification philosophy
"System" = any app signed by Apple (com.apple.* bundle ID) or resident
under /System/. Not patchable via Installomator, tracked separately from
Unknown. Unknown means "third-party app with no Installomator label yet."

## MAS app classification (DETECTION SHIPPED -- Phase A)
Apps installed from the Mac App Store have a _MASReceipt directory inside
their .app bundle. Installomator exits 23 on these -- correct behavior,
not a bug. MAS apps cannot be patched via Installomator regardless of version.
Detection: agent checks path.join(appPath, 'Contents', '_MASReceipt') via
fs.existsSync at inventory time. If present, sets source='mas' on the app.
Precedence: system > mas > user.
UI: Patch button is hidden for source='mas' apps on the app detail page.
"App Store" shown in muted gray text instead. Verified end to end June 22.
patch_status SQL fix: WHEN a.source = 'mas' THEN 'na' added to CASE in
GET /apps/status (Phase B). Previously MAS apps with matching labels returned
'outdated' from the API. Frontend was already handling this correctly client-
side, but the API response was inaccurate. Both now correct.
Known MAS installs on Jude's machine (device-GJM7N0XGL0), confirmed June 22:
  ASUS Device Discovery, Bitwarden, Canva, Darkroom, DaVinci Resolve,
  Developer, Slack, Telegram, Trello, Word (10 total)
Known MAS installs on Chip's machine (device-C02D52QTML85): none detected.
Slack on Chip's machine is a direct download (not MAS) -- has Patch button.
DaVinci Resolve is MAS on Jude's machine; may be direct download on others.
App Store status bar pill: added Phase B. App Inventory shows 8 App Store
apps on current fleet.
Remaining gap: Branch/Bushel/Orchard modals still count MAS apps as patchable
targets. The Fruit button hide is done; the multi-device patch exclusion is
backlogged. MAS apps hitting Branch/Bushel will return exit 23 (handled in
TL;DR), but ideally they'd be excluded from the queue.
mas CLI for actual MAS patching: not yet built. adam_id column exists in
app_identity for future use.

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
- Fruit: app detail page fleet installations table (per-device Patch button).
  Also device detail page per-app Patch button.
- Branch: device detail page, "Patch All Outdated" button
- Bushel: app detail page, "Patch All Outdated" button
- Orchard: Fleet Dashboard (/dashboard), "Patch All Outdated" card
- Catalog: /catalog page (SHIPPED June 13)
- Cultivation: /orchard page, Coming Soon

## Patch modal copy standard (established June 25, 2026)
All four modals have a quiet tier name footer below the action buttons.
Style: fontSize 11, var(--text-tertiary), textAlign center, marginTop 8.
Teaches vocabulary without forcing it.

- Fruit: "Patch by the Fruit · Single App, Single Device"
- Branch: "Patch by the Branch · All Outdated Apps, Single Device"
- Bushel: "Patch by the Bushel · Single App, All Devices"
- Orchard: "Patch by the Orchard · All Outdated Apps, Entire Fleet"

Modal titles (June 25 update):
- Fruit (apps/[id]): "Patch {app.name}" (dynamic app name)
- Fruit (devices/[id]): "Patch {patchTarget.appName}" (dynamic)
- Branch: "Patch Device"
- Bushel: existing (app name in header)
- Orchard: existing

## Copy standards (established June 25, 2026)
- No em dashes anywhere
- No emoji in UI. Use colored dot indicators: 8px filled circle, border-radius
  50%, inline style, CSS variable token for backgroundColor.
  Token mapping: outdated=var(--st-outdated), current=var(--st-current),
  unknown=var(--st-unknown), system=var(--st-system), store=var(--st-store),
  lagging=var(--st-lagging).
- Title case on all user-facing strings. Rules: capitalize first and last word
  always; capitalize major words (nouns, verbs, adjectives, adverbs); lowercase
  articles (a, an, the), short prepositions under 5 letters (on, at, in, of,
  to, by, up), coordinating conjunctions (and, but, or, nor, for, so, yet);
  always capitalize first word after a colon.
- No possessives in section headers and labels. Prefer plain declarative
  language. "Apps Detected" over "Your Installed Apps".
- "Apps Detected" preferred over "Installed Apps" -- OrchardPatch discovers
  what's actually on the machine.
- App Inventory subtitle: "Fleet-Wide Software Detection Across All Managed
  Devices"

## Frontend routing structure
- / -- redirects to /dashboard
- /dashboard -- Fleet Dashboard (homepage)
- /apps -- App Inventory
- /apps/[id] -- App detail page
- /catalog -- Software Catalog (SHIPPED June 13)
- /devices -- Device list
- /devices/[id] -- Device detail page (Force Check-In button added Phase 6)
- /fleet/devices/[id] -- redirects to /devices/[id]
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
- CONTEXT.md handoff workflow (locked June 25): Jude pastes or attaches
  CONTEXT.md to Chip at session end. Chip saves to disk at
  ~/Projects/orchardpatch-server/CONTEXT.md and commits. Next session Chip
  reads directly from disk -- no Telegram relay, no truncation risk.
  Claude.ai project file stays in sync as the source of truth for Claude
  sessions (upload after Chip commits).
- OpenClaw UI indicator: "Pearling" is an OpenClaw processing indicator that
  appears while Chip is thinking/streaming and disappears when done. Not a
  model identifier. Chip confirmed running anthropic/claude-sonnet-4-6.
- End every session: update CONTEXT.md, hand to Chip to commit. PREFERENCE:
  full CONTEXT.md rewrites at session end, not insertion blocks. Preserve ALL
  existing detail -- do not summarize or compress prior sessions' content.
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
- CRITICAL (June 24): Never use Tailwind utility classes for layout, spacing,
  or color in the orchardpatch frontend. Tailwind v4 purges utility classes
  that appear only in newly-added or heavily-modified files and are not
  referenced elsewhere in the bundle. All structural styles MUST use inline
  style props (React.CSSProperties). Inline styles cannot be purged.
  Tailwind is only reliable for: animate-spin, icon sizing (h-4 w-4), and
  classes that already appear at high volume across pre-existing files.
  This applies to shadcn components too if they are visibly broken in
  production (dropdown-menu.tsx, select.tsx, table.tsx all patched June 25).
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
- Config: /etc/orchardpatch/config.json. Structure: { server: { url, token },
  githubToken }. root:wheel 600 on both machines.
- Logs: /var/log/orchardpatch/agent.log (stdout),
  /var/log/orchardpatch/agent.error.log (stderr -- version-check ETIMEDOUT
  and "Command failed" lines land here, NOT in agent.log)
- Device ID persisted to /var/root/.orchardpatch/device-id.json
- Installomator: v10.8 (2025-03-28) on both machines, at
  /usr/local/Installomator/Installomator.sh. Updated June 16 via catalog.
- Both machines: Phase 6 agent fully deployed. Phase A agent deployed June 22.
  Phase C agent deployed June 23 (inventory.js reads SUFeedURL from Info.plist,
  sends as sparkleFeedUrl in check-in payload). Fast loop confirmed.
  version-checker rewrite live. GITHUB_TOKEN sourced from config.json on both.
- Known MAS apps on Jude's machine: ASUS Device Discovery, Bitwarden, Canva,
  Darkroom, DaVinci Resolve, Developer, Slack, Telegram, Trello, Word (10)
  NOTE: Slack and Telegram on Jude's machine are MAS -- Patch button hidden.
  Slack on Chip's machine is direct download -- Patch button shown.
  DaVinci Resolve is MAS on Jude's machine; may be direct download on others.
- Known outdated apps on device-C02D52QTML85: Ollama (large, avoid as test
  target), Slack (in active use, avoid), Telegram (label mismatch, see below)

## DB schema (key tables)
- devices: id, hostname, device_id, last_seen, agent_version, agent_url
  (nullable)
- apps: id, device_id, bundle_id, name, version, latest_version (legacy/
  null), is_outdated (legacy/always 0 -- do not use), installomator_label,
  path, source
  source values: 'user' (third-party, patchable), 'system' (Apple-managed),
  'mas' (Mac App Store install, not patchable via Installomator) -- NEW Phase A
- latest_versions: label (PK), latest_version, last_checked, error
  STATUS: 34/47 populated as of June 22.
  INGEST IS NULL-SAFE (commit d96ea73): the ON CONFLICT upsert guards
  latest_version with CASE WHEN EXCLUDED.latest_version IS NOT NULL AND <> ''
  THEN EXCLUDED ELSE existing. error and last_checked always update. A failed
  check records its error against the last-known-good version instead of
  wiping it.
- app_catalog: label (PK), app_name, bundle_id, expected_team, last_synced,
  download_url -- NEW Phase A. bundle_id null for effectively all rows.
  download_url populated from the downloadURL field in Installomator fragments.
  1,137 rows as of June 12 catalog sync.
- app_identity: bundle_id (PK), app_name, installomator_label, homebrew_cask,
  github_repo, sparkle_feed_url, adam_id, curated, last_derived -- NEW Phase A.
  Bootstrapped from apps table on startup, after catalog-sync, and on each
  check-in for new bundle_id+label pairs. curated=true rows never overwritten
  by derivation. homebrew_cask populated by Phase B (30 rows). sparkle_feed_url
  populated from agent check-ins as of Phase C agent deploy (June 23).
  github_repo: not yet populated by any automated process.
  checkin guard (Phase C): writes identity row if bundle_id AND
  (installomatorLabel OR sparkleFeedUrl). Previously required installomatorLabel.
- resolved_versions: bundle_id (PK), latest_available, source, source_url,
  candidates (JSONB), conflict, resolved_at, error -- NEW Phase A (schema).
  Populated from Phase B onward. 30 rows as of June 25. source values in use:
  'homebrew', 'sparkle'. candidates JSONB contains all source results for the
  bundle_id. conflict=true when sources disagree on major or minor version.
  Two tables, two pipelines: latest_versions (patchable) stays unchanged;
  resolved_versions (available) is the new addition.
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
  claimed_at is TEXT column. Staleness sweep uses claimed_at::timestamptz
  cast (fixed Phase B -- was causing type mismatch error every 5 minutes).
- pending_commands: id SERIAL PK, device_id TEXT, command TEXT, created_at
  TIMESTAMPTZ, claimed_at TIMESTAMPTZ, completed_at TIMESTAMPTZ, result TEXT.
  command is a string; allowlist { check_in } only for now.
  result TEXT persists agent outcome ("ignored: unknown command type" or
  empty string for check_in success).
- preferences: key (PK), value (text) -- not yet created. Needed for
  Pinned Apps persistence on Dashboard.

## Key API endpoints
- POST /checkin -- agent check-in, inventory push (includes installomator_label,
  sparkleFeedUrl as of Phase C). Phase A: also upserts bundle_id+label pairs
  into app_identity. Phase C: guard broadened to include apps with sparkleFeedUrl
  but no installomatorLabel; sparkle_feed_url written to app_identity.
- GET /devices -- fleet list with outdated_count (latest_versions join)
- GET /apps -- raw app rows (do not use for status -- use /apps/status)
- GET /apps/status?device_id= -- patch status per app with cache_age_seconds.
  Returns source field as of Phase A. patch_status values: 'outdated',
  'current', 'unknown', 'na'. Phase B: added WHEN a.source='mas' THEN 'na'
  to CASE. June 25: LEFT JOIN resolved_versions added; latest_available now
  returned on every row.
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
- POST /api/catalog-sync -- sync Installomator catalog from GitHub. Phase A:
  also extracts download_url from fragments and triggers bootstrapIdentity.
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
- /api/fleet/apps/[id] -- returns latestAvailable (added June 25, extracted
  from latest_available via LEFT JOIN resolved_versions on the server)
- /api/fleet/devices/[id]
- /api/force-checkin -- NEW Phase 6. Forwards to POST /api/force-checkin.
NOTE (Phase 6): mode-based deferred-enqueue policy (silent = 15s window) lives
in the server POST /patch handler. The proxy passes mode through as-is.

## Feature status

### Console redesign -- SHIPPED (merged to main June 25, 2026)
Branch design/liquid-glass merged via fast-forward. Tip of main: 45aa6b6.
35 files changed, 5004 insertions, 2553 deletions. Production confirmed clean.

**Hard constraints (non-negotiable for all new work):**
- Zero hardcoded hex in components. CSS variable tokens only.
- All layout, spacing, and color via inline style props (React.CSSProperties).
  No Tailwind utility classes for these. Inline styles cannot be purged.
- Both light and dark mode work on every surface.
- backdrop-filter needs -webkit- prefix for Safari. Always include both.
- No emoji in UI. Use 8px colored dot indicators with CSS variable tokens.
- Title case on all user-facing strings.

**Token layer (shipped June 24):**
- globals.css: verbatim :root and [data-theme="dark"] blocks from
  orchardpatch-console-master.html. All semantic tokens defined.
- New tokens added June 25: --surface-raised (#ffffff light /
  rgba(255,255,255,0.07) dark), --border-accent (rgba(61,122,66,0.35) light /
  rgba(116,204,124,0.30) dark). --surface-solid already existed.
- Tailwind @theme inline {} block maps tokens.
- layout.tsx: inline no-flash theme script, data-theme="light" SSR default,
  ThemeToggle in sidebar footer only.

**Sidebar icons (updated June 25):**
All hand-rolled inline SVGs. viewBox="0 0 24 24", strokeWidth: 1.7, round caps
and joins, width/height 18.
- DashboardIcon: layout rect (wide top bar + two bottom panels). Distinct from
  AppsIcon 2x2 grid.
- SettingsIcon: horizontal sliders (three lines with circle handles).
- All other icons unchanged: Globe=Devices, Clock=History, Plant=Cultivation,
  BarChart=Reports, Bell=Alerts, Grid=Apps, Box=Catalog.

**Status color semantics (applied across all surfaces):**
- Outdated/patchable: amber (var(--st-outdated)). Never red.
- Lagging (vendor ahead of Installomator): red (var(--st-lagging)). Reserved
  for this state only.
- Unknown: gray (var(--st-unknown)).
- Current: green (var(--st-current)).
- System: faint gray (var(--st-system)).
- App Store: blue (var(--st-store)).
- Dot indicators: 8px filled circle, border-radius 50%, backgroundColor token.

**Shadcn component patches (justified exceptions -- visibly broken in prod):**
- src/components/ui/dropdown-menu.tsx: zIndex 9999 on Positioner inline;
  --surface-raised (opaque) background on Popup; callerStyle destructured from
  props and merged after base styles so caller cannot overwrite base background;
  item padding inline (6px 8px); animation-only Tailwind kept in className.
- src/components/ui/select.tsx: same pattern applied.
- src/components/ui/table.tsx: TableHead and TableCell inline padding 10px 12px
  to replace purged Tailwind p-2/px-2. Style set before {...props} so callers
  win on conflict (correct precedence for a base component).

**Mechanical conversions (shipped June 24):**
All files below converted from hardcoded hex + Tailwind layout classes to
CSS variable tokens + inline style props:
- src/app/patches/page.tsx
- src/app/catalog/page.tsx
- src/app/devices/page.tsx
- src/app/fleet/page.tsx
- src/app/reports/page.tsx
- src/app/settings/page.tsx + organization, enrollment, labels, jamf sub-pages
- src/app/alerts/page.tsx
- src/app/orchard/page.tsx
- src/app/login/page.tsx
- src/app/integrations/page.tsx (fully unconverted -- hardcoded hex removed)
- src/components/HomePageInner.tsx
- src/components/AppCard.tsx
- src/components/PatchStatusBadge.tsx
- src/components/SearchBar.tsx (crammed search text root cause fixed)
- src/components/AgentBanner.tsx
- src/components/VersionChart.tsx
- src/components/VersionChartWrapper.tsx
- src/components/Sidebar.tsx (ThemeToggle in footer)

**Dashboard (/dashboard) -- COMPLETE (June 25):**
- 5 metric cards: clickable, link to /apps?status= with filter pre-applied
  (outdated, current, unknown, system, mas)
- Top outdated app rows: clickable, link to /apps/[bundle-id-slug].
  bundle_id surfaced through AppStatus interface and threaded through
  outdatedByLabel grouping.
- HomePageInner: reads ?status= on mount via useSearchParams, initializes
  patchStatusFilter from URL. Suspense provided by existing dynamic() + ssr:false
  wrapper on apps/page.tsx.
- Fleet health donut: five segments (outdated, current, unknown, system,
  App Store/blue). Total includes all five for complete fleet composition view.
- Fleet health legend: five rows, all clickable via LegendRow component with
  hover state. App Store row links to /apps?status=mas.
- statusCounts: deduplicated by bundle_id before computing. Worst-case-wins
  (outdated > unknown > current > na). MAS/System split correctly: system =
  patch_status='na' AND source!='mas'; store = source='mas'.
- Top outdated apps: scroll container maxHeight 240. Card header stays fixed.
- Sync now button: wired to silent stats refresh via loadData({silent:true}).
  Button hides while sync is in flight. No skeleton flash.
- ThemeToggle: sidebar footer only. Removed from topbar in all three variants.
- overflow: hidden removed from cardStyle.
- Last outdated app row: no borderBottom.
- Pinned slots: hover state transitions border + text to var(--accent) via
  PinSlot component with useState.
- Title case applied: "Fleet Health", "Top Outdated Apps", "View All",
  "Patchable Now", "Up to Date", "No Label Yet", "Apple Managed",
  "Queue Patches Across Your Entire Fleet", "Patch All Outdated".
- Orchard button corner clip RESOLVED: transform: translateZ(0) forces the
  button onto its own compositing layer, escaping WebKit backdrop-filter
  stacking context clip. Root cause confirmed: backdrop-filter on card's
  <section> creates a compositing layer that clips descendants at card's
  border-radius even without overflow: hidden.

**App Inventory (/apps) -- COMPLETE (June 25):**
- Status bar: dot indicators, no emoji. Five categories.
- Title: "App Inventory"
- Subtitle: "Fleet-Wide Software Detection Across All Managed Devices"
- Category dropdown: --surface-raised background (opaque), zIndex 9999,
  callerStyle merge pattern, item padding 6px 8px inline.
- Sort dropdown: same fix via select.tsx.
- Filter trigger buttons: explicit padding 0 12px, gap 6, whiteSpace nowrap,
  height 36 on all three (Category, Name A-Z, Outdated).

**App detail (/apps/[id]) -- COMPLETE (June 25):**
- latest_available surfaced via server LEFT JOIN on resolved_versions.
  Returned as latestAvailable on app object from /api/fleet/apps/[id] proxy.
- normalizeVersion helper: strips comma-suffix ("12.8,282010" -> "12.8") AND
  parenthetical build numbers ("7.1.0 (83064)" -> "7.1.0"). Used everywhere
  versions are displayed. Never mutates stored values.
- versionGt helper: segment-by-segment numeric comparison. Used for lagging
  condition: available > patchable (directional). When patchable > available
  (stale Homebrew data), classifies as patchable, not lagging.
  Firefox case: Installomator at 152.0.3, Homebrew at 152.0.2 -- correctly
  shows patchable after the directional fix.
- Resolver state derivation (in order): unknown (no patchable, no available) /
  patchable (installed < patchable) / lagging (versionGt(available, patchable)
  AND installed >= patchable) / current.
- Fleet aggregate installed version: single if all devices uniform, range
  ("131.0-132.0") if diverged. Computed from per-device rows.
- Version hero card, four states with progressive disclosure:
  - current: large number + green check circle (26x26, st-current-tint bg) +
    "Installed everywhere, matches the latest the vendor has shipped." prose
  - patchable: two columns (INSTALLED -> PATCHABLE), amber patchable number,
    "across N devices" sub-label if diverged, inline Patch CTA button with
    "Up to Date with the Vendor" note. Smart modal routing: Bushel if multi-
    device, Fruit if single.
  - lagging: three columns (INSTALLED -> PATCHABLE -> VENDOR LATEST). Installed
    in --text-primary, patchable in --st-outdated (amber), vendor latest in
    --st-lagging (red). Explanatory line with 3px left accent bar in
    --st-lagging: "Installomator can install up to X for now. Y is available
    from the vendor. This gap closes automatically once Installomator adds the
    newer release." Calm. No red banners. No blame. Installomator-safe wording.
    Inline Patch CTA with "Closes the patchable gap" note.
  - unknown: 40x40 gray icon box (--surface-raised bg, --text-tertiary color,
    question mark SVG) + "Version Data Unavailable" + prose.
- Fleet installations card: per-device rows, conditional action column:
  - installed < patchable: "Patch to X" button (Fruit)
  - installed >= patchable but lagging: "On Newest Patchable" muted text
  - source='mas': "App Store" muted text, no patch action
  - Last row: no borderBottom.
- Patch history card: last row no borderBottom.
- Fruit modal title: "Patch {app.name}" (dynamic).
- Fruit modal footer: "Patch by the Fruit · Single App, Single Device"
- Bushel modal footer: "Patch by the Bushel · Single App, All Devices"
- cardStyle: overflow hidden removed.
- Title case applied: "Installed on {n} Devices", "Patch History",
  "No Recent Patch History for This App.", "Up to Date with the Vendor",
  "Up to Date" (action column), "Patch a Single Device, or Use Patch All
  Outdated Above".

**Device detail (/devices/[id]) -- COMPLETE (June 25):**
- Full token conversion: zero hardcoded hex remaining.
- cardStyle matches other surfaces (surface-glass, sheen, backdrop-filter,
  border-hairline, r-xl, shadow-card, padding 22/24).
- overflow: hidden removed from card and table wrapper.
- Table wrapper: padding 0 12px so content breathes from card edge.
- Section header: "APPS DETECTED"
- Subtitle: "{n} Installed · {n} Outdated"
- Force Check-In button: three states via inline state -- idle (--text-primary),
  success (--st-current), error (--st-lagging). "Results Appear Within 60
  Seconds" note. Auto-clears after 3s.
- Patch All Outdated button: right-aligned above PATCH column. Uses
  --accent-grad, --shadow-accent, white text, --r-md.
- Branch modal title: "Patch Device"
- Branch modal footer: "Patch by the Branch · All Outdated Apps, Single Device"
- Orchard modal footer: "Patch by the Orchard · All Outdated Apps, Entire Fleet"
- Emoji removed throughout; dot indicators used.
- color-mix() used for semantic status tints (outdated badge, error state bg) --
  correct since these need semantic color. Table row alternation uses
  --surface-raised instead of color-mix (structural, not semantic).
- Title case applied: "Apps Installed", "System", "Outdated" in stat line;
  "Up to Date" in action column.

**Known deferred issues:**
- zoom.us version format: "7.1.0 (83064)" vs "7.1.0.83064" -- after
  normalizeVersion both become "7.1.0". versionGt handles correctly (patchable).
  May be legitimate build increment or format difference. Monitor.
- Lagging state not yet verified with real fleet data. Logic is correct.
  True lagging requires vendor ahead of Installomator -- may occur naturally
  as fleet data grows. Firefox showed false lagging (Homebrew behind
  Installomator at 152.0.2 vs 152.0.3) which the directional fix resolved.
- Title case audit not yet applied to Patch History, Catalog, Devices list,
  Settings pages. Apply as a follow-up pass.

### Shipped (console redesign -- June 25, 2026)
- **Full console redesign merged to main.** 35 files, fast-forward merge.
  design/liquid-glass tip: 45aa6b6. Production confirmed clean.
- **Site-wide Tailwind cleanup.** All files converted to inline styles.
- **Sidebar icons.** DashboardIcon: layout rect. SettingsIcon: horizontal
  sliders. Both hand-rolled SVGs.
- **Dashboard full design pass.** Clickable metric cards and top outdated rows,
  donut five segments, legend five clickable rows, statusCounts dedup,
  MAS/System split, scroll container, Sync now wiring, ThemeToggle sidebar.
- **App Inventory.** Emoji to dots. Subtitle. Dropdown fixes.
- **App detail full design pass.** latest_available in SQL and proxy.
  normalizeVersion + versionGt helpers. Version hero card four states.
- **Device detail full conversion.** Zero hardcoded hex. All four modal footers.
- **Copy standards.** No emoji (dots only). Title case. No possessives.
  Tier name footers on all four patch modals. App Inventory subtitle.
- **Button corner clip fixed.** translateZ(0) on Orchard button. Root cause
  confirmed: WebKit backdrop-filter compositing layer clips descendants at
  card border-radius. translateZ(0) forces button onto its own compositing
  layer, escaping the clip.
- **Title case sweep.** Dashboard, App detail, Device detail all complete.

### Shipped (Phase C -- June 23, 2026)
- **Sparkle resolver.** src/lib/resolvers/sparkle.js. 2/3 feeds resolved.
- **GitHub resolver.** src/lib/resolvers/github.js. Infrastructure ready,
  0 rows (no github_repo entries yet).
- **Candidate recording.** resolver-cron.js merges all sources, picks winner
  by trust order, records all candidates as JSONB, sets conflict flag.
- **Phase C agent.** inventory.js reads SUFeedURL from Info.plist, sends as
  sparkleFeedUrl in check-in payload. checkin.js guard broadened.
- **resolved_versions populated.** 30 rows from Homebrew; 2 upgraded to
  sparkle (higher trust).

### Shipped (Phase B -- June 23, 2026)
- **Homebrew resolver.** src/lib/resolvers/homebrew.js. 30/36 matched.
- **app_identity.homebrew_cask** populated for 30 rows.
- **resolver-cron.js** wired: 30s post-startup, then 24h.

### Shipped (Phase A -- June 22, 2026)
- **app_identity table.** bundle_id PK, all source columns, curated flag.
- **resolved_versions table.** Schema with JSONB candidates + conflict.
- **MAS detection.** source='mas' on inventory. Patch button hidden.
- **patch_status SQL.** WHEN source='mas' THEN 'na'.
- **bootstrapIdentity.** Runs on startup, catalog-sync, and check-in.

## Design philosophy notes (established through console redesign)
- OrchardPatch green is #3d7a42 (console, AA on white). Marketing keeps its
  own greens. Do not conflate them.
- Glass surfaces: backdrop-filter blur(20px) + saturate(180%) + -webkit- prefix.
  Always pair with border-hairline + shadow-card. Never use color-mix() for
  structural alternation -- use --surface-raised instead.
- "Calm authority" is the visual register. Muted surfaces, precise type,
  restrained use of color (amber for action, red reserved for lagging only).
  No gradients on data. No animation on state (gaming). Spend boldness in a
  few accent spots.
- For a Mac admin audience, honesty is the differentiator, not visual loudness.
  The lagging state stated precisely and calmly (Installomator-safe "for now")
  lands better than a red alarm. Alarm fatigue erodes trust with technical
  operators; do not cry wolf on a transient, non-actionable state.
- Progressive disclosure: a version module should show only as many numbers as
  carry information. current=1, patchable=2, lagging=3, unknown=0.
- The console green need not equal the marketing logo green. #3d7a42 (AA on
  white) for the console; mint #74cc7c on dark; marketing keeps its own greens.
- Status semantics carry meaning, not loudness: outdated->amber (action item),
  unknown->gray (we don't know), red RESERVED for lagging (the one concerning
  state).
- Frontend ships via Vercel on git push, so on-machine agent access buys nothing
  for frontend work. Claude Code (self-running build loop) is the right tool;
  Chip can drive it. Keep the build loop inside Claude Code, not relayed.
- When claiming a file edit was made, ACTUALLY make it and verify it landed.
  (Stated the sidebar color was pushed greener before writing it; caught and
  corrected the same session.) Also: a "full CONTEXT.md rewrite" must stay
  comprehensive -- do not silently trade changelog detail for concision. Start
  from the committed file and edit surgically rather than regenerating prose.
