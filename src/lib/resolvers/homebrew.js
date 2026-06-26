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
          if (typeof appFile !== 'string') continue;
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

async function resolveHomebrew(pool) {
  console.log('[homebrew-resolver] starting');

  let casks;
  try {
    casks = await fetchCasks();
    console.log('[homebrew-resolver] fetched ' + casks.length + ' casks');
  } catch (err) {
    console.error('[homebrew-resolver] fetch failed:', err.message);
    return new Map();
  }

  const index = buildCaskIndex(casks);

  const { rows: identities } = await pool.query(
    'SELECT bundle_id, app_name, installomator_label FROM app_identity'
  );

  const results = new Map();
  let matched = 0;

  for (const identity of identities) {
    const cask = findCask(identity, index);
    if (!cask) continue;
    matched++;

    // Update homebrew_cask on app_identity -- never overwrite curated rows or MAS apps
    await pool.query(
      'UPDATE app_identity SET homebrew_cask = $1, last_derived = now() WHERE bundle_id = $2 AND curated = false AND NOT EXISTS (SELECT 1 FROM apps WHERE bundle_id = $2 AND source = $3)',
      [cask.token, identity.bundle_id, 'mas']
    );

    if (!cask.version) continue;

    results.set(identity.bundle_id, {
      source: 'homebrew',
      token: cask.token,
      version: cask.version,
      url: cask.homepage || ''
    });
  }

  console.log('[homebrew-resolver] matched=' + matched + ' of ' + identities.length);
  return results;
}

module.exports = { resolveHomebrew };
