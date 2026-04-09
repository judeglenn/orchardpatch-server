/**
 * OrchardPatch Central Server
 * Receives check-ins from agents, stores fleet data, serves the dashboard API.
 */

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const pool = require("./db");

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
  const { device, apps, agentVersion, collectedAt } = req.body;

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
      INSERT INTO devices (id, hostname, serial, model, os_version, ram, cpu, agent_version, last_seen)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT(id) DO UPDATE SET
        hostname = EXCLUDED.hostname,
        model = EXCLUDED.model,
        os_version = EXCLUDED.os_version,
        ram = EXCLUDED.ram,
        cpu = EXCLUDED.cpu,
        agent_version = EXCLUDED.agent_version,
        last_seen = EXCLUDED.last_seen
    `, [deviceId, s(device.hostname), s(device.serial, 50), s(device.model),
        s(device.osVersion, 50), s(device.ram, 50), s(device.cpu),
        s(agentVersion, 50) || "unknown", now]);

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
        SUM(a.is_outdated) as outdated_count
      FROM devices d
      LEFT JOIN apps a ON a.device_id = d.id
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
      pool.query("SELECT COUNT(DISTINCT bundle_id) as n FROM apps WHERE is_outdated = 1"),
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

app.post("/patch-jobs", apiRateLimit, authMiddleware, async (req, res) => {
  const { jobId, deviceId, bundleId, appName, label, mode, status, exitCode, error, log, createdAt, startedAt, completedAt } = req.body;

  if (!jobId || typeof jobId !== "string") return res.status(400).json({ error: "jobId is required" });
  if (!appName || typeof appName !== "string") return res.status(400).json({ error: "appName is required" });

  try {
    await pool.query(`
      INSERT INTO patch_jobs (id, device_id, bundle_id, app_name, label, mode, status, exit_code, error, log, created_at, started_at, completed_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      ON CONFLICT(id) DO UPDATE SET
        status = EXCLUDED.status,
        exit_code = EXCLUDED.exit_code,
        error = EXCLUDED.error,
        log = EXCLUDED.log,
        completed_at = EXCLUDED.completed_at
    `, [s(jobId, 100), s(deviceId, 100) || "unknown", s(bundleId), s(appName),
        s(label, 100) || "", s(mode, 50) || "managed", s(status, 50) || "unknown",
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
    const result = await pool.query(`
      SELECT pj.*, d.hostname as device_name
      FROM patch_jobs pj
      LEFT JOIN devices d ON d.id = pj.device_id
      ORDER BY pj.created_at DESC
      LIMIT $1
    `, [limit]);
    res.json({ jobs: result.rows });
  } catch (err) {
    console.error("[GET /patch-jobs]", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

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
