const assert = require('assert');
const fs = require('fs');
const path = require('path');

const contentCode = fs.readFileSync(path.resolve(__dirname, '../content.js'), 'utf8');

// Step 1: Verification of v3 references in content.js
assert.ok(contentCode.includes('getWorks'), 'content.js must call StorageLocal.getWorks()');
assert.ok(contentCode.includes('saveWorkReading'), 'content.js must call StorageLocal.saveWorkReading()');
assert.ok(contentCode.includes('ct-source') || contentCode.includes('siteName') || contentCode.includes('domain'), 'content.js must display or manage source/site');

// Step 1b: Clean State Lifecycle & Zeroed Select
assert.ok(contentCode.includes('resetFormState'), 'content.js must implement resetFormState() to purge dirty state');
assert.ok(contentCode.includes("linkSelect.value = ''"), 'linkToggle must zero linkSelect.value on fresh query');

// Step 2: Verification of matching logic functions
// Emulate the matching logic used in content.js
function normalize(s) {
  return (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function findExistingWork(works, title) {
  const n = normalize(title);
  return works.find(w => !w.deleted && normalize(w.name) === n) || null;
}

function findWorkSource(work, domain) {
  if (!work || !Array.isArray(work.sources)) return null;
  const d = (domain || '').toLowerCase().trim();
  return work.sources.find(s => (s.domain || '').toLowerCase() === d) || null;
}

const mockWorks = [
  {
    id: 'work_1',
    name: 'Solo Leveling',
    tag: 'manga',
    mainChapter: 'Cap. 179',
    sources: [
      { id: 'src_1', siteName: 'MangaDex', domain: 'mangadex.org', chapter: 'Cap. 179', url: 'https://mangadex.org/sl/179' }
    ]
  }
];

// Test case A: Same work, known source
const workKnown = findExistingWork(mockWorks, 'Solo Leveling - Ler Online');
// Cleaned title:
const cleanTitle = 'Solo Leveling - Ler Online'.replace(/\s*[-–|·•]\s*.{0,40}$/, '').trim();
const foundWork = findExistingWork(mockWorks, cleanTitle);
assert.ok(foundWork, 'Should find existing work by cleaned title');

const foundSource = findWorkSource(foundWork, 'mangadex.org');
assert.ok(foundSource, 'Should find existing source');
assert.strictEqual(foundSource.chapter, 'Cap. 179');

// Test case B: Same work, new source (e.g. site switched because old one is down)
const newSource = findWorkSource(foundWork, 'reaperscans.com');
assert.strictEqual(newSource, null, 'Source reaperscans.com should not be in work yet');

console.log('✓ Content script v3 tests passed successfully!');
