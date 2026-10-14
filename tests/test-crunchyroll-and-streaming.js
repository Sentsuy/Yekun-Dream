const assert = require('assert');
const { StorageLocal } = require('../storage-local');

console.log('Testing Crunchyroll and Streaming Extraction...');

// ── 1. Test cleanWorkTitle com sufixos da Crunchyroll ────────────
const crunchyrollTitleCases = [
  { raw: 'Danganronpa 3 - Episódio 1 - Despair - Assistir na Crunchyroll', expected: 'Danganronpa 3' },
  { raw: 'Solo Leveling - Assistir na Crunchyroll', expected: 'Solo Leveling' },
  { raw: 'Frieren: Beyond Journey\'s End | Crunchyroll', expected: 'Frieren: Beyond Journey\'s End' },
  { raw: 'Jujutsu Kaisen Ep. 24 - Watch on Crunchyroll', expected: 'Jujutsu Kaisen' },
  { raw: 'Despair - Assistir na Crunchyroll', expected: 'Despair' },
];

for (const tc of crunchyrollTitleCases) {
  const cleaned = StorageLocal.cleanWorkTitle(tc.raw);
  assert.strictEqual(
    cleaned,
    tc.expected,
    `cleanWorkTitle failed for "${tc.raw}": got "${cleaned}", expected "${tc.expected}"`
  );
}
console.log('✓ cleanWorkTitle Crunchyroll suffix stripping passed');

// ── 2. Test extractSlugTitle para URLs da Crunchyroll ─────────────
const crunchyrollSlugCases = [
  {
    url: 'https://www.crunchyroll.com/pt-br/series/G4PH0WXVJ/danganronpa-3-the-end-of-hopes-peak-high-school',
    expected: 'Danganronpa 3 the End of Hopes Peak High School'
  },
  {
    url: 'https://www.crunchyroll.com/series/G24H1N3XX/solo-leveling',
    expected: 'Solo Leveling'
  }
];

for (const tc of crunchyrollSlugCases) {
  const result = StorageLocal.extractSlugTitle(tc.url);
  assert.strictEqual(
    result.toLowerCase(),
    tc.expected.toLowerCase(),
    `extractSlugTitle failed for "${tc.url}": got "${result}", expected "${tc.expected}"`
  );
}
console.log('✓ extractSlugTitle Crunchyroll series route passed');

// ── 3. Test de extração DOM / JSON-LD simulada ───────────────────
// Simulando a lógica que o content.js executa para páginas da Crunchyroll
function simulateCrunchyrollExtract({ title, url, htmlElements = [], jsonLd }) {
  let domWorkTitle = '';
  let chapter = '';

  const isSeriesPage = /\/series\/[A-Za-z0-9_-]+/i.test(url);

  // 1. CENÁRIO: Página de Catálogo da Própria Série (/series/:id/:slug)
  if (isSeriesPage) {
    // 1.1 H1 da própria página de série (ignora se estiver no cabeçalho)
    const h1El = htmlElements.find(el => el.tag === 'h1' && !el.inHeader);
    if (h1El && h1El.text) {
      const cleaned = StorageLocal.cleanWorkTitle(h1El.text);
      if (cleaned && !StorageLocal.isSeasonDescriptor(cleaned) && !/^(?:crunchyroll|in[íi]cio|home|browse|navegar|s[eé]ries|animes)$/i.test(cleaned)) {
        domWorkTitle = cleaned;
      }
    }

    // 1.2 JSON-LD Schema.org TVSeries
    if (!domWorkTitle && jsonLd) {
      const list = Array.isArray(jsonLd) ? jsonLd : (jsonLd['@graph'] || [jsonLd]);
      for (const item of list) {
        if (item && (item['@type'] === 'TVSeries' || item['@type'] === 'Series') && item.name) {
          domWorkTitle = item.name.trim();
          break;
        }
      }
    }

    // 1.3 Slug da URL da série atual
    if (!domWorkTitle) {
      const slugTitle = StorageLocal.extractSlugTitle(url);
      if (slugTitle && !StorageLocal.isSeasonDescriptor(slugTitle)) {
        domWorkTitle = slugTitle;
      }
    }
  }

  // 2. CENÁRIO: Página de Reprodução / Episódio (/watch/:id/:slug) ou Outras Rotas
  if (!domWorkTitle) {
    // 2.1 JSON-LD Schema.org TVEpisode
    if (jsonLd) {
      try {
        const list = Array.isArray(jsonLd) ? jsonLd : (jsonLd['@graph'] || [jsonLd]);
        for (const item of list) {
          if (item && (item.partOfSeries || item.partOfTVSeries)) {
            const seriesObj = item.partOfSeries || item.partOfTVSeries;
            const sName = typeof seriesObj === 'string' ? seriesObj : (seriesObj.name || '');
            if (sName && sName.trim().length > 1) {
              domWorkTitle = sName.trim();
            }
            if (!chapter) {
              const epNum = item.episodeNumber;
              const seasonNum = item.partOfSeason && (item.partOfSeason.seasonNumber || item.partOfSeason.seasonDisplayNumber);
              if (seasonNum && epNum) {
                const sPadded = String(seasonNum).padStart(2, '0');
                const epInt = parseInt(epNum, 10);
                const ePadded = epInt < 100 ? String(epInt).padStart(2, '0') : String(epInt);
                chapter = `Temp ${sPadded} - Ep ${ePadded}`;
              } else if (epNum) {
                chapter = `Ep. ${epNum}`;
              }
            }
            if (domWorkTitle) break;
          }
        }
      } catch (_) {}
    }

    // 2.2 Seletores semânticos do player e links fora do header
    if (!domWorkTitle && htmlElements) {
      const showLink = htmlElements.find(el => el.tag === 'a' && (el.className === 'show-title-link' || el.href?.includes('/series/')) && !el.inHeader);
      if (showLink) {
        const slugTitle = StorageLocal.extractSlugTitle(showLink.href || '');
        if (slugTitle && !StorageLocal.isSeasonDescriptor(slugTitle)) {
          const txt = (showLink.text || '').trim();
          if (txt && !StorageLocal.isSeasonDescriptor(txt) && txt.length > 1 && !/^(?:in[íi]cio|home|series|animes|crunchyroll)$/i.test(txt)) {
            domWorkTitle = txt;
          } else {
            domWorkTitle = slugTitle;
          }
        }
      }
    }
  }

  const cleanTitle = domWorkTitle ? StorageLocal.cleanWorkTitle(domWorkTitle) : StorageLocal.cleanWorkTitle(title);
  if (!chapter) {
    chapter = StorageLocal.extractChapter(url, title);
  }

  return { title: cleanTitle, chapter };
}


