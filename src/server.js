/**
 * OrchardPatch Central Server
 * Receives check-ins from agents, stores fleet data, serves the dashboard API.
 */

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const pool = require("./db");
const { bootstrapIdentity } = require("./lib/identity-bootstrap");
const { startResolverCron } = require('./lib/resolver-cron');
const versionSyncRouter = require("./routes/version-sync");
const catalogSyncRouter = require("./routes/catalog-sync");

const app = express();
const PORT = process.env.PORT || 4747;

// ─── Security middleware ──────────────────────────────────────────────────────

app.use(helmet({ contentSecurityPolicy: false }));

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",").map(s => s.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (
      ALLOWED_ORIGINS.includes(origin) ||
      origin.endsWith(".vercel.app") ||
      origin.endsWith(".orchardpatch.com") ||
      origin.startsWith("http://localhost")
    ) return callback(null, true);
    callback(new Error("Not allowed by CORS"));
  }
}));

app.use(express.json({ limit: "1mb" }));

// ─── Rate limiting ────────────────────────────────────────────────────────────

const rateLimitMap = new Map();

function rateLimit(windowMs, maxRequests) {
  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    const entry = rateLimitMap.get(key) || { count: 0, resetAt: now + windowMs };
    if (now > entry.resetAt) { entry.count = 0; entry.resetAt = now + windowMs; }
    entry.count++;
    rateLimitMap.set(key, entry);
    if (entry.count > maxRequests) return res.status(429).json({ error: "Too many requests" });
    next();
  };
}

const checkinRateLimit = rateLimit(60 * 1000, 10);
const apiRateLimit = rateLimit(60 * 1000, 100);

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now > entry.resetAt) rateLimitMap.delete(key);
  }
}, 5 * 60 * 1000);

// ─── Auth ─────────────────────────────────────────────────────────────────────

const SERVER_TOKEN = process.env.SERVER_TOKEN || "dev-token-change-me";

function authMiddleware(req, res, next) {
  const token = req.headers["x-orchardpatch-token"];
  if (!token || token !== SERVER_TOKEN) return res.status(401).json({ error: "Unauthorized" });
  next();
}

// ─── Input validation helpers ─────────────────────────────────────────────────

function s(val, maxLen = 255) {
  if (val === null || val === undefined) return null;
  return String(val).slice(0, maxLen);
}

function sint(val, fallback = null) {
  const n = parseInt(val);
  return isNaN(n) ? fallback : n;
}

// ─── Command enqueue allowlist ──────────────────────────────────────────────────

const ENQUEUE_ALLOWED = new Set(['check_in']);
// Mutating commands require an auth model + multi-tenancy before they go here.
// Adding a command type to this set is a "design authorization first" trigger,
// not a one-line change.

// ─── Shared job termination helper ───────────────────────────────────────────

