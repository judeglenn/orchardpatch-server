'use strict';

async function resolveGitHub(pool) {
  const { rows } = await pool.query(
    'SELECT bundle_id, app_name, github_repo FROM app_identity WHERE github_repo IS NOT NULL'
  );

  const results = new Map();

  if (rows.length === 0) {
    console.log('[github-resolver] no github_repo entries yet, skipping');
    return results;
  }

  for (const row of rows) {
    try {
      const { default: fetch } = await import('node-fetch');
      const url = 'https://api.github.com/repos/' + row.github_repo + '/releases/latest';
      const resp = await fetch(url, {
        headers: {
          'User-Agent': 'OrchardPatch/1.0',
          'Accept': 'application/vnd.github+json',
          ...(process.env.GITHUB_TOKEN ? { Authorization: 'Bearer ' + process.env.GITHUB_TOKEN } : {})
        }
      });

      if (!resp.ok) continue;

      const data = await resp.json();
      const tag = data.tag_name;
      if (!tag) continue;

      // Strip leading v from tag names
      const version = tag.replace(/^v/i, '').trim();
      if (!/^\d+[\.\d]*/.test(version)) continue;

      results.set(row.bundle_id, {
        source: 'github',
        repo: row.github_repo,
        version,
        url: data.html_url || ''
      });
    } catch (err) {
      console.error('[github-resolver] error for ' + row.app_name + ':', err.message);
    }
  }

  console.log('[github-resolver] resolved=' + results.size + ' of ' + rows.length);
  return results;
}

module.exports = { resolveGitHub };
