const assert = require('assert');

// Setup Chrome API mocks
global.chrome = {
  storage: {
    local: {
      _data: {},
      get(keys, cb) {
        const res = {};
        const keyList = Array.isArray(keys) ? keys : [keys];
        for (const k of keyList) {
          if (this._data[k] !== undefined) res[k] = this._data[k];
        }
        if (cb) cb(res);
        return Promise.resolve(res);
      },
      set(obj, cb) {
        Object.assign(this._data, obj);
        if (cb) cb();
        return Promise.resolve();
      },
      clear() {
        this._data = {};
      }
    }
  },
  runtime: {
    lastError: null,
    sendMessage(msg, cb) { if (cb) cb({ ok: true }); }
  }
};

const { StorageLocal } = require('../storage-local');

async function runTests() {
  console.log('Testing Verbatim Title Preservation & Dual-Name / Alias Extraction...');

  // ── 1. StorageLocal.extractDualTitles Unit Tests ────────────────
  assert.strictEqual(typeof StorageLocal.extractDualTitles, 'function', 'StorageLocal.extractDualTitles must be a function');

  // 1.1 Parênteses com nome alternativo
  const dualParen = StorageLocal.extractDualTitles('O Começo Depois do Fim (The Beginning After The End)');
  assert.strictEqual(dualParen.primary, 'O Começo Depois do Fim', 'Primary title must be extracted outside parens verbatim');
  assert.deepStrictEqual(dualParen.aliases, ['The Beginning After The End'], 'Alternative title must be in aliases');

  // 1.2 Barras com nomes alternativos
  const dualSlash = StorageLocal.extractDualTitles('Solo Leveling / Na Honjamun Lebel-eop');
  assert.strictEqual(dualSlash.primary, 'Solo Leveling', 'Primary title before slash must be preserved');
  assert.deepStrictEqual(dualSlash.aliases, ['Na Honjamun Lebel-eop'], 'Name after slash must be in aliases');

  // 1.3 Múltiplas barras
  const multiSlash = StorageLocal.extractDualTitles('Solo Leveling / Na Honjamun Lebel-eop / Only I Level Up');
  assert.strictEqual(multiSlash.primary, 'Solo Leveling');
  assert.deepStrictEqual(multiSlash.aliases, ['Na Honjamun Lebel-eop', 'Only I Level Up']);

  // 1.4 Colchetes com caracteres asiáticos / alternativos
  const dualBracket = StorageLocal.extractDualTitles('Eleceed [일렉시드]');
  assert.strictEqual(dualBracket.primary, 'Eleceed');
  assert.deepStrictEqual(dualBracket.aliases, ['일렉시드']);

  // 1.5 Não deve tratar tags de áudio, resolução ou capítulos como nomes alternativos
  const tagTest1 = StorageLocal.extractDualTitles('One Piece (Capítulo 1050)');
  assert.strictEqual(tagTest1.primary, 'One Piece');
  assert.deepStrictEqual(tagTest1.aliases, [], 'Chapter markers in parens must not be added to aliases');

  const tagTest2 = StorageLocal.extractDualTitles('Dragon Ball Super (Dublado)');
  assert.strictEqual(tagTest2.primary, 'Dragon Ball Super');
  assert.deepStrictEqual(tagTest2.aliases, [], 'Audio tags like Dublado must not be added to aliases');

  const tagTest3 = StorageLocal.extractDualTitles('Chainsaw Man (2022)');
  assert.strictEqual(tagTest3.primary, 'Chainsaw Man');
  assert.deepStrictEqual(tagTest3.aliases, [], 'Release years must not be added to aliases');

  // ── 2. StorageLocal.saveWorkReading — Verbatim & Dual Title Saving ──
  chrome.storage.local.clear();

  // 2.1 Salvamento sem traduzir — salva exatamente como está escrito
  const savedVerbatim = await StorageLocal.saveWorkReading({
    workName: 'O Começo Depois do Fim',
    chapter: 'Cap. 175',
    url: 'https://site.com/ler/tbate/175',
    siteName: 'Site Teste'
  });
  assert.strictEqual(savedVerbatim.name, 'O Começo Depois do Fim', 'Work name must be saved verbatim without translation');

  // 2.2 Salvamento com dois nomes na string workName
  const savedWithDual = await StorageLocal.saveWorkReading({
    workName: 'Solo Leveling / Na Honjamun Lebel-eop',
    chapter: 'Cap. 100',
    url: 'https://site.com/solo-leveling/100',
    siteName: 'Site Teste'
  });
  assert.strictEqual(savedWithDual.name, 'Solo Leveling', 'Primary name must be Solo Leveling');
  assert.ok(savedWithDual.aliases.includes('Na Honjamun Lebel-eop'), 'Alternative name Na Honjamun Lebel-eop must be in aliases');

  // 2.3 Salvamento com parênteses e aliases adicionais fornecidos
  const savedWithParensAndAliases = await StorageLocal.saveWorkReading({
    workName: 'O Retorno do Herói (The Hero Returns)',
    aliases: ['El Regreso Del Heroe'],
    chapter: 'Cap. 20',
    url: 'https://site.com/heroi/20',
    siteName: 'Site Teste'
  });
  assert.strictEqual(savedWithParensAndAliases.name, 'O Retorno do Herói');
  assert.ok(savedWithParensAndAliases.aliases.includes('The Hero Returns'), 'Extracted alias must be present');
  assert.ok(savedWithParensAndAliases.aliases.includes('El Regreso Del Heroe'), 'User-provided alias must be present');
  assert.ok(!savedWithParensAndAliases.aliases.includes('O Retorno do Herói'), 'Work name must not be inside aliases');

  // ── 3. Busca por Nome Principal e Aliases (incluindo busca sem acento) ─
  const allWorks = await StorageLocal.getWorks();
  
  // Função de filtro idêntica à do popup
  function testFilter(works, query) {
    const q = (query || '').toLowerCase().trim();
    if (!q) return works;
    const normQ = StorageLocal.normalizeTitle(q);
    return works.filter(w => {
      const normName = StorageLocal.normalizeTitle(w.name);
      if (w.name.toLowerCase().includes(q) || (normQ && normName.includes(normQ))) return true;
      if (Array.isArray(w.aliases)) {
        for (const a of w.aliases) {
          if (!a) continue;
          if (a.toLowerCase().includes(q)) return true;
          if (normQ && StorageLocal.normalizeTitle(a).includes(normQ)) return true;
        }
      }
      return false;
    });
  }

  // Busca por nome principal exato
  const res1 = testFilter(allWorks, 'O Começo Depois do Fim');
  assert.strictEqual(res1.length, 1);
  assert.strictEqual(res1[0].name, 'O Começo Depois do Fim');

  // Busca por nome principal sem acentos ("Comeco")
  const res2 = testFilter(allWorks, 'comeco');
  assert.strictEqual(res2.length, 1);
  assert.strictEqual(res2[0].name, 'O Começo Depois do Fim');

  // Busca pelo nome alternativo extraído ("Na Honjamun Lebel-eop")
  const res3 = testFilter(allWorks, 'Na Honjamun');
  assert.strictEqual(res3.length, 1);
  assert.strictEqual(res3[0].name, 'Solo Leveling');

  // Busca por outro nome alternativo ("The Hero Returns")
  const res4 = testFilter(allWorks, 'Hero Returns');
  assert.strictEqual(res4.length, 1);
  assert.strictEqual(res4[0].name, 'O Retorno do Herói');

  console.log('✓ All verbatim and dual-name alias tests passed successfully!');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
