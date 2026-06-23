'use strict';

const CASK_JSON_URL = 'https://formulae.brew.sh/api/cask.json';

function normalizeStr(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function fetchCasks() {
  const { default: fetch } = await import('node-fetch');
  const resp = await fetch(CASK_JSON_URL, { signal: AbortSignal.timeout(30000) });
  if (!resp.ok) throw new Error('Homebrew cask fetch failed: ' + resp.status);
  return resp.json();
}

function buildCaskIndex(casks) {
  const byToken = new Map();
  const byAppName = new Map();
  const byName = new Map();

  for (const cask of casks) {
    byToken.set(cask.token, cask);

    for (const artifact of (cask.artifacts || [])) {
      if (Array.isArray(artifact.app)) {
        for (const appFile of artifact.app) {
          const norm = normalizeStr(appFile.replace(/\.app$/i, ''));
          if (norm && !byAppName.has(norm)) byAppName.set(norm, cask);
        }
      }
    }

    for (const n of (cask.name || [])) {
      const norm = normalizeStr(n);
      if (norm && !byName.has(norm)) byName.set(norm, cask);
    }
  }

  return { byToken, byAppName, byName };
}

function findCask(identity, index) {
  // Priority 1: installomator_label exact match against cask token (most reliable)
  if (identity.installomator_label) {
    const cask = index.byToken.get(identity.installomator_label);
    if (cask) return cask;
  }

  const norm = normalizeStr(identity.app_name);

  // Priority 2: normalized app_name against artifact .app bundle name
  const byApp = index.byAppName.get(norm);
  if (byApp) return byApp;

  // Priority 3: normalized app_name against cask name array entries
  const byName = index.byName.get(norm);
  if (byName) return byName;

  // Priority 4: normalized app_name against cask token (weakest)
  const byTok = index.byToken.get(norm);
  if (byTok) return byTok;

  return null;
}

async function runHomebrew(pool) {
  console.log('[homebrew-resolver] starting');

  let casks;
  try {
    casks = await fetchCasks();
    console.log('[homebrew-resolver] fetched ' + casks.length + ' casks');
  } catch (err) {
    console.error('[homebrew-resolver] fetch failed:', err.message);
    return;
  }

  const index = buildCaskIndex(casks);

  const { rows: identities } = await pool.query(
    'SELECT bundle_id, app_name, installomator_label FROM app_identity'
  );

  let matched = 0;
  let resolved = 0;

  for (const identity of identities) {
    const cask = findCask(identity, index);
    if (!cask) continue;
    matched++;

    // Update homebrew_cask on app_identity -- never overwrite curated rows
    await pool.query(
      'UPDATE app_identity SET homebrew_cask = $1, last_derived = now() WHERE bundle_id = $2 AND curated = false',
      [cask.token, identity.bundle_id]
    );

    if (!cask.version) continue;

    const candidates = JSON.stringify([{
      source: 'homebrew',
      token: cask.token,
      version: cask.version,
      url: cask.homepage || ''
    }]);

    await pool.query(
      'INSERT INTO resolved_versions (bundle_id, latest_available, source, source_url, candidates, conflict, resolved_at)' +
      ' VALUES ($1, $2, $3, $4, $5, false, now())' +
      ' ON CONFLICT (bundle_id) DO UPDATE SET' +
      ' latest_available = CASE WHEN EXCLUDED.latest_available IS NOT NULL AND EXCLUDED.latest_available <> \'\'' +
      ' THEN EXCLUDED.latest_available ELSE resolved_versions.latest_available END,' +
      ' source = EXCLUDED.source,' +
      ' source_url = EXCLUDED.source_url,' +
      ' candidates = EXCLUDED.candidates,' +
      ' conflict = false,' +
      ' resolved_at = now()',
      [identity.bundle_id, cask.version, cask.homepage || '', candidates]
    );
    resolved++;
  }

  console.log('[homebrew-resolver] matched=' + matched + ' resolved=' + resolved + ' of ' + identities.length);
}

module.exports = { runHomebrew };
