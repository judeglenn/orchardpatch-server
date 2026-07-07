# OrchardPatch -- Project Context

Last updated: July 7, 2026 (morning session). PRIORITY: DEMO-READY (set
July 6, continued this session). Work this session: (1) merged part3-touchup
to main (em-dash/EmptyCell cleanup, Dashboard removal guard, default-hide for
removed apps); (2) removed the stale Version Conflicts stat card from App
Inventory; (3) committed design-reference/ files (3 HTML specs +
build-spec.md) as design system source of truth, cleaned up a throwaway
devtools-audit.mjs script; (4) root-caused and fixed a false "No fleet data"
banner rendering over pages with live fleet data (AgentBanner was doing an
independent health check against a different endpoint than the page data,
the same status-duplication bug class documented below); (5) five small
screenshot-pass fixes: em dashes to middots in patch modals and tooltips,
Removed apps grouped into a collapsed section on device detail (matching the
existing System Apps pattern), PyCharm CE and Microsoft Teams classic now
show correct curated display names fleet-wide, Docker version-delta text
clipping fixed, Patch Status bar reordered below the stat cards on App
Inventory. All work driven by a screenshot pass ahead of splash page / demo
screenshots. See "Session close state" at the bottom for exactly where
things stand and what to do next.

Tip of orchardpatch-server: main is 362e7fb (Fix 3, curated app_name
COALESCE on /apps/status). Tip of orchardpatch (frontend): main is 0aab011
(five screenshot-pass fixes merged). part3-touchup, the Version Conflicts
removal, and the design-reference commit are all folded into main as of this
session. No outstanding frontend branches.

---

## CURRENT PRIORITY: DEMO-READY (set July 6, 2026 evening)

The north star is now a polished preview site plus a demo video to take to
MacAdmins Slack. Interest equals traction equals leverage for a loan,
investors, or paying clients. Reasoning: significant money already spent
building; the fastest path to converting that from sunk cost to asset is
validated interest, not more correct internals. Cut scope to what a demo
viewer sees. Defer everything invisible.

What the demo needs, in priority order:
1. The console has to look clean on the surfaces that get filmed (Dashboard,
   App Inventory, App detail, Device detail). No visible glitches. STATUS
   (updated this session): substantially done. Em-dash cleanup, orphan-card
   hide, Version Conflicts removal, the false "No fleet data" banner fix,
   Removed-app grouping, PyCharm CE/Teams naming, and the Docker clipping fix
   all landed and verified live this session. One more full visual pass on
   production recommended before actually taking screenshots, since
   verification happened in stages across a couple of Chip session resets.
2. The lagging state has to render correctly and legibly on at least one real
   app. Lagging is THE differentiator and the demo centerpiece. NOT touched
   this session.
3. A product screenshot on the waitlist site (the site currently tells and
   never shows -- a visibility product with no product shot asks for faith).
   UNBLOCKED now that the console is demo-clean.
4. A lagging-state section on the waitlist site with the security framing (the
   differentiator is currently absent from the marketing page). Copy is
   drafted, still BLOCKED on the three lagging-UI value labels from Jude.
5. A demo script that walks the lagging story clearly.
6. A polished repo for the curious admin who clicks through.

Demo hazards / constraints:
- Do NOT patch 1Password live on camera. It no longer exists on the fleet at
  all (rolled back to 1Password 7 on both machines), and patching it would
  reproduce a vendor CDN staged-rollout lag loop. Pick a different demo app.
- Pick and VERIFY a safe app to show the lagging state on, and a safe app to
  show a clean patch on, before filming. Easy to skip, painful to discover live.
- zoom.us is a clean "Current" example (7.1.0 (83064) vs 7.1.0.83064).

Everything invisible to a demo is deferred until after preview validation.

---

## WAITLIST SITE POSITIONING (decided July 6, 2026 evening)

Live at https://orchardpatch.com (orchardpatch-waitlist repo). The current copy
is strong; the visual design is good. The gaps are content, not design.

DECIDED positioning changes (a page-wide framing pass, not one line):
- OrchardPatch STANDS ALONE. It is a complete fleet app inventory and patch
  tool. MDM compatibility is a BONUS FEATURE, not the organizing premise.
- NO-MDM operation is a WEDGE, not a footnote. A shop with no MDM is a target
  customer. The current page assumes the reader has an MDM in three of five
  sections; that accidentally excludes the no-MDM segment. Demote MDM to one
  card plus compatibility clauses. Lead with it nowhere.
- Do NOT delete the MDM story -- Jamf/Kandji shops care about "does not fight
  my MDM, no Secure Token needed." Demotion, not deletion.

APPROVED copy edits (ready to apply now that screenshots are unblocked):
- Hero solution triad: drop "Zero friction." New: "Full visibility. Smart
  patching." (two beats, no SaaS tell).
- Definition one-liner (place BEFORE the problem section): "OrchardPatch is an
  agent-based app inventory and patch tool for macOS fleets. No MDM required.
  If you run one, it works alongside without touching it."
- Hero value-prop line: reframe from "without touching your MDM" to "no MDM
  required" (strength claim, not compatibility claim).
- Italic subhead "Your MDM handles enrollment..." must go/invert -- it makes
  MDM primary. Replace with something standalone, e.g. "One agent per Mac.
  Full inventory, real patching, no MDM stack required."
- Solution section headline "works alongside your existing MDM. Not against
  it." -> standalone, e.g. "Full visibility. Real patching. One lightweight
  agent." MDM-safe point lives inside the MDM-Safe Patching card.
- Soften "Patch with One Click" -- "one click" is a marketing tell admins
  distrust. Lead with the honest Silent/Managed/Prompted detail instead.
