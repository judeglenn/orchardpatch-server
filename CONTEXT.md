# OrchardPatch -- Project Context

Last updated: August 20, 2026 (Opus session, Architectural Deep Dives channel).
PRIORITY: DEMO-READY (set July 6, unchanged).

Six weeks elapsed between the July 7 sessions and this one. Work paused for
cost reasons, not because anything broke. This session did a full preflight
against live production, fixed a device identity bug at root, reconciled a
phantom device, confirmed a real lagging example for the demo, and found a
live wrong-label identity defect that is now the top open architectural item.

Repo tips at session close:
- orchardpatch-server: main at (see SESSION CLOSE STATE; 9645425 plus this
  session's identity-gate commits)
- orchardpatch (frontend): main at d00cc3d, unchanged since July 7
- orchardpatch-agent: main updated this session (serial fail-closed +
  hostname fallback removal)

CORRECTION TO PRIOR CONTEXT.md: earlier revisions stated the server main tip
as 7f9bef7. That is a FRONTEND commit hash and does not exist in the server
repo. The July 7 server tip was 362e7fb. Related: the "Dead routes removed"
work (/api/apps, /api/apps/[id], jamfClient.ts) was documented under
orchardpatch-server and is actually FRONTEND work (Next.js routes). Both
errors were caught this session by Chip reading actual git state.

---

## CURRENT PRIORITY: DEMO-READY

North star: a polished preview site plus product screenshots to take to
MacAdmins Slack. Interest equals traction equals leverage for a loan,
investors, or paying clients. Significant money already spent building; the
fastest path to converting that from sunk cost to asset is validated
interest, not more correct internals. Cut scope to what a viewer sees.

DECISION (Aug 20): the demo VIDEO is not required for the interest gauge.
The lagging state is inherently a static visual (three numbers with an arrow
progression). Screenshots plus a MacAdmins post are sufficient to measure
interest. Video is deferred, not cancelled.

What the demo needs, in priority order:
1. The lagging state rendering correctly on a real app. CONFIRMED AVAILABLE
   this session (Privileges, see below). The RENDER has still not been
   visually checked by a human.
2. Product screenshots on the waitlist site. The lagging-state app detail is
   the LEAD image. The dashboard is supporting evidence, not the argument.
3. A lagging-state section on the waitlist site with the security framing.
   Copy drafted, labels decided, not yet applied.
4. Positioning reframe and approved copy edits applied to the waitlist repo.
5. Polished repo for the curious admin who clicks through.

Demo hazards:
- Do NOT patch 1Password live. It no longer exists on the fleet (both
  machines run 1Password 7). The removed row is com.1password.1password.
- zoom.us is NO LONGER a clean "Current" example. As of Aug 20 it is
  outdated: installed 7.1.0 (83064), patchable 7.1.5.84650. Prior CONTEXT.md
  named it as the canonical Current example; that is now stale. It is a
  reasonable clean-patch demo candidate instead, if verified first.
- Ollama shows patchable AHEAD of available (0.32.15 vs 0.32.14,
  Installomator ahead of Homebrew). Legitimate, not a bug, but the resolver
  spec defines four states and this is not one of them. Whatever the version
  hero renders for three descending numbers is undefined. Keep out of frame.
- The Dashboard is currently NOT screenshot-safe (see Chrome identity defect
  below). Counts moved four times in thirteen minutes on Aug 20.

---

## THE LAGGING EXAMPLE: Privileges (CONFIRMED Aug 20, 2026)

This is the demo centerpiece and the outreach framing. Verified against
primary sources, not inferred.

State on the fleet:
- Installed: 1.5.4 (all devices)
- Patchable: 1.5.4
- Vendor latest: 2.5.3
- versionGt("2.5.3", "1.5.4") -> true -> LAGGING
- deriveStatus() -> "current" (installed == patchable)

Facts:
- SAP Privileges 2.5.3 published May 15, 2026.
- Privileges 1.5.4 released September 11, 2023, with 255 commits to main
  since. It DOES include the fix for CVE-2023-40307 (memory corruption,
  out-of-bound write). The pinned version is NOT itself vulnerable. Do not
  imply that it is.
- The Installomator `privileges` label HARDCODES the version:

  privileges)
      # Locking label to v1.5.4 because of changes in v2, see privileges2
      name="Privileges"
      type="zip"
      downloadURL=https://github.com/SAP/macOS-enterprise-privileges/releases/download/1.5.4/Privileges.zip
      appNewVersion=1.5.4
      expectedTeamID="7R5ZEU67FQ"
      ;;

  Identical on v10.8 (installed) and v10.9beta (main). Confirmed by live
  Installomator run: appNewVersion=1.5.4.

CRITICAL: this pin is DELIBERATE and ALREADY RESOLVED UPSTREAM.
- PR #2103 (merged 2025-01-07): "Lock label to 1.5.4, due to changes in
  Privileges 2. See conversation in #2081."
- Issue #2081: the community discussion that produced the pin decision and
  the simultaneous creation of a separate `privileges2` label for v2.x.
