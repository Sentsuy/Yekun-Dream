const fs = require('fs');
const path = require('path');
const assert = require('assert');

const htmlPath = path.resolve(__dirname, '../popup.html');
const cssPath = path.resolve(__dirname, '../popup.css');
const jsPath = path.resolve(__dirname, '../popup.js');

const html = fs.readFileSync(htmlPath, 'utf8');
const css = fs.readFileSync(cssPath, 'utf8');
const js = fs.readFileSync(jsPath, 'utf8');

console.log('1. Testing script imports in popup.html...');
assert.ok(
  html.includes('<script src="feedback-service.js"></script>'),
  'popup.html deve importar feedback-service.js'
);

console.log('2. Testing feedback navigation and panel in popup.html...');
assert.ok(
  html.includes('data-tab="feedback"'),
  'popup.html deve conter aba data-tab="feedback" em settingsTabsNav'
);
assert.ok(
  html.includes('id="paneSettingsFeedback"'),
  'popup.html deve conter o painel #paneSettingsFeedback'
);
assert.ok(
  html.includes('id="btnQuickReportSite"'),
  'popup.html deve conter o botão de atalho contextual #btnQuickReportSite na barra de site'
);

console.log('3. Testing feedback form elements and 300-char limits in popup.html...');
assert.ok(
  html.includes('id="feedbackCategorySelect"'),
  'popup.html deve conter #feedbackCategorySelect'
);
assert.ok(
  html.includes('value="site_mapping"') &&
  html.includes('value="bug_report"') &&
  html.includes('value="suggestion"'),
  'popup.html deve conter as 3 categorias: site_mapping, bug_report, suggestion'
);
assert.ok(
  html.includes('id="feedbackMessage"'),
  'popup.html deve conter textarea #feedbackMessage'
);
assert.ok(
  html.includes('maxlength="300"'),
  'popup.html deve limitar o textarea a maxlength="300"'
);
assert.ok(
  html.includes('id="feedbackCharCounter"'),
  'popup.html deve conter o contador #feedbackCharCounter'
);
assert.ok(
  html.includes('id="feedbackIncludeSiteToggle"'),
  'popup.html deve conter o toggle #feedbackIncludeSiteToggle'
);
assert.ok(
  html.includes('id="feedbackSitePreview"'),
  'popup.html deve conter o preview do site #feedbackSitePreview'
);
assert.ok(
  html.includes('id="feedbackEmail"'),
  'popup.html deve conter o campo #feedbackEmail'
);
assert.ok(
  html.includes('id="btnSubmitFeedback"'),
  'popup.html deve conter o botão #btnSubmitFeedback'
);
assert.ok(
  html.includes('id="feedbackStatusMsg"'),
  'popup.html deve conter o container #feedbackStatusMsg'
);

console.log('4. Testing CSS styling for feedback elements...');
assert.ok(
  css.includes('.feedback-form') || css.includes('.feedback-section'),
  'popup.css deve estilizar o formulário de feedback'
);
assert.ok(
  css.includes('.feedback-char-counter'),
  'popup.css deve conter estilos para .feedback-char-counter'
);
assert.ok(
  css.includes('.btn-quick-feedback'),
  'popup.css deve conter estilos para .btn-quick-feedback'
);

console.log('5. Testing JavaScript logic in popup.js...');
assert.ok(
  js.includes('initFeedback') || js.includes('setupFeedback'),
  'popup.js deve conter função de inicialização do feedback'
);
assert.ok(
  js.includes('FeedbackService.submitFeedback'),
  'popup.js deve chamar FeedbackService.submitFeedback'
);
assert.ok(
  js.includes('feedbackCharCounter'),
  'popup.js deve atualizar o contador de caracteres feedbackCharCounter'
);
assert.ok(
  js.includes('btnQuickReportSite'),
  'popup.js deve tratar clique em btnQuickReportSite para abrir a aba de feedback'
);

console.log('✓ test-popup-feedback-ui passed');
process.exit(0);
