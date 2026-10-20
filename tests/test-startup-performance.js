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

// 6. getInitialData deve funcionar com mock de storage e unificar notificações e cache de identidade
const { StorageLocal } = require('../storage-local.js');
const { IdentityService } = require('../identity-service.js');
assert.strictEqual(typeof StorageLocal.getInitialData, 'function');
assert.strictEqual(typeof IdentityService.primeCache, 'function', 'IdentityService must support primeCache for zero-latency startup');

// 7. popup.js deve conter renderização progressiva por lotes (chunking) e não travar o paint inicial
assert.ok(js.includes('BATCH_SIZE'), 'popup.js must define BATCH_SIZE for progressive chunked rendering');
assert.ok(js.includes('_currentRenderToken'), 'popup.js must track render tokens to cancel stale batches');
assert.ok(js.includes('updateNotificationUnreadDot(notifications)'), 'popup.js must pass pre-loaded notifications to updateNotificationUnreadDot');

(async () => {
  const data = await StorageLocal.getInitialData();
  assert.ok(data && typeof data === 'object', 'getInitialData must return an object');
  assert.ok(data.settings, 'getInitialData must return settings');
  assert.ok(Array.isArray(data.works), 'getInitialData must return works array');
  assert.ok(Array.isArray(data.notifications), 'getInitialData must return notifications array in single IPC');
  assert.ok(data.identityCache && typeof data.identityCache === 'object', 'getInitialData must return identityCache bundle');

  // Test primeCache integration
  IdentityService.primeCache({
    userSignedOut: false,
    customProEmail: 'perf-test@example.com',
    proEmailSource: 'custom',
    credentials: { accessPin: '123456', deviceToken: 'tok_perf_test' }
  });

  const idInfo = await IdentityService.getIdentityInfo();
  assert.strictEqual(idInfo.email, 'perf-test@example.com', 'IdentityService should resolve email instantly from primed cache');

  const creds = await IdentityService.getStoredCredentials();
  assert.strictEqual(creds.accessPin, '123456', 'IdentityService should resolve credentials instantly from primed cache');

  console.log('✓ All Startup Performance tests passed successfully!');
})();
