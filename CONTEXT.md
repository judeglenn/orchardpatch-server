# OrchardPatch -- Project Context

Last updated: July 6, 2026 (Two sessions folded together. Session A: soft-
delete Parts 1-3 shipped end to end, Sonnet -- column type fixes, server-clock
last_seen on both apps and devices, removal predicate threaded into every
count/listing/patch-handler surface, conflict auto-resolution pass, five
rounds of UI consistency fixes chasing one root cause (status independently
computed in 4+ places, filed not fixed). Session B: app_lifecycle_events
table shipped (appeared/removed event log), then a real production incident
-- a misdirected `railway up` deployed Node code onto the Postgres service
and crashed it, roughly 3 days of downtime, recovered via dashboard restart.
Root-caused two real startup bugs along the way (server blocked on DB at
startup, /health lied about DB status) and fixed both properly rather than
just re-bumping a timeout. Two new standing rules earned this session:
confirm the linked Railway service before any `railway up`, and credentials
never get typed into the Chip chat even under pressure to unblock a check
quickly. Tip of orchardpatch-server: a8f69d3. Tip of orchardpatch (frontend):
0a4d4f3. Both devices confirmed checking in normally as of this update
(last_seen 2026-07-06 ~20:37 UTC).)

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
  All fleet calls go through proxy layer as of Phase 5 (June 16).

## Vercel environment variables (waitlist)
- RESEND_API_KEY -- Resend API key for owner notification emails
- WAITLIST_SHEET_ID -- Google Sheet ID for signup capture
- GOOGLE_SERVICE_KEY -- Google service account JSON key for Sheets API
  All three confirmed set in Vercel production as of June 21. Not in
  .env.local -- expected for local dev.

## Agent environment variables
- SERVER_URL -- fleet server URL
- SERVER_TOKEN -- matches fleet server
- VERSION_CHECK_INTERVAL -- check-ins between version runs (default: 10)
  INSTALLOMATOR_PATH is NOT an env var -- agent discovers Installomator by
  checking a path list in order. launchctl kickstart -k does NOT re-read
  plist EnvironmentVariables -- changing an env var requires full
  unload/reload (bootout/bootstrap), not kickstart.
- GITHUB_TOKEN -- read from /etc/orchardpatch/config.json (githubToken field)
  via applyConfigEnv() in scheduler.js, runs once at startup before any
  version check fires. Falls back to process.env.GITHUB_TOKEN if absent.
  Renewed May 12, 2026, scoped to all public repos -- tighten to
  Installomator repo at next rotation.

## config.json structure
File: /etc/orchardpatch/config.json. root:wheel 600 on both machines.
  {
    "server": { "url": "...", "token": "<SERVER_TOKEN>" },
    "githubToken": "<GITHUB_TOKEN>"
  }
Read path: d["server"]["token"] (NOT a flat serverToken key -- corrected
June 22). applyConfigEnv() in scheduler.js reads this at startup and writes
into process.env so child processes (version-checker spawns) inherit it.

## Installomator path and version
- Canonical pkg-managed path: /usr/local/Installomator/Installomator.sh
- Legacy manual path: /usr/local/bin/Installomator.sh (do not rely on this)
- patcher.js INSTALLOMATOR_PATHS order: pkg path first, /usr/local/bin/ second.
- Current version on both machines: v10.8 (2025-03-28), installed via catalog
  deploy June 16.
- Installomator itself points to v10.8 pkg. v10.9beta (main branch) is what
  catalog sync pulls fragment data from. v10.8 (release branch) is the
  stable installed binary.
- OrchardPatch postinstall script installs Installomator to /usr/local/bin/,
  conflicting with pkg convention. Tech debt, see open items.

## Architecture decisions
- Agent to server: REST polling only, no WebSocket. Server cannot reach
  agents directly (Railway to NAT'd agent doesn't work). Version data is
  agent-initiated push, not server-pull.
- Agent loop split (Phase 6): fast loop 60s (pending_commands + pending_patches,
  first tick at 15s), slow loop 15min (full inventory + version checks).
  Two independent timers, no coupling. Fast loop must not serialize behind a
  running Installomator process.
- Force check-in: server writes a check_in row to pending_commands; agent
  fast loop picks it up, runs the slow-loop inventory body immediately.
- Patching via Installomator only. Post-patch: agent immediately ingests
  confirmed version, triggers inventory check-in -- no staleness window.
- Vercel deploys automatically via GitHub integration on push to main.
- Auth wall: Next.js middleware, two-env-var design (LOGIN_PASSWORD +
  SESSION_SECRET). Placeholder until multi-tenancy is built.
- Installomator does NOT read NOTIFY/DEBUG/etc from environment. Only
  positional KEY=VALUE arguments override defaults. DEBUG=1 as a positional
  arg skips only the INSTALL step, not the download.
- Agent secrets live in /etc/orchardpatch/config.json, root:wheel 600. Plist
  contains no secrets.
- Exit code 23 = "App previously installed from App Store -- Installomator
  respects the MAS installation and will not overwrite." Correct behavior.
- All fleet server calls from frontend go through Next.js proxy routes
  (Phase 5, June 16). No direct browser-to-fleet-server calls exist.

## Phase 6 force check-in -- SHIPPED June 22, 2026
Designed in Opus, implemented and verified on both machines. terminate_stuck_job
shared recovery function, 30-min staleness sweep, 24h expiry cron (now casts
created_at::timestamptz, see this session), pending_commands table,
ENQUEUE_ALLOWED allowlist as the auth boundary, force check-in button on
device detail page, undo affordance (amber countdown) for silent patches
within 15s of queueing. KNOWN RACE (documented in code, ~1ms window in
deferred enqueue guard) -- fix before multi-tenancy: wrap in FOR UPDATE
transaction.

## Patch History UI -- overhauled June 22, 2026
Flat chronological list, formatDateTime ("Jun 22, 2026 at 6:32 PM"), TL;DR
exit-code summaries (0=success, 23=MAS, 16=download failed, 11=checksum
mismatch, other=see log).

## version-checker.js architecture (rewritten June 16 evening)
DEBUG=1 does NOT skip downloads, only the install step -- this is why large
labels were timing out (genuinely downloading the full artifact before
appNewVersion logged). Fix: async spawn, stream stdout, kill the process the
moment appNewVersion= appears, before download starts. 12s hard timeout
backstop. Version-shaped guard on captured value (^\d+\.\d) rejects
non-matching captures to null.
STATUS: 34/47 labels populated as of June 22.
STRATEGIC NOTE: this is a flagged stopgap. Latest-version resolution is
global, not per-device -- belongs server-side (Phase E, deferred, see
Patchable pipeline architecture below).
CAVEAT: even a correctly-captured version can be optimistic relative to what
the vendor's unversioned download URL actually serves at patch time (staged
rollouts). Not a scraper bug -- a property of unversioned vendor URLs. See
1Password case in Open items.

## Patchable pipeline architecture -- perfect-world target (Phase E, deferred)
Design intent captured for when the Opus Deep Dive opens. Not yet built.
- Resolution is a GLOBAL fact, not per-device -- current per-agent scraping
  computes the same answer N times and pays the download cost N times.
- Target: agents only report installed versions and run patches, no
  resolution logic. One server-side resolver reads each Installomator
  label's version SOURCE directly (most labels compute appNewVersion from a
  small API call, not a 150MB download). Fall back to the existing
  multi-source resolver, then a controlled server sandbox as last resort.
- MUST honor each label's versionKey (default CFBundleShortVersionString,
  some labels override to CFBundleVersion) -- a latent source of
  installed-vs-patchable mismatch if ignored (the zoom.us
  "7.1.0 (83064)" vs "7.1.0.83064" shape is exactly this).
- Hard part (why this is Opus): 1,137 labels with heterogeneous resolution
  logic (JSON API, HTML scrape, Sparkle feed, GitHub releases). No single
  parser.
- PREP TASK (not yet started): installomator-reference.md -- a derived,
  dated engineering reference of Installomator documented behavior. Build in
  the SAME session that opens the Phase E Deep Dive so it's fresh in context.
  Same treatment for a Title Editor teardown (competitive).

## Two-table write pattern (complete as of June 13)
pending_patches (agent work queue, fast-loop polled) and patch_jobs
(history/audit log) written atomically at queue time, patch_jobs.id =
pending_patches.id. For silent patches, pending_patches is withheld 15s
(undo window); patch_jobs written immediately. Completion side: patch.id
threads through pollAndRunPatches -> runPatchJob -> createJob ->
reportPatchJob; ON CONFLICT(id) DO UPDATE transitions queued -> success/failed.

## Agent job execution model
Fast loop (60s): fetch pending patches, claim (409-safe), fire without await
(proc.on('close') is the report path), poll pending_commands, claim/execute/
complete. Two report paths exist, both idempotent; reportPatchJob() in
checkin.js is dead code post-Phase-6 (kept, not cleaned up). "Claimed but
abandoned" gap resolved by the 30-min staleness sweep. patch_jobs.status
never transitions to in_progress/running by design -- stays queued until
cancelled or completion reported.

## Version model -- two-number system (locked June 22)
Two numbers, two pipelines:
- latest_patchable: what OrchardPatch can deliver now (Installomator-sourced,
  unchanged by the redesign).
