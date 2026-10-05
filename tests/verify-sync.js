const fs = require('fs');
const path = require('path');

const syncFilePath = path.resolve(__dirname, '../sync-service.js');
if (!fs.existsSync(syncFilePath)) {
  console.error('FAIL: sync-service.js does not exist');
  process.exit(1);
}

const syncCode = fs.readFileSync(syncFilePath, 'utf8');
const bgCode = fs.readFileSync(path.resolve(__dirname, '../background.js'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../manifest.json'), 'utf8'));

if (!manifest.permissions.includes('alarms')) {
  console.error('FAIL: manifest.json missing alarms permission');
  process.exit(1);
}

if (!syncCode.includes('pushPending') || !syncCode.includes('pullRemote')) {
  console.error('FAIL: sync-service.js missing pushPending or pullRemote');
  process.exit(1);
}

if (!bgCode.includes('chrome.alarms.onAlarm')) {
  console.error('FAIL: background.js missing chrome.alarms.onAlarm listener');
  process.exit(1);
}

console.log('Sync verification passed.');
process.exit(0);
