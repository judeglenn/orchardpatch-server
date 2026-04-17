/**
 * OrchardPatch — Version Sync Route
 * POST /api/version-sync — fans out to online agents, gets version data, upserts into latest_versions
 * GET  /api/version-sync — returns cached version data
 */

const express = require("express");
const router = express.Router();
const pool = require("../db");

// POST /api/version-sync
router.post("/", async (req, res) => {
  const { labels } = req.body;
  if (!Array.isArray(labels) || labels.length === 0) {
    return res.status(400).json({ error: "labels array is required" });
  }

  // Find online agents (seen in last 10 min) with a registered agent_url
  let agents;
  try {
    const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const result = await pool.query(
      "SELECT id, hostname, agent_url FROM devices WHERE agent_url IS NOT NULL AND last_seen > $1 LIMIT 10",
      [cutoff]
    );
    agents = result.rows;
  } catch (err) {
    console.error("[version-sync] DB error:", err.message);
    return res.status(500).json({ error: "DB error fetching agents" });
  }

  if (agents.length === 0) {
    return res.status(503).json({ error: "No online agents available" });
  }

  const agent = agents[0];
  const agentToken = process.env.AGENT_TOKEN || process.env.SERVER_TOKEN;

  let versionResults;
  try {
    const { default: fetch } = await import("node-fetch");
    const response = await fetch(`${agent.agent_url}/version-check`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-orchardpatch-token": agentToken,
      },
      body: JSON.stringify({ labels }),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`Agent returned ${response.status}`);
    versionResults = await response.json();
  } catch (err) {
    return res.status(502).json({ error: `Agent request failed: ${err.message}` });
  }

  // Upsert results into latest_versions
  const now = new Date().toISOString();
  const upserted = [];
  for (const [label, data] of Object.entries(versionResults)) {
    try {
      await pool.query(`
        INSERT INTO latest_versions (label, latest_version, last_checked, error)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT(label) DO UPDATE SET
          latest_version = EXCLUDED.latest_version,
          last_checked = EXCLUDED.last_checked,
          error = EXCLUDED.error
      `, [label, data.version || null, now, data.error || null]);
      upserted.push(label);
    } catch (err) {
      console.error(`[version-sync] DB upsert failed for ${label}:`, err.message);
    }
  }

  res.json({ ok: true, agent: agent.hostname, upserted, total: upserted.length });
});

// GET /api/version-sync — return cached versions
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM latest_versions ORDER BY label");
    res.json({ versions: result.rows });
  } catch (err) {
    console.error("[version-sync] GET error:", err.message);
    res.status(500).json({ error: "DB error" });
  }
});

module.exports = router;