- Cut "Version conflicts and" from step 2 ("Version conflicts and outdated
  apps surface automatically") -- the Version Conflicts card was removed from
  the actual product this session (see below) and the conflict comparison
  over-reports. Promise only what's solid. This copy edit is now doubly
  justified: it matches both the known resolver bug and the actual current
  product surface.
- CUT the stock orchard video (person carrying an apple). It reads as generic
  marketing and undercuts the domain credibility the copy earned. If motion is
  added later, use real product footage (console, lagging state updating).

DRAFT lagging-state section (adjust to match the actual lagging UI + screenshot):
  Eyebrow: THE GAP NOBODY ELSE SHOWS
  Headline: Know when you are exposed, not just when you are behind.
  Body: A vendor ships a security fix. Your patch tooling has not caught up
  yet. That window, where the fix exists but you cannot deploy it, is exactly
  when the vulnerability is public and unpatched on your fleet. OrchardPatch
  tracks two versions for every app: the newest release the vendor has shipped,
  and the newest version your patch source can actually install. When those
  diverge, you see it. Most tools only compare installed against installable
  and call it current. They cannot show you a gap they do not track.
  Caption: Installed, patchable, and vendor-latest, side by side. The lagging
  state is the difference the others hide.

STILL NEEDED from Jude before the site copy package is final: the exact three
values and labels the lagging UI displays (installed / patchable / vendor-latest
wording) so copy and screenshot line up. THIS IS THE SINGLE BLOCKING INPUT on
finishing the waitlist copy package; everything else in the package (the
approved copy edits, the positioning reframe, cutting the orchard video) is
unblocked and can proceed independent of this.

Existing waitlist page facts: Next.js 16.2.0, Tailwind v4, Resend, Google
Sheets API dual-write, Vercel auto-deploy. GitHub PAT does NOT scope to this
repo -- SSH only. Light mode, macOS Finder-inspired aesthetic. Brand names
(Fruit/Branch/Bushel/Orchard/Cultivation) kept off the page. No vendor
name-drops. Installomator mentioned in patching context only, never discovery.

---

## What OrchardPatch is
A Mac admin tool providing complete visibility into managed macOS fleet apps
and patching via Installomator, with no MDM required (MDM compatibility is a
bonus). In-app tagline: "See Everything. Patch Anything. Break Nothing."

Category: endpoint/patch management software (agent-based SaaS). Not pure
SaaS, requires a LaunchDaemon agent on each managed machine. Closest analogues:
Kandji, Mosyle, Addigy. Security angle is real: OrchardPatch surfaces unknown
apps, outdated apps with CVEs, and the lagging state (vendor shipped a patch,
Installomator has not caught up, the exact window attackers exploit). Security
positioning is secondary to the Mac admin audience in in-app UI copy; it is the
lead for waitlist/outreach framing where there is room to make the case.

## Parent Brand (Future)
GraftKit, the cross-platform umbrella brand when OrchardPatch expands beyond
macOS (Windows, Linux). OrchardPatch becomes the macOS product under the
GraftKit family. Competing at that scale: NinjaRMM, ConnectWise, Automox.
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
  - Preview URLs: orchardpatch-git-<branch>-judeglenns-projects.vercel.app
    (team slug is judeglenns-projects, NOT judeglenn). Preview deployments
    build for non-main branches (confirmed active).
- Waitlist: github.com/judeglenn/orchardpatch-waitlist
  - Local: ~/Projects/orchardpatch-waitlist
  - Deployed: https://orchardpatch.com (marketing/waitlist page)
  - NOTE: GitHub PAT does not scope to this repo. Push via SSH only.

## Stack
- Fleet server: Node.js/Express on Railway
- Database: PostgreSQL (Railway-hosted), schema auto-migrates on startup
- Web app: Next.js 14 (App Router), TypeScript, Tailwind, deployed on Vercel
- Waitlist: Next.js 16.2.0, Tailwind v4, Resend, Google Sheets API, on Vercel
- Agent: Node.js LaunchDaemon (root), local HTTP on port 47652
- Auth: x-orchardpatch-token header, SERVER_TOKEN env var

## Environment variables (Railway -- fleet server)
- DATABASE_URL: PostgreSQL connection (Railway env ref)
- SERVER_TOKEN: auth token for all API endpoints (rotated June 13, 2026)
- GITHUB_TOKEN: fine-grained PAT for catalog-sync GitHub API calls
- PORT: set by Railway
- DATA_DIR: data directory

## Vercel environment variables (frontend)
- LOGIN_PASSWORD: passphrase users enter to access the app
- SESSION_SECRET: static random string stored in session cookie, validated by
  middleware
- FLEET_SERVER_URL: Railway fleet server URL (non-public, server-side only)
- FLEET_SERVER_TOKEN: token for proxy-to-fleet-server calls (non-public,
  server-side only, sensitive in Vercel, cannot be read back from UI)
  All fleet calls go through the proxy layer as of Phase 5 (June 16).
- NOTE: FLEET_SERVER_TOKEN and FLEET_SERVER_URL confirmed set for BOTH
  Production and Preview scope. So preview deployments DO have fleet access.

## Vercel environment variables (waitlist)
- RESEND_API_KEY: Resend API key for owner notification emails
- WAITLIST_SHEET_ID: Google Sheet ID for signup capture
- GOOGLE_SERVICE_KEY: Google service account JSON key for Sheets API
  All three confirmed set in Vercel production as of June 21. Not in
  .env.local, expected for local dev.

## Agent environment variables
- SERVER_URL: fleet server URL
- SERVER_TOKEN: matches fleet server
- VERSION_CHECK_INTERVAL: check-ins between version runs (default: 10)
  INSTALLOMATOR_PATH is NOT an env var; agent discovers Installomator by
  checking a path list in order. launchctl kickstart -k does NOT re-read plist
  EnvironmentVariables; changing an env var requires full unload/reload
  (bootout/bootstrap), not kickstart.
- GITHUB_TOKEN: read from /etc/orchardpatch/config.json (githubToken field) via
  applyConfigEnv() in scheduler.js, runs once at startup before any version
  check fires. Falls back to process.env.GITHUB_TOKEN if absent. Renewed
  May 12, 2026, scoped to all public repos; tighten to Installomator repo at
  next rotation.

## config.json structure
File: /etc/orchardpatch/config.json. root:wheel 600 on both machines.
  {
    "server": { "url": "...", "token": "<SERVER_TOKEN>" },
    "githubToken": "<GITHUB_TOKEN>"
  }
Read path: d["server"]["token"] (NOT a flat serverToken key, corrected
June 22). applyConfigEnv() in scheduler.js reads this at startup and writes into
process.env so child processes (version-checker spawns) inherit it.

## Installomator path and version
- Canonical pkg-managed path: /usr/local/Installomator/Installomator.sh
- Legacy manual path: /usr/local/bin/Installomator.sh (do not rely on this)
- patcher.js INSTALLOMATOR_PATHS order: pkg path first, /usr/local/bin/ second.
- Current version on both machines: v10.8 (2025-03-28), installed via catalog
  deploy June 16.
- Installomator points to v10.8 pkg. v10.9beta (main branch) is what catalog
  sync pulls fragment data from. v10.8 (release branch) is the stable installed
  binary.
- OrchardPatch postinstall script installs Installomator to /usr/local/bin/,
  conflicting with pkg convention. Tech debt, see open items.

## Architecture decisions
- Agent to server: REST polling only, no WebSocket. Server cannot reach agents
  directly (Railway to NAT'd agent does not work). Version data is
  agent-initiated push, not server-pull.
- Agent loop split (Phase 6): fast loop 60s (pending_commands + pending_patches,
  first tick at 15s), slow loop 15min (full inventory + version checks). Two
  independent timers, no coupling. Fast loop must not serialize behind a running
  Installomator process.
- Force check-in: server writes a check_in row to pending_commands; agent fast
  loop picks it up, runs the slow-loop inventory body immediately.
- Patching via Installomator only. Post-patch: agent immediately ingests
  confirmed version, triggers inventory check-in, no staleness window.
- Vercel deploys automatically via GitHub integration on push to main. Preview
  deployments build for non-main branches.
- Auth wall: Next.js middleware, two-env-var design (LOGIN_PASSWORD +
  SESSION_SECRET). Placeholder until multi-tenancy is built.
- Installomator does NOT read NOTIFY/DEBUG/etc from environment. Only positional
  KEY=VALUE arguments override defaults. DEBUG=1 as a positional arg skips only
  the INSTALL step, not the download.
- Agent secrets live in /etc/orchardpatch/config.json, root:wheel 600. Plist
  contains no secrets.
- Exit code 23 = "App previously installed from App Store, Installomator
  respects the MAS installation and will not overwrite." Correct behavior.
- All fleet server calls from frontend go through Next.js proxy routes (Phase 5,
  June 16). No direct browser-to-fleet-server calls exist.

## Chip's dev environment (confirmed this session, July 7)
- `trash` CLI: present at /usr/bin/trash. Was already installed, no action
  needed.
- `psql` CLI: was installed but not linked on PATH. Fixed via
  `brew link --force libpq`. Now confirmed at /usr/local/bin/psql,
  PostgreSQL 18.4.
- Both tools verified on PATH via `which trash psql` and version checks
  before this session closed.

## Phase 6 force check-in -- SHIPPED June 22, 2026
Designed in Opus, implemented and verified on both machines. terminate_stuck_job
shared recovery function, 30-min staleness sweep, 24h expiry cron (casts
created_at::timestamptz), pending_commands table, ENQUEUE_ALLOWED allowlist as
the auth boundary, force check-in button on device detail page, undo affordance
(amber countdown) for silent patches within 15s of queueing. KNOWN RACE
(documented in code, ~1ms window in deferred enqueue guard), fix before
multi-tenancy: wrap in FOR UPDATE transaction.

## Patch History UI -- overhauled June 22, 2026
Flat chronological list, formatDateTime ("Jun 22, 2026 at 6:32 PM"), TL;DR
exit-code summaries (0=success, 23=MAS, 16=download failed, 11=checksum
mismatch, other=see log).

## version-checker.js architecture (rewritten June 16 evening)
DEBUG=1 does NOT skip downloads, only the install step; this is why large labels
were timing out (genuinely downloading the full artifact before appNewVersion
logged). Fix: async spawn, stream stdout, kill the process the moment
appNewVersion= appears, before download starts. 12s hard timeout backstop.
Version-shaped guard on captured value (^\d+\.\d) rejects non-matching captures
to null.
STATUS: 34/47 labels populated as of June 22.
STRATEGIC NOTE: this is a flagged stopgap. Latest-version resolution is global,
not per-device; belongs server-side (Phase E, deferred).
CAVEAT: even a correctly-captured version can be optimistic relative to what the
vendor's unversioned download URL actually serves at patch time (staged
rollouts). Not a scraper bug, a property of unversioned vendor URLs.

## Patchable pipeline architecture -- perfect-world target (Phase E, deferred)
Design intent captured for when the Opus Deep Dive opens. Not yet built.
- Resolution is a GLOBAL fact, not per-device; current per-agent scraping
  computes the same answer N times and pays the download cost N times.
- Target: agents only report installed versions and run patches, no resolution
  logic. One server-side resolver reads each Installomator label's version
  SOURCE directly (most labels compute appNewVersion from a small API call, not
  a 150MB download). Fall back to the existing multi-source resolver, then a
  controlled server sandbox as last resort.
- MUST honor each label's versionKey (default CFBundleShortVersionString, some
  labels override to CFBundleVersion), a latent source of installed-vs-patchable
  mismatch if ignored (the zoom.us "7.1.0 (83064)" vs "7.1.0.83064" shape is
  exactly this).
- Hard part (why this is Opus): 1,137 labels with heterogeneous resolution logic
  (JSON API, HTML scrape, Sparkle feed, GitHub releases). No single parser.
- PREP TASK (not started): installomator-reference.md, a derived, dated
  engineering reference of Installomator documented behavior. Build in the SAME
  session that opens the Phase E Deep Dive so it is fresh in context. Same
  treatment for a Title Editor teardown (competitive).

## Two-table write pattern (complete as of June 13)
pending_patches (agent work queue, fast-loop polled) and patch_jobs
(history/audit log) written atomically at queue time, patch_jobs.id =
pending_patches.id. For silent patches, pending_patches is withheld 15s (undo
window); patch_jobs written immediately. Completion side: patch.id threads
through pollAndRunPatches -> runPatchJob -> createJob -> reportPatchJob; ON
CONFLICT(id) DO UPDATE transitions queued -> success/failed.

## Agent job execution model
Fast loop (60s): fetch pending patches, claim (409-safe), fire without await
(proc.on('close') is the report path), poll pending_commands,
claim/execute/complete. Two report paths exist, both idempotent; reportPatchJob()
in checkin.js is dead code post-Phase-6 (kept, not cleaned up). "Claimed but
abandoned" gap resolved by the 30-min staleness sweep. patch_jobs.status never
transitions to in_progress/running by design; stays queued until cancelled or
completion reported.

## Version model -- two-number system (locked June 22)
Two numbers, two pipelines:
- latest_patchable: what OrchardPatch can deliver now (Installomator-sourced).
- latest_available: newest release the vendor has shipped (server-side
  multi-source resolver: Homebrew, Sparkle, GitHub, later mas).
"Outdated" is not boolean; four states from the relationship between
installed/patchable/available: current, patchable, lagging (vendor ahead of
Installomator), unknown. "Show both, the gap is a feature"; lagging is the
product wedge AND the automated Installomator-contribution signal.
Identity keyed on installed app's real bundle ID via app_identity mapping table
(bundle_id dead in the FRAGMENT corpus specifically). Curated identity mappings
live in DB rows (curated=true), not a file; multi-tenancy is the decider. Failed
version coercion resolves to Unknown, never Current.
Build order: Phases A-C shipped. Phase D absorbed into console redesign. Phase E
deferred (has a designed target).

## Version normalization (locked June 26, 2026)
The most repeated bug class this project has hit.
- ONE shared definition: normalizeVersion in src/lib/utils.ts (frontend).
- Three steps in order: strip comma suffix ("12.8,282010"->"12.8"), strip
  parenthetical build suffix ("7.1.0 (83064)"->"7.1.0"), truncate to three
  segments ("7.1.0.83064"->"7.1.0").
- normalizeVersion is for COMPARISON/STATE DERIVATION ONLY. Display always shows
  the raw, full version string.
- Server-side, same normalization as nested regexp_replace in SQL, appears in
  three queries (GET /apps/status, GET /devices outdated_count,
  GET /api/stats/patch-status); must stay in sync.
- CRITICAL escaping rule: every backslash in a regex bound for PostgreSQL must
  be DOUBLED in JS source ([0-9] not \d, \\1 not \1, \\s \\( \\) \\. not
  \s \( \) \.). Single backslashes are silently corrupted by JS string parsing.
  ALWAYS verify with a direct query, never by eyeballing.
- versionGt(a, b): segment-by-segment numeric comparison, directional. Lagging
  requires available > patchable, not mere inequality. NOTE: versionGt lives in
  src/app/apps/[id]/page.tsx (page-local, ~line 89), NOT in utils.ts. (Found
  during the status-consolidation Part 0 verification.)
- FINDING (Installomator docs): Installomator compares for DIFFERENCE, not
  greater-than; no concept of "lagging." versionGt HAD to be built by us, cannot
  be borrowed. Justifies the lagging differentiator; good outreach framing.
- FINDING (Installomator docs): versionKey, which Info.plist field Installomator
  compares against, is configurable per label (default CFBundleShortVersionString).
  Phase E must honor this per-label. Latent mismatch source when agent and label
  read different plist fields.

## Raw version display principle (locked June 26, 2026)
Display raw, unmodified version strings everywhere version detail appears (hero
card, fleet rows, patch button labels). Normalize only behind the scenes for
badge/state derivation. Transparency is the product pitch; never hide build
numbers to make a comparison look clean. Canonical example: zoom.us shows
INSTALLED "7.1.0 (83064)", PATCHABLE "7.1.0.83064", badge Current, both raw
strings visible.

