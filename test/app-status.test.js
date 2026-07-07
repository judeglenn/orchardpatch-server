/**
 * Unit tests for src/lib/app-status.js
 * Uses Node.js built-in test runner (node:test + node:assert).
 *
 * All cases sourced from status-consolidation-spec.md Part 1, verified against
 * production data. Run with: node --test test/app-status.test.js
 */

'use strict';

const { test } = require('node:test');
const assert   = require('node:assert/strict');

const {
  normalizeVersion,
  versionGt,
  isVersionCoercible,
  deriveStatus,
  aggregateFleetStatus,
} = require('../src/lib/app-status');

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Construct a minimal deriveStatus-shaped row
function row(overrides) {
  return Object.assign({
    version:         '1.0.0',
    latestPatchable: '1.0.0',
    latestAvailable: null,
    source:          'other',
    appLastSeen:     new Date(),
    deviceLastSeen:  new Date(),
  }, overrides);
}

// A timestamp well outside the 45-minute removal window
const JUNE_16 = new Date('2026-06-16T12:00:00Z');
const NOW      = new Date('2026-07-06T23:00:00Z'); // fixed reference for reproducibility

// ─── normalizeVersion ────────────────────────────────────────────────────────

test('normalizeVersion: null/undefined/empty → null', () => {
  assert.equal(normalizeVersion(null),      null);
  assert.equal(normalizeVersion(undefined), null);
  assert.equal(normalizeVersion(''),        null);
});

test('normalizeVersion: strip parenthesized build — "7.1.0 (83064)" → "7.1.0"', () => {
  assert.equal(normalizeVersion('7.1.0 (83064)'), '7.1.0');
});

test('normalizeVersion: four-segment truncation — "7.1.0.83064" → "7.1.0"', () => {
  assert.equal(normalizeVersion('7.1.0.83064'), '7.1.0');
});

test('normalizeVersion: comma format — "12.8,282010" → "12.8"', () => {
  assert.equal(normalizeVersion('12.8,282010'), '12.8');
});

test('normalizeVersion: plain version passes through — "14.3.1" → "14.3.1"', () => {
  assert.equal(normalizeVersion('14.3.1'), '14.3.1');
});

// ─── versionGt ───────────────────────────────────────────────────────────────

test('versionGt: null/falsy guards → false', () => {
  assert.equal(versionGt(null, '1.0.0'), false);
  assert.equal(versionGt('1.0.0', null), false);
  assert.equal(versionGt(null, null),    false);
});

test('versionGt: equal → false', () => {
  assert.equal(versionGt('7.1.0', '7.1.0'), false);
  assert.equal(versionGt('1.2.0', '1.2.0'), false);
});

test('versionGt: "1.3.0" > "1.2.0" → true', () => {
  assert.equal(versionGt('1.3.0', '1.2.0'), true);
});

test('versionGt: "1.2.0" > "1.3.0" → false', () => {
  assert.equal(versionGt('1.2.0', '1.3.0'), false);
});

test('versionGt: major beats minor — "2.0.0" > "1.99.99" → true', () => {
  assert.equal(versionGt('2.0.0', '1.99.99'), true);
});

test('versionGt: shorter pads with 0 — "1.1" > "1.0.9" → true', () => {
  assert.equal(versionGt('1.1', '1.0.9'), true);
});

// ─── isVersionCoercible ───────────────────────────────────────────────────────

test('isVersionCoercible: valid versions → true', () => {
  assert.equal(isVersionCoercible('7.1.0'),  true);
  assert.equal(isVersionCoercible('1.2'),    true);
  assert.equal(isVersionCoercible('100'),    true);
  assert.equal(isVersionCoercible('1.2.0'),  true);
});

test('isVersionCoercible: null → false', () => {
  assert.equal(isVersionCoercible(null), false);
});

test('isVersionCoercible: garbage → false', () => {
  assert.equal(isVersionCoercible('garbage'),       false);
  assert.equal(isVersionCoercible('1.0.alpha'),     false);
  assert.equal(isVersionCoercible('N/A'),           false);
  assert.equal(isVersionCoercible('1.2.0-beta.1'),  false);
});

// ─── deriveStatus: removal ────────────────────────────────────────────────────

test('deriveStatus: present when appLastSeen ≈ deviceLastSeen', () => {
  const result = deriveStatus(row({ appLastSeen: NOW, deviceLastSeen: NOW }));
  assert.equal(result.removalState, 'present');
});

