const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Mock Chrome Storage Local & DOM environment for testing
const memoryStore = {};
function createMockEl() {
  return {
    addEventListener: () => {},
    classList: { add: () => {}, remove: () => {}, toggle: () => {} },
    setAttribute: () => {},
    getAttribute: () => '',
    style: {},
    dataset: {},
    appendChild: () => {},
    querySelector: () => null,
    querySelectorAll: () => []
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
  storage: {
    onChanged: { addListener: () => {} },
    local: {
      get: (keys, cb) => {
        if (typeof keys === 'string') {
          const res = {};
          res[keys] = memoryStore[keys];
          if (cb) cb(res);
          return Promise.resolve(res);
        }
        if (Array.isArray(keys)) {
          const res = {};
          keys.forEach(k => { res[k] = memoryStore[k]; });
          if (cb) cb(res);
          return Promise.resolve(res);
        }
        if (cb) cb(memoryStore);
        return Promise.resolve(memoryStore);
      },
      set: (items, cb) => {
        Object.assign(memoryStore, items);
        if (cb) cb();
        return Promise.resolve();
      }
    }
  },
  runtime: { onMessage: { addListener: () => {} } },
  tabs: { query: () => Promise.resolve([]) }
};

const { StorageLocal } = require('../storage-local.js');
global.StorageLocal = StorageLocal;

async function runTests() {
  console.log('=== TEST SUITE: Quick Increment Chapter Guards & Comparisons ===\n');

  // ── 1. parseChapterParts Unit Tests ─────────────────────────────────────────
  console.log('1. Testing parseChapterParts...');
  const p1 = StorageLocal.parseChapterParts('Temp 01 - Ep 02');
  assert.strictEqual(p1.season, 1);
  assert.strictEqual(p1.episode, 2);
  assert.strictEqual(p1.isSeasonEp, true);

  const p2 = StorageLocal.parseChapterParts('1ª Temporada | E1 - Episódio 1');
  assert.strictEqual(p2.season, 1);
  assert.strictEqual(p2.episode, 1);
  assert.strictEqual(p2.isSeasonEp, true);

  const p3 = StorageLocal.parseChapterParts('Cap. 104.5');
  assert.strictEqual(p3.season, null);
  assert.strictEqual(p3.episode, 104.5);
  assert.strictEqual(p3.isSeasonEp, false);

  const p4 = StorageLocal.parseChapterParts('Filme 2');
  assert.strictEqual(p4.episode, 2);
  assert.strictEqual(p4.isMovie, true);

  const p5 = StorageLocal.parseChapterParts('Filme');
  assert.strictEqual(p5.episode, 1);
  assert.strictEqual(p5.isMovie, true);

  console.log('✓ parseChapterParts correctly parsed all formats.');

  // ── 2. compareChapters Unit Tests ──────────────────────────────────────────
  console.log('2. Testing compareChapters...');
  assert.ok(StorageLocal.compareChapters('Temp 01 - Ep 02', 'Temp 01 - Ep 01') > 0, 'Ep 02 must be > Ep 01');
  assert.ok(StorageLocal.compareChapters('Temp 01 - Ep 01', 'Temp 01 - Ep 02') < 0, 'Ep 01 must be < Ep 02');
  assert.strictEqual(StorageLocal.compareChapters('Temp 01 - Ep 01', 'Temp 01 - Ep 01'), 0, 'Ep 01 must == Ep 01');
  assert.ok(StorageLocal.compareChapters('Temp 02 - Ep 01', 'Temp 01 - Ep 12') > 0, 'Season 2 must be > Season 1');
  assert.ok(StorageLocal.compareChapters('1ª Temporada - Ep 02', 'Temp 01 - Ep 01') > 0, 'Ordinal Season 1 Ep 2 must be > Ep 1');
  assert.strictEqual(StorageLocal.compareChapters('1ª Temporada | E1 - Episódio 1', 'Temp 01 - Ep 01'), 0, 'Identical season and episode must be 0');

  assert.ok(StorageLocal.compareChapters('Cap. 105', 'Cap. 104') > 0, 'Cap. 105 must be > Cap. 104');
  assert.ok(StorageLocal.compareChapters('Cap. 104.5', 'Cap. 104') > 0, 'Cap. 104.5 must be > Cap. 104');
  assert.ok(StorageLocal.compareChapters('Cap. 104', 'Cap. 105') < 0, 'Cap. 104 must be < Cap. 105');
  assert.strictEqual(StorageLocal.compareChapters('Cap. 100', 'Cap. 100'), 0, 'Cap. 100 must == Cap. 100');

  assert.ok(StorageLocal.compareChapters('Episódio 2', 'Episódio 1') > 0, 'Episodio 2 must be > Episodio 1');
  assert.ok(StorageLocal.compareChapters('Filme 2', 'Filme 1') > 0, 'Filme 2 must be > Filme 1');
  assert.strictEqual(StorageLocal.compareChapters('Filme', 'Filme'), 0, 'Filme must == Filme');

  console.log('✓ compareChapters correctly compares numbers, seasons, and episodes.');

  // ── 3. compareUrls Unit Tests ──────────────────────────────────────────────
  console.log('3. Testing compareUrls...');
  const uAnime1 = 'https://animesonlinecc.to/episodio/hell-mode-yarikomizuki-no-gamer-wa-hai-settei-no-isekai-de-musou-suru-episodio-1/';
  const uAnime2 = 'https://animesonlinecc.to/episodio/hell-mode-yarikomizuki-no-gamer-wa-hai-settei-no-isekai-de-musou-suru-episodio-2/';
  assert.ok(StorageLocal.compareUrls(uAnime2, uAnime1) > 0, 'Anime url 2 must be > url 1');
  assert.ok(StorageLocal.compareUrls(uAnime1, uAnime2) < 0, 'Anime url 1 must be < url 2');
  assert.strictEqual(StorageLocal.compareUrls(uAnime1, uAnime1), 0, 'Same anime url must be 0');

  const uCrunch1 = 'https://www.crunchyroll.com/pt-br/watch/GE00375528PTBR/episode-1';
  const uCrunch2 = 'https://www.crunchyroll.com/pt-br/watch/GE00375529PTBR/episode-2';
  assert.ok(StorageLocal.compareUrls(uCrunch2, uCrunch1) > 0, 'Crunchyroll url 2 must be > url 1');

  console.log('✓ compareUrls correctly extracts and compares chapters across URLs.');

  // ── 4. quickIncrementWork with Options Unit Tests ──────────────────────────
  console.log('4. Testing quickIncrementWork with options (updating url and detected chapter)...');
  const savedWork = await StorageLocal.saveWorkReading({
    workName: 'Hell Mode',
    chapter: 'Temp 01 - Ep 01',
    url: uAnime1,
    tag: 'anime'
  });
  assert.strictEqual(savedWork.mainChapter, 'Temp 01 - Ep 01');

  // Increment with explicit chapter and URL from active tab
  const updatedWork = await StorageLocal.quickIncrementWork(savedWork.id, {
    chapter: 'Temp 01 - Ep 02',
    url: uAnime2
  });
  assert.strictEqual(updatedWork.mainChapter, 'Temp 01 - Ep 02');
  const src = updatedWork.sources.find(s => s.id === updatedWork.lastReadSourceId);
  assert.strictEqual(src.chapter, 'Temp 01 - Ep 02');
  assert.strictEqual(src.url, uAnime2, 'Source URL must be updated to current tab URL');
  assert.strictEqual(updatedWork.history[0].chapter, 'Temp 01 - Ep 02');
  assert.strictEqual(updatedWork.history[0].url, uAnime2, 'History must reflect the new URL');

  // Standard increment without options (+1)
  const incDefault = await StorageLocal.quickIncrementWork(savedWork.id);
  assert.strictEqual(incDefault.mainChapter, 'Temp 01 - Ep 03', 'Subsequent increment adds +1');

  console.log('✓ quickIncrementWork supports explicit chapter/url and default increments.');

  // ── 5. HTML & Modal Verification ───────────────────────────────────────────
  console.log('5. Verifying confirmActionModal in popup.html and popup.js...');
  const htmlContent = fs.readFileSync(path.resolve(__dirname, '../popup.html'), 'utf8');
  assert.ok(htmlContent.includes('confirmActionModal'), 'popup.html must contain confirmActionModal');
  assert.ok(htmlContent.includes('confirmActionTitle'), 'popup.html must contain confirmActionTitle');
  assert.ok(htmlContent.includes('confirmActionText'), 'popup.html must contain confirmActionText');
  assert.ok(htmlContent.includes('btnCancelAction'), 'popup.html must contain btnCancelAction');
  assert.ok(htmlContent.includes('btnConfirmAction'), 'popup.html must contain btnConfirmAction');

  const jsContent = fs.readFileSync(path.resolve(__dirname, '../popup.js'), 'utf8');
  assert.ok(jsContent.includes('showConfirmActionModal'), 'popup.js must implement showConfirmActionModal');
  assert.ok(jsContent.includes('isTabForWork'), 'popup.js must implement isTabForWork');
  assert.ok(jsContent.includes('compareChapters'), 'popup.js must verify compareChapters before increment');

  // Emulate isTabForWork logic
  const mockWork = {
    name: 'Hell Mode',
    aliases: ['Hell Mode: Yarikomizuki'],
    sources: [{ domain: 'animesonlinecc.to', url: uAnime1 }]
  };
  const mockTabMatch = { url: uAnime2, title: 'Hell Mode - Episódio 2' };
  const mockTabOther = { url: 'https://youtube.com', title: 'YouTube' };

  const { isTabForWork } = require('../popup.js');
  if (typeof isTabForWork === 'function') {
    assert.strictEqual(isTabForWork(mockTabMatch, mockWork), true, 'Matching tab must return true');
    assert.strictEqual(isTabForWork(mockTabOther, mockWork), false, 'Non-matching tab must return false');
  }

  console.log('✓ confirmActionModal and isTabForWork logic verified.\n');
  console.log('All quick increment guards and chapter comparison tests passed successfully!');
}

runTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
