# Status Computation Consolidation -- Spec

Date: July 6, 2026
Routing: Design locked in Deep Dive (this spec). Implementation is
Sonnet-scoped (Chip, daily channel).
Repos touched: orchardpatch-server (new module, endpoint changes),
orchardpatch (type fixes, call-site replacement, deletion of all
client-side derivation).
Source data: status-audit-v2.txt (July 6) -- 10+ independent
status/removal computation sites across both repos.

## The principle (do not deviate)

The frontend NEVER computes status. The server derives status once, at
read time, in JS, from already-correct inputs, and ships it in every API
response containing app rows. Every frontend component becomes a pure
renderer of what it was sent.

- Status is DERIVED, never stored. No computed_status column, no
 materialization. Same reasoning that rejected deleted_at for
 soft-delete: a derived value cannot drift from truth, a stored one can.
- Removal derivation is unchanged: apps.last_seen < devices.last_seen -
 45 minutes. It moves into the module as the single JS implementation,
 but the predicate itself does not change.
- The patch-path SQL guards (Fruit 409 pre-check, Branch/Bushel/Orchard
 WHERE predicates) are OUT OF SCOPE. They are queue-time safety checks,
 verified July 1-2. The final diff must show zero changes to those
 queries.
- Reproduce today's semantics EXACTLY. The "Removed" vs "Not Seen Since"
 wording question is explicitly out of scope. This refactor must be a
 pure before/after no-diff so verification is mechanical. The module
 makes that future change a one-function edit, which is the point of
 building it, but it does not happen here.
- Raw version display principle unchanged: raw strings in every response
 and every render. Normalization exists only inside comparison.

## Part 0 -- Verify before writing (read-only, quote code)

1. Quote src/lib/utils.ts normalizeVersion and versionGt in full
 (frontend). These get ported verbatim to the server module, which
 becomes the canonical copy.
2. Quote the /api/stats/patch-status CTE in full, including the
 worst-case ordering (outdated > unknown > current > na) and the
 removal predicate. The module must reproduce this ordering exactly.
3. Quote the exact response shape /apps/status returns today (every
 field).
4. For each endpoint in scope (/apps/status, /api/stats/patch-status,
 GET /devices), confirm which per-row inputs are already joined in:
 raw installed version, latest patchable (latest_versions via label),
 latest available (resolved_versions.latest_available), source,
 apps.last_seen, devices.last_seen. Note any endpoint missing one of
 these -- it needs the join added in Part 2/6, and we want to know now.

Report to ~/Desktop/status-part0.txt before writing any code.

## Part 1 -- src/lib/app-status.js (server module + unit tests)

Pure functions. No pool, no queries, no imports beyond the ported
version helpers. Unit tests land in the same commit.

### deriveStatus(row) -> { status, removalState }

Input: { version, latestPatchable, latestAvailable, source, appLastSeen,
deviceLastSeen }.

- removalState: 'removed' when appLastSeen < deviceLastSeen - 45 min,
 else 'present'. Timestamps arrive as Date/timestamptz values from the
 driver; this is a numeric comparison, no string parsing.
- status taxonomy is identical to today's:
 - source = 'system' -> 'system'
 - source = 'mas' -> 'store'
 - latestPatchable missing OR version coercion fails -> 'unknown'
 (failed coercion NEVER resolves to current -- existing locked rule)
 - versionGt(normalize(latestPatchable), normalize(installed)) ->
 'outdated'
 - else -> 'current'
- Lagging is NOT a per-device status and deriveStatus does not return
 it. It is app-level (see aggregate below). This matches today: a
 device can be current while the app is lagging.

### aggregateFleetStatus(rows) -> app-level summary

Input: all installation rows for one bundle_id, each already shaped for
deriveStatus. Output: { status, lagging, allRemoved, deviceCount,
outdatedCount }.

- Filter removed rows FIRST. Aggregation runs on survivors only.
- status: worst-case-wins across survivors using exactly the CTE's
 ordering from Part 0.2.
- allRemoved: true only when every row was removed. (This is the
 allRemovedMap logic, moved server-side.)
- lagging: versionGt(normalize(latestAvailable),
 normalize(latestPatchable)), requiring BOTH values present. Missing
 either -> false. Format-only differences must not trigger it
 (normalize before compare).
- deviceCount / outdatedCount: computed from survivors, matching what
 App Inventory cards display today.

### Unit tests (same commit, all from verified production cases)

- zoom.us: installed "7.1.0 (83064)", patchable "7.1.0.83064" ->
 current. Raw strings pass through untouched.
- Comma format: "12.8,282010" compares as "12.8".
- 1Password 8: appLastSeen June 16, deviceLastSeen now -> removed.
- PyCharm Pro (present, patchable) and PyCharm CE (removed) as separate
 bundle_ids -> two distinct aggregates. Aggregation keys on bundle_id,
 NEVER name.
- MAS row (ru.keepcoder.Telegram shape) -> store.
- Failed coercion (garbage version string) -> unknown, never current.
- Lagging true: patchable 1.2.0, available 1.3.0.
- Lagging false: patchable "1.2.0", available "1.2.0 (900)" (build-only
 difference dies in normalization).
- Lagging false: available present, patchable null.
- allRemoved: all rows removed -> true; one survivor -> false.

## Part 2 -- /apps/status ships derived fields

The endpoint fetches raw inputs (adding any joins Part 0.4 found
missing), maps every row through deriveStatus, and returns status and
removal_state per row ALONGSIDE everything it returns today. No field
is removed in this part -- old fields keep flowing until Part 7 so no
consumer breaks mid-migration.

