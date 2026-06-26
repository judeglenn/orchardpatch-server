# OrchardPatch -- Project Context

Last updated: June 26, 2026 (Phase 1 identity fix implementation session, Sonnet.
Implemented all 5 parts of Phase 1 across 4 relays + 2 follow-up fixes. Also
shipped the Catalog deploy identity guard (server 9ee2670, frontend 1096270).
Key corrections from verification: Telegram Opus item CLOSED (ru.keepcoder.Telegram
correctly targets the telegram label, confirmed via fragment + Homebrew cask primary
sources). Teams classic has no Homebrew cask (label only, cask NULL). MAS gate
required 5 points not 3 (homebrew.js UPDATE gap found by Chip during relay 1).
New open item: conflict auto-resolution pass must be part of soft-delete design --
without it the Telegram deploy button stays blocked after the orphan ages out.
New crash: SQL string with inner single quotes inside outer single-quoted JS string
crash-looped Railway (27d8b00 fixes it). Tip of orchardpatch-server: 27d8b00.
Next: soft-delete (with conflict auto-resolution pass), then demo video, outreach.)

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
  server-side, source-pluggable resolver is the real fix (Phase E -- now has a
  designed perfect-world target, see "Patchable pipeline architecture" below).
- CAVEAT surfaced June 26: even when the early-kill scrape captures a CORRECT
  version, the patchable number can still be optimistic relative to what the
  vendor's DOWNLOAD URL serves at patch time. See 1Password staged-rollout case
  in Open items. The scrape and the actual download endpoint can momentarily
  disagree during a vendor rollout. This is NOT a scraper bug; it is a property
  of unversioned vendor download URLs.

## Patchable pipeline architecture -- perfect-world target (discussed June 26)
This is the design intent for Phase E, captured so the Deep Dive starts warm.
Not yet built. Out of scope for routine work.

- Resolution is a GLOBAL fact, not per-device. The newest version of an app is
  the same for 2 machines or 2,000. Running the check per-agent computes the
  same answer N times, pays the download cost N times, and gets N chances to
  capture a wrong value. That is the structural flaw in the current scraper.
- Target shape:
  - Agents ONLY report installed versions and run patches. No version
    resolution on the agent at all. Smaller, dumber, more reliable root daemon.
  - One server-side resolver computes "latest patchable" per app on a schedule,
    writes one table. "Is this device outdated?" becomes a pure server-side SQL
    join of installed (agent) vs resolved-latest (resolver).
  - Resolve the patchable number by reading each Installomator label's version
    SOURCE directly. Most labels compute appNewVersion from a small API call or
    URL pattern -- the server can make that same call without running the script
    or downloading the artifact. This is the real fix for the early-kill hack:
    we were killing a 150MB download to scrape a number the label got from a
    2KB API response.
  - Fall back to the existing multi-source resolver (Homebrew/Sparkle/GitHub)
    when a label parse fails. Run Installomator in a controlled SERVER sandbox
    only as a last resort, never on a customer laptop mid-workday.
- The two numbers then share plumbing:
  - latest_available (newest vendor ships) -- resolver, server-side. Built.
  - latest_patchable (newest Installomator can install) -- ALSO server-side,
    resolved by reading the label's version source, resolver as fallback. New.
- The hard part, and why this is an Opus multi-week decision: 1,137 labels with
  heterogeneous resolution logic (JSON API, HTML scrape, Sparkle feed, GitHub
  releases). No single parser. The design work is deciding how much to replicate
  server-side vs lean on existing resolver sources vs accept a server sandbox.

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
  Phase D absorbed into console redesign. Phase E deferred and out of scope
  (now has a designed perfect-world target -- see Patchable pipeline
  architecture above). A-D never touch the working patchable pipeline.

