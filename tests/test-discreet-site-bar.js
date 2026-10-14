const assert = require('assert');
const fs = require('fs');
const path = require('path');

const popupHtml = fs.readFileSync(path.resolve(__dirname, '../popup.html'), 'utf8');
const popupCss  = fs.readFileSync(path.resolve(__dirname, '../popup.css'), 'utf8');
const popupJs   = fs.readFileSync(path.resolve(__dirname, '../popup.js'), 'utf8');

console.log('Testing Discreet Site Button & Domain Concealment...');

// 1. Popup HTML single-line structure & label
assert.ok(popupHtml.includes('id="sitePermissionBar"'), 'popup.html must have sitePermissionBar');
assert.ok(popupHtml.includes('id="toggleCurrentSite"'), 'popup.html must have toggleCurrentSite');
assert.ok(popupHtml.includes('id="currentSiteDomain"'), 'popup.html must preserve currentSiteDomain for JS logic');
assert.ok(popupHtml.includes('Botão neste site'), 'popup.html must display clean "Botão neste site" label');
assert.strictEqual(popupHtml.includes('class="site-permission-text"'), false, 'multi-line site-permission-text must be removed');

// 2. CSS discreet styling & domain concealment
assert.ok(popupCss.includes('.site-permission-domain {'), 'popup.css must style .site-permission-domain');
const domainCssChunk = popupCss.substring(
  popupCss.indexOf('.site-permission-domain {'),
  popupCss.indexOf('}', popupCss.indexOf('.site-permission-domain {'))
);
assert.ok(domainCssChunk.includes('display: none'), 'site-permission-domain must be hidden from UI to prevent raw IP/link clutter');

// 3. Popup.js tooltip & discreet toast
assert.ok(popupJs.includes('sitePermissionBar.title ='), 'popup.js must set domain in tooltip rather than raw interface text');
assert.ok(popupJs.includes("showToast(enable ? '✓ Botão ativado neste site' : '✗ Botão desativado neste site')"),
  'popup.js toast should be clean and discreet without raw domain exposure');

console.log('✓ Discreet site button and domain concealment tests passed successfully!');
