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

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: "2mb" }));

// ─── Auth ─────────────────────────────────────────────────────────────────────

const SERVER_TOKEN = process.env.SERVER_TOKEN || "dev-token-change-me";

function authMiddleware(req, res, next) {
  const token = req.headers["x-orchardpatch-token"];
  if (token !== SERVER_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// ─── Agent Check-in ───────────────────────────────────────────────────────────

/**
 * POST /checkin
 * Called by agents every 15 minutes with their full inventory.
 * Upserts device + app records.
 */
app.post("/checkin", authMiddleware, (req, res) => {
  const { device, apps, agentVersion, collectedAt } = req.body;

  if (!device?.hostname) {
    return res.status(400).json({ error: "device.hostname is required" });
  }

  const deviceId = device.serial
    ? `device-${device.serial}`
    : `device-${device.hostname.replace(/[^a-zA-Z0-9]/g, "-")}`;

  const now = collectedAt || new Date().toISOString();

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
  `).run(deviceId, device.hostname, device.serial || null, device.model || null,
    device.osVersion || null, device.ram || null, device.cpu || null,
    agentVersion || "unknown", now);

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
          app.bundleId || "",
          app.name || "",
          app.version || null,
          app.latestVersion || null,
          app.isOutdated ? 1 : 0,
          app.installomatorLabel || null,
          app.path || null,
          app.source || null,
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

// Health check
app.get("/health", (req, res) => {
  const deviceCount = db.prepare("SELECT COUNT(*) as n FROM devices").get().n;
  const appCount = db.prepare("SELECT COUNT(*) as n FROM apps").get().n;
  res.json({ status: "ok", server: "orchardpatch", deviceCount, appCount });
});

// Get all devices
app.get("/devices", authMiddleware, (req, res) => {
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
app.get("/devices/:id", authMiddleware, (req, res) => {
  const device = db.prepare("SELECT * FROM devices WHERE id = ?").get(req.params.id);
  if (!device) return res.status(404).json({ error: "Device not found" });

  const apps = db.prepare(`
    SELECT * FROM apps WHERE device_id = ? ORDER BY name
  `).all(req.params.id);

  res.json({ ...device, apps });
});

// Get all apps across fleet
app.get("/apps", authMiddleware, (req, res) => {
  const { outdated } = req.query;
  let query = "SELECT a.*, d.hostname as device_name FROM apps a JOIN devices d ON d.id = a.device_id";
  if (outdated === "true") query += " WHERE a.is_outdated = 1";
  query += " ORDER BY a.name";

  const apps = db.prepare(query).all();
  res.json({ apps });
});

// Fleet summary stats
app.get("/stats", authMiddleware, (req, res) => {
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
app.post("/patch-jobs", authMiddleware, (req, res) => {
  const { jobId, deviceId, bundleId, appName, label, mode, status, exitCode, error, log, createdAt, startedAt, completedAt } = req.body;

  if (!jobId || !appName) return res.status(400).json({ error: "jobId and appName required" });

  db.prepare(`
    INSERT INTO patch_jobs (id, device_id, bundle_id, app_name, label, mode, status, exit_code, error, log, created_at, started_at, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      status = excluded.status,
      exit_code = excluded.exit_code,
      error = excluded.error,
      log = excluded.log,
      completed_at = excluded.completed_at
  `).run(jobId, deviceId || "unknown", bundleId || null, appName, label || "", mode || "managed",
    status || "unknown", exitCode ?? null, error || null,
    Array.isArray(log) ? log.join("\n") : (log || null),
    createdAt || new Date().toISOString(), startedAt || null, completedAt || null);

  res.json({ ok: true });
});

// Get patch job history
app.get("/patch-jobs", authMiddleware, (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const jobs = db.prepare(`
    SELECT pj.*, d.hostname as device_name
    FROM patch_jobs pj
    LEFT JOIN devices d ON d.id = pj.device_id
    ORDER BY pj.created_at DESC
    LIMIT ?
  `).all(limit);
  res.json({ jobs });
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[OrchardPatch Server] Listening on port ${PORT}`);
  console.log(`[OrchardPatch Server] Health: http://localhost:${PORT}/health`);
  const deviceCount = db.prepare("SELECT COUNT(*) as n FROM devices").get().n;
  console.log(`[OrchardPatch Server] Devices in DB: ${deviceCount}`);
});
