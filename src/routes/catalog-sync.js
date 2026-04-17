/**
 * OrchardPatch — Catalog Sync Route
 * POST /api/catalog-sync — fetches Installomator Labels/*.sh from GitHub, parses + upserts into app_catalog
 * GET  /api/catalog-sync  — browse the app catalog (alias: GET /api/catalog)
 */

const express = require("express");
const router = express.Router();
const pool = require("../db");

const INSTALLOMATOR_TREE_API = "https://api.github.com/repos/Installomator/Installomator/git/trees/main?recursive=1";
const RAW_BASE = "https://raw.githubusercontent.com/Installomator/Installomator/main";

async function fetchJson(url, token) {
  const { default: fetch } = await import("node-fetch");
  const headers = { "User-Agent": "OrchardPatch/1.0" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res.json();
}

async function fetchText(url, token) {
  const { default: fetch } = await import("node-fetch");
  const headers = { "User-Agent": "OrchardPatch/1.0" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function parseFragment(content) {
  const get = (key) => {
    const match = content.match(new RegExp(`^${key}="?([^"\\n]+)"?`, "m"));
    return match ? match[1].trim() : null;
  };
  return {
    app_name: get("name"),
    bundle_id: get("bundleID"),
    expected_team: get("expectedTeamID"),
  };
}

// POST /api/catalog-sync
router.post("/", async (req, res) => {
  const token = process.env.GITHUB_TOKEN;
  const limit = Math.min(parseInt(req.body?.limit) || 100, 1200);

  let tree;
  try {
    const data = await fetchJson(INSTALLOMATOR_TREE_API, token);
    console.log(`[catalog-sync] GitHub API response — token present: ${!!token}, truncated: ${data.truncated}, tree length: ${data.tree?.length ?? 'N/A'}, top-level keys: ${Object.keys(data).join(', ')}`);
    if (data.tree?.length > 0) {
      console.log(`[catalog-sync] First 3 tree entries:`, JSON.stringify(data.tree.slice(0, 3)));
    }
    tree = data.tree || [];
  } catch (err) {
    return res.status(502).json({ error: `GitHub API failed: ${err.message}` });
  }

  const labelFiles = tree
    .filter(f => f.path.startsWith("Labels/") && f.path.endsWith(".sh"))
    .slice(0, limit);

  console.log(`[catalog-sync] Label files found after filter: ${labelFiles.length} (limit: ${limit})`);

  if (labelFiles.length === 0) {
    return res.status(502).json({ error: "No label files found in Installomator repo" });
  }

  const results = { upserted: 0, skipped: 0, errors: 0 };

  for (const file of labelFiles) {
    const label = file.path.replace("Labels/", "").replace(".sh", "");
    try {
      const content = await fetchText(`${RAW_BASE}/${file.path}`, token);
      const parsed = parseFragment(content);

      await pool.query(`
        INSERT INTO app_catalog (label, app_name, bundle_id, expected_team)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT(label) DO UPDATE SET
          app_name = EXCLUDED.app_name,
          bundle_id = EXCLUDED.bundle_id,
          expected_team = EXCLUDED.expected_team
      `, [label, parsed.app_name, parsed.bundle_id, parsed.expected_team]);
      results.upserted++;
    } catch (err) {
      console.error(`[catalog-sync] Failed ${label}:`, err.message);
      results.errors++;
    }
  }

  res.json({ ok: true, ...results, total: labelFiles.length });
});

// GET /api/catalog-sync (or /api/catalog) — browse the catalog
router.get("/", async (req, res) => {
  try {
    const { q } = req.query;
    let result;
    if (q) {
      result = await pool.query(
        "SELECT * FROM app_catalog WHERE app_name ILIKE $1 OR label ILIKE $1 OR bundle_id ILIKE $1 ORDER BY label LIMIT 50",
        [`%${q}%`]
      );
    } else {
      result = await pool.query("SELECT * FROM app_catalog ORDER BY label LIMIT 200");
    }
    res.json({ catalog: result.rows, count: result.rows.length });
  } catch (err) {
    console.error("[catalog-sync] GET error:", err.message);
    res.status(500).json({ error: "DB error" });
  }
});

module.exports = router;
