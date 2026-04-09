/**
 * OrchardPatch Central Server
 * Receives check-ins from agents, stores fleet data, serves the dashboard API.
 */

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { v4: uuidv4 } = require("uuid");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 4747;

// ─── Security middleware ──────────────────────────────────────────────────────

app.use(helmet({ contentSecurityPolicy: false }));

// CORS — only allow known origins
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (agents, curl, server-to-server)
    if (!origin) return callback(null, true);
    // Allow configured origins or Vercel/localhost in dev
    if (
      ALLOWED_ORIGINS.includes(origin) ||
      origin.endsWith(".vercel.app") ||
      origin.endsWith(".orchardpatch.com") ||
      origin === "https://orchardpatch.vercel.app" ||
      origin.startsWith("http://localhost")
    ) {
      return callback(null, true);
    }
    callback(new Error("Not allowed by CORS"));
  }
}));

// Body size limits — agents send ~50-100 apps per checkin, 1mb is generous
app.use(express.json({ limit: "1mb" }));

// ─── Rate limiting ────────────────────────────────────────────────────────────

// Simple in-memory rate limiter (good enough for single-server deploy)
const rateLimitMap = new Map();

function rateLimit(windowMs, maxRequests) {
  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    const entry = rateLimitMap.get(key) || { count: 0, resetAt: now + windowMs };

    if (now > entry.resetAt) {
      entry.count = 0;
      entry.resetAt = now + windowMs;
    }

    entry.count++;
    rateLimitMap.set(key, entry);

    if (entry.count > maxRequests) {
      return res.status(429).json({ error: "Too many requests" });
    }

    next();
  };
}

// Checkin: max 10 requests per minute per IP (agents check in every 15 min)
const checkinRateLimit = rateLimit(60 * 1000, 10);

// API: max 100 requests per minute per IP
const apiRateLimit = rateLimit(60 * 1000, 100);

