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
  | Bundle ID                | Label                     | Cask            |
  | com.jetbrains.pycharm    | jetbrainspycharm          | pycharm         |
  | com.jetbrains.pycharm.ce | NULL                      | pycharm-ce      |
  | com.microsoft.teams      | microsoftteams            | NULL            |
  | com.microsoft.teams2     | microsoftteams-rollingout | microsoft-teams |
  | com.canva.CanvaDesktop   | canva                     | canva           |
  | ru.keepcoder.Telegram    | telegram                  | telegram        |
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
- Standing rule (NEW June 26): SQL strings embedded in JS that contain literal
  string values must use escaped inner quotes or a different outer delimiter.
  Single quotes inside single-quoted JS strings terminate the string silently
  (no parse-time error, just a SyntaxError at module load). Pattern: outer
  single quotes with inner \'value\', or use double quotes as outer delimiter.
  Confirmed crash: catalog-sync.js had WHERE source = 'installomator_label'
  inside a single-quoted string -- Railway crash-looped until fixed (27d8b00).
- Standing rule (NEW June 26): when a fix does not take, run a diagnostic query
  against runtime data BEFORE writing the next fix. The zoom.us bug hid under
  four commits because each fix looked correct in source while runtime was
  wrong. One direct query found it in minutes.
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
- device-GJM7N0XGL0: Jude's MacBook Pro (Mac16,1 · macOS 26.4 / 27.0 reported)
- device-C02D52QTML85: Chip's MacBook Pro (MacBookPro16,2 · macOS 26.3.2 ·
  ~72 apps · 2020 13" 2.3GHz Quad-Core Intel i7 16GB)
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
  Phase 1 agent (catalog.js MAS gate): deployed to Chip's machine (993a8d0).
  Jude's machine still running pre-Phase-1 catalog.js -- server-side curated
  override handles stale label reports. Update at next natural deploy.
- Known MAS apps on Jude's machine: ASUS Device Discovery, Bitwarden, Canva,
  Darkroom, DaVinci Resolve, Developer, Slack, Telegram, Trello, Word (10)
  NOTE: Slack and Telegram on Jude's machine are MAS -- Patch button hidden.
  Slack on Chip's machine is direct download -- Patch button shown.
  DaVinci Resolve is MAS on Jude's machine; may be direct download on others.
- Known outdated apps on device-C02D52QTML85: Ollama (large, avoid as test
  target), Slack (in active use, avoid), Telegram (curated to telegram label)
- Fleet apps confirmed installed (June 26 diagnostics):
  - 1Password: bundle com.1password.1password, label 1password8, BOTH devices
    at 8.12.22. See 1Password staged-rollout note in Open items.
  - PyCharm (Pro): bundle com.jetbrains.pycharm, label jetbrainspycharm,
    Jude's machine, 2026.1.3, current.
  - PyCharm CE: bundle com.jetbrains.pycharm.ce, NOT installed on Jude's
    machine (only PyCharm.app/Pro at ~/Applications). Stale DB row ages out
    with soft-delete. Phase 1: curated to label NULL, cask pycharm-ce.
  - zoom.us: bundle us.zoom.xos, label zoom, both devices 7.1.0 (83064),
    patchable 7.1.0.83064. Now correctly Current after June 26 fix.

## DB schema (key tables)
- devices: id, hostname, device_id, last_seen, agent_version, agent_url
  (nullable)
