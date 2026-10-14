const assert = require('assert');
const { StorageLocal } = require('../storage-local');

console.log('Testing Series and Movies Divergence Normalization...');

// ── 1. Extração e Normalização de Séries (Temporada + Episódio) ──
const seriesSeasonEpisodeCases = [
  { url: 'https://site.com/series/breaking-bad/s01e01', title: '', expected: 'Temp 01 - Ep 01' },
  { url: 'https://site.com/series/the-boys/s1e2', title: '', expected: 'Temp 01 - Ep 02' },
  { url: 'https://site.com/series/loki/s02-e06', title: '', expected: 'Temp 02 - Ep 06' },
  { url: '', title: 'Stranger Things S04E09 Legendado', expected: 'Temp 04 - Ep 09' },
  { url: '', title: 'House of the Dragon Temporada 2 Episodio 4', expected: 'Temp 02 - Ep 04' },
  { url: '', title: 'Fallout 1ª Temporada Ep 1 Online', expected: 'Temp 01 - Ep 01' },
  { url: '', title: 'Dark T03E08 Dublado', expected: 'Temp 03 - Ep 08' },
  { url: 'https://site.com/series/stranger-things/temporada-4/episodio-9', title: '', expected: 'Temp 04 - Ep 09' },
];

for (const tc of seriesSeasonEpisodeCases) {
  const result = StorageLocal.extractChapter(tc.url, tc.title);
  assert.strictEqual(
    result,
    tc.expected,
    `Series extraction failed for url="${tc.url}" title="${tc.title}": got "${result}", expected "${tc.expected}"`
  );
}
console.log('✓ Series (Season + Episode) extraction tests passed');

// ── 2. Extração de Episódio Avulso (E1, E01, Ep. 1) ─────────────
const standaloneEpisodeCases = [
  { url: '', title: 'Re:Zero E1 Online', expected: 'Ep. 1' },
  { url: '', title: 'One Piece E1070 Legendado', expected: 'Ep. 1070' },
  { url: 'https://site.com/anime/naruto/e05', title: '', expected: 'Ep. 5' },
  { url: 'https://site.com/anime/naruto/ep-12', title: '', expected: 'Ep. 12' },
];

for (const tc of standaloneEpisodeCases) {
  const result = StorageLocal.extractChapter(tc.url, tc.title);
  assert.strictEqual(
    result,
    tc.expected,
    `Standalone episode extraction failed for url="${tc.url}" title="${tc.title}": got "${result}", expected "${tc.expected}"`
  );
}
console.log('✓ Standalone episode extraction tests passed');

// ── 3. Extração e Detecção de Filmes ─────────────────────────────
const movieCases = [
  { url: 'https://site.com/filme/oppenheimer', title: '', expected: 'Filme' },
  { url: '', title: 'Oppenheimer Filme Completo', expected: 'Filme' },
  { url: '', title: 'Deadpool - Filme 1', expected: 'Filme 1' },
  { url: '', title: 'Deadpool - Filme 2', expected: 'Filme 2' },
  { url: '', title: 'Jujutsu Kaisen 0 Movie Legendado', expected: 'Filme' },
];

for (const tc of movieCases) {
  const result = StorageLocal.extractChapter(tc.url, tc.title);
  assert.strictEqual(
    result,
    tc.expected,
    `Movie extraction failed for url="${tc.url}" title="${tc.title}": got "${result}", expected "${tc.expected}"`
  );
}
console.log('✓ Movie extraction tests passed');

// ── 4. Limpeza de Título (cleanWorkTitle) ────────────────────────
const sanitizeCases = [
  { raw: 'Breaking Bad Temp 01 - Ep 01 1080p - Site', expected: 'Breaking Bad' },
  { raw: 'Breaking Bad S01E01 1080p - Site', expected: 'Breaking Bad' },
  { raw: 'Dark T03E08 Dublado', expected: 'Dark' },
  { raw: 'Stranger Things Temporada 4 Episódio 9', expected: 'Stranger Things' },
  { raw: 'One Piece E1070 Legendado', expected: 'One Piece' },
  { raw: 'Oppenheimer Filme Completo Dublado', expected: 'Oppenheimer' },
  { raw: 'Duna Filme Online HD', expected: 'Duna' },
  { raw: 'Assistir Homem-Aranha Filme', expected: 'Homem-Aranha' },
];

for (const tc of sanitizeCases) {
  const cleaned = StorageLocal.cleanWorkTitle(tc.raw);
  assert.strictEqual(
    cleaned,
    tc.expected,
    `Sanitization failed for "${tc.raw}": got "${cleaned}", expected "${tc.expected}"`
  );
}
console.log('✓ Title sanitization for series/movies tests passed');

// ── 5. Incremento Inteligente (parseChapterIncrement) ────────────
const incrementCases = [
  { current: 'Temp 01 - Ep 01', expected: 'Temp 01 - Ep 02' },
  { current: 'Temp 01 - Ep 09', expected: 'Temp 01 - Ep 10' },
  { current: 'Temp 02 - Ep 99', expected: 'Temp 02 - Ep 100' },
  { current: 'S 01 Ep. 01', expected: 'S 01 Ep. 02' },
  { current: 'S 01 Ep. 09', expected: 'S 01 Ep. 10' },
  { current: 'S 02 Ep. 99', expected: 'S 02 Ep. 100' },
  { current: 'S01E01', expected: 'S01E02' },
  { current: 'S01E09', expected: 'S01E10' },
  { current: 'S02E99', expected: 'S02E100' },
  { current: 'S03E12', expected: 'S03E13' },
  { current: 'Ep. 1', expected: 'Ep. 2' },
  { current: '1', expected: '2' },
  { current: 'Cap. 5', expected: 'Cap. 6' },
  { current: 'Filme 1', expected: 'Filme 2' },
  { current: 'Filme', expected: 'Filme' },
];

for (const tc of incrementCases) {
  const next = StorageLocal.parseChapterIncrement(tc.current);
  assert.strictEqual(
    next,
    tc.expected,
    `Increment failed for "${tc.current}": got "${next}", expected "${tc.expected}"`
  );
}
console.log('✓ parseChapterIncrement for series/movies tests passed');

// ── 6. Categoria / Tag "Filme" na UI e CSS ──────────────────────
const fs = require('fs');
const path = require('path');
const popupHtml = fs.readFileSync(path.resolve(__dirname, '../popup.html'), 'utf8');
const popupCss = fs.readFileSync(path.resolve(__dirname, '../popup.css'), 'utf8');
const contentJs = fs.readFileSync(path.resolve(__dirname, '../content.js'), 'utf8');

assert.ok(popupHtml.includes('data-tag="filme"'), 'popup.html must have data-tag="filme" button');
assert.ok(popupHtml.includes('value="filme"'), 'popup.html must have value="filme" option in category filter');
assert.ok(popupCss.includes('--tag-filme:'), 'popup.css must define --tag-filme variable');
assert.ok(popupCss.includes('.avatar-filme'), 'popup.css must define .avatar-filme class');
assert.ok(popupCss.includes('.cat-filme'), 'popup.css must define .cat-filme class');
assert.ok(popupCss.includes('.dot-filme'), 'popup.css must define .dot-filme class');
assert.ok(contentJs.includes('data-tag="filme"'), 'content.js must have data-tag="filme" in floating widget');
assert.ok(contentJs.includes('.ct-tag.active[data-tag="filme"]'), 'content.js must style active filme tag');
console.log('✓ Tag "Filme" UI and styling tests passed');

console.log('All series and movies divergence tests PASSED!');
