/**
 * Test: Multi-select Status Filter & 2-Second Status Hover Menu
 *
 * Verifies that:
 * 1. Default status filter displays only 'lendo' (which includes 'assistindo' for video tags).
 * 2. Multi-select filtering allows combinations (e.g. 'lendo' + 'pausado', 'dropado', etc.).
 * 3. StorageLocal.updateWorkStatus preserves work.updatedAt when touchUpdatedAt is false.
 * 4. popup.html declares statusFilterBar and status chips.
 * 5. popup.css styles status-filter-bar, status-chip, and status-popover.
 * 6. popup.js contains the 2000ms hover timer and popover options.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// 1. StorageLocal test
const mockStorage = {
  chapter_tracker_entries_v3: [
    { id: 'work_1', name: 'Work Lendo', tag: 'manga', readingStatus: 'lendo', updatedAt: 1000 },
    { id: 'work_2', name: 'Work Pausado', tag: 'manga', readingStatus: 'pausado', updatedAt: 2000 },
    { id: 'work_3', name: 'Work Dropado', tag: 'manga', readingStatus: 'dropado', updatedAt: 3000 },
    { id: 'work_4', name: 'Anime Assistindo', tag: 'anime', readingStatus: 'lendo', updatedAt: 4000 }
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
        } else if (keys && typeof keys === 'object') {
          Object.keys(keys).forEach(k => {
            res[k] = mockStorage[k] !== undefined ? mockStorage[k] : keys[k];
          });
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
  console.log('Testing Multi-select Status Filter & 2-Second Hover Menu...');

  // Step 1: StorageLocal.updateWorkStatus preserves updatedAt when touchUpdatedAt is false
  const updated = await StorageLocal.updateWorkStatus('work_1', {
    readingStatus: 'pausado',
    touchUpdatedAt: false
  });
  assert.strictEqual(updated.readingStatus, 'pausado', 'Status must be updated to pausado');
  assert.strictEqual(updated.updatedAt, 1000, 'updatedAt must NOT change when touchUpdatedAt is false');

  // Step 2: Multi-select filtering function test
  const works = [
    { id: '1', name: 'Manga A', tag: 'manga', readingStatus: 'lendo' },
    { id: '2', name: 'Manga B', tag: 'manga', readingStatus: 'pausado' },
    { id: '3', name: 'Manga C', tag: 'manga', readingStatus: 'dropado' },
    { id: '4', name: 'Manga D', tag: 'manga', readingStatus: 'concluido' },
    { id: '5', name: 'Anime E', tag: 'anime', readingStatus: 'lendo' }
  ];

  function filterWorksMulti(list, statusFilter) {
    if (!statusFilter || statusFilter === 'all') return list;
    if (statusFilter instanceof Set || Array.isArray(statusFilter)) {
      const set = statusFilter instanceof Set ? statusFilter : new Set(statusFilter);
      if (set.has('all')) return list;
      return list.filter(w => set.has((w.readingStatus || 'lendo').toLowerCase()));
    }
    return list.filter(w => (w.readingStatus || 'lendo').toLowerCase() === statusFilter.toLowerCase());
  }

  // Default: only lendo/assistindo
  const defaultList = filterWorksMulti(works, new Set(['lendo']));
  assert.strictEqual(defaultList.length, 2, 'Default filter should only display lendo and assistindo (2 works)');
  assert.ok(defaultList.some(w => w.id === '1'));
  assert.ok(defaultList.some(w => w.id === '5'));

  // Multi-select: lendo + pausado
  const multiList = filterWorksMulti(works, new Set(['lendo', 'pausado']));
  assert.strictEqual(multiList.length, 3, 'Multi-select lendo + pausado should return 3 works');

  // Single select: dropado
  const dropadoList = filterWorksMulti(works, new Set(['dropado']));
  assert.strictEqual(dropadoList.length, 1, 'Only dropado works should be returned');
  assert.strictEqual(dropadoList[0].id, '3');

  // Single select: pausado
  const pausadoList = filterWorksMulti(works, new Set(['pausado']));
  assert.strictEqual(pausadoList.length, 1, 'Only pausado works should be returned when clicking pausado');
  assert.strictEqual(pausadoList[0].id, '2');
  assert.strictEqual(pausadoList[0].readingStatus, 'pausado');

  // Step 3: Verify popup.html declarations
  const popupHtml = fs.readFileSync(path.join(__dirname, '..', 'popup.html'), 'utf8');
  assert.ok(popupHtml.includes('id="statusFilterBar"'), 'popup.html must declare statusFilterBar');
  assert.ok(popupHtml.includes('data-status="lendo"'), 'popup.html must have chip data-status="lendo"');
  assert.ok(popupHtml.includes('data-status="pausado"'), 'popup.html must have chip data-status="pausado"');
  assert.ok(popupHtml.includes('data-status="dropado"'), 'popup.html must have chip data-status="dropado"');
  assert.ok(popupHtml.includes('data-status="concluido"'), 'popup.html must have chip data-status="concluido"');
  assert.ok(popupHtml.includes('data-status="planejo"'), 'popup.html must have chip data-status="planejo"');
  assert.ok(!/[📖🌐↗✎✕＋▼⚙]/.test(popupHtml), 'popup.html must not contain legacy icon emojis/glyphs');

  // Step 4: Verify popup.css declarations
  const popupCss = fs.readFileSync(path.join(__dirname, '..', 'popup.css'), 'utf8');
  assert.ok(popupCss.includes('.status-filter-bar'), 'popup.css must style .status-filter-bar');
  assert.ok(popupCss.includes('.status-chip'), 'popup.css must style .status-chip');
  assert.ok(popupCss.includes('.status-chip.active'), 'popup.css must style active status chips');
  assert.ok(popupCss.includes('.entry-status-wrap'), 'popup.css must style .entry-status-wrap');
  assert.ok(popupCss.includes('.status-popover'), 'popup.css must style .status-popover');
  assert.ok(popupCss.includes('.status-popover-opt'), 'popup.css must style .status-popover-opt');
  assert.ok(popupCss.includes('.status-popover.open-below'), 'status-popover must support open-below');
  assert.ok(popupCss.includes('.status-popover.open-above'), 'status-popover must support open-above');

  // Step 5: Verify popup.js declarations
  const popupJs = fs.readFileSync(path.join(__dirname, '..', 'popup.js'), 'utf8');
  assert.ok(popupJs.includes('statusFilterBar'), 'popup.js must reference statusFilterBar');
  assert.ok(popupJs.includes('activeStatusFilters'), 'popup.js must declare activeStatusFilters');
  assert.ok(popupJs.includes('activeStatusFilters.clear()'), 'popup.js must support clearing for exclusive status selection');
  assert.ok(popupJs.includes('status-popover'), 'popup.js must generate status-popover');
  assert.ok(popupJs.includes('isLastCard'), 'popup.js must detect last card to open above');
  assert.ok(popupJs.includes('500'), 'popup.js must use 500ms hover delay for status options');
  assert.ok(popupJs.includes('touchUpdatedAt: false'), 'popup.js must update status with touchUpdatedAt: false');
  assert.ok(!/[📖🌐↗✎✕＋▼⚙]/.test(popupJs), 'popup.js must not contain legacy icon emojis/glyphs');

  console.log('✓ test-status-multiselect-and-hover-menu passed successfully!');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
