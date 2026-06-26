'use strict';
const pool = require('../db');

async function isIdentityTrusted(bundleId, label) {
  if (!bundleId || !label) {
    return { trusted: false, reason: 'missing bundle_id or label for trust check' };
  }

  const identityResult = await pool.query(
    'SELECT installomator_label, curated FROM app_identity ' +
    'WHERE bundle_id = $1 AND installomator_label = $2',
    [bundleId, label]
  );

  if (identityResult.rows.length === 0) {
    return {
      trusted: false,
      reason: 'label ' + label + ' is not associated with bundle_id ' + bundleId + ' in app_identity'
    };
  }

  const row = identityResult.rows[0];
  if (row.curated === true) {
    return { trusted: true, reason: 'curated row' };
  }

  const conflictResult = await pool.query(
    'SELECT 1 FROM identity_conflicts ' +
    'WHERE bundle_id = $1 AND source = $2 AND token = $3 AND resolved = false',
    [bundleId, 'installomator_label', label]
  );

  if (conflictResult.rows.length > 0) {
    return {
      trusted: false,
      reason: 'identity unverified for this app -- label ' + label +
        ' has an unresolved collision for bundle_id ' + bundleId +
        '. Patching is disabled until its label is confirmed.'
    };
  }

  return { trusted: true, reason: 'label present in app_identity, no unresolved conflicts' };
}

module.exports = { isIdentityTrusted };
