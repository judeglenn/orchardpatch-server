/**
 * app-status.js — Server-side status derivation module
 *
 * Pure functions. No pool, no queries, no imports.
 *
 * GROUPING KEY NOTE (for callers of aggregateFleetStatus in Parts 5/6):
 *   Rows must be pre-grouped by COALESCE(bundle_id, name):
 *     - A row WITH a bundle_id is NEVER merged into a name group.
 *     - Name is the group key ONLY for rows with NULL bundle_id.
 *   This matches the shipped CTE (COALESCE(a.bundle_id, a.name)) and the
 *   28e5fe6 frontend fix. aggregateFleetStatus itself takes pre-grouped rows
 *   and does not key — keying is the caller's responsibility.
 *
 * ALL-REMOVED BUNDLES:
 *   When every row for a bundle is removed, aggregateFleetStatus returns
 *   { allRemoved: true, status: null, deviceCount: 0, outdatedCount: 0 }.
 *   status: null is the sentinel — callers skip null-status bundles entirely
 *   in count reductions (zero buckets, not counted in total), matching the
 *   CTE's WHERE-exclusion of removed rows before dedup.
 *
 * WORST-CASE ORDERING (matches /api/stats/patch-status CTE exactly):
 *   outdated (4) > unknown (3) > current (2) > system/store/na (1)
 *   Applied over SURVIVORS only (removed filtered first).
 */

'use strict';

// ─── Version helpers (ported verbatim) ───────────────────────────────────────

// Ported verbatim from src/lib/utils.ts
function normalizeVersion(v) {
  if (!v) return null;
  let s = v.includes(',') ? v.split(',')[0] : v;
  s = s.replace(/\s*\(.*?\)/g, '').trim();
  s = s.replace(/^(\d+\.\d+\.\d+)\..*$/, '$1');
  return s || null;
}

// Ported verbatim from src/app/apps/[id]/page.tsx (~line 89)
function versionGt(a, b) {
  if (!a || !b) return false;
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na > nb) return true;
    if (na < nb) return false;
  }
  return false;
}

// ─── Coercion validity ────────────────────────────────────────────────────────

// A normalized version is coercible iff all segments are non-negative integers.
// Strings that survive normalizeVersion but contain non-numeric segments
// (e.g. "1.0.alpha", "N/A") fail this check.
// LOCKED RULE: failed coercion NEVER resolves to 'current'. deriveStatus
// returns 'unknown' when either side fails this check, before calling versionGt.
function isVersionCoercible(v) {
  return v !== null && /^\d+(\.\d+)*$/.test(v);
}

// ─── Constants ────────────────────────────────────────────────────────────────

const REMOVAL_THRESHOLD_MS = 45 * 60 * 1000; // 45 minutes in milliseconds

// Worst-case rank (matches CTE: outdated=4, unknown=3, current=2, else=1)
const STATUS_RANK = {
  outdated: 4,
  unknown:  3,
  current:  2,
  system:   1,
  store:    1,
  na:       1,
};

// ─── deriveStatus ─────────────────────────────────────────────────────────────

/**
 * Derive per-row status and removal state from raw DB fields.
 *
 * @param {object} row
 * @param {string|null}      row.version         apps.version (raw installed)
 * @param {string|null}      row.latestPatchable  latest_versions.latest_version
 * @param {string|null}      row.latestAvailable  resolved_versions.latest_available
 * @param {string|null}      row.source           'system' | 'mas' | other
 * @param {Date|string|null} row.appLastSeen      apps.last_seen (TIMESTAMPTZ)
 * @param {Date|string|null} row.deviceLastSeen   devices.last_seen (TIMESTAMPTZ)
 *
 * @returns {{ status: 'system'|'store'|'unknown'|'outdated'|'current',
 *             removalState: 'present'|'removed' }}
 */