- latest_available: newest release the vendor has shipped (server-side
  multi-source resolver: Homebrew, Sparkle, GitHub, later mas).
"Outdated" is not boolean -- four states from the relationship between
installed/patchable/available: current, patchable, lagging (vendor ahead of
Installomator), unknown. "Show both, the gap is a feature" -- lagging is the
product wedge AND the automated Installomator-contribution signal.
Identity keyed on installed app's real bundle ID via app_identity mapping
table (bundle_id dead in the FRAGMENT corpus specifically -- see Label
matching philosophy). Curated identity mappings live in DB rows
(curated=true), not a file -- multi-tenancy is the decider. Failed version
coercion resolves to Unknown, never Current.
Build order: Phases A-C shipped. Phase D absorbed into console redesign.
Phase E deferred (has a designed target, see Patchable pipeline architecture).

## Version normalization (locked June 26, 2026)
The most repeated bug class this project has hit.
- ONE shared definition: normalizeVersion in src/lib/utils.ts (frontend).
- Three steps in order: strip comma suffix ("12.8,282010"->"12.8"), strip
  parenthetical build suffix ("7.1.0 (83064)"->"7.1.0"), truncate to three
  segments ("7.1.0.83064"->"7.1.0").
- normalizeVersion is for COMPARISON/STATE DERIVATION ONLY. Display always
  shows the raw, full version string (see Raw version display below).
- Server-side, same normalization as nested regexp_replace in SQL, appears
  in three queries (GET /apps/status, GET /devices outdated_count,
  GET /api/stats/patch-status) -- must stay in sync.
- CRITICAL escaping rule: every backslash in a regex bound for PostgreSQL
  must be DOUBLED in JS source ([0-9] not \d, \\1 not \1, \\s \\( \\) \\.
  not \s \( \) \.). Single backslashes are silently corrupted by JS string
  parsing. ALWAYS verify with a direct query, never by eyeballing.
- versionGt(a, b): segment-by-segment numeric comparison, directional.
  Lagging requires available > patchable, not mere inequality.
- FINDING (Installomator docs): Installomator compares for DIFFERENCE, not
  greater-than -- no concept of "lagging." versionGt HAD to be built by us,
  cannot be borrowed. Justifies the lagging differentiator as genuine added
  value, good outreach framing.
- FINDING (Installomator docs): versionKey -- which Info.plist field
  Installomator compares against is configurable per label (default
  CFBundleShortVersionString). Phase E must honor this per-label. Latent
  mismatch source when agent and label read different plist fields.

## Raw version display principle (locked June 26, 2026)
Display raw, unmodified version strings everywhere version detail appears
(hero card, fleet rows, patch button labels). Normalize only behind the
scenes for badge/state derivation. Transparency is the product pitch --
never hide build numbers to make a comparison look clean. Canonical example:
zoom.us shows INSTALLED "7.1.0 (83064)", PATCHABLE "7.1.0.83064", badge
Current -- both raw strings visible.

## Canonical patch-status counts (shipped June 26, 2026)
Problem: outdated/current/etc counts were computed in 4+ places with 4+
different results (Dashboard vs Fleet page disagreed). Fixed with a single
source for FLEET-WIDE COUNTS specifically:
- GET /api/stats/patch-status -- DISTINCT ON CTE, dedup by bundle_id,
  worst-case-wins (outdated > unknown > current > na). Returns
  { outdated, current, unknown, system, store, total }.
- Consumers: Dashboard metric cards, App Inventory stats bar, Fleet page
  Outdated stat card. Per-device badges on Devices list stay device-scoped
  (different question, not replaced).
NOTE (this session): this fixed the COUNTS. It did NOT fix per-item status
badges -- see "Status computation duplication" in Open items below. The same
class of bug resurfaced there and was NOT consolidated this session, only
patched at each call site.
KNOWN INCOMPLETE: the old "Version Conflicts" stat card on App Inventory was
supposed to be removed in this work and was not. Still shows alongside the
new PATCH STATUS bar. Filed Sonnet cleanup, still open.

## Resolver architecture (Phase B + C shipped June 23, 2026)
- src/lib/resolvers/homebrew.js -- resolveHomebrew(pool). Fetches
  formulae.brew.sh/api/cask.json, multi-index lookup (label token, artifact
  .app name, cask name array), writes homebrew_cask to app_identity.
- src/lib/resolvers/sparkle.js -- resolveSparkle(pool). sparkle_feed_url
  rows, fetches XML, extracts sparkle:version/shortVersionString. 10s
  per-feed timeout.
- src/lib/resolvers/github.js -- resolveGitHub(pool). github_repo rows,
  GitHub Releases API. Currently empty (no github_repo rows populated yet).
- src/lib/resolver-cron.js -- coordinator. Promise.all across all three,
  merges by trust order (homebrew < github < sparkle), writes
  resolved_versions. Fires 30s after startup, then every 24h.
  This session: runCollisionDetector() call site wrapped in .catch() --
  audit found no error boundary, a thrown error could silently kill a cron
  tick with no log.
- conflict = true when sources disagree on major/minor (patch-level does
  not trigger). KNOWN BUG: comparison doesn't apply normalizeVersion before
  comparing, so format-only differences get flagged. Filed, still open.
- Homebrew name-based fallback matching (priorities 2-4) can let two
  distinct bundle IDs collide onto the same cask -- this was the root of
  the multi-variant identity problem, fixed by Phase 1 (see below).

## Multi-variant identity fix -- SHIPPED Phase 1 (June 26, 2026)
Full spec: phase1-identity-spec.md (project file). Compressed summary --
implementation detail below is intentionally condensed per the standing rule
to compress shipped work after 2+ sessions.

THE PRINCIPLE: identity is the installed app's CFBundleIdentifier. Signals
are either INTRINSIC (bundle_id, _MASReceipt, SUFeedURL -- variant-safe) or
NAME-DERIVED (Homebrew casks, Installomator labels matched by display name --
variant-BLIND, "PyCharm" doesn't carry Pro vs CE). A WRONG mapping is worse
than a MISSING one -- fail toward missing, not toward a green button that
destroys the wrong install.

THE FOUR FAMILIES (all resolved, verified via primary sources not inference):
- PyCharm Pro (com.jetbrains.pycharm): label jetbrainspycharm, cask pycharm.
  Correct, protected by curated row.
- PyCharm CE (com.jetbrains.pycharm.ce): NO valid Installomator label exists
  (jetbrainspycharmce is a case alias inside the Pro fragment, product code
  PCP). Curated: label NULL, cask pycharm-ce. NOT installed on Jude's
  machine -- the DB row was stale and aged out via soft-delete this session.
- Teams: NOT a collision. Two genuinely distinct apps, distinct labels/casks
  (classic has no Homebrew cask). Validates the detector keys on TOKEN not
  NAME.
- Canva: MAS half (com.canva.canvaeditor) and direct half
  (com.canva.CanvaDesktop, label/cask 'canva') dissolved by MAS-gating.
- Telegram: ru.keepcoder.Telegram confirmed via primary sources (fragment
  downloadURL, expectedTeamID, Homebrew cask quit identifier) to correctly
  target the telegram label. com.tdesktop.Telegram was a stale orphan --
  aged out via soft-delete this session, conflict auto-resolved.

FIVE PARTS SHIPPED (server commits a3abd19, f4a2011, 6e84fa9, 24940fb,
59264c2; agent 993a8d0):
0. identity_conflicts table + idempotent MAS cleanup on startup.
1. MAS gates derivation -- 5 GATE POINTS, not the 3 originally spec'd (a
   verification-found gap: the Homebrew resolver's UPDATE ran 30s after
   startup and re-populated MAS rows the startup cleanup had just nulled).
   Points: agent catalog.js, /checkin filter, identity-bootstrap.js WHERE,
   homebrew.js NOT EXISTS guard, db.js startup cleanup UPDATE.
2. Collision detector (src/lib/identity-collision-detector.js) -- any
   homebrew_cask/installomator_label held by 2+ distinct non-curated
   bundle_ids is NULLed on all of them and recorded. Keys on shared TOKEN,
   not NAME (Teams validates this -- distinct tokens, no trip).
   curated=true rows immune.
3. identity_conflicts table -- per (bundle_id, source) pair, not a boolean
   on app_identity (ambiguity can be source-specific). Distinct from
   resolved_versions.conflict (version-layer, cannot catch variant
   collisions -- the collision destroys the evidence before the resolver
   runs). This IS the curation worklist.
4. Six curated seed rows (curated=true, never overwritten by derivation):
   PyCharm Pro/CE, Teams classic/new, Canva direct, Telegram (keepcoder).
5. Patch-path identity guard (src/lib/identity-trust.js) --
   isIdentityTrusted(bundleId, label) checked before POST /patch (Fruit,
   Bushel hard refusal; Branch/Orchard per-app skip). Belt-and-suspenders
   for an app-destroying irreversible operation.

Checkin curated override (59264c2): /checkin looks up a curated=true row
before writing installomator_label, overriding stale agent-reported values.
Means Jude's still-pre-Phase-1 agent (device-GJM7N0XGL0) is safe -- verified
end to end this session via a forced check-in + direct query (PyCharm CE
label confirmed NULL post-checkin).