Old philosophy note (still true for the patchable number specifically):
"Latest patchable" = latest version Installomator knows how to install, not
manufacturer's current release. Occasional 1-2 day lag between vendor release
and Installomator catching up is expected. The redesign no longer HIDES that
lag; it surfaces it as the gap between patchable and available.

## Version normalization (locked June 26, 2026)
The single most repeated bug class this project has hit. Rules now locked:

- normalizeVersion lives in src/lib/utils.ts (frontend) and is the ONE shared
  definition. apps/[id] previously had a local duplicate -- removed June 26,
  now imports from utils. Do not reintroduce local copies.
- Three steps, in order:
  1. Strip comma suffix: "12.8,282010" -> "12.8" (Homebrew comma format).
  2. Strip parenthetical build suffix: "7.1.0 (83064)" -> "7.1.0".
  3. Truncate to three segments: "7.1.0.83064" -> "7.1.0".
- normalizeVersion is for COMPARISON and STATE DERIVATION ONLY. It must NEVER
  touch what the Mac admin SEES. Display always shows the raw, full version
  string including build numbers. See "Raw version display" principle below.
- Server-side, the same normalization is expressed as nested regexp_replace in
  SQL. It appears in three queries: GET /apps/status, GET /devices
  (outdated_count), and GET /api/stats/patch-status. ALL THREE must stay in
  sync. The expression per side:
  regexp_replace(
    regexp_replace(
      regexp_replace(<col>, '\\s*\\([^)]*\\)', '', 'g'),
      ',.*', ''
    ),
    '^([0-9]+\\.[0-9]+\\.[0-9]+)\\..*$', '\\1'
  )
- CRITICAL escaping rule (see Standing rules): every backslash in a regex bound
  for PostgreSQL must be DOUBLED in the JS source. Use [0-9] not \d. Use \\1
  not \1. Use \\s \\( \\) \\. not \s \( \) \. Single backslashes are silently
  corrupted by JS string parsing and PostgreSQL receives a broken pattern.
- versionGt(a, b): segment-by-segment numeric comparison. Used for directional
  lagging detection. Lagging requires available > patchable (directional), not
  mere inequality. When patchable > available (stale Homebrew), classify as
  patchable, not lagging.
- FINDING June 26 (Installomator docs): Installomator compares versions for
  DIFFERENCE, not greater-than. It is documented explicitly that it has no
  concept of which version is newer, only whether installed != latest. Therefore
  it has no concept of "lagging." Our versionGt directional logic HAD to be built
  by us and cannot be borrowed from Installomator. This JUSTIFIES the lagging
  differentiator: OrchardPatch adds the directional comparison Installomator
  deliberately does not do. Good outreach framing. Source: Installomator wiki
  Label Variables Reference.
- FINDING June 26 (Installomator docs): versionKey. Installomator compares
  appNewVersion against a version read from the installed app, and WHICH
  Info.plist field it reads is configurable per label. Default is
  CFBundleShortVersionString; a label may set versionKey="CFBundleVersion" (or
  another field). IMPLICATION: Phase E server-side patchable resolution MUST
  honor each label's versionKey rather than assume CFBundleShortVersionString.
  This is also a latent source of installed-vs-patchable mismatch -- if the agent
  reads one plist field and the label compares against another, they can disagree
  with nothing actually wrong. The zoom.us "7.1.0 (83064)" vs "7.1.0.83064" shape
  is exactly this class. Normalization currently masks it; versionKey is the real
  seam. Source: Installomator wiki Label Variables Reference.

## Raw version display principle (locked June 26, 2026)
Mac admins must never see less version detail than the machine actually has.
- DISPLAY the raw, unmodified version string everywhere version detail appears:
  version hero card INSTALLED/PATCHABLE/VENDOR values, per-device fleet rows,
  "Patch to X" button labels, LATEST columns.
- NORMALIZE only behind the scenes to decide the status badge and resolver
  state. When installed and patchable are the same build in different formats,
  the badge says Current and BOTH raw strings stay visible so the admin can see
  why. Transparency is the product pitch; do not hide build numbers to make a
  comparison look clean.
