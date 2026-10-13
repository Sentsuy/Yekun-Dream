const assert = require('assert');

// Mock chrome.storage.local in Node.js environment
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
  console.log('Testing chapter number parsing...');
  assert.strictEqual(StorageLocal.parseChapterIncrement('Cap. 10'), 'Cap. 11');
  assert.strictEqual(StorageLocal.parseChapterIncrement('Capítulo 45.5'), 'Capítulo 46.5');
  assert.strictEqual(StorageLocal.parseChapterIncrement('Ep. 09'), 'Ep. 10');
  assert.strictEqual(StorageLocal.parseChapterIncrement('1102'), '1103');
  assert.strictEqual(StorageLocal.parseChapterIncrement('Sem número'), 'Sem número +1');

  console.log('Testing default settings...');
  const settings = await StorageLocal.getSettings();
  assert.strictEqual(settings.enableFloatingButton, true);
  assert.strictEqual(settings.enableBadgeCount, true);
  assert.strictEqual(settings.enableQuickIncrement, true);
  assert.strictEqual(settings.enableAutoTitleDetection, true);
  assert.strictEqual(settings.autoTrackAnime, true);

  await StorageLocal.saveSettings({ autoTrackAnime: false });
  const updatedSettings = await StorageLocal.getSettings();
  assert.strictEqual(updatedSettings.autoTrackAnime, false);
  await StorageLocal.saveSettings({ autoTrackAnime: true });

  console.log('Testing save and retrieve entry...');
  const entry = await StorageLocal.saveEntry({
    name: 'Solo Leveling',
    chapter: 'Cap. 179',
    url: 'https://example.com/sl/179',
    tag: 'manga'
  });
  assert.ok(entry.id);
  assert.strictEqual(entry.syncStatus, 'pending');

  let entries = await StorageLocal.getEntries();
  assert.strictEqual(entries.length, 1);
  assert.strictEqual(entries[0].name, 'Solo Leveling');

  console.log('Testing update on existing entry (no duplicate)...');
  const updatedEntry = await StorageLocal.saveEntry({
    name: 'Solo Leveling',
    chapter: 'Cap. 180',
    url: 'https://example.com/sl/180',
    tag: 'manga'
  });
  assert.strictEqual(updatedEntry.id, entry.id);
  entries = await StorageLocal.getEntries();
  assert.strictEqual(entries.length, 1, 'Should not create duplicate card');
  assert.strictEqual(entries[0].chapter, 'Cap. 180');

  console.log('Testing quickIncrementChapter...');
  const incremented = await StorageLocal.quickIncrementChapter(entry.id);
  assert.strictEqual(incremented.chapter, 'Cap. 181');

  console.log('Testing delete (soft delete)...');
  await StorageLocal.deleteEntry(entry.id);
  const activeEntries = await StorageLocal.getEntries();
  assert.strictEqual(activeEntries.length, 0);

  const allEntries = await StorageLocal.getEntries(true);
  assert.strictEqual(allEntries.length, 1);
  assert.strictEqual(allEntries[0].deleted, true);

  console.log('Testing export and import backup...');
  const backupJson = await StorageLocal.exportBackup();
  memoryStore['chapter_tracker_entries_v2'] = [];
  const importedCount = await StorageLocal.importBackup(backupJson);
  assert.strictEqual(importedCount, 1);

  console.log('All storage-local tests passed!');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
