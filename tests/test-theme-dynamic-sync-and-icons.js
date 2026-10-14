const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const contentJs   = fs.readFileSync(path.join(root, 'content.js'), 'utf8');
const popupJs     = fs.readFileSync(path.join(root, 'popup.js'), 'utf8');
const backgroundJs = fs.readFileSync(path.join(root, 'background.js'), 'utf8');
const iconSvg     = fs.readFileSync(path.join(root, 'icons/icon.svg'), 'utf8');

console.log('Testing Theme Dynamic Sync, Multi-Theme Floating Button & Icons...');

// 1. Icon files verification
const expectedIconFiles = [
  'icons/icon.svg',
  'icons/icon-dark.svg',
  'icons/icon-light.svg',
  'icons/icon-pink.svg',
  'icons/icon16.png',
  'icons/icon32.png',
  'icons/icon48.png',
  'icons/icon128.png',
  'icons/icon-dark-16.png',
  'icons/icon-dark-32.png',
  'icons/icon-dark-48.png',
  'icons/icon-dark-128.png',
  'icons/icon-light-16.png',
  'icons/icon-light-32.png',
  'icons/icon-light-48.png',
  'icons/icon-light-128.png',
  'icons/icon-pink-16.png',
  'icons/icon-pink-32.png',
  'icons/icon-pink-48.png',
  'icons/icon-pink-128.png'
];

for (const rel of expectedIconFiles) {
  const fullPath = path.join(root, rel);
  assert.ok(fs.existsSync(fullPath), `Icon file must exist: ${rel}`);
  assert.ok(fs.statSync(fullPath).size > 0, `Icon file must not be empty: ${rel}`);
}

// 2. Neon yellow removal from SVG
assert.ok(!iconSvg.includes('#e8ff47'), 'Master icon.svg must not contain old neon yellow #e8ff47');
assert.ok(iconSvg.includes('#38bdf8'), 'Master icon.svg must use Yekun Dream Sky Blue #38bdf8 accent');

// 3. content.js floating button multi-theme support
assert.ok(contentJs.includes('data-theme="light"'), 'content.js must define light theme styles');
assert.ok(contentJs.includes('data-theme="pink"'), 'content.js must define pink theme styles');
assert.ok(contentJs.includes('var(--accent)'), 'content.js must use var(--accent) for FAB and panel elements');
assert.ok(contentJs.includes('applyTheme'), 'content.js must define applyTheme function');
assert.ok(contentJs.includes('YEKUN') && contentJs.includes('DREAM'), 'content.js panel must display YEKUN DREAM branding');

// 4. popup.js dynamic action icon & tab broadcasting
assert.ok(popupJs.includes('updateActionIcon'), 'popup.js must implement updateActionIcon');
assert.ok(popupJs.includes('chrome.action.setIcon'), 'popup.js must call chrome.action.setIcon');
assert.ok(popupJs.includes('broadcastSettingsToTabs(appSettings)'), 'popup.js must broadcast settings to tabs on theme switch');

// 5. background.js startup & storage icon sync
assert.ok(backgroundJs.includes('syncActionIcon'), 'background.js must implement syncActionIcon');
assert.ok(backgroundJs.includes('chrome.action.setIcon'), 'background.js must call chrome.action.setIcon');
assert.ok(backgroundJs.includes('chrome.storage.onChanged'), 'background.js must listen to storage changes for icon sync');

console.log('✓ All Theme Dynamic Sync and Icon tests passed successfully!');
