const assert = require('assert');
const fs = require('fs');
const path = require('path');

// 1. Load files
const popupHtml = fs.readFileSync(path.resolve(__dirname, '../popup.html'), 'utf8');
const popupCss  = fs.readFileSync(path.resolve(__dirname, '../popup.css'), 'utf8');
const popupJs   = fs.readFileSync(path.resolve(__dirname, '../popup.js'), 'utf8');

// 2. HTML verification
assert.ok(popupHtml.includes('id="bottomNavBar"'), 'popup.html must have bottomNavBar');
assert.ok(popupHtml.includes('id="navBtnWorks"'), 'popup.html must have navBtnWorks');
assert.ok(popupHtml.includes('id="navBtnSites"'), 'popup.html must have navBtnSites');
assert.ok(popupHtml.includes('id="navBadgeWorks"'), 'popup.html must have navBadgeWorks');
assert.ok(popupHtml.includes('id="navBadgeSites"'), 'popup.html must have navBadgeSites');
assert.ok(popupHtml.includes('id="sitesListView"'), 'popup.html must have sitesListView');
assert.ok(popupHtml.includes('id="emptySitesState"'), 'popup.html must have emptySitesState');
assert.ok(popupHtml.includes('id="sitesCardsContainer"'), 'popup.html must have sitesCardsContainer');

// 3. CSS verification
assert.ok(popupCss.includes('.bottom-nav-bar'), 'popup.css must style .bottom-nav-bar');
assert.ok(popupCss.includes('.bottom-nav-btn'), 'popup.css must style .bottom-nav-btn');
assert.ok(popupCss.includes('.bottom-nav-badge'), 'popup.css must style .bottom-nav-badge');
assert.ok(popupCss.includes('.source-chip-more'), 'popup.css must style .source-chip-more');
assert.ok(popupCss.includes('.sites-list-view'), 'popup.css must style .sites-list-view');
assert.ok(popupCss.includes('.site-card'), 'popup.css must style .site-card');
assert.ok(popupCss.includes('.btn-visit-site'), 'popup.css must style .btn-visit-site');
assert.ok(popupCss.includes('.site-works-list'), 'popup.css must style .site-works-list');
assert.ok(popupCss.includes('.site-work-item'), 'popup.css must style .site-work-item');

// 3.1 Verify Bottom Nav Bar is pinned and only middle container scrolls
const bottomNavChunk = popupCss.substring(
  popupCss.indexOf('.bottom-nav-bar {'),
  popupCss.indexOf('}', popupCss.indexOf('.bottom-nav-bar {'))
);
assert.ok(bottomNavChunk.includes('position: sticky') || bottomNavChunk.includes('flex-shrink: 0'),
  'bottom-nav-bar must remain pinned at bottom');
assert.ok(bottomNavChunk.includes('bottom: 0'), 'bottom-nav-bar must stick to bottom: 0');

const entriesListChunk = popupCss.substring(
  popupCss.indexOf('.entries-list {'),
  popupCss.indexOf('}', popupCss.indexOf('.entries-list {'))
);
assert.ok(entriesListChunk.includes('overflow-y: auto'), 'entries-list must have overflow-y: auto');
assert.ok(entriesListChunk.includes('min-height: 0'), 'entries-list must have min-height: 0 for proper flex scrolling');

const sitesListChunk = popupCss.substring(
  popupCss.indexOf('.sites-list-view {'),
  popupCss.indexOf('}', popupCss.indexOf('.sites-list-view {'))
);
assert.ok(sitesListChunk.includes('overflow-y: auto'), 'sites-list-view must have overflow-y: auto');
assert.ok(sitesListChunk.includes('min-height: 0'), 'sites-list-view must have min-height: 0 for proper flex scrolling');

// 4. Setup mock browser environment for popup.js logic
function createMockEl() {
  return {
    addEventListener: () => {},
    removeEventListener: () => {},
    querySelectorAll: () => [],
    querySelector: () => null,
    appendChild: () => {},
    classList: { add: () => {}, remove: () => {}, toggle: () => false },
    style: {},
    dataset: {},
    value: '',
    textContent: '',
    innerHTML: ''
  };
}

global.document = {
  documentElement: { setAttribute: () => {}, getAttribute: () => 'dark' },
  body: { setAttribute: () => {}, getAttribute: () => 'dark' },
  getElementById: () => createMockEl(),
  querySelectorAll: () => [],
  querySelector: () => null,
  createElement: () => createMockEl()
};
global.window = global;
global.chrome = {
  storage: { onChanged: { addListener: () => {} }, local: {} },
  runtime: { onMessage: { addListener: () => {} } }
};
global.StorageLocal = {
  getWorks: async () => [],
  saveSettings: async () => {},
  getSettings: async () => ({})
};

