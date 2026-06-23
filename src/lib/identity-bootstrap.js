/**
 * OrchardPatch — Identity Bootstrap (Phase A)
 * Derives app_identity rows from installed apps data.
 */

/**
 * bootstrapIdentity(pool)
 * Upserts app_identity rows from the apps table.
 * Only touches non-curated rows. Safe to call at startup and after syncs.
 *
 * @param {import('pg').Pool} pool
 */
async function bootstrapIdentity(pool) {
  const result = await pool.query(`
    INSERT INTO app_identity (bundle_id, app_name, installomator_label, last_derived)
    SELECT DISTINCT ON (bundle_id)
      bundle_id,
      name,
      installomator_label,
      now()
    FROM apps
    WHERE bundle_id IS NOT NULL
      AND bundle_id <> ''
      AND bundle_id NOT LIKE 'com.apple.%'
      AND installomator_label IS NOT NULL
    ORDER BY bundle_id, last_seen DESC
    ON CONFLICT (bundle_id) DO UPDATE SET
      app_name = EXCLUDED.app_name,
      installomator_label = COALESCE(EXCLUDED.installomator_label, app_identity.installomator_label),
      last_derived = now()
    WHERE NOT app_identity.curated
  `);

  console.log(`[identity bootstrap] ${result.rowCount} rows upserted from installed apps`);
}

module.exports = { bootstrapIdentity };
