const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { DEFAULT_SETTINGS } = require('../storage-local');

// 1. Settings default test
assert.ok(DEFAULT_SETTINGS.theme, 'DEFAULT_SETTINGS must specify a default theme');

// 2. CSS theme check
const popupCss = fs.readFileSync(path.resolve(__dirname, '../popup.css'), 'utf8');
assert.ok(popupCss.includes('[data-theme="dark"]') || popupCss.includes(':root'), 'popup.css must define dark theme');
assert.ok(popupCss.includes('[data-theme="light"]'), 'popup.css must define light theme');
assert.ok(popupCss.includes('[data-theme="pink"]'), 'popup.css must define pink theme');

// Yellow check: neon yellow #e8ff47 must be gone from popup.css
assert.strictEqual(popupCss.includes('#e8ff47'), false, 'Neon yellow #e8ff47 must be removed from popup.css');
assert.strictEqual(popupCss.includes('#d4eb30'), false, 'Yellow hover #d4eb30 must be removed from popup.css');

// 3. Content.js yellow check
const contentJs = fs.readFileSync(path.resolve(__dirname, '../content.js'), 'utf8');
assert.strictEqual(contentJs.includes('#e8ff47'), false, 'Neon yellow #e8ff47 must be removed from content.js');

// 4. HTML theme switcher and SVG check
const popupHtml = fs.readFileSync(path.resolve(__dirname, '../popup.html'), 'utf8');
assert.ok(popupHtml.includes('themeSwitcher') || popupHtml.includes('theme-btn'), 'popup.html must have theme switcher');
assert.ok(popupHtml.includes('svg-icon'), 'popup.html must use svg icons');
assert.strictEqual(/[📖🌐↗✎✕＋▼⚙]/.test(popupHtml), false, 'popup.html must not contain legacy icon emojis/glyphs');

// 5. Popup.js theme handling and SVG icons check
const popupJs = fs.readFileSync(path.resolve(__dirname, '../popup.js'), 'utf8');
assert.ok(popupJs.includes('applyTheme') || popupJs.includes('data-theme'), 'popup.js must support applying themes');
assert.ok(popupJs.includes('initThemeSwitcher'), 'popup.js must initialize theme switcher');
assert.ok(popupJs.includes('ICONS'), 'popup.js must define ICONS vector SVG map');
assert.strictEqual(/[📖🌐↗✎✕＋▼⚙]/.test(popupJs), false, 'popup.js must not contain legacy icon emojis/glyphs');

console.log('✓ Themes and SVG icons test passed successfully!');