test('deriveStatus: present when appLastSeen is 44 min before deviceLastSeen', () => {
  const devTime = new Date(NOW.getTime());
  const appTime = new Date(devTime.getTime() - (44 * 60 * 1000));
  const result = deriveStatus(row({ appLastSeen: appTime, deviceLastSeen: devTime }));
  assert.equal(result.removalState, 'present');
});

test('deriveStatus: removed when appLastSeen is 46 min before deviceLastSeen', () => {
  const devTime = new Date(NOW.getTime());
  const appTime = new Date(devTime.getTime() - (46 * 60 * 1000));
  const result = deriveStatus(row({ appLastSeen: appTime, deviceLastSeen: devTime }));
  assert.equal(result.removalState, 'removed');
});

// Spec case: 1Password 8 — appLastSeen June 16, deviceLastSeen now → removed
test('deriveStatus: 1Password 8 — June 16 app vs July 6 device → removed', () => {
  const result = deriveStatus(row({ appLastSeen: JUNE_16, deviceLastSeen: NOW }));
  assert.equal(result.removalState, 'removed');
});

// ─── deriveStatus: source overrides ──────────────────────────────────────────

// Spec case: source = 'system' → status 'system'
test('deriveStatus: source=system → status system', () => {
  const result = deriveStatus(row({ source: 'system' }));
  assert.equal(result.status, 'system');
});

// Spec case: MAS row (ru.keepcoder.Telegram shape) → 'store'
test('deriveStatus: source=mas (Telegram ru.keepcoder.Telegram shape) → store', () => {
  const result = deriveStatus(row({
    source:          'mas',
    version:         '10.14.3',
    latestPatchable: null,
    latestAvailable: null,
  }));
  assert.equal(result.status, 'store');
});

// ─── deriveStatus: version comparison ────────────────────────────────────────

// Spec case: zoom.us — installed "7.1.0 (83064)", patchable "7.1.0.83064" → current
// Raw strings pass through untouched; normalizeVersion brings both to "7.1.0"
test('deriveStatus: zoom.us — "7.1.0 (83064)" vs patchable "7.1.0.83064" → current', () => {
  const result = deriveStatus(row({
    version:         '7.1.0 (83064)',
    latestPatchable: '7.1.0.83064',
    appLastSeen:     NOW,
    deviceLastSeen:  NOW,
  }));
  assert.equal(result.status, 'current');
  assert.equal(result.removalState, 'present');
});

// Spec case: comma format — "12.8,282010" compares as "12.8"
test('deriveStatus: comma format version "12.8,282010" compared as "12.8"', () => {
  // patchable is "12.9.0" — newer → outdated
  const result = deriveStatus(row({
    version:         '12.8,282010',
    latestPatchable: '12.9.0',
    appLastSeen:     NOW,
    deviceLastSeen:  NOW,
  }));
  // normalize("12.8,282010") = "12.8", normalize("12.9.0") = "12.9.0"
  // versionGt("12.9.0", "12.8") = true → outdated
  assert.equal(result.status, 'outdated');
  // Confirm normalization produced "12.8" (not "12.8,282010")
  const { normalizeVersion: nv } = require('../src/lib/app-status');
  assert.equal(nv('12.8,282010'), '12.8');
});

test('deriveStatus: version newer than patchable → current', () => {
  const result = deriveStatus(row({ version: '2.0.0', latestPatchable: '1.9.0' }));
  assert.equal(result.status, 'current');
});

test('deriveStatus: version older than patchable → outdated', () => {
  const result = deriveStatus(row({ version: '1.8.0', latestPatchable: '1.9.0' }));
  assert.equal(result.status, 'outdated');
});

// Spec case: failed coercion (garbage version string) → unknown, NEVER current
test('deriveStatus: garbage installed version → unknown (locked rule: never current)', () => {
  const result = deriveStatus(row({
    version:         'Not.A.Real.Version.garbage',
    latestPatchable: '1.0.0',
    appLastSeen:     NOW,
    deviceLastSeen:  NOW,
  }));
  assert.equal(result.status, 'unknown');
  assert.notEqual(result.status, 'current'); // explicit: never current
});

test('deriveStatus: garbage patchable version → unknown', () => {
  const result = deriveStatus(row({
    version:         '1.0.0',
    latestPatchable: 'alpha-build-garbage',
    appLastSeen:     NOW,
    deviceLastSeen:  NOW,
  }));
  assert.equal(result.status, 'unknown');
});

