const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.resolve(__dirname, '../popup.html'), 'utf8');
const js = fs.readFileSync(path.resolve(__dirname, '../popup.js'), 'utf8');
const css = fs.readFileSync(path.resolve(__dirname, '../popup.css'), 'utf8');

if (!html.includes('btnSettings')) {
  console.error('FAIL: popup.html missing btnSettings');
  process.exit(1);
}

if (!html.includes('settingsPanel')) {
  console.error('FAIL: popup.html missing settingsPanel');
  process.exit(1);
}

if (!html.includes('btnExportBackup') || !html.includes('btnImportBackup')) {
  console.error('FAIL: popup.html missing backup buttons');
  process.exit(1);
}

if (!js.includes('quickIncrementChapter')) {
  console.error('FAIL: popup.js missing quickIncrementChapter handling');
  process.exit(1);
}

if (!js.includes('exportBackup') || !js.includes('importBackup')) {
  console.error('FAIL: popup.js missing backup handling');
  process.exit(1);
}

if (!css.includes('.switch')) {
  console.error('FAIL: popup.css missing .switch styling');
  process.exit(1);
}

console.log('Popup features verification passed.');
process.exit(0);
