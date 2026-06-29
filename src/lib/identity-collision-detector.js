'use strict';
const pool = require('../db');

async function detectAndRefuseCollisions(column) {
  const rows = await pool.query(
    'SELECT ' + column + ' AS token, array_agg(DISTINCT bundle_id) AS bundle_ids ' +
    'FROM app_identity ' +
    'WHERE ' + column + ' IS NOT NULL AND (curated IS NULL OR curated = false) ' +
    'GROUP BY ' + column + ' ' +
    'HAVING COUNT(DISTINCT bundle_id) > 1'
  );

  for (const row of rows.rows) {
    const token = row.token;
    const bundleIds = row.bundle_ids;

    await pool.query(
      'UPDATE app_identity SET ' + column + ' = NULL ' +
      'WHERE ' + column + ' = $1 AND (curated IS NULL OR curated = false)',
      [token]
    );

    for (const bundleId of bundleIds) {
      const competing = bundleIds.filter(function(id) { return id !== bundleId; });
      await pool.query(
        'INSERT INTO identity_conflicts (bundle_id, source, token, competing_bundle_ids) ' +
        'VALUES ($1, $2, $3, $4) ON CONFLICT (bundle_id, source, token) DO NOTHING',
        [bundleId, column, token, competing]
      );
    }

    console.log('[identity] collision: ' + column + '=' + token +
      ' contested by [' + bundleIds.join(', ') + '] -- nulled for all non-curated rows');
  }
}

async function resolveSettledConflicts() {
  const result = await pool.query(`
    UPDATE identity_conflicts ic
    SET resolved = true
    WHERE ic.resolved = false
    AND (
      SELECT COUNT(DISTINCT ai.bundle_id)
      FROM app_identity ai
      WHERE ai.curated = false
      AND (
        (ic.source = 'homebrew_cask'
         AND ai.homebrew_cask = ic.token)
        OR
        (ic.source = 'installomator_label'
         AND ai.installomator_label = ic.token)
      )
    ) < 2
  `);
  if (result.rowCount > 0) {
    console.log('[identity] resolved', result.rowCount,
      'settled conflict(s)');
  }
}

async function runCollisionDetector() {
  await detectAndRefuseCollisions('homebrew_cask');
  await detectAndRefuseCollisions('installomator_label');
  await resolveSettledConflicts();
}

module.exports = { runCollisionDetector };