test('deriveStatus: latestPatchable null → unknown', () => {
  const result = deriveStatus(row({ latestPatchable: null }));
  assert.equal(result.status, 'unknown');
});

// ─── aggregateFleetStatus: lagging ───────────────────────────────────────────

// Spec case: lagging true — patchable 1.2.0, available 1.3.0
test('aggregateFleetStatus: lagging true — available 1.3.0 > patchable 1.2.0', () => {
  const rows = [row({ version: '1.2.0', latestPatchable: '1.2.0', latestAvailable: '1.3.0',
                      appLastSeen: NOW, deviceLastSeen: NOW })];
  const result = aggregateFleetStatus(rows);
  assert.equal(result.lagging, true);
});

// Spec case: lagging false — patchable "1.2.0", available "1.2.0 (900)"
// Build-only difference dies in normalization → both become "1.2.0"
test('aggregateFleetStatus: lagging false — available "1.2.0 (900)" normalizes equal to patchable "1.2.0"', () => {
  const rows = [row({ version: '1.2.0', latestPatchable: '1.2.0', latestAvailable: '1.2.0 (900)',
                      appLastSeen: NOW, deviceLastSeen: NOW })];
  const result = aggregateFleetStatus(rows);
  assert.equal(result.lagging, false);
});

// Spec case: lagging false — available present, patchable null
test('aggregateFleetStatus: lagging false — patchable null (missing either → false)', () => {
  const rows = [row({ version: '1.2.0', latestPatchable: null, latestAvailable: '1.3.0',
                      appLastSeen: NOW, deviceLastSeen: NOW })];
  const result = aggregateFleetStatus(rows);
  assert.equal(result.lagging, false);
});

test('aggregateFleetStatus: lagging false — available null', () => {
  const rows = [row({ version: '1.2.0', latestPatchable: '1.2.0', latestAvailable: null,
                      appLastSeen: NOW, deviceLastSeen: NOW })];
  const result = aggregateFleetStatus(rows);
  assert.equal(result.lagging, false);
});

// ─── aggregateFleetStatus: allRemoved ────────────────────────────────────────

// Spec case: allRemoved — all rows removed → true; one survivor → false
// ADDED: all-removed bundle returns allRemoved=true with no-count sentinel status (null)
test('aggregateFleetStatus: all rows removed → allRemoved=true, status=null sentinel', () => {
  const rows = [
    row({ version: '1.0.0', latestPatchable: '2.0.0', appLastSeen: JUNE_16, deviceLastSeen: NOW }),
    row({ version: '1.0.0', latestPatchable: '2.0.0', appLastSeen: JUNE_16, deviceLastSeen: NOW }),
  ];
  const result = aggregateFleetStatus(rows);
  assert.equal(result.allRemoved,    true);
  assert.equal(result.status,        null); // sentinel: skip in count reductions
  assert.equal(result.deviceCount,   0);
  assert.equal(result.outdatedCount, 0);
});

// ADDED: partial-removed (1 removed, 1 present) — aggregate over survivor only
test('aggregateFleetStatus: partial-removed (1 removed, 1 present) → aggregates survivor only', () => {
  const rows = [
    row({ version: '1.0.0', latestPatchable: '2.0.0', appLastSeen: JUNE_16, deviceLastSeen: NOW }), // removed
    row({ version: '1.0.0', latestPatchable: '2.0.0', appLastSeen: NOW,     deviceLastSeen: NOW }), // present
  ];
  const result = aggregateFleetStatus(rows);
  assert.equal(result.allRemoved,    false);
  assert.equal(result.status,        'outdated'); // survivor: 2.0.0 > 1.0.0
  assert.equal(result.deviceCount,   1);          // only the surviving device
  assert.equal(result.outdatedCount, 1);
});

test('aggregateFleetStatus: one survivor, not removed → allRemoved=false', () => {
  const rows = [row({ appLastSeen: NOW, deviceLastSeen: NOW })];
  const result = aggregateFleetStatus(rows);
  assert.equal(result.allRemoved, false);
});

// ─── aggregateFleetStatus: worst-case-wins ordering ─────────────────────────

// Matches CTE: outdated(4) > unknown(3) > current(2) > system/store(1)
test('aggregateFleetStatus: outdated beats unknown beats current over survivors', () => {
  const rows = [
    row({ version: '1.0.0', latestPatchable: '1.0.0', appLastSeen: NOW, deviceLastSeen: NOW }), // current
    row({ version: '1.0.0', latestPatchable: null,    appLastSeen: NOW, deviceLastSeen: NOW }), // unknown
    row({ version: '1.0.0', latestPatchable: '2.0.0', appLastSeen: NOW, deviceLastSeen: NOW }), // outdated
  ];
  const result = aggregateFleetStatus(rows);
  assert.equal(result.status, 'outdated');
  assert.equal(result.deviceCount, 3);
  assert.equal(result.outdatedCount, 1);
});