- Example (zoom.us, the canonical case): hero shows INSTALLED "7.1.0 (83064)",
  PATCHABLE "7.1.0.83064", badge Current. Both raw strings visible, no false
  Patchable, full detail preserved.

## Canonical patch-status counts (shipped June 26, 2026)
Problem: outdated/current/unknown/system/store counts were computed in at least
four different places (GET /apps/status, GET /devices, GET /stats, App Inventory
stats bar) with different logic and different numbers. Dashboard and Fleet page
disagreed. Fixed with a single source.

- NEW endpoint GET /api/stats/patch-status (orchardpatch-server, commit
  30bff86). Returns fleet-wide { outdated, current, unknown, system, store,
  total }. Uses a DISTINCT ON CTE to dedup by bundle_id with worst-case-wins
  (outdated > unknown > current > na). Same 3-layer normalization as the
  /apps/status CASE block. system = patch_status='na' AND source!='mas';
  store = source='mas'.
- NEW frontend proxy route /api/stats/patch-status (commit 65eab7c). Standard
  pattern (FLEET_SERVER_URL/TOKEN, 503 if missing).
- Consumers wired to the canonical endpoint: Dashboard metric cards
  (HomePageInner), App Inventory stats bar (the PATCH STATUS row), Fleet page
  Outdated stat card. Client-side dedup removed from the Dashboard.
- Per-device badges on the Devices list stay device-scoped (from GET /devices
  outdated_count, which got the same normalization). They are NOT replaced by
  the canonical fleet-wide endpoint -- per-device is a different question.
- Every status count links to /apps?status=X (pre-filtered App Inventory).
- KNOWN INCOMPLETE: the old "Version Conflicts" stat card on App Inventory was
  supposed to be removed in this work and was NOT. App Inventory currently shows
  BOTH the new PATCH STATUS bar and the stale "13 Version Conflicts" card. See
  Open items -- this is a filed Sonnet cleanup.

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
- KNOWN BUG (June 26): the conflict comparison does NOT apply normalizeVersion
  before comparing candidates. Format-only differences (e.g. "7.1.0.83064" vs
  "7.1.0") get flagged as conflicts. This inflates the conflict count. Same
  normalization gap fixed everywhere else June 26. Filed as Sonnet cleanup.

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
- KNOWN BUG (June 26): the name-based fallback rules (priorities 2-4) can let
  TWO DISTINCT bundle IDs collide onto the SAME cask. Confirmed with PyCharm:
  com.jetbrains.pycharm (Pro) AND com.jetbrains.pycharm.ce (Community) both
  matched the pycharm cask, so CE got told its latest is 2026.1.3 (Pro) when
  CE's real latest is 2025.2.5 via the pycharm-ce cask. This is the multi-
  variant identity problem. Filed as Opus Deep Dive (see Open items).

## /apps/status SQL update (June 25-26, 2026)
GET /apps/status includes:
  LEFT JOIN resolved_versions rv ON rv.bundle_id = a.bundle_id
  rv.latest_available added to SELECT.
