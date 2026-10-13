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

if (!html.includes('settingsDiagnosticCard') || !html.includes('storageStatsCard')) {
  console.error('FAIL: popup.html missing settingsDiagnosticCard or storageStatsCard');
  process.exit(1);
}

if (!js.includes('updateDiagnosticUI') || !js.includes('updateStorageStatsUI')) {
  console.error('FAIL: popup.js missing updateDiagnosticUI or updateStorageStatsUI');
  process.exit(1);
}

if (!css.includes('.settings-diagnostic-card') || !css.includes('.storage-stats-card')) {
  console.error('FAIL: popup.css missing .settings-diagnostic-card or .storage-stats-card styling');
  process.exit(1);
}

if (!html.includes('toggleAutoTrackAnime')) {
  console.error('FAIL: popup.html missing toggleAutoTrackAnime');
  process.exit(1);
}

if (!js.includes('toggleAutoTrackAnime')) {
  console.error('FAIL: popup.js missing toggleAutoTrackAnime handling');
  process.exit(1);
}

console.log('Popup features verification passed.');
process.exit(0);
