# OrchardPatch -- Project Context

Last updated: July 6, 2026 (evening session). PRIORITY PIVOTED THIS SESSION
to DEMO-READY (see next section). Work this session: (1) shipped the Sparkle
resolver fix to main (Telegram and AppCleaner false-lagging states corrected);
(2) on branch part3-touchup, shipped the em-dash cleanup via a shared EmptyCell
component, a Dashboard removal guard, and default-hide for removed apps; (3)
the status-consolidation refactor was scoped and PARKED post-preview (module
Parts 0-3 committed and unit-tested, Parts 4-7 deferred); (4) diagnosed two
preview "bugs" that turned out to be a pre-existing orphan-card cosmetic issue
(now fixed by default-hide) and a non-bug (guard works, Dashboard-vs-App-Inventory
confusion / stale preview). Session ended on an OpenClaw provider-schema echo
loop in Chip -- restart Chip's session cleanly to recover. part3-touchup @
5e65b27, build green (exit 0, 36 pages). NOT yet merged to main. See "Session
close state" at the bottom for exactly where things stand and what to do next.

Tip of orchardpatch-server: 8de9412 (main) + resolver fix committed to main
this session (5d41edb-era commits, see Resolver section). Tip of orchardpatch
(frontend): main is 28e5fe6; branch part3-touchup is 5e65b27 (unmerged).

---

## CURRENT PRIORITY: DEMO-READY (set July 6, 2026 evening)

The north star is now a polished preview site plus a demo video to take to
MacAdmins Slack. Interest equals traction equals leverage for a loan, investors,
or paying clients. Reasoning: significant money already spent building; the
fastest path to converting that from sunk cost to asset is validated interest,
not more correct internals. Cut scope to what a demo viewer sees. Defer
everything invisible.

What the demo needs, in priority order:
1. The console has to look clean on the surfaces that get filmed (Dashboard,
 App Inventory, App detail, Device detail). No visible glitches. (Em-dash
 cleanup and orphan-card hide this session address this.)
2. The lagging state has to render correctly and legibly on at least one real
 app. Lagging is THE differentiator and the demo centerpiece.
3. A product screenshot on the waitlist site (the site currently tells and
 never shows -- a visibility product with no product shot asks for faith).
4. A lagging-state section on the waitlist site with the security framing (the
 differentiator is currently absent from the marketing page).
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

APPROVED copy edits (ready to apply once screenshots exist):
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
 apps surface automatically") -- the Version Conflicts card is filed for
 removal and the conflict comparison over-reports. Promise only what's solid.
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
wording) so copy and screenshot line up.

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

Category: endpoint/patch management software (agent-based SaaS). Not pure SaaS,
requires a LaunchDaemon agent on each managed machine. Closest analogues:
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
 build for non-main branches (confirmed active this session).
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
- NOTE (this session): FLEET_SERVER_TOKEN and FLEET_SERVER_URL confirmed set
 for BOTH Production and Preview scope. So preview deployments DO have fleet
 access. (This ruled out the leading theory for the preview render weirdness.)

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

## Empty-cell display standard (NEW, July 6 2026 evening)
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
status-consolidation refactor was built to kill.
KNOWN INCOMPLETE: the old "Version Conflicts" stat card on App Inventory was
supposed to be removed and was not. Filed Sonnet cleanup, still open.

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
 get flagged. Filed, still open.
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
 every patch-queueing surface.

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
against live DB this session: the shipped patch-status CTE join is d.id =
a.device_id and is correct.)

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
 event_type TEXT NOT NULL, -- 'appeared' | 'removed'
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
 Railway CLI on Chip's machine.
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
appear to leak in the Dashboard's top-outdated path before this session's guard).
Part 6 reduction must skip all-removed bundles by branching on allRemoved, never
on status===null. No renderer reads status before checking allRemoved.

## Demo-visible fixes -- SHIPPED on branch part3-touchup @ 5e65b27 (UNMERGED)
Build green (exit 0, 36 pages, only a pre-existing middleware deprecation
warning). NOT yet merged to main. Contents:
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
 rows never overwritten by derivation.
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
 refactor Part 2, also ships module-derived status per row.
- GET /api/stats/patch-status: canonical fleet-wide counts, excludes removed
 apps. DISTINCT ON CTE, grouped by COALESCE(bundle_id, name), join d.id =
 a.device_id.
- GET /apps/:bundleId/first-seen: MIN(occurred_at) for event_type='appeared'.
- POST /patch, /patch-jobs/branch, /patch-jobs/bushel, /patch-jobs/orchard: all
 refuse to queue against a removed installation (Fruit 409; batch tiers
 silently exclude).
- POST /api/force-checkin.

## Feature status
- Soft-delete Parts 1-3: SHIPPED, end-to-end verified.
- Multi-variant identity Phase 1 + auto-resolution: SHIPPED.
- Catalog deploy identity guard: SHIPPED (label-level; bundleId gap open).
- "Installed since" chip: SHIPPED July 6.
- App Inventory card merge bug (PyCharm Pro/CE): FIXED July 6 (commit 28e5fe6,
 name-fallback gated on !bundleLower). Cosmetic quirk remains: both PyCharm
 cards show "PyCharm" (CE's agent-reported name is not "PyCharm CE"; a cleaner
 display name would come from the curated identity row).
- Console redesign: SHIPPED (liquid-glass, tokenized, light/dark, OS-follow).
 Inline style props only (Tailwind v4 purges utility classes in new/heavily-
 modified files).
- Sparkle resolver fix: SHIPPED to main this session.
- Em-dash cleanup / EmptyCell, Dashboard guard, default-hide: on part3-touchup,
 UNMERGED, build green.