// Clean up rate limit map every 5 minutes to prevent memory leak
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
  if (!token || token !== SERVER_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// ─── Input validation helpers ─────────────────────────────────────────────────

function sanitizeString(val, maxLen = 255) {
  if (val === null || val === undefined) return null;
  return String(val).slice(0, maxLen);
}

function sanitizeInt(val, fallback = null) {
  const n = parseInt(val);
  return isNaN(n) ? fallback : n;
}

// ─── Agent Check-in ───────────────────────────────────────────────────────────

/**
 * POST /checkin
 * Called by agents every 15 minutes with their full inventory.
 */
app.post("/checkin", checkinRateLimit, authMiddleware, (req, res) => {
  const { device, apps, agentVersion, collectedAt } = req.body;

  if (!device || typeof device !== "object") {
    return res.status(400).json({ error: "device is required" });
  }
  if (!device.hostname || typeof device.hostname !== "string") {
    return res.status(400).json({ error: "device.hostname is required" });
  }
  if (apps !== undefined && !Array.isArray(apps)) {
    return res.status(400).json({ error: "apps must be an array" });
  }
  if (Array.isArray(apps) && apps.length > 5000) {
    return res.status(400).json({ error: "Too many apps in payload (max 5000)" });
  }

  const deviceId = device.serial
    ? `device-${sanitizeString(device.serial, 50).replace(/[^a-zA-Z0-9]/g, "-")}`
    : `device-${sanitizeString(device.hostname, 100).replace(/[^a-zA-Z0-9]/g, "-")}`;

  const now = sanitizeString(collectedAt, 30) || new Date().toISOString();

  // Upsert device
  db.prepare(`
    INSERT INTO devices (id, hostname, serial, model, os_version, ram, cpu, agent_version, last_seen, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      hostname = excluded.hostname,
      model = excluded.model,
      os_version = excluded.os_version,
      ram = excluded.ram,
      cpu = excluded.cpu,
      agent_version = excluded.agent_version,
      last_seen = excluded.last_seen
  `).run(
    deviceId,
    sanitizeString(device.hostname, 255),
    sanitizeString(device.serial, 50),
    sanitizeString(device.model, 255),
    sanitizeString(device.osVersion, 50),
    sanitizeString(device.ram, 50),
    sanitizeString(device.cpu, 255),
    sanitizeString(agentVersion, 50) || "unknown",
    now
  );

  // Upsert apps
  if (Array.isArray(apps)) {
    const upsertApp = db.prepare(`
      INSERT INTO apps (device_id, bundle_id, name, version, latest_version, is_outdated, installomator_label, path, source, last_seen)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(device_id, bundle_id) DO UPDATE SET
        name = excluded.name,
        version = excluded.version,
        latest_version = excluded.latest_version,
        is_outdated = excluded.is_outdated,
        installomator_label = excluded.installomator_label,
        path = excluded.path,
        source = excluded.source,
        last_seen = excluded.last_seen
    `);

    const upsertMany = db.transaction((appsArr) => {
      for (const app of appsArr) {
        upsertApp.run(
          deviceId,
          sanitizeString(app.bundleId, 255) || "",
          sanitizeString(app.name, 255) || "",
          sanitizeString(app.version, 100),
          sanitizeString(app.latestVersion, 100),
          app.isOutdated ? 1 : 0,
          sanitizeString(app.installomatorLabel, 100),
          sanitizeString(app.path, 500),
          sanitizeString(app.source, 50),
          now
        );
      }
    });

    upsertMany(apps);
  }

  console.log(`[CheckIn] ${device.hostname} — ${apps?.length || 0} apps`);
  res.json({ ok: true, deviceId, receivedAt: now });
});

// ─── Fleet API ────────────────────────────────────────────────────────────────

// Health check — public, no auth required
app.get("/health", (req, res) => {
  const deviceCount = db.prepare("SELECT COUNT(*) as n FROM devices").get().n;
  const appCount = db.prepare("SELECT COUNT(*) as n FROM apps").get().n;
  res.json({ status: "ok", server: "orchardpatch", deviceCount, appCount });
});

// Get all devices
app.get("/devices", apiRateLimit, authMiddleware, (req, res) => {
  const devices = db.prepare(`
    SELECT d.*,
      COUNT(DISTINCT a.bundle_id) as app_count,
      SUM(a.is_outdated) as outdated_count
    FROM devices d
    LEFT JOIN apps a ON a.device_id = d.id
    GROUP BY d.id
    ORDER BY d.last_seen DESC
  `).all();
  res.json({ devices });
});

// Get a single device with its apps
app.get("/devices/:id", apiRateLimit, authMiddleware, (req, res) => {
  const deviceId = sanitizeString(req.params.id, 100);
  const device = db.prepare("SELECT * FROM devices WHERE id = ?").get(deviceId);
  if (!device) return res.status(404).json({ error: "Device not found" });

  const apps = db.prepare(`
    SELECT * FROM apps WHERE device_id = ? ORDER BY name
  `).all(deviceId);

  res.json({ ...device, apps });
});

// Get all apps across fleet
app.get("/apps", apiRateLimit, authMiddleware, (req, res) => {
  const outdatedOnly = req.query.outdated === "true";

  const apps = outdatedOnly
    ? db.prepare("SELECT a.*, d.hostname as device_name FROM apps a JOIN devices d ON d.id = a.device_id WHERE a.is_outdated = 1 ORDER BY a.name").all()
    : db.prepare("SELECT a.*, d.hostname as device_name FROM apps a JOIN devices d ON d.id = a.device_id ORDER BY a.name").all();

  res.json({ apps });
});

// Fleet summary stats
app.get("/stats", apiRateLimit, authMiddleware, (req, res) => {
  const stats = {
    totalDevices: db.prepare("SELECT COUNT(*) as n FROM devices").get().n,
    totalApps: db.prepare("SELECT COUNT(DISTINCT bundle_id) as n FROM apps").get().n,
    outdatedApps: db.prepare("SELECT COUNT(DISTINCT bundle_id) as n FROM apps WHERE is_outdated = 1").get().n,
    totalInstalls: db.prepare("SELECT COUNT(*) as n FROM apps").get().n,
    patchJobs: {
      total: db.prepare("SELECT COUNT(*) as n FROM patch_jobs").get().n,
      success: db.prepare("SELECT COUNT(*) as n FROM patch_jobs WHERE status = 'success'").get().n,
      failed: db.prepare("SELECT COUNT(*) as n FROM patch_jobs WHERE status = 'failed'").get().n,
    },
    lastCheckin: db.prepare("SELECT MAX(last_seen) as t FROM devices").get().t,
  };
  res.json(stats);
});

// ─── Patch Jobs ───────────────────────────────────────────────────────────────

// Receive patch job results from agent
app.post("/patch-jobs", apiRateLimit, authMiddleware, (req, res) => {
  const { jobId, deviceId, bundleId, appName, label, mode, status, exitCode, error, log, createdAt, startedAt, completedAt } = req.body;

  if (!jobId || typeof jobId !== "string") return res.status(400).json({ error: "jobId is required" });
  if (!appName || typeof appName !== "string") return res.status(400).json({ error: "appName is required" });

  db.prepare(`
    INSERT INTO patch_jobs (id, device_id, bundle_id, app_name, label, mode, status, exit_code, error, log, created_at, started_at, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      status = excluded.status,
      exit_code = excluded.exit_code,
      error = excluded.error,
      log = excluded.log,
      completed_at = excluded.completed_at
  `).run(
    sanitizeString(jobId, 100),
    sanitizeString(deviceId, 100) || "unknown",
    sanitizeString(bundleId, 255),
    sanitizeString(appName, 255),
    sanitizeString(label, 100) || "",
    sanitizeString(mode, 50) || "managed",
    sanitizeString(status, 50) || "unknown",
    sanitizeInt(exitCode),
    sanitizeString(error, 1000),
    Array.isArray(log) ? log.join("\n").slice(0, 50000) : sanitizeString(log, 50000),
    sanitizeString(createdAt, 30) || new Date().toISOString(),
    sanitizeString(startedAt, 30),
    sanitizeString(completedAt, 30)
  );

  res.json({ ok: true });
});

// Get patch job history
app.get("/patch-jobs", apiRateLimit, authMiddleware, (req, res) => {
  const limit = Math.min(sanitizeInt(req.query.limit, 100), 500); // cap at 500
  const jobs = db.prepare(`
    SELECT pj.*, d.hostname as device_name
    FROM patch_jobs pj
    LEFT JOIN devices d ON d.id = pj.device_id
    ORDER BY pj.created_at DESC
    LIMIT ?
  `).all(limit);
  res.json({ jobs });
});

// ─── 404 handler ─────────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// ─── Error handler ────────────────────────────────────────────────────────────

app.use((err, req, res, next) => {
  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({ error: "CORS policy violation" });
  }
  console.error("[Server Error]", err.message);
  res.status(500).json({ error: "Internal server error" });
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[OrchardPatch Server] Listening on port ${PORT}`);
  console.log(`[OrchardPatch Server] Health: http://localhost:${PORT}/health`);
  const deviceCount = db.prepare("SELECT COUNT(*) as n FROM devices").get().n;
  console.log(`[OrchardPatch Server] Devices in DB: ${deviceCount}`);
});
