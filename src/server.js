/**
 * OrchardPatch Central Server
 * Receives check-ins from agents, stores fleet data, serves the dashboard API.
 */

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const pool = require("./db");
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
        COALESCE(a.installomator_label, ac.label) AS label,
        CASE
          WHEN a.source = 'system' THEN 'na'
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
      await client.query(`
        INSERT INTO patch_jobs (id, device_id, app_name, label, mode, method, status, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [jobId, s(device_id, 100), s(app.app_name), s(app.label, 100), resolvedMode, "branch", "queued", now]);
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

app.post("/patch-jobs", apiRateLimit, authMiddleware, async (req, res) => {
  const { jobId, deviceId, bundleId, appName, label, mode, status, exitCode, error, log, createdAt, startedAt, completedAt } = req.body;

  if (!jobId || typeof jobId !== "string") return res.status(400).json({ error: "jobId is required" });
  if (!appName || typeof appName !== "string") return res.status(400).json({ error: "appName is required" });

  try {
    await pool.query(`
      INSERT INTO patch_jobs (id, device_id, bundle_id, app_name, label, mode, method, status, exit_code, error, log, created_at, started_at, completed_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      ON CONFLICT(id) DO UPDATE SET
        status = EXCLUDED.status,
        exit_code = EXCLUDED.exit_code,
        error = EXCLUDED.error,
        log = EXCLUDED.log,
        completed_at = EXCLUDED.completed_at
    `, [s(jobId, 100), s(deviceId, 100) || "unknown", s(bundleId), s(appName),
        s(label, 100) || "", s(mode, 50) || "managed", "fruit", s(status, 50) || "unknown",
        sint(exitCode), s(error, 1000),
        Array.isArray(log) ? log.join("\n").slice(0, 50000) : s(log, 50000),
        s(createdAt, 30) || new Date().toISOString(), s(startedAt, 30), s(completedAt, 30)]);
    res.json({ ok: true });
  } catch (err) {
    console.error("[POST /patch-jobs]", err.message);
    res.status(500).json({ error: "Internal server error" });
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

// ─── Patch Orchestration (polling model) ─────────────────────────────────────

// Dashboard triggers a patch — creates a pending record agents will pick up
app.post("/patch", apiRateLimit, authMiddleware, async (req, res) => {
  const { deviceId, bundleId, label, appName, mode } = req.body;

  if (!deviceId || typeof deviceId !== "string") return res.status(400).json({ error: "deviceId is required" });
  if (!label || typeof label !== "string") return res.status(400).json({ error: "label is required" });
  if (!appName || typeof appName !== "string") return res.status(400).json({ error: "appName is required" });

  const id = `patch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createdAt = new Date().toISOString();

  try {
    await pool.query(`
      INSERT INTO pending_patches (id, device_id, bundle_id, label, app_name, mode, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
    `, [id, s(deviceId, 100), s(bundleId), s(label, 100), s(appName), s(mode, 50) || "managed", createdAt]);

    console.log(`[Patch] Queued ${label} for ${deviceId}`);
    res.json({ ok: true, id, deviceId, label, appName, createdAt });
  } catch (err) {
    console.error("[POST /patch]", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
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

// ─── Cleanup ──────────────────────────────────────────────────────────────────

// Remove claimed pending_patches older than 24h
setInterval(async () => {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const result = await pool.query(
      "DELETE FROM pending_patches WHERE created_at < $1",
      [cutoff]
    );
    if (result.rowCount > 0) console.log(`[Cleanup] Removed ${result.rowCount} old pending patches`);
  } catch (err) {
    console.error("[Cleanup] pending_patches:", err.message);
  }
}, 60 * 60 * 1000); // every hour

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

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[OrchardPatch Server] Listening on port ${PORT}`);
});
