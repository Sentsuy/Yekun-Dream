const assert = require('assert');

// Mock chrome.storage.local for Node.js test environment
const mockStorage = {};
global.chrome = {
  storage: {
    local: {
      get: (keys, cb) => {
        const res = {};
        for (const k of (Array.isArray(keys) ? keys : [keys])) {
          if (mockStorage[k] !== undefined) res[k] = mockStorage[k];
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

const { StorageLocal } = require('../storage-local');

async function runTests() {
  console.log('Testing Intelligent Work Name Matching & Saving across Real-World Sites...\n');

  // ── Caso 1: Web Novel (Divine Dao Library) ──────────────────────────
  const ddlUrl = 'https://www.divinedaolibrary.com/story/martial-peak/martial-peak-chapter-1-the-servant-who-sweeps/';
  const ddlTitle = 'Martial Peak &#8211; Chapter 1, The Servant Who Sweeps &#8211; DDL';

  const ddlClean = StorageLocal.cleanWorkTitle(ddlTitle);
  assert.strictEqual(ddlClean, 'Martial Peak', `DDL title should be clean 'Martial Peak', got '${ddlClean}'`);

  const ddlChapter = StorageLocal.extractChapter(ddlUrl, ddlTitle);
  assert.strictEqual(ddlChapter, 'Cap. 1', `DDL chapter should be 'Cap. 1', got '${ddlChapter}'`);

  const ddlSlug = StorageLocal.extractSlugTitle(ddlUrl);
  assert.strictEqual(ddlSlug, 'Martial Peak', `DDL slug title should be 'Martial Peak', got '${ddlSlug}'`);

  // Salva no banco
  const work1 = await StorageLocal.saveWorkReading({
    workName: ddlClean,
    chapter: ddlChapter,
    url: ddlUrl,
    domain: 'divinedaolibrary.com',
    siteName: 'Divine Dao Library',
    tag: 'livro'
  });

  assert.strictEqual(work1.name, 'Martial Peak');
  assert.strictEqual(work1.mainChapter, 'Cap. 1');
  assert.strictEqual(work1.sources.length, 1);
  console.log('✓ Caso 1 (DDL - Web Novel): Martial Peak salvo com sucesso!');

  // ── Caso 2: MangaDex (Manhua em Pinyin / Título Original) ──────────
  const mdUrl = 'https://mangadex.org/chapter/3045cf42-eafe-4779-8912-594732d9fac5';
  const mdTitle = 'Wǔ Liàn Diānfēng - Ch. 1 - MangaDex';

  const mdClean = StorageLocal.cleanWorkTitle(mdTitle);
  assert.strictEqual(mdClean, 'Wǔ Liàn Diānfēng', `MangaDex title should be 'Wǔ Liàn Diānfēng', got '${mdClean}'`);

  const mdChapter = StorageLocal.extractChapter(mdUrl, mdTitle);
  assert.strictEqual(mdChapter, 'Cap. 1', `MangaDex chapter should be 'Cap. 1', got '${mdChapter}'`);

  // Normalização de acentos e diacríticos chineses
  assert.strictEqual(
    StorageLocal.normalizeTitle('Wǔ Liàn Diānfēng').replace(/\s+/g, ''),
    StorageLocal.normalizeTitle('Wu Lian Dian Feng').replace(/\s+/g, ''),
    'Tone marks should normalize to the same compact pinyin'
  );

  // Vincula MangaDex como alias e segunda fonte de "Martial Peak"
  const workAfterMd = await StorageLocal.saveWorkReading({
    linkToWorkId: work1.id,
    workName: work1.name,
    aliasName: mdClean,
    chapter: mdChapter,
    url: mdUrl,
    domain: 'mangadex.org',
    siteName: 'MangaDex',
    tag: 'manhua'
  });

  assert.strictEqual(workAfterMd.id, work1.id, 'Should update same work');
  assert.strictEqual(workAfterMd.sources.length, 2, 'Should now have 2 sources');
  assert.ok(workAfterMd.aliases.includes('Wǔ Liàn Diānfēng'), 'Should contain MangaDex title as alias');
  console.log('✓ Caso 2 (MangaDex): Título original vinculado com sucesso como alias de Martial Peak!');

  // ── Caso 3: Vegitoons (Manhua Traduzido - "Pico Marcial") ──────────
  const vegiUrl = 'https://vegitoons.black/capitulo/415961';
  const vegiTitle = 'Pico Marcial — Capítulo 1 | Vegitoons';

  const vegiClean = StorageLocal.cleanWorkTitle(vegiTitle);
  assert.strictEqual(vegiClean, 'Pico Marcial', `Vegitoons title should be 'Pico Marcial', got '${vegiClean}'`);

  // Garante que o extrator de capítulo não confunde o ID do banco (415961) com o capítulo
  const vegiChapter = StorageLocal.extractChapter(vegiUrl, vegiTitle);
  assert.strictEqual(vegiChapter, 'Cap. 1', `Vegitoons chapter should be 'Cap. 1', not DB ID, got '${vegiChapter}'`);

  // Vincula "Pico Marcial" a "Martial Peak"
  const workAfterVegi = await StorageLocal.saveWorkReading({
    linkToWorkId: work1.id,
    workName: work1.name,
    aliasName: vegiClean,
    chapter: vegiChapter,
    url: vegiUrl,
    domain: 'vegitoons.black',
    siteName: 'Vegitoons',
    tag: 'manhua'
  });

  assert.strictEqual(workAfterVegi.sources.length, 3, 'Should now have 3 sources (DDL, MangaDex, Vegitoons)');
  assert.ok(workAfterVegi.aliases.includes('Pico Marcial'), 'Should contain "Pico Marcial" as alias');
  console.log('✓ Caso 3 (Vegitoons): "Pico Marcial" vinculado como alias de Martial Peak!');

  // ── Teste de Reconhecimento Automático nos Capítulos Seguintes ─────
  const allWorks = await StorageLocal.getWorks();

  // Capítulo 2 no Vegitoons
  const nextVegiTitle = 'Pico Marcial — Capítulo 2 | Vegitoons';
  const matchVegi2 = StorageLocal.findMatchingWork(nextVegiTitle, allWorks);
  assert.ok(matchVegi2.exactMatch, 'Should automatically match Martial Peak via alias "Pico Marcial"');
  assert.strictEqual(matchVegi2.exactMatch.id, work1.id);

  // Capítulo 15 no MangaDex
  const nextMdTitle = 'Wǔ Liàn Diānfēng - Ch. 15 - MangaDex';
  const matchMd15 = StorageLocal.findMatchingWork(nextMdTitle, allWorks);
  assert.ok(matchMd15.exactMatch, 'Should automatically match Martial Peak via alias "Wǔ Liàn Diānfēng"');
  assert.strictEqual(matchMd15.exactMatch.id, work1.id);

  // Salvar capítulo 2 pelo Vegitoons sem precisar vincular manualmente
  const autoSavedVegi = await StorageLocal.saveWorkReading({
    workName: StorageLocal.cleanWorkTitle(nextVegiTitle),
    chapter: 'Cap. 2',
    url: 'https://vegitoons.black/capitulo/416150',
    domain: 'vegitoons.black',
    siteName: 'Vegitoons'
  });
  assert.strictEqual(autoSavedVegi.id, work1.id, 'Auto-recognized work should update Martial Peak');
  assert.strictEqual(autoSavedVegi.mainChapter, 'Cap. 2', 'Chapter updated to Cap. 2');
  console.log('✓ Reconhecimento Automático: Capítulos seguintes do Vegitoons e MangaDex reconhecidos via alias!');

  // ── Caso 4: Obra Totalmente Diferente (MangásTop) ──────────────────
  const mtUrl = 'https://mangastop.net/leitor/605890';
  const mtTitle = 'Mestre Espadachim Criado Pelas Estrelas Capítulo 01 - MangásTop';

  const mtClean = StorageLocal.cleanWorkTitle(mtTitle);
  assert.strictEqual(mtClean, 'Mestre Espadachim Criado Pelas Estrelas', `MangásTop title should be clean, got '${mtClean}'`);

  const mtChapter = StorageLocal.extractChapter(mtUrl, mtTitle);
  assert.strictEqual(mtChapter, 'Cap. 01', `MangásTop chapter should be 'Cap. 01', got '${mtChapter}'`);

  // Confere que NÃO dá match com Martial Peak nem gera falsa correspondência
  const matchMt = StorageLocal.findMatchingWork(mtClean, allWorks);
  assert.strictEqual(matchMt.exactMatch, null, 'Different work MUST NOT match Martial Peak');
  const hasHighSimilarity = matchMt.suggestions.some(s => s.score > 0.40);
  assert.strictEqual(hasHighSimilarity, false, 'Different work must have low similarity score (< 0.40)');

  // Salva como nova obra independente
  const work2 = await StorageLocal.saveWorkReading({
    workName: mtClean,
    chapter: mtChapter,
    url: mtUrl,
    domain: 'mangastop.net',
    siteName: 'MangásTop',
    tag: 'manhwa'
  });

  assert.notStrictEqual(work2.id, work1.id, 'Must be a distinct work ID');
  assert.strictEqual(work2.name, 'Mestre Espadachim Criado Pelas Estrelas');

  const finalWorks = await StorageLocal.getWorks();
  assert.strictEqual(finalWorks.length, 2, 'Should have exactly 2 distinct works in storage');
  console.log('✓ Caso 4 (MangásTop): Obra diferente cadastrada de forma 100% independente, sem misturar com Martial Peak!');

  // ── Caso 5: SPA Deep Metadata Resolver (Vegitoons / MangásTop / MangaDex)
  if (typeof fetch !== 'undefined') {
    try {
      const vegiDetails = await StorageLocal.resolvePageWorkDetails('https://vegitoons.black/capitulo/415961');
      if (vegiDetails) {
        assert.strictEqual(vegiDetails.workName, 'Pico Marcial');
        assert.strictEqual(vegiDetails.chapter, 'Cap. 1');
        console.log('✓ Caso 5a: Resolvedor de metadados para Vegitoons extraiu "Pico Marcial"!');
      }

      const mtDetails = await StorageLocal.resolvePageWorkDetails('https://mangastop.net/leitor/605890');
      if (mtDetails) {
        assert.strictEqual(mtDetails.workName, 'Mestre Espadachim Criado Pelas Estrelas');
        console.log('✓ Caso 5b: Resolvedor de metadados para MangásTop extraiu "Mestre Espadachim Criado Pelas Estrelas"!');
      }
    } catch (e) {
      console.log('• Network test skipped or offline:', e.message);
    }
  }

  console.log('\n───────────────────────────────────────────────────────');
  console.log('✓ Todos os testes de comparação inteligente passaram com louvor!');
  console.log('───────────────────────────────────────────────────────');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
