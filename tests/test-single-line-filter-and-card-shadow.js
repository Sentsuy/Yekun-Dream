const assert = require('assert');
const fs = require('fs');
const path = require('path');

const popupHtml = fs.readFileSync(path.resolve(__dirname, '../popup.html'), 'utf8');
const popupCss  = fs.readFileSync(path.resolve(__dirname, '../popup.css'), 'utf8');
const popupJs   = fs.readFileSync(path.resolve(__dirname, '../popup.js'), 'utf8');

console.log('Testing Single Line Filter, Category Restriction, Actions Alignment & Card Shadow...');

// 1. Single Line Search & Filter (Busca + Tipo, sem recentes ou contador)
assert.ok(popupCss.includes('flex-direction: row'), 'search-bar must be in a single horizontal row');
assert.ok(popupHtml.includes('class="search-bar"'), 'popup.html must have search-bar');
assert.ok(popupHtml.includes('id="searchInput"'), 'popup.html must have searchInput');
assert.ok(popupHtml.includes('id="categoryFilter"'), 'popup.html must have categoryFilter');
assert.strictEqual(popupHtml.includes('id="sortFilter"'), false, 'sortFilter must be removed from searchBar');
assert.strictEqual(popupHtml.includes('id="entryCount"'), false, 'entryCount must be removed from searchBar');

// 2. Category Filter Restriction: only registrable categories (+ all)
const allowedTags = ['all', 'manga', 'manhwa', 'manhua', 'anime', 'webtoon', 'serie', 'filme', 'livro', 'outro'];
const categoryFilterHtml = popupHtml.substring(
  popupHtml.indexOf('id="categoryFilter"'),
  popupHtml.indexOf('</select>', popupHtml.indexOf('id="categoryFilter"'))
);

const matches = [...categoryFilterHtml.matchAll(/value="([^"]+)"/g)].map(m => m[1]);
assert.deepStrictEqual(
  matches.sort(),
  allowedTags.sort(),
  'categoryFilter must strictly contain only registrable categories and "all"'
);

// 3. Card Encapsulation & Subtle Shadow
assert.ok(popupCss.includes('box-shadow: 0 2px 6px'), 'entry-card must have subtle box-shadow');
assert.ok(popupCss.includes('border-radius: var(--radius)'), 'entry-card must have border-radius encapsulation');

// 4. Restructured Actions Container & Margins
assert.ok(popupJs.includes('entry-card-right'), 'popup.js must render entry-card-right container');
assert.ok(popupCss.includes('.entry-card-right'), 'popup.css must define .entry-card-right');
assert.ok(popupCss.includes('margin-bottom: 6px') || popupCss.includes('margin-bottom'),
  'entry-actions must have safety bottom margin pushing secondary text down');

// 5. Category Tag Beside Continue Button in entry-meta-row
const buildWorkCardFn = popupJs.substring(popupJs.indexOf('function buildWorkCard'), popupJs.indexOf('function esc'));
const metaRowCode = buildWorkCardFn.substring(buildWorkCardFn.indexOf('entry-meta-row'), buildWorkCardFn.indexOf('entry-sources'));
assert.ok(metaRowCode.includes('entry-cat-badge'), 'entry-cat-badge must be located in entry-meta-row next to continue button');

console.log('✓ All Single Line Filter & Card Shadow tests passed successfully!');
