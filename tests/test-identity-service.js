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

  console.log('✓ test-identity-service passed');
  process.exit(0);
})();