- Prior attempts (#2039, #2075) to update the label to pkg/v2 were not
  merged because of exit code 8 (app name mismatch with v2 behavior).

DO NOT FILE A BUG REPORT ON THIS. There is no open issue. Filing would
announce that the discussion was not read.

OUTREACH FRAMING (changed this session): this is NOT "Installomator has a
stale label." It is a structural blind spot. Installomator made a correct,
deliberate decision. The consequence is that any fleet using the `privileges`
label sits permanently on a September 2023 build while SAP ships 2.5.3, and
every tool that compares installed against installable reports Current,
indefinitely. Nobody did anything wrong, and no existing tool shows the gap.
That is safe to say publicly, criticizes no one, and is harder to argue with
than a bug report.

ANTICIPATED OBJECTION: "why not just use privileges2?" The answer is the
point: nothing in the tooling told you a successor label existed. Before
publishing, confirm `privileges2` is present in app_catalog and check
whether OrchardPatch could have surfaced it. That question will come in the
replies.

CLAUDE.AI ERROR CORRECTED: an earlier inference this session claimed the
privileges label resolved dynamically via downloadURLFromGit / versionFromGit
(reasoned from a 2024 GitHub issue) and that the lagging state was therefore
a false positive. Chip's live run of the actual v10.8 fragment disproved it.
Runtime evidence beats inference from search results.

---

## OPEN ARCHITECTURAL DEFECT: wrong-but-uncontested identity (Aug 20)

The largest finding of this session. NOT fixed. Opus / Architectural Deep
Dives, in a FRESH session.

### The instance

  com.google.Chrome | Chrome | chromeremotedesktop | curated=false

Google Chrome is mapped to the Chrome Remote Desktop Installomator label.
That label's packageID is com.google.pkg.ChromeRemoteDesktopHost. If it
resolved a version, OrchardPatch would render a patch button that installs
the Remote Desktop host package against Chrome. Best case Installomator
exits 8 (app name mismatch). Worst case depends on what the pkg does.

What is preventing harm RIGHT NOW is incidental: chromeremotedesktop fails
its version check, so patchable is NULL and no patch button renders. That is
luck, not a guard.

### Why Phase 1 did not catch it

The collision detector fires when two distinct bundle IDs claim ONE token.
Chrome Remote Desktop is not installed on the fleet, so only one bundle ID
holds `chromeremotedesktop`. One app matched to the wrong token, uncontested,
produces no collision to detect.

### Why the Part 5 patch guard does not catch it

isIdentityTrusted(bundleId, label) returns trusted when the label sits on the
app_identity row for that bundle_id AND no unresolved identity_conflicts row
exists. Chrome's row has the label. There is no conflict. It PASSES.
Confirmed by direct code read:

  isIdentityTrusted('com.google.Chrome', 'chromeremotedesktop')
  -> { trusted: true, reason: 'label present in app_identity,
       no unresolved conflicts' }

THE GAP: the guard was built to catch CONTESTED identity. Wrong-but-
uncontested identity walks straight through. This is a design gap, not an
implementation bug.

### Root cause of the mapping (definitive, verified)

lookupLabel('Chrome', 'com.google.Chrome') in the agent's catalog.js:

- Step 1 (bundle ID exact, catalog.byBundleId[bundleId]) COULD NOT FIRE.
  com.google.Chrome is ABSENT from byBundleId in the LIVE catalog
  (/etc/orchardpatch/installomator-catalog.json, written by the GitHub sync).
- Step 5 (partial match) fired: normalized name 'chrome', length >= 5,
  Object.keys(catalog.byName).find(k => k.startsWith('chrome')).
  The ONLY chrome-prefixed key in the live catalog is 'chromeremotedesktop'.
  It wins unconditionally.

TWO STACKED DEFECTS:

1. The bundled seed (data/installomator-catalog.json) correctly maps
   com.google.Chrome -> googlechrome. The merge logic says bundled wins:
   catalog.byBundleId = { ...catalog.byBundleId, ...(bundled.byBundleId || {}) }
   That mapping did NOT survive into the live catalog. Either the merge did
   not run (sync ran after/instead of merge on agent restart) or the bundled
   entry is no longer present in the seed file. UNRESOLVED, and it is the
   more serious of the two: if sync can destroy good bundled mappings, the
   seed is not load-bearing.

2. Step 5's startsWith partial match is name-derived AND order-dependent
   (Object.keys insertion order in V8). "Chrome" is a prefix of
   "chromeremotedesktop". This violates the project's own locked principle:
   name-derived signals are variant-blind, and a prefix match is name
   derivation at its loosest. The locked rule is fail toward missing; step 5
   does the opposite by construction. Removing it is CONSISTENT with the
   principle, not a regression, but it will drop legitimate matches too and
   needs to be a decision, not a reflex.

ALSO FOUND: byName maps 'googlechrome' -> googlechromeenterprise. Even a
name-exact path lands on the enterprise variant. A second wrong mapping one
step away.

### Scope: agent restart re-derives fleet-wide identity

All 26 non-curated app_identity rows re-derived at 2026-08-21 01:07:23 UTC,
triggered by the agent restart. Most landed correctly (Docker->docker,
Firefox->firefoxpkg, Slack->slack, zoom.us->zoom, Figma->figma, etc.), which
is why only four apps moved status. But a restart silently rewriting every
identity row is the STRUCTURAL finding, not the Chrome instance. An app
re-pointed from one working label to another working label flips silently
with no count movement at all.

Flagged rows from that pass:
- com.google.Chrome -> chromeremotedesktop. WRONG. Live safety defect.
- com.anthropic.claudefordesktop -> claudedesktop. Plausible name match; the
  label consistently fails (exit 1) so it is unknown rather than a patch risk
  today. Verify the label actually targets this bundle ID.
- com.tdesktop.Telegram -> telegram. This is the known stale orphan bundle
  ID. Re-deriving a label for a row that should not be patchable. The real
  Telegram (ru.keepcoder.Telegram) has a protected curated row and is
  unaffected. The orphan is hidden by default-hide on App Inventory.
- corp.sap.privileges -> privileges. CORRECT. Lagging shot is safe.

### Why this is Opus and not a tail-end patch

Four separate things are wrong at once: derivation running in two places
(bundled seed vs live sync), a matcher that produces confidently wrong
answers, a trust check that only catches contested cases, and a sync that may
be overwriting curated/bundled data. That is an identity-model question, the
same class as the June 26 Phase 1 work, and it deserves a fresh Opus session
with a clean context.

---

## COUNTS DRIFT (Aug 20) -- explained, root cause is the identity defect

Observed on Aug 20:

  17:48  outdated 11  current 9   unknown 16  system 65  store 9  total 110
  17:57  outdated 11  current 7   unknown 18  system 65  store 9  total 110
  18:01  outdated 9   current 7   unknown 20  system 65  store 9  total 110

Progressive, not a single event. Total held at 110 throughout, so nothing
appeared or vanished.

ROOT CAUSE: apps did not lose their versions. They were RE-POINTED at
different labels by the restart-triggered re-derivation. latest_versions
joins on label. Chrome used to join to googlechrome (resolves fine); it now
joins to chromeremotedesktop (no version). Patchable goes NULL, status goes
Unknown. Four labels changed, four apps moved.

CLAUDE.AI ERROR CORRECTED: an earlier theory this session claimed failed
version checks were destroying previously-good versions in latest_versions.
FALSE. The null-safe guard exists and works:

  ON CONFLICT(label) DO UPDATE SET
    latest_version = CASE
      WHEN EXCLUDED.latest_version IS NOT NULL AND EXCLUDED.latest_version <> ''
      THEN EXCLUDED.latest_version
      ELSE latest_versions.latest_version
    END,
    last_checked   = EXCLUDED.last_checked,
    error          = EXCLUDED.error

A failed check preserves the last good version and updates only error and
last_checked. The theory was built on Chip's inference phrase ("nulling out
whatever version was there before") repeated as root cause without reading
the code first. Same failure mode as the Privileges label error, same day.

---

## Version-checker bugs found Aug 20 (Sonnet-scoped, not demo-blocking)

1. DATE-PREFIX CAPTURE BUG. Four labels (boxdrive, chromeremotedesktop,
   nomad, microsoftteams-rollingout) all rejected the identical string
   "2026-08-20", which is today's date. Installomator prefixes every log line
   with a timestamp in exactly that format. The capture is grabbing a LOG
   PREFIX instead of appNewVersion=, meaning the early-kill fired without
   ever finding the value. The version-shape guard correctly rejected it, so
   behavior is fail-safe, but the capture is broken and it is ours, not the
   labels'. Chip's initial diagnosis ("those labels emit timestamps") was
   wrong.

2. latest_versions.last_checked is TEXT, not TIMESTAMPTZ. A 30-minute-window
   query returned zero rows because the cast comparison did not match. THIRD
   instance of this exact column-type class (apps.last_seen and
   devices.last_seen were fixed in soft-delete Part 1; pending_patches.
   created_at needed a cast fix in the same pass). This table was missed.

3. coconutBattery still rejects "<body" -- the HTML-response bug is live and
   remains the confirmed Installomator maintainer outreach opener.

Current NULL-version labels (13): claude, claudedesktop, trello, capcut,
darkroom, dropboxenterprise and others failing with "Command failed (exit 1)"
consistently across many cycles. Version population sits around 34/47.

---

## Device identity fix -- SHIPPED Aug 20, 2026

### The bug

`device-Mac` was a phantom device: 108 bundle_ids, ALL shared with
device-GJM7N0XGL0, ZERO unique. Created in a single check-in on Aug 19
17:04 UTC when serial resolution failed on Jude's machine and the server fell
back to deriving a device id from HOSTNAME.

Principle applied: device identity is the hardware serial. It is intrinsic.
Hostname is user-mutable and non-unique. Same intrinsic-versus-derived
distinction already locked for app identity, one layer down. A wrong device
identity is worse than a missing check-in: a missed check-in self-corrects in
one cycle, a phantom inflates counts, writes a duplicate lifecycle event set,
and needs manual reconciliation. Fail toward missing.

### How identity actually resolves (verified, resolves a prior contradiction)

- The agent sends { hostname, serial, model, cpu, ram, osVersion, osBuild }.
  It does NOT send a device id in the check-in payload.
- The server ALWAYS derives the id server-side and responds with it.
- saveDeviceId() caches the server's returned id to device-id.json. It is an
  UNCONDITIONAL writeFileSync on every successful check-in, so the cache
  SELF-HEALS after a bad derivation.
- The cache is read by getDeviceId() in scheduler.js (fast loop: pending
  patches, pending commands) and loadDeviceId() in reportPatchJob().
- CONSEQUENCE: a stale cached id does not create a phantom. It makes a real
  machine POLL A QUEUE NOBODY WRITES TO. Patches queued for that machine are
  never claimed; force check-in never fires. Both fail SILENTLY.

### What shipped

Server:
- Deleted the hostname branch in the checkin deviceId derivation. A check-in
  with a serial that is absent, empty, "unknown", or under 8 characters after
  sanitization is rejected 400 (identity_requires_serial), logged with
  hostname and agentVersion, and writes NOTHING (no device upsert, no apps,
  no lifecycle events, no collision detector, no removal reconciliation).
- Validation is deliberately PERMISSIVE (non-empty, not "unknown", min length
  8). No tighter shape regex: Apple serials were historically 10-12
  alphanumeric but recent randomized serials vary, and a regex that rejects a
  legitimate machine turns the fix into an outage.
- Removed the hardcoded `DELETE FROM devices WHERE id = 'device-Mac'` from
  migrate(). A row-specific data patch in startup code papering over a
  reproducing bug is the workaround-as-resolution pattern the standing rules
  forbid, and it would have silently absorbed a recurrence.

Agent:
- inventory.js getDeviceInfo(): removed `?? "unknown"` (would have produced
  device-unknown, worse than the hostname path since every failing machine
  collides on one row). Serial resolution now retries once, then THROWS.
  collectInventory -> runInventoryAndVersionCheck -> runCollection's catch
  logs to stderr (agent.error.log) and the slow loop skips the cycle. No
  payload is sent without a serial.
- scheduler.js getDeviceId(): removed the `|| ("device-" + os.hostname())`
  fallback. If the cache is absent the agent has never completed a successful
  check-in, so no pending work can exist for it; skip the fast loop and log.
- checkin.js reportPatchJob(): removed the hostname tier. job.deviceId
  (server-supplied with the job) remains as the fallback.
- Deliberately NOT done as the fix: raising the system_profiler timeout, or
  switching to `ioreg -c IOPlatformExpertDevice`. Both reduce how often the
  failure fires; neither changes what happens when it does. Fail-closed is
  the fix. A lighter serial source is a separate optional item.
- Deliberately NOT done: having the agent derive an id from serial locally as
  a fallback. That would put device-identity derivation in two places free to
  disagree, which is the bug class this project has hit four times. The cache
  is the agent's copy of the SERVER's answer. One derivation site.

### Reconciliation (Step 5), reviewed before/after

  BEFORE  devices 3   apps 291  patch-status {11,9,16,65,9, total 110}
  AFTER   devices 2   apps 183  patch-status {11,9,16,65,9, total 110}

FK verified verbatim before the delete (not inferred from source):
apps_device_id_fkey, confdeltype='c', ON DELETE CASCADE. 108 app rows and
108 lifecycle events cascaded. Zero patch_jobs, zero pending_patches.

CLAUDE.AI ERROR CORRECTED: an earlier claim that fleet counts were inflated
by the phantom was WRONG. /api/stats/patch-status dedupes fleet-wide by
COALESCE(bundle_id, name), and device-Mac had zero unique bundle_ids, so its
rows were already collapsed into the real device's. Counts were correct the
whole time. The corrected prediction (patch-status UNCHANGED) was stated
before the delete and held exactly, which is what confirmed the model rather
than just the outcome being acceptable.

Blast radius was genuinely cosmetic: 108 duplicate lifecycle events, an
inflated raw app row count, and a possible stale fast-loop cache on Jude's
machine.

### Remaining

- Jude's machine (device-GJM7N0XGL0) still runs the OLD agent. The server
  gate protects it regardless: a serial-less payload is now rejected outright
  so no phantom can be created. The agent change is defense in depth.
- Deploy on Jude's machine: git pull, bash build-pkg.sh,
  sudo installer -pkg OrchardPatch-Agent.pkg -target /
- READ device-id.json BEFORE installing, not after (a post-install read shows
  a file the new agent may have just rewritten, which proves nothing):
    sudo cat /var/root/.orchardpatch/device-id.json
  Expected device-GJM7N0XGL0. Chip asserted this file holds "device-Mac" but
  has never read Jude's machine; the self-healing write argues it healed on
  the first good check-in after Aug 19. Do NOT rm it. Read it, report it.
- BEHAVIORAL NOTE: if system_profiler times out on Jude's machine before the
  agent is updated, the old agent sends a serial-less payload, the server
  400s it, and that check-in is simply lost. Device goes stale one cycle and
  recovers. Intended fail-closed behavior, but it will look like a missed
  check-in rather than an error.

---

## Credential handling -- pattern locked Aug 20

`railway connect` against the Postgres service is now the standing pattern
for ad hoc production queries. It opens an authenticated psql session with NO
connection string materialized anywhere.

Do NOT use `railway run` env injection for this. It injects only
DATABASE_URL, which is Railway's INTERNAL hostname (postgres.railway.internal)
and is not resolvable from outside Railway's network. DATABASE_PUBLIC_URL is
not injected by railway run on that service. This pattern failed twice across
two sessions for the same reason.

INCIDENT (Aug 20, first preflight): Chip worked around the injection failure
by writing the public connection string to a TEMP FILE on disk, then cleaning
it up. That is a credential on disk and a deviation from the standing rule,
which previously named only DATABASE_URL and therefore did not literally
cover the public variable. Rule wording corrected: NO connection string of
any kind is written to disk, pasted into chat, or printed. Ever.

OPEN DECISIONS from that incident, not yet made:
- Whether to rotate the Postgres credential given it hit disk.
- Whether public networking on the Postgres service should be enabled at all.
  It is convenient for exactly this kind of query and it is also an
  internet-reachable database for a pre-revenue product.

Standing: before any `railway up`, run `railway status` and confirm the
linked service. The CWD default is Postgres, which is the July 2 incident
hazard.

---

## What OrchardPatch is

A Mac admin tool providing complete visibility into managed macOS fleet apps
and patching via Installomator, with no MDM required (MDM compatibility is a
bonus). In-app tagline: "See Everything. Patch Anything. Break Nothing."

Category: endpoint/patch management software (agent-based, requires a
LaunchDaemon on each managed machine). Closest analogues: Kandji, Mosyle,
Addigy. The security angle is real: OrchardPatch surfaces unknown apps,
outdated apps with CVEs, and the lagging state (vendor shipped a patch,
Installomator has not caught up, the exact window attackers exploit).
Security positioning is secondary in in-app UI copy, and is the lead for
waitlist/outreach framing where there is room to make the case.

Parent brand (future): GraftKit, the cross-platform umbrella when OrchardPatch
expands beyond macOS. graftkit.com registered but parked. Focus OrchardPatch
first. At that scale the competitors are NinjaRMM, ConnectWise, Automox.

### Strategic position (Aug 20)

Pre-revenue, waitlist stage, 12 organic signups from real Mac admin shops
with zero promotion.

OPEN QUESTION, deliberately not answered yet: is OrchardPatch a company Jude
owns, or a career credential? BOTH PATHS NEED THE SAME NEXT FOUR WEEKS
(screenshots, waitlist copy, MacAdmins post). A company needs traction to
raise; a credential needs a public artifact people saw and reacted to. The
fork only opens after the signal comes back. Deciding now is procrastination.

On the business loan idea: pushed back on, and not only on sequencing. A loan
is personal debt against a pre-revenue solo product and it funds burn rather
than buying an asset. What it would buy is more agent tokens, the input
already known to scale badly. If interest is real, the right instrument is
money from Mac admins, not a bank. Three shops paying a few hundred a month
validates AND funds, and proves someone will pay. Debt proves only
willingness to sign.

SET THE THRESHOLD BEFORE POSTING. There are already 12 signups; a second
interest test without a pre-committed number gets read as encouraging because
Jude wants it to be. Write down what counts as "huge" (e.g. 50 signups plus 3
shops willing to do a paid pilot within 30 days) before the post goes up.

CHEAP PARALLEL STEP, still not done: read the Premera IP assignment clause.
It gates open-sourcing on the credential path and gates everything on the
company path. Costs an afternoon. It is the one input that can invalidate a
plan after commitment.

---

## Repos

- Fleet server: github.com/judeglenn/orchardpatch-server
  - Local ~/Projects/orchardpatch-server
  - Deployed https://orchardpatch-server-production.up.railway.app
- Agent: github.com/judeglenn/orchardpatch-agent
  - Local ~/Projects/orchardpatch-agent
- Web app (frontend): github.com/judeglenn/orchardpatch
  - Local ~/Projects/orchardpatch
  - Deployed https://app.orchardpatch.com (primary),
              https://orchardpatch.vercel.app (alias)
  - Preview URLs: orchardpatch-git-<branch>-judeglenns-projects.vercel.app
    (team slug is judeglenns-projects, NOT judeglenn)
- Waitlist: github.com/judeglenn/orchardpatch-waitlist
  - Local ~/Projects/orchardpatch-waitlist
  - Deployed https://orchardpatch.com
  - GitHub PAT does NOT scope to this repo. Push via SSH only.

NOTE: openclaw.com is the gateway harness running Chip, NOT an OrchardPatch
property. Do not confuse it with orchardpatch.com.

## Stack

- Fleet server: Node.js/Express on Railway
- Database: PostgreSQL (Railway-hosted), schema auto-migrates on startup
- Web app: Next.js 14 App Router, TypeScript, Tailwind, Vercel
- Waitlist: Next.js 16.2.0, Tailwind v4, Resend, Google Sheets API, Vercel
- Agent: Node.js LaunchDaemon (root), local HTTP on port 47652
- Auth: x-orchardpatch-token header, SERVER_TOKEN env var

## Environment variables

Railway (fleet server): DATABASE_URL, SERVER_TOKEN (rotated June 13, 2026),
GITHUB_TOKEN (fine-grained PAT for catalog-sync), PORT, DATA_DIR.

Vercel (frontend): LOGIN_PASSWORD, SESSION_SECRET, FLEET_SERVER_URL,
FLEET_SERVER_TOKEN. All fleet calls go through the Next.js proxy layer
(Phase 5, June 16); no direct browser-to-fleet-server calls exist.
FLEET_SERVER_TOKEN and FLEET_SERVER_URL confirmed set for BOTH Production and
Preview scope, so previews have fleet access.

Vercel (waitlist): RESEND_API_KEY, WAITLIST_SHEET_ID, GOOGLE_SERVICE_KEY. All
three confirmed in production as of June 21; not in .env.local, expected.

Agent: SERVER_URL, SERVER_TOKEN, VERSION_CHECK_INTERVAL (check-ins between
version runs, default 10). INSTALLOMATOR_PATH is NOT an env var; the agent
discovers Installomator by checking a path list in order. GITHUB_TOKEN is
read from /etc/orchardpatch/config.json (githubToken field) via
applyConfigEnv() in scheduler.js at startup, falling back to
process.env.GITHUB_TOKEN. Renewed May 12, 2026, scoped to all public repos;
tighten to the Installomator repo at next rotation.

`launchctl kickstart -k` does NOT re-read plist EnvironmentVariables.
Changing an agent env var requires a full bootout/bootstrap.

config.json: /etc/orchardpatch/config.json, root:wheel 600 both machines.

  { "server": { "url": "...", "token": "<SERVER_TOKEN>" },
    "githubToken": "<GITHUB_TOKEN>" }

Read path is d["server"]["token"], NOT a flat serverToken key.

## Installomator path and version

- Canonical pkg-managed path: /usr/local/Installomator/Installomator.sh
- Legacy manual path: /usr/local/bin/Installomator.sh (do not rely on this)
- patcher.js INSTALLOMATOR_PATHS order: pkg path first, /usr/local/bin second
- v10.8 (2025-03-28) installed on both machines via catalog deploy June 16.
  v10.9beta (main branch) is what catalog sync pulls fragment data FROM;
  v10.8 (release branch) is the stable installed binary.
- The OrchardPatch postinstall script installs Installomator to
  /usr/local/bin/, conflicting with pkg convention. Tech debt.

---

## Architecture decisions

- Agent to server: REST polling only, no WebSocket. The server cannot reach
  NAT'd agents; all data flows agent-initiated upward.
- Agent loop split (Phase 6): fast loop 60s (pending_commands +
  pending_patches, first tick at 15s), slow loop 15min (full inventory +
  version checks). Two independent timers. The fast loop must not serialize
  behind a running Installomator process.
- Force check-in: the server writes a check_in row to pending_commands; the
  agent fast loop picks it up and runs the slow-loop inventory body.
- Patching via Installomator only. Post-patch the agent immediately ingests
  the confirmed version and triggers an inventory check-in.
- Vercel deploys automatically on push to main. Preview deployments build for
  non-main branches.
- Auth wall: Next.js middleware, LOGIN_PASSWORD + SESSION_SECRET. Placeholder
  until multi-tenancy.
- Installomator reads flags ONLY from positional KEY=VALUE arguments via an
  eval loop; it silently ignores environment variables. DEBUG=1 and
  NOTIFY=silent must be positional. DEBUG=1 skips only the INSTALL step, not
  the download.
- Exit code 23 = app previously installed from the App Store; Installomator
  respects the MAS install and will not overwrite. Correct behavior.
- Agent secrets live in config.json, not the plist.

## Version model -- two-number system (locked June 22)

- latest_patchable: what OrchardPatch can deliver now (Installomator-sourced).
- latest_available: newest release the vendor has shipped (server-side
  multi-source resolver: Homebrew, Sparkle, GitHub, later mas).

"Outdated" is not boolean. Four states from the relationship between
installed/patchable/available: current, patchable, lagging (vendor ahead of
Installomator), unknown. Show both numbers; the gap is a feature. Lagging is
the product wedge AND the automated Installomator-contribution signal.

Identity is keyed on the installed app's real bundle ID via the app_identity
mapping table. Curated identity mappings live in DB rows (curated=true), not
a file; multi-tenancy is the decider. Failed version coercion resolves to
Unknown, never Current.

FINDING (Installomator docs): Installomator compares for DIFFERENCE, not
greater-than. It has no concept of direction and therefore no concept of
lagging. versionGt HAD to be built here and cannot be borrowed. This
justifies the lagging differentiator and is good outreach framing.

FINDING (Installomator docs): versionKey, which Info.plist field Installomator
compares against, is configurable per label (default
CFBundleShortVersionString, some labels override to CFBundleVersion). Phase E
must honor this per-label. It is a latent installed-vs-patchable mismatch
source when agent and label read different plist fields; the zoom.us
"7.1.0 (83064)" vs "7.1.0.83064" shape is exactly this class.

FINDING (Installomator docs): packageID framing correction. Labels DO carry a
bundle ID via packageID, but the convention is to OMIT it for apps in
/Applications (it is meant for CLI tools and non-/Applications installs). So
it is absent precisely for the GUI apps that matter, by convention, not by
absence-of-concept. (Earlier CONTEXT.md said "bundleID is dead in the
fragment corpus," which was half-wrong.)

Build order: Phases A-C shipped. Phase D absorbed into the console redesign.
Phase E deferred with a designed target.

The lagging-state UI's three value labels are Installed / Patchable / Vendor
Latest (Title Case, decided July 7).

## Version normalization (locked June 26)

The most repeated bug class in this project.
- ONE shared definition: normalizeVersion in src/lib/utils.ts (frontend).
- Three steps in order: strip comma suffix ("12.8,282010" -> "12.8"), strip
  parenthetical build suffix ("7.1.0 (83064)" -> "7.1.0"), truncate to three
  segments ("7.1.0.83064" -> "7.1.0").
- For COMPARISON and STATE DERIVATION ONLY. Display always shows the raw,
  full version string.
- Server-side, the same normalization appears as nested regexp_replace in
  three queries (GET /apps/status, GET /devices outdated_count,
  GET /api/stats/patch-status) and must stay in sync.
- CRITICAL ESCAPING RULE: every backslash in a regex bound for PostgreSQL
  must be DOUBLED in JS source ([0-9] not \d, \\1 not \1, \\s \\( \\) \\.).
  Single backslashes are silently corrupted by JS string parsing. ALWAYS
  verify with a direct query, never by eyeballing.
- versionGt(a, b): segment-by-segment numeric comparison, directional.
  Lagging requires available > patchable, not mere inequality. versionGt
  lives in src/app/apps/[id]/page.tsx (page-local, ~line 89), NOT utils.ts.

## Raw version display principle (locked June 26)

Display raw, unmodified version strings everywhere version detail appears
(hero card, fleet rows, patch button labels). Normalize only behind the
scenes for badge/state derivation. Transparency is the product pitch; never
hide build numbers to make a comparison look clean.

## Empty-cell display standard (July 6)

Empty table cells render via a shared EmptyCell component (deliberately
blank, preserves row height and grid alignment), NEVER a typed glyph. This
replaced a scattered 20-site convention of inline em-dash placeholders.
EmptyCell is the copy-standard enforcement point.

## Canonical patch-status counts (shipped June 26)

Problem: outdated/current counts were computed in 4+ places with 4+ different
results. Fixed with a single source for FLEET-WIDE COUNTS:
- GET /api/stats/patch-status: DISTINCT ON CTE, dedup by COALESCE(bundle_id,
  name), worst-case-wins (outdated > unknown > current > na). Returns
  { outdated, current, unknown, system, store, total }.
- Consumers: Dashboard metric cards, App Inventory stats bar, Fleet page
  Outdated stat card. Per-device badges stay device-scoped.
- The fleet-wide dedup is why a duplicate device does NOT inflate these
  counts (confirmed empirically Aug 20).

This fixed the COUNTS, not per-item status badges. See status computation
duplication in open items.

## Resolver architecture (Phase B + C shipped June 23)

- src/lib/resolvers/homebrew.js: resolveHomebrew(pool). Fetches
  formulae.brew.sh/api/cask.json, multi-index lookup (label token, artifact
  .app name, cask name array), writes homebrew_cask to app_identity.
- src/lib/resolvers/sparkle.js: resolveSparkle(pool). sparkle_feed_url rows,
  fetches XML, extracts version.
- src/lib/resolvers/github.js: resolveGitHub(pool). Currently empty (no
  github_repo rows populated).
- src/lib/resolver-cron.js: coordinator. Promise.all across all three, merges
  by trust order (homebrew < github < sparkle), writes resolved_versions.
  Fires 30s after startup, then every 24h. runCollisionDetector() call site
  wrapped in .catch().
- conflict = true when sources disagree on major/minor. KNOWN BUG: the
  comparison does not apply normalizeVersion first, so format-only
  differences get flagged. Still open. DISTINCT from the removed Version
  Conflicts card; removing the card did not fix this.
- Homebrew name-based fallback matching (priorities 2-4) can let two distinct
  bundle IDs collide onto one cask. Root of the multi-variant identity
  problem, addressed by Phase 1.

## Sparkle resolver fix (shipped July 6)

Root cause: resolveSparkle read sparkle:version FIRST (the build number),
with sparkle:shortVersionString only as a fallback that never fired because
build numbers are always truthy. This stored build numbers as
latest_available, producing FALSE lagging states (Telegram latest_available
was "282010"). AppCleaner had a second bug: its feed is ASCENDING, so
items[0] was the oldest release.

Fix: read sparkle:shortVersionString FIRST; select the newest item by
sparkle:version (build number, a monotonic integer, the reliable sort key),
then read shortVersionString off that selected item. Applies to ALL feeds.
TRUST_ORDER / pickWinner precedence deliberately untouched: Sparkle beating
Homebrew is correct by design and is what makes lagging accurate.

Verified: Telegram "282010" -> "12.8", AppCleaner -> "3.6.8". coconutBattery
surfaced as a third affected app, resolves to "4.3.4b" (TD-001).

## Multi-variant identity -- Phase 1 SHIPPED (June 26)

Full spec: phase1-identity-spec.md (project file).

THE PRINCIPLE: identity is the installed app's CFBundleIdentifier. Signals
are either INTRINSIC (bundle_id, _MASReceipt, SUFeedURL; variant-safe) or
NAME-DERIVED (Homebrew casks, Installomator labels matched by display name;
variant-BLIND, "PyCharm" does not carry Pro vs CE). A WRONG mapping is worse
than a MISSING one; fail toward missing, not toward a green button that
destroys the wrong install.

THE FOUR FAMILIES (all resolved, verified via primary sources):
- PyCharm Pro (com.jetbrains.pycharm): label jetbrainspycharm, cask pycharm.
- PyCharm CE (com.jetbrains.pycharm.ce): NO valid Installomator label exists.
  jetbrainspycharmce is a case ALIAS inside the Pro fragment using product
  code PCP (Professional); running it installs Pro OVER Community. Curated:
  label NULL, cask pycharm-ce.
- Teams: NOT a collision. Two distinct apps, distinct labels/casks (classic
  has no Homebrew cask). Validates that the detector keys on TOKEN not NAME.
- Canva: MAS half (com.canva.canvaeditor) and direct half
  (com.canva.CanvaDesktop, label/cask 'canva'), dissolved by MAS-gating.
- Telegram: ru.keepcoder.Telegram confirmed to correctly target the telegram
  label. com.tdesktop.Telegram is a stale orphan.

FIVE PARTS SHIPPED (server a3abd19, f4a2011, 6e84fa9, 24940fb, 59264c2;
agent 993a8d0):
0. identity_conflicts table + idempotent MAS cleanup on startup.
1. MAS gates derivation, FIVE gate points (agent catalog.js, /checkin filter,
   identity-bootstrap.js WHERE, homebrew.js NOT EXISTS guard, db.js startup
   cleanup UPDATE). Verification found a 5th gate the spec missed.
2. Collision detector (src/lib/identity-collision-detector.js): any cask or
   label held by 2+ distinct NON-CURATED bundle_ids is NULLed on all of them
   and recorded. Keys on shared TOKEN not NAME. curated=true rows immune.
3. identity_conflicts table: per (bundle_id, source) pair. Distinct from
   resolved_versions.conflict (version-layer). This IS the curation worklist.
4. Six curated seed rows: PyCharm Pro/CE, Teams classic/new, Canva direct,
   Telegram (keepcoder).
5. Patch-path identity guard (src/lib/identity-trust.js):
   isIdentityTrusted(bundleId, label) checked before POST /patch (Fruit and
   Bushel hard refusal; Branch/Orchard per-app skip).

Checkin curated override (59264c2): /checkin looks up a curated=true row
before writing installomator_label, overriding stale agent-reported values.

Auto-resolution (156858c): resolveSettledConflicts() runs after every
detectAndRefuseCollisions() pass and marks resolved=true for any token with
fewer than 2 non-curated holders. Unblocked the Catalog deploy button.

Catalog deploy identity guard (9ee2670, 27d8b00, 1096270): label-level
conflict check for the label-only /patch path. has_conflict boolean on
GET /api/catalog, Deploy disabled when true. REMAINING GAP: full
isIdentityTrusted() requires bundleId; catalog deploys do not have one.

Display name (July 7): curated rows also drive DISPLAY name via
COALESCE(ai.app_name, a.name) on /apps/status.

KNOWN LIMIT, now demonstrated: Phase 1 catches CONTESTED identity. It does
NOT catch wrong-but-uncontested identity. See the Chrome defect above.

GENERAL MODEL REMAINS OPUS. Curation IS the design, not a workaround (both
Jamf and Installomator curate for the same structural reasons). Next known
instance: DaVinci MAS/free.

## Soft-delete app lifecycle -- SHIPPED Parts 1-3 (July 1-2)

SOFT-DELETE via last_seen, NOT hard-prune. The agent's per-directory
inventory loop uses catch{continue} silently, so a failed readdirSync sends a
zero-app payload indistinguishable from "user uninstalled everything."
Soft-delete makes that failure a non-event and gives fleet app-history free.

- last_seen is a positive fact the check-in asserts (SERVER clock, not
  agent-reported); removal is DERIVED, never a DELETE.
- Removal keyed on CHECK-IN CYCLES: apps.last_seen < devices.last_seen minus
  45 minutes (N=3 at 15-min cadence).
- HARD REQUIREMENT (met): the removal predicate is threaded into EVERY count
  and every patch-queueing surface.

Part 1 (f148600, b2a76b2, 4b4086b, dde38a1): apps.last_seen and
devices.last_seen promoted TEXT -> TIMESTAMPTZ, switched to now().
pending_patches.created_at cast fix (same class). Agent directory-loop silent
catch blocks now log.
Part 2 (156858c): collision detector conflict auto-resolution.
Part 3 (server 30114aa, b562b0c; frontend 8e3a172, e79ae19, fcbf610,
0a4d4f3): counts and /apps/status gained the removal predicate;
/apps/status returns removal_state per row as a COLUMN (not a WHERE filter,
the frontend decides display). Patch-path guards: Bushel/Branch/Orchard
exclude removed rows; Fruit returns 409. Frontend took FOUR rounds threading
removal state through per-device rows, the outdated filter, the app detail
page, DeviceStatusPill, and the AppCard badge. That four-round chase is
itself the status-duplication problem, filed architecturally.

Join key: devices has NO usable device_id join column. PK is id (TEXT, e.g.
'device-GJM7N0XGL0'). All joins use d.id = a.device_id.

## App lifecycle event log -- SHIPPED (08db542)

last_seen only tells you CURRENT state. This table records appeared/removed
events over time (the security-narrative payoff: how long was a vulnerable
version present). A cheaper first_seen column was rejected in favor of the
real event log.

  CREATE TABLE IF NOT EXISTS app_lifecycle_events (
    id SERIAL PRIMARY KEY,
    bundle_id TEXT NOT NULL,
    device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,       -- 'appeared' | 'removed'
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    app_name TEXT,
    version_at_event TEXT
  );
  -- index on (bundle_id, device_id, occurred_at DESC)

Write paths: 'appeared' at check-in (RETURNING xmax=0 AS inserted, batched).
'removed' via recordRemovalEvents() reconciliation, wired into the same three
call sites as the collision detector. Duplicate-write guard uses a DISTINCT
ON CTE with `le.event_type IS DISTINCT FROM 'removed'`.
Known limitation: no retroactive backfill; history is accurate only from
July 2, 2026 forward.

"Installed since" chip SHIPPED July 6 (GET /apps/:bundleId/first-seen).
A fleet churn/removal report is still not built.

## Production incident -- misdirected deploy crashed Postgres (July 2-6)

A `railway up` without confirming the linked service deployed the Node server
code onto the Postgres service, crashing the DB for ~3 days. Data was never
at risk (Railway volumes are separate from compute). Recovery: dashboard
Restart on the Postgres service's active deployment.

Two real server bugs were then root-caused (a8f69d3):
- bootstrapIdentity(pool) was AWAITED before app.listen(), freezing the
  process on a slow/unreachable DB. Now app.listen() fires immediately and
  unconditionally; bootstrapIdentity and startResolverCron are
  fire-and-forget.
- /health returned {status:"ok"} unconditionally even in its catch block. Now
  queries the DB (SELECT 1) and returns 503 {status:"degraded"} on failure.
Healthcheck timeout bumped 30s -> 180s (09a1ba4), necessary but not
sufficient alone.

Standing rules from this incident: confirm the linked service before any
railway up; credentials never in chat; before treating a deployment history
entry as current state, confirm which entry is ACTIVE; Railway dashboard
"Online" can reflect the service definition rather than the running instance,
so a direct connection test is the ground truth.

## Status computation consolidation -- DESIGNED then PARKED

Design locked in a Deep Dive (status-consolidation-spec.md). Implementation
Sonnet-scoped. PARKED after Part 3 when priority pivoted to demo-ready.

Shipped (safe to leave in place):
- Part 0 verified inputs. Key findings: grouping is COALESCE(bundle_id, name)
  not strict bundle_id; versionGt is page-local; devices has no device_id
  column; /apps/status already carries all six status inputs.
- Part 1: src/lib/app-status.js (deriveStatus + aggregateFleetStatus), 41/41
  unit tests. Ports normalizeVersion and versionGt verbatim. Taxonomy:
  system -> system, mas -> store, missing patchable or coercion failure ->
  unknown (never current), versionGt(normalize(patchable),
  normalize(installed)) -> outdated, else current. aggregateFleetStatus
  filters removed first, worst-case-wins, all-removed returns a null sentinel
  plus allRemoved=true. Lagging is APP-level (versionGt(normalize(available),
  normalize(patchable)), both required).
- Part 2: /apps/status ships derived status + removal_state per row. Verified
  182/182 rows match old patch_status through the vocab map.

Vocab map (old SQL patch_status -> module status): na+source=system ->
system, na+source=mas -> store, identity for unknown/current/outdated.

Garbage-version correction (0 live rows on the divergent path): shipped SQL
gives a non-coercible installed version a THREE-WAY behavior (NULL patchable
-> unknown, real patchable -> outdated, matching-garbage patchable ->
current, the last being an actual bug). The module's flat 'unknown' is
correct in all three cases; the module supersedes the SQL behavior.

Parts 4-7 DEFERRED: /apps/summary + App Inventory migration (5), counts +
devices outdated_count migration (6), cleanup + final grep (7). When
resumed: Part 5's outdated-filter predicate must move to module-derived
status; Part 6 reduction must skip all-removed bundles by branching on
allRemoved, never on status===null; no renderer reads status before checking
allRemoved.

## Console redesign and July 7 demo-visible fixes (condensed)

Console redesign SHIPPED: Liquid Glass aesthetic, fully tokenized CSS
variable system, zero hardcoded hex in components, light and dark, first load
follows prefers-color-scheme with a session-scoped manual override. Inline
React.CSSProperties only (Tailwind v4 purges utility classes in new or
heavily-modified files). Design reference files committed to
design-reference/ (316e5ec) as the documented source of truth.

July 7 morning: em-dash cleanup via EmptyCell; Dashboard "Top Outdated Apps"
removal guard; default-hide for removed apps on App Inventory (visibility
flag reading server-sent removal_state, NOT a re-derived predicate, with
nonRemovedCount/effectiveTotal so the "X of Y" denominator matches the
visible set; rows are hidden, never dropped from data); Version Conflicts
stale stat card removed (9252ff0, grid 4->3); AgentBanner false-positive
fixed at root (ff62a61); five screenshot-pass fixes (0aab011 frontend,
362e7fb server): modal/tooltip em dashes, device-page Removed collapsible
section, PyCharm CE and Teams classic display names via curated COALESCE,
Docker text clipping (removed unnecessary maxHeight/overflow on an already
.slice(0,6)-capped list), Patch Status bar reorder.

AgentBanner root cause is worth keeping: the banner performed its own
INDEPENDENT fetch to /api/fleet/status, which called a separate fleet-server
endpoint, one-shot with no retry, behind ISR caching. It could say "no fleet
data" while the page underneath rendered live data. Fix: new
FleetStatsProvider.tsx fetching the canonical /api/stats once on mount and
exposing status via context; AgentBanner consumes useFleetStats(); layout.tsx
wraps the content column; /api/fleet/status DELETED. Retry logic or cache
tuning would have treated the symptom. The fix was eliminating the second,
independent computation.

July 7 afternoon: MethodBadge tooltip middots ACTUALLY shipped (7b99a6f,
after being falsely documented as done in the morning); Removed section
latest_version column dropped (6c22151); dead frontend routes /api/apps and
/api/apps/[id] plus jamfClient.ts listApps/getApp removed (6f892b7, 7f9bef7);
toast message em-dash wording pass, 9 strings rewritten as real sentence
splits, emoji stripped from 2 catalog toasts (d00cc3d); ripgrep installed.

---

## DB schema (key tables)

- devices: id (TEXT PK), hostname, device_id (LEGACY, not the join key,
  may be null), last_seen (TIMESTAMPTZ, server clock), agent_version,
  agent_url. 11 columns. Join is d.id = a.device_id.
- apps: id, device_id, bundle_id, name, version, latest_version
  (legacy/null), is_outdated (legacy/always 0, do not use),
  installomator_label, path, source (user/system/mas), last_seen
  (TIMESTAMPTZ). Removal is DERIVED, never a DELETE.
  FK apps_device_id_fkey -> devices(id) ON DELETE CASCADE (verified Aug 20).
- latest_versions: label (PK), latest_version, last_checked, error. ~34/47
  populated. Null-safe ingest CONFIRMED WORKING (CASE preserves prior value
  on a failed check). BUG: last_checked is TEXT, should be TIMESTAMPTZ.
- app_catalog: label (PK), app_name, bundle_id (null for ~all rows by
  convention), expected_team, last_synced, download_url. 1,137 rows
  (includes phantom case-alias entries from a known parser bug).
- app_identity: bundle_id (PK), app_name, installomator_label,
  homebrew_cask, github_repo, sparkle_feed_url, adam_id, curated,
  last_derived. curated=true rows never overwritten by derivation. app_name
  on curated rows drives DISPLAY name fleet-wide via /apps/status.
- resolved_versions: bundle_id (PK), latest_available, source, source_url,
  candidates (JSONB), conflict, resolved_at, error. Version-layer.
- identity_conflicts: id, bundle_id, source, token, competing_bundle_ids,
  detected_at, resolved. Unique index (bundle_id, source, token).
  Identity-layer. Do not conflate with resolved_versions.conflict.
- app_lifecycle_events: see above.
- patch_jobs: id, device_id, app_name, label, mode, method, status,
  created_at, started_at, completed_at, exit_code, error, log. Known exit
  codes: 0, 8 (app name mismatch), 11 (checksum), 16 (download), 23 (MAS),
  null (never ran).
- pending_patches: agent work queue, rows deleted on terminal status.
  claimed_at is TEXT (staleness sweep casts). Silent patches withhold the row
  15s for the undo window.
- pending_commands: id, device_id, command, created_at, claimed_at,
  completed_at, result. Allowlist { check_in } only.

## Key API endpoints

- POST /checkin: apps + devices upsert last_seen = now(). Curated identity
  override before writing installomator_label. runCollisionDetector() and
  recordRemovalEvents() called post-write. AS OF AUG 20: rejects 400
  (identity_requires_serial) when the payload has no valid serial, writing
  nothing.
- GET /devices: outdated_count excludes removed apps.
- GET /apps/status?device_id=: returns removal_state and a.last_seen per row,
  module-derived status per row, and COALESCE(ai.app_name, a.name) as display
  name. Does NOT filter on removal_state. This is the SINGLE endpoint feeding
  display name on Device Detail, App Inventory, and App Detail.
- GET /api/stats/patch-status: canonical fleet-wide counts, excludes removed
  apps. DISTINCT ON CTE, grouped by COALESCE(bundle_id, name).
- GET /apps/:bundleId/first-seen: MIN(occurred_at) for 'appeared'.
- POST /patch, /patch-jobs/branch, /patch-jobs/bushel, /patch-jobs/orchard:
  all refuse to queue against a removed installation (Fruit 409; batch tiers
  silently exclude).
- POST /api/force-checkin.
- GET /api/fleet/status: DELETED July 7. Do not recreate this pattern;
  connection status derives from data already fetched for page rendering.
- /api/apps and /api/apps/[id]: DELETED July 7 (FRONTEND routes).

---

## Fleet

- 2 devices in production (was 3 before the Aug 20 phantom reconciliation).
- device-GJM7N0XGL0: Jude's MacBook Pro (Mac16,1). ~111 apps. Still runs the
  pre-Aug-20 agent; server-side gates cover it.
- device-C02D52QTML85: Chip's MacBook Pro (MacBookPro16,2, 2020 13" Intel i7
  16GB, macOS 26.3.2). ~72 apps. Aug 20 agent deployed here.
- device-Mac: PHANTOM, deleted Aug 20. 108 apps, all duplicates.
- Agent install path /usr/local/orchardpatch/agent/. Config
  /etc/orchardpatch/config.json (root:wheel 600). Logs
  /var/log/orchardpatch/agent.log and agent.error.log.
- Installomator v10.8 both machines.
- Do NOT treat last_seen frozen ~2026-07-02 20:47-21:20 UTC as a real
  removal; that window is the Postgres outage.

## Known label-matching issues

- com.google.Chrome -> chromeremotedesktop. WRONG, live. See the open
  architectural defect above. Top priority.
- byName 'googlechrome' -> googlechromeenterprise. Second wrong mapping.
- coconutBattery: patchable pipeline broken (scrapes HTML, returns "<body"),
  available works via Homebrew. Confirmed maintainer outreach opener. TD-001.
- Telegram: ru.keepcoder.Telegram correctly curated. com.tdesktop.Telegram
  orphan hidden by default-hide.
- PyCharm CE: label NULL, pycharm-ce cask, displays as "PyCharm CE".
  jetbrainspycharmce phantom alias still in app_catalog (parser bug).
- DaVinci Resolve: MAS on Jude's machine, may be direct elsewhere.
- firefoxpkg: verify it patches standard Firefox not ESR.
- Date/build-versioned labels (boxdrive, nomad, Teams): version-shape guard
  rejects to null. NOTE: as of Aug 20 these rejections are the LOG-PREFIX
  capture bug, not genuine date-shaped versions.

---

## WAITLIST SITE POSITIONING (decided July 6-7, NOT YET APPLIED)

Live at https://orchardpatch.com. Copy is strong, visual design is good. The
gaps are content, not design.

Positioning changes:
- OrchardPatch STANDS ALONE. It is a complete fleet app inventory and patch
  tool. MDM compatibility is a BONUS FEATURE, not the organizing premise.
- NO-MDM operation is a WEDGE, not a footnote. The current page assumes the
  reader has an MDM in three of five sections, which accidentally excludes
  the no-MDM segment. Demote MDM to one card plus compatibility clauses.
- Do NOT delete the MDM story. Jamf/Kandji shops care about "does not fight
  my MDM, no Secure Token needed." Demotion, not deletion.

Approved copy edits:
- Hero solution triad: drop "Zero friction." New: "Full visibility. Smart
  patching."
- Definition one-liner BEFORE the problem section: "OrchardPatch is an
  agent-based app inventory and patch tool for macOS fleets. No MDM required.
  If you run one, it works alongside without touching it."
- Hero value-prop: reframe "without touching your MDM" to "no MDM required."
- Replace the italic subhead "Your MDM handles enrollment..." with something
  standalone, e.g. "One agent per Mac. Full inventory, real patching, no MDM
  stack required."
- Solution headline "works alongside your existing MDM. Not against it." ->
  "Full visibility. Real patching. One lightweight agent." The MDM-safe point
  lives inside the MDM-Safe Patching card.
- Soften "Patch with One Click." Lead with the honest Silent/Managed/Prompted
  detail instead.
- Cut "Version conflicts and" from step 2 (the card was removed from the
  product and the conflict comparison over-reports).
- CUT the stock orchard video. If motion is added later, use real product
  footage.

Lagging-state section (draft):
  Eyebrow: THE GAP NOBODY ELSE SHOWS
  Headline: Know when you are exposed, not just when you are behind.
  Body: A vendor ships a security fix. Your patch tooling has not caught up
  yet. That window, where the fix exists but you cannot deploy it, is exactly
  when the vulnerability is public and unpatched on your fleet. OrchardPatch
  tracks two versions for every app: the newest release the vendor has
  shipped, and the newest version your patch source can actually install.
  When those diverge, you see it. Most tools only compare installed against
  installable and call it current. They cannot show you a gap they do not
  track.
  Caption: Installed, Patchable, and Vendor Latest, side by side. The lagging
  state is the difference the others hide.

CONSIDER (Aug 20): the Privileges example makes a stronger, more concrete
version of this section available. A real screenshot with real numbers
(1.5.4 / 1.5.4 / 2.5.3) and the three-year gap is more persuasive than the
abstract framing. Worth rewriting the section around the actual example.

Existing page facts: Next.js 16.2.0, Tailwind v4, Resend, Google Sheets API
dual-write, Vercel auto-deploy. GitHub PAT does NOT scope to this repo, SSH
only. Light mode, macOS Finder-inspired aesthetic. Brand names (Fruit/Branch/
Bushel/Orchard/Cultivation) kept OFF the page. No vendor name-drops.
Installomator mentioned in PATCHING context only, never discovery.

## Screenshot guidance (Aug 20)

- LEAD IMAGE: the Privileges app detail showing the lagging state. That is
  the only image that shows something no other tool shows.
- The Dashboard is a competent fleet inventory view that looks like Kandji or
  Mosyle. Nothing on it is unique. It is supporting evidence (the product is
  real and finished), not the argument. Second or third image.
- Unknown is currently the second-largest number on the dashboard (18-20) and
  larger than both Outdated and Current. Honest and consistent with the
  visibility pitch, but naked on a marketing page a skeptic reads it as "this
  tool does not recognize half my apps." Surrounding copy must frame Unknown
  as deliberate visibility, not gaps.
- Fleet size is 2 devices. Options: crop to app-level views where device
  count does not show, or say it plainly in the post ("running on my own two
  machines, looking for admins who want to point it at a real fleet"). The
  second converts the weakness into the ask, and Mac admins respond well to
  someone not overselling.
- COPY ISSUE FOUND: the Orchard tier card on the Dashboard is titled
  "OrchardPatch" with subtitle "Queue Patches Across Your Entire Fleet." Out
  of context that reads as a card named after the product inside the product.
  The design spec called it "Patch by the Orchard." Check whether this
  drifted.

---

## Go-to-market

- Target: MacAdmins Slack (70k+), Jamf Nation, PSU MacAdmins.
- Distribution: bottom-up, individual Mac admins champion internally.
- Key pitch: "Jamf App Catalog shows you what you told it to track.
  OrchardPatch shows you everything that's actually on your fleet." Plus the
  no-MDM wedge.
- Competitive window: 18-24 months before Jamf App Installers become a real
  threat.
- Jamf App Catalog is human-curated, BUNDLE-ID-ANCHORED patch definitions
  (~700-800 titles, paid team). A definition separates "what is this app"
  (detection criteria, bundle-ID-keyed, per-variant) from "how to install
  it." That detection layer is exactly what Installomator lacks and what
  OrchardPatch is retrofitting. Jamf Title Editor is a custom external patch
  source built on Kinobi (acquired 2021), the seam that lets shops run
  Installomator-for-installs plus Jamf-for-compliance.
- CURATION IS THE DESIGN, not a workaround. Both authoritative players curate
  because heterogeneous vendors, no standard version API, and same-named
  variants do not admit a fully-derived solution.
- Installomator maintainers have hit same-name collisions (VirtualBox/
  BoxDrive, Parallels-bundled Edge), solved at install-DETECTION. The variant
  problem is familiar to them, not foreign.
- Installomator outreach: contribution-first. Attribution already live in the
  UI. coconutBattery HTML-response bug is the confirmed opener. Framing:
  distribution channel, not competitor. Homebrew/mas support should be
  org-level opt-in; be upfront with maintainers.
- POST STRUCTURE (Aug 20): lead with the coconutBattery bug report already
  filed and the observation that Installomator compares for difference rather
  than direction, so lagging is a signal it structurally cannot produce. THEN
  the tool. That order buys standing.
- The MacAdmins post is not one-shot (you can post there for years), but the
  first impression is.

## Copy / naming / brand

- Patent, trademark, and copy strategy TBD.
- "OrchardPatch" is the product name. GraftKit is the parent brand (future).
- Brand names (Fruit/Branch/Bushel/Orchard/Cultivation) are internal patch
  tier names; they stay OFF the public site and outreach materials.