## Empty-cell display standard (July 6 2026 evening)
Empty table cells (no latest version, no patch action) render via a shared
EmptyCell component (deliberately blank, preserves row height and grid
alignment), NEVER a typed glyph. This replaced a scattered 20-site convention of
inline em-dash placeholders with no shared constant. EmptyCell is the copy-
standard enforcement point that never existed. When a new table cell needs an
empty state, use EmptyCell, do not type a dash.

## Canonical patch-status counts (shipped June 26, 2026)
Problem: outdated/current/etc counts were computed in 4+ places with 4+
different results (Dashboard vs Fleet page disagreed). Fixed with a single
source for FLEET-WIDE COUNTS specifically:
- GET /api/stats/patch-status: DISTINCT ON CTE, dedup by COALESCE(bundle_id,
  name), worst-case-wins (outdated > unknown > current > na). Returns
  { outdated, current, unknown, system, store, total }.
- Consumers: Dashboard metric cards, App Inventory stats bar, Fleet page
  Outdated stat card. Per-device badges on Devices list stay device-scoped.
NOTE: this fixed the COUNTS, not per-item status badges. See "Status computation
duplication" in Open items. That same class of bug is what the (now parked)
status-consolidation refactor was built to kill, and what the AgentBanner false
positive (this session, see below) turned out to be a fresh instance of.
KNOWN INCOMPLETE, RESOLVED THIS SESSION: the old "Version Conflicts" stat card
on App Inventory was supposed to be removed and was not, until this session
(see "Version Conflicts card removed" below).

## Resolver architecture (Phase B + C shipped June 23, 2026)
- src/lib/resolvers/homebrew.js: resolveHomebrew(pool). Fetches
  formulae.brew.sh/api/cask.json, multi-index lookup (label token, artifact .app
  name, cask name array), writes homebrew_cask to app_identity.
- src/lib/resolvers/sparkle.js: resolveSparkle(pool). sparkle_feed_url rows,
  fetches XML, extracts version. See "Sparkle resolver fix" below for the
  corrected extraction logic.
- src/lib/resolvers/github.js: resolveGitHub(pool). github_repo rows, GitHub
  Releases API. Currently empty (no github_repo rows populated yet).
- src/lib/resolver-cron.js: coordinator. Promise.all across all three, merges by
  trust order (homebrew < github < sparkle), writes resolved_versions. Fires 30s
  after startup, then every 24h. runCollisionDetector() call site wrapped in
  .catch().
- conflict = true when sources disagree on major/minor. KNOWN BUG: comparison
  does not apply normalizeVersion before comparing, so format-only differences
  get flagged. Filed, still open. NOTE: this bug is DISTINCT from the Version
  Conflicts card removed this session (see below); removing the card did not
  fix this underlying comparison bug, it only stopped surfacing a misleading
  number derived from it.
- Homebrew name-based fallback matching (priorities 2-4) can let two distinct
  bundle IDs collide onto the same cask; this was the root of the multi-variant
  identity problem, fixed by Phase 1.

## Sparkle resolver fix -- SHIPPED to main (July 6, 2026 evening)
Root cause: resolveSparkle read sparkle:version FIRST (the build number), with
sparkle:shortVersionString only as a fallback that never fired because build
numbers are always truthy. This stored build numbers as latest_available,
producing FALSE lagging states (Telegram latest_available was "282010", a build
number, which versionGt read as far ahead of patchable "12.8"). AppCleaner had a
second bug: its feed is in ASCENDING order, so items[0] was the oldest release.
Fix (Option 2):
1. Read sparkle:shortVersionString FIRST, fall back to sparkle:version only if
   shortVersionString is absent. This is the versionKey seam, live.
2. Select the newest item by sparkle:version (build number, a monotonic integer,
   the reliable sort key), then read shortVersionString off that selected item.
   Order by build, store the display version. Applies to ALL Sparkle feeds, not
   just the two named.
3. Did NOT touch TRUST_ORDER / pickWinner precedence. Sparkle beating Homebrew
   is correct by design (vendor real-time vs Homebrew lag) and is what makes
   lagging accurate. The bug was the extracted value, not the precedence.
Verified: Telegram latest_available "282010" -> "12.8" (lagging now correctly
FALSE, patchable 12.8 == available 12.8). AppCleaner -> "3.6.8" (was reading an
old ascending-order item). coconutBattery surfaced as a third affected app,
resolves to "4.3.4b" (see TD-001, non-blocking).

## Multi-variant identity fix -- SHIPPED Phase 1 (June 26, 2026)
Full spec: phase1-identity-spec.md (project file). Compressed summary.

THE PRINCIPLE: identity is the installed app's CFBundleIdentifier. Signals are
either INTRINSIC (bundle_id, _MASReceipt, SUFeedURL, variant-safe) or
NAME-DERIVED (Homebrew casks, Installomator labels matched by display name,
variant-BLIND, "PyCharm" does not carry Pro vs CE). A WRONG mapping is worse than
a MISSING one; fail toward missing, not toward a green button that destroys the
wrong install.

THE FOUR FAMILIES (all resolved, verified via primary sources):
- PyCharm Pro (com.jetbrains.pycharm): label jetbrainspycharm, cask pycharm.
  Correct, protected by curated row.
- PyCharm CE (com.jetbrains.pycharm.ce): NO valid Installomator label exists
  (jetbrainspycharmce is a case alias inside the Pro fragment, product code
  PCP). Curated: label NULL, cask pycharm-ce.
- Teams: NOT a collision. Two distinct apps, distinct labels/casks (classic has
  no Homebrew cask). Validates the detector keys on TOKEN not NAME.
- Canva: MAS half (com.canva.canvaeditor) and direct half
  (com.canva.CanvaDesktop, label/cask 'canva') dissolved by MAS-gating.
- Telegram: ru.keepcoder.Telegram confirmed via primary sources to correctly
  target the telegram label. com.tdesktop.Telegram is a stale orphan.

FIVE PARTS SHIPPED (server commits a3abd19, f4a2011, 6e84fa9, 24940fb, 59264c2;
agent 993a8d0):
0. identity_conflicts table + idempotent MAS cleanup on startup.
1. MAS gates derivation, 5 GATE POINTS (agent catalog.js, /checkin filter,
   identity-bootstrap.js WHERE, homebrew.js NOT EXISTS guard, db.js startup
   cleanup UPDATE).
2. Collision detector (src/lib/identity-collision-detector.js): any
   homebrew_cask/installomator_label held by 2+ distinct non-curated bundle_ids
   is NULLed on all of them and recorded. Keys on shared TOKEN not NAME.
   curated=true rows immune.
3. identity_conflicts table: per (bundle_id, source) pair. Distinct from
   resolved_versions.conflict (version-layer). This IS the curation worklist.
4. Six curated seed rows (curated=true): PyCharm Pro/CE, Teams classic/new,
   Canva direct, Telegram (keepcoder).
5. Patch-path identity guard (src/lib/identity-trust.js):
   isIdentityTrusted(bundleId, label) checked before POST /patch (Fruit, Bushel
   hard refusal; Branch/Orchard per-app skip).

Checkin curated override (59264c2): /checkin looks up a curated=true row before
writing installomator_label, overriding stale agent-reported values. Jude's
pre-Phase-1 agent (device-GJM7N0XGL0) is safe, verified end to end.

identity_conflicts auto-resolution (commit 156858c): resolveSettledConflicts()
runs after every detectAndRefuseCollisions() pass, marks resolved=true for any
token with fewer than 2 non-curated holders. Unblocked the Catalog deploy
button.

Catalog deploy identity guard (June 26, commits 9ee2670, 27d8b00, 1096270):
label-level conflict check for the label-only /patch path. has_conflict boolean
on GET /api/catalog, Deploy button disabled when true. REMAINING GAP: full
isIdentityTrusted() requires bundleId; catalog deploys do not have one. Filed.

DISPLAY NAME UPDATE (this session, July 7): the curated rows seeded in Part 4
now also drive DISPLAY name, not just label/cask trust. See "Curated display
name fix" below. This did not touch the identity/collision logic itself, only
what name renders once a curated row is trusted.

GENERAL MODEL REMAINS OPUS: the 4 known families are fixed; general derivation/
curation/multi-tenancy model is still an Opus Deep Dive. Curation IS the design,
not a workaround (both Jamf and Installomator curate for the same structural
reasons). Next known instance: DaVinci MAS/free.

## Soft-delete app lifecycle -- SHIPPED Parts 1-3, July 1-2, 2026
SOFT-DELETE via last_seen, NOT hard-prune. The agent's per-directory inventory
loop uses catch{continue} silently, so a failed readdirSync sends a zero-app
payload indistinguishable from "user uninstalled everything." Soft-delete makes
that failure a non-event and gives fleet app-history for free.
- last_seen is a positive fact the check-in asserts (server clock, not
  agent-reported time); removal is DERIVED, never a DELETE.
- Removal keyed on CHECK-IN CYCLES: apps.last_seen < devices.last_seen - 45
  minutes (N=3 cycles at 15-min cadence).
- HARD REQUIREMENT (met): the removal predicate is threaded into EVERY count and
  every patch-queueing surface. As of this session, it also threads into the new
  device-detail Removed collapsible section (see below), reusing the same
  removal_state field already surfaced elsewhere, not a new re-derivation.

Part 1 (commits f148600, b2a76b2, 4b4086b, dde38a1): apps.last_seen and
devices.last_seen promoted TEXT -> TIMESTAMPTZ and switched to now() (server
clock) in upserts. pending_patches.created_at cast fix (same bug class). Agent
directory-loop silent catch blocks now log.

Part 2 (commit 156858c): collision detector conflict auto-resolution (see
identity section).

Part 3 (server 30114aa, b562b0c; frontend 8e3a172, e79ae19, fcbf610, 0a4d4f3):
- Server counts + /apps/status gained the removal predicate; /apps/status
  returns removal_state per row as a column (not a WHERE filter, frontend
  decides display).
- Patch-path guards (b562b0c): Bushel/Branch/Orchard exclude removed rows from
  target lists; Fruit (POST /patch) returns 409 on a removed row. VERIFIED
  against the stale 1Password 8 row. A removed app cannot be queued through ANY
  tier regardless of UI.
- Frontend: four rounds threading removal state through per-device rows, the
  outdated filter (patchStatusMap skips removal_state==='removed'), the app
  detail page (activeInstallations), the DeviceStatusPill, and the AppCard badge
  (allRemovedMap). NOTE: this four-round chase is exactly the status-duplication
  problem, filed as an architectural item.

Join key: devices has NO device_id column. PK is id (TEXT, e.g.
'device-GJM7N0XGL0'). All joins use d.id = a.device_id. (CONTEXT.md previously
had a wrong line claiming a devices.device_id column; corrected here. Verified
against live DB: the shipped patch-status CTE join is d.id = a.device_id and is
correct.)

## App lifecycle event log -- SHIPPED (commit 08db542)
Soft-delete's last_seen only tells you CURRENT state. This table records
appeared/removed events over time (the security-narrative payoff: how long was a
vulnerable version present). Rejected a cheaper first_seen column in favor of the
real event log (more visibility for the mac admin audience is the tiebreaker).

