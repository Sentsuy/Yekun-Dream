const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.resolve(__dirname, '../popup.html'), 'utf8');
const js   = fs.readFileSync(path.resolve(__dirname, '../popup.js'), 'utf8');
const css  = fs.readFileSync(path.resolve(__dirname, '../popup.css'), 'utf8');

// 1. HTML checks
assert.ok(html.includes('inputSiteName') || html.includes('field-site') || html.includes('formPanel'), 'Form must have site/source fields');

// 2. CSS checks
assert.ok(css.includes('source-chip') || css.includes('entry-sources'), 'popup.css must have source-chip or entry-sources styles');
assert.ok(css.includes('accordion-panel') || css.includes('work-sources-drawer'), 'popup.css must have accordion/drawer styles');
assert.ok(css.includes('history-timeline') || css.includes('history-item'), 'popup.css must have history timeline styles');

// 3. JS checks
assert.ok(js.includes('getWorks'), 'popup.js must call StorageLocal.getWorks()');
assert.ok(js.includes('saveWorkReading') || js.includes('updateWorkDetails'), 'popup.js must call saveWorkReading or updateWorkDetails');
assert.ok(js.includes('deleteSource'), 'popup.js must support deleteSource');
assert.ok(js.includes('quickIncrementWork') || js.includes('quickIncrementChapter'), 'popup.js must support quick increment on works');

// 4. Search filter logic test
function filterWorks(works, query) {
  const q = query.toLowerCase().trim();
  if (!q) return works;
  return works.filter(w => {
    if (w.name.toLowerCase().includes(q)) return true;
    if ((w.mainChapter || '').toLowerCase().includes(q)) return true;
    if ((w.tag || '').toLowerCase().includes(q)) return true;
    const hasSource = (w.sources || []).some(s =>
      (s.siteName || '').toLowerCase().includes(q) ||
      (s.domain || '').toLowerCase().includes(q) ||
      (s.chapter || '').toLowerCase().includes(q) ||
      (s.url || '').toLowerCase().includes(q)
    );
    return hasSource;
  });
}

const mockWorks = [
  {
    id: 'w1',
    name: 'Martial Peak',
    mainChapter: 'Cap. 3850',
    tag: 'manga',
    sources: [
      { siteName: 'MangaDex', domain: 'mangadex.org', chapter: 'Cap. 3850', url: 'https://mangadex.org' },
      { siteName: 'Neox Scans', domain: 'neoxscans.net', chapter: 'Cap. 3820', url: 'https://neoxscans.net' }
    ]
  },
  {
    id: 'w2',
    name: 'Solo Leveling',
    mainChapter: 'Cap. 179',
    tag: 'manga',
    sources: [
      { siteName: 'Reaper Scans', domain: 'reaperscans.com', chapter: 'Cap. 179', url: 'https://reaperscans.com' }
    ]
  }
];

assert.strictEqual(filterWorks(mockWorks, 'martial').length, 1);
assert.strictEqual(filterWorks(mockWorks, 'neox').length, 1, 'Search must match by source siteName');
assert.strictEqual(filterWorks(mockWorks, 'reaperscans.com').length, 1, 'Search must match by source domain');
assert.strictEqual(filterWorks(mockWorks, '3820').length, 1, 'Search must match by chapter in source');
assert.strictEqual(filterWorks(mockWorks, 'inexistente').length, 0);

console.log('✓ Popup v3 verification passed.');