// Caso A: Crunchyroll com link .show-title-link (ex: /pt-br/watch/G0DUN4K8P/despair)
const caseA = simulateCrunchyrollExtract({
  title: 'Despair - Assistir na Crunchyroll',
  url: 'https://www.crunchyroll.com/pt-br/watch/G0DUN4K8P/despair',
  htmlElements: [
    {
      tag: 'a',
      href: '/pt-br/series/G4PH0WXVJ/danganronpa-3-the-end-of-hopes-peak-high-school',
      className: 'show-title-link',
      text: 'Danganronpa 3: The End of Hope\'s Peak High School - Despair Arc'
    },
    { tag: 'h1', text: 'Despair' }
  ]
});

assert.strictEqual(
  caseA.title,
  'Danganronpa 3: The End of Hope\'s Peak High School',
  `Deve capturar o nome do anime e não o nome do episódio. Obtido: "${caseA.title}"`
);

// Caso B: Crunchyroll com JSON-LD
const caseB = simulateCrunchyrollExtract({
  title: 'Despair | Crunchyroll',
  url: 'https://www.crunchyroll.com/pt-br/watch/G0DUN4K8P/despair',
  jsonLd: {
    '@context': 'https://schema.org',
    '@type': 'TVEpisode',
    name: 'Despair',
    episodeNumber: 1,
    partOfSeries: {
      '@type': 'TVSeries',
      name: 'Danganronpa 3'
    }
  }
});

assert.strictEqual(caseB.title, 'Danganronpa 3', 'Deve extrair o nome do anime via JSON-LD');
assert.strictEqual(caseB.chapter, 'Ep. 1', 'Deve extrair o episódio via JSON-LD');

// Caso C: Rilakkuma na Crunchyroll (URL: /pt-br/watch/GE00375528PTBR/episode-1)
// O DOM contém acordeão com "1ª Temporada | E1 - Episódio 1", mas o link da série aponta para /series/GT00374493/rilakkuma
const caseC = simulateCrunchyrollExtract({
  title: '1ª Temporada | E1 - Episódio 1 - Assistir na Crunchyroll',
  url: 'https://www.crunchyroll.com/pt-br/watch/GE00375528PTBR/episode-1',
  htmlElements: [
    {
      tag: 'a',
      href: 'https://www.crunchyroll.com/pt-br/series/GT00374493/rilakkuma',
      text: 'RILAKKUMA'
    },
    { tag: 'h4', text: '1ª Temporada | E1 - Episódio 1' }
  ],
  jsonLd: {
    '@type': 'TVEpisode',
    episodeNumber: 1,
    partOfSeason: { seasonNumber: 1 }
  }
});