THIS SESSION -- Part 2 extension (identity_conflicts auto-resolution):
The collision detector asserted conflicts but never cleared them, which was
identified as a gap in the June 26 session and left as a dependency for
soft-delete. resolveSettledConflicts() added to identity-collision-detector.js
(commit 156858c) -- runs after every detectAndRefuseCollisions() pass, marks
resolved=true for any token with fewer than 2 non-curated holders. Verified:
both Telegram conflict rows (com.tdesktop.Telegram orphan, ru.keepcoder.Telegram)
flipped to resolved=true immediately, unblocking the Catalog deploy button
without waiting for the orphan to age out via soft-delete.

Catalog deploy identity guard (SHIPPED June 26, commits 9ee2670, 27d8b00,
1096270): label-level conflict check for the label-only /patch path (no
bundleId available). has_conflict boolean on GET /api/catalog, Deploy button
disabled when true. REMAINING GAP: full isIdentityTrusted() requires
bundleId; catalog deploys don't have one. Filed, still open.

GENERAL MODEL REMAINS OPUS: Phase 1 fixed the 4 known families. How
derivation distinguishes variants in general, curated corpus at
multi-tenancy (global vs per-org), is still an Opus Deep Dive. Curation IS
the design, not a workaround -- both Jamf (paid team, bundle-ID-anchored)
and Installomator (volunteer, name-keyed) curate for the same structural
reason (heterogeneous vendors, no version-API standard, same-named variants
don't admit a fully-derived answer). See Competitive section.

## Soft-delete app lifecycle -- SHIPPED Parts 1-3, July 1-2, 2026

### Design (locked June 26, unchanged)
SOFT-DELETE via last_seen, NOT hard-prune. The agent's per-directory
inventory loop uses catch{continue} silently, so a failed readdirSync sends
a zero-app payload indistinguishable from "user uninstalled everything." A
hard prune keyed on payload completeness could wipe a device's whole
inventory on one partial payload. Soft-delete makes that failure a
non-event structurally, AND gives fleet app-history (appeared/removed
dates) for free -- fits the security positioning.
- last_seen is a positive fact the agent's check-in asserts (via server
  clock, NOT agent-reported time -- see Part 1 below); removal is DERIVED,
  never a DELETE.
- Removal keyed on CHECK-IN CYCLES, not wall-clock (sleeping laptop hasn't
  uninstalled anything). Threshold: apps.last_seen < devices.last_seen -
  45 minutes (N=3 cycles at 15-min slow-loop cadence).
- HARD REQUIREMENT (now met): the removal predicate is threaded into EVERY
  count and every patch-queueing surface. A removed-but-once-outdated app
  must not inflate counts forever, and must not be patchable.

### Part 1 -- last_seen columns + server clock (SHIPPED, commits f148600,
b2a76b2, 4b4086b, dde38a1)
- apps.last_seen: was already present but TEXT and populated from
  EXCLUDED.last_seen (agent-reported timestamp, not server clock). Fixed:
  DO UPDATE SET last_seen = now() in the /checkin upsert. Column promoted
  TEXT -> TIMESTAMPTZ (commit f148600, USING last_seen::timestamptz cast).
- devices.last_seen: same bug, same fix. Was EXCLUDED.last_seen (agent
  clock, susceptible to drift/stale payloads). Changed to now(), column
  promoted TEXT -> TIMESTAMPTZ (commit b2a76b2 originally targeted apps,
  extended to devices when the removal-predicate audit found devices was
  still agent-clock and TEXT).
- pending_patches.created_at cast fix (commit 4b4086b) -- unrelated to
  soft-delete directly but discovered as the same class of bug: the 24h
  expiry cron was comparing TEXT against a timestamptz interval and
  silently failing every hourly tick. One-line cast fix,
  created_at::timestamptz, rides in the same commit.
