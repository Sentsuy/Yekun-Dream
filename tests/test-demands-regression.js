const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { StorageLocal } = require('../storage-local');

// Mock chrome.storage.local for StorageLocal testing
const storageState = {};
global.chrome = {
  storage: {
    local: {
      get: (keys, cb) => {
        const res = {};
        for (const k of keys) {
          res[k] = storageState[k];
        }
        cb(res);
      },
      set: (obj, cb) => {
        Object.assign(storageState, obj);
        if (cb) cb();
      }
    }
  }
};

const contentCode = fs.readFileSync(path.resolve(__dirname, '../content.js'), 'utf8');
const popupHtml   = fs.readFileSync(path.resolve(__dirname, '../popup.html'), 'utf8');
const popupJs     = fs.readFileSync(path.resolve(__dirname, '../popup.js'), 'utf8');
const popupCss    = fs.readFileSync(path.resolve(__dirname, '../popup.css'), 'utf8');

console.log('Testing Demand 1: Floating button disable & propagation...');
assert.ok(contentCode.includes('updateWidgetVisibility'), 'content.js must define updateWidgetVisibility');
assert.ok(contentCode.includes('changes.chapter_tracker_settings'), 'content.js must react to settings changes in real time');
assert.ok(contentCode.includes('settingsUpdated'), 'content.js must accept settingsUpdated message');
assert.ok(popupJs.includes('settingsUpdated'), 'popup.js must broadcast settingsUpdated to tabs');

console.log('Testing Demand 2: Save flow and reactive popup refresh...');
assert.ok(contentCode.includes('workSaved'), 'content.js must broadcast workSaved');
assert.ok(popupJs.includes('workSaved'), 'popup.js must listen for workSaved');
assert.ok(popupJs.includes('changes.chapter_tracker_entries_v3'), 'popup.js must listen to storage changes for reactive refresh');

console.log('Testing Demand 3: Chapter regex & title extraction...');
const variations = [
  { url: 'https://site.com/acees/cp-1', title: 'Acees - cp 1 - Site X', expectedCh: 'Cap. 1', expectedTitle: 'Acees' },
  { url: 'https://site.com/acees/cap-22', title: 'Acees - Cap 22 - Site Y', expectedCh: 'Cap. 22', expectedTitle: 'Acees' },
  { url: 'https://site.com/acees/capitulo-33', title: 'Acees - Capítulo 33', expectedCh: 'Cap. 33', expectedTitle: 'Acees' },
  { url: 'https://site.com/acees/chapter-44', title: 'Acees Chapter 44 Online', expectedCh: 'Cap. 44', expectedTitle: 'Acees' },
  { url: 'https://site.com/acees/ch-55', title: 'Acees Ch. 55 | Scan', expectedCh: 'Cap. 55', expectedTitle: 'Acees' }
];

for (const v of variations) {
  const ch = StorageLocal.extractChapter(v.url, v.title);
  assert.strictEqual(ch, v.expectedCh, `Chapter extraction failed for ${v.url}`);
  const title = StorageLocal.cleanWorkTitle(v.title);
  assert.strictEqual(title, v.expectedTitle, `Title cleaning failed for ${v.title}`);
}

console.log('Testing Demand 4: UI/UX (Tooltip & Category Filter)...');
assert.ok(popupHtml.includes('id="categoryFilter"'), 'popup.html must have categoryFilter select');
assert.ok(popupHtml.includes('value="manhwa"'), 'popup.html must include manhwa option');
assert.ok(popupHtml.includes('value="manhua"'), 'popup.html must include manhua option');
assert.ok(popupHtml.includes('value="webtoon"'), 'popup.html must include webtoon option');
assert.ok(popupHtml.includes('data-tag="manhwa"'), 'popup.html tagPicker must include manhwa');
assert.ok(popupHtml.includes('data-tag="manhua"'), 'popup.html tagPicker must include manhua');
assert.ok(popupHtml.includes('data-tag="webtoon"'), 'popup.html tagPicker must include webtoon');

assert.ok(popupCss.includes('.category-select'), 'popup.css must style category-select');
assert.ok(popupCss.includes('.entry-tooltip'), 'popup.css must style entry-tooltip');
assert.ok(popupCss.includes('.entry-title-wrap'), 'popup.css must style entry-title-wrap');
assert.ok(popupJs.includes('entry-tooltip'), 'popup.js must generate entry-tooltip');

console.log('Testing Demand 5: Multi-source grouping of same work across different sites...');
(async () => {
  // Step A: Save "Acees" from Site X
  const saveX = await StorageLocal.saveWorkReading({
    workName: 'Acees - Cap 10 - Site X',
    chapter: 'Cap. 10',
    url: 'https://sitex.com/acees/cap-10',
    domain: 'sitex.com',
    siteName: 'Site X',
    tag: 'manga'
  });

  assert.strictEqual(saveX.name, 'Acees', 'Work name should be cleaned to "Acees"');
  let works = await StorageLocal.getWorks();
  assert.strictEqual(works.length, 1, 'Should have 1 work');
  assert.strictEqual(works[0].sources.length, 1, 'Should have 1 source');
  assert.strictEqual(works[0].mainChapter, 'Cap. 10');

  // Step B: Save same work "Acees" from Site Y with chapter 15
  const saveY = await StorageLocal.saveWorkReading({
    workName: 'Acees - cp 15 - Site Y',
    chapter: 'Cap. 15',
    url: 'https://sitey.com/acees/cp-15',
    domain: 'sitey.com',
    siteName: 'Site Y',
    tag: 'manga'
  });

  works = await StorageLocal.getWorks();
  assert.strictEqual(works.length, 1, 'Must NOT create duplicate work for "Acees"');
  const acees = works[0];
  assert.strictEqual(acees.name, 'Acees');
  assert.strictEqual(acees.mainChapter, 'Cap. 15', 'Main chapter must update to latest reading');
  assert.strictEqual(acees.sources.length, 2, 'Must have 2 sources (Site X and Site Y)');

  const srcX = acees.sources.find(s => s.domain === 'sitex.com');
  const srcY = acees.sources.find(s => s.domain === 'sitey.com');
  assert.ok(srcX, 'Must contain Site X source');
  assert.ok(srcY, 'Must contain Site Y source');
  assert.strictEqual(srcX.url, 'https://sitex.com/acees/cap-10');
  assert.strictEqual(srcY.url, 'https://sitey.com/acees/cp-15');
  assert.strictEqual(srcX.chapter, 'Cap. 10');
  assert.strictEqual(srcY.chapter, 'Cap. 15');

  // Step C: Check history
  assert.strictEqual(acees.history.length, 2, 'Must maintain reading history for both sites');

  console.log('✓ All demands regression tests passed successfully!');
})().catch(err => {
  console.error('FAIL in async tests:', err);
  process.exit(1);
});
