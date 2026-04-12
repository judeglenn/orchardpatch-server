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
  `);
  console.log("[DB] Schema ready");
}

migrate().catch(err => {
  console.error("[DB] Migration failed:", err.message);
  process.exit(1);
});

module.exports = pool;