Verify: curl against production, spot-check zoom (current), 1Password 8
(removed, both devices), PyCharm CE (removed), Telegram on Jude's
machine (store).

## Part 3 -- Device detail page (closes G6-G9)

1. Add status and removalState to the FleetApp TypeScript type FIRST.
 This is the G6 fix, and the compiler will now surface every blind
 spot on the page. Fix what it flags, do not suppress.
2. outdatedCount / currentCount switch to counting server-sent status,
 removed rows excluded (G7).
3. App table renders server-sent status; removed rows get the muted
 "Removed" label and no colored badge, matching the app detail page's
 existing treatment (G8).
4. Branch modal precheck list filters removed rows (G9 -- server already
 refuses them, this aligns the display with reality).

Own commit. Verify on Vercel preview against live data before merging.

## Part 4 -- Dashboard hero + App detail proxy

- Dashboard top-outdated aggregation reads server-sent status and drops
 its raw patch_status filter (removal-blind today).
- /api/fleet/apps/[id] stops deriving hasVersionConflict; it passes
 server-sent fields through untouched.

Own commits, own preview verification each.

## Part 5 -- App Inventory via GET /apps/summary

New server endpoint: GET /apps/summary. One row per bundle_id, produced
by grouping /apps/status's row set by bundle_id and running
aggregateFleetStatus on each group: { bundle_id, name, status, lagging,
allRemoved, deviceCount, outdatedCount, raw version fields as today }.

HomePageInner consumes it. patchStatusMap and allRemovedMap are DELETED,
not bypassed. The bundle-id-first dedup fix from commit 28e5fe6 (name
fallback gated on !bundleLower) moves server-side into the grouping
logic with the same rule: a row with a bundle_id is never grouped by
name, name grouping only for rows with no bundle_id at all.

This surface is currently CORRECT, which is why it migrates late: every
part before it can be diffed against a known-good page.

Own commit, preview verification: App Inventory renders identically
(PyCharm Pro and CE as two cards, removed apps greyed, filter counts
unchanged).

## Part 6 -- Counts migrate to the module

- /api/stats/patch-status reimplemented as: fetch the same raw rows,
 group by bundle_id, run aggregateFleetStatus, reduce to { outdated,
 current, unknown, system, store, total }. Counts are now a REDUCTION
 of the exact function output that renders App Inventory cards --
 the two can no longer disagree by construction.
- GET /devices outdated_count: same migration. Fetch rows per device,
 derive, count. This removes the third SQL copy of the normalization
 regex.
- After this part, ZERO regexp_replace-based version normalization
 remains in server SQL for status purposes. The backslash-doubling
 hazard class is structurally gone from status logic.

Verification is a hard gate: capture both endpoints' full JSON output
BEFORE the swap, capture after, diff must be empty (field order aside).
If any number differs, stop and root-cause -- do not "fix" the new code
to match without understanding which side was wrong.

## Part 7 -- Cleanup (only after Parts 2-6 verified)

- PatchStatusBadge takes status and nothing else. The internal
 hasVersionConflict fallback is DELETED (unreachable code dies, it does
 not linger).
- VersionBadge reviewed against the contract: if it renders any
 status-like concept, it consumes server-sent fields.
- isOutdated and hasVersionConflict removed from frontend types, props,
 and proxy responses.
- Old duplicate fields dropped from /apps/status once grep confirms no
 consumer reads them.
- Final grep across BOTH repos for patch_status, isOutdated,
 hasVersionConflict, removal_state, last_seen comparisons: every hit
 must be either (a) a pure render of a server-sent field, (b) the
 server module itself, or (c) the untouched patch-path guards. Anything
 else is a missed site -- fix before closing.

## Hazards

- The GOAL is deleting SQL regex normalization. Do not add any new
 regex to SQL during migration. If a temporary SQL touch is
 unavoidable, every backslash doubled, verified by direct query.
- These files contain SQL strings: direct file-edit tools only, never
 Python-generated edits (heredoc escape mangling).
- Single quotes inside single-quoted JS strings: known crash class
 (27d8b00). Watch delimiter collisions in any SQL string edits.
- npm run build locally before every Vercel push.
- Any frontend styling: inline style props only (Tailwind v4 purge).
- railway status before any railway up. No exceptions.
- Old fields keep flowing until Part 7. Nothing is removed until every
 consumer is switched and verified.

## Done means

- Zero client-side status/removal derivation in orchardpatch (final
 grep in Part 7 is the proof).
- Zero version-normalization regex in server SQL for status purposes.
- Counts endpoint, App Inventory cards, Dashboard, Device detail, App
 detail all read module-derived values; fleet counts are arithmetic
 over the same function output that renders the cards.
- Before/after parity: counts JSON identical, known cases identical
 (zoom current, 1Password 8 removed both devices, PyCharm CE removed,
 Teams classic removed, Telegram store on Jude's machine).
- Patch-path guard queries: diff shows zero changes.
- FleetApp type declares status and removalState. PatchStatusBadge has
 no fallback logic.
- Unit tests for the module pass and live in the repo.

## Sequencing

0 verify -> 1 module + tests -> 2 /apps/status fields -> 3 device
detail -> 4 dashboard + proxy -> 5 App Inventory via /apps/summary ->
6 counts + devices outdated_count -> 7 cleanup.

One commit per part. Verify each part against production data before
starting the next. Parts 3-6 each get a Vercel preview or direct query
check. If the same class of discrepancy appears twice during migration,
stop and grep all sites before writing the next fix.