- apps: id, device_id, bundle_id, name, version, latest_version (legacy/
  null), is_outdated (legacy/always 0 -- do not use), installomator_label,
  path, source
  source values: 'user' (third-party, patchable), 'system' (Apple-managed),
  'mas' (Mac App Store install, not patchable via Installomator) -- NEW Phase A
  last_seen TIMESTAMPTZ -- NEW (soft-delete, designed June 26, not yet shipped).
  Set to now() for every app in every check-in payload (one clause in the ON
  CONFLICT upsert). Removal is DERIVED, never a DELETE: an app is "removed" when
  apps.last_seen < devices.last_seen by at least N successful check-in cycles
  (start N=3). Keyed on CYCLES not wall-clock so a sleeping laptop doesn't read
  as uninstalled. WHY soft not hard: the agent's per-directory inventory loop
  uses catch{continue} silently, so a failed readdirSync sends a zero-app payload
  indistinguishable from "user uninstalled everything." A hard prune on payload
  would wipe a device's whole inventory on one partial payload. Soft-delete makes
  that a non-event AND gives fleet app-history (appeared/removed) which fits the
  security positioning. Migration initializes last_seen=now() for all existing
  rows (steady state in one cycle; the com.tdesktop.Telegram orphan ages out over
  N cycles). HARD REQUIREMENT: the removal predicate must be threaded into EVERY
  count and "current fleet" list, especially the canonical /api/stats/patch-status
  CTE -- one predicate definition applied everywhere counts happen, or a
  removed-but-once-outdated app inflates counts forever (the "verify status-bar
  math after any category change" rule; removal IS a category change).
- latest_versions: label (PK), latest_version, last_checked, error
  STATUS: 34/47 populated as of June 22.
  INGEST IS NULL-SAFE (commit d96ea73): the ON CONFLICT upsert guards
  latest_version with CASE WHEN EXCLUDED.latest_version IS NOT NULL AND <> ''
  THEN EXCLUDED ELSE existing. error and last_checked always update. A failed
  check records its error against the last-known-good version instead of
  wiping it.
  CAVEAT (June 26): null-safe ingest means a once-captured value (e.g.
  1password8 = 8.12.24) persists even when the vendor's download URL is serving
  an older build. This is correct for resilience but interacts with vendor
  staged rollouts -- see 1Password note in Open items.
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
  NOTE (June 26): no API endpoint exposes the full resolved_versions row
  (source, candidates, conflict, resolved_at). Only latest_available surfaces,
  via /apps/status. Consider a read endpoint if resolver debugging recurs.
  CRITICAL TWO-LAYER DISTINCTION (June 26): resolved_versions.conflict is the
  VERSION-layer record -- it catches same-identity multi-SOURCE disagreement
  (Homebrew says X, Sparkle says Y for the SAME bundle_id). It CANNOT catch
  variant collision, because variant collision destroys the evidence before the
  resolver runs (PyCharm CE only ever had ONE candidate, from the wrong cask, so
  the resolver correctly saw no conflict -- conflict=false on a wrong answer).
  Variant collisions are recorded in identity_conflicts (below), the
  IDENTITY-layer record. Do NOT conflate them. Fixing the
  resolved_versions.conflict normalization gap (the separate Sonnet cleanup) does
  NOTHING for variant collisions.
- identity_conflicts: id SERIAL PK, bundle_id TEXT, source TEXT
  ('homebrew_cask' | 'installomator_label'), token TEXT (the contested
  cask/label), competing_bundle_ids TEXT[], detected_at TIMESTAMPTZ DEFAULT
  now(), resolved BOOLEAN DEFAULT false -- SHIPPED June 26 (Phase 1). When
  the collision detector refuses a token (claimed by 2+ distinct non-curated
  bundle IDs), it inserts one row per affected bundle_id.
  Current state: 10 rows, 9 resolved=true, 1 false (com.tdesktop.Telegram
  orphan -- intentional, ages out with soft-delete + conflict auto-resolution).
  Unique index on (bundle_id, source, token) -- idempotent inserts.
  This IS the curation worklist + debug surface. It does NOT gate anything by
  itself -- the gating already happened when the token was nulled. Ambiguity
  attaches to a (bundle_id, source) PAIR, not the whole identity row, which is
  why it lives in its own table rather than as a boolean on app_identity (CE's
  Homebrew mapping can be ambiguous while a future intrinsic Sparkle signal stays
  valid). resolved flips true when a curated row supersedes it OR when the
  conflict auto-resolution pass confirms the token is no longer contested.
  CRITICAL: the collision detector currently only asserts conflicts, never clears
  them. The conflict auto-resolution pass (part of soft-delete design) must run
  after each detector pass and mark resolved=true for any token no longer
  contested in app_identity. Without this, the Telegram deploy button stays
  blocked permanently after the orphan ages out.
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
  Known exit codes in DB: 0 (success), 8 (app name mismatch -- Installomator
  installed something but couldn't find the expected app name; surfaced by
  running jetbrainspycharmce which is a phantom alias), 11 (checksum mismatch),
  16 (download error), 23 (MAS), null (queued/cancelled -- never ran).
  NOTE (June 26): exit 0 with "No new version to install" in the log is a
  distinct outcome from a true update. The status derivation does NOT currently
  consult this. The proposed patch-outcome-aware state feature (Open items)
  would persist this outcome somewhere the status query can read it.
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
  Phase 1 (commit 59264c2): before writing installomator_label to apps table,
  looks up app_identity for a curated=true row for that bundle_id. If found,
  uses the curated label (even if NULL) instead of the agent-reported value.
  Collision detector (runCollisionDetector()) called post-write.
- GET /devices -- fleet list with outdated_count (latest_versions join).
  June 26: outdated_count now applies the 3-layer normalization and excludes
  system/mas apps.
- GET /apps -- raw app rows (do not use for status -- use /apps/status)
- GET /apps/status?device_id= -- patch status per app with cache_age_seconds.
  Returns source field as of Phase A. patch_status values: 'outdated',
  'current', 'unknown', 'na'. Phase B: added WHEN a.source='mas' THEN 'na'
  to CASE. June 25: LEFT JOIN resolved_versions added; latest_available now
  returned. June 26: full 3-layer normalization with doubled backslashes in
  the CASE comparison (zoom.us root-cause fix).
- GET /stats -- fleet stats. NOTE: still computes outdated independently; not
  yet migrated to the canonical patch-status source. Lower priority.
- GET /api/stats/patch-status -- NEW June 26. Canonical fleet-wide status
  counts. DISTINCT ON CTE dedup by bundle_id, worst-case-wins, 3-layer
  normalization. Returns { outdated, current, unknown, system, store, total }.
  THE single source for status counts across surfaces.
- POST /patch -- queue a Fruit patch job. Writes both tables atomically.
  NOTE (Phase 6): silent mode withholds pending_patches for 15s undo window.
  Required body: deviceId, label, appName. Optional: bundleId, mode.
  Response: { ok, id, deviceId, label, appName, createdAt }.
  Phase 1: if bundleId provided, isIdentityTrusted() check fires before write
  (403 if untrusted). If no bundleId (catalog deploy path): label-level conflict
  check against identity_conflicts fires instead (403 if unresolved conflict).
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
- GET /api/catalog -- browse catalog, ?search= supported, pagination.
  Phase 1 / catalog guard: now includes has_conflict boolean per row via LEFT
  JOIN on identity_conflicts (source='installomator_label', resolved=false).
  Current live effect: telegram label has_conflict=true (orphan conflict).
- GET /pending-commands?device_id= -- agent polls for unclaimed commands
- POST /pending-commands/:id/claim -- conditional claim, returns 409 if lost
- POST /pending-commands/:id/complete -- persists result, always 200 (idempotent)
- POST /api/force-checkin -- enqueues check_in command. Body: { deviceId }.
  Validated against ENQUEUE_ALLOWED. Returns 201 { ok, id }.

## Next.js proxy routes (frontend)
All proxy routes use FLEET_SERVER_TOKEN (non-public, server-side only).
Return 503 if env var missing. 15 routes total as of June 26.
- /api/patch -- forwards to POST /patch
- /api/patch-jobs -- forwards to GET /patch-jobs
- /api/patch-jobs/branch
- /api/patch-jobs/bushel
- /api/patch-jobs/orchard
- /api/patch-jobs/[id]/cancel
- /api/stats
- /api/stats/patch-status -- NEW June 26. Forwards to GET /api/stats/patch-status.
- /api/devices
- /api/apps/status
- /api/catalog
- /api/fleet/status
- /api/fleet/apps/[id] -- returns latestAvailable (added June 25, extracted
  from latest_available via LEFT JOIN resolved_versions on the server)
- /api/fleet/devices/[id]
- /api/force-checkin -- Phase 6. Forwards to POST /api/force-checkin.
NOTE (Phase 6): mode-based deferred-enqueue policy (silent = 15s window) lives
in the server POST /patch handler. The proxy passes mode through as-is.

## Feature status

### Phase 1 multi-variant identity fix -- SHIPPED June 26, 2026
All 5 parts across 4 relays + 2 follow-up fixes. See Multi-variant identity
section above for full detail. Commits: a3abd19, f4a2011 (server relay 1),
993a8d0 (agent relay 1), 6e84fa9 (relay 2), relay 3 (curated rows in db.js),
24940fb (relay 4 patch guard), 59264c2 (checkin curated override),
6bb00fe (frontend version hero state fix).

### Catalog deploy identity guard -- SHIPPED June 26, 2026
Problem: Catalog deploys go through POST /api/patch with label only, no bundleId.
The phantom label jetbrainspycharmce was deployable from the Catalog and crashed
with exit 8 ("Unable to find application named 'PyCharm CE.app'") because it is
a case alias routing to Pro's install logic.

Server (commit 9ee2670):
- Label-level conflict check in the else branch of POST /patch (catalog path):
  queries identity_conflicts for unresolved rows where token=label and
  source='installomator_label'. Returns 403 if any found.
- has_conflict boolean added to GET /api/catalog via LEFT JOIN on
  identity_conflicts. CRASH: inner 'installomator_label' single quotes inside
  outer single-quoted JS string terminated the string early, crash-looping
  Railway. Fixed by escaping inner quotes with \' (commit 27d8b00).

Frontend (commit 1096270):
- Deploy button disabled when has_conflict=true: opacity 0.4, cursor not-allowed,
  pointerEvents none, title tooltip explaining the block.

Live side effect: telegram label shows has_conflict=true (com.tdesktop.Telegram
orphan is the unresolved conflict). Deploy button disabled for telegram. CORRECT
behavior -- clears automatically when soft-delete ships and the conflict
auto-resolution pass marks the row resolved=true.

REMAINING GAP: isIdentityTrusted() requires bundleId. Catalog deploys have none.
Label-level conflict check is the safety net for the catalog path. Full fix:
look up bundle_id by label from app_identity before queuing. Filed as open item.

### Branch-patch fallout + version-sourcing session -- June 26, 2026
Started from a Branch patch producing inconsistencies, ended with the zoom.us
loop fixed at root cause and several real bugs diagnosed and routed.

**Shipped:**
- zoom.us false-positive RESOLVED. Root cause: JS dropped backslashes in the
  parenthetical-strip regex, PostgreSQL got `s*([^)]*)` and stranded the
  closing paren. Fixed by doubling backslashes across all 6 occurrences in 3
  queries (server commit e513e8c). Verified via direct DB diagnostic.
- Crash-loop fixed. An earlier zoom fix put `\1` in a JS template literal
  (illegal octal escape), crashing server startup. Fixed by escaping to `\\1`
  and `\d` -> `[0-9]` (server commit 51786b1).
- Canonical patch-status counts endpoint (server 30bff86, frontend 65eab7c).
- normalizeVersion consolidated to utils.ts, gained 3-segment truncation,
  apps/[id] local copy removed (imports from utils).
- Raw version display: hero card and fleet rows show full raw strings,
  normalize only for state derivation.
- Devices list outdated_count normalized + excludes system/mas.
- Orchard card title "OrchardPatch" + modal title "Patch the Fleet" (the
  pending copy task from the prior handoff -- landed this session).

**Diagnosed, NOT a bug (do not fix):**
- 1Password "outdated -> no new version" loop. Both pipelines agree on 8.12.24.
  The 1password8 label downloads from an UNVERSIONED URL
  (downloads.1password.com/mac/1Password.pkg) still serving 8.12.22 at patch
  time. Vendor staged rollout: published 8.12.24 to versioned distribution + API
  (scraper and Homebrew both catch it) but hasn't flipped the unversioned pkg
  pointer. Self-resolves. DEMO NOTE: do not patch 1Password live until the
  pointer flips, or it reproduces on camera.

### Console redesign -- SHIPPED (merged to main June 25, 2026)
Branch design/liquid-glass merged via fast-forward. Was tip 45aa6b6 at merge.
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
- Tokens added June 25: --surface-raised (#ffffff light /
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
- dropdown-menu.tsx: zIndex 9999 on Positioner inline; --surface-raised
  (opaque) background on Popup; callerStyle destructured and merged after base
  styles; item padding inline (6px 8px); animation-only Tailwind kept in
  className.
- select.tsx: same pattern.
- table.tsx: TableHead and TableCell inline padding 10px 12px to replace purged
  Tailwind p-2/px-2. Style set before {...props} so callers win on conflict.

**Mechanical conversions (shipped June 24):**
All converted from hardcoded hex + Tailwind layout classes to CSS variable
tokens + inline style props: patches/page.tsx, catalog/page.tsx,
devices/page.tsx, fleet/page.tsx, reports/page.tsx, settings/page.tsx +
sub-pages, alerts/page.tsx, orchard/page.tsx, login/page.tsx,
integrations/page.tsx, HomePageInner.tsx, AppCard.tsx, PatchStatusBadge.tsx,
SearchBar.tsx, AgentBanner.tsx, VersionChart.tsx, VersionChartWrapper.tsx,
Sidebar.tsx (ThemeToggle in footer).

**Dashboard (/dashboard) -- COMPLETE (June 25, updated June 26):**
- 5 metric cards: clickable, link to /apps?status= (outdated, current, unknown,
  system, mas). June 26: counts now from canonical /api/stats/patch-status.
- Top outdated app rows: clickable, link to /apps/[bundle-id-slug].
- Fleet health donut: five segments. Legend five clickable rows.
- statusCounts now server-computed (client-side dedup removed June 26).
- Sync now button: silent stats refresh. Hides while in flight.
- ThemeToggle: sidebar footer only.
- overflow: hidden removed from cardStyle.
- Orchard card: header "OrchardPatch", subtitle "Queue Patches Across Your
  Entire Fleet", modal title "Patch the Fleet" (June 26).
- Orchard button corner clip RESOLVED: transform: translateZ(0) forces own
  compositing layer, escaping WebKit backdrop-filter stacking-context clip.

**App Inventory (/apps) -- COMPLETE (June 25, partial June 26):**
- PATCH STATUS bar: dot indicators, five categories, now from canonical
  /api/stats/patch-status.
- Title "App Inventory", subtitle "Fleet-Wide Software Detection Across All
  Managed Devices".
- Dropdowns: --surface-raised opaque, zIndex 9999, callerStyle merge.
- KNOWN INCOMPLETE: old "Version Conflicts" stat card NOT removed -- still shows
  alongside the new bar. Filed Sonnet cleanup.

**App detail (/apps/[id]) -- COMPLETE (June 25, updated June 26):**
- latest_available surfaced via server LEFT JOIN. Returned as latestAvailable.
- normalizeVersion imported from utils (local copy removed June 26).
- versionGt: directional segment comparison for lagging.
- Resolver state derivation: unknown / patchable / lagging / current. Both
  sides normalized for comparison; raw strings shown in display (June 26).
- Fleet aggregate installed: single if uniform, range ("131.0-132.0") if
  diverged.
- Version hero card, four states with progressive disclosure (current /
  patchable / lagging / unknown). Lagging is calm: restrained red, factual gap
  line, thin accent bar, Installomator-safe wording, no banners.
- Fleet installations card: conditional action column (Patch to X / On Newest
  Patchable / App Store).
- Fruit modal title "Patch {app.name}", footer "Patch by the Fruit · Single
  App, Single Device". Bushel footer "Patch by the Bushel · Single App, All
  Devices".

**Device detail (/devices/[id]) -- COMPLETE (June 25):**
- Full token conversion, zero hardcoded hex.
- Section header "APPS DETECTED", subtitle "{n} Installed · {n} Outdated".
- Force Check-In button: idle / success / error states, "Results Appear Within
  60 Seconds" note, auto-clears after 3s.
- Patch All Outdated button: right-aligned above PATCH column.
- Branch modal title "Patch Device", footer "Patch by the Branch · All Outdated
  Apps, Single Device". Orchard footer "Patch by the Orchard · All Outdated
  Apps, Entire Fleet".

**Known deferred issues:**
- Lagging state not yet verified with real fleet data. Logic correct. True
  lagging requires vendor ahead of Installomator. Firefox showed false lagging
  (Homebrew behind Installomator) which the directional fix resolved.
- Title case audit not yet applied to Patch History, Catalog, Devices list,
  Settings pages. Follow-up pass.

### Shipped (Phase C -- June 23, 2026)
- Sparkle resolver (2/3 feeds). GitHub resolver (infra ready, 0 entries).
  Multi-source coordinator (parallel, trust-ranked, conflict flag). Candidate
  recording in resolved_versions.candidates JSONB. Agent SUFeedURL ->
  sparkleFeedUrl. Checkin guard broadened. sparkle_feed_url in app_identity.

### Shipped (Phase B -- June 23, 2026)
- Homebrew resolver (30/36 matched). resolved_versions populated (30 rows,
  daily cron). patch_status MAS SQL fix. App Store status bar category.
  Staleness sweep type cast fix.

### Shipped (Phase A -- June 22, 2026)
- app_identity table. resolved_versions table. download_url on app_catalog.
  Identity bootstrap. source field in /apps/status. MAS detection in agent.
  Patch button hidden for MAS apps.

### Earlier shipped (condensed)
- June 22: Phase 6 verified both machines. GITHUB_TOKEN secured to config.json.
  Patch History UI overhaul (flat list, formatDateTime, TL;DR, exit-code maps).
- June 23: Phase 6 force check-in (fast/slow loop split, pending_commands,
  staleness sweep, deferred enqueue, undo affordance).
- June 21-22: Waitlist page overhaul.
- June 16: Phase 4 Installomator self-update via catalog. Phase 5 token
  lockdown (all calls through proxy). Catalog pagination. version-checker
  rewrite (async spawn, early-kill, 12s backstop). Null-safe ingest.
  app.orchardpatch.com custom domain.
- June 13: Phase 1-3 job id-threading fix, agent deploy, Software Catalog.
  Token rotation + hardcoded fallback removal.
- Previously: Dashboard, App Inventory, App detail, Device list/detail, Patch
  History, Branch/Bushel/Orchard modals, cancel buttons, auth wall.

### Not yet built (priority order)
0. **Soft-delete app lifecycle (Sonnet, LOCKED design in apps-table schema note).**
   IMMEDIATE NEXT IMPLEMENTATION WORK. Ship last_seen column + upsert clause
   EARLY (cheap, starts accumulating history immediately; every day waited loses
   removal events). Derivation + UI follow. Directory-loop logging rides along.
   CRITICAL DEPENDENCY: must include conflict auto-resolution pass in the
   collision detector. After each detector run, check all unresolved
   identity_conflicts rows and mark resolved=true for any token no longer
   contested in app_identity. Without this, the Telegram deploy button stays
   blocked permanently after the orphan ages out. Build this INTO the soft-delete
   relay, not as a follow-up.
1. Demo video + polished repo. Lagging state is the demo differentiator --
   feature it prominently. Also show clickable dashboard, resolver states
   across different apps, the Patch by the Orchard flow. zoom.us is now a clean
   Current example. AVOID patching 1Password live (rollout lag).
2. Outreach (MacAdmins Slack + contribution-first Installomator maintainer
   contact). coconutBattery HTML response is the confirmed bug report opener.
   Framing assets: "Installomator compares for difference not direction, we add
   the directional lagging comparison" and "curation is the design, same as Jamf."
-- Then the backlog below, still valid, lower priority --
3. "Version Conflicts" cleanup on App Inventory (Sonnet): remove stale card,
   fix resolver conflict-comparison normalization. VERIFY with a query. NOTE: this
   does NOT touch variant collisions (different layer -- see identity_conflicts).
4. Catalog-sync case-alias parser fix (Sonnet): skip alias-only case entries,
   remove phantom labels from app_catalog, fix inflated label count. Confirmed
   with real failure: jetbrainspycharmce deployed from Catalog produced exit 8.
5. Catalog deploy bundleId guard (Sonnet): look up bundle_id by label from
   app_identity before queuing, enabling full isIdentityTrusted() check on
   the catalog path (not just the label-level conflict check).
6. Multi-variant identity GENERAL model (Opus): Phase 1 handles the 4 known
   families; the general derivation/curation/multi-tenancy model remains Opus.
   Includes DaVinci MAS/free and multi-source precedence (parked, with the
   available-pipeline-only hard constraint). Telegram Opus item CLOSED.
7. Patch-outcome-aware state (Opus): surface "no new version at patch time"
   without collapsing the lagging differentiator. Persist patch-attempt outcome
   where status derivation can read it.
8. Phase E -- server-side patchable resolution (Opus): retire the per-agent
   early-kill scrape; resolve patchable by reading label version sources
   server-side. Perfect-world target captured above. MUST honor each label's
   versionKey (see Version normalization). PREP TASK: produce
   installomator-reference.md (derived, dated engineering reference of
   Installomator documented behavior -- NOT a raw doc dump; each entry is
   behavior + OrchardPatch implication + canonical URL + last-verified date).
   Build it in the SAME session that opens the Phase E Deep Dive so it is fresh
   in the context that uses it. Reading pass: valuesfromarguments, full
   label-variable list incl. arch splits, the assemble process. Same treatment
   for a Title Editor teardown (competitive).
9. Phase 7: Force reinstall in catalog modal (UNINSTALL=1).
10. Installomator version + Update button on device detail.
11. Agent update mechanism -- pkg build pipeline. PRE-LAUNCH GATE. Opus Deep
   Dive (pkg pipeline vs server-pushed self-update).
12. Agent token rotation product feature.
13. method='fruit' hardcode cleanup in POST /patch-jobs.
14. Bushel modal pre-count cosmetic fix.
15. MAS app exclusion from Branch/Bushel/Orchard queues.
16. "Clear by status" bulk action in Patch History.
17. Pinned Apps on Dashboard (needs preferences table).
18. Automated catalog-sync schedule.
19. Cultivation / policy-based auto-remediation.
20. Multi-tenancy. PREREQUISITE for mutating pending_commands.
21. SSO / proper auth. PREREQUISITE for mutating pending_commands.
22. Graph reports, CLI/Homebrew tap, mas CLI integration.
23. Title case audit on Patch History, Catalog, Devices list, Settings pages.
24. GET /stats migration to canonical patch-status source.

## Open items / tech debt
- **Conflict auto-resolution gap (Sonnet, rides with soft-delete).** The
  collision detector nulls and records but never clears. When soft-delete removes
  an orphan from app_identity, the detector must also mark identity_conflicts
  resolved=true for any token no longer contested. Without this the Telegram
  deploy button stays permanently blocked after the orphan ages out. Must be
  built into the soft-delete relay, not deferred.
- **Catalog-sync case-alias artifact (Sonnet, CONFIRMED with real failure).**
  catalog-sync treats case aliases inside a fragment (e.g. jetbrainspycharmce
  inside jetbrainspycharm.sh) as distinct deployable labels. Deploying
  jetbrainspycharmce from the Catalog produced exit 8 ("Unable to find
  application named 'PyCharm CE.app'"). The alias routes to Pro's install logic,
  which installs PyCharm.app not PyCharm CE.app. Inflates catalog count (1,137
  includes phantom aliases). Fix: parser must not emit alias-only entries.
- **Catalog deploy bundleId gap (Sonnet).** Catalog deploys are label-only;
  isIdentityTrusted() requires bundleId. Label-level conflict check is the
  current safety net. Full fix: look up bundle_id by label from app_identity
  before queuing, enabling the full guard on the catalog path.
- **Jude's agent old version (low urgency).** device-GJM7N0XGL0 runs old
  catalog.js without the MAS gate (catalog.js gate, relay 1). Server-side
  gates handle it correctly. Update at next natural deploy opportunity.
- **Resolver conflict count inflated + stale card (Sonnet).** "13 Version
  Conflicts" on App Inventory: (a) the stale card should have been removed in
  the canonical-counts work and wasn't; (b) the resolver conflict comparison in
  resolver-cron.js doesn't normalize before comparing, flagging format-only
  differences. Fix both. Verify with a direct query.
- **Patch-outcome-aware state (Opus, new feature).** See Not-yet-built #7.
  Must not collapse into the lagging state. Needs patch-attempt outcome
  persisted where status derivation can read it (patch_jobs has the log but the
  status query doesn't consult it).
- **Phase E patchable resolver (Opus).** See Patchable pipeline architecture.
  The early-kill scrape is the wrong shape; the 1Password rollout-lag case shows
  the patchable number can be optimistic vs the actual download URL even when
  the scrape is correct.
- **1Password staged rollout (monitor, not a bug).** Self-resolves when the
  vendor flips the unversioned pkg pointer to 8.12.24.
- **AGENT UPDATE MECHANISM -- PRE-LAUNCH GATE.** No pkg build pipeline. Current
  process is manual file copy + bootout/bootstrap. Required before real users.
  Approach decision (signed pkg vs server-pushed self-update via
  pending_commands) belongs in Architectural Deep Dives.
- **Unidentified Sparkle feed failure.** 3 apps sent a sparkleFeedUrl; 2 parsed.
  The 1 failure is silently caught and logged per app. Identify which and why.
- **downloadURL regex partial captures.** Regex stops at '$', so a URL with
  ${appNewVersion} captures a partial prefix rather than null. Phase C validates
  captured URLs before use, so partials fail gracefully. Tighten when
  download_url values start being consumed.
- **Identity bootstrap startup race.** Migration (CREATE TABLE) runs as a side
  effect of require('./db') and is not awaited in server.js. bootstrapIdentity
  could run before CREATE TABLE on a cold DB. try/catch catches it; next trigger
  succeeds. Fix when migration is refactored to be explicitly awaited.
- reportPatchJob() / waitForJob() in the scheduler: unreachable dead code.
- KNOWN RACE in deferred enqueue: ~1ms window between SELECT status and INSERT.
  Documented in code. Fix before multi-tenancy: wrap in FOR UPDATE transaction.
- postinstall script installs Installomator to /usr/local/bin/ -- conflicts with
  pkg convention. Fix or remove.
- method='fruit' hardcode in POST /patch-jobs INSERT VALUES. Safe but dirty.
- DB indexes: none on fleet queries or pending_commands. Fine at 2 devices.
- agent_url column: unused, reserved for future server-initiated flows.
- Last-known-good version held forever: staleness policy deferred to resolver.
- GITHUB_TOKEN scoped to all public repos -- tighten to Installomator repo at
  next rotation (renewed May 12, 2026).
- **Double enrichAppsWithLabels() (Sonnet, trivial).** Called twice per check-in
  (once in scheduler.js before checkinToServer, once inside checkinToServer).
  Harmless if idempotent (wasted work), latent bug if not. Dedupe to one call.
- **Directory-loop silent catch (Sonnet, rides with soft-delete).** The agent
  inventory scan's per-directory and per-app loops use catch{continue} with no
  logging. A /Applications readdirSync failure is invisible. Add logging
  regardless of prune mechanism -- pure observability fix.
- **Multi-source precedence selection (Opus, PARKED).** Admin-chosen precedence
  ACROSS available sources (Homebrew/Sparkle/GitHub), per-org. HARD CONSTRAINT:
  operates strictly within the `available` pipeline; can NEVER substitute a
  `patchable` source for an `available` one. Letting an admin pick "Installomator
  as my up-to-date reference" would zero the available/patchable gap by
  construction and kill the lagging state (the differentiator). Multi-tenancy-
  tier feature; rides with the curated-corpus multi-tenancy decision. (Raised by
  Jude June 26; reframed to preserve the two-number model.)
- **Multi-variant identity general model (Opus).** Phase 1 fixes the 4 known
  families. The general derivation/curation/multi-tenancy model remains an Opus
  Deep Dive. Same class: DaVinci MAS/free. Telegram Opus item CLOSED (curated
  to telegram label via primary-source verification).

## Known label-matching issues
- coconutBattery: label scrapes coconut-flavour.com, gets HTML back. Upstream
  Installomator bug. Maintainer outreach opener. NOTE: now resolves via Homebrew
  (latest_available = 4.3.3). Patchable pipeline still broken; available works.
- Telegram: ru.keepcoder.Telegram correctly curated to telegram label (Phase 1).
  com.tdesktop.Telegram is a stale orphan on Chip's machine -- ages out with
  soft-delete. Telegram Catalog deploy blocked (has_conflict=true) until then.
- PyCharm CE: correctly NULLed label, pycharm-ce cask (Phase 1 curated row).
  NOT currently installed on Jude's machine. Stale DB row ages out with
  soft-delete. jetbrainspycharmce phantom alias still in app_catalog (catalog-
  sync parser bug, separate fix).
- DaVinci Resolve: MAS on Jude's machine. May be direct download elsewhere.
  Different distributions of same app.
- firefoxpkg: verify patches standard Firefox not ESR.
- Date/build-versioned labels (boxdrive, nomad, Teams): version-shape guard
  rejects to null. Version normalization deferred to resolver redesign.

## Next session priority order
0. **Soft-delete: last_seen column + upsert clause (Sonnet).** Ship early.
   MUST include the conflict auto-resolution pass in the collision detector
   (marks identity_conflicts.resolved=true when token no longer contested).
   Derivation predicate + UI follow. Directory-loop logging rides along.
1. Demo video. Lagging state is the centerpiece. Also show clickable dashboard,
   resolver states on different apps, and the Patch by the Orchard flow.
   zoom.us is a clean Current example. AVOID patching 1Password live (vendor
   rollout lag).
2. Polished repo. README with screenshots. Design reference files committed.
3. Outreach. MacAdmins Slack first, then contribution-first Installomator
   maintainer contact.

Backlog routing:
- Sonnet: soft-delete (+ conflict auto-resolution pass), catalog case-alias,
  catalog bundleId guard, double enrichAppsWithLabels, Version Conflicts cleanup.
- Opus: multi-variant identity GENERAL model, Phase E patchable resolver
  (+ installomator-reference.md prep), patch-outcome state, agent update mechanism.

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
- Light mode. macOS Finder-inspired aesthetic.
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
Console accent: #3d7a42 (hunter green). WCAG AA on white (5.2:1). Locked
June 23. On-dark/mint sibling: #74cc7c. Used for sidebar wordmark "Patch",
active nav indicator, and dark-mode accent. Lime #7dd94a is RETIRED from the
console entirely. Marketing/waitlist keeps its existing greens (#2d6e1f text,
#4a7c2f buttons, #7dd94a logo) -- the console does not need to match.
The token system carries this: primitives only hold raw hex; semantic tokens
expose --accent / --sidebar-accent; components reference semantic only. A
palette change is a one-line primitive edit.

## Lessons learned (June 26, 2026 -- Phase 1 implementation session, Sonnet)
- Verification found a 5th MAS gate the spec missed. The Homebrew resolver's
  UPDATE runs 30s after startup and re-populated MAS rows after the startup
  cleanup had nulled them. "Rely on upstream gates" was wrong. Always verify the
  full write surface for any database invariant you're holding -- every UPDATE
  that touches the relevant column is a gate point.
- A wrong inference in Opus is still an inference. The Opus session concluded
  ru.keepcoder.Telegram should be parked pending an Opus design. Chip's
  verification confirmed via primary sources (fragment downloadURL,
  expectedTeamID, Homebrew cask quit identifier) that the telegram label is
  correct for that bundle ID. The condition ("don't point it at the label without
  confirming it targets that bundle ID") was fulfilled by verification. Opus was
  appropriately cautious; verification was the right gate. Closed correctly.
- Context compaction mid-relay loses verification state but not code changes.
  Recovery: send the verification queries directly, asking Chip to continue
  without re-implementing. The code was already pushed; Railway was deploying.
  Adding credits resolved the compaction ceiling.
- Single quotes inside single-quoted JS strings crash Node.js just as badly as
  other string delimiter collisions. The catalog-sync SQL string used outer
  single quotes; the inner 'installomator_label' value terminated the string
  early. Server crash-looped until inner quotes were escaped with \'. See
  standing rules.
- Labels in the Catalog need identity validation before the Deploy button shows.
  The phantom alias jetbrainspycharmce was deployable with a green Deploy button.
  Clicking it sent a real Installomator job that failed at exit 8. Safety checks
  must live at the server, not only at the UI. Both layers are needed.
- Exit 8 from Installomator means the install ran but couldn't find the expected
  app name. Distinct from exit 23 (MAS) or exit 16 (download). Useful for
  diagnosing fragment vs install mismatch.
- The curated override in the /checkin handler means Jude's old agent doesn't
  need an immediate binary update. Server enforces correct identity regardless of
  agent report. Server-side correctness is the primary layer; agent is additive.
- The collision detector's auto-resolution pass is a missing piece. Detector
  asserts conflicts but never clears them. Discovered because the Telegram deploy
  button stayed blocked after Phase 1 (the orphan conflict is resolved=false).
  Fixing this requires a companion pass: after each detector run, check if each
  unresolved conflict's token is still contested; if not, mark resolved=true.
  This must ride with soft-delete, not be deferred separately.

## Lessons learned (June 26, 2026 -- multi-variant identity, Opus session)
- One bug was a class. "Fix PyCharm CE showing Pro's version" was a symptom of
  variant-blind name-derived identity matching, affecting 4 app families. Pulling
  the thread honestly (rather than patching the one cask) surfaced the general
  problem, the MAS-gating fix, a dangerous hard-prune-in-waiting, and two more
  bugs. Scope expansion was correct because the threads were real and load-
  bearing. Weeds are where a refined product gets built.
- Intrinsic vs name-derived is the identity distinction that matters. Intrinsic
  signals (bundle_id, _MASReceipt, SUFeedURL) came from that exact app and are
  variant-safe. Name-derived signals (cask/label by display name) are variant-
  blind -- "PyCharm" doesn't carry Pro vs CE. No cleverness recovers information
  the string never had. The fix is refuse-and-curate, not match-smarter.
- A WRONG mapping is worse than a MISSING one. CE with no label (visible, not
  patchable, honest) beats CE with Pro's label (a green button that destroys the
  install). Same family as "failed coercion resolves to Unknown not Current."
  Fail toward visibility, fail toward missing.
- The conflict flag cannot catch what destroys its own evidence. CE resolved with
  conflict=false because the collision happened UPSTREAM at identity -- CE only
  ever had one candidate (the wrong cask), so the resolver correctly saw no
  disagreement. Identity-layer collisions need an identity-layer record
  (identity_conflicts), not the version-layer resolved_versions.conflict. Don't
  let fixing one create the illusion of fixing the other.
- Don't ship a destructive operation whose correctness rests on an unverified
  assumption. The proposed app-prune (DELETE WHERE bundle_id NOT IN payload) was
  correct ONLY if check-in payloads are always complete. Verification found the
  agent's per-directory catch{continue} can send a silent zero-app payload. The
  delete would wipe a device's inventory on one failed readdirSync. Soft-delete
  dissolves the failure mode structurally instead of guarding against it -- and
  gives fleet app-history for free. The safe version and the valuable version
  were the same version; that's the tell it's right.
- A good idea can be aimed at the wrong layer. "Let admins choose Homebrew vs
  Installomator as the up-to-date reference" is sound for choosing AMONG available
  sources, but choosing between available and patchable would zero the lagging
  gap by construction and kill the differentiator. Parked with a hard constraint:
  precedence selection lives strictly inside the available pipeline.
- Curation is the design, not a workaround. Both Jamf (paid, bundle-ID-anchored
  definitions) and Installomator (volunteer, name-keyed fragments) curate.
  Heterogeneous vendors + no version-API standard + same-named variants don't
  admit a fully-derived answer. The collision detector generates the curation
  worklist automatically -- the corpus is small (variant families are a long
  tail, not a flood).
- Read the actual docs before building on assumptions. The Installomator wiki
  corrected three CONTEXT facts in one reading pass (packageID exists but is
  omitted by convention for /Applications; compares-for-difference not direction;
  versionKey configures which plist field is compared). The "bundleID is dead in
  the corpus" line had been carried for sessions and was half-wrong.
- Credentials never transit the Chip chat. OpenClaw asked Jude to paste
  DATABASE_URL; the standing rule caught it. railway run injects env into the
  subprocess so the connection string is never typed or logged. Reinforced.

## Lessons learned (June 26, 2026 -- branch-patch fallout, zoom root cause)
- A bug can hide under multiple correct-looking fixes. The zoom.us false
  positive survived four commits because each fix looked right in source while
  the runtime was wrong. The cure was a single direct diagnostic query against
  the live DB showing installed_norm = "7.1.0 )". Run the query before writing
  the next fix.
- JS silently corrupts regex backslashes bound for PostgreSQL. \s, \(, \), \d,
  \w are unrecognized escapes that JS drops without error. \1-class sequences
  throw "octal escape" at startup (this is what crash-looped production). EVERY
  backslash must be doubled in the JS source. Verify with a query, not the eye.
- Display and comparison are different concerns and must use different version
  values. Truncating for display threw away build numbers Mac admins need; the
  fix was normalize-for-compare, show-raw-for-display. "See Everything" means
  never showing less detail than the machine has.
- Counts must have ONE source. Outdated/current/etc. were computed in four
  places with four results. The canonical /api/stats/patch-status endpoint with
  bundle_id dedup is the fix. Per-device badges are a separate, device-scoped
  question and correctly stay on GET /devices.
- "Outdated -> no new version" is not always a bug. With an unversioned vendor
  download URL, the scraper/Homebrew can correctly know a newer version exists
  while Installomator correctly can't pull it yet (staged rollout). Confirm with
  data which pipeline disagrees before assuming the scraper is wrong.
- The Homebrew matcher's name-based fallbacks can collide two distinct bundle
  IDs onto one cask. Bundle ID is the identity; the matcher must respect that.
  Surfaced by PyCharm CE getting Pro's version.
- "No fleet data" + infinite spinner = server crash, not fleet connectivity.
  Confirmed again this session: the Apps demo-fallback state and the Devices
  spinner both meant the server was crash-looping on a startup SyntaxError.
  Check Railway logs immediately, do not chase agent connectivity.
- OpenClaw can enter a failure loop ("provider rejected the request schema or
  tool payload") where Chip echoes the error to every message. Restart the
  session; split oversized prompts.

## Lessons learned (June 25, 2026 -- console redesign session 3, merge day)
- Diagnose before touching code. The button corner clip was deferred two
  sessions because the root cause was unconfirmed. One audit prompt produced a
  definitive diagnosis; the fix was then trivial. Guessing costs more than
  auditing.
- WebKit backdrop-filter creates a compositing layer that clips descendants at
  the element's own border-radius, even without overflow: hidden. Fix: give the
  descendant its own layer via transform: translateZ(0). Known WebKit behavior.
- Title case audits catch things progressively. Visual review caught strings two
  code audits missed. The review pass is not optional.
- "Pearling" is an OpenClaw processing indicator, not a model name.
- CONTEXT.md handoff via Telegram truncates at large sizes. Locked solution:
  attach to Chip, Chip saves to disk and commits, reads from disk next session.

## Lessons learned (June 25, 2026 -- console redesign session 2)
- Tailwind purging extends to shadcn components. "Untouched files are safe" is
  wrong; v4 purges by bundle analysis. dropdown-menu, select, table needed
  inline patches.
- The style spread overwrite pattern is a silent bug. Destructure callerStyle
  and merge explicitly: { ...base, ...callerStyle }.
- Portal components need explicit inline z-index (9999). Tailwind z-* gets
  purged.
- Glass backgrounds are wrong for dropdowns. Use --surface-raised (opaque).
- overflow: hidden on cards clips children at rounded corners. Never add without
  a specific reason.
- Directional version comparison matters for lagging (available > patchable).
- Dashboard counts must dedup by bundle_id, worst-case-wins, MAS/System split by
  source. (Now centralized in the canonical endpoint.)
- Dot indicators over emoji. Copy without possessives. Tier names in modal
  footers not headers. Modal titles describe the action with real app names.

## Lessons learned (June 24, 2026 -- console redesign session 1)
- Tailwind v4 purges utility classes in newly-added/heavily-modified files not
  referenced elsewhere. Move layout/spacing/color to inline style props.
- Dark mode renders correctly before light when glass relies on backdrop-filter.
- DevTools Computed (not Sources) shows resolved CSS variable values.
- A self-contained token-swatch debug page (public/design-debug.html) beats
  manual inspection.

## Lessons learned (Phase B + C -- June 23, 2026)
- node-fetch v3 is ESM-only. Use async import().
- Homebrew cask artifact arrays can contain objects. Type-guard before string
  methods.
- Match SQL placeholder count to params array length exactly.
- Per-resolver write-direct breaks the moment a second resolver exists. Return
  Maps, merge in a coordinator.
- Railway restart triggers the 30s cron startup delay for quick verification.
- Two-pipeline model pays off: coconutBattery has a broken patchable pipeline
  but a working available pipeline.
- Verify status-bar math after any category change.

## Lessons learned (June 23 -- Phase 6 design + implementation)
- A grace period is a guess; FOR UPDATE is a guarantee.
- Mechanism safety and human undo are separate concerns.
- Key the undo window on MODE (silent), not tier.
- Implement an undo window as ABSENCE of a queue row, not a flag.
- A garbage collector must not make policy decisions.
- An allowlist can BE an auth boundary. Make the deferral loud.
- Idempotency is a table-wide contract once re-delivery is possible.
- Decompose agent loops by FUNCTION (control plane vs heartbeat), not data type.
- pool.connect() + client.query() for all transactions; release() in finally.
- claimed_at lives on pending_patches. FOR UPDATE locks the table with the
  column you branch on.

## Lessons learned (June 22 and earlier -- condensed)
- LaunchDaemon plists are world-readable. Secrets go in config.json root:wheel
  600, injected to process.env via applyConfigEnv at startup.
- Audit the actual call graph before writing (spawn was in version-checker, not
  scheduler).
- Don't build UI to paper over a data problem (day grouping vs full datetime).
- Verify exit-code interpretations: 23 is MAS, not "app was open."
- The single-number "outdated" invariant hid a false-negative (vendor ships a
  fix, Installomator lags, dashboard says current). Two numbers + lagging fix it
  AND make the gap a differentiator.
- Installed app has a real CFBundleIdentifier even though bundleID is dead in
  the fragment corpus. Keying identity on installed bundle ID unlocks resolver,
  MAS detection, and the Telegram mismatch from one model.
- Storage medium is decided by the FUTURE constraint (per-org at multi-tenancy),
  not present convenience. Curated mappings in DB, not a file.
- Record candidates, decide precedence later.
- Failed version coercion resolves to Unknown, never Current.
- config.json structure must be verified against the actual file.
- Never paste DATABASE_URL or credentials into the Chip chat.
- Installomator only reads KEY=VALUE flags from positional args.
- execSync can ETIMEDOUT in a LaunchDaemon root env. Prefer spawn.
- Vercel NEXT_PUBLIC_ vars are inlined at build time even in server-only files.
- DEBUG=1 does NOT skip downloads in Installomator. Only the install step.
- Version-check errors land in agent.error.log (stderr), not agent.log.
- Python heredoc mangles regex/SQL escape sequences. Use direct file edits.
- Unconditional ON CONFLICT overwrites can clobber good values. Guard them.
- launchctl list exit-code/runs fields reflect history, not current state.
- Token rotation has three components: Railway, Vercel, and config.json on every
  managed machine.
- Hardcoded secret fallbacks are worse than NEXT_PUBLIC exposure. Fail loud (503).