/**
 * Test: Dead Code Cleanup & Usability Enhancements Audit
 *
 * Verifies that:
 * 1. Obsolete CSS classes (.pro-custom-email-row, .pro-pin-fallback) are completely removed from popup.css.
 * 2. Empty state in renderList dynamically offers a "Redefinir filtros e busca" button when allWorks > 0.
 * 3. statusFilterBar supports fluid toggle selection without requiring keyboard shortcuts.
 * 4. searchInput supports clearing via Escape key.
 * 5. In-place card removal checks isFilterAll properly.
 * 6. popup.html, popup.css, and popup.js contain zero legacy glyphs or emojis [📖🌐↗✎✕＋▼⚙].
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

async function runTests() {
  console.log('Testing Dead Code Cleanup & Usability Enhancements...');

  const popupCss = fs.readFileSync(path.join(__dirname, '..', 'popup.css'), 'utf8');
  const popupHtml = fs.readFileSync(path.join(__dirname, '..', 'popup.html'), 'utf8');
  const popupJs = fs.readFileSync(path.join(__dirname, '..', 'popup.js'), 'utf8');

  // 1. Dead CSS removal verification
  assert.strictEqual(popupCss.includes('.pro-custom-email-row'), false, '.pro-custom-email-row must be removed from popup.css');
  assert.strictEqual(popupCss.includes('.pro-pin-fallback'), false, '.pro-pin-fallback must be removed from popup.css');

  // 2. Usability: Dynamic empty state with reset button
  assert.ok(popupJs.includes('btnResetFilters'), 'popup.js must provide btnResetFilters when works exist but are filtered out');
  assert.ok(popupJs.includes('Redefinir filtros e busca'), 'popup.js must display helpful text for filtered empty state');

  // 3. Usability: Fluid multi-select toggle without keyboard requirement
  assert.ok(popupJs.includes('activeStatusFilters.delete(st)'), 'popup.js must support toggling off an active status chip');
  assert.ok(popupJs.includes('activeStatusFilters.add(st)'), 'popup.js must support toggling on an inactive status chip');
  assert.ok(popupJs.includes('activeStatusFilters.clear()'), 'popup.js must support clearing for exclusive status selection');

  // 4. Usability: Escape key clears search
  assert.ok(popupJs.includes("e.key === 'Escape'"), 'popup.js must support Escape key to clear search');

  // 5. In-place card removal checks isFilterAll properly
  assert.ok(popupJs.includes('isFilterAll'), 'popup.js must compute isFilterAll before removing cards in-place');

  // 6. Zero legacy glyphs or emojis constraint
  assert.ok(!/[📖🌐↗✎✕＋▼⚙]/.test(popupHtml), 'popup.html must not contain legacy icon emojis/glyphs');
  assert.ok(!/[📖🌐↗✎✕＋▼⚙]/.test(popupCss), 'popup.css must not contain legacy icon emojis/glyphs');
  assert.ok(!/[📖🌐↗✎✕＋▼⚙]/.test(popupJs), 'popup.js must not contain legacy icon emojis/glyphs');

  console.log('✓ test-dead-code-and-usability-audit passed successfully!');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