The /api/fleet/apps/[id] Next.js proxy route extracts latestAvailable from
the first non-null latest_available value across all rows for the bundle_id,
and returns it on the app object. This enables the lagging state in the
version hero card.
June 26: the patch_status CASE block now applies the full 3-layer normalization
to BOTH a.version and lv.latest_version before comparing, with all backslashes
correctly doubled (commit e513e8c). This was the zoom.us root-cause fix.

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
Bundle ID matching from fragments is not viable for the GUI apps we care about.
CORRECTED June 26 (Installomator docs read): it is NOT that bundleID is absent
from the fragment corpus as a concept. Labels DO carry a pkg bundle ID via the
packageID variable. But the documented convention is to OMIT packageID for apps
in /Applications (it is intended for CLI tools and non-/Applications installs,
where Installomator cannot otherwise discover the install). So packageID is
absent precisely for the /Applications GUI apps -- by convention, not by
absence-of-concept. Net effect on us is unchanged (no usable bundle ID from
fragments for the apps we track) but the reason matters for how we read the
corpus. Source: Installomator wiki Label Variables Reference.
Label assignment priority:
1. Label overrides (hand-curated, /etc/orchardpatch/label-overrides.json)
2. Agent local catalog match by bundle ID (sparse but exact where it exists)
3. Agent local catalog match by normalized name (primary path for most apps)
4. null -- app stays Unknown
Unknown means genuinely unpatchable via Installomator, not a bug.
CRITICAL (June 26): priority 3, name match, is VARIANT-BLIND. It is the root of
the multi-variant identity collision (see "Multi-variant identity" section). The
Phase 1 fix makes name-derived writes collision-aware and gates MAS out of
derivation.

## Multi-variant identity -- SHIPPED Phase 1 (June 26, 2026)
The principle and the Phase 1 fix. Full spec: phase1-identity-spec.md.

THE PRINCIPLE: identity is the installed app's CFBundleIdentifier. Signals that
populate app_identity are either INTRINSIC (read from the installed app itself:
bundle_id, _MASReceipt, Info.plist SUFeedURL) or NAME-DERIVED (matched against an
external corpus by display name: Homebrew casks, Installomator labels).
- Intrinsic signals are variant-safe -- they came from that exact app.
- Name-derived signals are variant-BLIND -- the string "PyCharm" does not carry
  Pro vs CE. Any match built on name can collide two distinct products.
