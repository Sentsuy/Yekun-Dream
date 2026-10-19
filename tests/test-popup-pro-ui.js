const fs = require('fs');
const path = require('path');
const assert = require('assert');

const htmlPath = path.resolve(__dirname, '../popup.html');
const cssPath = path.resolve(__dirname, '../popup.css');
const jsPath = path.resolve(__dirname, '../popup.js');

const html = fs.readFileSync(htmlPath, 'utf8');
const css = fs.readFileSync(cssPath, 'utf8');
const js = fs.readFileSync(jsPath, 'utf8');

console.log('Testing script imports in popup.html...');
assert.ok(html.includes('<script src="identity-service.js"></script>'), 'popup.html deve importar identity-service.js antes de popup.js');

console.log('Testing PRO UI elements in popup.html...');
assert.ok(html.includes('id="proStatusCard"'), 'popup.html deve conter #proStatusCard');
assert.ok(html.includes('id="inputProPin"'), 'popup.html deve conter input #inputProPin para PIN de 4 dígitos');
assert.ok(html.includes('id="btnRedeemPin"'), 'popup.html deve conter botão #btnRedeemPin');
assert.ok(html.includes('id="btnOpenProModal"'), 'popup.html deve conter botão #btnOpenProModal');
assert.ok(html.includes('id="modalProPix"'), 'popup.html deve conter modal de Pix #modalProPix');
assert.ok(html.includes('id="inputCustomProEmail"'), 'popup.html deve permitir informar e-mail customizado #inputCustomProEmail');

assert.ok(html.includes('id="btnConnectGoogle"'), 'popup.html deve conter botão #btnConnectGoogle para login em 1 clique');
assert.ok(html.includes('id="btnDisconnectAccount"'), 'popup.html deve conter botão #btnDisconnectAccount');
assert.ok(html.includes('id="modalSyncAccountPrompt"'), 'popup.html deve conter modal #modalSyncAccountPrompt');
assert.ok(html.includes('id="settingsTabsNav"'), 'popup.html deve conter navegação por pílulas #settingsTabsNav');

assert.ok(html.includes('id="btnSaveCustomProEmail"'), 'popup.html deve conter botão #btnSaveCustomProEmail');
assert.ok(html.includes('btn-icon-subtle') && html.includes('id="btnEditProEmail"'), 'popup.html deve usar botão de ícone para #btnEditProEmail');

assert.ok(html.includes('id="proAuthHelper"'), 'popup.html deve conter status helper #proAuthHelper');

console.log('Testing PRO CSS styles in popup.css...');
assert.ok(css.includes('.pro-status-card'), 'popup.css deve conter estilos para .pro-status-card');
assert.ok(css.includes('.pro-pin-input'), 'popup.css deve conter estilos para .pro-pin-input');
assert.ok(css.includes('.pro-badge-active'), 'popup.css deve conter estilos para .pro-badge-active');
assert.ok(css.includes('.settings-tabs-nav'), 'popup.css deve conter estilos para .settings-tabs-nav');
assert.ok(css.includes('.btn-google-signin'), 'popup.css deve conter estilos para .btn-google-signin');
assert.ok(css.includes('.btn-google-signin.is-connected'), 'popup.css deve conter estilos para .btn-google-signin.is-connected');
assert.ok(css.includes('.pro-auth-helper'), 'popup.css deve conter estilos para .pro-auth-helper');
assert.ok(css.includes('.btn-upgrade-pro.is-locked'), 'popup.css deve conter estilos para .btn-upgrade-pro.is-locked');
assert.ok(css.includes('.pro-account-email-input'), 'popup.css deve conter estilos para .pro-account-email-input');
assert.ok(css.includes('.btn-icon-subtle'), 'popup.css deve conter estilos para .btn-icon-subtle');
assert.ok(css.includes('.hidden'), 'popup.css deve conter estilos para .hidden');

console.log('Testing PRO JS logic in popup.js...');
assert.ok(js.includes('updateProStatusUI'), 'popup.js deve conter função updateProStatusUI');
assert.ok(js.includes('btnRedeemPin'), 'popup.js deve conter evento para btnRedeemPin');
assert.ok(js.includes('IdentityService.redeemPin'), 'popup.js deve chamar IdentityService.redeemPin');
assert.ok(js.includes("appSettings.theme === 'neon'") && js.includes("applyTheme('dark')"), 'popup.js deve reverter tema neon para dark se a conta for FREE');
assert.ok(js.includes('IdentityService.getGoogleIdentityInfo'), 'popup.js deve usar getGoogleIdentityInfo ao conectar conta Google');
assert.ok(js.includes('IdentityService.signInWithGoogleBrowserFlow'), 'popup.js deve suportar signInWithGoogleBrowserFlow');
assert.ok(js.includes('setProEmailEditingMode'), 'popup.js deve conter setProEmailEditingMode');
assert.ok(!html.includes('id="proPinFallback"'), 'popup.html não deve conter #proPinFallback dentro do modal de ativação');
assert.ok(js.includes('goToProStep(3)'), 'popup.js deve avançar diretamente para etapa 3 na simulação de teste');

console.log('✓ test-popup-pro-ui passed');
process.exit(0);
