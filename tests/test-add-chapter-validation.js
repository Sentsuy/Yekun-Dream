const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { StorageLocal, DEFAULT_SETTINGS } = require('../storage-local.js');
const popupJs = fs.readFileSync(path.resolve(__dirname, '../popup.js'), 'utf8');
const contentJs = fs.readFileSync(path.resolve(__dirname, '../content.js'), 'utf8');

console.log('═══════════════════════════════════════════════════════');
console.log('   Validação Completa: Função de Adicionar Capítulos   ');
console.log('═══════════════════════════════════════════════════════\n');

// Mock chrome.storage.local
let store = {};
global.chrome = {
  storage: {
    local: {
      get: (keys, cb) => {
        const res = {};
        if (Array.isArray(keys)) {
          keys.forEach(k => { res[k] = store[k]; });
        } else if (typeof keys === 'string') {
          res[keys] = store[keys];
        } else if (typeof keys === 'object' && keys !== null) {
          Object.keys(keys).forEach(k => { res[k] = store[k] !== undefined ? store[k] : keys[k]; });
        } else {
          Object.assign(res, store);
        }
        if (typeof cb === 'function') cb(res);
        return Promise.resolve(res);
      },
      set: (data, cb) => {
        Object.assign(store, data);
        if (typeof cb === 'function') cb();
        return Promise.resolve();
      },
      remove: (keys, cb) => {
        const arr = Array.isArray(keys) ? keys : [keys];
        arr.forEach(k => delete store[k]);
        if (typeof cb === 'function') cb();
        return Promise.resolve();
      }
    }
  },
  runtime: {
    lastError: null
  }
};

async function resetStore() {
  store = {};
  StorageLocal._v3MigrationDone = false;
  await StorageLocal.saveSettings({ ...DEFAULT_SETTINGS });
}

