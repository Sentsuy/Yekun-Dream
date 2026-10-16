const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.resolve(__dirname, '../popup.html'), 'utf8');
const css  = fs.readFileSync(path.resolve(__dirname, '../popup.css'),  'utf8');
const js   = fs.readFileSync(path.resolve(__dirname, '../popup.js'),   'utf8');
const { IdentityService } = require('../identity-service');

console.log('Testing PRO PIN Hybrid Security & 2FA Architecture...');

// 1. Verificações de estrutura no popup.html
console.log('1. Verifying HTML elements for PIN & Recovery Key...');
assert.ok(html.includes('id="proSuccessPin"'), 'Step 3 must contain #proSuccessPin');
assert.ok(html.includes('id="btnCopySuccessPin"'), 'Step 3 must contain #btnCopySuccessPin');
assert.ok(html.includes('id="proSuccessRecovery"'), 'Step 3 must contain #proSuccessRecovery');
assert.ok(html.includes('id="btnCopySuccessRecovery"'), 'Step 3 must contain #btnCopySuccessRecovery');
assert.ok(html.includes('id="proActiveSecurityCard"'), 'Must contain #proActiveSecurityCard in PRO panel');
assert.ok(html.includes('id="inputDisplayProPin"'), 'Must contain #inputDisplayProPin');
assert.ok(html.includes('id="btnToggleRevealPin"'), 'Must contain #btnToggleRevealPin');
assert.ok(html.includes('id="inputDisplayProRecovery"'), 'Must contain #inputDisplayProRecovery');
assert.ok(html.includes('id="btnToggleRevealRecovery"'), 'Must contain #btnToggleRevealRecovery');
assert.ok(html.includes('id="proTotpAccordion"'), 'Must contain #proTotpAccordion for 2FA');
assert.ok(html.includes('id="imgTotpQr"'), 'Must contain #imgTotpQr');
assert.ok(html.includes('id="inputTotpManualSecret"'), 'Must contain #inputTotpManualSecret');
assert.ok(html.includes('id="btnActivateTotp"'), 'Must contain #btnActivateTotp');
assert.ok(html.includes('id="modalVerifyProAccess"'), 'Must contain #modalVerifyProAccess for new device access');
assert.ok(html.includes('id="inputVerifyProSecret"'), 'Must contain #inputVerifyProSecret');
assert.ok(html.includes('id="btnConfirmVerifyPro"'), 'Must contain #btnConfirmVerifyPro');

// 2. Termos de Uso
console.log('2. Verifying Terms clause on PIN, Recovery Key and 2FA...');
assert.ok(/Guarda do PIN, Chave de Recuperação e 2FA/i.test(html), 'Terms must include clause on PIN and Recovery key');
assert.ok(/exclusiva responsabilidade do usu[áa]rio/i.test(html), 'Terms must declare user responsibility');

// 3. CSS
console.log('3. Verifying CSS styling...');
assert.ok(css.includes('.pro-credentials-box'), 'popup.css must style .pro-credentials-box');
assert.ok(css.includes('.pro-active-security-card'), 'popup.css must style .pro-active-security-card');
assert.ok(css.includes('.pro-totp-qr-wrap'), 'popup.css must style .pro-totp-qr-wrap');
assert.ok(css.includes('.modal-verify-box'), 'popup.css must style .modal-verify-box');

// 4. JS logic
console.log('4. Verifying JS handlers...');
assert.ok(js.includes('openVerifyProAccessModal'), 'popup.js must contain openVerifyProAccessModal');
assert.ok(js.includes('btnToggleRevealPin'), 'popup.js must handle btnToggleRevealPin');
assert.ok(js.includes('btnToggleRevealRecovery'), 'popup.js must handle btnToggleRevealRecovery');
assert.ok(js.includes('IdentityService.verifyProAccess'), 'popup.js must call IdentityService.verifyProAccess');
assert.ok(js.includes('IdentityService.verifyAndEnableTotp'), 'popup.js must call verifyAndEnableTotp');

// 5. Unit test de TOTP
console.log('5. Testing TotpUtil unit functions...');
(async () => {
  const secret = IdentityService.Totp.generateSecret(16);
  assert.strictEqual(secret.length, 16);
  assert.ok(/^[A-Z2-7]+$/.test(secret));

  const token = await IdentityService.Totp.generateToken(secret);
  if (token) {
    assert.strictEqual(token.length, 6);
    assert.ok(/^\d{6}$/.test(token));
    const isValid = await IdentityService.Totp.verifyToken(token, secret);
    assert.strictEqual(isValid, true, 'Token generated should be verified as valid');
    const isInvalid = await IdentityService.Totp.verifyToken('000000', secret);
    if (token !== '000000') {
      assert.strictEqual(isInvalid, false, 'Invalid token must be rejected');
    }
  }

  // 6. Teste de redeemPin com 6 dígitos e recovery key
  console.log('6. Testing redeemPin formats...');
  const invalidShort = await IdentityService.redeemPin({}, '123', 'test@user.com');
  assert.strictEqual(invalidShort.success, false);
  assert.ok(invalidShort.error.includes('4') && invalidShort.error.includes('6'));

  console.log('✓ All PRO PIN Hybrid Security tests passed successfully!');
  process.exit(0);
})();
