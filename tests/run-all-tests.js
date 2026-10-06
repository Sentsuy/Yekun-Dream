const { execSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');

const testSuites = [
  { name: 'Icon verification', cmd: 'node tests/verify-icons.js' },
  { name: 'Storage Local unit tests', cmd: 'node tests/storage-local.test.js' },
  { name: 'Storage v3 multi-source tests', cmd: 'node tests/test-storage-v3.js' },
  { name: 'Content Script verification', cmd: 'node tests/verify-content.js' },
  { name: 'Popup features & settings verification', cmd: 'node tests/verify-popup-features.js' },
  { name: 'Cloud Sync & background verification', cmd: 'node tests/verify-sync.js' },
  { name: 'Syntax check: storage-local.js', cmd: 'node -c storage-local.js' },
  { name: 'Syntax check: sync-service.js', cmd: 'node -c sync-service.js' },
  { name: 'Syntax check: background.js', cmd: 'node -c background.js' },
  { name: 'Syntax check: content.js', cmd: 'node -c content.js' },
  { name: 'Syntax check: popup.js', cmd: 'node -c popup.js' }
];

console.log('═══════════════════════════════════════════════════════');
console.log('   Chapter Tracker — Executing Test Suite');
console.log('═══════════════════════════════════════════════════════\n');

let passed = 0;
let failed = 0;

for (const suite of testSuites) {
  process.stdout.write(`• Running ${suite.name}... `);
  try {
    execSync(suite.cmd, { cwd: root, stdio: 'pipe' });
    console.log('\x1b[32mPASS\x1b[0m');
    passed++;
  } catch (err) {
    console.log('\x1b[31mFAIL\x1b[0m');
    console.error(err.stdout ? err.stdout.toString() : '');
    console.error(err.stderr ? err.stderr.toString() : err.message);
    failed++;
  }
}

console.log('\n───────────────────────────────────────────────────────');
console.log(`Results: ${passed} passed, ${failed} failed (${testSuites.length} total)`);
console.log('───────────────────────────────────────────────────────\n');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('✓ All test suites passed successfully!');
  process.exit(0);
}