function deriveStatus({ version, latestPatchable, source, appLastSeen, deviceLastSeen }) {
  // ── Removal ──
  // Timestamps arrive as Date objects from the pg driver (TIMESTAMPTZ columns).
  // Accept strings as fallback for testing convenience.
  const appMs = appLastSeen instanceof Date
    ? appLastSeen.getTime()
    : new Date(appLastSeen).getTime();
  const devMs = deviceLastSeen instanceof Date
    ? deviceLastSeen.getTime()
    : new Date(deviceLastSeen).getTime();
  const removalState = appMs < devMs - REMOVAL_THRESHOLD_MS ? 'removed' : 'present';

  // ── Source-based overrides (checked before version comparison) ──
  if (source === 'system') return { status: 'system', removalState };
  if (source === 'mas')    return { status: 'store',  removalState };

  // ── Version comparison ──
  const normInstalled = normalizeVersion(version);
  const normPatchable = normalizeVersion(latestPatchable);

  // Coercion failure guard: patchable missing, or either side not numeric.
  // Locked rule: coercion failure → 'unknown', never 'current'.
  if (!normPatchable
      || !isVersionCoercible(normInstalled)
      || !isVersionCoercible(normPatchable)) {
    return { status: 'unknown', removalState };
  }

  const status = versionGt(normPatchable, normInstalled) ? 'outdated' : 'current';
  return { status, removalState };
}

// ─── aggregateFleetStatus ─────────────────────────────────────────────────────

/**
 * Aggregate all installation rows for one bundle_id group into a fleet summary.
 * Input rows must contain the same fields deriveStatus expects.
 *
 * Worst-case-wins ordering over SURVIVORS only (removed filtered first):
 *   outdated > unknown > current > system/store/na
 * This matches the /api/stats/patch-status CTE ordering exactly.
 *
 * ALL-REMOVED: status=null (sentinel), deviceCount/outdatedCount=0.
 *   Callers skip null-status bundles in count reductions.
 *
 * @param {object[]} rows  Pre-grouped rows for one bundle_id
 * @returns {{
 *   status: string|null,
 *   lagging: boolean,
 *   allRemoved: boolean,
 *   deviceCount: number,
 *   outdatedCount: number,
 * }}
 */
function aggregateFleetStatus(rows) {
  if (!rows || rows.length === 0) {
    return { status: null, lagging: false, allRemoved: false, deviceCount: 0, outdatedCount: 0 };
  }

  // Derive per-row status
  const derived = rows.map(row => Object.assign({}, row, deriveStatus(row)));

  // Filter removed rows FIRST; aggregation runs on survivors only
  const survivors = derived.filter(d => d.removalState !== 'removed');
  const allRemoved = survivors.length === 0;

  // ── Lagging (app-level, not per-device) ──
  // Requires BOTH latestAvailable AND latestPatchable present.
  // Use first row — for a given bundle_id, resolved_versions and
  // latest_versions values are the same across all rows.
  // Format-only differences (e.g. "1.2.0 (900)" vs "1.2.0") die in normalization.
  const firstRow = rows[0];
  const normAvailable = normalizeVersion(firstRow.latestAvailable  ?? null);
  const normPatchable  = normalizeVersion(firstRow.latestPatchable ?? null);
  const lagging = (normAvailable && isVersionCoercible(normAvailable)
                   && normPatchable && isVersionCoercible(normPatchable))
    ? versionGt(normAvailable, normPatchable)
    : false;

  // ── All-removed: sentinel output ──
  if (allRemoved) {
    return { status: null, lagging, allRemoved: true, deviceCount: 0, outdatedCount: 0 };
  }

  // ── Worst-case-wins status across survivors ──
  // Matches CTE: outdated(4) > unknown(3) > current(2) > else(1). DESC.
  let worstStatus = survivors[0].status;
  for (const d of survivors) {
    if ((STATUS_RANK[d.status] ?? 0) > (STATUS_RANK[worstStatus] ?? 0)) {
      worstStatus = d.status;
    }
  }

  const deviceCount   = survivors.length;
  const outdatedCount = survivors.filter(d => d.status === 'outdated').length;

  return { status: worstStatus, lagging, allRemoved: false, deviceCount, outdatedCount };
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  normalizeVersion,
  versionGt,
  isVersionCoercible,
  deriveStatus,
  aggregateFleetStatus,
};