Schema:
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
FK is devices(id) (no devices.device_id column exists). app_name and
version_at_event captured redundantly at write time so an event row stays
self-contained.

Write paths: 'appeared' at check-in (RETURNING xmax=0 AS inserted, batched
insert). 'removed' via recordRemovalEvents() reconciliation pass, wired into the
same three call sites as the collision detector. Duplicate-write guard uses a
DISTINCT ON CTE with `le.event_type IS DISTINCT FROM 'removed'`.
Known limitation: no retroactive backfill; history is accurate only going
forward from July 2, 2026.

"Installed since" chip SHIPPED July 6 (GET /apps/:bundleId/first-seen, returns
MIN(occurred_at) for event_type='appeared'; identity header 5th chip, rendered
only when a value exists). A fleet churn/removal report is still not built.

## Production incident -- misdirected deploy crashed Postgres (July 2-6, 2026)
A `railway up` without confirming the linked service deployed the Node server
code onto the Postgres service, crashing the DB for ~3 days. Data was never at
risk (Railway volumes are separate from compute). Recovery: dashboard Restart on
the Postgres service's active deployment. Two real server bugs were then
root-caused and fixed (commit a8f69d3):
- bootstrapIdentity(pool) was AWAITED before app.listen(), freezing the whole
  process on a slow/unreachable DB. Now app.listen() fires immediately and
  unconditionally; bootstrapIdentity and startResolverCron run fire-and-forget.
- /health returned {status:"ok"} unconditionally even in its catch block. Now
  queries the DB (SELECT 1) and returns 503 {status:"degraded"} on real failure.
Healthcheck timeout bumped 30s -> 180s (commit 09a1ba4), necessary but not
sufficient alone. Both devices confirmed checking in post-recovery.

New standing rules from this incident:
- Before any `railway up`, run `railway status` or `railway service <name>` to
  confirm the linked service. As load-bearing as "never paste DATABASE_URL."
- Credentials (DATABASE_URL, SERVER_TOKEN, any token) never typed into the Chip
  chat, no exceptions, even mid-incident. Retrieve via local env var or the
  Railway CLI on Chip's machine. CONFIRMED WORKING CORRECTLY this session: Chip
  used masked connection strings when pulling production identity data for
  verification, no raw credentials appeared in chat.
- Before treating a deployment history entry as current state, confirm which
  entry is ACTIVE/live vs sitting in history.
- Railway dashboard "Online" can reflect the service definition being active,
  not the running instance. Direct connection test (actually talking to the
  thing) is the real ground truth.

## Status computation consolidation -- DESIGNED then PARKED post-preview
Design locked in a Deep Dive (status-consolidation-spec.md). Implementation is
Sonnet-scoped. PARKED after Part 3 when the priority pivoted to demo-ready; it
is real debt but invisible to a demo. Resume only after preview validation.

Shipped and committed (safe to leave in place, no harm, no further extension):
- Part 0: verified inputs. Key findings: grouping is COALESCE(bundle_id, name)
  not strict bundle_id; versionGt is page-local in apps/[id]/page.tsx not
  utils.ts; devices has no device_id column (join is d.id = a.device_id, correct
  in the shipped CTE); /apps/status already carries all six status inputs.
- Part 1: src/lib/app-status.js (deriveStatus + aggregateFleetStatus) with 41/41
  unit tests. Ports normalizeVersion (from utils.ts) and versionGt (from
  apps/[id]/page.tsx) verbatim. deriveStatus taxonomy: system -> system,
  mas -> store, missing patchable or coercion failure -> unknown (never
  current), versionGt(normalize(patchable), normalize(installed)) -> outdated,
  else current. aggregateFleetStatus filters removed first, worst-case-wins,
  all-removed returns a null sentinel + allRemoved=true. Lagging is app-level
  (versionGt(normalize(available), normalize(patchable)), both required).
- Part 2: /apps/status ships derived status + removal_state per row. Verified
  182/182 rows match old patch_status through the vocab map.

Vocab map (old SQL patch_status -> module status): na+source=system -> system,
na+source=mas -> store, identity for unknown/current/outdated. SQL emits 'na'
where source is system or mas; the module splits them into system/store. The
counts endpoint already emits separate system/store buckets, so counts map
identity.

Garbage-version behavior correction (verified 0 live rows on the divergent path):
shipped SQL gives a non-coercible installed version a THREE-WAY behavior (NULL
patchable -> unknown, real patchable -> outdated, matching-garbage patchable ->
current, the last being an actual bug). The module's flat 'unknown' is correct
in all three cases. The module supersedes the SQL behavior; not a module bug.

Parts 4-7 DEFERRED: /apps/summary + App Inventory migration (Part 5), counts +
devices outdated_count migration (Part 6), cleanup + final grep (Part 7).
Sequencing and hazards are in status-consolidation-spec.md. When resumed:
Part 5's outdated-filter predicate must move to module-derived status (the
current outdated filter reads stale patch_status, which is why 1Password could
appear to leak in the Dashboard's top-outdated path before the earlier session's
guard). Part 6 reduction must skip all-removed bundles by branching on
allRemoved, never on status===null. No renderer reads status before checking
allRemoved.

## Demo-visible fixes -- MERGED to main this session (was part3-touchup @ 5e65b27)
Build was green (exit 0, 36 pages, only a pre-existing middleware deprecation
warning) before merge. Merged and verified live on production this session.
Contents:
- Em-dash cleanup via the shared EmptyCell component (see Empty-cell standard).
  All null-value table cells route through EmptyCell; remaining raw dashes are
  prose/comments only.
- Dashboard removal guard: the "Top Outdated Apps" card now filters
  patch_status === 'outdated' && removal_state !== 'removed'. Correctly placed;
  this card had no removal check, App Inventory was already guarded (e79ae19).
- Default-hide for removed apps (HomePageInner): removed apps are HIDDEN BY
  DEFAULT. Implemented as a visibility flag (showRemoved useState(false)), a
  pre-filter reading allRemovedMap (server-sent removal_state, NOT a re-derived
  predicate), and nonRemovedCount/effectiveTotal so the "X of Y" denominator
  matches the visible set. Removed rows are NOT dropped from data (soft-delete
  philosophy at the UI layer: hide, never destroy); a future "show removed"
  toggle just flips showRemoved. This also hides the dead com.tdesktop.Telegram
  orphan card that had been rendering in the App Inventory base list.

The two preview "bugs" that prompted this work were resolved by diagnosis, not
new guards:
- 1Password in the outdated filter: NOT a bug. Live data confirms both
  com.1password.1password rows return removal_state='removed', the field is
  present client-side, and the existing HomePageInner guard correctly excludes
  them from the App Inventory outdated filter. The sighting was either the
  Dashboard's Top Outdated card (fixed by the new guard) or a stale preview.
- Telegram "disappeared": NOT a disappearance. The real ru.keepcoder.Telegram
  is present and correct on both devices (sub-second check-in gaps post-outage).
  What showed was the dead com.tdesktop.Telegram orphan (last seen Apr 24)
  rendering with a "Removed" label. Pre-existing on main (commit 0a4d4f3),
  now hidden by default-hide.

## Version Conflicts card removed -- SHIPPED this session (commit 9252ff0)
Stale stat card on App Inventory showing a "13 Version Conflicts" count backed
by resolved_versions.conflict, a metric already known to be unreliable (see
"Resolver architecture" above: the conflict comparison does not apply
normalizeVersion first, so format-only differences get flagged as conflicts).
Already filed as known-incomplete cleanup in a prior session and never
executed. Decision was to REMOVE the card, not fix the display, for two
reasons: (1) the underlying 8-outdated count this card was adjacent to is
already shown correctly in the Patch Status bar, so a "fixed" Version
Conflicts card showing the same shape of number again would add visual noise,
not new information; (2) fixing the card's display would not fix the
underlying resolver normalization bug, that stays separately filed, untouched.
Grid layout changed from repeat(4, 1fr) to repeat(3, 1fr) on the stats row to
accommodate the removed card. This also informed a corresponding waitlist copy
edit (cutting "Version conflicts and" from step 2 copy, see WAITLIST SITE
POSITIONING above), so the marketing page no longer promises a feature the
product doesn't currently surface.

## Design reference files committed -- SHIPPED this session (commit 316e5ec)
design-reference/orchardpatch-console-master.html,
design-reference/orchardpatch-app-detail.html,
design-reference/version-module-states.html, and design-reference/build-spec.md
committed to main as the documented design system source of truth, per the
original console redesign build spec's instruction to keep these in-repo (they
had never actually been committed, only present locally). build-spec.md was
confirmed by Chip, before committing, to be the real design spec text
referencing these exact HTML files as source of truth, not a stray or
duplicate document.

Two files deliberately left untracked, not committed: design-reference/
.claude-prompt.txt and .claude-prompt2.txt. These are working prompt scratch
files (instructions written for a Claude session), not design artifacts.
Reasoning for exclusion: CONTEXT.md already serves the "what and why"
documentation role; these are one-off working notes with no lasting reference
value, and given Jude has considered open-sourcing this repo as a career
credibility play, unpolished scratch prompts are exactly the kind of file that
looks bad in a public repo and exposes internal reasoning never meant to be
published. If anything in them is worth preserving, the right move is folding
the substance into CONTEXT.md deliberately, not committing the raw file.

devtools-audit.mjs (a one-shot Playwright script from the console redesign,
used to verify CSS custom property resolution by launching Chromium, navigating
to localhost:3000/dashboard, and printing computed values for --shadow-card,
--sheen, --page-bg, --surface-glass, --ambient, --border-hairline) was deleted.
Its job was already done when the console redesign shipped; no ongoing value in
keeping a throwaway diagnostic script untracked in the working tree
indefinitely. Deleted via `rm` (the `trash` CLI was not yet on PATH at the
point this specific deletion happened; confirmed gone via a follow-up `ls`
check returning "No such file or directory").

## AgentBanner false-positive -- FIXED this session (commit ff62a61, frontend)

Symptom, found during the splash-page screenshot pass: a "No fleet data --
Connect your fleet" banner rendered at the top of every page (Dashboard, App
Inventory, Catalog, Device detail, App detail, Patch History) simultaneously
with those same pages correctly showing live, real fleet data (113 apps, 2
devices, real patch history, etc). A banner telling the viewer there is no
fleet data while the page underneath it is rendering fleet data is the kind of
thing that reads as broken software in a demo screenshot, not quiet honesty.

ROOT CAUSE (confirmed via direct code read, not inferred): AgentBanner.tsx
performed its own INDEPENDENT fetch to /api/fleet/status, a Next.js route which
in turn called a single, separate fleet-server endpoint
(${FLEET_SERVER_URL}/stats) and read data.totalDevices from it. This was
entirely disconnected from the data-fetching every other part of the page
already does (App Inventory, Dashboard stat cards, etc all resolve through
/api/stats or /apps/status). Three compounding problems in that isolated code
path:
1. Different code path entirely. If /stats specifically was flaky, slow, or
   returned non-2xx while the rest of the fleet server API was completely
   healthy, the banner would fire even though every table on the page had good
   data, because the banner never looked at that data.
