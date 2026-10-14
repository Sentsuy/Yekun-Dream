const assert = require('assert');
const fs = require('fs');
const path = require('path');

const popupCss = fs.readFileSync(path.resolve(__dirname, '../popup.css'), 'utf8');

console.log('Testing Glare-Free Themes & Comfortable Typography...');

// 1. Dark theme avoids stark 100% white glare
assert.ok(popupCss.includes('--text:         #e2e8f0;'), 'Dark theme must use soft matte off-white #e2e8f0 for prolonged reading comfort');

// 2. Light theme avoids pure harsh black
assert.ok(popupCss.includes('--text:         #1e293b;'), 'Light theme must use comfortable slate #1e293b instead of stark pure black');

// 3. Pink theme avoids overly bright neon pink accent
assert.ok(popupCss.includes('--accent:       #db2777;'), 'Pink theme must use matte flower pink #db2777 instead of harsh neon');

// 4. Semantic status variables present in themes
const requiredVars = [
  '--status-reading-text:',
  '--status-done-text:',
  '--status-paused-text:',
  '--status-dropped-text:',
  '--status-plan-text:',
  '--pub-hiatus-text:',
  '--pub-canceled-text:',
  '--pub-finished-text:'
];

for (const v of requiredVars) {
  assert.ok(popupCss.includes(v), `popup.css must define semantic theme variable ${v}`);
}

// 5. Light theme status badges have readable dark contrast (no washed-out light yellow/green)
assert.strictEqual(popupCss.includes('.pub-hiato {\n  background: rgba(234, 179, 8, 0.15);\n  color: #eab308;'), false,
  'popup.css must not use hardcoded washed-out #eab308 for hiatus in light themes');

// 7. Non-glaring buttons & bottom navigation styling
assert.ok(popupCss.includes('--btn-primary-bg:'), 'popup.css must define calm --btn-primary-bg variable');
assert.ok(popupCss.includes('--btn-continue-bg:'), 'popup.css must define calm --btn-continue-bg variable');
assert.ok(popupCss.includes('--nav-active-bg:'), 'popup.css must define gentle --nav-active-bg variable');

const btnContinueChunk = popupCss.substring(
  popupCss.indexOf('.btn-continue {'),
  popupCss.indexOf('}', popupCss.indexOf('.btn-continue {'))
);
assert.ok(btnContinueChunk.includes('var(--btn-continue-bg)'), 'btn-continue must use calm variable instead of raw neon accent');

const btnSaveChunk = popupCss.substring(
  popupCss.indexOf('.btn-save {'),
  popupCss.indexOf('}', popupCss.indexOf('.btn-save {'))
);
assert.ok(btnSaveChunk.includes('var(--btn-primary-bg)'), 'btn-save must use calm variable instead of raw neon accent');

const bottomNavActiveChunk = popupCss.substring(
  popupCss.indexOf('.bottom-nav-btn.active {'),
  popupCss.indexOf('}', popupCss.indexOf('.bottom-nav-btn.active {'))
);
assert.ok(bottomNavActiveChunk.includes('var(--nav-active-bg)'), 'bottom-nav-btn.active must use subtle variable instead of solid neon block');

console.log('✓ Glare-free themes and comfortable typography tests passed successfully!');
process.exit(0);
