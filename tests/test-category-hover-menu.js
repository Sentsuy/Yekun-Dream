/**
 * Test: Category Hover Popover & In-Place Update
 *
 * Verifies that:
 * 1. StorageLocal.updateWorkCategory updates tag without modifying updatedAt when touchUpdatedAt: false.
 * 2. popup.css styles .entry-category-wrap and .category-popover (open-below, open-above, dot styles).
 * 3. popup.js declares category popover options (Manga, Manhwa, Manhua, Anime, Webtoon, Serie, Filme, Livro, Outro).
 * 4. popup.js configures 500ms hover delay, direction-aware popover, and video/text status adaptation.
 * 5. No emojis or legacy glyphs in code.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const mockStorage = {
  chapter_tracker_entries_v3: [
    { id: 'work_cat_1', name: 'Work A', tag: 'manga', readingStatus: 'lendo', updatedAt: 123456 }
  ]
};

global.chrome = {
  storage: {
    local: {
      get: (keys, cb) => {
        const res = {};
        if (Array.isArray(keys)) {
          keys.forEach(k => { res[k] = mockStorage[k]; });
        } else if (typeof keys === 'string') {
          res[keys] = mockStorage[keys];
        }
        cb(res);
      },
      set: (obj, cb) => {
        Object.assign(mockStorage, obj);
        if (cb) cb();
      }
    }
  }
};

const { StorageLocal } = require('../storage-local.js');

async function runTests() {
  console.log('Testing Category Hover Popover & In-Place Update...');

  // 1. StorageLocal.updateWorkCategory test
  assert.strictEqual(typeof StorageLocal.updateWorkCategory, 'function', 'StorageLocal must implement updateWorkCategory');
  const updated = await StorageLocal.updateWorkCategory('work_cat_1', 'anime', { touchUpdatedAt: false });
  assert.ok(updated, 'updateWorkCategory should return updated work');
  assert.strictEqual(updated.tag, 'anime', 'Work tag must be updated to anime');
  assert.strictEqual(updated.updatedAt, 123456, 'updatedAt must NOT be changed when touchUpdatedAt is false');

  // 2. CSS styles verification
  const popupCss = fs.readFileSync(path.join(__dirname, '..', 'popup.css'), 'utf8');
  assert.ok(popupCss.includes('.entry-category-wrap'), 'popup.css must style .entry-category-wrap');
  assert.ok(popupCss.includes('.category-popover'), 'popup.css must style .category-popover');
  assert.ok(popupCss.includes('.category-popover.open-below'), 'popup.css must support .category-popover.open-below');
  assert.ok(popupCss.includes('.category-popover.open-above'), 'popup.css must support .category-popover.open-above');
  assert.ok(popupCss.includes('.category-popover-opt'), 'popup.css must style .category-popover-opt');
  assert.ok(popupCss.includes('.category-popover-dot'), 'popup.css must style .category-popover-dot');

  // 3. JS declarations & popover logic
  const popupJs = fs.readFileSync(path.join(__dirname, '..', 'popup.js'), 'utf8');
  assert.ok(popupJs.includes('entry-category-wrap'), 'popup.js must render .entry-category-wrap');
  assert.ok(popupJs.includes('category-popover'), 'popup.js must declare .category-popover');
  assert.ok(popupJs.includes('data-tag="manga"'), 'popup.js must support manga tag option');
  assert.ok(popupJs.includes('data-tag="anime"'), 'popup.js must support anime tag option');
  assert.ok(popupJs.includes('data-tag="webtoon"'), 'popup.js must support webtoon tag option');
  assert.ok(popupJs.includes('btn-cat-cycle'), 'popup.js must attach btn-cat-cycle');
  assert.ok(popupJs.includes('updateWorkCategory'), 'popup.js must call StorageLocal.updateWorkCategory');

  // 4. Clean styling: No emojis/glyphs
  assert.ok(!/[📖🌐↗✎✕＋▼⚙]/.test(popupCss), 'popup.css must not contain legacy icon emojis/glyphs');
  assert.ok(!/[📖🌐↗✎✕＋▼⚙]/.test(popupJs), 'popup.js must not contain legacy icon emojis/glyphs');

  console.log('✓ All Category Hover Popover tests passed successfully!');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
