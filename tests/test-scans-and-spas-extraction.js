const assert = require('assert');
const { StorageLocal } = require('../storage-local');

console.log('Testing Real Scans & SPAs Extraction (NexusToons, MangaLivre.lat, MangaLivre.blog)...');

// ── 1. MangaLivre.blog (The Beginning After The End - Cap 253) ──
const blogUrl = 'https://mangalivre.blog/capitulo/the-beginning-after-the-end-capitulo-253/';
const blogRawTitle = ' The Beginning After The End - Capítulo 253 PT-BR - Manga Livre -';

const blogCleanTitle = StorageLocal.cleanWorkTitle(blogRawTitle);
const blogChapter = StorageLocal.extractChapter(blogUrl, blogRawTitle);
const blogSlugTitle = StorageLocal.extractSlugTitle(blogUrl);

assert.strictEqual(blogCleanTitle, 'The Beginning After The End', 'cleanWorkTitle must strip trailing scan and PT-BR');
assert.strictEqual(blogChapter, 'Cap. 253', 'extractChapter must extract Cap. 253 from URL and title');
assert.strictEqual(blogSlugTitle, 'The Beginning After The End', 'extractSlugTitle must extract clean slug without capitulo-253');

// ── 2. MangaLivre.lat - Detalhes da Obra ───────────────────────
const latDetailUrl = 'https://mangalivre.lat/manga/tensura-nikki-tensei-shitara-slime-datta-ken/';
const latDetailRawTitle = 'Tensura Nikki: Tensei Shitara Slime Datta Ken Ler Mangá Online em Português Grátis | Manga Livre';

const latDetailCleanTitle = StorageLocal.cleanWorkTitle(latDetailRawTitle);
assert.strictEqual(
  latDetailCleanTitle,
  'Tensura Nikki: Tensei Shitara Slime Datta Ken',
  'cleanWorkTitle must strip SEO reader slogans and site pipe'
);

// ── 3. MangaLivre.lat - Página de Leitura do Capítulo 14 ───────
const latChapterUrl = 'https://mangalivre.lat/capitulo/tensura-nikki-tensei-shitara-slime-datta-ken-capitulo-14-14-diario-%e3%80%8cum-cobertor-de-neve-em-cima-da-cidade%e3%80%8d/';
const latChapterRawTitle = 'Ler Tensura Nikki: Tensei Shitara Slime Datta Ken - Capítulo 14 - 14° Diário 「Um Cobertor de Neve em Cima da Cidade」 em Português | Manga Livre';

const latChapterCleanTitle = StorageLocal.cleanWorkTitle(latChapterRawTitle);
const latChapter = StorageLocal.extractChapter(latChapterUrl, latChapterRawTitle);
const latSlugTitle = StorageLocal.extractSlugTitle(latChapterUrl);

assert.strictEqual(
  latChapterCleanTitle,
  'Tensura Nikki: Tensei Shitara Slime Datta Ken',
  'cleanWorkTitle must strip leading "Ler " and chapter brackets'
);
assert.strictEqual(latChapter, 'Cap. 14', 'extractChapter must detect Cap. 14');
assert.strictEqual(latSlugTitle, 'Tensura Nikki Tensei Shitara Slime Datta Ken', 'extractSlugTitle must strip chapter from slug');
assert.strictEqual(latChapterCleanTitle, latDetailCleanTitle, 'Titles from details and chapter pages must match 100%');

// ── 4. NexusToons (SPA React/Vite) ─────────────────────────────
const nexusDetailUrl = 'https://nexustoons.com/manga/me-escolha-infinite-gacha';
const nexusReaderUrl = 'https://nexustoons.com/ler/me-escolha-infinite-gacha/10';

const nexusDetailSlug = StorageLocal.extractSlugTitle(nexusDetailUrl);
const nexusReaderSlug = StorageLocal.extractSlugTitle(nexusReaderUrl);
const nexusChapter = StorageLocal.extractChapter(nexusReaderUrl, '');

assert.strictEqual(nexusDetailSlug, 'Me Escolha Infinite Gacha', 'extractSlugTitle must handle /manga/:slug');
assert.strictEqual(nexusReaderSlug, 'Me Escolha Infinite Gacha', 'extractSlugTitle must handle /ler/:slug/:cap');
assert.strictEqual(nexusChapter, 'Cap. 10', 'extractChapter must detect Cap. 10 from /ler/:slug/:cap route');

// ── 4b. NexusToons Encrypted Hash Reader Route (/r/:hash) ──
const tokenUrl = 'https://nexustoons.com/r/ZjFCSVIwRmdFd0JESGxkY1dsa2hTQVljQWhFbERSd3ZIUjF1REE1ZEdSQWNJUUVmSHd3S0RnSUhHRkk4VkJ3TVB6UkhBRHNjT0E4eFhrQUFYaWNnSmpRUUxBa29NaU1xT0FvNnxES3hjTWdBR1VF';
const hash = 'ZjFCSVIwRmdFd0JESGxkY1dsa2hTQVljQWhFbERSd3ZIUjF1REE1ZEdSQWNJUUVmSHd3S0RnSUhHRkk4VkJ3TVB6UkhBRHNjT0E4eFhrQUFYaWNnSmpRUUxBa29NaU1xT0FvNnxES3hjTWdBR1VF';
const dec = StorageLocal.decryptNexusHash(hash);
assert.ok(dec, 'decryptNexusHash must successfully decode Nexus reader token');
assert.strictEqual(dec.mangaSlug, 'o-melhor-engenheiro-do-mundo', 'decrypted slug must match manga slug');
assert.strictEqual(StorageLocal.slugToTitle(dec.mangaSlug), 'O Melhor Engenheiro do Mundo', 'slugToTitle must capitalize correctly with PT-BR prepositions');


// ── 5. Cross-Site Work Matching ────────────────────────────────
const mockWorks = [
  { id: 'w1', name: 'Tensura Nikki: Tensei Shitara Slime Datta Ken', mainChapter: 'Cap. 10', sources: [] },
  { id: 'w2', name: 'The Beginning After The End', mainChapter: 'Cap. 250', sources: [] }
];

const match1 = StorageLocal.findMatchingWork('Tensura Nikki Tensei Shitara Slime Datta Ken', mockWorks);
assert.ok(match1.exactMatch, 'findMatchingWork must match Tensura Nikki without colon as exactMatch');
assert.strictEqual(match1.exactMatch.id, 'w1');

const match2 = StorageLocal.findMatchingWork('The Beginning After The End PT-BR', mockWorks);
assert.ok(
  match2.exactMatch || (match2.suggestions.length > 0 && match2.suggestions[0].score >= 0.85),
  'findMatchingWork must recognize The Beginning After The End with high confidence'
);

console.log('✓ All Real Scans & SPAs extraction tests passed successfully!');