async function terminate_stuck_job(id, reason) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'DELETE FROM pending_patches WHERE id = $1',
      [id]
    );
    await client.query(
      "UPDATE patch_jobs SET status='failed', error=$1, completed_at=now() WHERE id=$2 AND status='queued'",
      [reason, id]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── Agent Check-in ───────────────────────────────────────────────────────────

app.post("/checkin", checkinRateLimit, authMiddleware, async (req, res) => {
  const { device, apps, agentVersion, agentUrl, collectedAt } = req.body;

  if (!device || typeof device !== "object") return res.status(400).json({ error: "device is required" });
  if (!device.hostname) return res.status(400).json({ error: "device.hostname is required" });
  if (apps !== undefined && !Array.isArray(apps)) return res.status(400).json({ error: "apps must be an array" });
  if (Array.isArray(apps) && apps.length > 5000) return res.status(400).json({ error: "Too many apps (max 5000)" });

  const deviceId = device.serial
    ? `device-${s(device.serial, 50).replace(/[^a-zA-Z0-9]/g, "-")}`
    : `device-${s(device.hostname, 100).replace(/[^a-zA-Z0-9]/g, "-")}`;

  const now = s(collectedAt, 30) || new Date().toISOString();

  try {
    // Upsert device
    await pool.query(`
      INSERT INTO devices (id, hostname, serial, model, os_version, ram, cpu, agent_version, agent_url, last_seen)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT(id) DO UPDATE SET
        hostname = EXCLUDED.hostname,
        model = EXCLUDED.model,
        os_version = EXCLUDED.os_version,
        ram = EXCLUDED.ram,
        cpu = EXCLUDED.cpu,
        agent_version = EXCLUDED.agent_version,
        agent_url = EXCLUDED.agent_url,
        last_seen = EXCLUDED.last_seen
    `, [deviceId, s(device.hostname), s(device.serial, 50), s(device.model),
        s(device.osVersion, 50), s(device.ram, 50), s(device.cpu),
        s(agentVersion, 50) || "unknown", s(agentUrl, 500) || null, now]);

    // Upsert apps
    if (Array.isArray(apps) && apps.length > 0) {
      for (const app of apps) {
        await pool.query(`
          INSERT INTO apps (device_id, bundle_id, name, version, latest_version, is_outdated, installomator_label, path, source, last_seen)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
          ON CONFLICT(device_id, bundle_id) DO UPDATE SET
            name = EXCLUDED.name,
            version = EXCLUDED.version,
            latest_version = EXCLUDED.latest_version,
            is_outdated = EXCLUDED.is_outdated,
            installomator_label = EXCLUDED.installomator_label,
            path = EXCLUDED.path,
            source = EXCLUDED.source,
            last_seen = EXCLUDED.last_seen
        `, [deviceId, s(app.bundleId) || "", s(app.name) || "", s(app.version, 100),
            s(app.latestVersion, 100), app.isOutdated ? 1 : 0,
            s(app.installomatorLabel, 100), s(app.path, 500), s(app.source, 50), now]);
      }
    }

    // Identity upsert for apps with known Installomator labels
    const identityApps = (apps || []).filter(a =>
      a.bundleId && !a.bundleId.startsWith('com.apple.') && a.installomatorLabel
    );
    if (identityApps.length > 0) {
      await Promise.all(identityApps.map(a =>
        pool.query(
          'INSERT INTO app_identity (bundle_id, app_name, installomator_label, last_derived) VALUES ($1, $2, $3, now()) ON CONFLICT (bundle_id) DO UPDATE SET app_name = EXCLUDED.app_name, installomator_label = COALESCE(EXCLUDED.installomator_label, app_identity.installomator_label), last_derived = now() WHERE NOT app_identity.curated',
          [a.bundleId, a.name, a.installomatorLabel]
        ).catch(e => console.error('identity upsert failed for', a.bundleId, e.message))
      ));
    }

    console.log(`[CheckIn] ${device.hostname} — ${apps?.length || 0} apps`);
    res.json({ ok: true, deviceId, receivedAt: now });
  } catch (err) {
    console.error("[CheckIn] Error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Fleet API ────────────────────────────────────────────────────────────────

app.get("/health", async (req, res) => {
  try {
    const devices = await pool.query("SELECT COUNT(*) as n FROM devices");
    const apps = await pool.query("SELECT COUNT(*) as n FROM apps");
    res.json({ status: "ok", server: "orchardpatch", deviceCount: parseInt(devices.rows[0].n), appCount: parseInt(apps.rows[0].n) });
  } catch (err) {
    res.json({ status: "ok", server: "orchardpatch", deviceCount: 0, appCount: 0 });
  }
});

app.get("/devices", apiRateLimit, authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT d.*,
        COUNT(DISTINCT a.bundle_id) as app_count,
        COUNT(DISTINCT CASE
          WHEN lv.latest_version IS NOT NULL
            AND a.version IS DISTINCT FROM lv.latest_version
          THEN a.bundle_id
        END) as outdated_count
      FROM devices d
      LEFT JOIN apps a ON a.device_id = d.id
      LEFT JOIN app_catalog ac ON ac.bundle_id = a.bundle_id
      LEFT JOIN latest_versions lv
        ON lv.label = COALESCE(a.installomator_label, ac.label)
      GROUP BY d.id
      ORDER BY d.last_seen DESC
    `);
    res.json({ devices: result.rows });
  } catch (err) {
    console.error("[GET /devices]", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/devices/:id", apiRateLimit, authMiddleware, async (req, res) => {
  try {
    const deviceId = s(req.params.id, 100);
    const device = await pool.query("SELECT * FROM devices WHERE id = $1", [deviceId]);
    if (!device.rows.length) return res.status(404).json({ error: "Device not found" });
    const apps = await pool.query("SELECT * FROM apps WHERE device_id = $1 ORDER BY name", [deviceId]);
    res.json({ ...device.rows[0], apps: apps.rows });
  } catch (err) {
    console.error("[GET /devices/:id]", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/apps/status", apiRateLimit, authMiddleware, async (req, res) => {
  try {
    const { device_id } = req.query;
    const whereClause = device_id ? 'WHERE a.device_id = $1' : '';
    const params = device_id ? [s(device_id, 100)] : [];
    const result = await pool.query(`
      SELECT
        a.id,
        a.device_id,
        a.bundle_id,
        a.name,
        a.version,
        lv.latest_version,
        lv.last_checked,
        EXTRACT(EPOCH FROM (NOW() - lv.last_checked::timestamptz))::int AS cache_age_seconds,
        a.source,
        COALESCE(a.installomator_label, ac.label) AS label,
        CASE
          WHEN a.source = 'system' THEN 'na'
          WHEN a.source = 'mas' THEN 'na'
          WHEN lv.latest_version IS NULL THEN 'unknown'
          WHEN a.version = lv.latest_version THEN 'current'
          ELSE 'outdated'
        END AS patch_status
      FROM apps a
      LEFT JOIN app_catalog ac ON ac.bundle_id = a.bundle_id
      LEFT JOIN latest_versions lv
        ON lv.label = COALESCE(a.installomator_label, ac.label)
      ${whereClause}
      ORDER BY a.name
    `, params);
    res.json({ apps: result.rows });
  } catch (err) {
    console.error("[GET /apps/status]", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/apps", apiRateLimit, authMiddleware, async (req, res) => {
  try {
    const outdatedOnly = req.query.outdated === "true";
    const query = outdatedOnly
      ? "SELECT a.*, d.hostname as device_name FROM apps a JOIN devices d ON d.id = a.device_id WHERE a.is_outdated = 1 ORDER BY a.name"
      : "SELECT a.*, d.hostname as device_name FROM apps a JOIN devices d ON d.id = a.device_id ORDER BY a.name";
    const result = await pool.query(query);
    res.json({ apps: result.rows });
  } catch (err) {
    console.error("[GET /apps]", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/stats", apiRateLimit, authMiddleware, async (req, res) => {
  try {
    const [devices, apps, outdated, installs, jobTotal, jobSuccess, jobFailed, lastCheckin] = await Promise.all([
      pool.query("SELECT COUNT(*) as n FROM devices"),
      pool.query("SELECT COUNT(DISTINCT bundle_id) as n FROM apps"),
      pool.query(`SELECT COUNT(DISTINCT a.bundle_id) as n FROM apps a LEFT JOIN app_catalog ac ON ac.bundle_id = a.bundle_id LEFT JOIN latest_versions lv ON lv.label = COALESCE(a.installomator_label, ac.label) WHERE lv.latest_version IS NOT NULL AND a.version IS DISTINCT FROM lv.latest_version`),
      pool.query("SELECT COUNT(*) as n FROM apps"),
      pool.query("SELECT COUNT(*) as n FROM patch_jobs"),
      pool.query("SELECT COUNT(*) as n FROM patch_jobs WHERE status = 'success'"),
      pool.query("SELECT COUNT(*) as n FROM patch_jobs WHERE status = 'failed'"),
      pool.query("SELECT MAX(last_seen) as t FROM devices"),
    ]);
    res.json({
      totalDevices: parseInt(devices.rows[0].n),
      totalApps: parseInt(apps.rows[0].n),
      outdatedApps: parseInt(outdated.rows[0].n),
      totalInstalls: parseInt(installs.rows[0].n),
      patchJobs: {
        total: parseInt(jobTotal.rows[0].n),
        success: parseInt(jobSuccess.rows[0].n),
        failed: parseInt(jobFailed.rows[0].n),
      },
      lastCheckin: lastCheckin.rows[0].t,
    });
  } catch (err) {
    console.error("[GET /stats]", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Patch Jobs ───────────────────────────────────────────────────────────────

const VALID_MODES = ["silent", "managed", "prompted"];

// POST /patch-jobs/branch -- queue multiple patch jobs for one device (Patch by the Branch)
app.post("/patch-jobs/branch", apiRateLimit, authMiddleware, async (req, res) => {
  const { device_id, labels, mode } = req.body;

  if (!device_id || typeof device_id !== "string") return res.status(400).json({ error: "device_id is required" });
  if (!Array.isArray(labels) || labels.length === 0) return res.status(400).json({ error: "labels must be a non-empty array" });

  const resolvedMode = VALID_MODES.includes(mode) ? mode : "managed";
  if (mode && !VALID_MODES.includes(mode)) return res.status(400).json({ error: `mode must be one of: ${VALID_MODES.join(", ")}` });

  // Validate device exists
  const deviceResult = await pool.query("SELECT id FROM devices WHERE id = $1", [s(device_id, 100)]);
  if (deviceResult.rows.length === 0) return res.status(404).json({ error: "Device not found" });

  // Server-side check: only insert labels that are genuinely outdated on this device
  // Join apps -> latest_versions and compare installed vs latest version
  const validationResult = await pool.query(`
    SELECT a.installomator_label AS label, a.name AS app_name, a.version AS installed_version
    FROM apps a
    JOIN latest_versions lv ON lv.label = a.installomator_label
    WHERE a.device_id = $1
      AND a.installomator_label = ANY($2::text[])
      AND lv.latest_version IS NOT NULL
      AND lv.latest_version != ''
      AND a.version IS NOT NULL
      AND lv.latest_version != a.version
  `, [s(device_id, 100), labels.map(l => s(l, 100))]);

  const validatedApps = validationResult.rows;

  if (validatedApps.length === 0) {
    return res.status(400).json({ error: "No provided labels are genuinely outdated on this device" });
  }

  // Insert one row per validated label in a single transaction
  const client = await pool.connect();
  const jobIds = [];
  try {
    await client.query("BEGIN");
    for (const app of validatedApps) {
      const jobId = `branch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const now = new Date().toISOString();
      // Insert history record into patch_jobs
      await client.query(`
        INSERT INTO patch_jobs (id, device_id, app_name, label, mode, method, status, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [jobId, s(device_id, 100), s(app.app_name), s(app.label, 100), resolvedMode, "branch", "queued", now]);
      // Insert work item into pending_patches so the agent poller picks it up
      await client.query(`
        INSERT INTO pending_patches (id, device_id, label, app_name, mode, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [jobId, s(device_id, 100), s(app.label, 100), s(app.app_name), resolvedMode, now]);
      jobIds.push(jobId);
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[POST /patch-jobs/branch] transaction failed:", err.message);
    return res.status(500).json({ error: "Transaction failed — no jobs were queued" });
  } finally {
    client.release();
  }

  res.json({ queued: jobIds.length, job_ids: jobIds });
});

// POST /patch-jobs/bushel -- queue patch jobs for one app across all outdated devices (Patch by the Bushel)
app.post("/patch-jobs/bushel", apiRateLimit, authMiddleware, async (req, res) => {
  const { label, mode } = req.body;

  if (!label || typeof label !== "string") return res.status(400).json({ error: "label is required" });

  const resolvedMode = VALID_MODES.includes(mode) ? mode : "managed";
  if (mode && !VALID_MODES.includes(mode)) return res.status(400).json({ error: `mode must be one of: ${VALID_MODES.join(", ")}` });

  // Validate label exists in latest_versions
  const labelResult = await pool.query("SELECT label FROM latest_versions WHERE label = $1", [s(label, 100)]);
  if (labelResult.rows.length === 0) {
    return res.status(400).json({ error: `Label \"${label}\" not found in version catalog` });
  }

  // Query all devices where this app (by label) is outdated
  // Join apps -> latest_versions and compare installed vs latest version
  const devicesResult = await pool.query(`
    SELECT DISTINCT a.device_id, a.name AS app_name, a.version AS installed_version, d.hostname
    FROM apps a
    JOIN latest_versions lv ON lv.label = a.installomator_label
    JOIN devices d ON d.id = a.device_id
    WHERE a.installomator_label = $1
      AND a.source = 'user'
      AND lv.latest_version IS NOT NULL
      AND lv.latest_version != ''
      AND a.version IS NOT NULL
      AND lv.latest_version != a.version
  `, [s(label, 100)]);

  const outdatedDevices = devicesResult.rows;

  if (outdatedDevices.length === 0) {
    return res.status(400).json({ error: `No devices have outdated versions of label \"${label}\"` });
  }

  // Insert one job per device in a single transaction
  const client = await pool.connect();
  const jobIds = [];
  try {
    await client.query("BEGIN");
    for (const device of outdatedDevices) {
      const jobId = `bushel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const now = new Date().toISOString();
      // Insert history record into patch_jobs
      await client.query(`
        INSERT INTO patch_jobs (id, device_id, app_name, label, mode, method, status, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [jobId, s(device.device_id, 100), s(device.app_name), s(label, 100), resolvedMode, "bushel", "queued", now]);
      // Insert work item into pending_patches so the agent poller picks it up
      await client.query(`
        INSERT INTO pending_patches (id, device_id, label, app_name, mode, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [jobId, s(device.device_id, 100), s(label, 100), s(device.app_name), resolvedMode, now]);
      jobIds.push(jobId);
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[POST /patch-jobs/bushel] transaction failed:", err.message);
    return res.status(500).json({ error: "Transaction failed — no jobs were queued" });
  } finally {
    client.release();
  }

  // Return queued count and affected devices with versions
  const devicesWithVersions = outdatedDevices.map(d => ({
    device_id: d.device_id,
    hostname: d.hostname,
    current_version: d.installed_version
  }));

  res.json({ queued: jobIds.length, devices: devicesWithVersions });
});

// POST /patch-jobs/orchard -- queue patch jobs for all outdated apps across all devices (Patch by the Orchard)
app.post("/patch-jobs/orchard", apiRateLimit, authMiddleware, async (req, res) => {
  const { mode } = req.body;

  const resolvedMode = VALID_MODES.includes(mode) ? mode : "managed";
  if (mode && !VALID_MODES.includes(mode)) return res.status(400).json({ error: `mode must be one of: ${VALID_MODES.join(", ")}` });

  // Get all devices in the fleet
  const devicesResult = await pool.query("SELECT id, hostname FROM devices ORDER BY hostname");
  const devices = devicesResult.rows;

  if (devices.length === 0) {
    return res.status(400).json({ error: "No devices in fleet" });
  }

  // For each device, find all outdated apps where source = 'user'
  const deviceOutdated = [];
  const allApps = new Map(); // Track unique apps across fleet for response

  for (const device of devices) {
    const appsResult = await pool.query(`
      SELECT DISTINCT
        a.installomator_label,
        a.name AS app_name,
        a.version AS installed_version,
        lv.latest_version
      FROM apps a
      LEFT JOIN app_catalog ac ON ac.bundle_id = a.bundle_id
      LEFT JOIN latest_versions lv ON lv.label = COALESCE(a.installomator_label, ac.label)
      WHERE a.device_id = $1
        AND a.source = 'user'
        AND lv.latest_version IS NOT NULL
        AND lv.latest_version != ''
        AND a.version IS NOT NULL
        AND lv.latest_version != a.version
      ORDER BY a.name
    `, [s(device.id, 100)]);

    const outdatedApps = appsResult.rows;
    if (outdatedApps.length > 0) {
      deviceOutdated.push({
        device_id: device.id,
        hostname: device.hostname,
        apps: outdatedApps
      });

      // Track unique apps
      outdatedApps.forEach(app => {
        const key = app.installomator_label;
        if (!allApps.has(key)) {
          allApps.set(key, { label: key, app_name: app.app_name, devices: new Set() });
        }
        allApps.get(key).devices.add(device.id);
      });
    }
  }

  // Check if there's anything to patch
  const totalJobs = deviceOutdated.reduce((sum, d) => sum + d.apps.length, 0);
  if (totalJobs === 0) {
    return res.status(400).json({ error: "No outdated apps found across fleet" });
  }

  // Insert all jobs atomically
  const client = await pool.connect();
  const jobIds = [];
  try {
    await client.query("BEGIN");

    for (const device of deviceOutdated) {
      for (const app of device.apps) {
        const jobId = `orchard-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const now = new Date().toISOString();

        // Insert history record
        await client.query(`
          INSERT INTO patch_jobs (id, device_id, app_name, label, mode, method, status, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [jobId, s(device.device_id, 100), s(app.app_name), s(app.installomator_label, 100), resolvedMode, "orchard", "queued", now]);

        // Insert work item for agent
        await client.query(`
          INSERT INTO pending_patches (id, device_id, label, app_name, mode, created_at)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [jobId, s(device.device_id, 100), s(app.installomator_label, 100), s(app.app_name), resolvedMode, now]);

        jobIds.push(jobId);
      }
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[POST /patch-jobs/orchard] transaction failed:", err.message);
    return res.status(500).json({ error: "Transaction failed — no jobs were queued" });
  } finally {
    client.release();
  }

  // Build response
  const devicesResponse = deviceOutdated.map(d => ({
    device_id: d.device_id,
    hostname: d.hostname,
    app_count: d.apps.length
  }));

  const appsResponse = Array.from(allApps.values()).map(app => ({
    label: app.label,
    app_name: app.app_name,
    device_count: app.devices.size
  }));

  res.json({
    queued: jobIds.length,
    devices: devicesResponse,
    apps: appsResponse
  });
});


app.post("/patch-jobs", apiRateLimit, authMiddleware, async (req, res) => {
  const { jobId, deviceId, bundleId, appName, label, mode, status, exitCode, error, log, createdAt, startedAt, completedAt } = req.body;

  if (!jobId || typeof jobId !== "string") return res.status(400).json({ error: "jobId is required" });
  if (!appName || typeof appName !== "string") return res.status(400).json({ error: "appName is required" });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      INSERT INTO patch_jobs (id, device_id, bundle_id, app_name, label, mode, method, status, exit_code, error, log, created_at, started_at, completed_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      ON CONFLICT(id) DO UPDATE SET
        status = EXCLUDED.status,
        exit_code = EXCLUDED.exit_code,
        error = EXCLUDED.error,
        log = EXCLUDED.log,
        started_at = EXCLUDED.started_at,
        completed_at = EXCLUDED.completed_at
    `, [s(jobId, 100), s(deviceId, 100) || "unknown", s(bundleId), s(appName),
        s(label, 100) || "", s(mode, 50) || "managed", "fruit", s(status, 50) || "unknown",
        sint(exitCode), s(error, 1000),
        Array.isArray(log) ? log.join("\n").slice(0, 50000) : s(log, 50000),
        s(createdAt, 30) || new Date().toISOString(), s(startedAt, 30), s(completedAt, 30)]);
    if (status === 'success' || status === 'failed') {
      await client.query('DELETE FROM pending_patches WHERE id = $1', [s(jobId, 100)]);
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error("[POST /patch-jobs]", err.message);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

app.get("/patch-jobs", apiRateLimit, authMiddleware, async (req, res) => {
  try {
    const limit = Math.min(sint(req.query.limit, 100), 500);
    const filters = [];
    const params = [];

    if (req.query.device_id) { params.push(s(req.query.device_id, 100)); filters.push(`pj.device_id = $${params.length}`); }
    if (req.query.method)    { params.push(s(req.query.method, 50));     filters.push(`pj.method = $${params.length}`); }
    if (req.query.mode)      { params.push(s(req.query.mode, 50));       filters.push(`pj.mode = $${params.length}`); }
    if (req.query.status)    { params.push(s(req.query.status, 50));     filters.push(`pj.status = $${params.length}`); }

    const where = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
    params.push(limit);

    const result = await pool.query(`
      SELECT pj.*, d.hostname as device_name
      FROM patch_jobs pj
      LEFT JOIN devices d ON d.id = pj.device_id
      ${where}
      ORDER BY pj.created_at DESC
      LIMIT $${params.length}
    `, params);
    res.json({ jobs: result.rows });
  } catch (err) {
    console.error("[GET /patch-jobs]", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Cancel a pending patch job
app.post("/patch-jobs/:id/cancel", apiRateLimit, authMiddleware, async (req, res) => {
  const { id } = req.params;
  if (!id || typeof id !== "string") return res.status(400).json({ error: "ID is required" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Lock the pending_patches row so claim and cancel serialize on the correct table.
    // claimed_at lives on pending_patches, not patch_jobs.
    // Whichever transaction grabs the lock first wins; the other sees the committed result.
    const pendingResult = await client.query(
      "SELECT claimed_at FROM pending_patches WHERE id = $1 FOR UPDATE",
      [s(id, 100)]
    );

    if (pendingResult.rows.length === 0) {
      // CASE A: no pending_patches row -- job is in the undo window (silent mode, not yet
      // enqueued) or was never enqueued. Check patch_jobs for existence and status.
      // undo window cancel -- pending_patches not yet enqueued;
      // setTimeout will see cancelled status and skip the insert
      const jobResult = await client.query(
        "SELECT status FROM patch_jobs WHERE id = $1",
        [s(id, 100)]
      );
      if (jobResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Job not found" });
      }
      if (jobResult.rows[0].status === "cancelled") {
        await client.query("ROLLBACK");
        return res.json({ ok: true });
      }
      await client.query(
        "UPDATE patch_jobs SET status = 'cancelled', completed_at = now() WHERE id = $1 AND status = 'queued'",
        [s(id, 100)]
      );
      await client.query("COMMIT");
      console.log(`[Cancel] Job ${id} cancelled in undo window`);
      return res.json({ ok: true });
    }

    const pending = pendingResult.rows[0];

    if (pending.claimed_at) {
      // CASE B: row exists and is claimed -- agent already picked it up
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "already picked up by agent" });
    }

    // CASE C: row exists, not yet claimed -- cancel atomically
    await client.query("DELETE FROM pending_patches WHERE id = $1", [s(id, 100)]);
    await client.query(
      "UPDATE patch_jobs SET status = 'cancelled', completed_at = now() WHERE id = $1 AND status = 'queued'",
      [s(id, 100)]
    );
    await client.query("COMMIT");
    console.log(`[Cancel] Job ${id} cancelled successfully`);
    res.json({ success: true, message: "Job cancelled", id });
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch (_) {}
    console.error("[POST /patch-jobs/:id/cancel]", err.message);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

// ─── Patch Orchestration (polling model) ─────────────────────────────────────

// Dashboard triggers a patch — creates a pending record agents will pick up
app.post("/patch", apiRateLimit, authMiddleware, async (req, res) => {
  const { deviceId, bundleId, label, appName, mode } = req.body;

  if (!deviceId || typeof deviceId !== "string") return res.status(400).json({ error: "deviceId is required" });
  if (!label || typeof label !== "string") return res.status(400).json({ error: "label is required" });
  if (!appName || typeof appName !== "string") return res.status(400).json({ error: "appName is required" });

  const id = `patch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createdAt = new Date().toISOString();
  const resolvedMode = s(mode, 50) || "managed";

  if (resolvedMode === "silent") {
    // 15s undo window: pending_patches withheld for silent mode
    // patch_jobs row written immediately (visible in history with Undo affordance)
    const client = await pool.connect();
    try {
      await client.query(
        "INSERT INTO patch_jobs (id, device_id, app_name, label, mode, method, status, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
        [id, s(deviceId, 100), s(appName), s(label, 100), resolvedMode, "fruit", "queued", createdAt]
      );
    } catch (err) {
      console.error("[POST /patch silent patch_jobs]", err.message);
      client.release();
      return res.status(500).json({ error: "Internal server error" });
    } finally {
      client.release();
    }

    // Enqueue the agent work item after 15s — if cancelled before then, this becomes a no-op
    // (cancel sets status='cancelled' on patch_jobs; the INSERT here is independent and will
    // still run, but the agent will find no matching unclaimed row if already cancelled
    // via the patch_jobs status check on the cancel endpoint... TODO: use a flag/abort)
    setTimeout(async () => {
      try {
        // KNOWN RACE: a ~1ms window exists between this SELECT and the INSERT below.
        // A cancel arriving in that gap could flip patch_jobs to 'cancelled' after
        // we read 'queued', causing the INSERT to fire for a cancelled job.
        // Full fix: wrap SELECT + INSERT in a FOR UPDATE transaction.
        // Acceptable at current fleet scale (2 devices, human-initiated cancels).
        // Revisit before multi-tenancy ships.
        // Guard: skip insert if job was cancelled during the undo window
        const check = await pool.query(
          "SELECT status FROM patch_jobs WHERE id = $1",
          [id]
        );
        if (!check.rows.length || check.rows[0].status !== "queued") {
          console.log("[Patch] deferred enqueue skipped -- job " + id + " is " +
            (check.rows[0] ? check.rows[0].status : "gone"));
          return;
        }
        await pool.query(
          "INSERT INTO pending_patches (id, device_id, label, app_name, mode, created_at) VALUES ($1, $2, $3, $4, $5, now())",
          [id, s(deviceId, 100), s(label, 100), s(appName), resolvedMode]
        );
        console.log(`[Patch] Deferred pending_patches enqueued for ${id}`);
      } catch (err) {
        console.error(`[Patch] Deferred pending_patches insert failed for ${id}:`, err.message);
      }
    }, 15000);
  } else {
    // Non-silent: write both rows atomically
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      await client.query(
        "INSERT INTO patch_jobs (id, device_id, app_name, label, mode, method, status, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
        [id, s(deviceId, 100), s(appName), s(label, 100), resolvedMode, "fruit", "queued", createdAt]
      );

      await client.query(
        "INSERT INTO pending_patches (id, device_id, bundle_id, label, app_name, mode, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)",
        [id, s(deviceId, 100), s(bundleId), s(label, 100), s(appName), resolvedMode, createdAt]
      );

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("[POST /patch]", err.message);
      client.release();
      return res.status(500).json({ error: "Internal server error" });
    } finally {
      client.release();
    }
  }

  console.log(`[Patch] Queued ${label} for ${deviceId} mode=${resolvedMode}`);
  res.json({ ok: true, id, deviceId, label, appName, createdAt });
});

// Agents poll this to find pending work for their device
app.get("/pending-patches", apiRateLimit, authMiddleware, async (req, res) => {
  const deviceId = s(req.query.device_id, 100);
  if (!deviceId) return res.status(400).json({ error: "device_id is required" });

  try {
    const result = await pool.query(`
      SELECT * FROM pending_patches
      WHERE device_id = $1 AND claimed_at IS NULL
      ORDER BY created_at ASC
    `, [deviceId]);
    res.json({ patches: result.rows });
  } catch (err) {
    console.error("[GET /pending-patches]", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Agent claims a patch atomically before running Installomator
app.post("/pending-patches/:id/claim", apiRateLimit, authMiddleware, async (req, res) => {
  const id = s(req.params.id, 100);
  const claimedAt = new Date().toISOString();

  try {
    const result = await pool.query(`
      UPDATE pending_patches SET claimed_at = $1
      WHERE id = $2 AND claimed_at IS NULL
      RETURNING *
    `, [claimedAt, id]);

    if (!result.rows.length) return res.status(409).json({ error: "Already claimed or not found" });
    res.json({ ok: true, patch: result.rows[0] });
  } catch (err) {
    console.error("[POST /pending-patches/:id/claim]", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── pending_commands endpoints ─────────────────────────────────────────────────

// Agent polls for unclaimed commands for its device
app.get("/pending-commands", apiRateLimit, authMiddleware, async (req, res) => {
  const deviceId = s(req.query.device_id, 100);
  if (!deviceId) return res.status(400).json({ error: "device_id is required" });

  try {
    const result = await pool.query(
      "SELECT id, command, created_at FROM pending_commands WHERE device_id = $1 AND claimed_at IS NULL AND completed_at IS NULL ORDER BY created_at ASC",
      [deviceId]
    );
    res.json({ commands: result.rows });
  } catch (err) {
    console.error("[GET /pending-commands]", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Agent claims a command atomically before executing it
app.post("/pending-commands/:id/claim", apiRateLimit, authMiddleware, async (req, res) => {
  const id = sint(req.params.id);
  if (!id) return res.status(400).json({ error: "id is required" });

  try {
    const result = await pool.query(
      "UPDATE pending_commands SET claimed_at = now() WHERE id = $1 AND claimed_at IS NULL RETURNING id",
      [id]
    );
    if (!result.rows.length) return res.status(409).json({ error: "already claimed or not found" });
    res.json({ ok: true });
  } catch (err) {
    console.error("[POST /pending-commands/:id/claim]", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Agent marks a command complete
app.post("/pending-commands/:id/complete", apiRateLimit, authMiddleware, async (req, res) => {
  const id = sint(req.params.id);
  if (!id) return res.status(400).json({ error: "id is required" });
  const result_text = (req.body && req.body.result !== undefined) ? req.body.result : null;

  try {
    await pool.query(
      "UPDATE pending_commands SET completed_at = now(), result = $2 WHERE id = $1",
      [id, result_text]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("[POST /pending-commands/:id/complete]", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Frontend enqueues a force check-in command for a device
app.post("/api/force-checkin", apiRateLimit, authMiddleware, async (req, res) => {
  const { deviceId } = req.body;
  if (!deviceId || typeof deviceId !== "string") return res.status(400).json({ error: "deviceId is required" });

  const command = 'check_in';
  if (!ENQUEUE_ALLOWED.has(command)) return res.status(400).json({ error: "command not allowed" });

  try {
    const result = await pool.query(
      "INSERT INTO pending_commands (device_id, command) VALUES ($1, $2) RETURNING id",
      [s(deviceId, 100), command]
    );
    res.status(201).json({ ok: true, id: result.rows[0].id });
  } catch (err) {
    console.error("[POST /api/force-checkin]", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Cleanup ──────────────────────────────────────────────────────────────────

// 24h expiry: terminate unclaimed patches whose device never checked in
setInterval(async () => {
  try {
    const result = await pool.query(
      "SELECT id FROM pending_patches WHERE claimed_at IS NULL AND created_at < now() - interval '24 hours'"
    );
    for (const row of result.rows) {
      try {
        await terminate_stuck_job(row.id, 'expired: device did not check in within 24h');
        console.log('[cron] expired job ' + row.id);
      } catch (err) {
        console.error('[cron] failed to expire job ' + row.id + ':', err.message);
      }
    }
  } catch (err) {
    console.error('[Cleanup] 24h expiry sweep:', err.message);
  }
}, 60 * 60 * 1000); // every hour

// 30-min staleness sweep: terminate claimed patches whose agent died without reporting
setInterval(async () => {
  try {
    const result = await pool.query(
      "SELECT id FROM pending_patches WHERE claimed_at IS NOT NULL AND claimed_at < now() - interval '30 minutes'"
    );
    for (const row of result.rows) {
      try {
        await terminate_stuck_job(row.id, 'abandoned: claim exceeded 30m staleness, agent did not report');
        console.log('[cron] abandoned job ' + row.id);
      } catch (err) {
        console.error('[cron] failed to abandon job ' + row.id + ':', err.message);
      }
    }
  } catch (err) {
    console.error('[Cleanup] 30m staleness sweep:', err.message);
  }
}, 300000); // every 5 minutes

// ─── Version Cache ────────────────────────────────────────────────────────────

app.use("/api/version-sync", apiRateLimit, authMiddleware, versionSyncRouter);
app.use("/api/catalog-sync", apiRateLimit, authMiddleware, catalogSyncRouter);
app.use("/api/catalog", apiRateLimit, authMiddleware, catalogSyncRouter);

// ─── 404 / Error handlers ─────────────────────────────────────────────────────

app.use((req, res) => res.status(404).json({ error: "Not found" }));

app.use((err, req, res, next) => {
  if (err.message === "Not allowed by CORS") return res.status(403).json({ error: "CORS policy violation" });
  console.error("[Server Error]", err.message);
  res.status(500).json({ error: "Internal server error" });
});

// ─── Start ────────────────────────────────────────────────────────────────────

(async () => {
  try { await bootstrapIdentity(pool); } catch (e) { console.error('identity bootstrap failed:', e.message); }
  startResolverCron(pool);
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[OrchardPatch Server] Listening on port ${PORT}`);
  });
})();
