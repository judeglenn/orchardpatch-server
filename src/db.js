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
      expected_team TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_latest_versions_label ON latest_versions(label);
    CREATE INDEX IF NOT EXISTS idx_app_catalog_bundle ON app_catalog(bundle_id);
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

  console.log("[DB] Schema ready");
}

migrate().catch(err => {
  console.error("[DB] Migration failed:", err.message);
  process.exit(1);
});

module.exports = pool;