assert.strictEqual(caseC.title.toLowerCase(), 'rilakkuma', 'Deve capturar Rilakkuma e ignorar "1ª Temporada | E1 - Episódio 1"');
assert.strictEqual(caseC.chapter, 'Temp 01 - Ep 01', 'Deve formatar capítulo visualmente limpo como "Temp 01 - Ep 01"');

// Caso D: Incremento de Temp 01 - Ep 01
const nextEp = StorageLocal.parseChapterIncrement('Temp 01 - Ep 01');
assert.strictEqual(nextEp, 'Temp 01 - Ep 02', `Incremento rápido deve avançar para Temp 01 - Ep 02. Obtido: "${nextEp}"`);

// Caso E: Catálogo de Série Rilakkuma
const catalogTitle = StorageLocal.extractSlugTitle('https://www.crunchyroll.com/pt-br/series/GT00374493/rilakkuma');
assert.strictEqual(catalogTitle, 'Rilakkuma', 'Deve extrair título correto na página de catálogo');

// Caso F: Página de Série com links do header/navegação (Caso real relatado pelo usuário)
const caseF = simulateCrunchyrollExtract({
  title: 'Full Clearing Another World Under a Goddess with Zero Believers - Assistir na Crunchyroll',
  url: 'https://www.crunchyroll.com/pt-br/series/GT00383992/full-clearing-another-world-under-a-goddess-with-zero-believers',
  htmlElements: [
    // Links de catálogo e menu do cabeçalho que aparecem antes do conteúdo
    { tag: 'a', href: '/pt-br/series/G69V3VMEY/solo-leveling', text: 'Solo Leveling', inHeader: true },
    { tag: 'a', href: '/pt-br/series/GY8VCP1M6/one-piece', text: 'One Piece', inHeader: true },
    { tag: 'h1', text: 'Full Clearing Another World Under a Goddess with Zero Believers', className: 'title' }
  ],
  jsonLd: {
    '@type': 'TVSeries',
    name: 'Full Clearing Another World Under a Goddess with Zero Believers'
  }
});

assert.strictEqual(
  caseF.title,
  'Full Clearing Another World Under a Goddess with Zero Believers',
  `Deve extrair o título da série atual e NÃO links de outros animes do cabeçalho. Obtido: "${caseF.title}"`
);

// Caso G: Página de Série sem H1 (fallback de slug da URL /series/...) ignorando links do cabeçalho
const caseG = simulateCrunchyrollExtract({
  title: 'Assistir na Crunchyroll',
  url: 'https://www.crunchyroll.com/pt-br/series/GT00383992/full-clearing-another-world-under-a-goddess-with-zero-believers',
  htmlElements: [
    { tag: 'a', href: '/pt-br/series/G69V3VMEY/solo-leveling', text: 'Solo Leveling', inHeader: true }
  ]
});

assert.strictEqual(
  caseG.title,
  'Full Clearing Another World Under a Goddess With Zero Believers',
  `Deve usar o slug da própria URL da série quando H1 não existir, sem pegar o cabeçalho. Obtido: "${caseG.title}"`
);

// Caso H: Página de Episódio com links no cabeçalho e show-title-link no player
const caseH = simulateCrunchyrollExtract({
  title: 'O Herói e a Deusa - Full Clearing Another World - Assistir na Crunchyroll',
  url: 'https://www.crunchyroll.com/pt-br/watch/GZ7UV823G/the-hero-and-the-goddess',
  htmlElements: [
    { tag: 'a', href: '/pt-br/series/G69V3VMEY/solo-leveling', text: 'Solo Leveling', inHeader: true },
    { tag: 'h1', text: 'O Herói e a Deusa' },
    {
      tag: 'a',
      href: '/pt-br/series/GT00383992/full-clearing-another-world-under-a-goddess-with-zero-believers',
      className: 'show-title-link',
      text: 'Full Clearing Another World Under a Goddess with Zero Believers'
    }
  ],
  jsonLd: {
    '@type': 'TVEpisode',
    episodeNumber: 1,
    partOfSeason: { seasonNumber: 1 },
    partOfSeries: {
      '@type': 'TVSeries',
      name: 'Full Clearing Another World Under a Goddess with Zero Believers'
    }
  }
});

assert.strictEqual(
  caseH.title,
  'Full Clearing Another World Under a Goddess with Zero Believers',
  `Deve priorizar a série do player/JSON-LD e ignorar cabeçalho e H1 do episódio. Obtido: "${caseH.title}"`
);
assert.strictEqual(caseH.chapter, 'Temp 01 - Ep 01', 'Deve extrair Temp 01 - Ep 01');

console.log('✓ Simulated Crunchyroll extraction tests passed successfully!');
console.log('All Crunchyroll tests PASSED!');
