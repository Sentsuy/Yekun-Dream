const { execSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');

const testSuites = [
  { name: 'Icon verification', cmd: 'node tests/verify-icons.js' },
  { name: 'Storage Local unit tests', cmd: 'node tests/storage-local.test.js' },
  { name: 'Storage v3 multi-source tests', cmd: 'node tests/test-storage-v3.js' },
  { name: 'Content Script verification', cmd: 'node tests/verify-content.js' },
  { name: 'Content Script v3 multi-source tests', cmd: 'node tests/test-content-v3.js' },
  { name: 'Chapter Regex & Title Sanitization tests', cmd: 'node tests/test-chapter-extraction.js' },
  { name: 'Floating Button Drag & Disable tests', cmd: 'node tests/test-floating-drag-and-disable.js' },
  { name: 'User Demands Regression tests', cmd: 'node tests/test-demands-regression.js' },
  { name: 'Allowed Domains Whitelist tests', cmd: 'node tests/test-allowed-domains.js' },
  { name: 'Domain Chips & Floating Button Activation', cmd: 'node tests/test-domain-chips-and-site-toggle.js' },
  { name: 'UI/UX Enhancements for Non-Technical Users', cmd: 'node tests/test-ui-ux-enhancements.js' },
  { name: 'Theme & Vector SVG icon tests', cmd: 'node tests/test-themes-and-svg-icons.js' },
  { name: 'Work Component UI & Typography Cleanup', cmd: 'node tests/test-work-component-ui-cleanup.js' },
  { name: 'Single Line Filter & Card Shadow tests', cmd: 'node tests/test-single-line-filter-and-card-shadow.js' },
  { name: 'Discreet Site Button & Domain Concealment tests', cmd: 'node tests/test-discreet-site-bar.js' },
  { name: 'Real Scans & SPAs Extraction tests', cmd: 'node tests/test-scans-and-spas-extraction.js' },
  { name: 'Popup features & settings verification', cmd: 'node tests/verify-popup-features.js' },
  { name: 'Popup v3 multi-source tests', cmd: 'node tests/test-popup-v3.js' },
  { name: 'Popup Aliases UI & Functional Storage', cmd: 'node tests/test-popup-aliases-ui.js' },
  { name: 'About Panel, Branding & Pix Setup', cmd: 'node tests/test-about-and-branding.js' },
  { name: 'Theme Dynamic Sync & Multi-Theme Icons', cmd: 'node tests/test-theme-dynamic-sync-and-icons.js' },
  { name: 'Smart Work Matching & Cross-Site Aliases', cmd: 'node tests/test-smart-work-matching.js' },
  { name: 'Canonical Public Resolver (AniList & MangaDex)', cmd: 'node tests/test-canonical-resolver.js' },
  { name: 'Crowdsourced Alias Consensus & Quorum Engine', cmd: 'node tests/test-alias-crowd-service.js' },
  { name: 'Collaborative Alias & Storage Integration', cmd: 'node tests/test-collaborative-alias-integration.js' },
  { name: 'Bottom Nav & Consolidated Sites Hub', cmd: 'node tests/test-bottom-nav-and-consolidated-sites.js' },
  { name: 'Reading & Publication Status tests', cmd: 'node tests/test-reading-and-publication-status.js' },
  { name: 'Series & Movies Divergence Normalization', cmd: 'node tests/test-series-movies-divergence.js' },
  { name: 'Crunchyroll & Streaming Extraction', cmd: 'node tests/test-crunchyroll-and-streaming.js' },
  { name: 'AnimesOnline & Anime Extraction Pipeline', cmd: 'node tests/test-animesonlinecc.js' },
  { name: 'Quick Increment Chapter Guards & Comparisons', cmd: 'node tests/test-quick-increment-guards.js' },
  { name: 'Add Chapter & Manual Save Validation', cmd: 'node tests/test-add-chapter-validation.js' },
  { name: 'Release Day Notifications & Bell History', cmd: 'node tests/test-release-notifications.js' },
  { name: 'Drawer Visibility & Full-Height Layout', cmd: 'node tests/test-drawer-visibility-and-layout.js' },
  { name: 'Glare-Free Themes & Comfortable Typography', cmd: 'node tests/test-glare-free-themes.js' },
  { name: 'Save Pre-fill & Cross-Tab Activation Fixes', cmd: 'node tests/test-save-and-tab-sync-fixes.js' },
  { name: 'Verbatim Titles & Dual Aliases Extraction', cmd: 'node tests/test-verbatim-title-and-dual-aliases.js' },
  { name: 'Cloud Sync & background verification', cmd: 'node tests/verify-sync.js' },
  { name: 'Extension Context & Re-injection Safety', cmd: 'node tests/test-extension-context-and-re-injection.js' },
  { name: 'Anime Video Tracker & Auto-Save (70%)', cmd: 'node tests/test-anime-video-tracker.js' },
  { name: 'Supabase PRO SQL & RPC syntax', cmd: 'node tests/test-supabase-pro-sql-syntax.js' },
  { name: 'Supabase Activation Requests SQL (Fase 2)', cmd: 'node tests/test-supabase-activation-requests-sql.js' },
  { name: 'Supabase Production Patch SQL (Consolidado)', cmd: 'node tests/test-supabase-production-patch.js' },
  { name: 'Edge Functions Structure (Fase 3)', cmd: 'node tests/test-edge-functions-structure.js' },
  { name: 'Identity Service & PIN validation', cmd: 'node tests/test-identity-service.js' },
  { name: 'PRO Cloud Sync Guard & Storage', cmd: 'node tests/test-pro-cloud-sync.js' },
  { name: 'Popup PRO UI & PIN flow', cmd: 'node tests/test-popup-pro-ui.js' },
  { name: 'PRO Cloud Terms of Use Gate', cmd: 'node tests/test-pro-terms-gate.js' },
  { name: 'PRO PIN Hybrid Security & 2FA', cmd: 'node tests/test-pro-pin-hybrid-security.js' },
  { name: 'Auto-Pull on Connect & 2FA Sync', cmd: 'node tests/test-auto-pull-on-connect.js' },
  { name: 'Account Disconnect & Anti-Duplication Sync', cmd: 'node tests/test-account-disconnect-merge-sync.js' },
  { name: 'Device Session Security & Anti-Scraping', cmd: 'node tests/test-device-session-security.js' },
  { name: 'Multi-select Status Filter & 2-Second Hover Menu', cmd: 'node tests/test-status-multiselect-and-hover-menu.js' },
  { name: 'Supabase Feedback SQL Schema & RPC', cmd: 'node tests/test-supabase-feedback-sql.js' },
  { name: 'Feedback Service & Limits Validation', cmd: 'node tests/test-feedback-service.js' },
  { name: 'Popup Feedback UI & Context Flow', cmd: 'node tests/test-popup-feedback-ui.js' },
  { name: 'Startup Performance & Lazy Loading', cmd: 'node tests/test-startup-performance.js' },
  { name: 'Syntax check: feedback-service.js', cmd: 'node -c feedback-service.js' },
  { name: 'Syntax check: identity-service.js', cmd: 'node -c identity-service.js' },
  { name: 'Syntax check: storage-local.js', cmd: 'node -c storage-local.js' },
  { name: 'Syntax check: sync-service.js', cmd: 'node -c sync-service.js' },
  { name: 'Syntax check: canonical-resolver.js', cmd: 'node -c canonical-resolver.js' },
  { name: 'Syntax check: alias-crowd-service.js', cmd: 'node -c alias-crowd-service.js' },
  { name: 'Syntax check: background.js', cmd: 'node -c background.js' },
  { name: 'Syntax check: content.js', cmd: 'node -c content.js' },
  { name: 'Syntax check: popup.js', cmd: 'node -c popup.js' }
];

console.log('═══════════════════════════════════════════════════════');
console.log('   Yekun Dream — Executing Test Suite');
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
