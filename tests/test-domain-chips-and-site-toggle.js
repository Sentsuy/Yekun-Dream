const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Mock chrome storage
const storageStore = {};
global.chrome = {
  storage: {
    local: {
      get: (keys, cb) => {
        const res = {};
        keys.forEach(k => { res[k] = storageStore[k]; });
        cb(res);
      },
      set: (items, cb) => {
        Object.assign(storageStore, items);
        if (cb) cb();
      }
    }
  }
};

const { StorageLocal } = require('../storage-local');

console.log('Testing Domain Chips & Floating Button Activation...');

async function runTests() {
  // ── 1. StorageLocal.setDomainAllowed logic tests ─────────────
  // Initial state: button disabled, domain blocked
  await StorageLocal.saveSettings({
    enableFloatingButton: false,
    allowedDomains: [],
    blockedDomains: ['mangadex.org', 'youtube.com']
  });

  // Enable mangadex.org
  const updated1 = await StorageLocal.setDomainAllowed('mangadex.org', true);
  assert.strictEqual(updated1.enableFloatingButton, true, 'Enabling site must set enableFloatingButton to true');
  assert.ok(updated1.allowedDomains.includes('mangadex.org'), 'allowedDomains must contain mangadex.org');
  assert.strictEqual(updated1.blockedDomains.includes('mangadex.org'), false, 'blockedDomains must NOT contain mangadex.org after enabling');
  assert.ok(updated1.blockedDomains.includes('youtube.com'), 'Other blocked domains must remain unaffected');

  // Disable mangadex.org
  const updated2 = await StorageLocal.setDomainAllowed('mangadex.org', false);
  assert.strictEqual(updated2.allowedDomains.includes('mangadex.org'), false, 'allowedDomains must NOT contain mangadex.org after disabling');

  // ── 2. Popup HTML structural validation ──────────────────────
  const popupHtml = fs.readFileSync(path.resolve(__dirname, '../popup.html'), 'utf8');
  assert.ok(popupHtml.includes('id="allowedChipsList"'), 'popup.html must have allowedChipsList container');
  assert.ok(popupHtml.includes('id="blockedChipsList"'), 'popup.html must have blockedChipsList container');
  assert.ok(popupHtml.includes('id="inputAllowedDomains"'), 'popup.html must retain inputAllowedDomains');
  assert.ok(popupHtml.includes('id="inputBlockedDomains"'), 'popup.html must retain inputBlockedDomains');
  assert.ok(popupHtml.includes('teclar Enter'), 'popup.html placeholders must guide user to press Enter');

  // ── 3. Popup CSS Chips & Hover "X" validation ────────────────
  const popupCss = fs.readFileSync(path.resolve(__dirname, '../popup.css'), 'utf8');
  assert.ok(popupCss.includes('.domain-chip {'), 'popup.css must style .domain-chip');
  assert.ok(popupCss.includes('.domain-chips-cloud {'), 'popup.css must style .domain-chips-cloud');
  assert.ok(popupCss.includes('.domain-chip-remove {'), 'popup.css must style .domain-chip-remove');
  assert.ok(popupCss.includes('.domain-chip:hover .domain-chip-remove'), 'popup.css must display X on hover');
  assert.ok(popupCss.includes('opacity: 0'), 'X button must be hidden until hover');
  assert.ok(popupCss.includes('opacity: 1'), 'X button must appear with opacity 1 on hover');

  // ── 4. Popup JS implementation validation ────────────────────
  const popupJs = fs.readFileSync(path.resolve(__dirname, '../popup.js'), 'utf8');
  assert.ok(popupJs.includes('allowedChipsList'), 'popup.js must bind allowedChipsList');
  assert.ok(popupJs.includes('blockedChipsList'), 'popup.js must bind blockedChipsList');
  assert.ok(popupJs.includes('cleanDomainInput'), 'popup.js must implement cleanDomainInput');
  assert.ok(popupJs.includes('renderDomainChips'), 'popup.js must implement renderDomainChips');
  assert.ok(popupJs.includes('ensureActiveTabContentScript'), 'popup.js must implement ensureActiveTabContentScript for fallback injection');

  // Test domain cleaning regex and logic directly from function body
  const cleanMatch = popupJs.match(/function cleanDomainInput\(raw\) \{([\s\S]*?)\n\}/);
  assert.ok(cleanMatch, 'cleanDomainInput function must exist');
  const cleanDomainInput = new Function('raw', cleanMatch[1]);
  assert.strictEqual(cleanDomainInput('https://www.mangadex.org/chapter/123'), 'mangadex.org');
  assert.strictEqual(cleanDomainInput('http://neoxscans.net:8080/manga/abc?ref=1#top'), 'neoxscans.net');
  assert.strictEqual(cleanDomainInput('  WWW.REAPERSCANS.COM/   '), 'reaperscans.com');
  assert.strictEqual(cleanDomainInput('mangakakalot.com'), 'mangakakalot.com');

  // ── 5. Content JS mounting and visibility validation ─────────
  const contentJs = fs.readFileSync(path.resolve(__dirname, '../content.js'), 'utf8');
  assert.ok(contentJs.includes('document.body || document.documentElement'), 'content.js must mount to body or fallback documentElement');
  assert.ok(contentJs.includes('loadFabPosition()'), 'content.js must refresh FAB position on visibility change');

  // ── 6. Manifest permissions validation ───────────────────────
  const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../manifest.json'), 'utf8'));
  assert.ok(manifest.permissions.includes('scripting'), 'manifest.json must have scripting permission for active tab injection');

  // ── 7. Domain Input Border Contrast & Quick Action (+) Button ──
  assert.ok(popupCss.includes('.domain-enter-badge'), 'popup.css must style .domain-enter-badge');
  assert.ok(popupCss.includes('border: 1.5px solid var(--accent-border)'), 'input-add-chip must have strong contrasting border');
  
  // Quick increment button positioned before edit button inside entry-actions
  assert.ok(popupJs.includes('btn-main-inc'), 'popup.js must render btn-main-inc');
  const incIdx = popupJs.indexOf('btn-main-inc');
  const editIdx = popupJs.indexOf('btn-main-edit', incIdx);
  assert.ok(incIdx !== -1 && editIdx !== -1 && incIdx < editIdx, 'btn-main-inc must be positioned before btn-main-edit in entry-actions');

  // ── 8. Rich DOM Extraction Bridge (Popup <-> Content Script) ─
  assert.ok(contentJs.includes("msg.action === 'getPageDetails'"), 'content.js must handle getPageDetails message from popup');
  assert.ok(popupJs.includes("action: 'getPageDetails'"), 'popup.js must query getPageDetails from content script in captureCurrentTab');

  console.log('✓ Domain Chips, Input Border, Quick Action (+) & DOM Bridge tests passed successfully!');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