2. One-shot fetch, no retry. The useEffect driving AgentBanner's status fired
   once on mount. A single slow or failed response at load time permanently
   set status to "unreachable" for that page visit, with no retry logic to
   recover if the fleet server responded fine a second later.
3. Next.js ISR caching (revalidate: 30) on the server-side fetch to /stats. If
   the cache was populated during a bad moment (a deploy, a server restart, a
   cold start), ALL clients would receive {connected: false} for up to 30
   seconds, even while their own page's actual data loaded fine from separate,
   uncached routes.

WHY THIS MATTERS BEYOND THE ONE BUG: this is the exact same conceptual bug
class already named and fixed twice elsewhere in this project: canonical
patch-status counts (see above, fixed by consolidating to one
/api/stats/patch-status source) and removal-state duplication (see soft-delete
section, the four-round frontend chase filed as an architectural item). In all
three cases, the same underlying fact was computed a second time, independently,
in a place that was free to disagree with the canonical answer. The fix in all
three cases is the same: eliminate the second computation, read from the
already-canonical source. Retry logic or cache-timing tuning on the banner's
own fetch would have only made the duplicate computation fail less often; it
would not have removed the possibility of disagreement. That is a workaround,
not a root-cause fix, and was explicitly rejected for that reason.

FIX IMPLEMENTED:
- New file src/components/FleetStatsProvider.tsx: client component, fetches
  /api/stats ONCE on mount (the same canonical endpoint the Dashboard stat
  cards, App Inventory, and Fleet page already depend on), exposes
  { status: "loading" | "has-devices" | "no-devices" | "unreachable" } via
  React context and a useFleetStats() hook.
- src/components/AgentBanner.tsx rewritten to consume useFleetStats(). No
  fetch, no useEffect, no local state for status inside the banner itself.
  Banner hides on "loading" or "has-devices", shows "no devices enrolled yet"
  on "no-devices", shows "no fleet data" only if the SHARED fetch itself truly
  failed.
- src/app/layout.tsx wraps the content column in <FleetStatsProvider>, so the
  whole app shell shares one fetch instead of each page (or the banner
  independently) re-deriving connection state.
- src/app/api/fleet/status/route.ts DELETED entirely, along with the
  ${FLEET_SERVER_URL}/stats call inside it. Confirmed zero other references
  via grep before deletion. Re-confirmed a second time after a Chip session
  reset (grep -r "fleet/status" src/ returned zero matches), since the first
  confirmation happened in a session that hit the OpenClaw echo loop shortly
  after and needed re-verification from a clean state.

VERIFICATION: confirmed banner absent on all six screenshot-pass pages
(Dashboard, App Inventory, Catalog, Device detail, App detail, Patch History),
both light and dark theme, via hard refresh against real (non-cached)
production, not just a warm tab. One early "looks fixed" observation from
looking at prod turned out to be premature, made before the actual fix commit
had been pushed (see Lessons learned below); the real verification happened
only after the commit was confirmed live.

## Screenshot-pass fixes -- SHIPPED this session (commit 0aab011 frontend,
## 362e7fb server)

Five items found during the same splash-page screenshot pass that surfaced the
AgentBanner bug, bundled into one Chip pass and shipped together.

**1. Em dash to middot in patch modal copy.**
"Patch all outdated -- Firefox" (Bushel modal title, in
src/app/apps/[id]/page.tsx) and "6 apps across 2 devices -- 8 total patch
jobs" (Orchard modal summary footer, in src/app/dashboard/page.tsx) both used
an em dash where the rest of the same modal family already correctly used a
middot ("Patch by the Bushel · Single App, All Devices"). Both changed to
middot for consistency within the same component family.
Also fixed: four tooltip title attributes on MethodBadge chips in
src/app/patches/page.tsx (around lines 132-135), e.g. "Patch by the Fruit --
single app, single device", same em dash to middot swap, since these are
hover tooltips in the same visual family as the modal footers.
NOT fixed, deliberately deferred: toast messages that use an em dash as a
sentence break, e.g. "Patch job queued -- redirecting...", "Agent not
reachable -- is it running?". These are functionally doing the job of
punctuation (separating two independent clauses), not acting as a decorative
separator the way the modal titles were. A straight middot substitution would
read wrong here. This needs an actual wording rewrite, not a character swap,
and the exact toast strings have not yet been pulled from Chip. Filed as an
open item below.

