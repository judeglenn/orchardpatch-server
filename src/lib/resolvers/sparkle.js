'use strict';
const { XMLParser } = require('fast-xml-parser');

// Returns the sparkle:version build number (monotonic integer) for sort purposes.
// Build numbers are reliable sort keys regardless of feed item ordering
// (some feeds are ascending, some descending — do not trust order).
function itemBuildNumber(item) {
  const enc = item.enclosure;
  const raw = enc?.['@_sparkle:version'] || item['sparkle:version'] || null;
  if (!raw) return -1;
  const n = parseInt(raw, 10);
  return isNaN(n) ? -1 : n;
}

// Returns the display version (shortVersionString) from an item.
// Prefers sparkle:shortVersionString (human-readable, e.g. "12.8") over
// sparkle:version (internal build number, e.g. "282010"). Falls back to
// sparkle:version only when shortVersionString is absent or empty — some feeds
// only populate one field.
function itemDisplayVersion(item) {
  const enc = item.enclosure;
  return (
    enc?.['@_sparkle:shortVersionString'] ||
    item['sparkle:shortVersionString'] ||
    enc?.['@_sparkle:version'] ||
    item['sparkle:version'] ||
    null
  );
}

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

      const channel = parsed?.rss?.channel || parsed?.feed;
      if (!channel) continue;

      // Normalize items to array. Feeds may be in ascending or descending order —
      // do NOT use items[0]. Select newest by sparkle:version (build number,
      // monotonic integer), then read shortVersionString from that item.
      const rawItems = channel.item;
      const itemList = Array.isArray(rawItems) ? rawItems : (rawItems ? [rawItems] : []);
      if (itemList.length === 0) continue;

      const newestItem = itemList.reduce((best, candidate) =>
        itemBuildNumber(candidate) > itemBuildNumber(best) ? candidate : best
      );

      const version = itemDisplayVersion(newestItem);

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
