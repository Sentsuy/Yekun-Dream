const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { StorageLocal, DEFAULT_SETTINGS } = require('../storage-local');

// ── 1. Settings default test ────────────────────────────────
assert.ok(Array.isArray(DEFAULT_SETTINGS.allowedDomains), 'DEFAULT_SETTINGS must include allowedDomains array');

// ── 2. StorageLocal domain matching test ────────────────────
const mockSettings = {
  enableFloatingButton: true,
  allowedDomains: ['mangadex.org', 'reaperscans.com', 'neoxscans.net']
};

assert.strictEqual(StorageLocal.isDomainAllowed('mangadex.org', mockSettings), true);
assert.strictEqual(StorageLocal.isDomainAllowed('www.mangadex.org', mockSettings), true);
assert.strictEqual(StorageLocal.isDomainAllowed('sub.mangadex.org', mockSettings), true);
assert.strictEqual(StorageLocal.isDomainAllowed('google.com', mockSettings), false);
assert.strictEqual(StorageLocal.isDomainAllowed('youtube.com', mockSettings), false);

// Empty or missing settings
assert.strictEqual(StorageLocal.isDomainAllowed('mangadex.org', {}), false);
assert.strictEqual(StorageLocal.isDomainAllowed('mangadex.org', { allowedDomains: [] }), false);

// ── 3. Content.js code inspection ───────────────────────────
const contentCode = fs.readFileSync(path.resolve(__dirname, '../content.js'), 'utf8');
assert.ok(contentCode.includes('allowedDomains'), 'content.js must check allowedDomains');
assert.ok(contentCode.includes('isDomainAllowed'), 'content.js must use isDomainAllowed check');

// ── 4. Popup HTML & JS inspection ───────────────────────────
const popupHtml = fs.readFileSync(path.resolve(__dirname, '../popup.html'), 'utf8');
const popupJs   = fs.readFileSync(path.resolve(__dirname, '../popup.js'), 'utf8');

assert.ok(popupHtml.includes('toggleCurrentSite') || popupHtml.includes('currentSiteRow'), 'popup.html must have quick toggle for current site');
assert.ok(popupHtml.includes('inputAllowedDomains'), 'popup.html settings must have inputAllowedDomains');
assert.ok(popupJs.includes('toggleCurrentSite') || popupJs.includes('currentDomain'), 'popup.js must handle current site toggle');

console.log('✓ Allowed domains whitelist test passed successfully!');
