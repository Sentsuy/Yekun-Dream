const assert = require('assert');
const { StorageLocal } = require('../storage-local');
const AliasCrowdService = require('../alias-crowd-service');

console.log('Testing Collaborative Alias & Storage Integration...');

(async () => {
  const mockWorks = [
    {
      id: 'work_tbate',
      name: 'The Beginning After The End',
      aliases: ['TBATE'],
      mainChapter: 'Cap. 250',
      sources: []
    }
  ];

  // 1. Initial lookup for unknown Portuguese name "O Começo Depois do Fim" fails
  const initialMatch = StorageLocal.findMatchingWork('O Começo Depois do Fim', mockWorks);
  assert.strictEqual(initialMatch.exactMatch, null, 'Unmapped Portuguese title should not match yet');

  // 2. Crowd service registers "O Começo Depois do Fim" -> "The Beginning After The End" (with quorum)
  await AliasCrowdService.submitAliasLink({
    alias: 'O Começo Depois do Fim',
    canonicalTitle: 'The Beginning After The End',
    userFingerprint: 'u1'
  });
  await AliasCrowdService.submitAliasLink({
    alias: 'O Começo Depois do Fim',
    canonicalTitle: 'The Beginning After The End',
    userFingerprint: 'u2'
  });

  // 3. StorageLocal findMatchingWorkAsync directly resolves via crowd lookup
  const asyncMatch = await StorageLocal.findMatchingWorkAsync('O Começo Depois do Fim', mockWorks);
  assert.ok(asyncMatch.exactMatch, 'Must match existing work via findMatchingWorkAsync and crowd lookup');
  assert.strictEqual(asyncMatch.exactMatch.id, 'work_tbate');
  assert.strictEqual(asyncMatch.viaAlias, 'O Começo Depois do Fim');

  console.log('✓ Collaborative alias integration tests passed successfully!');
})();
