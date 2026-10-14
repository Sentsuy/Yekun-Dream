const assert = require('assert');
const fs = require('fs');
const path = require('path');

const manifestPath = path.resolve(__dirname, '../manifest.json');
const popupHtmlPath = path.resolve(__dirname, '../popup.html');
const popupCssPath  = path.resolve(__dirname, '../popup.css');
const popupJsPath   = path.resolve(__dirname, '../popup.js');

const manifest  = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const popupHtml = fs.readFileSync(popupHtmlPath, 'utf8');
const popupCss  = fs.readFileSync(popupCssPath, 'utf8');
const popupJs   = fs.readFileSync(popupJsPath, 'utf8');

console.log('Testing About Panel, Branding, Privacy Manifesto & Pix Test Setup...');

// 1. Manifest branding checks
assert.strictEqual(manifest.name, 'Yekun Dream', 'Manifest name must be Yekun Dream');
assert.strictEqual(manifest.version, '1.2.0', 'Manifest version must be 1.2.0');
assert.ok(manifest.description.includes('Sentsuy'), 'Manifest description must mention Sentsuy');
assert.strictEqual(manifest.action.default_title, 'Yekun Dream', 'Default title must be Yekun Dream');

// 2. Popup HTML branding and About panel
assert.ok(popupHtml.includes('YEKUN') && popupHtml.includes('DREAM'), 'Header brand must display Yekun Dream');
assert.ok(popupHtml.includes('id="btnAbout"'), 'Must have btnAbout button');
assert.ok(popupHtml.includes('id="aboutPanel"'), 'Must have aboutPanel section');
assert.ok(popupHtml.includes('https://sentsuy.ddns.net/'), 'Must link to official website sentsuy.ddns.net');
assert.ok(popupHtml.includes('Sentsuy Corp'), 'Must reference Sentsuy Corp');
assert.ok(popupHtml.includes('Zero Coleta de Dados Pessoais') || popupHtml.includes('Privacidade Total'), 'Must present privacy manifesto');
assert.ok(popupHtml.includes('id="btnCopyPix"'), 'Must have btnCopyPix button');
assert.ok(popupHtml.includes('id="pixTestKey"'), 'Must have pixTestKey input');
assert.ok(popupHtml.includes('id="pixQrBox"'), 'Must have pixQrBox container');

// 3. Popup CSS styling
assert.ok(popupCss.includes('.about-panel'), 'popup.css must style .about-panel');
assert.ok(popupCss.includes('.about-panel.open'), 'popup.css must handle .about-panel.open drawer state');
assert.ok(popupCss.includes('.btn-copy-pix'), 'popup.css must style .btn-copy-pix');
assert.ok(popupCss.includes('.pix-qr-container'), 'popup.css must style .pix-qr-container');

// 4. Popup JS drawer logic and clipboard handlers
assert.ok(popupJs.includes('btnAbout'), 'popup.js must reference btnAbout');
assert.ok(popupJs.includes('aboutPanel'), 'popup.js must reference aboutPanel');
assert.ok(popupJs.includes('toggleAboutDrawer'), 'popup.js must implement toggleAboutDrawer');
assert.ok(popupJs.includes('btnCopyPix'), 'popup.js must handle btnCopyPix click');
assert.ok(popupJs.includes('linkOfficialSite'), 'popup.js must handle official site click');

console.log('✓ All About Panel, Branding and Pix test assertions passed successfully!');