**2. Device detail page: Removed apps grouped into a collapsed section.**
Product decision made explicitly before implementation (not defaulted):
Removed apps on the device detail page (e.g. 1Password 8, Teams classic,
PyCharm CE on MacBook Pro's page) should stay VISIBLE as installation history
rather than hidden by default the way App Inventory and Dashboard hide them,
because the device page's use case is "what has this machine's story been,"
which is exactly what app_lifecycle_events was built to support. But they
should not sit inline undecorated in the main app list either, since that
reads as clutter in a demo screenshot regardless of the underlying philosophy.
Resolution: group them the same way System Apps already groups into its own
collapsed section on that same page (a pattern that already existed, just
never applied to Removed apps).
Implementation: filteredApps (the main table) now excludes
removal_state === "removed". A new removedApps useMemo derives the Removed
set (removal_state === "removed", excluding system/store apps), sorted
alphabetically. A new collapsed <details> section, "Removed (N)", renders
below the existing System Apps section with matching visual treatment (app
initial avatar, version, a muted grey "Removed" badge, empty action cell,
collapsed by default). The "Apps Installed" count in the page header and card
subtitle now excludes removed apps, matching the main list's new scope.
Confirmed via a real git diff read (not just Chip's summary) that all three
pieces (filteredApps change, removedApps memo, the collapsed section markup)
exist in the actual file before this was trusted.

**3. PyCharm CE and Microsoft Teams classic display names (server-side).**
PyCharm Pro and PyCharm CE were both rendering as plain "PyCharm" everywhere,
despite CE having a distinct curated identity row (see Multi-variant identity
fix above). Root cause: the /apps/status query selected a.name (the
agent-reported name) directly, and never consulted app_identity for a curated
display name, even though the curated row for CE already had app_name =
'PyCharm CE' seeded back in Phase 1.
Fix: /apps/status query gained a LEFT JOIN app_identity ai ON
ai.bundle_id = a.bundle_id AND ai.curated = true, with the name column changed
to COALESCE(ai.app_name, a.name).
VERIFIED AGAINST PRODUCTION BEFORE DEPLOY (per the project's standing caution
around canonical-query changes touching production data): ran
SELECT bundle_id, app_name, curated FROM app_identity WHERE curated = true
directly against production and compared old (agent-reported) vs new
(post-COALESCE) display name for all 6 curated rows, per actual device, not
just the row believed to be affected. Result: only 2 of 6 rows actually
change display. com.jetbrains.pycharm.ce goes from "PyCharm" to "PyCharm CE"
(the fix that mattered). com.microsoft.teams goes from "Microsoft Teams" to
"Microsoft Teams classic" (an incidental correct fix, the curated row already
had this name, it just was never surfaced). The other 4 curated rows
(com.canva.CanvaDesktop, com.jetbrains.pycharm, com.microsoft.teams2,
ru.keepcoder.Telegram on both devices) are no-ops, their curated app_name
already matched the agent-reported name.
ENDPOINT COVERAGE CONFIRMED: traced that Device Detail (/devices/[id]), App
Inventory (/apps), and App Detail (/apps/[bundleId]) all resolve display name
through this same /apps/status query (App Detail's proxy at
/api/fleet/apps/[id] pulls name directly from the /apps/status response with
no separate name resolution of its own). One server-side fix therefore covers
all three surfaces, confirmed rather than assumed.
FOUND IN PASSING, NOT TOUCHED: an unused /api/apps route exists, calling
listApps() from jamfClient.ts, left over from an earlier Jamf integration
attempt. Nothing in the current UI calls this route (confirmed, no component
fetches /api/apps bare). Filed as tech debt below, dead code, not wired to
anything live.
Deployed to Railway, confirmed live via deploy logs showing
"[DB] Curated seed rows applied (6)" and "[OrchardPatch Server] Listening on
port 8080" at the post-deploy timestamp, not just a "push succeeded" claim.

**4. Docker version-delta text clipping in Top Outdated Apps card.**
On Dashboard, the "4.79.0 -> 4.80.0" text for Docker was visibly cut off at
the bottom edge of the Top Outdated Apps card, in both light and dark theme.
Root cause: the card's content div had maxHeight: 240 with overflowY: "auto".
With 6 items rendered, the last item's version-delta line fell right at the
clipped scroll boundary. Since the list was already hard-capped to 6 items via
.slice(0, 6) elsewhere in the component (so there was no actual risk of
unbounded card growth), the maxHeight/overflow constraint was unnecessary
defensive code left over from before that cap existed. Removed both
properties; the card now sizes naturally to its (already-bounded) content.

**5. Patch Status bar reorder on App Inventory.**
Page order changed from [Patch Status breakdown bar, stat cards (Total Apps /
Total Devices / Last Synced), app list] to [stat cards, Patch Status bar, app
list].
Reasoning: the stat cards are general fleet-scale context (how many apps and
devices exist, how fresh the data is) and should anchor the page as the
broadest, most orienting information. The Patch Status bar is really a
summary/legend describing the specific list of apps rendered below it, so it
reads better sitting directly above that list rather than between the page
header and the stat cards. This also matches a general-to-specific reading
order (fleet scale, then category breakdown, then individual rows) that the
original top-to-bottom order violated.
Implementation: stats grid gained marginBottom: 16 (tighter gap before the
status bar, signaling they're a connected pair), the status bar gained
marginBottom: 24 (bigger gap before the app list, signaling a new section
starts there). No divider was added between the reordered stat cards and
status bar; the status bar's own existing card border
(border: 1px solid var(--border-hairline)) combined with its different
surface token (--surface-raised, versus the stat cards' glass surface) was
judged sufficient to read as a distinct layer without extra visual weight.

## DB schema (key tables)
- devices: id (TEXT PK, e.g. 'device-GJM7N0XGL0'), hostname, device_id (LEGACY
  column that is NOT the join key and may be null/unused, confirmed no usable
  device_id join column exists; joins use devices.id), last_seen (TIMESTAMPTZ,
  server clock), agent_version, agent_url (nullable). NOTE: prior CONTEXT.md
  claimed a device_id join column; that was wrong. Live DB has 11 columns, the
  join is d.id = a.device_id.
- apps: id, device_id, bundle_id, name, version, latest_version (legacy/null),
  is_outdated (legacy/always 0, do not use), installomator_label, path, source
  (user/system/mas), last_seen (TIMESTAMPTZ, server clock). Removal is DERIVED
  (apps.last_seen < devices.last_seen - 45min), never a DELETE or deleted_at.
- latest_versions: label (PK), latest_version, last_checked, error. 34/47
  populated. Null-safe ingest.
- app_catalog: label (PK), app_name, bundle_id (null for ~all rows by
  convention), expected_team, last_synced, download_url. 1,137 rows (includes
  phantom case-alias entries from a known parser bug).
- app_identity: bundle_id (PK), app_name, installomator_label, homebrew_cask,
  github_repo, sparkle_feed_url, adam_id, curated, last_derived. curated=true
  rows never overwritten by derivation. As of this session, app_name on
  curated rows also drives DISPLAY name fleet-wide via /apps/status
  (previously seeded but unused for display).
- resolved_versions: bundle_id (PK), latest_available, source, source_url,
  candidates (JSONB), conflict, resolved_at, error. Version-layer; distinct from
  identity_conflicts (identity-layer).
- identity_conflicts: id, bundle_id, source, token, competing_bundle_ids,
  detected_at, resolved. Unique index (bundle_id, source, token).
  resolveSettledConflicts() clears resolved=true automatically.
- app_lifecycle_events: id, bundle_id, device_id (FK -> devices(id)), event_type
  ('appeared'|'removed'), occurred_at, app_name, version_at_event. Index on
  (bundle_id, device_id, occurred_at DESC). Not yet surfaced beyond the
  "Installed since" chip.
- patch_jobs: id, device_id, app_name, label, mode, method, status, created_at,
  started_at, completed_at, exit_code, error, log. Known exit codes: 0, 8 (app
  name mismatch), 11 (checksum), 16 (download), 23 (MAS), null (never ran).
- pending_patches: agent work queue, rows deleted on terminal status.
  claimed_at is TEXT (staleness sweep casts). Silent patches withhold the row
  15s for the undo window.
- pending_commands: id, device_id, command, created_at, claimed_at,
  completed_at, result. Allowlist { check_in } only.

## Key API endpoints
- POST /checkin: apps + devices upsert last_seen = now() (server clock). Curated
  identity override before writing installomator_label. runCollisionDetector()
  (incl. resolveSettledConflicts()) and recordRemovalEvents() called post-write.
- GET /devices: outdated_count excludes removed apps.
- GET /apps/status?device_id=: returns removal_state and a.last_seen per row.
  Does NOT filter on removal_state; frontend decides display. As of the parked
  refactor Part 2, also ships module-derived status per row. As of this
  session, also ships COALESCE(ai.app_name, a.name) as the display name,
  preferring a curated row's app_name over the agent-reported name when one
  exists. Confirmed this is the single endpoint feeding display name on
  Device Detail, App Inventory, and App Detail.
- GET /api/stats/patch-status: canonical fleet-wide counts, excludes removed
  apps. DISTINCT ON CTE, grouped by COALESCE(bundle_id, name), join d.id =
  a.device_id.
- GET /apps/:bundleId/first-seen: MIN(occurred_at) for event_type='appeared'.
- POST /patch, /patch-jobs/branch, /patch-jobs/bushel, /patch-jobs/orchard: all
  refuse to queue against a removed installation (Fruit 409; batch tiers
  silently exclude).
- POST /api/force-checkin.
- GET /api/fleet/status: DELETED this session. Was an independent, isolated
  health check that caused the AgentBanner false-positive bug (see above). Do
  not recreate this pattern; connection status should always derive from data
  already fetched for page rendering, never a separate parallel check.
- /api/apps (calling listApps() from jamfClient.ts): confirmed dead code, no UI
  component calls it, leftover from an earlier Jamf integration attempt. Not
  deleted this session, filed as tech debt.

## Feature status
- Soft-delete Parts 1-3: SHIPPED, end-to-end verified.
- Multi-variant identity Phase 1 + auto-resolution: SHIPPED.
- Catalog deploy identity guard: SHIPPED (label-level; bundleId gap open).
- "Installed since" chip: SHIPPED July 6.
- App Inventory card merge bug (PyCharm Pro/CE): FIXED July 6 (commit 28e5fe6,
  name-fallback gated on !bundleLower). Display name distinction (both showing
  literally "PyCharm" as text) further fixed this session via the curated
  COALESCE change; the underlying card-merge bug and the display-name-text bug
  were two separate issues, both now resolved.
- Console redesign: SHIPPED (liquid-glass, tokenized, light/dark, OS-follow).
  Inline style props only (Tailwind v4 purges utility classes in new/heavily-
  modified files).
- Sparkle resolver fix: SHIPPED to main.
- Em-dash cleanup / EmptyCell, Dashboard guard, default-hide (part3-touchup):
  MERGED to main this session.
- Version Conflicts stale stat card: REMOVED this session.
- Design reference files: COMMITTED this session as design system source of
  truth.
- AgentBanner false-positive: FIXED at root cause this session (shared stats
  context replacing an independent, duplicate health check).
- Five screenshot-pass fixes (modal/tooltip em dashes, device-page Removed
  section, PyCharm CE/Teams classic display names, Docker text clipping,
  Patch Status bar reorder): SHIPPED this session.

### Not yet built (priority order, demo-first)
DEMO-READY TRACK (highest priority):
- Console demo-clean: SUBSTANTIALLY DONE as of this session. Recommend one
  more full visual pass on production (both themes) before actually taking
  screenshots, since verification this session happened in stages across a
  couple of Chip session resets rather than in one continuous pass.
- Toast message em-dash wording pass: exact strings not yet pulled from Chip.
  Needs an actual rewrite (these em dashes function as sentence-break
  punctuation, not decorative separators), not a mechanical middot swap.
- Waitlist site: product screenshot (UNBLOCKED now, console is demo-clean),
  lagging-state section (copy drafted, BLOCKED on the three lagging-UI value
  labels from Jude), positioning reframe + approved copy edits + cut orchard
  video (all UNBLOCKED, can proceed independent of the screenshot/label
  blockers). See "WAITLIST SITE POSITIONING."
- Demo video: lagging state centerpiece. Pick and verify safe demo apps. AVOID
  1Password (gone from fleet). zoom.us is a clean Current example.
- Polished repo for public presentation.
- MacAdmins Slack outreach + contribution-first Installomator maintainer contact
  (coconutBattery HTML response is the confirmed bug-report opener).

DEFERRED POST-PREVIEW (invisible to demo, real debt):
- Status consolidation Parts 4-7 (the parked refactor).
- "Show removed" toggle (default-hide shipped for App Inventory/Dashboard;
  opt-in reveal pending, filed as backlog item 0 partial in tech-debt.md).
  WORTH REVISITING given this session: the device-detail page took a
  different, deliberately-chosen approach (a permanent grouped collapsible
  section, not a hide/toggle), since that page's use case is installation
  history rather than action triage. Now that the collapsible pattern exists
  in two places on the same page (System Apps, Removed apps), it may make
  more sense for App Inventory's eventual "show removed" feature to adopt the
  same collapsible pattern instead of a separate toggle design. Not decided,
  just flagged as worth considering together rather than as two unrelated
  features.
- CE display-name quirk (cosmetic): RESOLVED this session via the curated
  COALESCE fix. Leaving this line in as a resolved-item marker rather than
  deleting it, since a future session reading this file should know the item
  used to be open and is now closed, not just silently absent.
- "Removed" wording precision (the predicate only knows "not seen recently,"
  not "genuinely uninstalled"; app_lifecycle_events could power a "Not Seen
  Since" gray zone). Real product/UX decision, not a word swap. Unchanged.
- "Version Conflicts" stale-card cleanup: RESOLVED this session (card
  removed). Resolver conflict-normalization gap (the underlying bug the card
  was surfacing a bad number from) is DISTINCT and remains open, see Resolver
  architecture section above.
- Catalog-sync case-alias parser fix (jetbrainspycharmce produces exit 8).
- Catalog deploy bundleId guard (full isIdentityTrusted on the catalog path).
- Multi-variant identity GENERAL model (Opus). DaVinci MAS/free next.
- Patch-outcome-aware state (Opus).
- Phase E server-side patchable resolution (Opus). Must honor versionKey. Prep:
  installomator-reference.md, not started.
- coconutBattery / TD-001 (Sparkle guard not end-anchored).
- Dead /api/apps route (old Jamf integration, listApps() in jamfClient.ts).
  Found this session during the Fix 3 endpoint trace, confirmed unused,
  filed, not deleted.
- TRUST_ORDER naming cleanup (trivial, misleading name).
- Agent update mechanism (pkg build pipeline). PRE-LAUNCH GATE.
- Multi-tenancy + SSO (prerequisites for mutating pending_commands).
- Cultivation / policy-based auto-remediation.
- Various smaller items (method='fruit' hardcode, Bushel modal pre-count,
  MAS exclusion from batch queues, last_checked vs last_seen column mismatch on
  removed rows, title case audit, GET /stats migration, DB indexes).

## Open items / tech debt (key entries)
- TD-001: Sparkle resolver extraction guard /^\d+[\.\d]*/ is NOT end-anchored,
  so it stores non-coercible values like "4.3.4b" that the module's
  isVersionCoercible (/^\d+(\.\d+)*$/, end-anchored) would reject. Root cause:
  resolver and module use two different definitions of "valid version." Fix:
  gate the resolver on the module's coercibility check before storing. Benign
  today (coconutBattery has no label, lagging cannot fire), a real bug the first
  time a beta-versioned app has a label. FILE-ONLY, non-blocking.
- Status computation duplication: the conceptual value (status/removal/fleet-
  connection) is computed in independent sites across both repos. The parked
  consolidation refactor is the real fix for status/removal specifically. The
  AgentBanner fix this session is a concrete instance of this exact bug class
  being caught and fixed the correct way (eliminate the duplicate computation,
  read from canonical source) rather than patched around. Worth treating as a
  template for the next time this pattern is suspected somewhere else in the
  app: ask "is there a second, independent computation of a fact the page
  already knows" before reaching for retry logic or cache tuning.
- Toast message em-dash wording pass: NEW this session. Exact strings not yet
  pulled from Chip. Needs a copy rewrite, not a mechanical swap, since these
  em dashes are doing punctuation work (separating two clauses), not standing
  in for a decorative separator.
- Dead /api/apps route (Jamf-era, unused, calls listApps() from
  jamfClient.ts): NEW this session, found during the Fix 3 endpoint trace.
- Outdated-filter removal guard (frontend, filed a prior session): superseded
  by the parked Part 5 /apps/summary migration.
- Catalog deploy bundleId gap; resolver conflict-count normalization; catalog
  case-alias artifact; double enrichAppsWithLabels(); known ~1ms enqueue race;
  postinstall Installomator path conflict; unidentified Sparkle feed failure
  (1 of 3); identity bootstrap startup race; GITHUB_TOKEN over-scoped.
- 1Password fully removed from the fleet (informational): both machines run
  1Password 7 (com.agilebits.onepassword7), current. The removed row is
  com.1password.1password (that is the "1Password 8" bundle ID). Do NOT use
  1Password as a demo app.
- Server-side before/after production-data review checkpoint: PROPOSED July 6,
  still awaiting Jude's sign-off as of this session. Not addressed this
  session (no server-side canonical-query change happened without manual
  verification anyway, since the Fix 3 verification this session effectively
  followed this proposed pattern informally: Chip pulled before/after values
  for all 6 curated rows and Jude reviewed them before deploy).

## Known label-matching issues
- coconutBattery: patchable pipeline broken (scrapes HTML), available works via
  Homebrew. Maintainer outreach opener. See TD-001.
- Telegram: ru.keepcoder.Telegram correctly curated. com.tdesktop.Telegram
  orphan (last seen Apr 24) now hidden by default-hide on App Inventory, and
  visible-but-grouped under the new Removed section on device detail.
- PyCharm CE: label NULL, pycharm-ce cask, now displays as "PyCharm CE" (this
  session's fix) instead of merging visually with PyCharm Pro.
  jetbrainspycharmce phantom alias still in app_catalog (parser bug, separate,
  unresolved).
- DaVinci Resolve: MAS on Jude's machine, may be direct elsewhere.
- firefoxpkg: verify it patches standard Firefox not ESR.
- Date/build-versioned labels (boxdrive, nomad, Teams): version-shape guard
  rejects to null.

## Fleet
- 2 devices in production fleet.
- device-GJM7N0XGL0: Jude's MacBook Pro (Mac16,1, macOS 26.4/27.0 reported).
  Still runs pre-Phase-1 agent catalog.js (no MAS gate at the agent layer);
  server-side gates cover it.
- device-C02D52QTML85: Chip's MacBook Pro (MacBookPro16,2, macOS 26.3.2, ~72+
  apps, 2020 13" Intel i7 16GB). Phase 1 agent (993a8d0) deployed here.
- Agent install path: /usr/local/orchardpatch/agent/.
- Config: /etc/orchardpatch/config.json, root:wheel 600 both machines.
- Logs: /var/log/orchardpatch/agent.log, agent.error.log.
- Installomator: v10.8 both machines.
- Confirmed installed/current: PyCharm Pro (com.jetbrains.pycharm, Jude,
  2026.1.3), zoom.us (us.zoom.xos, both, 7.1.0 (83064)/7.1.0.83064), 1Password 7
  (com.agilebits.onepassword7, both). PyCharm CE, 1Password 8, Telegram Desktop
  orphan, Teams classic: removed/soft-deleted.
- Do NOT treat any last_seen frozen ~2026-07-02 20:47-21:20 UTC as a real
  removal; that window is the Postgres outage, self-corrected on first
  post-recovery check-in.

## AI development workflow
- Primary dev assistant: Chip (OpenClaw, Claude API/Sonnet, own MacBook Pro).
  Architecture/planning: Claude.ai (this project). Jude relays between them.
- Chip pushes via SSH (account-level key, all orchardpatch repos). Git identity
  user.name=Chip, user.email=chip@openclaw; orchardpatch-server has a local
  override (Jude Glenn).
- File ownership on Chip's machine: `sudo chown -R chip:staff ~/Projects` if
  root-ownership recurs. Never sudo git.
- Context is lost when Chip compacts; CONTEXT.md restores it.
- CONTEXT.md handoff (locked): Jude attaches to Chip at session end, Chip saves
  to ~/Projects/orchardpatch-server/CONTEXT.md and commits. Next session Chip
  reads from disk. Claude.ai project file stays in sync.

Standing rules:
- Fix bugs at root cause, never workarounds. If a workaround is needed to
  unblock testing, flag it explicitly as tech debt and file it immediately.
- Do not polish a mechanism you have already decided to replace.
- All fixes resolvable through OrchardPatch itself, not manual CLI on managed
  machines.
- No follow-mode/non-terminating commands in Chip prompts.
- Any regex bound for PostgreSQL: every backslash DOUBLED in JS source. Verify
  with a direct query, never eyeball.
- SQL strings embedded in JS need escaped inner quotes or a different outer
  delimiter (confirmed crash 27d8b00). Single quotes inside single-quoted JS
  strings crash Node.
- Edit tool fails on JS/TS with template literals: use Python file replacement
  for substantial JS/TS edits, EXCEPT for files with regex or SQL escapes, where
  Python heredocs mangle escapes and direct file-edit tools must be used.
- When a fix does not fully take or a bug resurfaces in a new place, grep for ALL
  render/computation sites BEFORE writing the next patch.
- Never assume a DB row's existence means a feature works; verify physical
  machine state against the actual machine.
- Before any `railway up`, confirm the linked service (`railway status`).
- Credentials never typed into the Chip chat, no exceptions.
- CRITICAL frontend: inline style props only (Tailwind v4 purge). npm run build
  locally before every Vercel push.
- Chip prompts go in code blocks. Large Chip output: write to a Desktop file
  (Telegram blocks large clipboard copies).
- OpenClaw failure mode: "LLM request failed: provider rejected the request
  schema or tool payload" can loop. Recovery: restart the OpenClaw session
  cleanly (/reset), then re-ask the same question. NOT a capability problem,
  NOT caused by turning off tools. Hit 3 times in the July 7 session alone, all
  recovered cleanly via reset.
- DISTINCT failure mode, NEW this session: "Missing API key for the selected
  provider on the gateway" looks similar (an auth/gateway-shaped error
  appearing mid-session) but has a different cause and fix. This turned out to
  be exhausted OpenClaw credits, not a transcript-size/schema issue, and was
  NOT fixed by resetting; it resolved once credits were topped up. If a
  gateway/auth-shaped error appears, check credit balance before assuming it
  is the transcript-size echo loop; they present similarly but need different
  responses.
- grep gotcha: grep exits 1 on no-match, which in a build|grep pipeline reads as
  a build failure when the build was actually clean. Do not treat grep's exit
  code as the build's exit code.
- NEW this session: when a tool call's result matters for a decision
  (production data, a file diff, build output), Chip shows the raw output, not
  just a summary of what it showed. If a tool call errors, Chip says so
  explicitly before summarizing anything, rather than narrating success and
  letting the error surface later, underneath the narration, in the log. This
  was prompted by two incidents this session: a `trash` command failure that
  Chip silently worked around via `rm` before mentioning the failure, and a
  `psql` command failure that Chip silently worked around via Node's pg
  library before presenting production query results as if the original
  command had succeeded. Chip acknowledged this explicitly and restated the
  rule in its own words before the next tool-heavy stretch of work.
- NEW this session: before treating a "merge" as complete, confirm the source
  branch actually has the claimed changes COMMITTED, not merely present as
  unstaged working-directory changes. A merge of a branch whose real changes
  are unstaged is a silent no-op that looks identical to a successful merge in
  the terminal output (both branches "at the same commit"). Caught this
  session when the AgentBanner fix's four files were sitting as unstaged
  changes on both the feature branch and main, so an initial merge attempt did
  nothing, and this was only caught because Chip proactively checked branch
  divergence before building rather than trusting the merge command's exit
  code alone.

## COST + SESSION-LENGTH OPERATIONAL RULES
Diagnostic finding: a full working day ran ~$25 on Chip, and ~84% of that was
prompt-cache reads and writes from re-sending a huge transcript (up to ~5M
tokens) on every turn, 20+ times, in one long session. Input/output token cost
per turn is minor by comparison. The cost driver is TRANSCRIPT LENGTH x TURN
COUNT, not the model tier and not CONTEXT.md size in the system prompt.

Rules:
- Compact Chip and start fresh sessions at STABLE TASK BOUNDARIES (one bounded
  task or spec-part per session). A fresh session starts near zero tokens; a
  long session drags a giant transcript forward every turn. Short sessions are
  the primary cost lever.
- A good breaking point has three properties: work is at a stable state (branch
  builds, nothing half-applied), CONTEXT.md is current, and the next task is
  self-contained enough for a small prompt. Prefer to compact where CONTEXT.md
  is current.
- Restore Chip's context after a compaction BY REFERENCE, not by pasting: have
  Chip read CONTEXT.md, `git log` the active branch, and the relevant spec.
  Keep opening prompts small. Self-contained task instructions are the worthwhile
  exception (specificity that prevents a wrong-path fix is worth its tokens).
- CONTEXT.md being current is load-bearing for COST now, not just continuity: a
  stale CONTEXT.md forces expensive inline compensation on a fresh session.
- Match relay ceremony to stakes. Rigorous multi-step verification (Part 0,
  vocab maps) is right for a no-diff refactor; a demo fix wants "here is the fix,
  do it, show me the preview." Fewer round-trips = shorter transcripts = cheaper.
- Consider trimming unused OpenClaw tools/skills (cron alone is ~2,200 tokens of
  schema per turn; meme-maker/weather/video-frames etc. are irrelevant to this
  project). Minor next to transcript length, but free capability-wise. Turning
  these OFF does NOT break Chip's ability to do the work.
- PROPOSED (still awaiting Jude's sign-off as of this session): server-side
  changes that touch production data or a canonical query require a
  before/after snapshot that Jude reviews before the change is treated
  verified, the server-side equivalent of the frontend Vercel-preview gate.
  Chip captures before/after; Jude reading the diff is the gate, not Chip's
  report that it passed. NOTE: this session's Fix 3 (curated display name
  COALESCE) effectively followed this pattern informally without a formal
  sign-off yet in place, since Chip was asked to and did produce a full
  before/after table across all 6 curated rows before deploying, and Jude
  reviewed it. Worth treating as a working example when this rule comes up
  for actual sign-off.
- NEW observation this session: a five-item, parallel-exploration-heavy Chip
  batch (the screenshot-pass fixes) coincided with the provider-schema echo
  loop firing 3 times in a single session, more than typical for this
  project. The individual fixes were each small, but the exploration required
  to scope all five before writing any code built up a large transcript
  quickly. Worth a shorter leash on batch size specifically for
  exploration-heavy bundles (as opposed to a single well-scoped fix), even
  when the fixes themselves are individually small.

## Three-channel chat architecture (OrchardPatch project)
1. "Architectural Deep Dives": Opus. Cross-repo architecture, multi-tenancy,
   Cultivation, version-resolver redesign, YC application, multi-week-consequence
   decisions.
2. "Troubleshooting": Sonnet. Isolated bug fixes needing focused attention.
3. Daily implementation chat: Sonnet. Ongoing dev work.
Evaluate model fit at session start and on scope shifts; call it out loud so
Jude can switch. Sonnet for scoped implementation; Opus only for multi-week-
consequence decisions. Nothing in the July 7 session required Opus; all work
was well-scoped implementation and cleanup, correctly routed to the daily
Sonnet channel.

## Go-to-market
- Target: MacAdmins Slack (70k+), Jamf Nation, PSU MacAdmins.
- Distribution: bottom-up, individual Mac admins champion internally.
- Key pitch: "Jamf App Catalog shows you what you told it to track. OrchardPatch
  shows you everything that's actually on your fleet." Plus the no-MDM wedge:
  OrchardPatch works with or without an MDM.
- Competitive window: 18-24 months before Jamf App Installers become a real
  threat.
- Competitive identity handling: Jamf App Catalog is human-curated, bundle-ID-
  anchored (~700-800 titles, paid team). Jamf Title Editor is a custom external
  patch source on Kinobi (acquired 2021). Curation is the design, not a
  workaround. Installomator maintainers have hit same-name collisions
  (VirtualBox/BoxDrive, Parallels-bundled Edge), solved at install-detection.
- Installomator outreach: contribution-first. Attribution already live.
  coconutBattery HTML-response bug is the confirmed opener. Framing: distribution
  channel, not competitor. Homebrew/mas support should be org-level opt-in;
  be upfront with maintainers.

## Copy / naming / brand
- Patch naming hierarchy: Fruit (one app, one device), Branch (all outdated, one
  device), Bushel (one app, all devices), Orchard (all outdated, whole fleet),
  Cultivation (policy-based, future/enterprise).
- Pricing tiers: Free (visibility only), Standard (Fruit), Pro (Branch + Bushel),
  Enterprise (Cultivation). Parent brand concept: GraftKit.
- Copy rules: no em dashes, no emoji, title case, no possessives. Status
  indicators use colored dots (8px filled circle, CSS var token), never emoji.
  ENFORCEMENT NOTE (this session): the em-dash rule is not yet fully enforced
  across the app. This session fixed modal titles, modal summaries, and
  tooltip titles. Toast messages still contain em dashes and are flagged as an
  open item requiring a wording pass, not a mechanical fix.
- Patch modes: silent / managed / prompted.
- Routing: /dashboard /apps /apps/[id] /catalog /devices /devices/[id]
  /patch-history /orchard.
- Brand color: console accent #3d7a42 (hunter green, WCAG AA 5.2:1 on white).
  Mint sibling #74cc7c for dark mode/sidebar wordmark. Lime #7dd94a retired from
  console, kept on marketing/waitlist only. Token system: primitives hold raw
  hex, semantic tokens expose --accent/--sidebar-accent, components reference
  semantic only.

## Lessons learned (condensed, most recent first)

July 7 morning (screenshot pass, banner root cause, five small fixes):
- A banner (or any UI element) that independently re-derives "is there data"
  is the same bug class as duplicated counts or duplicated removal-state
  logic: one conceptual value, computed twice, in places that can disagree.
  The AgentBanner fix is the concrete example of this: the fix was never
  retry logic or cache-timing tuning on the banner's own fetch, both of which
  would have treated the symptom. The fix was eliminating the second,
  independent computation and reading from the already-canonical source. This
  is now the third documented instance of this exact pattern in the project
  (patch-status counts, removal-state threading, AgentBanner), worth
  recognizing on sight the next time something "sometimes disagrees with the
  rest of the page."
- Before deploying a change to a canonical, shared query (the curated
  app_name COALESCE), enumerate every row the change touches and diff old vs
  new output per row against real production data, not just the one row you
  set out to fix. In this case two rows changed (one intentional target, one
  incidental correct fix) and four were no-ops. Knowing which is which before
  deploying, not after, is what makes a canonical-query change safe.
- A tool call narrated as successful is not confirmed successful until the
  raw output has actually been seen. Two incidents this session had success
  narrated over a failure sitting in the log underneath (a `trash` fallback
  to `rm`, and a `psql`-fails-falls-back-to-Node-pg case where production
  query results were presented before the failure that preceded them was
  surfaced). Fixed going forward with an explicit standing rule about
  showing raw output first, not a one-off correction in the moment.
- A "merge" can silently no-op if the target branch's real changes are still
  unstaged working-directory diffs rather than committed changes. Both
  branches showing "at the same commit" after a merge attempt looks
  identical whether the merge worked or whether there was simply nothing
  committed to merge. Always confirm commits actually exist on the source
  branch before trusting a merge result, especially after any session
  interruption (echo loop, reset, credit exhaustion) that might have left
  work uncommitted mid-stream.
- Two different failure modes can present as an auth/gateway-shaped error but
  need different fixes: the transcript-size provider-schema echo loop needs
  a `/reset`; exhausted OpenClaw provider credits need a top-up and are not
  fixed by resetting. Check which one is actually happening (credit balance
  vs transcript length) before reaching for the usual echo-loop fix.
- "I was looking at prod and it looks fixed" is not verification if the
  actual fix commit was not yet confirmed pushed at the time of looking. The
  original AgentBanner bug was intermittent by nature (tied to ISR cache
  timing), so an absent banner on one particular page load does not confirm
  the fix landed, it could just as easily be the bug not firing that
  particular time. The real verification only happened once the specific
  commit hash was confirmed live and the pages were hard-refreshed against
  that confirmed state.
- When asked to condense CONTEXT.md for a session handoff, condensing means
  rewriting old material more tersely while keeping the actual content
  present in the file, not replacing it with a reference to a prior chat
  session Chip cannot see when reading the file fresh from disk. "See prior
  revision" is not valid content in a file whose entire purpose is being a
  standalone, complete restoration point. Caught mid-session when Jude
  compared line counts against prior days and flagged the drop before it was
  committed. Corrected by rebuilding the file with the original content fully
  intact and this session's work added additively.

July 6 evening (demo pivot + console cleanup):
- The strongest cost control is scope, not config. A project that keeps getting
  deeper instead of shipped runs up the bill through invisible architectural
  correctness. Demo-ready (traction) is the lever that converts spend into
  leverage.
- Correct code + correct server data + wrong screen = environment, not logic.
  Two traces confirmed the filter code and fleet data were right; the remaining
  variable was the preview environment (and ultimately a pre-existing orphan
  card, not a bug). Do not write a third fix on twice-confirmed-correct code.
- A fix aimed at one instance ("the em dash," "the Sparkle bug") usually reveals
  a shared convention (a 20-site placeholder, all Sparkle feeds). Fix the
  convention, not the instance. The Sparkle sort-by-build fix caught coconutBattery
  automatically because it operated over the whole category.
- Match verification ceremony to stakes. The no-diff refactor earned Part 0 +
  vocab maps; the demo fixes did not.
- OpenClaw provider-schema echo loop is an infra failure on Chip's host, not a
  capability regression and not caused by disabling tools. Recover by restarting
  the session, not by messaging it more (which feeds the oversized payload).

July 2-6 (lifecycle events + Postgres incident): a plausible causal story is not
a confirmed one (a Node query error cannot crash a separate DB service; the real
cause was a misdirected deploy). Verification depth should match consequence.
Credential discipline must hold under real pressure. A dashboard badge and a CLI
status can both be "true" and disagree; a direct connection test is the
tiebreaker. Fixing a symptom (healthcheck timeout) without the coupling (startup
blocked on DB, /health lying) means the failure returns.

July 1-2 (soft-delete): a DB row existing is not a feature working. Column type
and clock source are two separate bugs that look like one. A safety guard that
only lives in the UI is not a safety guard (Branch/Bushel/Orchard build target
lists server-side with no per-target human). The same conceptual value gets
computed in many places from correct local decisions; grep all sites before the
next patch. A cheap fix can make a bug harder to find than a visible wrong value.

June 26 (Phase 1 + identity + zoom): verification found a 5th MAS gate the spec
missed (verify the full write surface for any DB invariant). A wrong inference in
Opus is still an inference. One bug can be a class, not an instance. Intrinsic vs
name-derived is the identity distinction that matters. A wrong mapping is worse
than a missing one. The conflict flag cannot catch what destroys its own
evidence. Curation is the design. JS silently corrupts regex backslashes bound
for PostgreSQL. Display and comparison need different version values. Counts must
have ONE source.

June 22-25 (console redesign, Phase 6, resolver): WebKit backdrop-filter
compositing clipping, Tailwind v4 purge on shadcn components, node-fetch v3
ESM-only, FOR UPDATE vs grace-period locking, LaunchDaemon plist secrets, DEBUG=1
not skipping downloads, Python heredoc escape mangling, execSync ETIMEDOUT in
root LaunchDaemon environments.

---

## SESSION CLOSE STATE (what to do next)

Where things stand at the end of the July 7 morning session:
- Frontend main is at 0aab011: five screenshot-pass fixes merged and verified
  live in production (em dashes to middots, device-page Removed collapsible
  section, Docker clipping fix, Patch Status bar reorder). part3-touchup, the
  Version Conflicts removal, the design-reference commit, and the AgentBanner
  fix are all folded into main from earlier in this same session as well. No
  outstanding frontend branches.
- Server main is at 362e7fb: curated app_name COALESCE fix (PyCharm CE,
  Microsoft Teams classic display names) merged and verified live via Railway
  deploy logs.
- AgentBanner false-positive is fixed at the root and verified gone on all six
  screenshot-pass pages, both themes, hard refresh, against real (non-cached)
  production.
- Chip's dev environment cleaned up (trash and psql both confirmed on PATH,
  psql required `brew link --force libpq`), and a standing raw-output-before-
  summary rule is now in place after two narration-hid-a-failure incidents
  this session.
- Hit the OpenClaw provider-schema echo loop 3 times this session, all
  recovered cleanly via /reset. Also hit a separate "Missing API key" gateway
  error that turned out to be exhausted credits, resolved by topping up, not
  by resetting.

Immediate next actions:
1. One more full visual pass on production (both themes) confirming all five
   screenshot-pass fixes and the AgentBanner fix together in one continuous
   check, since verification happened in stages across a couple of session
   resets this session. Cheap insurance before screenshots actually get taken
   for the splash page.
2. Pull the exact toast message strings containing em dashes from Chip and do
   a proper wording pass (not a mechanical middot swap) on those specifically.
3. Get from Jude the three lagging-UI values/labels to finalize the waitlist
   lagging-state section copy. THIS IS THE SINGLE BLOCKING INPUT on the
   waitlist copy package; everything else in that package (positioning
   reframe, approved copy edits, cutting the orchard video) is unblocked and
   can proceed independent of this.
4. Take the product screenshot(s) for the waitlist site now that the console
   is demo-clean.
5. Apply the approved waitlist positioning/copy edits (independent of the
   screenshot and lagging-label blockers, can proceed anytime).
6. Sign off (or adjust) the proposed server-side before/after review
   checkpoint, still outstanding from July 6, not formally addressed this
   session (though this session's Fix 3 verification effectively modeled what
   the rule would require, informally).
7. Consider whether App Inventory's eventual "show removed" toggle should
   adopt the same collapsible-section pattern used on device detail this
   session, rather than a separate future toggle design. Not decided, flagged
   for a future session.
8. Delete the confirmed-dead /api/apps route (Jamf-era, unused), or at
   minimum keep it filed as tech debt if not worth a dedicated session.

Model routing: everything this session was Sonnet / daily-channel, correctly
scoped. Nothing here needs an Opus Deep Dive. The parked status-consolidation
Parts 4-7, the multi-variant general model, patch-outcome-aware state, and
Phase E remain Opus when resumed post-preview.