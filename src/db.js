/**
 * OrchardPatch Server — Database (PostgreSQL)
 * Uses the pg library with DATABASE_URL from Railway.
 */

const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("railway") ? { rejectUnauthorized: false } : false,
});

// ─── Schema migration ─────────────────────────────────────────────────────────

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      hostname TEXT NOT NULL,
      serial TEXT,
      model TEXT,
      os_version TEXT,
      ram TEXT,
      cpu TEXT,
      agent_version TEXT,
      agent_url TEXT,
      last_seen TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
    );

    CREATE TABLE IF NOT EXISTS apps (
      id SERIAL PRIMARY KEY,
      device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
      bundle_id TEXT NOT NULL,
      name TEXT NOT NULL,
      version TEXT,
      latest_version TEXT,
      is_outdated INTEGER DEFAULT 0,
      installomator_label TEXT,
      path TEXT,
      source TEXT,
      last_seen TEXT NOT NULL,
      UNIQUE(device_id, bundle_id)
    );

    CREATE TABLE IF NOT EXISTS patch_jobs (
      id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL,
      bundle_id TEXT,
      app_name TEXT NOT NULL,
      label TEXT NOT NULL,
      mode TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      exit_code INTEGER,
      error TEXT,
      log TEXT,
      created_at TEXT NOT NULL,
      started_at TEXT,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS pending_patches (
      id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL,
      bundle_id TEXT,
      label TEXT NOT NULL,
      app_name TEXT NOT NULL,
      mode TEXT NOT NULL DEFAULT 'managed',
      created_at TEXT NOT NULL,
      claimed_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_apps_device ON apps(device_id);
    CREATE INDEX IF NOT EXISTS idx_apps_bundle ON apps(bundle_id);
    CREATE INDEX IF NOT EXISTS idx_patch_jobs_device ON patch_jobs(device_id);
    CREATE INDEX IF NOT EXISTS idx_patch_jobs_status ON patch_jobs(status);
    CREATE INDEX IF NOT EXISTS idx_pending_patches_device ON pending_patches(device_id);

    CREATE TABLE IF NOT EXISTS latest_versions (
      label TEXT PRIMARY KEY,
      latest_version TEXT,
      last_checked TEXT,
      error TEXT
    );

    CREATE TABLE IF NOT EXISTS app_catalog (
      label TEXT PRIMARY KEY,
      app_name TEXT,
      bundle_id TEXT,
      expected_team TEXT,
      last_synced TEXT DEFAULT (to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
    );

    CREATE INDEX IF NOT EXISTS idx_latest_versions_label ON latest_versions(label);
    CREATE INDEX IF NOT EXISTS idx_app_catalog_bundle ON app_catalog(bundle_id);

    CREATE TABLE IF NOT EXISTS app_identity (
      bundle_id TEXT PRIMARY KEY,
      app_name TEXT,
      installomator_label TEXT,
      homebrew_cask TEXT,
      github_repo TEXT,
      sparkle_feed_url TEXT,
      adam_id TEXT,
      curated BOOLEAN DEFAULT false,
      last_derived TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS resolved_versions (
      bundle_id TEXT PRIMARY KEY,
      latest_available TEXT,
      source TEXT,
      source_url TEXT,
      candidates JSONB,
      conflict BOOLEAN DEFAULT false,
      resolved_at TIMESTAMPTZ,
      error TEXT
    );

    CREATE TABLE IF NOT EXISTS pending_commands (
      id SERIAL PRIMARY KEY,
      device_id TEXT NOT NULL,
      command TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now(),
      claimed_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      result TEXT
    );

    CREATE TABLE IF NOT EXISTS identity_conflicts (
      id SERIAL PRIMARY KEY,
      bundle_id TEXT NOT NULL,
      source TEXT NOT NULL,
      token TEXT NOT NULL,
      competing_bundle_ids TEXT[] NOT NULL,
      detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      resolved BOOLEAN NOT NULL DEFAULT false
    );

    CREATE UNIQUE INDEX IF NOT EXISTS identity_conflicts_unique
    ON identity_conflicts (bundle_id, source, token);
  `);

  // Add agent_url to devices for existing deployments
  await pool.query(`
    ALTER TABLE devices ADD COLUMN IF NOT EXISTS agent_url TEXT;
  `).catch(() => {});

  // Add method column to patch_jobs (which tier triggered the job)
  await pool.query(`
    ALTER TABLE patch_jobs ADD COLUMN IF NOT EXISTS method TEXT NOT NULL DEFAULT 'fruit';
  `).catch(() => {});

  // Add initiated_by column to patch_jobs (placeholder until real auth)
  await pool.query(`
    ALTER TABLE patch_jobs ADD COLUMN IF NOT EXISTS initiated_by TEXT;
  `).catch(() => {});

  // Back-fill existing rows: anything not already tagged 'branch' was a Fruit job
  await pool.query(`
    UPDATE patch_jobs SET method = 'fruit' WHERE method = 'fruit' OR method IS NULL;
  `).catch(() => {});

  // Fix Branch jobs that incorrectly wrote mode='branch' -- move to method, set mode='managed'
  await pool.query(`
    UPDATE patch_jobs SET method = 'branch', mode = 'managed'
    WHERE id LIKE 'branch-%' AND mode = 'branch';
  `).catch(() => {});

  // Delete orphaned Branch queued jobs that have no corresponding pending_patches row
  // These were created before the dual-write fix and will never execute
  await pool.query(`
    DELETE FROM patch_jobs
    WHERE method = 'branch'
      AND status = 'queued'
      AND id NOT IN (SELECT id FROM pending_patches);
  `).catch(() => {});

  // Delete phantom 'device-Mac' -- duplicate registration from early agent install,
  // same device as device-GJM7N0XGL0 (Jude's MacBook Pro) with truncated hostname
  await pool.query(`
    DELETE FROM devices WHERE id = 'device-Mac';
  `).catch(() => {});

  // Add last_synced column to app_catalog if it doesn't exist
  await pool.query(`
    ALTER TABLE app_catalog ADD COLUMN IF NOT EXISTS last_synced TEXT DEFAULT (to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'));
  `).catch(() => {});

  // Add download_url column to app_catalog (Phase A)
  await pool.query(`
    ALTER TABLE app_catalog ADD COLUMN IF NOT EXISTS download_url TEXT;
  `).catch(() => {});

  // Add last_seen column to apps for soft-delete TTL tracking
  await pool.query(`ALTER TABLE apps ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ`).catch(() => {});

  // Initialize last_seen for existing rows that have a null value
  await pool.query(`UPDATE apps SET last_seen = now() WHERE last_seen IS NULL`).catch(() => {});

  // Promote last_seen from TEXT to TIMESTAMPTZ on warm DBs (no-op if already TIMESTAMPTZ)
  await pool.query(`ALTER TABLE apps ALTER COLUMN last_seen TYPE TIMESTAMPTZ USING last_seen::timestamptz`).catch(() => {});

  // MAS cleanup: null out label and cask on any existing app_identity rows for MAS apps.
  // Idempotent; curated=true rows are intentionally preserved.
  await pool.query(`
    UPDATE app_identity ai
    SET installomator_label = NULL, homebrew_cask = NULL
    FROM apps a
    WHERE ai.bundle_id = a.bundle_id
      AND a.source = 'mas'
      AND (ai.curated IS NULL OR ai.curated = false)
  `).catch((e) => { console.warn('[DB] MAS cleanup warning:', e.message); });

  // Curated seed rows -- Phase 1 identity fix.
  // ON CONFLICT only overwrites non-curated rows, so human edits are never lost.
  const CURATED_CONFLICT = 
    'ON CONFLICT (bundle_id) DO UPDATE SET ' +
    'installomator_label = EXCLUDED.installomator_label, ' +
    'homebrew_cask = EXCLUDED.homebrew_cask, ' +
    'app_name = COALESCE(EXCLUDED.app_name, app_identity.app_name), ' +
    'curated = true ' +
    'WHERE (app_identity.curated IS NULL OR app_identity.curated = false)';

  const curatedRows = [
    // PyCharm Pro -- both tokens confirmed; protects Pro so CE stops sharing
    { bundle_id: 'com.jetbrains.pycharm',    label: 'jetbrainspycharm',          cask: 'pycharm',         name: 'PyCharm' },
    // PyCharm CE -- no valid Installomator label; cask pycharm-ce confirmed
    { bundle_id: 'com.jetbrains.pycharm.ce', label: null,                         cask: 'pycharm-ce',      name: 'PyCharm CE' },
    // Teams classic -- label only; no Homebrew cask exists for classic Teams
    { bundle_id: 'com.microsoft.teams',      label: 'microsoftteams',             cask: null,              name: 'Microsoft Teams classic' },
    // Teams new
    { bundle_id: 'com.microsoft.teams2',     label: 'microsoftteams-rollingout',  cask: 'microsoft-teams', name: 'Microsoft Teams' },
    // Canva direct download
    { bundle_id: 'com.canva.CanvaDesktop',   label: 'canva',                      cask: 'canva',           name: 'Canva' },
    // Telegram native macOS (telegram.org/dl/macos = ru.keepcoder per fragment + Homebrew cask)
    { bundle_id: 'ru.keepcoder.Telegram',    label: 'telegram',                   cask: 'telegram',        name: 'Telegram' },
  ];

  for (const row of curatedRows) {
    await pool.query(
      'INSERT INTO app_identity (bundle_id, app_name, installomator_label, homebrew_cask, curated, last_derived) ' +
      'VALUES ($1, $2, $3, $4, true, now()) ' +
      CURATED_CONFLICT,
      [row.bundle_id, row.name, row.label, row.cask]
    ).catch((e) => { console.warn('[DB] curated seed warning:', row.bundle_id, e.message); });
  }
  console.log('[DB] Curated seed rows applied (' + curatedRows.length + ')');

  // Sync existing apps rows to match curated identity labels (idempotent, IS DISTINCT FROM handles NULLs)
  await pool.query(
    'UPDATE apps a SET installomator_label = ai.installomator_label ' +
    'FROM app_identity ai ' +
    'WHERE a.bundle_id = ai.bundle_id ' +
    '  AND ai.curated = true ' +
    '  AND a.installomator_label IS DISTINCT FROM ai.installomator_label'
  ).catch((e) => { console.warn('[DB] curated apps sync warning:', e.message); });

  // Mark identity_conflicts resolved for the 6 curated bundle IDs
  await pool.query(
    'UPDATE identity_conflicts SET resolved = true ' +
    'WHERE bundle_id = ANY($1)',
    [[
      'com.jetbrains.pycharm', 'com.jetbrains.pycharm.ce',
      'com.microsoft.teams', 'com.microsoft.teams2',
      'com.canva.CanvaDesktop', 'ru.keepcoder.Telegram'
    ]]
  ).catch((e) => { console.warn('[DB] conflict resolution warning:', e.message); });

  console.log("[DB] Schema ready");
}

async function migrateWithRetry(maxAttempts = 10, delayMs = 3000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await migrate();
      return;
    } catch (err) {
      console.error(`[DB] Migration attempt ${attempt}/${maxAttempts} failed:`, err.message);
      if (attempt === maxAttempts) {
        console.error("[DB] All migration attempts exhausted. Exiting.");
        process.exit(1);
      }
      console.log(`[DB] Retrying in ${delayMs / 1000}s...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

migrateWithRetry();

module.exports = pool;
