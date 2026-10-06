const assert = require('assert');

// Mock chrome.storage.local
const memoryStore = {};
global.chrome = {
  storage: {
    local: {
      get: (keys, callback) => {
        const res = {};
        if (Array.isArray(keys)) {
          keys.forEach(k => res[k] = memoryStore[k]);
        } else if (typeof keys === 'string') {
          res[keys] = memoryStore[keys];
        }
        callback(res);
      },
      set: (obj, callback) => {
        Object.assign(memoryStore, obj);
        if (callback) callback();
      }
    }
  }
};

const { StorageLocal } = require('../storage-local');

(async function runTests() {
  console.log('--- TEST 1: Auto-migration from v2 to v3 ---');
  // Seed v2 data
  memoryStore['chapter_tracker_entries_v2'] = [
    {
      id: 'old_entry_1',
      name: 'Martial Peak',
      chapter: 'Cap. 100',
      url: 'https://mangadex.org/chapter/12345',
      tag: 'manga',
      createdAt: 1000,
      updatedAt: 1000,
      deleted: false
    }
  ];
  delete memoryStore['chapter_tracker_entries_v3'];

  assert.strictEqual(typeof StorageLocal.getWorks, 'function', 'StorageLocal.getWorks must exist');

  const works = await StorageLocal.getWorks();
  assert.strictEqual(works.length, 1, 'Should migrate 1 work from v2');
  const w = works[0];
  assert.strictEqual(w.name, 'Martial Peak');
  assert.strictEqual(w.mainChapter, 'Cap. 100');
  assert.strictEqual(w.sources.length, 1, 'Should have 1 migrated source');
  assert.strictEqual(w.sources[0].domain, 'mangadex.org');
  assert.strictEqual(w.sources[0].chapter, 'Cap. 100');
  assert.strictEqual(w.history.length, 1, 'Should have 1 initial history item');
  assert.ok(memoryStore['chapter_tracker_entries_v2'], 'v2 backup must be preserved');

  console.log('--- TEST 2: Add new source to existing work (multi-source linking) ---');
  const updatedWork = await StorageLocal.saveWorkReading({
    workName: 'Martial Peak',
    chapter: 'Cap. 120',
    url: 'https://neoxscans.net/obra/mp/cap-120',
    tag: 'manga'
  });

  assert.strictEqual(updatedWork.id, w.id, 'Must link to the same work');
  assert.strictEqual(updatedWork.sources.length, 2, 'Work must now have 2 sources');
  assert.strictEqual(updatedWork.mainChapter, 'Cap. 120', 'Main chapter updated');
  assert.strictEqual(updatedWork.history.length, 2, 'History must have 2 entries');

  const neoxSource = updatedWork.sources.find(s => s.domain === 'neoxscans.net');
  assert.ok(neoxSource, 'Neox source must exist');
  assert.strictEqual(neoxSource.chapter, 'Cap. 120');

  console.log('--- TEST 3: Update existing source in the same work ---');
  const reUpdated = await StorageLocal.saveWorkReading({
    workName: 'Martial Peak',
    chapter: 'Cap. 105',
    url: 'https://mangadex.org/chapter/99999',
    tag: 'manga'
  });

  assert.strictEqual(reUpdated.sources.length, 2, 'Source count remains 2');
  const mdSource = reUpdated.sources.find(s => s.domain === 'mangadex.org');
  assert.strictEqual(mdSource.chapter, 'Cap. 105');
  assert.strictEqual(reUpdated.history.length, 3, 'History now has 3 events');
  assert.strictEqual(reUpdated.history[0].chapter, 'Cap. 105', 'Latest history is first');

  console.log('--- TEST 4: Quick increment on work (+1 on active source) ---');
  const incResult = await StorageLocal.quickIncrementWork(w.id);
  assert.ok(incResult);
  assert.strictEqual(incResult.mainChapter, 'Cap. 106');
  assert.strictEqual(incResult.sources.find(s => s.id === incResult.lastReadSourceId).chapter, 'Cap. 106');
  assert.strictEqual(incResult.history.length, 4);

  console.log('--- TEST 5: Delete single source ---');
  const srcIdToDelete = neoxSource.id;
  const afterSourceDelete = await StorageLocal.deleteSource(w.id, srcIdToDelete);
  assert.strictEqual(afterSourceDelete.sources.length, 1);
  assert.strictEqual(afterSourceDelete.sources[0].domain, 'mangadex.org');

  console.log('--- TEST 6: Delete entire work (soft delete) ---');
  await StorageLocal.deleteWork(w.id);
  const activeWorks = await StorageLocal.getWorks();
  assert.strictEqual(activeWorks.length, 0);
  const allWorks = await StorageLocal.getWorks(true);
  assert.strictEqual(allWorks.length, 1);
  assert.strictEqual(allWorks[0].deleted, true);

  console.log('--- TEST 7: Export and Import backup v3 ---');
  const backupJson = await StorageLocal.exportBackup();
  memoryStore['chapter_tracker_entries_v3'] = [];
  const count = await StorageLocal.importBackup(backupJson);
  assert.strictEqual(count, 1);
  const restored = await StorageLocal.getWorks(true);
  assert.strictEqual(restored.length, 1);
  assert.strictEqual(restored[0].name, 'Martial Peak');

  console.log('✓ All storage-v3 tests passed successfully!');
})().catch(err => {
  console.error('FAIL in storage-v3 tests:', err.message);
  process.exit(1);
});
