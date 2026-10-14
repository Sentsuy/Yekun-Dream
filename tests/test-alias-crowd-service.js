const assert = require('assert');

let AliasCrowdService;
try {
  AliasCrowdService = require('../alias-crowd-service');
} catch (e) {
  AliasCrowdService = null;
}

assert.ok(AliasCrowdService, 'alias-crowd-service module must exist and export an object');

console.log('Testing AliasCrowdService consensus & integrity rules...');

// 1. Sanitization tests
assert.strictEqual(AliasCrowdService.sanitizeAliasInput('https://site.com/manga'), null, 'URLs must be rejected');
assert.strictEqual(AliasCrowdService.sanitizeAliasInput('ab'), null, 'Strings with length < 3 must be rejected');
assert.strictEqual(AliasCrowdService.sanitizeAliasInput('Capítulo 14 - Solo Leveling'), null, 'Chapter numbers must be rejected');
assert.strictEqual(
  AliasCrowdService.sanitizeAliasInput('O Começo Depois do Fim'),
  'O Começo Depois do Fim',
  'Clean book title must be accepted'
);

// 2. Normalization
assert.strictEqual(
  AliasCrowdService.normalizeAliasKey('  O Começo Depois do Fim!  '),
  'o comeco depois do fim'
);

// 3. Consensus Quorum tests
const memoryDb = {};
const testService = AliasCrowdService.createServiceInstance({
  getStore: async () => memoryDb,
  setStore: async (data) => Object.assign(memoryDb, data)
});

(async () => {
  // First user maps "O Começo Depois do Fim" -> "The Beginning After The End"
  const res1 = await testService.submitAliasLink({
    alias: 'O Começo Depois do Fim',
    canonicalTitle: 'The Beginning After The End',
    externalId: 'anilist:108341',
    userFingerprint: 'user_A'
  });

  assert.strictEqual(res1.status, 'pending', 'First vote must have status pending');
  assert.strictEqual(res1.votes, 1, 'First vote must have vote count 1');

  // Lookup before quorum
  const lookup1 = await testService.lookupAlias('O Começo Depois do Fim');
  assert.ok(lookup1.match, 'Lookup should find match');
  assert.strictEqual(lookup1.isVerified, false, 'Before quorum, match is not verified');

  // Same user repeating does not increment votes
  const resDup = await testService.submitAliasLink({
    alias: 'O Começo Depois do Fim',
    canonicalTitle: 'The Beginning After The End',
    userFingerprint: 'user_A'
  });
  assert.strictEqual(resDup.votes, 1, 'Duplicate user submission must not increase vote count');

  // Second independent user confirms the same link
  const res2 = await testService.submitAliasLink({
    alias: 'O Começo Depois do Fim',
    canonicalTitle: 'The Beginning After The End',
    userFingerprint: 'user_B'
  });
  assert.strictEqual(res2.status, 'verified', 'Second independent vote must reach quorum and be verified');
  assert.strictEqual(res2.votes, 2, 'Vote count should be 2');

  const lookup2 = await testService.lookupAlias('o comeco depois do fim');
  assert.strictEqual(lookup2.isVerified, true, 'After quorum, match must be verified');
  assert.strictEqual(lookup2.match.canonicalTitle, 'The Beginning After The End');

  // 4. Conflict prevention (trying to map "O Começo Depois do Fim" -> "Another Random Manga")
  const conflictRes = await testService.submitAliasLink({
    alias: 'O Começo Depois do Fim',
    canonicalTitle: 'Another Random Manga',
    userFingerprint: 'user_C'
  });

  assert.strictEqual(conflictRes.conflict, true, 'Conflicting canonical target must be flagged');
  const lookupAfterConflict = await testService.lookupAlias('O Começo Depois do Fim');
  assert.strictEqual(
    lookupAfterConflict.match.canonicalTitle,
    'The Beginning After The End',
    'Original verified canonical mapping must not be overwritten by conflicting submission'
  );

  console.log('✓ AliasCrowdService consensus & integrity tests passed successfully!');
})();
