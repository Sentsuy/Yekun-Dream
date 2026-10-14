const assert = require('assert');
const path = require('path');

// Test 1: Module loading
let CanonicalResolver;
try {
  CanonicalResolver = require('../canonical-resolver');
} catch (e) {
  CanonicalResolver = null;
}

assert.ok(CanonicalResolver, 'canonical-resolver module must exist and export an object');

console.log('Testing Canonical Public Resolver...');

// Mock data tests
const mockAniListResponse = {
  data: {
    Media: {
      id: 108341,
      title: {
        romaji: 'The Beginning After the End',
        english: 'The Beginning After The End',
        native: 'The Beginning After The End'
      },
      synonyms: [
        'TBATE',
        'O Começo Depois do Fim'
      ]
    }
  }
};

const mockMangaDexResponse = {
  data: [
    {
      id: '809226a2-6565-42c3-be60-d70377229555',
      attributes: {
        title: {
          en: 'Solo Leveling'
        },
        altTitles: [
          { ko: '나 혼자만 레벨업' },
          { 'pt-br': 'O Único Que Sobe de Nível' },
          { en: 'Only I level up' }
        ]
      }
    }
  ]
};

// 1. Test parsing AniList data
const parsedAniList = CanonicalResolver.parseAniListMedia(mockAniListResponse.data.Media);
assert.strictEqual(parsedAniList.canonicalTitle, 'The Beginning After The End');
assert.strictEqual(parsedAniList.externalId, 'anilist:108341');
assert.ok(parsedAniList.aliases.includes('O Começo Depois do Fim'));
assert.ok(parsedAniList.aliases.includes('TBATE'));

// 2. Test parsing MangaDex data
const parsedMangaDex = CanonicalResolver.parseMangaDexData(mockMangaDexResponse.data[0]);
assert.strictEqual(parsedMangaDex.canonicalTitle, 'Solo Leveling');
assert.strictEqual(parsedMangaDex.externalId, 'mangadex:809226a2-6565-42c3-be60-d70377229555');
assert.ok(parsedMangaDex.aliases.includes('O Único Que Sobe de Nível'));
assert.ok(parsedMangaDex.aliases.includes('Only I level up'));

// 3. Test safe error handling & timeout
(async () => {
  // Should handle non-existent or error gracefully
  const emptyRes = await CanonicalResolver.resolveCanonicalAliases('');
  assert.deepStrictEqual(emptyRes, { canonicalTitle: '', externalId: '', aliases: [] });

  console.log('✓ CanonicalResolver unit tests passed successfully!');
})();
