/**
 * OrchardPatch — Catalog Sync Route
 * POST /api/catalog-sync — fetches Installomator Labels/*.sh from GitHub, parses + upserts into app_catalog
 * GET  /api/catalog-sync  — browse the app catalog (alias: GET /api/catalog)
 */

const express = require("express");
const router = express.Router();
const pool = require("../db");
const { bootstrapIdentity } = require("../lib/identity-bootstrap");

const INSTALLOMATOR_TREE_API = "https://api.github.com/repos/Installomator/Installomator/git/trees/main?recursive=1";
const RAW_BASE = "https://raw.githubusercontent.com/Installomator/Installomator/main";
const LABELS_PREFIX = "fragments/labels/"; // repo restructured — labels moved from Labels/ to fragments/labels/

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
    const match = content.match(new RegExp(`^\\s*${key}="?([^"\\n]+)"?`, "m"));
    return match ? match[1].trim() : null;
  };
  // downloadURL may be quoted with double or single quotes, or unquoted.
  // Dynamic values (curl, variable expansion) won't match — resolves to null (correct).
  const downloadMatch = content.match(/^\s*downloadURL=["']?([^"'\n\s${}]+)["']?/m);
  return {
    app_name: get("name"),
    bundle_id: get("bundleID"),
    expected_team: get("expectedTeamID"),
    download_url: downloadMatch ? downloadMatch[1].trim() : null,
  };
}

// POST /api/catalog-sync
router.post("/", async (req, res) => {
  const token = process.env.GITHUB_TOKEN;
  const limit = Math.min(parseInt(req.body?.limit) || 2000, 2000);

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
    .filter(f => f.path.startsWith(LABELS_PREFIX) && f.path.endsWith(".sh") && f.type === "blob")
    .slice(0, limit);

  console.log(`[catalog-sync] Label files found after filter: ${labelFiles.length} (limit: ${limit})`);

  if (labelFiles.length === 0) {
    return res.status(502).json({ error: "No label files found in Installomator repo" });
  }

  const results = { upserted: 0, skipped: 0, errors: 0 };

  for (const file of labelFiles) {
    const label = file.path.replace(LABELS_PREFIX, "").replace(".sh", "");
    try {
      const content = await fetchText(`${RAW_BASE}/${file.path}`, token);
      const parsed = parseFragment(content);

      await pool.query(`
        INSERT INTO app_catalog (label, app_name, bundle_id, expected_team, download_url)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT(label) DO UPDATE SET
          app_name = EXCLUDED.app_name,
          bundle_id = EXCLUDED.bundle_id,
          expected_team = EXCLUDED.expected_team,
          download_url = EXCLUDED.download_url
      `, [label, parsed.app_name, parsed.bundle_id, parsed.expected_team, parsed.download_url]);
      results.upserted++;
    } catch (err) {
      console.error(`[catalog-sync] Failed ${label}:`, err.message);
      results.errors++;
    }
  }

  try { await bootstrapIdentity(pool); } catch (e) { console.error('identity bootstrap (catalog-sync):', e.message); }

  res.json({ ok: true, ...results, total: labelFiles.length });
});

// GET /api/catalog-sync (or /api/catalog) — browse the catalog with pagination
router.get('/', async (req, res) => {
  try {
    var q = req.query.search ? req.query.search.trim() : '';
    var limit = Math.min(parseInt(req.query.limit) || 50, 200);
    var offset = parseInt(req.query.offset) || 0;

    var whereSql = '';
    var countParams = [];
    var dataParams = [];

    if (q) {
      whereSql = ' WHERE (label ILIKE $1 OR app_name ILIKE $1)';
      countParams = ['%' + q + '%'];
      dataParams = ['%' + q + '%', limit, offset];
    } else {
      dataParams = [limit, offset];
    }

    var countSql = 'SELECT COUNT(*) FROM app_catalog' + whereSql;
    var countResult = await pool.query(countSql, countParams);
    var total = parseInt(countResult.rows[0].count);

    var dataSql;
    if (q) {
      dataSql = 'SELECT ac.label, ac.app_name, ac.bundle_id, ac.expected_team, ac.last_synced, COALESCE(ic.has_conflict, false) AS has_conflict FROM app_catalog ac LEFT JOIN (SELECT token, true AS has_conflict FROM identity_conflicts WHERE source = \'installomator_label\' AND resolved = false GROUP BY token) ic ON ac.label = ic.token WHERE (ac.label ILIKE $1 OR ac.app_name ILIKE $1) ORDER BY ac.app_name ASC LIMIT $2 OFFSET $3';
    } else {
      dataSql = 'SELECT ac.label, ac.app_name, ac.bundle_id, ac.expected_team, ac.last_synced, COALESCE(ic.has_conflict, false) AS has_conflict FROM app_catalog ac LEFT JOIN (SELECT token, true AS has_conflict FROM identity_conflicts WHERE source = \'installomator_label\' AND resolved = false GROUP BY token) ic ON ac.label = ic.token ORDER BY ac.app_name ASC LIMIT $1 OFFSET $2';
    }

    var dataResult = await pool.query(dataSql, dataParams);

    res.json({
      items: dataResult.rows,
      total: total,
      limit: limit,
      offset: offset
    });
  } catch (err) {
    console.error('[catalog-sync] GET error:', err.message);
    res.status(500).json({ error: 'DB error' });
  }
});

module.exports = router;
