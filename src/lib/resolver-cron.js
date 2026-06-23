'use strict';
const { runHomebrew } = require('./resolvers/homebrew');

function startResolverCron(pool) {
  // First run 30s after startup -- lets identity bootstrap settle first
  setTimeout(function() {
    runHomebrew(pool).catch(function(err) {
      console.error('[resolver-cron] homebrew error:', err.message);
    });
  }, 30000);

  // Then once every 24 hours
  setInterval(function() {
    runHomebrew(pool).catch(function(err) {
      console.error('[resolver-cron] homebrew error:', err.message);
    });
  }, 24 * 60 * 60 * 1000);

  console.log('[resolver-cron] started (daily, first run in 30s)');
}

module.exports = { startResolverCron };