### Not yet built (priority order, demo-first)
DEMO-READY TRACK (highest priority):
- Merge part3-touchup to main after verification (see Session close state).
- Waitlist site: product screenshot, lagging-state section, positioning reframe
 (MDM demoted to bonus, no-MDM as wedge), approved copy edits, cut orchard
 video. See "WAITLIST SITE POSITIONING." Needs the console demo-clean first
 (screenshots depend on it).
- Demo video: lagging state centerpiece. Pick and verify safe demo apps. AVOID
 1Password (gone from fleet). zoom.us is a clean Current example.
- Polished repo for public presentation.
- MacAdmins Slack outreach + contribution-first Installomator maintainer contact
 (coconutBattery HTML response is the confirmed bug-report opener).

DEFERRED POST-PREVIEW (invisible to demo, real debt):
- Status consolidation Parts 4-7 (the parked refactor).
- "Show removed" toggle (default-hide shipped; opt-in reveal pending, filed as
 backlog item 0 partial in tech-debt.md).
- CE display-name quirk (cosmetic).
- "Removed" wording precision (the predicate only knows "not seen recently," not
 "genuinely uninstalled"; app_lifecycle_events could power a "Not Seen Since"
 gray zone). Real product/UX decision, not a word swap.
- "Version Conflicts" stale-card cleanup + resolver conflict-normalization gap.
- Catalog-sync case-alias parser fix (jetbrainspycharmce produces exit 8).
- Catalog deploy bundleId guard (full isIdentityTrusted on the catalog path).
- Multi-variant identity GENERAL model (Opus). DaVinci MAS/free next.
- Patch-outcome-aware state (Opus).
- Phase E server-side patchable resolution (Opus). Must honor versionKey. Prep:
 installomator-reference.md.
- coconutBattery / TD-001 (Sparkle guard not end-anchored).
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
- Status computation duplication: the conceptual value (status/removal) is
 computed in ~10 independent sites across both repos. The parked consolidation
 refactor is the real fix. Until then, guard at call sites (the default-hide
 and Dashboard guard this session are correct-local fixes reading the
 server-sent field, not new re-derivations).
- Outdated-filter removal guard (frontend, filed this session): superseded by
 the parked Part 5 /apps/summary migration.
- Catalog deploy bundleId gap; resolver conflict-count normalization; catalog
 case-alias artifact; double enrichAppsWithLabels(); known ~1ms enqueue race;
 postinstall Installomator path conflict; unidentified Sparkle feed failure
 (1 of 3); identity bootstrap startup race; GITHUB_TOKEN over-scoped.
- 1Password fully removed from the fleet (informational): both machines run
 1Password 7 (com.agilebits.onepassword7), current. The removed row is
 com.1password.1password (that is the "1Password 8" bundle ID). Do NOT use
 1Password as a demo app.

## Known label-matching issues
- coconutBattery: patchable pipeline broken (scrapes HTML), available works via
 Homebrew. Maintainer outreach opener. See TD-001.
- Telegram: ru.keepcoder.Telegram correctly curated. com.tdesktop.Telegram
 orphan (last seen Apr 24) now hidden by default-hide.
- PyCharm CE: label NULL, pycharm-ce cask. jetbrainspycharmce phantom alias
 still in app_catalog (parser bug).
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
- Fix bugs at root cause, never workarounds. If a workaround is needed to unblock
 testing, flag it explicitly as tech debt and file it immediately.
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
 cleanly, split oversized prompts. NOT a capability problem, NOT caused by
 turning off tools.
- grep gotcha: grep exits 1 on no-match, which in a build|grep pipeline reads as
 a build failure when the build was actually clean. Do not treat grep's exit
 code as the build's exit code.

## COST + SESSION-LENGTH OPERATIONAL RULES (NEW, July 6 2026)
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
- PROPOSED (needs Jude's sign-off): server-side changes that touch production
 data or a canonical query require a before/after snapshot that Jude reviews
 before the change is treated verified, the server-side equivalent of the
 frontend Vercel-preview gate. Chip captures before/after; Jude reading the diff
 is the gate, not Chip's report that it passed.

## Three-channel chat architecture (OrchardPatch project)
1. "Architectural Deep Dives": Opus. Cross-repo architecture, multi-tenancy,
 Cultivation, version-resolver redesign, YC application, multi-week-consequence
 decisions.
2. "Troubleshooting": Sonnet. Isolated bug fixes needing focused attention.
3. Daily implementation chat: Sonnet. Ongoing dev work.
Evaluate model fit at session start and on scope shifts; call it out loud so
Jude can switch. Sonnet for scoped implementation; Opus only for multi-week-
consequence decisions.

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

## Copy / naming / brand (unchanged)
- Patch naming hierarchy: Fruit (one app, one device), Branch (all outdated, one
 device), Bushel (one app, all devices), Orchard (all outdated, whole fleet),
 Cultivation (policy-based, future/enterprise).
- Pricing tiers: Free (visibility only), Standard (Fruit), Pro (Branch + Bushel),
 Enterprise (Cultivation). Parent brand concept: GraftKit.
- Copy rules: no em dashes, no emoji, title case, no possessives. Status
 indicators use colored dots (8px filled circle, CSS var token), never emoji.
- Patch modes: silent / managed / prompted.
- Routing: /dashboard /apps /apps/[id] /catalog /devices /devices/[id]
 /patch-history /orchard.
- Brand color: console accent #3d7a42 (hunter green, WCAG AA 5.2:1 on white).
 Mint sibling #74cc7c for dark mode/sidebar wordmark. Lime #7dd94a retired from
 console, kept on marketing/waitlist only. Token system: primitives hold raw
 hex, semantic tokens expose --accent/--sidebar-accent, components reference
 semantic only.

## Lessons learned (condensed, most recent first)
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
not skipping downloads.