- Agent directory-loop silent catch logging (commit dde38a1): both silent
  catch{continue} blocks in inventory.js now log
  (console.warn('[inventory] readdirSync failed...' / 'skipping app
  entry...')) before continuing. Pure observability, no behavior change.
  Confirmed clean (no skip messages logged) during the 1Password
  investigation below -- the inventory scanner is not silently dropping
  anything.

### Part 2 -- Collision detector conflict auto-resolution (SHIPPED,
commit 156858c)
resolveSettledConflicts() added to identity-collision-detector.js, called
at the end of runCollisionDetector(). See Multi-variant identity section
above for full detail -- this was originally scoped as a soft-delete
dependency (Telegram deploy button staying blocked forever) but implemented
as an extension of the Phase 1 collision detector rather than new
soft-delete code, since the fix belongs with the detector regardless of
what triggers a token becoming uncontested.

### Part 3 -- Removal predicate threaded into counts + patch handlers +
UI (SHIPPED, server commits 30114aa, b562b0c; frontend commits 8e3a172,
e79ae19, fcbf610, 0a4d4f3)

Server-side (30114aa):
- GET /api/stats/patch-status: inner CTE gets JOIN devices d ON
  d.device_id = a.device_id and WHERE a.last_seen >= d.last_seen -
  interval '45 minutes'. Removed apps no longer inflate fleet counts.
- GET /devices outdated_count: same predicate added inside the
  COUNT(DISTINCT CASE ... END) expression.
- GET /apps/status: JOIN devices d added, SELECT gains
  removal_state ('present'/'removed' CASE on the same predicate) as a
  column -- NOT a WHERE filter. All apps (present and removed) are still
  returned; the frontend decides display. a.last_seen also added to the
  SELECT (was missing initially, caused "Last seen --" bug, fixed same
  session in commit d31cfb4).

Server-side patch-path guards (b562b0c) -- the load-bearing half of Part 3,
verified BEFORE any frontend work started:
- Bushel: WHERE a.last_seen >= d.last_seen - interval '45 minutes' added
  (devices already in scope).
- Branch: JOIN devices d added + same WHERE condition.
- Orchard: same condition added to the inner per-device target query.
- Fruit (POST /patch): no surrounding query to filter (single explicit
  deviceId+bundleId tuple) -- added an explicit pre-queue DB lookup
  comparing apps.last_seen against devices.last_seen - 45min, returns 409
  with a clear error before isIdentityTrusted() runs if the app is removed.
  VERIFIED: manual POST /patch against the stale 1Password 8 row returned
  409, no pending_patches row written, no patch_jobs row written.
This closes the actual safety gap -- a removed app cannot be queued for a
patch through ANY of the four tiers regardless of what the UI shows,
independent of whether the frontend correctly greys out a button.

Frontend (four rounds, chasing the same root cause each time -- see Status
computation duplication in Open items):
1. (8e3a172) Fleet installations table per-device rows: removalState/
   lastSeen threaded through the /api/fleet/apps/[id] proxy. Action column
   gets a removalState === 'removed' branch FIRST (before mas, before
   isOutdated) rendering muted "Removed" text, no button. Device name cell
   gets a "Last seen [date]" subtitle.
2. (e79ae19) App Inventory outdated filter + app detail page hero/button:
   patchStatusMap build loop (HomePageInner.tsx) skips removal_state ===
   'removed' rows before the outdated-wins priority check, so an
   all-removed bundle_id gets no map entry and disappears from the
   Outdated filter. App detail page: activeInstallations derived by
   filtering out removed rows; device count chip, outdatedDevices, hero
   card, and Bushel button all switched to read from activeInstallations
   instead of the raw array. When allRemoved is true, Bushel button is not
   rendered (conditional, not disabled) and the hero card's inner content
   is replaced with "No Active Installations" (outer glass card wrapper
   stays).
3. (fcbf610) Per-device status pill in the fleet installations table
   (DeviceStatusPill) was found to still show a colored "Patchable" badge
   on rows the action column already labeled "Removed" -- a different
   component reading patch_status/isOutdated directly with no removalState
   awareness. One-line call-site guard: renders null instead of
   DeviceStatusPill when removalState === 'removed'.
4. (0a4d4f3) AppCard badge (App Inventory list view, unfiltered) was found
   to still show "Outdated" via a fallback path (app.hasVersionConflict,
   itself not removal-aware) whenever patchStatusMap had no entry for a
   bundle_id -- exactly the case created by fix #2's skip guard. Root-cause
   fix (not a fallback-value swap): a second map, allRemovedMap, built in
   the same HomePageInner loop, true only when every row seen for a
   bundle_id was removed. Passed to AppCard as isRemoved; AppCard renders
   a muted "Removed" label instead of PatchStatusBadge when true, checked
   BEFORE the existing fallback logic, so the fallback is now unreachable
   for genuinely removed apps.

### Verification during this session (not bugs -- confirmed real removals)
Investigated 5 apps whose last_seen predated the last_seen fix, all
confirmed genuine:
- Telegram Desktop (com.tdesktop.Telegram, Chip's machine): the known
  Phase 1 orphan.
- Teams classic (Jude's machine): uninstalled May 12, replaced by Teams new.
- PyCharm CE (Jude's machine): never actually installed, stale DB row.
- 1Password 8 (com.1password.1password, BOTH machines, last_seen Jun 16):
  investigated at length because the same cutoff date on both machines was
  suspicious. Confirmed via direct DB query + filesystem check + agent log
  check: both machines rolled back from 1Password 8 to 1Password 7
  (com.agilebits.onepassword7, a completely different bundle ID/product)
  on the same day, likely a subscription lapse. 1Password 7 is actively
  checking in with current last_seen on both machines. No inventory bug --
  agent log confirmed zero skip messages for either bundle ID. This became
  the primary end-to-end test case for the whole soft-delete feature.

### Not yet done
- Removed rows currently always display inline (greyed) rather than being
  hidden behind a toggle. A "show removed" / "hide removed" UI toggle was
  in the original design sketch but not built -- inline display was judged
  sufficient for now. Revisit if the fleet grows and removed-row clutter
  becomes a real problem.
- GET /apps (the old raw listing endpoint using the stale agent-set
  is_outdated flag) was confirmed dead from the frontend's perspective
  during this session's audit -- not touched, not worth removing yet.

## App lifecycle event log -- SHIPPED (commit 08db542)

### Why this exists
Soft-delete's last_seen mechanism only ever tells you the CURRENT state of
an app (present or removed as of right now). CONTEXT.md had been claiming
"gives fleet app-history (appeared/removed dates)" as a soft-delete benefit
before this actually existed -- that claim is now true. Before this table,
there was no way to answer "when did this app get installed" or "show me
everything removed from the fleet in the last 30 days" -- only "is it
removed right now." The security-narrative payoff (how long was a
vulnerable version present before it was patched or removed) depends on
having this event history, not just point-in-time state.

Explicitly rejected a cheaper partial fix (a single first_seen column on
apps) in favor of the real event log, per standing methodology: more
visibility for the mac admin audience is the tiebreaker when a cheap and a
thorough option both technically work.

### Schema
    CREATE TABLE IF NOT EXISTS app_lifecycle_events (
      id SERIAL PRIMARY KEY,
      bundle_id TEXT NOT NULL,
      device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,       -- 'appeared' | 'removed'
      occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      app_name TEXT,
      version_at_event TEXT
    );
    -- supporting index on (bundle_id, device_id, occurred_at DESC)
Note the FK is devices(id), not a devices.device_id column -- devices has
no such column, its PK is id (TEXT, e.g. 'device-GJM7N0XGL0'). This was
verified explicitly this session after an audit initially reported the
wrong join key (see Lessons learned below) -- worth remembering when
extending this table or writing new joins against devices.
app_name and version_at_event are captured redundantly at write time
rather than joined later, an event row must stay self-contained even if
the live apps row later changes or is eventually pruned.

### Write paths (two different triggers, not one shared reconciliation pass)
- **appeared**: written at check-in time, not on a schedule. The apps table
  upsert in /checkin now does RETURNING (xmax = 0) AS inserted (the
  standard Postgres trick for detecting which conflict branch fired). Rows
  where inserted = true (a genuinely new bundle_id + device_id pair) get a
  batched single-query 'appeared' event insert after the main upsert
  loop -- not one query per app.
- **removed**: cannot be detected at check-in time, since removal is
  defined by absence, not by anything the agent sends. Handled by
  recordRemovalEvents() in src/lib/lifecycle-events.js, a periodic
  reconciliation pass. Wired into the SAME three call sites as the
  collision detector's runCollisionDetector() (checkin handler .catch
  pattern, resolver-cron .catch pattern, identity-bootstrap bare await),
  called AFTER runCollisionDetector() in each.
- Duplicate-write guard: a CTE selects the most recent event per
  (bundle_id, device_id) via DISTINCT ON, then the INSERT's WHERE clause
  uses `le.event_type IS DISTINCT FROM 'removed'`. That one comparison
  correctly covers three cases in one shot -- no prior event exists (NULL,
  an app older than this table), most recent event is 'appeared' (a real
  transition worth logging), or most recent event is something else. It
  only skips the case where the most recent event is already 'removed',
  which is what prevents a duplicate row on every reconciliation pass.
  This asymmetry (appeared at check-in, removed via reconciliation) is
  deliberate, not an inconsistency -- check-in's INSERT-vs-UPDATE branch
  already gives an exact, free signal for "genuinely new," so there was no
  reason to duplicate that logic into a periodic pass.

### Known limitation, by design
The 'appeared' backfill does not retroactively populate history for apps
that existed before this table shipped -- every app already on the fleet
looks like it was installed "today" the first time this ran, even apps
that had been there for months. This is unavoidable (can't log an event
that wasn't captured at the time it happened) and is not a bug. History
only becomes accurate going forward from July 2, 2026.

### Verified state (post-incident, see below)
Five removal events recorded correctly before the crash that interrupted
this session (all five match the soft-delete stale rows already confirmed
correct this session -- PyCharm CE, Teams classic, Telegram orphan,
1Password 8 on both devices). Table confirmed present and populated after
Postgres recovery (SELECT to_regclass('app_lifecycle_events') returns
non-null, 5 rows present under event_type = 'removed', 0 duplicate rows
after a second reconciliation pass ran post-recovery).

### Not yet built
- No UI surfaces this data yet. "Installed since [date]" on the app detail
  page, and any kind of fleet churn/removal report, both depend on this
  table but neither has been wired up. This is the next natural frontend
  work once there's appetite for it -- not scheduled yet.

## Production incident -- misdirected deploy crashed Postgres (July 2-6, 2026)

### What happened, in order
1. While shipping app_lifecycle_events, a `railway up` was run without
   confirming which service was linked. The Railway CLI had no stored
   service link for that environment and silently used whatever was last
   linked in the session, which turned out to be the Postgres service
   (from an earlier read-only audit command), not orchardpatch-server.
2. This deployed orchardpatch-server's Node.js code onto the Postgres
   service. Postgres crashed. The database was down for roughly 3 days
   before this was caught and properly restarted.
3. Data was never at risk -- Railway volumes are separate from the compute
   container, the brief Node process running where Postgres should be
   never touched /var/lib/postgresql/data. This was a pure availability
   incident, not a data-loss one.
4. Recovery required a dashboard action, not a CLI one -- the CLI cannot
   redeploy/restart a managed database service the way it can an app
   service. Clicking Restart on the Postgres service's active deployment
   (the real ghcr.io/railwayapp-templates/postgres-ssl:18 image, which had
   been sitting healthy in history the whole time) brought it back.
5. Even after Postgres was confirmed up, orchardpatch-server itself kept
   failing to deploy. Root-caused, not guessed at, two real bugs:
   - `bootstrapIdentity(pool)` was AWAITED before `app.listen()` in the
     startup IIFE. If the DB is slow or unreachable, the entire process
     was frozen, unable to serve even a health check, not just
     DB-dependent routes. A cold start against a struggling DB could take
     2+ minutes just to start listening.
   - `/health` returned `{status:"ok"}` unconditionally, even inside its
     own catch block. Railway's healthcheck could never detect a real DB
     outage, which is part of why the underlying Postgres problem
     persisted as long as it did before being caught.
   The original 30-second Railway healthcheck timeout was ALSO too short
   for the first bug's worst-case startup time, and was bumped to 180s
   (commit 09a1ba4) -- necessary, but insufficient alone, since it does
   nothing about the actual coupling between startup and DB availability,
   or about /health's inability to report a real failure.

### Fixes shipped (commit a8f69d3), both root-cause, not timeout patches
- `app.listen()` now fires immediately and unconditionally at the top of
  the startup IIFE. `bootstrapIdentity(pool)` and `startResolverCron(pool)`
  both run fire-and-forget afterward (startResolverCron was already
  fire-and-forget and confirmed not part of the problem; bootstrapIdentity
  was the one actually blocking and is now `.catch()`-guarded instead of
  awaited). The server can now accept HTTP requests immediately even if
  the database is completely unreachable -- individual DB-dependent routes
  fail on their own when called, which is correct and expected, but the
  process itself is never blocked from listening.
- `/health` now actually queries the DB (`SELECT 1`) and returns 503 with
  `{status:"degraded", db:"unreachable"}` on real failure, instead of a
  hardcoded 200. This is intentionally a STRICTER healthcheck than before,
  not a more lenient one -- if Postgres has a future blip, Railway will now
  correctly see it as unhealthy and act on it, rather than being told
  everything's fine while requests fail behind a lying health endpoint.

### Verified resolution
Both devices confirmed checking in successfully post-recovery via a direct
psql query against the live DB (SELECT id, last_seen FROM devices):
device-GJM7N0XGL0 and device-C02D52QTML85 both showing last_seen within
the last minute at verification time (2026-07-06 ~20:36-20:37 UTC). This
was the actual finish line for the incident -- not "the server process
shows Online," but "the whole fleet is talking to it again."

### New standing rules from this incident (see also AI development workflow)
- Before any `railway up`, run `railway status` or `railway service <name>`
  first to confirm which service is linked. Never assume the CLI's last-
  linked service matches intent, especially after a prior command in the
  same session touched a different service. This is now as load-bearing a
  rule as "never paste DATABASE_URL into the chat" -- both are single wrong
  assumptions about environment state causing real, hours-to-days-long damage.
- Credentials (DATABASE_URL, SERVER_TOKEN, any token) never get typed into
  the Chip chat, full stop, even under time pressure to unblock a single
  check quickly, and even when the ask is framed as low-stakes ("just need
  it to query one table"). Held twice this session under real pressure
  (mid-incident, wanting a fast answer) -- the discipline is the point,
  not the specific credential.
- Before treating any deployment history entry as "the current state,"
  confirm which entry is actually ACTIVE/live versus sitting in HISTORY as
  a past attempt (successful or failed). A FAILED entry in history is dead
  and restarting it is meaningless; the live entry is what's actually
  serving traffic right now, and it's usually the top one, not necessarily
  the most recently attempted one.
- Railway's dashboard "Online" status on a service card can reflect the
  service DEFINITION being active (volume present, config valid) rather
  than the actual running instance count. `railway status` (CLI) or
  checking the specific deployment's own history is the more reliable
  signal for "is this actually running right now" -- cross-check both
  before trusting either alone. (This was actually a red herring this
  session -- the CLI's 0/1 running was correct and the dashboard's "Online"
  card was showing a stale historical deploy-success state, not live
  health. Confirmed by direct psql connection test, which is the real
  ground truth regardless of what either UI claims.)

## DB schema (key tables, updated this session)
- devices: id, hostname, device_id, last_seen (TIMESTAMPTZ, server clock as
  of this session -- was TEXT + agent-clock), agent_version, agent_url
  (nullable)
- apps: id, device_id, bundle_id, name, version, latest_version (legacy/
  null), is_outdated (legacy/always 0 -- do not use), installomator_label,
  path, source (user/system/mas), last_seen (TIMESTAMPTZ, server clock as
  of this session -- was TEXT + agent-clock, same bug class as devices).
  Removal is DERIVED (apps.last_seen < devices.last_seen - 45min), never a
  DELETE or a deleted_at column -- last_seen is the only positive fact
  written; a separate deleted_at would need its own write path and was
  explicitly rejected as unnecessary complexity.
- latest_versions: label (PK), latest_version, last_checked, error.
  34/47 populated as of June 22. Null-safe ingest (CASE WHEN EXCLUDED
  guards against wiping a good value with a failed check).
- app_catalog: label (PK), app_name, bundle_id (null for ~all rows,
  by-convention not by-absence, see Label matching philosophy),
  expected_team, last_synced, download_url. 1,137 rows as of June 12 sync
  (includes phantom case-alias entries from a known parser bug, real
  deployable count lower -- see Open items).
- app_identity: bundle_id (PK), app_name, installomator_label,
  homebrew_cask, github_repo, sparkle_feed_url, adam_id, curated,
  last_derived. curated=true rows never overwritten by derivation.
- resolved_versions: bundle_id (PK), latest_available, source, source_url,
  candidates (JSONB), conflict, resolved_at, error. Two-layer distinction
  from identity_conflicts: this catches same-identity multi-SOURCE
  disagreement (version layer); identity_conflicts catches variant
  collision (identity layer, destroys evidence before this table's logic
  even runs). Do not conflate.
- identity_conflicts: id, bundle_id, source ('homebrew_cask' |
  'installomator_label'), token, competing_bundle_ids, detected_at,
  resolved. Unique index on (bundle_id, source, token) -- idempotent
  inserts. resolveSettledConflicts() clears resolved=true automatically
  whenever a token drops below 2 non-curated holders -- previously only
  ever asserted, never cleared.
- app_lifecycle_events: id, bundle_id, device_id (FK -> devices(id)),
  event_type ('appeared'|'removed'), occurred_at, app_name,
  version_at_event. Supporting index on (bundle_id, device_id,
  occurred_at DESC). SHIPPED this session, see full section above. Not
  yet surfaced in any UI.
- patch_jobs: id, device_id, app_name, label, mode, method, status,
  created_at, started_at, completed_at, exit_code, error, log. status
  never transitions to running/in_progress by design. Known exit codes: 0
  (success), 8 (app name mismatch -- e.g. a phantom alias installing the
  wrong app), 11 (checksum), 16 (download), 23 (MAS), null (never ran).
- pending_patches: agent work queue, rows deleted server-side on terminal
  status. claimed_at is TEXT (staleness sweep casts to timestamptz).
  Silent patches withhold the row 15s for the undo window.
- pending_commands: id, device_id, command, created_at, claimed_at,
  completed_at, result. Allowlist { check_in } only.

## Key API endpoints (updated this session)
- POST /checkin -- agent check-in. apps upsert: last_seen = now() (server
  clock, this session -- was EXCLUDED.last_seen/agent clock). devices
  upsert: same fix, same session. Curated identity override still applies
  before writing installomator_label. runCollisionDetector() (now
  including resolveSettledConflicts()) called post-write.
- GET /devices -- outdated_count now excludes removed apps (this session),
  in addition to the existing 3-layer normalization and system/mas
  exclusion.
- GET /apps/status?device_id= -- now returns removal_state per row (this
  session) and a.last_seen (added mid-session after an initial gap caused
  "Last seen --" in the UI). Does NOT filter on removal_state -- returns
  everything, frontend decides display.
- GET /api/stats/patch-status -- canonical fleet-wide counts, now excludes
  removed apps (this session, was already removal-UNAWARE before this
  session despite being the "canonical" endpoint -- the canonical-counts
  work from June 26 predates soft-delete and didn't know about last_seen
  yet).
- POST /patch, /patch-jobs/branch, /patch-jobs/bushel, /patch-jobs/orchard
  -- all four now refuse to queue a job against a removed installation
  (this session). Fruit returns 409 with an explicit error; Branch/Bushel/
  Orchard silently exclude removed rows from their target lists (batch
  operations skip, they don't abort).
- POST /api/force-checkin -- unchanged, used extensively this session for
  verification (forcing check-ins to test last_seen updates and the
  1Password investigation).

## Next.js proxy routes (frontend)
Unchanged in count/structure this session (15 routes). /api/fleet/apps/[id]
now returns removalState and lastSeen per installation (this session,
commit 8e3a172), sourced from the /apps/status removal_state and last_seen
fields.

## Feature status

### Soft-delete -- SHIPPED (Parts 1-3, July 1-2, 2026)
See full section above. End-to-end verified via the 1Password 8 case:
correct removal predicate in counts, correct server-side refusal on all
four patch tiers, correct UI display across all four places status is
independently rendered (per-device action column, per-device status pill,
app detail hero/button, App Inventory card badge).

### Multi-variant identity fix -- SHIPPED Phase 1 (June 26, 2026) +
conflict auto-resolution extension (this session)
See full section above.

### Catalog deploy identity guard -- SHIPPED June 26, 2026
See Multi-variant identity section. Telegram's has_conflict is now correctly
false as of this session's resolveSettledConflicts() work -- Deploy button
unblocked without waiting for the orphan to age out.

### Console redesign -- SHIPPED (merged to main June 25, 2026)
Compressed per standing rule (2+ sessions old, no changes this session).
Liquid-glass design system, fully tokenized (zero hardcoded hex in
components), light/dark mode, OS-follow on first load. All layout/spacing/
color via inline style props (Tailwind v4 purges utility classes in
new/heavily-modified files). Dashboard, App Inventory, App detail, Device
detail all converted. Known deferred: title case audit not yet applied to
Patch History/Catalog/Devices/Settings pages.

### Branch-patch fallout + version-sourcing session -- June 26, 2026
Compressed. zoom.us false-positive root-caused (JS dropped backslashes in a
regex bound for PostgreSQL) and fixed. Canonical patch-status counts
endpoint shipped. normalizeVersion consolidated. Raw version display
principle established. 1Password "outdated -> no new version" loop
diagnosed as a real vendor staged-rollout artifact, not a bug (this
diagnosis later became directly relevant to this session's soft-delete
verification work, when 1Password 8 turned out to have been uninstalled
entirely on both machines sometime after that diagnosis was written).

### Earlier shipped (fully condensed, unchanged)
Phase 6 force check-in, Phase A/B/C resolver work, Phase 1-5 (job
threading, Software Catalog, token lockdown, catalog pagination,
version-checker rewrite, custom domain), Dashboard/App Inventory/App
detail/Device list/Patch History/Branch/Bushel/Orchard modals/cancel
buttons/auth wall (all pre-June-22 baseline work). Waitlist page overhaul
(June 21-22).

### Not yet built (priority order, updated this session)
0. **UI toggle for hiding removed apps.** Currently always shown inline
   (greyed). Low priority -- revisit if fleet growth makes it noisy.
1. **Status computation consolidation (see Open items).** Real
   architectural debt, not urgent but should land before any new
   status-consuming UI surface gets built, or it inherits the same gap
   by default.
2. **Surface app_lifecycle_events in the UI (NEW this session).** The
   table exists and is populating correctly but nothing reads from it yet.
   Natural first surface: "Installed since [date]" on the app detail page
   header, using the earliest 'appeared' event per bundle_id. A fleet
   churn/removal report is the bigger payoff (ties directly into the
   security narrative -- "how long was this vulnerable version present")
   but is a larger scope, likely its own small project once there's
   appetite for it.
3. Demo video + polished repo. Lagging state is the differentiator --
   feature it prominently. zoom.us is a clean Current example. AVOID
   patching 1Password live (it no longer exists on the fleet at all --
   pick a different demo app; this constraint has gotten stronger, not
   weaker, since the last session note).
4. Outreach (MacAdmins Slack + contribution-first Installomator maintainer
   contact). coconutBattery HTML response is the confirmed bug report
   opener.
-- Then the backlog below, still valid, lower priority --
5. "Version Conflicts" stale-card cleanup on App Inventory (Sonnet):
   remove the card, fix resolver conflict-comparison normalization gap.
6. Catalog-sync case-alias parser fix (Sonnet): stop emitting alias-only
   fragment entries as standalone deployable labels. Confirmed with a real
   exit-8 failure (jetbrainspycharmce).
7. Catalog deploy bundleId guard (Sonnet): look up bundle_id by label
   before queuing, enabling the full isIdentityTrusted() check on the
   catalog path (currently only the label-level conflict check applies).
8. Multi-variant identity GENERAL model (Opus): the 4 known families are
   fixed; general derivation/curation/multi-tenancy model is still open.
   Includes DaVinci MAS/free.
9. Patch-outcome-aware state (Opus): distinguish "no new version at patch
   time" from a true update without collapsing the lagging differentiator.
10. Phase E -- server-side patchable resolution (Opus). Must honor
    versionKey. Prep task: installomator-reference.md.
11. Phase 7: Force reinstall in catalog modal (UNINSTALL=1).
12. Installomator version + Update button on device detail.
13. Agent update mechanism -- pkg build pipeline. PRE-LAUNCH GATE.
14. Agent token rotation product feature.
15. method='fruit' hardcode cleanup in POST /patch-jobs.
16. Bushel modal pre-count cosmetic fix.
17. MAS app exclusion from Branch/Bushel/Orchard queues.
18. "Clear by status" bulk action in Patch History.
19. Pinned Apps on Dashboard (needs preferences table).
20. Automated catalog-sync schedule.
21. Cultivation / policy-based auto-remediation.
22. Multi-tenancy. PREREQUISITE for mutating pending_commands.
23. SSO / proper auth. PREREQUISITE for mutating pending_commands.
24. Graph reports, CLI/Homebrew tap, mas CLI integration.
25. Title case audit on Patch History, Catalog, Devices list, Settings.
26. GET /stats migration to canonical patch-status source.

## Open items / tech debt

- **Status computation duplication (NEW, Sonnet or Opus judgment call --
  see note below).** Discovered this session while chasing the "removed
  app still shows a colored status badge" bug across FOUR separate
  surfaces before it was actually closed: the /api/stats/patch-status CTE
  (server, has the removal predicate), the /apps/status query (server,
  returns removal_state as a column but relies on callers to check it),
  the client-side patchStatusMap in HomePageInner.tsx (now has a removal
  guard), and the AppCard badge fallback path (now has a removal guard via
  a second derived map). Each of these independently reimplements
  status/removal logic. This is the exact same class of bug as the
  pre-canonical-endpoint fleet-count disagreement from June 26 -- fixed
  there for counts, not fixed here for per-item badges. Cheap fix (what
  was actually done this session): guard at every call site. Correct fix:
  consolidate to one server-side source of truth for status +
  removal-awareness so nothing downstream has to remember to check it.
  Recommend evaluating as an Architectural Deep Dive if it resurfaces a
  fifth time -- four independent guard-patches in one session is a signal,
  not a coincidence.
- **Removed apps UI toggle (Sonnet, low priority).** Currently no
  show/hide toggle for removed rows -- always shown inline, greyed. Revisit
  if fleet growth makes this noisy.
- **Conflict auto-resolution -- CLOSED this session.** Was the standing
  soft-delete dependency; resolved via resolveSettledConflicts() in the
  collision detector, verified against the Telegram case.
- **Catalog-sync case-alias artifact (Sonnet, confirmed with a real
  failure).** jetbrainspycharmce (a case alias, not a real label) is
  deployable from the Catalog and produces exit 8. Parser must not emit
  alias-only entries as standalone labels.
- **Catalog deploy bundleId gap (Sonnet).** Catalog deploys are label-only;
  isIdentityTrusted() requires bundleId. Label-level conflict check is the
  current safety net, not a full guard.
- **Jude's agent old version (low urgency).** device-GJM7N0XGL0 still runs
  pre-Phase-1 catalog.js (no MAS gate at the agent layer). Server-side
  gates (5 points) handle it correctly -- verified again this session via
  a forced check-in. Update at next natural deploy.
- **Resolver conflict count inflated + stale card (Sonnet).** "Version
  Conflicts" card on App Inventory should have been removed in the
  canonical-counts work and wasn't. Resolver conflict comparison doesn't
  normalize before comparing (format-only differences flagged as real
  conflicts).
- **Patch-outcome-aware state (Opus).** Must not collapse into lagging.
  Needs patch-attempt outcome persisted where the status query can read it.
- **Phase E patchable resolver (Opus).** Early-kill scrape is the wrong
  shape. See Patchable pipeline architecture.
- **1Password 8 fully removed from the fleet (informational, not a bug).**
  Both machines rolled back to 1Password 7 sometime before/around June 16.
  This is now resolved as an expected, verified soft-delete case rather
  than an open question -- documented here so it isn't re-investigated.
  Demo video: do not use 1Password as a demo app at all now (it's gone,
  not just lagging).
- **AGENT UPDATE MECHANISM -- PRE-LAUNCH GATE.** No pkg build pipeline.
  Manual file copy + bootout/bootstrap currently. Architectural Deep Dive
  needed (signed pkg vs server-pushed self-update via pending_commands).
- **Unidentified Sparkle feed failure.** 1 of 3 feeds fails silently per app.
- **downloadURL regex partial captures.** Tighten when download_url values
  start being consumed.
- **Identity bootstrap startup race.** Migration (CREATE TABLE) not
  explicitly awaited before bootstrapIdentity can run on a cold DB.
  try/catch masks it; next trigger succeeds. Fix when migrations are
  refactored to be explicitly awaited.
- reportPatchJob()/waitForJob() in the scheduler: unreachable dead code.
- KNOWN RACE in deferred enqueue (~1ms window). Fix before multi-tenancy.
- postinstall script installs Installomator to /usr/local/bin/, conflicts
  with pkg convention.
- method='fruit' hardcode in POST /patch-jobs INSERT VALUES.
- DB indexes: none on fleet queries or pending_commands. Fine at 2 devices.
- agent_url column: unused, reserved for future server-initiated flows.
- GITHUB_TOKEN scoped to all public repos -- tighten at next rotation.
- **Double enrichAppsWithLabels() (Sonnet, trivial).** Called twice per
  check-in. Harmless if idempotent, dedupe anyway.
- **Multi-source precedence selection (Opus, PARKED).** HARD CONSTRAINT:
  operates strictly within the available pipeline, can never substitute a
  patchable source for an available one (would zero the lagging gap by
  construction).
- **Multi-variant identity general model (Opus).** 4 known families fixed;
  general model still open. DaVinci MAS/free is the next known instance.

## Known label-matching issues
- coconutBattery: patchable pipeline broken (scrapes HTML from
  coconut-flavour.com), available pipeline works via Homebrew
  (latest_available = 4.3.3). Maintainer outreach opener.
- Telegram: ru.keepcoder.Telegram correctly curated. com.tdesktop.Telegram
  orphan aged out via soft-delete this session, conflict auto-resolved.
- PyCharm CE: correctly NULLed label, pycharm-ce cask. Not installed on
  Jude's machine, stale row aged out via soft-delete this session.
  jetbrainspycharmce phantom alias still in app_catalog (separate,
  unfixed parser bug).
- DaVinci Resolve: MAS on Jude's machine, may be direct elsewhere.
- firefoxpkg: verify patches standard Firefox not ESR.
- Date/build-versioned labels (boxdrive, nomad, Teams): version-shape
  guard rejects to null.

## Model routing for next session
Sonnet is correct for the top of the Not-yet-built list (UI toggle,
status consolidation if scoped small, surfacing app_lifecycle_events in
the app detail page). If status computation consolidation turns out to
require touching the resolver-cron dedup logic and the canonical-counts
query simultaneously (i.e. actually redesigning where status lives, not
just patching another call site), escalate that specific piece to
Architectural Deep Dives -- four independent patches in one session is
the signal that a guard-at-call-site approach has reached its limit.
NOTE from this session's incident: routine Railway/infrastructure commands
(deploys, restarts, service management) are not inherently an Opus-vs-
Sonnet question, but they deserve the same "confirm before acting"
discipline as a destructive DB operation, regardless of which model is
driving the session. The standing rule (confirm linked service before
`railway up`) applies no matter what's being built that day.

## Fleet
- 2 devices in production fleet
- device-GJM7N0XGL0: Jude's MacBook Pro (Mac16,1 macOS 26.4/27.0 reported)
- device-C02D52QTML85: Chip's MacBook Pro (MacBookPro16,2 macOS 26.3.2,
  ~72+ apps, 2020 13" 2.3GHz Quad-Core Intel i7 16GB)
- Agent install path: /usr/local/orchardpatch/agent/
- Config: /etc/orchardpatch/config.json, root:wheel 600 both machines.
- Logs: /var/log/orchardpatch/agent.log (stdout),
  /var/log/orchardpatch/agent.error.log (stderr).
- Installomator: v10.8 (2025-03-28) both machines, at
  /usr/local/Installomator/Installomator.sh.
- Phase 1 agent (catalog.js MAS gate): deployed to Chip's machine only
  (993a8d0). Jude's machine still pre-Phase-1 -- server-side gates cover
  it, reverified this session.
- Confirmed installed (updated this session):
  - PyCharm (Pro): com.jetbrains.pycharm, Jude's machine, 2026.1.3, current.
  - PyCharm CE: NOT installed anywhere. Soft-deleted, ages out.
  - zoom.us: us.zoom.xos, both devices, 7.1.0 (83064)/7.1.0.83064, Current.
  - 1Password 8: NOT installed anywhere as of this session. Soft-deleted.
    Both machines run 1Password 7 (com.agilebits.onepassword7) instead,
    actively checking in, current.
  - Telegram Desktop (com.tdesktop.Telegram): orphan, soft-deleted this
    session, ages out.
  - Teams classic: uninstalled on Jude's machine May 12, soft-deleted this
    session, ages out.
- Both devices confirmed checking in normally as of the end of this
  session, post-Postgres-incident recovery: device-GJM7N0XGL0 and
  device-C02D52QTML85 both showed last_seen ~2026-07-06 20:36-20:37 UTC
  via direct psql query. Do not treat any last_seen timestamp frozen
  around 2026-07-02 20:47-21:20 UTC as evidence of a real removal -- that
  window is the Postgres outage itself, not an actual uninstall event.
  Anything that looked "removed" purely due to that gap should have
  self-corrected on the first successful check-in after recovery.

## AI development workflow
- Primary dev assistant: Chip (OpenClaw, Claude API, own MacBook Pro).
- Architecture/planning: Claude.ai (this project).
- Chip pushes via SSH (account-level key, works for all orchardpatch repos).
- Chip's git identity: user.name=Chip, user.email=chip@openclaw.
  orchardpatch-server has a local override (Jude Glenn/judeglenn@example.com).
- File ownership on Chip's machine: `sudo chown -R chip:staff ~/Projects` if
  root-ownership recurs. Never sudo git.
- Edit tool fails on JS/TS files with template literals -- use Python file
  replacement for substantial JS/TS edits, EXCEPT for files containing
  regex or SQL escape sequences, where Python heredocs mangle escapes and
  direct file-edit tools must be used instead. Same underlying hazard,
  two different failure modes depending on file content.
- Context is lost when Chip compacts -- CONTEXT.md restores it.
- CONTEXT.md handoff (locked): Jude attaches to Chip at session end, Chip
  saves to disk at ~/Projects/orchardpatch-server/CONTEXT.md and commits.
  Next session Chip reads from disk. Claude.ai project file stays in sync
  as the source of truth for Claude sessions (upload after Chip commits).
  PREFERENCE (updated June 26, still followed this session): targeted
  str_replace edits going forward for small changes, full rewrites at
  natural session boundaries with 2+ sessions of accumulated detail to
  compress. This is a full rewrite session.
- "Pearling" is an OpenClaw processing indicator, not a model identifier.
  Chip confirmed running anthropic/claude-sonnet-4-6.
- OpenClaw failure mode: "LLM request failed: provider rejected the
  request schema or tool payload" can loop, echoing the error to every
  message. Recovery: restart the OpenClaw session, split oversized prompts.
- Standing rule: always fix bugs at root cause, never suggest workarounds.
  If a workaround is genuinely needed to unblock testing, flag it
  explicitly as tech debt before moving on. REINFORCED this session: the
  AppCard badge bug had a one-character "cheap" fix available
  (patchStatusMap[bid]?.status ?? "unknown") that was explicitly rejected
  in favor of the root-cause fix (propagate real removal state) because
  the cheap fix would have displayed a different WRONG label ("Unknown")
  instead of the correct one ("Removed") -- masking the bug instead of
  fixing it.
- Standing rule: don't polish a mechanism you've already decided to replace.
- Standing rule: all fixes resolvable through OrchardPatch itself, not
  manual CLI commands on managed machines.
- Standing rule: avoid follow-mode/non-terminating commands in Chip prompts.
- Standing rule: any regex bound for PostgreSQL needs every backslash
  DOUBLED in JS source. Verify with a direct query, never by eyeballing.
- Standing rule: SQL strings embedded in JS with literal string values need
  escaped inner quotes or a different outer delimiter (confirmed crash:
  27d8b00).
- Standing rule (REINFORCED this session): when a fix does not fully take,
  or when a bug keeps resurfacing in a new place after being "fixed,"
  suspect duplicated logic across multiple surfaces before writing another
  patch. This session's AppCard/DeviceStatusPill/patchStatusMap chain was
  four instances of the same root cause discovered one at a time because
  each fix was verified narrowly (does this ONE surface look right now?)
  rather than broadly (are there OTHER surfaces reading the same
  conceptual data through different code?). Next time a status-like value
  needs fixing, grep for all render sites FIRST, not one at a time.
- Standing rule: never assume a DB row's existence means a feature is
  correctly working. This session's 1Password investigation started from
  a June 26 CONTEXT.md note ("confirmed installed, both devices") that
  turned out to be a query result, not a filesystem check -- the row
  existed, the app didn't. Verify claims about physical machine state
  against the actual machine, not just the database's belief about it,
  before treating a database fact as ground truth.
- Standing rule (NEW, July 6): before any `railway up`, confirm the
  linked service first (`railway status` or `railway service <name>`).
  A misdirected deploy this session put orchardpatch-server's Node code
  onto the Postgres service and caused a multi-day outage. See the
  Production incident section above for full detail.
- Standing rule (NEW, July 6): credentials never get typed into the Chip
  chat, no exceptions, even mid-incident under pressure to unblock a
  single check fast. Held for both DATABASE_URL and SERVER_TOKEN this
  session. If Chip needs an authenticated value, retrieve it through a
  local env var or the Railway CLI's own variable access on Chip's
  machine, never by Jude pasting it into the conversation.
- CRITICAL: Never use Tailwind utility classes for layout, spacing, or
  color in the orchardpatch frontend -- Tailwind v4 purges utility classes
  in newly-added/heavily-modified files not referenced elsewhere in the
  bundle. Inline style props only.
- Chip prompts go in code blocks for direct copying.
- For large Chip output: write to a file on the Desktop, Jude copies from
  a text editor (Telegram blocks large clipboard copies).
- Claude.ai is better for: architecture decisions, code scaffolding,
  debugging topology/design issues, cross-repo reasoning, spec writing.
- Chip is better for: codebase-aware implementation, exact file locations,
  running commands, hot-deploying to the installed agent.
- Use Opus for: complex ambiguous architecture decisions, multi-tenancy
  design, Cultivation policy engine, version-resolver redesign, YC
  application writing, decisions with multi-week downstream consequences.

## Three-channel chat architecture (OrchardPatch project)
1. "Architectural Deep Dives" -- Opus. Cross-repo architecture,
   multi-tenancy, Cultivation policy engine, version-resolver redesign, YC
   application, multi-week-consequence decisions.
2. "Troubleshooting" -- Sonnet. Isolated bug fixes needing focused
   attention.
3. Daily implementation chat -- Sonnet. Ongoing dev work (this session's
   channel).

## Go-to-market
- Target: MacAdmins Slack (70k+ members), Jamf Nation, PSU MacAdmins.
- Distribution: bottom-up adoption, individual Mac admins champion
  internally.
- Key pitch: "Jamf App Catalog shows you what you told it to track.
  OrchardPatch shows you everything that's actually on your fleet."
- Competitive window: 18-24 months before Jamf App Installers become a
  real threat. Build fast.

## Competitive: how the category handles identity
Compressed, unchanged this session. Jamf App Catalog: human-curated,
bundle-ID-anchored (~700-800 titles, paid team). Jamf Title Editor: custom
external patch source built on Kinobi (acquired 2021) -- proof the gap
OrchardPatch fills is real enough that Jamf productized a bridge for it.
CONCLUSION: curation is the design, not a workaround -- both authoritative
players curate because heterogeneous vendors + no version-API standard +
same-named variants don't admit a fully-derived solution. Installomator
maintainers have hit same-name collisions before (VirtualBox/BoxDrive,
Parallels-bundled Edge), solved at install-detection not cataloging -- the
variant problem is familiar to them, not foreign.

## Installomator maintainer outreach strategy
Unchanged, not yet executed. Gates: demo video, waitlist live, polished
repo. Contribution-first approach: attribution already live in UI/site,
file real bugs (coconutBattery HTML response is the confirmed opener), ask
what roadmap items the 2-device fleet could help test. Key framing:
distribution channel, not competitor. Future: Homebrew/mas support should
be org-level opt-in, be upfront with maintainers before surprising them.

## Copy standards, patch naming hierarchy, UI homes, pricing tiers,
## routing structure, patch modes -- UNCHANGED this session
See prior CONTEXT.md revisions for full detail (Patch naming: Fruit/Branch/
Bushel/Orchard/Cultivation; copy rules: no em dashes, no emoji, title case,
no possessives; routing: /dashboard /apps /apps/[id] /catalog /devices
/devices/[id] /patch-history /orchard; patch modes: silent/managed/
prompted). No changes touched these systems this session.

## Lessons learned (July 2-6, 2026 -- lifecycle events + Postgres incident)
- A cheap fix and a thorough fix can both technically work, and the
  audience is a legitimate tiebreaker. Rejected a single first_seen
  column (cheap, partial) in favor of a real event log (thorough,
  complete) specifically because "more visibility for mac admins" is a
  standing product principle, not because the cheap option was wrong on
  its own terms.
- An idempotency bug in an event log is a different class of problem than
  an idempotency bug in a state-flip operation. resolveSettledConflicts()
  (an UPDATE that either flips a boolean or does nothing) is naturally
  safe to call redundantly. A naive removal-detection INSERT is not --
  "this app is currently stale" stays true indefinitely once true, so an
  ungated periodic pass would write a duplicate event every single time
  it ran. The fix (compare against the most recent event's type, not just
  current staleness) was the actual hard part of this feature, not a
  footnote to it.
- An audit finding that "returns rows" is not the same as an audit finding
  that's correct. A join-key audit initially reported JOIN devices d ON
  d.id = a.device_id when the actual working pattern (used in every query
  shipped earlier in the session) was the same shape but the audit's own
  restated version of the diagnostic query had gotten transposed against
  what was later re-verified. The fix wasn't to trust "it ran without
  error and returned plausible data" -- it was to re-run both candidate
  joins side by side against the real schema (CREATE TABLE statements
  quoted verbatim) before writing anything permanent on top of the
  assumption.
- Verification depth should match consequence, not confidence. 1Password
  got full rigor (bundle ID read directly off the filesystem, cross-
  referenced against a screenshot). Teams and Telegram, sitting right next
  to it in the same stale-row list, initially got waved through on weaker
  evidence (an agent log's absence of skip messages) purely because they
  seemed like "the same kind of thing." They turned out to be correct
  once actually re-checked with the same rigor, but that was fortunate,
  not earned -- the gap in verification depth was real and got called out
  before shipping further.
- A plausible causal story is not a confirmed one. Chip proposed "the
  server crashed because it tried to insert into a table that didn't
  exist yet, which brought down Postgres" -- a Node app's own query error
  cannot crash a separate database service. The actual cause (a
  misdirected deploy landing on the wrong Railway service) was simpler
  and already partially known; the appealing-sounding wrong story would
  have sent debugging in the wrong direction if accepted uncritically.
- A dashboard status badge and a CLI status command can both be "true" and
  still disagree, because they're often answering different questions
  (service definition active vs. instance actually running). When they
  conflict, a direct connection test (attempting to actually talk to the
  thing) is the real tiebreaker, not picking whichever UI is more
  convenient to trust in the moment.
- Fixing a symptom (healthcheck timeout too short) without fixing the
  underlying coupling (startup blocked on a slow dependency, health
  endpoint unable to report the truth) means the same failure returns the
  next time the dependency has any hiccup, however brief. The timeout bump
  was necessary and correct, but shipping only that would have been a
  workaround wearing a root-cause fix's clothes.
- Credential discipline has to hold under real pressure, not just in the
  abstract. "Just paste the token so I can check one thing fast" is
  exactly the framing that makes an exception feel reasonable in the
  moment, mid-incident, wanting a quick answer. The rule existing for
  DATABASE_URL already didn't automatically transfer psychological weight
  to SERVER_TOKEN until it was explicitly named as the same category of
  risk.
- An AI dev assistant's own failure mode ("provider rejected the request
  schema" echo loop) can look like a conversation derailing when it's
  actually an infrastructure problem on the assistant's host platform, not
  a signal to change approach or push harder. Restarting the session
  cleanly and resuming with one small, self-contained message was the
  right move, not troubleshooting the loop's content.

## Lessons learned (July 1-2, 2026 -- soft-delete Parts 1-3)
- A DB row existing is not the same as a feature being installed. The
  1Password "confirmed installed" note from June 26 was a query result
  being mistaken for a filesystem fact. When soft-delete made that
  distinction load-bearing (last_seen staleness now had real product
  consequences), the gap surfaced immediately. Verify physical machine
  state against the actual machine when a claim about it is about to
  drive a destructive-adjacent feature.
- Column type and clock source are two separate bugs that look like one
  bug. apps.last_seen was TEXT AND agent-clock. Fixing only the type
  without fixing the clock source (or vice versa) would have left a
  half-working predicate. Both had to be audited explicitly, not assumed
  correct because the column existed.
- A safety guard that only lives in the UI is not a safety guard. The
  removal predicate had to be verified in the actual patch-queueing SQL
  (POST /patch and friends) BEFORE any frontend work started, specifically
  because Branch/Bushel/Orchard build their target lists server-side with
  no human in the loop per-target -- there was no button to grey out for
  those three tiers, only a query to filter. Fruit at least has a
  human-reviewed button in front of it; the other three tiers do not, and
  a UI-only fix would have left them fully exposed while looking finished.
- The same conceptual value can be computed independently in many places
  without anyone deciding that on purpose. Status/removal state had 4
  independent implementations by the time this was caught (server CTE,
  server listing query, client dedup map, client card fallback). None of
  these were built maliciously or lazily -- each was the correct local fix
  at the time it was written. The debt accumulates from correct local
  decisions, not from carelessness. Filed as an architectural item rather
  than continuing to whack-a-mole a fifth instance.
- When a fix "doesn't take" or the same bug reappears in a new location,
  that is the signal to grep for all render/computation sites for that
  conceptual value BEFORE writing the next patch, not after. This session
  wrote four sequential fixes because each verification pass checked only
  the specific surface just fixed, not siblings computing the same thing.
- Rejecting a cheap fix in favor of a root-cause fix is sometimes the
  difference between "looks fixed" and "is fixed" even when the cheap fix
  produces no visible error. patchStatusMap[bid]?.status ?? "unknown"
  would have made the bug harder to find later, not easier -- a
  removed app silently mislabeled "Unknown" is arguably worse than one
  mislabeled "Outdated," since it looks resolved rather than looks wrong.
- Skepticism from the person driving the session ("are we sure? this needs
  to be a REAL FIX, we're close to prod") directly prevented an incomplete
  soft-delete ship. The frontend-only version of Part 3 was one relay away
  from being sent before that pushback triggered the patch-path audit that
  found Branch/Bushel/Orchard had zero removal awareness.

## Lessons learned (June 26, 2026 -- Phase 1 implementation, Sonnet)
Compressed, unchanged. Verification found a 5th MAS gate the spec missed
(always verify the full write surface for any DB invariant). A wrong
inference in Opus is still an inference -- Telegram was correctly closed by
verification, not by re-trusting the earlier Opus conclusion. Context
compaction loses verification state but not code changes -- recovery is to
resend queries, not re-implement. Single quotes inside single-quoted JS
strings crash Node exactly like other delimiter collisions. Safety checks
must live at the server, not only the UI (this lesson directly informed
this session's insistence on the patch-path audit before frontend work).

## Lessons learned (June 26, 2026 -- multi-variant identity, Opus session)
Compressed, unchanged. One bug was a class, not an instance. Intrinsic vs
name-derived is the identity distinction that matters. A wrong mapping is
worse than a missing one. The conflict flag cannot catch what destroys its
own evidence. Don't ship a destructive operation whose correctness rests on
an unverified assumption (this directly produced the soft-delete design
that shipped this session). Curation is the design, not a workaround.

## Lessons learned (June 26 -- branch-patch fallout, zoom root cause)
Compressed, unchanged. A bug can hide under multiple correct-looking
fixes -- run a diagnostic query before the next fix, not after. JS silently
corrupts regex backslashes bound for PostgreSQL. Display and comparison are
different concerns needing different version values. Counts must have ONE
source (this lesson's incompleteness -- it fixed counts but not per-item
badges -- is exactly what surfaced again this session).

## Lessons learned (June 22-25 -- console redesign, Phase 6, resolver work)
Fully compressed, unchanged, no new relevance this session. See prior
CONTEXT.md revisions if full detail is needed: WebKit backdrop-filter
compositing-layer clipping, Tailwind v4 purge behavior on shadcn
components, node-fetch v3 ESM-only import, FOR UPDATE vs grace-period
locking, LaunchDaemon plist secrets exposure, DEBUG=1 not skipping
downloads, Python heredoc escape mangling, execSync ETIMEDOUT in root
LaunchDaemon environments.

## Waitlist page (orchardpatch-waitlist repo)
Unchanged this session. Live at https://orchardpatch.com. Next.js 16.2.0,
Tailwind v4, Resend, Google Sheets API dual-write, Vercel auto-deploy.
GitHub PAT does not scope to this repo -- SSH only. Light mode, macOS
Finder-inspired aesthetic. Brand names (Fruit/Branch/Bushel/Orchard/
Cultivation) kept off the page. No vendor name-drops. Installomator
mentioned in patching context only, never discovery.

## Brand color note
Unchanged. Console accent #3d7a42 (hunter green, WCAG AA 5.2:1 on white).
Mint sibling #74cc7c for dark mode/sidebar wordmark. Lime #7dd94a retired
from console, kept on marketing/waitlist only. Token system: primitives
hold raw hex, semantic tokens expose --accent/--sidebar-accent, components
reference semantic only.