test('aggregateFleetStatus: unknown beats current', () => {
  const rows = [
    row({ version: '1.0.0', latestPatchable: '1.0.0', appLastSeen: NOW, deviceLastSeen: NOW }), // current
    row({ version: '1.0.0', latestPatchable: null,    appLastSeen: NOW, deviceLastSeen: NOW }), // unknown
  ];
  const result = aggregateFleetStatus(rows);
  assert.equal(result.status, 'unknown');
});

test('aggregateFleetStatus: worst-case ordering ignores removed rows', () => {
  // Removed row would be 'outdated' if it were present; survivor is 'current'
  // Result must be 'current' — removed row does not drag status up
  const rows = [
    row({ version: '1.0.0', latestPatchable: '2.0.0', appLastSeen: JUNE_16, deviceLastSeen: NOW }), // removed, outdated
    row({ version: '2.0.0', latestPatchable: '2.0.0', appLastSeen: NOW,     deviceLastSeen: NOW }), // present, current
  ];
  const result = aggregateFleetStatus(rows);
  assert.equal(result.status,      'current');
  assert.equal(result.deviceCount, 1);
});

// ─── Spec case: PyCharm Pro vs PyCharm CE as separate bundle_ids ─────────────

// Two distinct bundle_ids → two distinct aggregates; keying is by bundle_id,
// NEVER by name. These are called with separate row arrays (caller's responsibility).
test('aggregateFleetStatus: PyCharm Pro (present) and CE (removed) → separate aggregates', () => {
  // PyCharm Pro: present, outdated (2024.3 installed, 2025.1 patchable)
  const proRows = [row({
    version: '2024.3', latestPatchable: '2025.1',
    appLastSeen: NOW, deviceLastSeen: NOW,
  })];
  const proResult = aggregateFleetStatus(proRows);
  assert.equal(proResult.allRemoved, false);
  assert.equal(proResult.status,     'outdated');
  assert.equal(proResult.deviceCount, 1);

  // PyCharm CE: removed (appLastSeen June 16)
  const ceRows = [row({
    version: '2024.3', latestPatchable: '2025.1',
    appLastSeen: JUNE_16, deviceLastSeen: NOW,
  })];
  const ceResult = aggregateFleetStatus(ceRows);
  assert.equal(ceResult.allRemoved, true);
  assert.equal(ceResult.status,     null);   // sentinel
  assert.equal(ceResult.deviceCount, 0);

  // Confirm distinct results — they are separate, not merged
  assert.notEqual(proResult.status, ceResult.status);
  assert.notEqual(proResult.allRemoved, ceResult.allRemoved);
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

test('aggregateFleetStatus: empty rows array → safe zero output', () => {
  const result = aggregateFleetStatus([]);
  assert.equal(result.status,        null);
  assert.equal(result.allRemoved,    false);
  assert.equal(result.deviceCount,   0);
  assert.equal(result.outdatedCount, 0);
  assert.equal(result.lagging,       false);
});

test('aggregateFleetStatus: all system source → status system', () => {
  const rows = [row({ source: 'system', appLastSeen: NOW, deviceLastSeen: NOW })];
  const result = aggregateFleetStatus(rows);
  assert.equal(result.status, 'system');
  assert.equal(result.allRemoved, false);
  assert.equal(result.deviceCount, 1);
});

test('aggregateFleetStatus: deviceCount and outdatedCount correct across mixed statuses', () => {
  const rows = [
    row({ version: '1.0', latestPatchable: '2.0', appLastSeen: NOW,     deviceLastSeen: NOW }), // outdated
    row({ version: '2.0', latestPatchable: '2.0', appLastSeen: NOW,     deviceLastSeen: NOW }), // current
    row({ version: '1.0', latestPatchable: '2.0', appLastSeen: JUNE_16, deviceLastSeen: NOW }), // removed
  ];
  const result = aggregateFleetStatus(rows);
  assert.equal(result.deviceCount,   2); // 2 survivors, 1 removed
  assert.equal(result.outdatedCount, 1); // only the outdated survivor
  assert.equal(result.allRemoved,    false);
});
