'use strict';
const { resolveHomebrew } = require('./resolvers/homebrew');
const { resolveSparkle } = require('./resolvers/sparkle');
const { resolveGitHub } = require('./resolvers/github');
const { runCollisionDetector } = require('./identity-collision-detector');

// Trust order: higher index = higher trust
const TRUST_ORDER = ['homebrew', 'github', 'sparkle'];

function parseMajorMinor(version) {
  const parts = (version || '').split(',')[0].split('.');
  return {
    major: parseInt(parts[0]) || 0,
    minor: parseInt(parts[1]) || 0
  };
}

function hasConflict(candidates) {
  if (candidates.length < 2) return false;
  const versions = candidates.map(c => parseMajorMinor(c.version));
  const first = versions[0];
  return versions.some(v => v.major !== first.major || v.minor !== first.minor);
}

function pickWinner(candidates) {
  // Higher trust index wins
  return candidates.reduce((best, c) => {
    return TRUST_ORDER.indexOf(c.source) > TRUST_ORDER.indexOf(best.source) ? c : best;
  });
}

async function runAllResolvers(pool) {
  console.log('[resolver-cron] starting full resolver run');

  const [homebrewMap, sparkleMap, githubMap] = await Promise.all([
    resolveHomebrew(pool).catch(err => { console.error('[resolver-cron] homebrew error:', err.message); return new Map(); }),
    resolveSparkle(pool).catch(err => { console.error('[resolver-cron] sparkle error:', err.message); return new Map(); }),
    resolveGitHub(pool).catch(err => { console.error('[resolver-cron] github error:', err.message); return new Map(); })
  ]);

  // Merge all bundle_ids across all sources
  const allBundleIds = new Set([...homebrewMap.keys(), ...sparkleMap.keys(), ...githubMap.keys()]);

  let written = 0;

  for (const bundleId of allBundleIds) {
    const candidates = [];
    if (homebrewMap.has(bundleId)) candidates.push(homebrewMap.get(bundleId));
    if (githubMap.has(bundleId)) candidates.push(githubMap.get(bundleId));
    if (sparkleMap.has(bundleId)) candidates.push(sparkleMap.get(bundleId));

    const winner = pickWinner(candidates);
    const conflict = hasConflict(candidates);

    await pool.query(
      'INSERT INTO resolved_versions (bundle_id, latest_available, source, source_url, candidates, conflict, resolved_at)' +
      ' VALUES ($1, $2, $3, $4, $5, $6, now())' +
      ' ON CONFLICT (bundle_id) DO UPDATE SET' +
      ' latest_available = CASE WHEN EXCLUDED.latest_available IS NOT NULL AND EXCLUDED.latest_available <> \'\'' +
      ' THEN EXCLUDED.latest_available ELSE resolved_versions.latest_available END,' +
      ' source = EXCLUDED.source,' +
      ' source_url = EXCLUDED.source_url,' +
      ' candidates = EXCLUDED.candidates,' +
      ' conflict = EXCLUDED.conflict,' +
      ' resolved_at = now()',
      [bundleId, winner.version, winner.source, winner.url, JSON.stringify(candidates), conflict]
    );
    written++;
  }

  console.log('[resolver-cron] done. written=' + written + ' rows');

  await runCollisionDetector();
  console.log('[resolver-cron] collision detector complete');
}

function startResolverCron(pool) {
  setTimeout(function() {
    runAllResolvers(pool).catch(function(err) {
      console.error('[resolver-cron] run error:', err.message);
    });
  }, 30000);

  setInterval(function() {
    runAllResolvers(pool).catch(function(err) {
      console.error('[resolver-cron] run error:', err.message);
    });
  }, 24 * 60 * 60 * 1000);

  console.log('[resolver-cron] started (daily, first run in 30s)');
}

module.exports = { startResolverCron };