The fix is NOT smarter name matching (no cleverness recovers information the
string never had). The fix is: MAS gates derivation; name-derived writes are
collision-aware (a token claimed by 2+ distinct bundle IDs is written to
NEITHER); curated rows cover the residual tail; a patch never runs against a
label not trusted for the installed bundle_id. A WRONG mapping is worse than a
MISSING one (missing = visible-but-unpatchable-with-reason; wrong = installs Pro
over someone's Community). Fail toward missing.

THE FOUR FAMILIES (confirmed via live data + fragment reads + Homebrew cask
verification, June 26):
- PyCharm Pro (com.jetbrains.pycharm): label jetbrainspycharm, cask pycharm.
  Correct. Protected by curated row so CE stops sharing its tokens.
- PyCharm CE (com.jetbrains.pycharm.ce): NO valid Installomator label exists.
  jetbrainspycharmce is a case ALIAS inside jetbrainspycharm.sh using product
  code PCP (Professional). Running it installs Pro OVER Community. CE's correct
  answer: label NULL, cask pycharm-ce (real version ~2025.2.5). Visible, not
  patchable, honest. NOTE: CE is NOT currently installed on Jude's machine --
  only PyCharm.app (Pro) at ~/Applications. The DB row for CE is stale and ages
  out with soft-delete.
- Teams: NOT a collision. com.microsoft.teams -> microsoftteams (label), cask
  NULL (no Homebrew cask exists for classic Teams). com.microsoft.teams2 ->
  microsoftteams-rollingout (label), microsoft-teams (cask). Two distinct apps,
  distinct correct labels. VALIDATES that the detector keys on shared TOKEN, not
  shared NAME.
- Canva: com.canva.canvaeditor is MAS (not patchable); com.canva.CanvaDesktop is
  direct (label canva, cask canva). MAS-gate dissolves the collision.
- Telegram: ru.keepcoder.Telegram is the live install on both machines. CONFIRMED
  (fragment downloadURL, expectedTeamID, Homebrew cask quit identifier all
  reference ru.keepcoder.Telegram directly). Curated to label telegram, cask
  telegram. com.tdesktop.Telegram is a STALE ORPHAN on Chip's machine
  (soft-delete ages it out). OPUS ITEM CLOSED -- the prior session's "park for
  Opus design" was based on inference not verification. Verification resolved it.

PHASE 1 -- ALL 5 PARTS SHIPPED. Commits:
- Relay 1 (MAS gate + identity_conflicts migration): server a3abd19, f4a2011;
  agent 993a8d0
- Relay 2 (collision detector + identity_conflicts recording): server 6e84fa9
- Relay 3 (curated seed rows + conflict resolution): included in server deploy
- Relay 4 (patch-path identity guard): server 24940fb
- Follow-up (checkin curated override + db.js startup sync): server 59264c2
- Frontend (version hero "Up to Date with Vendor" in wrong state): 6bb00fe

Part 0 -- identity_conflicts table + MAS cleanup:
  identity_conflicts created in db.js startup. Startup also runs idempotent
  UPDATE to null label/cask on any non-curated MAS app_identity rows.
  Unique index on (bundle_id, source, token) makes inserts idempotent.

Part 1 -- MAS gates derivation (5 POINTS, not 3 -- spec gap found during relay 1):
  source=mas apps excluded from name-derived matching. Five gate points:
  1. orchardpatch-agent catalog.js: enrichAppsWithLabels skips source='mas'
  2. orchardpatch-server server.js /checkin: filter excludes source='mas'
  3. orchardpatch-server identity-bootstrap.js: WHERE clause excludes source='mas'
  4. orchardpatch-server homebrew.js: NOT EXISTS guard on UPDATE prevents
     the Homebrew resolver re-populating MAS rows 30s after startup (this was
     the spec gap -- "rely on upstream gates" didn't account for the resolver's
     UPDATE running after the startup cleanup had already nulled the rows).
  5. orchardpatch-server db.js startup: idempotent MAS cleanup UPDATE on deploy.
  NOTE: Jude's agent (device-GJM7N0XGL0) still runs old catalog.js without gate 1.
  The server-side gates (2-5) correctly override any stale agent-reported labels.
  Update Jude's agent at next natural deploy opportunity.

Part 2 -- Collision detector (src/lib/identity-collision-detector.js):
  detectAndRefuseCollisions(column) runs for homebrew_cask and installomator_label.
  Any token held by 2+ distinct non-curated bundle IDs is NULLed in app_identity
  and recorded in identity_conflicts. Keys on TOKEN not NAME. curated=true immune.
  Called from: resolver-cron.js (post-resolver), identity-bootstrap.js (post-
  bootstrap), /checkin handler (post-write).

Part 3 -- identity_conflicts table (see DB schema section):
  10 rows recorded, 9 resolved=true, 1 false (com.tdesktop.Telegram orphan,
  intentional -- soft-delete ages it out and the conflict auto-resolution pass
  will mark it resolved automatically).

Part 4 -- Curated seed rows (in db.js startup, idempotent ON CONFLICT):
  6 rows, all curated=true:
  | Bundle ID                  | Label                       | Cask               |
  | com.jetbrains.pycharm      | jetbrainspycharm            | pycharm            |
  | com.jetbrains.pycharm.ce   | NULL                        | pycharm-ce         |
  | com.microsoft.teams        | microsoftteams              | NULL               |
  | com.microsoft.teams2       | microsoftteams-rollingout   | microsoft-teams    |
  | com.canva.CanvaDesktop     | canva                       | canva              |
  | ru.keepcoder.Telegram      | telegram                    | telegram           |
  CORRECTIONS from verification vs Opus session conclusions:
  - Teams classic has NO Homebrew cask. microsoft-teams cask installs New Teams.
  - ru.keepcoder.Telegram is correctly mapped to telegram (confirmed, not inferred).
  NOT seeded: com.canva.canvaeditor (MAS-gated), com.tdesktop.Telegram (orphan).

Part 5 -- Patch-path identity guard (src/lib/identity-trust.js):
  isIdentityTrusted(bundleId, label): checks app_identity for (bundle_id, label),
  then identity_conflicts for unresolved entries. Returns { trusted, reason }.
  Wired into: POST /patch (Fruit, hard refusal when bundleId present), /bushel
  (hard refusal), /branch and /orchard (per-app skip -- batch ops skip untrusted
  apps, don't abort). Branch/Bushel/Orchard handlers now select a.bundle_id.
  GAP: Catalog deploys (label-only path, no bundleId) skip isIdentityTrusted().
  Partially addressed by label-level conflict check in the else branch -- see
  Catalog identity guard section below.

Checkin curated override (commit 59264c2):
  /checkin handler now looks up app_identity for a curated=true row before writing
  installomator_label to apps table. Curated label (may be NULL) overrides the
  agent-reported value. db.js startup also syncs existing apps rows to curated
  identity via UPDATE on every deploy. Together these mean Jude's old agent can
  keep sending jetbrainspycharm for CE and the server silently overrides with NULL.

Version hero state fix (frontend 6bb00fe):
  "Up to Date with the Vendor" was rendering inside the patchable block (next to
  the Patch button), producing contradictory UI. Now exclusively inside the
  current state block. One occurrence in codebase.

PHASE 1 DONE CRITERIA (all met as of June 26):
  - source=mas apps cannot hold a derived label or cask
  - No homebrew_cask or installomator_label held by 2+ distinct non-curated
    bundle IDs (both collision queries return 0 rows -- verified)
  - identity_conflicts table exists and records refusals (10 rows)
  - 6 curated rows in place (curated rows 6, resolved conflicts 9,
    unresolved non-orphan 0 -- verified)
  - Patch against untrusted/ambiguous identity refused at server
  - PyCharm Pro: unchanged and correct
  - Teams: did NOT trip the detector (token not name) -- validates detector design
  UI verification: PyCharm CE is not installed on Jude's machine. Server-layer
  correctness confirmed via direct queries. UI verification deferred until CE
  is naturally present on a fleet device.

GENERAL MODEL REMAINS OPUS: Phase 1 fixes the 4 known families. How derivation
distinguishes variants in general, how curated rows cover the tail, and how the
curated corpus works at multi-tenancy (global vs per-org) is still an Opus Deep
Dive. CURATION IS THE DESIGN, not a workaround: both Jamf (paid team,
bundle-ID-anchored definitions, ~700-800 titles) and Installomator (volunteer
team, name-keyed fragments) curate, because heterogeneous vendors + no standard
version API + same-named variants do not admit a fully-derived solution. The
collision detector hands us the worklist automatically. (See Competitive section.)

## Key design constraints
- Works in BeyondTrust / privilege management environments
- No sudo required -- LaunchDaemon runs as root
- No MDM conflicts -- agent pattern same as Jamf/Mosyle/Kandji
- Installomator is the only patch mechanism (1,137 label rows as of June 12
  catalog sync -- NOTE: this count includes phantom case aliases from the catalog-
  sync parser bug; real deployable label count is lower. See open items.)
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

## Patch modal copy standard (established June 25, updated June 26)
All four modals have a quiet tier name footer below the action buttons.
Style: fontSize 11, var(--text-tertiary), textAlign center, marginTop 8.
Teaches vocabulary without forcing it.

- Fruit: "Patch by the Fruit · Single App, Single Device"
- Branch: "Patch by the Branch · All Outdated Apps, Single Device"
- Bushel: "Patch by the Bushel · Single App, All Devices"
- Orchard: "Patch by the Orchard · All Outdated Apps, Entire Fleet"

Modal titles:
- Fruit (apps/[id]): "Patch {app.name}" (dynamic app name)
- Fruit (devices/[id]): "Patch {patchTarget.appName}" (dynamic)
- Branch: "Patch Device"
- Bushel: existing (app name in header)
- Orchard: "Patch the Fleet" (updated June 26 -- was "Patch by the Orchard")

## Orchard card copy (Dashboard, locked June 26)
- Card header: "OrchardPatch" (NOT "Patch by the Orchard")
- Subtitle: "Queue Patches Across Your Entire Fleet"
- Rationale: the product name on the flagship fleet-wide action is intentional.
  The card IS the reason the product is named OrchardPatch. The Orchard tier
  name still appears in the modal footer as the quiet vocabulary teacher.

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

## Competitive: how the category handles identity (researched June 26)
- **Jamf App Catalog.** Human-curated, BUNDLE-ID-ANCHORED patch definitions
  (~700-800 titles, maintained by a paid team). A definition separates "what is
  this app" (detection criteria, bundle-ID-keyed, PER-VARIANT) from "how to
  install it." That detection layer is exactly what Installomator lacks and what
  OrchardPatch is retrofitting. The variant collision is the seam where
  Installomator's name-keyed model meets the bundle-ID-keyed model we need.
- **Jamf Title Editor.** Jamf's custom EXTERNAL patch source, built on Kinobi
  (Mondada, acquired by Jamf 2021). It is the seam that lets shops run
  Installomator-for-installs + Jamf-for-compliance (the Marriott Library/Utah
  pattern: Installomator does silent installs, Title Editor feeds patch
  definitions into the Jamf compliance dashboard). PROOF the gap OrchardPatch
  fills is real enough that Jamf productized a bridge for it. OrchardPatch
  proposes to be both halves in one tool. Read how Title Editor structures its
  definitions before leaning on this in outreach.
- **CONCLUSION: curation IS the design, not a workaround.** Both authoritative
  players curate -- Jamf with a paid team, Installomator with a volunteer team
  that requires appNewVersion documentation in every PR. Heterogeneous vendors +
  no standard version API + same-named variants do not admit a fully-derived
  solution. OrchardPatch's curated identity corpus is the same architecture the
  category leader uses; the collision detector hands us the worklist
  automatically. This reframes "we have to curate" from compromise to correct
  design.
- **Installomator maintainers have hit same-name collisions** (VirtualBox vs
  BoxDrive, Parallels-bundled Edge found by Spotlight). They solved it at
  install-DETECTION (app-location criteria), not at cataloging. The variant
  problem is FAMILIAR to them, not foreign -- useful relationship context for
  outreach.

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
- CONTEXT.md handoff workflow (locked June 25): Jude attaches CONTEXT.md to
  Chip at session end. Chip saves to disk at
  ~/Projects/orchardpatch-server/CONTEXT.md and commits. Next session Chip
  reads directly from disk -- no Telegram relay, no truncation risk.
  Claude.ai project file stays in sync as the source of truth for Claude
  sessions (upload after Chip commits).
- OpenClaw UI indicator: "Pearling" is an OpenClaw processing indicator that
  appears while Chip is thinking/streaming and disappears when done. Not a
  model identifier. Chip confirmed running anthropic/claude-sonnet-4-6.
- OpenClaw failure mode (seen June 26): "LLM request failed: provider rejected
  the request schema or tool payload" can loop -- Chip echoes the error to every
  message and stops processing input. Recovery: stop sending messages, restart
  the OpenClaw session, check OpenClaw logs for the underlying provider error
  if a fresh session still fails. Often a too-large request payload; split the
  prompt if so.
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
- Standing rule (NEW June 26): any regex bound for PostgreSQL must have EVERY
  backslash DOUBLED in the JS source. Single-quoted JS strings and template
  literals silently drop unrecognized escape sequences (\s \( \) \d \w) with
  no error, and throw "octal escape" at startup for \1-class sequences. Use
  [0-9] not \d, \\1 not \1, \\s \\( \\) \\. not \s \( \) \. Same failure class
  as the Python-heredoc hazard. ALWAYS verify the regex with a direct query
  against real data, never by eyeballing the source.
- Standing rule (NEW J
