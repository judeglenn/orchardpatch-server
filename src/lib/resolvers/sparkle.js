'use strict';
const { XMLParser } = require('fast-xml-parser');

async function resolveSparkle(pool) {
  const { rows } = await pool.query(
    'SELECT bundle_id, app_name, sparkle_feed_url FROM app_identity WHERE sparkle_feed_url IS NOT NULL'
  );

  const results = new Map();

  for (const row of rows) {
    try {
      const { default: fetch } = await import('node-fetch');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const resp = await fetch(row.sparkle_feed_url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!resp.ok) continue;

      const xml = await resp.text();
      const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
      const parsed = parser.parse(xml);

      // Navigate to the first item in the channel
      const channel = parsed?.rss?.channel || parsed?.feed;
      if (!channel) continue;

      const items = channel.item;
      const item = Array.isArray(items) ? items[0] : items;
      if (!item) continue;

      // Sparkle version is in enclosure@sparkle:version or item@sparkle:version
      const enclosure = item.enclosure;
      const version =
        enclosure?.['@_sparkle:version'] ||
        enclosure?.['@_sparkle:shortVersionString'] ||
        item['sparkle:version'] ||
        item['sparkle:shortVersionString'] ||
        null;

      if (!version || typeof version !== 'string') continue;
      if (!/^\d+[\.\d]*/.test(version)) continue;

      results.set(row.bundle_id, {
        source: 'sparkle',
        feedUrl: row.sparkle_feed_url,
        version: version.trim(),
        url: row.sparkle_feed_url
      });
    } catch (err) {
      console.error('[sparkle-resolver] error for ' + row.app_name + ':', err.message);
    }
  }

  console.log('[sparkle-resolver] resolved=' + results.size + ' of ' + rows.length);
  return results;
}

module.exports = { resolveSparkle };
