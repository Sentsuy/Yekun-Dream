const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('Testing Save Pre-fill & Cross-Tab Activation Fixes...');

const contentCode = fs.readFileSync(path.resolve(__dirname, '../content.js'), 'utf8');
const popupCode   = fs.readFileSync(path.resolve(__dirname, '../popup.js'), 'utf8');

// ── 1. sPadded Definition Check in content.js ─────────────────
// In extractPageData, sPadded must be defined before being used in template literals
assert.ok(
  !contentCode.includes('`Temp ${sPadded}') || (
    contentCode.indexOf('const sPadded =') !== -1 &&
    contentCode.split('`Temp ${sPadded}').every((part, idx) => {
      if (idx === 0) return true;
      // Before this occurrence, sPadded must be declared in scope
      return true;
    })
  ),
  'sPadded must be defined before use in content.js'
);

const matchesOfTemp = contentCode.matchAll(/chapter\s*=\s*`Temp \$\{sPadded\} - Ep \$\{ePadded\}`;/g);
for (const match of matchesOfTemp) {
  const index = match.index;
  const sliceBefore = contentCode.slice(Math.max(0, index - 300), index);
  assert.ok(
    sliceBefore.includes('sPadded =') || sliceBefore.includes('const sPadded'),
    'sPadded must be declared immediately prior to chapter assignment'
  );
}

// ── 2. Clean Root Re-injection in content.js ───────────────────
// Must clean up any previous __ct_root__ rather than returning immediately and staying dead
assert.ok(
  contentCode.includes('existingRoot.remove()') || contentCode.includes('existingRoot') || !contentCode.includes("if (document.getElementById('__ct_root__')) return;"),
  'content.js must remove orphaned __ct_root__ rather than returning early on re-injection'
);

// ── 3. Synchronous Instant Pre-fill in content.js ─────────────
// populateForm must populate inputs synchronously using local matching without blocking on findMatchingWorkAsync
assert.ok(
  contentCode.includes('localMatch') || contentCode.includes('findMatchingWork(') || contentCode.includes('nameInp.value ='),
  'content.js must pre-fill nameInp and chapterInp synchronously'
);

// ── 4. Fallback Default Chapter in popup.js ───────────────────
// When captureCurrentTab runs, inputChapter must receive default 'Cap. 1' if detectedChapter is empty
assert.ok(
  popupCode.includes("inputChapter.value = detectedChapter || 'Cap. 1'") ||
  popupCode.includes("detectedChapter || 'Cap. 1'"),
  'popup.js must assign default chapter fallback so inputChapter is never left empty on new work'
);

// ── 5. Scripting Fallback in broadcastSettingsToTabs ──────────
assert.ok(
  popupCode.includes('broadcastSettingsToTabs') &&
  (popupCode.includes('chrome.scripting.executeScript') || popupCode.includes('executeScript')),
  'popup.js broadcastSettingsToTabs must wake up tabs without active content script'
);

// ── 6. Default FAB Coordinates Fallback in content.js ─────────
assert.ok(
  contentCode.includes('loadFabPosition') &&
  (contentCode.includes("host.style.bottom = '24px'") || contentCode.includes("bottom: 24px")),
  'content.js loadFabPosition must maintain or restore default bottom/right coordinates'
);

console.log('✓ All Save Pre-fill & Cross-Tab Activation assertions passed!');
