const assert = require('assert');
const { StorageLocal } = require('../storage-local');

console.log('Testing AnimesOnline and Anime Extraction Pipeline...');

// ── 1. Test cleanWorkTitle para AnimesOnline ──────────────────────
const titleCases = [
  {
    raw: 'Hell Mode: Yarikomizuki no Gamer wa Hai Settei no Isekai de Musou suru – Episódio 2 - Animes Online CC',
    expected: 'Hell Mode: Yarikomizuki no Gamer wa Hai Settei no Isekai de Musou suru'
  },
  {
    raw: 'Hell Mode: Yarikomizuki no Gamer wa Hai Settei no Isekai de Musou suru Episodio 2 Online - Animes Online',
    expected: 'Hell Mode: Yarikomizuki no Gamer wa Hai Settei no Isekai de Musou suru'
  },
  {
    raw: 'Hell Mode: Yarikomizuki no Gamer wa Hai Settei no Isekai de Musou suru Todos os Episodios Online',
    expected: 'Hell Mode: Yarikomizuki no Gamer wa Hai Settei no Isekai de Musou suru'
  },
  {
    raw: 'Hell Mode: Yarikomizuki no Gamer wa Hai Settei no Isekai de Musou suru Episodio 2 Online',
    expected: 'Hell Mode: Yarikomizuki no Gamer wa Hai Settei no Isekai de Musou suru'
  }
];

for (const tc of titleCases) {
  const cleaned = StorageLocal.cleanWorkTitle(tc.raw);
  assert.strictEqual(
    cleaned,
    tc.expected,
    `cleanWorkTitle failed for "${tc.raw}": got "${cleaned}", expected "${tc.expected}"`
  );
}
console.log('✓ cleanWorkTitle AnimesOnline cleaning passed');

// ── 2. Test extractChapter para URLs e títulos de AnimesOnline ────
const chapterCases = [
  {
    url: 'https://animesonlinecc.to/episodio/hell-mode-yarikomizuki-no-gamer-wa-hai-settei-no-isekai-de-musou-suru-episodio-2/',
    title: 'Hell Mode: Yarikomizuki no Gamer wa Hai Settei no Isekai de Musou suru Episodio 2 Online',
    expected: 'Ep. 2'
  },
  {
    url: 'https://animesonlinecc.to/episodio/solo-leveling-season-2-arise-from-the-shadow-episodio-12/',
    title: 'Solo Leveling Season 2: Arise from the Shadow Episódio 12 Online',
    expected: 'Ep. 12'
  }
];

for (const cc of chapterCases) {
  const result = StorageLocal.extractChapter(cc.url, cc.title);
  assert.strictEqual(
    result,
    cc.expected,
    `extractChapter failed for "${cc.url}": got "${result}", expected "${cc.expected}"`
  );
}
console.log('✓ extractChapter AnimesOnline passed');

// ── 3. Test extractSlugTitle para rotas de anime ─────────────────
const slugCases = [
  {
    url: 'https://animesonlinecc.to/episodio/hell-mode-yarikomizuki-no-gamer-wa-hai-settei-no-isekai-de-musou-suru-episodio-2/',
    expected: 'Hell Mode Yarikomizuki no Gamer wa Hai Settei no Isekai de Musou Suru'
  },
  {
    url: 'https://animesonlinecc.to/anime/hell-mode-yarikomizuki-no-gamer-wa-hai-settei-no-isekai-de-musou-suru/',
    expected: 'Hell Mode Yarikomizuki no Gamer wa Hai Settei no Isekai de Musou Suru'
  }
];

for (const sc of slugCases) {
  const result = StorageLocal.extractSlugTitle(sc.url);
  assert.strictEqual(
    result.toLowerCase(),
    sc.expected.toLowerCase(),
    `extractSlugTitle failed for "${sc.url}": got "${result}", expected "${sc.expected}"`
  );
}
console.log('✓ extractSlugTitle anime routes passed');

// ── 4. Test Simulação de isolamento DOM (Driver vs Fallback) ──────
// Garante que links de navegação como "Todos os episódios" nunca são capturados como título
const candidateLinksToTest = [
  { text: 'Todos os episodios', href: 'https://animesonlinecc.to/anime/hell-mode-yarikomizuki-no-gamer-wa-hai-settei-no-isekai-de-musou-suru/' },
  { text: 'ALL', href: 'https://animesonlinecc.to/anime/' },
  { text: 'Lista de Animes', href: '/anime/' }
];

const ignoreRegex = /^(?:in[íi]cio|home|todos\s+os\s+(?:mang[aá]s|epis[oó]dios|cap[íi]tulos|filmes)|todos\s+os\s+epis[oó]dios|mang[aá]s|animes|cat[aá]logo|menu|lista|all|cap[íi]tulo|chapter|epis[óo]dio|episode|crunchyroll)/i;

for (const link of candidateLinksToTest) {
  assert.strictEqual(
    ignoreRegex.test(link.text),
    true,
    `Link de navegação "${link.text}" deve ser ignorado para não contaminar o título da obra`
  );
}
console.log('✓ Candidate links ignore regex prevents title contamination');

// ── 5. Test Auto-tagging para Animes / Séries / Filmes ─────────────
function determineDefaultTag({ detectedChapter, domain }) {
  if (/^filme/i.test(detectedChapter || '')) return 'filme';
  if (detectedChapter && /^[st]\d+e\d+/i.test(detectedChapter)) return 'serie';
  if (detectedChapter && /^ep\./i.test(detectedChapter)) return 'anime';
  if (domain && (domain.includes('anime') || domain.includes('crunchyroll'))) return 'anime';
  return 'manga';
}

assert.strictEqual(determineDefaultTag({ detectedChapter: 'Ep. 2', domain: 'animesonlinecc.to' }), 'anime');
assert.strictEqual(determineDefaultTag({ detectedChapter: 'Ep. 1', domain: 'crunchyroll.com' }), 'anime');
assert.strictEqual(determineDefaultTag({ detectedChapter: 'S01E05', domain: 'netflix.com' }), 'serie');
assert.strictEqual(determineDefaultTag({ detectedChapter: 'Filme', domain: 'algumsite.com' }), 'filme');
assert.strictEqual(determineDefaultTag({ detectedChapter: 'Cap. 12', domain: 'mangalivre.net' }), 'manga');

console.log('✓ Auto-tag determination logic passed');
console.log('All AnimesOnline tests PASSED!');
