const assert = require('assert');
const fs = require('fs');
const path = require('path');

const popupHtml = fs.readFileSync(path.resolve(__dirname, '../popup.html'), 'utf8');
const popupJs   = fs.readFileSync(path.resolve(__dirname, '../popup.js'), 'utf8');

console.log('Testing Popup Aliases UI Management...');

// 1. Popup HTML element
assert.ok(popupHtml.includes('id="inputAliases"'), 'popup.html must have inputAliases element');
assert.ok(
  popupHtml.includes('NOMES ALTERNATIVOS') || popupHtml.includes('ALIASES'),
  'popup.html must have clear label for aliases'
);

// 2. Popup JS binding
assert.ok(popupJs.includes('inputAliases'), 'popup.js must reference inputAliases');
assert.ok(
  popupJs.includes('work.aliases') || popupJs.includes('aliases'),
  'popup.js must handle work.aliases on edit and save'
);

// Mock chrome.storage.local for functional testing
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

(async () => {
  // 3. Functional: create work with aliases
  const created = await StorageLocal.saveWorkReading({
    workName: 'The Beginning After The End',
    aliases: ['TBATE', 'O Começo Depois do Fim'],
    chapter: 'Cap. 100',
    url: 'https://site.com/tbate/100'
  });

  assert.ok(created, 'Work must be created');
  assert.ok(Array.isArray(created.aliases), 'Work aliases must be an array');
  assert.strictEqual(created.aliases.length, 2);
  assert.ok(created.aliases.includes('TBATE'));
  assert.ok(created.aliases.includes('O Começo Depois do Fim'));

  // 4. Functional: edit work aliases
  const updated = await StorageLocal.saveWorkReading({
    workId: created.id,
    workName: 'The Beginning After The End',
    aliases: ['TBATE', 'O Começo Depois do Fim', 'The Beginning'],
    chapter: 'Cap. 101',
    url: 'https://site.com/tbate/101'
  });

  assert.strictEqual(updated.aliases.length, 3);
  assert.ok(updated.aliases.includes('The Beginning'));

  console.log('✓ Popup Aliases UI & Functional storage tests passed successfully!');
})();

