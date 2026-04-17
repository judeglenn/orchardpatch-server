/**
 * OrchardPatch — Version Sync Route
 *
 * Agent-push model: agents POST their version check results up to the server.
 * Server is a pure store — additive upserts, no fan-out, no server-to-agent routing.
 *
 * POST /api/version-sync/ingest  — agent (or Routines) pushes version data
 * GET  /api/version-sync         — returns full cached version table
 * GET  /api/version-sync/:label  — returns cached data for a single label
 */

const express = require("express");
const router = express.Router();
const pool = require("../db");

// POST /api/version-sync/ingest
// Accepts a map of { label -> { version, error } } and upserts additively.
// Existing rows for labels NOT in this payload are untouched.
router.post("/ingest", async (req, res) => {
  const { results, source } = req.body;

  if (!results || typeof results !== "object" || Array.isArray(results)) {
    return res.status(400).json({ error: "results must be an object mapping label -> { version, error }" });
  }

  const entries = Object.entries(results);
  if (entries.length === 0) {
    return res.status(400).json({ error: "results must not be empty" });
  }
  if (entries.length > 500) {
    return res.status(400).json({ error: "Too many labels (max 500 per ingest)" });
  }

  const now = new Date().toISOString();
  const upserted = [];
  const errors = [];

  for (const [label, data] of entries) {
    if (typeof label !== "string" || label.length > 100) {
      errors.push({ label, error: "invalid label" });
      continue;
    }
    try {
      await pool.query(`
        INSERT INTO latest_versions (label, latest_version, last_checked, error)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT(label) DO UPDATE SET
          latest_version = EXCLUDED.latest_version,
          last_checked   = EXCLUDED.last_checked,
          error          = EXCLUDED.error
      `, [
        label,
        data.version ? String(data.version).slice(0, 100) : null,
        now,
        data.error ? String(data.error).slice(0, 500) : null,
      ]);
      upserted.push(label);
    } catch (err) {
      console.error(`[version-sync] DB upsert failed for ${label}:`, err.message);
      errors.push({ label, error: err.message });
    }
  }

  console.log(`[version-sync] Ingest from ${source || "unknown"}: ${upserted.length} upserted, ${errors.length} errors`);
  res.json({ ok: true, upserted: upserted.length, errors: errors.length, timestamp: now });
});

// GET /api/version-sync — full cache
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM latest_versions ORDER BY label");
    res.json({ versions: result.rows, count: result.rows.length });
  } catch (err) {
    console.error("[version-sync] GET error:", err.message);
    res.status(500).json({ error: "DB error" });
  }
});

// GET /api/version-sync/:label — single label lookup
router.get("/:label", async (req, res) => {
  const label = String(req.params.label).slice(0, 100);
  try {
    const result = await pool.query(
      "SELECT * FROM latest_versions WHERE label = $1",
      [label]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Label not found in cache" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("[version-sync] GET /:label error:", err.message);
    res.status(500).json({ error: "DB error" });
  }
});

module.exports = router;
