const fs = require('fs');
const path = require('path');
const contentCode = fs.readFileSync(path.resolve(__dirname, '../content.js'), 'utf8');
const manifestCode = fs.readFileSync(path.resolve(__dirname, '../manifest.json'), 'utf8');

// Ensure content.js uses chrome.storage.local or StorageLocal and prevents duplicates
if (contentCode.includes('chrome.storage.sync')) {
  console.error('FAIL: content.js still contains chrome.storage.sync references');
  process.exit(1);
}

if (!contentCode.includes('enableFloatingButton')) {
  console.error('FAIL: content.js does not check enableFloatingButton');
  process.exit(1);
}

if (!contentCode.includes('blockedDomains')) {
  console.error('FAIL: content.js does not check blockedDomains');
  process.exit(1);
}

if (!contentCode.includes('existingEntry.id') && !contentCode.includes('existingEntry?.id')) {
  console.error('FAIL: content.js does not use existingEntry.id when updating');
  process.exit(1);
}

if (!manifestCode.includes('storage-local.js')) {
  console.error('FAIL: manifest.json does not include storage-local.js in content_scripts');
  process.exit(1);
}

console.log('Content script verification passed.');
process.exit(0);
