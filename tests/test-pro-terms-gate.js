const assert = require('assert');
const fs = require('fs');
const path = require('path');

const popupHtml = fs.readFileSync(path.resolve(__dirname, '../popup.html'), 'utf8');
const popupCss  = fs.readFileSync(path.resolve(__dirname, '../popup.css'),  'utf8');
const popupJs   = fs.readFileSync(path.resolve(__dirname, '../popup.js'),   'utf8');

console.log('Testing PRO Cloud Terms of Use Gate...');

// 1. Modal estrutura
assert.ok(popupHtml.includes('id="modalProTerms"'), 'Must have modalProTerms');
assert.ok(popupHtml.includes('id="proTermsBody"'), 'Must have proTermsBody');
assert.ok(popupHtml.includes('id="chkProTermsAccept"'), 'Must have chkProTermsAccept checkbox');
assert.ok(popupHtml.includes('id="btnAcceptProTerms"'), 'Must have btnAcceptProTerms');
assert.ok(popupHtml.includes('id="btnCancelProTerms"'), 'Must have btnCancelProTerms');
assert.ok(popupHtml.includes('id="btnReadProTerms"'), 'Must have btnReadProTerms link in Info tab');
assert.ok(popupHtml.includes('id="proTermsVersionLabel"'), 'Must have proTermsVersionLabel');
assert.ok(popupHtml.includes('disabled'), 'Accept button must start disabled');

// 2. Conteúdo legal obrigatório
assert.ok(/LGPD|Lei 13\.709/i.test(popupHtml), 'Terms must reference LGPD');
assert.ok(/Marco Civil|Lei 12\.965/i.test(popupHtml), 'Terms must reference Marco Civil da Internet');
assert.ok(/ordem judicial|autoridade/i.test(popupHtml), 'Terms must mention judicial order / authority');
assert.ok(/Supabase/i.test(popupHtml), 'Terms must disclose cloud infrastructure (Supabase)');
assert.ok(/URLs e dom[ií]nios|sites rastreados/i.test(popupHtml), 'Terms must disclose site URL storage');
assert.ok(/responsabilidade do usu[áa]rio|responsabilidade/i.test(popupHtml), 'Terms must have user responsibility clause');
assert.ok(/18 anos|idade m[íi]nima/i.test(popupHtml), 'Terms must have minimum age clause');
assert.ok(/exclus[ãa]o|art\. ?18/i.test(popupHtml), 'Terms must mention LGPD exclusion right (art. 18)');
assert.ok(/sentsuy\.ddns\.net/i.test(popupHtml), 'Terms must include contact channel');

// 3. CSS
assert.ok(popupCss.includes('.modal-terms-box'), 'popup.css must style modal-terms-box');
assert.ok(popupCss.includes('.pro-terms-body'), 'popup.css must style pro-terms-body (scrollable)');
assert.ok(popupCss.includes('.pro-terms-accept-row'), 'popup.css must style accept row');
assert.ok(popupCss.includes('.modal-terms-box.readonly'), 'popup.css must support readonly mode');

// 4. JS helpers
assert.ok(popupJs.includes('CURRENT_PRO_TERMS_VERSION'), 'popup.js must declare CURRENT_PRO_TERMS_VERSION');
assert.ok(popupJs.includes('PRO_TERMS_STORAGE_KEY'), 'popup.js must declare PRO_TERMS_STORAGE_KEY');
assert.ok(popupJs.includes('isProTermsAccepted'), 'popup.js must have isProTermsAccepted()');
assert.ok(popupJs.includes('recordProTermsAcceptance'), 'popup.js must have recordProTermsAcceptance()');
assert.ok(popupJs.includes('requireProTermsAccepted'), 'popup.js must have requireProTermsAccepted guard');
assert.ok(popupJs.includes('openProTermsModal'), 'popup.js must have openProTermsModal()');

// 5. Pontos de entrada do PRO estão wrapped com requireProTermsAccepted
const guardRegex = /requireProTermsAccepted\s*\(/g;
const guardCalls = (popupJs.match(guardRegex) || []).length;
assert.ok(guardCalls >= 4, `Must guard at least 4 entry points with requireProTermsAccepted, found ${guardCalls}`);
const flat = popupJs.replace(/\s+/g, ' ');
assert.ok(/btnSyncNow\.addEventListener[\s\S]{0,80}requireProTermsAccepted/.test(flat), 'btnSyncNow must be gated');
assert.ok(/btnRedeemPin\.addEventListener[\s\S]{0,80}requireProTermsAccepted/.test(flat), 'btnRedeemPin must be gated');
assert.ok(/btnConnectGoogle\.addEventListener[\s\S]{0,80}requireProTermsAccepted/.test(flat), 'btnConnectGoogle must be gated');
assert.ok(/toggleAutoSync\.addEventListener/.test(popupJs), 'toggleAutoSync must have its own handler');
assert.ok(/toggleAutoSync[\s\S]{0,500}openProTermsModal/.test(popupJs), 'toggleAutoSync handler must open terms modal when enabling');

console.log('✓ All PRO Terms Gate assertions passed successfully!');
