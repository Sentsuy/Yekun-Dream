const assert = require('assert');
const { StorageLocal } = require('../storage-local');

// ── Test 1: Chapter Extraction from URLs ────────────────────────
const urlTestCases = [
  { url: 'https://site.com/manga/solo-leveling/cap-150', expected: 'Cap. 150' },
  { url: 'https://site.com/manga/solo-leveling/capitulo-42', expected: 'Cap. 42' },
  { url: 'https://site.com/manga/acees/cp-12', expected: 'Cap. 12' },
  { url: 'https://site.com/manga/acees/cp.15', expected: 'Cap. 15' },
  { url: 'https://site.com/series/one-piece/ch-1080', expected: 'Cap. 1080' },
  { url: 'https://site.com/series/one-piece/chapter-1081.5', expected: 'Cap. 1081.5' },
  { url: 'https://site.com/anime/shingeki/ep-25', expected: 'Ep. 25' },
  { url: 'https://site.com/anime/shingeki/episodio-12', expected: 'Ep. 12' },
  { url: 'https://site.com/read/c1090', expected: 'Cap. 1090' },
  { url: 'https://site.com/manga/tower-of-god/chap-550', expected: 'Cap. 550' }
];

for (const tc of urlTestCases) {
  const result = StorageLocal.extractChapter(tc.url, '');
  assert.strictEqual(result, tc.expected, `Failed for URL ${tc.url}: got "${result}", expected "${tc.expected}"`);
}

// ── Test 2: Chapter Extraction from Page Titles ─────────────────
const titleTestCases = [
  { title: 'Solo Leveling - Capítulo 150 - Neox Scans', expected: 'Cap. 150' },
  { title: 'One Piece Cap 1080 - MangaDex', expected: 'Cap. 1080' },
  { title: 'Martial Peak Ch. 2500 | Read Manga Online', expected: 'Cap. 2500' },
  { title: 'Acees - cp 45 - Site Y', expected: 'Cap. 45' },
  { title: 'Acees - Capitulo 46 Online', expected: 'Cap. 46' },
  { title: 'Boruto: Two Blue Vortex Chapter 10', expected: 'Cap. 10' },
  { title: 'Bleach Chap. 686 Final', expected: 'Cap. 686' },
  { title: 'Jujutsu Kaisen Ep. 24 Legendado', expected: 'Ep. 24' },
  { title: 'Kimetsu no Yaiba Episodio 11 Dublado', expected: 'Ep. 11' }
];

for (const tc of titleTestCases) {
  const result = StorageLocal.extractChapter('', tc.title);
  assert.strictEqual(result, tc.expected, `Failed for Title "${tc.title}": got "${result}", expected "${tc.expected}"`);
}

// ── Test 3: Work Title Sanitization (Strip chapter and site) ────
const titleSanitizeCases = [
  { raw: 'Solo Leveling - Capítulo 150 - Neox Scans', expected: 'Solo Leveling' },
  { raw: 'One Piece Cap. 1080 | MangaDex', expected: 'One Piece' },
  { raw: 'Martial Peak Ch. 2500 - Ler Online', expected: 'Martial Peak' },
  { raw: 'Acees - cp 45 - Site Y', expected: 'Acees' },
  { raw: 'Acees - Capitulo 46 - Site X', expected: 'Acees' },
  { raw: 'Boruto: Two Blue Vortex Chapter 10 - Manga Plus', expected: 'Boruto: Two Blue Vortex' },
  { raw: 'Jujutsu Kaisen Ep 24 Legendado - AnimesOnline', expected: 'Jujutsu Kaisen' },
  { raw: 'Shingeki no Kyojin Episódio 12 Dublado', expected: 'Shingeki no Kyojin' },
  { raw: 'Hunter x Hunter', expected: 'Hunter x Hunter' }
];

for (const tc of titleSanitizeCases) {
  const cleaned = StorageLocal.cleanWorkTitle(tc.raw);
  assert.strictEqual(cleaned, tc.expected, `Sanitize failed for "${tc.raw}": got "${cleaned}", expected "${tc.expected}"`);
}

// ── Test 4: Cross-site matching with same title ─────────────────
// Site X has "Acees - Cap 10 - Site X"
// Site Y has "Acees - cp 15 - Site Y"
const titleX = StorageLocal.cleanWorkTitle('Acees - Cap 10 - Site X');
const titleY = StorageLocal.cleanWorkTitle('Acees - cp 15 - Site Y');

assert.strictEqual(titleX, 'Acees');
assert.strictEqual(titleY, 'Acees');
assert.strictEqual(titleX.toLowerCase(), titleY.toLowerCase(), 'Both sites must clean to identical work name');

console.log('✓ Chapter extraction and title sanitization tests passed successfully!');
