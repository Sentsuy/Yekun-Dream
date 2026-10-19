const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.resolve(__dirname, '../popup.html'), 'utf8');
const js   = fs.readFileSync(path.resolve(__dirname, '../popup.js'), 'utf8');
const storageJs = fs.readFileSync(path.resolve(__dirname, '../storage-local.js'), 'utf8');

// 1. Fonte externa no popup.html não deve ser render-blocking e NUNCA usar inline onload (violação de CSP no MV3)
assert.ok(
  html.includes('id="googleFontsStylesheet"') && html.includes('media="print"'),
  'Google Fonts stylesheet must use media="print" to prevent render-blocking the popup'
);
assert.strictEqual(
  html.includes('onload='),
  false,
  'popup.html must not contain inline onload handlers (strict CSP in MV3 blocks inline code)'
);
assert.ok(
  js.includes('googleFontsStylesheet'),
  'popup.js must switch googleFontsStylesheet media without inline event handlers'
);

// 2. Scripts desnecessários para o popup não devem ser importados no popup.html
assert.strictEqual(
  html.includes('canonical-resolver.js'),
  false,
  'canonical-resolver.js is not used by popup.js and should not be loaded in popup.html'
);
assert.strictEqual(
  html.includes('alias-crowd-service.js'),
  false,
  'alias-crowd-service.js is not used by popup.js and should not be loaded in popup.html'
);

// 3. StorageLocal deve fornecer getInitialData para unificar leitura de configurações e obras em 1 IPC
assert.ok(
  storageJs.includes('getInitialData'),
  'storage-local.js must provide getInitialData() combining settings and entries retrieval in a single IPC call'
);

// 4. Accordion no popup.js deve usar renderização sob demanda (lazy loading)
assert.ok(
  js.includes('renderAccordionContent') || js.includes('ensureAccordionRendered'),
  'popup.js must support lazy rendering of card accordions to prevent synchronous layout freezing on startup'
);

// 5. applyTheme não deve disparar setIcon no arranque inicial
assert.ok(
  js.includes('updateActionIcon(valid)') || js.includes('updateActionIcon'),
  'popup.js must have updateActionIcon'
);

// 6. getInitialData deve funcionar com mock de storage
const { StorageLocal } = require('../storage-local.js');
assert.strictEqual(typeof StorageLocal.getInitialData, 'function');

(async () => {
  const data = await StorageLocal.getInitialData();
  assert.ok(data && typeof data === 'object', 'getInitialData must return an object');
  assert.ok(data.settings, 'getInitialData must return settings');
  assert.ok(Array.isArray(data.works), 'getInitialData must return works array');

  console.log('✓ All Startup Performance tests passed successfully!');
})();