(async () => {
  // ── 1. Incremento Numérico de Capítulos (parseChapterIncrement) ────
  console.log('• Testando regras de cálculo e incremento (+1)...');
  assert.strictEqual(StorageLocal.parseChapterIncrement('Cap. 1'), 'Cap. 2', 'Cap. 1 deve ir para Cap. 2');
  assert.strictEqual(StorageLocal.parseChapterIncrement('Cap. 09'), 'Cap. 10', 'Cap. 09 deve preservar padding e ir para Cap. 10');
  assert.strictEqual(StorageLocal.parseChapterIncrement('Cap. 99'), 'Cap. 100', 'Cap. 99 deve ir para Cap. 100');
  assert.strictEqual(StorageLocal.parseChapterIncrement('Capítulo 150'), 'Capítulo 151', 'Capítulo 150 -> Capítulo 151');
  assert.strictEqual(StorageLocal.parseChapterIncrement('Cap. 10.5'), 'Cap. 11.5', 'Cap. 10.5 -> Cap. 11.5');
  assert.strictEqual(StorageLocal.parseChapterIncrement('Ep. 1'), 'Ep. 2', 'Ep. 1 -> Ep. 2');
  assert.strictEqual(StorageLocal.parseChapterIncrement('Episódio 08'), 'Episódio 09', 'Episódio 08 -> Episódio 09');
  assert.strictEqual(StorageLocal.parseChapterIncrement('Temp 01 - Ep 01'), 'Temp 01 - Ep 02', 'Temp 01 - Ep 01 -> Temp 01 - Ep 02');
  assert.strictEqual(StorageLocal.parseChapterIncrement('S01E09'), 'S01E10', 'S01E09 -> S01E10');
  assert.strictEqual(StorageLocal.parseChapterIncrement('T02E15'), 'T02E16', 'T02E15 -> T02E16');
  assert.strictEqual(StorageLocal.parseChapterIncrement('Filme 1'), 'Filme 2', 'Filme 1 -> Filme 2');
  assert.strictEqual(StorageLocal.parseChapterIncrement('Filme'), 'Filme', 'Filme único avulso não deve alterar');
  assert.strictEqual(StorageLocal.parseChapterIncrement(''), 'Cap. 1', 'String vazia deve ter fallback para Cap. 1');
  console.log('  ✓ Todas as 13 variações de incremento numérico passaram!');

  // ── 2. Comparação de Capítulos (compareChapters) ───────────────
  console.log('• Testando lógica de comparação de capítulos...');
  assert.strictEqual(StorageLocal.compareChapters('Cap. 2', 'Cap. 1') > 0, true, 'Cap. 2 > Cap. 1');
  assert.strictEqual(StorageLocal.compareChapters('Cap. 1', 'Cap. 2') < 0, true, 'Cap. 1 < Cap. 2');
  assert.strictEqual(StorageLocal.compareChapters('Cap. 10', 'Cap. 10'), 0, 'Cap. 10 == Cap. 10');
  assert.strictEqual(StorageLocal.compareChapters('Cap. 10.5', 'Cap. 10') > 0, true, 'Cap. 10.5 > Cap. 10');
  assert.strictEqual(StorageLocal.compareChapters('S02E01', 'S01E12') > 0, true, 'Temporada posterior é maior que anterior com mais episódios');
  assert.strictEqual(StorageLocal.compareChapters('S01E05', 'S01E04') > 0, true, 'Mesma temporada compara episódio');
  console.log('  ✓ Lógica de comparação de capítulos confirmada!');

  // ── 3. Extração de Capítulos por URL e Título (extractChapter) ─
  console.log('• Testando extração de capítulos em diversas rotas de scans...');
  // MangaLivre
  assert.strictEqual(StorageLocal.extractChapter('https://mangalivre.to/manga/solo-leveling/capitulo-10/'), 'Cap. 10');
  // LycanToons (/series/:slug/:cap)
  assert.strictEqual(StorageLocal.extractChapter('https://lycantoons.com/series/meu-tempo-limite/45'), 'Cap. 45');
  // Neox / Tsundoku (/ler/:slug/cap-12 ou /ler/:slug/12)
  assert.strictEqual(StorageLocal.extractChapter('https://neoxscans.net/ler/tower-of-god/capitulo-550'), 'Cap. 550');
  assert.strictEqual(StorageLocal.extractChapter('https://tsundoku.net/ler/martial-peak/1800'), 'Cap. 1800');
  // Rota com ponto e número decimal
  assert.strictEqual(StorageLocal.extractChapter('https://scan.example/manga/obra/capitulo-12.5'), 'Cap. 12.5');
  // Rota de anime
  assert.strictEqual(StorageLocal.extractChapter('https://animesonlinecc.to/episodio/frieren-episodio-12/'), 'Ep. 12');
  // Página inicial da obra (sem capítulo) deve retornar vazio
  assert.strictEqual(StorageLocal.extractChapter('https://lycantoons.com/series/meu-tempo-limite'), '');
  assert.strictEqual(StorageLocal.extractChapter('https://mangalivre.to/manga/solo-leveling/'), '');
  console.log('  ✓ Extração de capítulos compatível com todas as rotas!');

  // ── 4. Adicionar Nova Obra com Capítulo (saveWorkReading) ────────
  console.log('• Testando adição manual de obra e capítulo (saveWorkReading)...');
  await resetStore();
  const created = await StorageLocal.saveWorkReading({
    workName: 'Solo Leveling',
    chapter: 'Cap. 179',
    url: 'https://mangalivre.to/manga/solo-leveling/capitulo-179/',
    siteName: 'Manga Livre',
    tag: 'manhwa',
    readingStatus: 'lendo'
  });

  assert.ok(created && created.id, 'Obra deve ser criada com ID');
  assert.strictEqual(created.name, 'Solo Leveling', 'Nome principal salvo');
  assert.strictEqual(created.mainChapter, 'Cap. 179', 'Capítulo principal salvo');
  assert.strictEqual(created.sources.length, 1, 'Deve possuir 1 fonte');
  assert.strictEqual(created.sources[0].chapter, 'Cap. 179', 'Capítulo na fonte salvo');
  assert.strictEqual(created.history.length, 1, 'Histórico inicial criado');
  assert.strictEqual(created.history[0].chapter, 'Cap. 179', 'Capítulo registrado no histórico');

  // ── 5. Atualizar Capítulo da Mesma Obra e Fonte ──────────────────
  console.log('• Testando atualização de capítulo na mesma obra/fonte...');
  const updated = await StorageLocal.saveWorkReading({
    workId: created.id,
    workName: 'Solo Leveling',
    chapter: 'Cap. 180',
    url: 'https://mangalivre.to/manga/solo-leveling/capitulo-180/',
    siteName: 'Manga Livre'
  });

  assert.strictEqual(updated.id, created.id, 'Mesmo ID mantido');
  assert.strictEqual(updated.mainChapter, 'Cap. 180', 'mainChapter atualizado');
  assert.strictEqual(updated.sources.length, 1, 'Não deve duplicar fonte para o mesmo domínio');
  assert.strictEqual(updated.sources[0].chapter, 'Cap. 180', 'Fonte atualizada para Cap. 180');
  assert.strictEqual(updated.history.length, 2, 'Histórico com 2 entradas');
  assert.strictEqual(updated.history[0].chapter, 'Cap. 180', 'Último histórico é Cap. 180');
  assert.strictEqual(updated.history[1].chapter, 'Cap. 179', 'Histórico anterior preservado');

  // ── 6. Adicionar Segunda Fonte com Capítulo Diferente ───────────
  console.log('• Testando adicionar segunda fonte/scan para a mesma obra...');
  const secondSource = await StorageLocal.saveWorkReading({
    linkToWorkId: created.id,
    workName: 'Solo Leveling',
    chapter: 'Cap. 185',
    url: 'https://reaperscans.com/series/solo-leveling/chapter-185',
    siteName: 'Reaper Scans'
  });

  assert.strictEqual(secondSource.id, created.id, 'Mesma obra associada');
  assert.strictEqual(secondSource.sources.length, 2, 'Agora possui 2 fontes registradas');
  assert.strictEqual(secondSource.mainChapter, 'Cap. 185', 'mainChapter atualizado para a leitura mais recente');
  assert.strictEqual(secondSource.lastReadSourceId, secondSource.sources[1].id, 'lastReadSourceId aponta para nova fonte');

  // ── 7. Ação Rápida de Incremento (+1) via quickIncrementWork ────
  console.log('• Testando ação rápida (+1) direta (quickIncrementWork)...');
  const incResult = await StorageLocal.quickIncrementWork(created.id);
  assert.ok(incResult, 'Incremento bem sucedido');
  assert.strictEqual(incResult.mainChapter, 'Cap. 186', 'Cap. 185 + 1 = Cap. 186');
  const freshList = await StorageLocal.getWorks();
  assert.strictEqual(freshList[0].mainChapter, 'Cap. 186');

  // ── 8. Incremento com URL e Capítulo Fornecido da Aba Ativa ──────
  console.log('• Testando incremento fornecendo capítulo e URL da aba ativa...');
  const activeTabInc = await StorageLocal.quickIncrementWork(created.id, {
    chapter: 'Cap. 190',
    url: 'https://reaperscans.com/series/solo-leveling/chapter-190',
    domain: 'reaperscans.com',
    siteName: 'Reaper Scans'
  });
  assert.strictEqual(activeTabInc.mainChapter, 'Cap. 190', 'Avançou diretamente para Cap. 190');
  assert.strictEqual(activeTabInc.sources.find(s => s.domain === 'reaperscans.com').chapter, 'Cap. 190');

  // ── 9. Trava de Segurança onlyExisting / autoTrack ──────────────
  console.log('• Testando trava anti-fantasma (não criar obra nova no auto-incremento)...');
  const ghost = await StorageLocal.saveWorkReading({
    workName: 'Obra Inexistente Desconhecida',
    chapter: 'Cap. 1',
    url: 'https://random.com/manga/desconhecido/1',
    autoTrack: true,
    onlyExisting: true
  });
  assert.strictEqual(ghost, null, 'Deve retornar null e não poluir o banco');
  const worksAfterGhost = await StorageLocal.getWorks();
  assert.strictEqual(worksAfterGhost.length, 1, 'Total de obras permanece 1');

  // ── 10. Validação de Código no popup.js ─────────────────────────
  console.log('• Validando funções e atalhos de adicionar capítulo no popup.js...');
  assert.ok(popupJs.includes('function handleQuickIncrement'), 'popup.js deve ter handleQuickIncrement');
  assert.ok(popupJs.includes('StorageLocal.parseChapterIncrement'), 'popup.js deve usar StorageLocal.parseChapterIncrement');
  assert.ok(popupJs.includes('StorageLocal.compareChapters'), 'popup.js deve usar StorageLocal.compareChapters');
  assert.ok(popupJs.includes('showConfirmActionModal'), 'popup.js deve ter modal de confirmação para casos de capítulo igual ou menor');
  assert.ok(popupJs.includes('btnSave.addEventListener'), 'popup.js deve ter listener para botão Salvar');
  assert.ok(popupJs.includes('function openForm'), 'popup.js deve ter função openForm para novo/editar/adicionar fonte');
  assert.ok(popupJs.includes('isAnimeSite ? \'Ep. 1\' : \'Cap. 1\''), 'popup.js deve alternar padrão Ep. 1 / Cap. 1 dinamicamente');

  console.log('\n───────────────────────────────────────────────────────');
  console.log('✓ Todos os testes da função de adicionar capítulos PASSARAM!');
  console.log('───────────────────────────────────────────────────────\n');
})().catch(err => {
  console.error('\n❌ FALHA na validação:', err);
  process.exit(1);
});
