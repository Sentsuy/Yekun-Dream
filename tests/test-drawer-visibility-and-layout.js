const assert = require('assert');
const fs = require('fs');
const path = require('path');

const popupHtml = fs.readFileSync(path.resolve(__dirname, '../popup.html'), 'utf8');
const popupCss  = fs.readFileSync(path.resolve(__dirname, '../popup.css'), 'utf8');
const popupJs   = fs.readFileSync(path.resolve(__dirname, '../popup.js'), 'utf8');

console.log('Testing Drawer Visibility & Full-Height Layout...');

// 1. Element presence in HTML
assert.ok(popupHtml.includes('id="searchBar"'), 'popup.html must have searchBar');
assert.ok(popupHtml.includes('id="settingsPanel"'), 'popup.html must have settingsPanel');
assert.ok(popupHtml.includes('id="entriesList"'), 'popup.html must have entriesList');
assert.ok(popupHtml.includes('id="sitesListView"'), 'popup.html must have sitesListView');
assert.ok(popupHtml.includes('id="bottomNavBar"'), 'popup.html must have bottomNavBar');

// 2. CSS hiding rules when drawers are open
assert.ok(
  popupCss.includes('.app:has(.settings-panel.open) .search-bar') &&
  popupCss.includes('.app:has(.settings-panel.open) .entries-list') &&
  popupCss.includes('.app:has(.settings-panel.open) .bottom-nav-bar'),
  'popup.css must hide search-bar, entries-list, and bottom-nav-bar when settings is open'
);

// 3. CSS full-height expansion
const settingsOpenChunk = popupCss.substring(
  popupCss.indexOf('.settings-panel.open {'),
  popupCss.indexOf('}', popupCss.indexOf('.settings-panel.open {'))
);
assert.ok(settingsOpenChunk.includes('flex: 1'), 'settings-panel.open must have flex: 1');
assert.ok(settingsOpenChunk.includes('max-height: none'), 'settings-panel.open must have max-height: none');

// 4. Form Header with top Save & Red X Cancel button
assert.ok(popupHtml.includes('class="form-header"'), 'popup.html must have form-header container');
assert.ok(popupHtml.includes('id="btnSave"'), 'popup.html must have btnSave in header');
assert.ok(popupHtml.includes('id="btnCancel"'), 'popup.html must have btnCancel in header');
assert.ok(popupHtml.includes('btn-cancel-x'), 'popup.html must have btn-cancel-x with red cancel details');
assert.ok(popupCss.includes('.form-header {'), 'popup.css must style .form-header');
assert.ok(popupCss.includes('.btn-cancel-x {'), 'popup.css must style .btn-cancel-x');

// 5. JS references and synchronization
assert.ok(popupJs.includes("document.getElementById('searchBar')"), 'popup.js must bind searchBar');

// 5. Test mock execution of sync logic
function createMockEl() {
  const classes = new Set();
  return {
    addEventListener: () => {},
    removeEventListener: () => {},
    querySelectorAll: () => [],
    querySelector: () => null,
    appendChild: () => {},
    classList: {
      add: (c) => classes.add(c),
      remove: (c) => classes.delete(c),
      toggle: (c, force) => {
        if (force === true) { classes.add(c); return true; }
        if (force === false) { classes.delete(c); return false; }
        if (classes.has(c)) { classes.delete(c); return false; }
        classes.add(c); return true;
      },
      contains: (c) => classes.has(c)
    },
    style: {},
    dataset: {},
    value: '',
    textContent: '',
    innerHTML: ''
  };
}

global.document = {
  documentElement: { setAttribute: () => {}, getAttribute: () => 'dark' },
  body: { setAttribute: () => {}, getAttribute: () => 'dark' },
  getElementById: () => createMockEl(),
  querySelectorAll: () => [],
  querySelector: () => null,
  createElement: () => createMockEl()
};
global.window = global;
global.chrome = {
  storage: { onChanged: { addListener: () => {} }, local: {} },
  runtime: { onMessage: { addListener: () => {} } }
};
global.StorageLocal = {
  getWorks: async () => [],
  saveSettings: async () => {},
  getSettings: async () => ({})
};

// Check that popup.js can be evaluated without errors
const popup = require('../popup.js');
assert.ok(popup, 'popup.js must load cleanly');

console.log('✓ Drawer visibility and layout tests passed successfully!');
process.exit(0);