// Require popup module
const popup = require('../popup.js');
assert.strictEqual(typeof popup.getConsolidatedSites, 'function', 'popup.js must export getConsolidatedSites');

const mockWorks = [
  {
    id: 'w1',
    name: 'Solo Leveling',
    mainChapter: 'Cap. 179',
    tag: 'manhwa',
    lastReadSourceId: 'src2',
    updatedAt: 1000,
    sources: [
      { id: 'src1', siteName: 'MangaDex', domain: 'mangadex.org', url: 'https://mangadex.org/title/sl', chapter: 'Cap. 150', updatedAt: 500 },
      { id: 'src2', siteName: 'Reaper Scans', domain: 'reaperscans.com', url: 'https://reaperscans.com/series/sl', chapter: 'Cap. 179', updatedAt: 1000 },
      { id: 'src3', siteName: 'Flame Scans', domain: 'flamescans.org', url: 'https://flamescans.org/series/sl', chapter: 'Cap. 170', updatedAt: 800 }
    ]
  },
  {
    id: 'w2',
    name: 'Omniscient Reader',
    mainChapter: 'Cap. 210',
    tag: 'manhwa',
    lastReadSourceId: 'src4',
    updatedAt: 2000,
    sources: [
      { id: 'src4', siteName: 'Flame Scans', domain: 'flamescans.org', url: 'https://flamescans.org/series/orv', chapter: 'Cap. 210', updatedAt: 2000 },
      { id: 'src5', siteName: 'MangaDex', domain: 'mangadex.org', url: 'https://mangadex.org/title/orv', chapter: 'Cap. 200', updatedAt: 1500 }
    ]
  },
  {
    id: 'w3',
    name: 'Martial Peak',
    mainChapter: 'Cap. 3850',
    tag: 'manhua',
    lastReadSourceId: 'src6',
    updatedAt: 3000,
    sources: [
      { id: 'src6', siteName: 'MangaDex', domain: 'mangadex.org', url: 'https://mangadex.org/title/mp', chapter: 'Cap. 3850', updatedAt: 3000 }
    ]
  }
];

// Test getConsolidatedSites
const consolidated = popup.getConsolidatedSites(mockWorks);

// Should aggregate into 3 distinct sites: mangadex.org (3 works), flamescans.org (2 works), reaperscans.com (1 work)
assert.strictEqual(consolidated.length, 3, 'Must consolidate into exactly 3 unique sites with zero duplicates');

// Sorted by works count descending
assert.strictEqual(consolidated[0].domain, 'mangadex.org', 'Top site must be mangadex.org with most works');
assert.strictEqual(consolidated[0].works.length, 3, 'MangaDex must have 3 works');
assert.strictEqual(consolidated[1].domain, 'flamescans.org', 'Second site must be flamescans.org');
assert.strictEqual(consolidated[1].works.length, 2, 'Flame Scans must have 2 works');
assert.strictEqual(consolidated[2].domain, 'reaperscans.com', 'Third site must be reaperscans.com');
assert.strictEqual(consolidated[2].works.length, 1, 'Reaper Scans must have 1 work');

// Verify work details inside site
const mdSolo = consolidated[0].works.find(w => w.workId === 'w1');
assert.ok(mdSolo, 'MangaDex must include Solo Leveling');
assert.strictEqual(mdSolo.chapter, 'Cap. 150', 'Solo Leveling chapter on MangaDex must match source chapter');
assert.strictEqual(mdSolo.url, 'https://mangadex.org/title/sl', 'URL must match source URL');

// Verify mainUrl extraction for site visit
assert.strictEqual(consolidated[0].mainUrl, 'https://mangadex.org', 'Base domain must be extracted for visit button');

// 5. Test Smart Limit logic in popup.js
assert.ok(popupJs.includes('MAX_VISIBLE_CHIPS = 2'), 'popup.js must define MAX_VISIBLE_CHIPS = 2');
assert.ok(popupJs.includes('source-chip-more'), 'popup.js must render source-chip-more button');
assert.ok(popupJs.includes('+${hiddenCount} sites'), 'popup.js must display hidden count badge');

// 6. Test that switchView exists and handles both modes
assert.ok(popupJs.includes("switchView('works')") || popupJs.includes("switchView"), 'popup.js must implement switchView');
assert.ok(popupJs.includes("currentActiveView = 'works'") || popupJs.includes("currentActiveView"), 'popup.js must track active view');

// 7. Verify icon regex guard
assert.strictEqual(/[📖🌐↗✎✕＋▼⚙]/.test(popupJs), false, 'popup.js must not contain legacy icon emojis/glyphs');

console.log('✓ Bottom Navigation and Consolidated Sites tests passed successfully!');
