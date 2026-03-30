/**
 * OrchardPatch Server — Database
 * SQLite via better-sqlite3. Stores devices, apps, and patch jobs.
 */

const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const DB_DIR = process.env.DATA_DIR || path.join(__dirname, "../data");
const DB_PATH = path.join(DB_DIR, "orchardpatch.db");

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma("journal_mode = WAL");

// ─── Schema ──────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,
    hostname TEXT NOT NULL,
    serial TEXT,
    model TEXT,
    os_version TEXT,
    ram TEXT,
    cpu TEXT,
    agent_version TEXT,
    agent_token TEXT,
    last_seen TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS apps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT NOT NULL,
    bundle_id TEXT NOT NULL,
    name TEXT NOT NULL,
    version TEXT,
    latest_version TEXT,
    is_outdated INTEGER DEFAULT 0,
    installomator_label TEXT,
    path TEXT,
    source TEXT,
    last_seen TEXT NOT NULL,
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
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
    completed_at TEXT,
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_apps_device ON apps(device_id);
  CREATE INDEX IF NOT EXISTS idx_apps_bundle ON apps(bundle_id);
  CREATE INDEX IF NOT EXISTS idx_patch_jobs_device ON patch_jobs(device_id);
  CREATE INDEX IF NOT EXISTS idx_patch_jobs_status ON patch_jobs(status);
`);

module.exports = db;
