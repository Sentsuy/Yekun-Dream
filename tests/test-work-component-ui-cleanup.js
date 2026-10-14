const assert = require('assert');
const fs = require('fs');
const path = require('path');

const popupHtml = fs.readFileSync(path.resolve(__dirname, '../popup.html'), 'utf8');
const popupCss  = fs.readFileSync(path.resolve(__dirname, '../popup.css'), 'utf8');
const popupJs   = fs.readFileSync(path.resolve(__dirname, '../popup.js'), 'utf8');

console.log('Testing Work Component UI Cleanup & Typography...');

// 1. Typography: Inter / Roboto in HTML and CSS
assert.ok(popupHtml.includes('Inter') && popupHtml.includes('Roboto'), 'popup.html must link Inter and Roboto fonts');
assert.ok(popupCss.includes('--font-readable'), 'popup.css must define --font-readable');
assert.ok(
  popupCss.includes("'Inter'") || popupCss.includes('"Inter"'),
  'popup.css must use Inter in readable font stack'
);
assert.ok(
  popupCss.includes("'Roboto'") || popupCss.includes('"Roboto"'),
  'popup.css must use Roboto in readable font stack'
);

// Source chip and chapter number font check
const chipSection = popupCss.substring(popupCss.indexOf('.source-chip'), popupCss.indexOf('.accordion-toggle'));
assert.ok(chipSection.includes('--font-readable') || chipSection.includes('Inter') || chipSection.includes('Roboto'),
  'source-chip must use formal legible font (Inter/Roboto)');

// 2. Layout Cleanup in card.innerHTML in popup.js
// Extract buildWorkCard function body
const buildWorkCardFn = popupJs.substring(popupJs.indexOf('function buildWorkCard'), popupJs.indexOf('function esc'));

// Chapter badge must be removed from card
assert.strictEqual(
  buildWorkCardFn.includes('entry-chapter-badge'),
  false,
  'entry-chapter-badge must be removed from work card'
);

// +1 Cap button must be removed from card
assert.strictEqual(
  buildWorkCardFn.includes('+1 Cap'),
  false,
  '+1 Cap button must be removed from work card'
);

// Initial avatar must be removed from card HTML
assert.strictEqual(
  buildWorkCardFn.includes('entry-avatar avatar-'),
  false,
  'entry-avatar must be removed from work card HTML'
);

// 3. Simplified accordion toggle: only chevron icon, no text
assert.ok(
  buildWorkCardFn.includes('accordion-toggle'),
  'work card must still have accordion-toggle button'
);
assert.strictEqual(
  buildWorkCardFn.includes('Fontes &amp; Histórico') ||
  buildWorkCardFn.includes('Fontes & Histórico') ||
  buildWorkCardFn.includes('Fontes e Histórico (${'),
  false,
  'accordion-toggle must not contain written text'
);
assert.ok(
  buildWorkCardFn.includes('ICONS.chevronDown'),
  'accordion-toggle must contain chevron-down icon'
);

// 4. Preserved buttons: Continuar, Editar, Excluir
assert.ok(buildWorkCardFn.includes('btn-continue'), 'btn-continue must be preserved');
assert.ok(buildWorkCardFn.includes('btn-main-open'), 'btn-main-open must be preserved');
assert.ok(buildWorkCardFn.includes('btn-main-edit'), 'btn-main-edit must be preserved');
assert.ok(buildWorkCardFn.includes('btn-main-del'), 'btn-main-del must be preserved');

console.log('✓ All Work Component UI cleanup tests passed successfully!');
