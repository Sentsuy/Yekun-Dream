const assert = require('assert');

// Mock chrome environment
const mockStorage = {};
global.chrome = {
  identity: {
    getProfileUserInfo: (callback) => {
      callback({ email: 'sentsuy.test@gmail.com', id: 'google_12345' });
    }
  },
  storage: {
    local: {
      get: (keys, cb) => {
        const res = {};
        if (Array.isArray(keys)) keys.forEach(k => res[k] = mockStorage[k]);
        else if (typeof keys === 'string') res[keys] = mockStorage[keys];
        cb(res);
      },
      set: (obj, cb) => {
        Object.assign(mockStorage, obj);
        if (cb) cb();
      },
      remove: (keys, cb) => {
        const arr = Array.isArray(keys) ? keys : [keys];
        arr.forEach(k => delete mockStorage[k]);
        if (cb) cb();
      }
    }
  }
};

const { IdentityService } = require('../identity-service');

(async function runTests() {
  console.log('Testing email normalization...');
  assert.strictEqual(IdentityService.normalizeEmail(' Sentsuy@Gmail.COM '), 'sentsuy@gmail.com');
  assert.strictEqual(IdentityService.normalizeEmail(''), '');
  assert.strictEqual(IdentityService.normalizeEmail(null), '');

  console.log('Testing identity detection via chrome.identity...');
  const idInfo = await IdentityService.getIdentityInfo();
  assert.strictEqual(idInfo.email, 'sentsuy.test@gmail.com');
  assert.strictEqual(idInfo.source, 'google');

  console.log('Testing identity fallback to custom email...');
  global.chrome.identity.getProfileUserInfo = (cb) => cb({ email: '', id: '' });
  const customInfoEmpty = await IdentityService.getIdentityInfo();
  assert.strictEqual(customInfoEmpty.email, '');
  assert.strictEqual(customInfoEmpty.source, 'none');

  await IdentityService.setCustomProEmail('custom.user@domain.com');
  const customInfo = await IdentityService.getIdentityInfo();
  assert.strictEqual(customInfo.email, 'custom.user@domain.com');
  assert.strictEqual(customInfo.source, 'custom');

  console.log('Testing custom email priority over Google account...');
  global.chrome.identity.getProfileUserInfo = (cb) => cb({ email: 'google.account@gmail.com', id: 'g_999' });
  const stillCustom = await IdentityService.getIdentityInfo();
  assert.strictEqual(stillCustom.email, 'custom.user@domain.com', 'Custom email deve ter prioridade sobre conta Google');
  assert.strictEqual(stillCustom.source, 'custom');

  const directGoogle = await IdentityService.getGoogleIdentityInfo();
  assert.strictEqual(directGoogle.email, 'google.account@gmail.com', 'getGoogleIdentityInfo deve retornar a conta Google');

  await IdentityService.clearCustomProEmail();
  const fallbackGoogle = await IdentityService.getIdentityInfo();
  assert.strictEqual(fallbackGoogle.email, 'google.account@gmail.com', 'Após limpar custom, deve voltar para conta Google');
  assert.strictEqual(fallbackGoogle.source, 'google');

  console.log('Testing PIN validation rules...');
  const shortPin = await IdentityService.redeemPin({ supabaseUrl: 'https://mock.supabase.co', supabaseKey: 'mock' }, '123', 'test@domain.com');
  assert.strictEqual(shortPin.success, false);
  assert.ok(shortPin.error.includes('4'));

  const letterPin = await IdentityService.redeemPin({ supabaseUrl: 'https://mock.supabase.co', supabaseKey: 'mock' }, '12a4', 'test@domain.com');
  assert.strictEqual(letterPin.success, false);
  assert.ok(letterPin.error.includes('números') || letterPin.error.includes('numérico'));

  console.log('Testing days left calculation...');
  const now = Date.now();
  const thirtyDaysFuture = now + (30 * 86400000);
  assert.strictEqual(IdentityService.calculateDaysLeft(thirtyDaysFuture, now), 30);
  assert.strictEqual(IdentityService.calculateDaysLeft(now - 1000, now), 0);

  console.log('Testing Service Worker global scope compatibility (no global, no window)...');
  const vm = require('vm');
  const fs = require('fs');
  const path = require('path');
  const swCtx = vm.createContext({
    console,
    setTimeout,
    clearTimeout
  });
  swCtx.self = swCtx;
  swCtx.globalThis = swCtx;
  const idFile = fs.readFileSync(path.join(__dirname, '../identity-service.js'), 'utf8');
  vm.runInContext(idFile, swCtx);
  assert.strictEqual(typeof swCtx.IdentityService, 'object');
  assert.strictEqual(typeof swCtx.IdentityService.checkProStatus, 'function');

  console.log('Testing stored credentials management...');
  await IdentityService.saveStoredCredentials({
    accessPin: '839204',
    recoveryKey: 'YK-ABCD-EF01-2345',
    totpSecret: 'JBSWY3DPEHPK3PXP',
    totpEnabled: true
  });
  const creds = await IdentityService.getStoredCredentials();
  assert.strictEqual(creds.accessPin, '839204');
  assert.strictEqual(creds.recoveryKey, 'YK-ABCD-EF01-2345');
  assert.strictEqual(creds.totpSecret, 'JBSWY3DPEHPK3PXP');
  assert.strictEqual(creds.totpEnabled, true);

  await IdentityService.clearStoredCredentials();
  const cleared = await IdentityService.getStoredCredentials();
  assert.strictEqual(cleared.accessPin, '');
  assert.strictEqual(cleared.recoveryKey, '');
  assert.strictEqual(cleared.totpEnabled, false);

  console.log('Testing claimChargeCredentials...');
  const originalFetch = global.fetch;
  global.fetch = async (url, opts) => {
    if (url.includes('claim_charge_credentials')) {
      const body = JSON.parse(opts.body);
      if (body.p_gateway_charge_id === 'chg_paid_123') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            isPaid: true,
            isPro: true,
            validUntil: Date.now() + 365 * 86400000,
            access_pin: '123456',
            recovery_key: 'YK-1234-5678-9012',
            totp_enabled: false
          })
        };
      } else {
        return {
          ok: true,
          json: async () => ({ success: true, isPaid: false, status: 'pending' })
        };
      }
    }
    return { ok: false };
  };

  const pendingClaim = await IdentityService.claimChargeCredentials({ supabaseUrl: 'https://mock.supabase.co', supabaseKey: 'mock' }, 'user@test.com', 'chg_pending_456');
  assert.strictEqual(pendingClaim.isPaid, false);
  assert.strictEqual(pendingClaim.status, 'pending');

  const paidClaim = await IdentityService.claimChargeCredentials({ supabaseUrl: 'https://mock.supabase.co', supabaseKey: 'mock' }, 'user@test.com', 'chg_paid_123');
  assert.strictEqual(paidClaim.isPaid, true);
  assert.strictEqual(paidClaim.accessPin, '123456');
  assert.strictEqual(paidClaim.recoveryKey, 'YK-1234-5678-9012');

  const savedCreds = await IdentityService.getStoredCredentials();
  assert.strictEqual(savedCreds.accessPin, '123456');
  assert.strictEqual(savedCreds.recoveryKey, 'YK-1234-5678-9012');

  global.fetch = originalFetch;

  console.log('✓ test-identity-service passed');
  process.exit(0);
})();
