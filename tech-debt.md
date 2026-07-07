# OrchardPatch Server — Tech Debt

Items are non-blocking unless flagged otherwise. Each entry: root cause, symptom,
fix shape, discovered date. Do not fix during an active migration pass unless the
item is explicitly pulled into scope.

---

## TD-001 — Sparkle resolver extraction guard is not end-anchored

**Filed:** July 6, 2026
**Priority:** Low / benign today; first-priority the next time a Sparkle app gets a label
**Blocking:** Not currently. coconutBattery (the only affected app) has no
  Installomator label, so latestPatchable is null and lagging can never fire.

**Root cause:**
The resolver's validity guard in `src/lib/resolvers/sparkle.js`:

```javascript
if (!/^\d+[\.\d]*/.test(version)) continue;
```

uses `^\d+[\.\d]*` — NOT end-anchored. This regex matches any string that
STARTS with a digit followed by optional dots/digits, but accepts trailing
non-numeric characters (e.g. `"4.3.4b"`, `"1.0-beta"`, `"3.6.8rc1"`).

The module's coercibility check in `src/lib/app-status.js`:

```javascript
function isVersionCoercible(v) {
  return v !== null && /^\d+(\.\d+)*$/.test(v);
}
```

uses `^\d+(\.\d+)*$` — IS end-anchored. This correctly rejects `"4.3.4b"`.

**Two-definition divergence:** the resolver and the module have different rules
for "valid version." Values the resolver stores can fail the module's guard.

**Symptom:** coconutBattery's Sparkle feed returns `shortVersionString="4.3.4b"`
(likely a beta). The resolver stores `"4.3.4b"` as `latest_available`. The module
treats it as non-coercible → lagging = false (correct behavior: cannot compare
an invalid version). But the stored value is wrong — it should be rejected before
reaching the DB if it can't participate in lagging comparisons.

**Real bug trigger:** Any Sparkle-fed app that (a) has `"4.x.xb"` or similar
non-coercible shortVersionString AND (b) has an Installomator label will produce
`latestAvailable` that fails coercion → `lagging = false` even when the app is
genuinely lagging. Silent data quality failure.

**Fix shape (do not implement without pulling into scope):**
In `src/lib/resolvers/sparkle.js`, after extracting `version`, gate storage on
the module's coercibility definition:

```javascript
// Reject versions that fail the module's isVersionCoercible guard —
// they cannot participate in lagging comparisons and should not be stored.
const { isVersionCoercible, normalizeVersion } = require('../app-status');
const normalized = normalizeVersion(version);
if (!isVersionCoercible(normalized)) {
  console.warn('[sparkle-resolver] non-coercible version skipped:', row.app_name, JSON.stringify(version));
  continue;
}
```

This makes the resolver and the module agree on what counts as a valid version.
The resolver falls through to the Homebrew candidate (or stores null) when Sparkle
returns a non-coercible string. For coconutBattery: Homebrew has `"4.3.3,218"` →
normalize → `"4.3.3"` → coercible; that would become the stored value instead.

**Naming note (non-blocking, trivial):** `TRUST_ORDER` in `resolver-cron.js` is
named as if lower index = more trusted, but `pickWinner` picks the HIGHER index.
The name is misleading (Sparkle beats Homebrew, opposite of what the name implies).
Rename to `RESOLVER_PRIORITY` or `SOURCE_RANK` in a housekeeping pass; do not
rename mid-migration.

---
