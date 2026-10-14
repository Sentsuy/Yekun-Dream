const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('Testing Extension Context Invalidation & Re-injection Resilience...');

const canonicalCode = fs.readFileSync(path.join(__dirname, '../canonical-resolver.js'), 'utf8');
const crowdCode     = fs.readFileSync(path.join(__dirname, '../alias-crowd-service.js'), 'utf8');
const storageCode   = fs.readFileSync(path.join(__dirname, '../storage-local.js'), 'utf8');
const contentCode   = fs.readFileSync(path.join(__dirname, '../content.js'), 'utf8');

// ── 1. Test Re-injection in Same Context (simulating content script re-run) ──
const sharedContext = {
  console,
  setTimeout,
  clearTimeout,
  fetch: () => Promise.resolve({ ok: false }),
  chrome: {
    storage: {
      local: {
        get: (k, cb) => cb({}),
        set: (o, cb) => cb && cb()
      }
    },
    runtime: { id: 'test-id' }
  }
};
sharedContext.window = sharedContext;
sharedContext.globalThis = sharedContext;
vm.createContext(sharedContext);

// 1.1 Canonical Resolver re-injection
assert.doesNotThrow(() => {
  vm.runInContext(canonicalCode, sharedContext);
  vm.runInContext(canonicalCode, sharedContext);
}, 'canonical-resolver.js must not throw SyntaxError when injected multiple times into the same context');

// 1.2 Alias Crowd Service re-injection
assert.doesNotThrow(() => {
  vm.runInContext(crowdCode, sharedContext);
  vm.runInContext(crowdCode, sharedContext);
}, 'alias-crowd-service.js must not throw SyntaxError when injected multiple times into the same context');

// 1.3 Storage Local re-injection
assert.doesNotThrow(() => {
  vm.runInContext(storageCode, sharedContext);
  vm.runInContext(storageCode, sharedContext);
}, 'storage-local.js must not throw SyntaxError when injected multiple times into the same context');

// 1.4 Content Script re-injection
assert.doesNotThrow(() => {
  vm.runInContext(contentCode, sharedContext);
  vm.runInContext(contentCode, sharedContext);
}, 'content.js must not throw SyntaxError when injected multiple times into the same context');

// ── 2. Test Invalidated Extension Context Safety ────────────
async function testInvalidatedContext() {
  const invalidContext = {
    console,
    setTimeout,
    clearTimeout,
    chrome: {
      // Quando o contexto é invalidado, runtime.id some e chrome.storage vira undefined
      runtime: undefined,
      storage: undefined
    }
  };
  invalidContext.window = invalidContext;
  invalidContext.globalThis = invalidContext;
  vm.createContext(invalidContext);

  vm.runInContext(storageCode, invalidContext);
  const StorageLocal = invalidContext.StorageLocal;
  assert.ok(StorageLocal, 'StorageLocal must be defined on globalThis');

  // 2.1 getSettings não deve estourar "Cannot read properties of undefined (reading 'local')"
  const settings = await StorageLocal.getSettings();
  assert.ok(settings, 'getSettings must resolve safely when extension context is invalidated');
  assert.strictEqual(typeof settings.theme, 'string', 'Theme default should be returned');

  // 2.2 getWorks deve retornar lista vazia sem estourar erro
  const works = await StorageLocal.getWorks();
  assert.strictEqual(works.length, 0, 'getWorks must resolve empty array when storage is unavailable');

  // 2.3 saveWorkReading deve retornar objeto seguro sem quebrar
  const saved = await StorageLocal.saveWorkReading({
    workName: 'Obra Teste',
    chapter: 'Cap. 1'
  });
  assert.ok(saved, 'saveWorkReading must resolve even if context is invalidated');
  assert.strictEqual(saved.name, 'Obra Teste');

  console.log('✓ All re-injection and extension context safety tests passed successfully!');
}

testInvalidatedContext().catch(err => {
  console.error(err);
  process.exit(1);
});
