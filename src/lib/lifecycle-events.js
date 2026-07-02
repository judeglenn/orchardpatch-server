'use strict';
const pool = require('../db');

/**
 * Reconciliation pass: write a 'removed' event for every app row whose
 * last_seen lags behind its device's last_seen by more than 45 minutes,
 * but only when the most recent lifecycle event for that app+device is NOT
 * already 'removed' (prevents duplicate writes on every pass).
 *
 * IS DISTINCT FROM 'removed' handles three cases cleanly:
 *   - NULL  (no prior event -- app predates this table)   -> insert
 *   - 'appeared'                                          -> insert (real transition)
 *   - 'removed'                                           -> skip   (already recorded)
 */
async function recordRemovalEvents() {
  const result = await pool.query(
    'WITH latest_event AS (' +
    '  SELECT DISTINCT ON (bundle_id, device_id)' +
    '    bundle_id, device_id, event_type' +
    '  FROM app_lifecycle_events' +
    '  ORDER BY bundle_id, device_id, occurred_at DESC' +
    ')' +
    ' INSERT INTO app_lifecycle_events' +
    '   (bundle_id, device_id, event_type, app_name, version_at_event)' +
    ' SELECT a.bundle_id, a.device_id, \'removed\', a.name, a.version' +
    ' FROM apps a' +
    ' JOIN devices d ON d.id = a.device_id' +
    ' LEFT JOIN latest_event le' +
    '   ON le.bundle_id = a.bundle_id AND le.device_id = a.device_id' +
    " WHERE a.last_seen < d.last_seen - interval '45 minutes'" +
    "   AND (le.event_type IS DISTINCT FROM 'removed')" +
    ' RETURNING id'
  );
  if (result.rowCount > 0) {
    console.log('[lifecycle] recorded', result.rowCount, 'removal event(s)');
  }
}

module.exports = { recordRemovalEvents };
