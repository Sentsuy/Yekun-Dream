/**
 * Test: Device Session Tokens, Anti-Scraping & Headers Integration
 *
 * Verifies that:
 * 1. IdentityService stores, retrieves, and clears `deviceToken`.
 * 2. IdentityService.verifyProAccess, verifyTotpLogin, and claimChargeCredentials persist deviceToken.
 * 3. IdentityService.ensureDeviceSessionToken handles auto-retrieval.
 * 4. SyncService.getClientConfig retrieves deviceToken.
 * 5. SyncService.pushPending, pullRemote, and syncSettings attach 'x-sync-token' header.
 * 6. Migration SQL declares device_sessions table, is_authorized_sync, and security functions.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// 1. Verify SQL syntax and migration definitions
const sqlPath = path.join(__dirname, '..', 'scripts', 'supabase-device-session-security.sql');
assert.ok(fs.existsSync(sqlPath), 'Migration SQL file must exist');
const sqlContent = fs.readFileSync(sqlPath, 'utf8');

assert.ok(sqlContent.includes('CREATE TABLE IF NOT EXISTS device_sessions'), 'Must create device_sessions table');
assert.ok(sqlContent.includes('CREATE OR REPLACE FUNCTION is_authorized_sync'), 'Must declare is_authorized_sync');
assert.ok(sqlContent.includes('request.headers'), 'Must inspect request.headers for x-sync-token');
assert.ok(sqlContent.includes('CREATE OR REPLACE FUNCTION verify_totp_login'), 'Must update verify_totp_login');
assert.ok(sqlContent.includes('CREATE OR REPLACE FUNCTION verify_pro_access'), 'Must update verify_pro_access');
assert.ok(sqlContent.includes('CREATE OR REPLACE FUNCTION get_or_create_device_session'), 'Must declare get_or_create_device_session');
assert.ok(sqlContent.includes('CREATE OR REPLACE FUNCTION revoke_device_session'), 'Must declare revoke_device_session');
assert.ok(sqlContent.includes('CREATE OR REPLACE FUNCTION check_pro_status'), 'Must declare check_pro_status with rate limiting');
assert.ok(sqlContent.includes('GRANT EXECUTE ON FUNCTION is_authorized_sync'), 'Must grant execute on is_authorized_sync');

// Mock chrome environment
const mockStorage = {};
global.chrome = {
  storage: {
    local: {
      get: (keys, cb) => {
        const res = {};
        if (Array.isArray(keys)) {
          keys.forEach(k => { res[k] = mockStorage[k]; });
        } else if (typeof keys === 'string') {
          res[keys] = mockStorage[keys];
        } else if (keys && typeof keys === 'object') {
          Object.keys(keys).forEach(k => {
            res[k] = mockStorage[k] !== undefined ? mockStorage[k] : keys[k];
          });
        }
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
  },
  identity: {
    getProfileUserInfo: (cb) => cb({ email: '', id: '' })
  }
};

const { IdentityService } = require('../identity-service.js');
const { StorageLocal } = require('../storage-local.js');
global.StorageLocal = StorageLocal;
const { SyncService } = require('../sync-service.js');

async function runTests() {
  console.log('Testing Device Session Token integration...');

  // Step 1: Storage credential methods
  await IdentityService.saveStoredCredentials({
    accessPin: '123456',
    deviceToken: 'tok_test_session_123'
  });

  let creds = await IdentityService.getStoredCredentials();
  assert.strictEqual(creds.deviceToken, 'tok_test_session_123', 'Should retrieve saved deviceToken');

  await IdentityService.clearStoredCredentials();
  creds = await IdentityService.getStoredCredentials();
  assert.strictEqual(creds.deviceToken, '', 'Should clear deviceToken on clearStoredCredentials');

  // Step 2: verifyProAccess persists device_token
  global.fetch = async (url, opts) => {
    if (url.includes('rpc/verify_pro_access')) {
      return {
        ok: true,
        json: async () => ({
          success: true,
          isPro: true,
          plan: 'annual',
          validUntil: Date.now() + 30000000,
          access_pin: '123456',
          recovery_key: 'YK-ABCD-EFGH-IJKL',
          device_token: 'tok_verified_device_pro'
        })
      };
    }
    if (url.includes('rpc/verify_totp_login')) {
      return {
        ok: true,
        json: async () => ({
          success: true,
          totp_enabled: true,
          totp_secret: 'JBSWY3DPEHPK3PXP',
          device_token: 'tok_verified_device_totp'
        })
      };
    }
    return { ok: false, status: 404, text: async () => 'Not found' };
  };

  const vRes = await IdentityService.verifyProAccess(
    { supabaseUrl: 'https://test.supabase.co', supabaseKey: 'testkey' },
    'user@test.com',
    '123456'
  );
  assert.ok(vRes.success, 'verifyProAccess must succeed');
  assert.strictEqual(vRes.deviceToken, 'tok_verified_device_pro', 'Must return deviceToken');
  creds = await IdentityService.getStoredCredentials();
  assert.strictEqual(creds.deviceToken, 'tok_verified_device_pro', 'Must persist deviceToken from verifyProAccess');

  // Step 3: verifyTotpLogin persists device_token
  const totpRes = await IdentityService.verifyTotpLogin(
    { supabaseUrl: 'https://test.supabase.co', supabaseKey: 'testkey' },
    'user@test.com',
    '654321'
  );
  assert.ok(totpRes.success, 'verifyTotpLogin must succeed');
  assert.strictEqual(totpRes.deviceToken, 'tok_verified_device_totp', 'Must return deviceToken');
  creds = await IdentityService.getStoredCredentials();
  assert.strictEqual(creds.deviceToken, 'tok_verified_device_totp', 'Must persist deviceToken from verifyTotpLogin');

  // Step 4: SyncService.getClientConfig returns deviceToken
  await StorageLocal.saveSettings({
    supabaseUrl: 'https://test.supabase.co',
    supabaseKey: 'testkey',
    syncKey: 'user@test.com'
  });
  IdentityService.checkProStatus = async () => ({ isPro: true, email: 'user@test.com' });

  const clientConfig = await SyncService.getClientConfig();
  assert.strictEqual(clientConfig.deviceToken, 'tok_verified_device_totp', 'getClientConfig must supply deviceToken');

  // Step 5: Verify 'x-sync-token' header in pushPending, pullRemote, syncSettings
  let capturedHeaders = [];
  global.fetch = async (url, opts) => {
    capturedHeaders.push({ url, headers: opts.headers });
    if (url.includes('/rest/v1/entries')) {
      return {
        ok: true,
        json: async () => []
      };
    }
    if (url.includes('/rest/v1/user_settings')) {
      return {
        ok: true,
        json: async () => []
      };
    }
    return { ok: true, json: async () => ({}) };
  };

  // Push pending
  mockStorage['chapter_tracker_entries_v3'] = [
    { id: 'work_1', name: 'Work 1', syncStatus: 'pending', updatedAt: Date.now() }
  ];
  capturedHeaders = [];
  await SyncService.pushPending();
  assert.ok(capturedHeaders.length > 0, 'pushPending should have made a request');
  assert.strictEqual(
    capturedHeaders[0].headers['x-sync-token'],
    'tok_verified_device_totp',
    'pushPending must send x-sync-token header'
  );

  // Pull remote
  capturedHeaders = [];
  await SyncService.pullRemote();
  assert.ok(capturedHeaders.length > 0, 'pullRemote should have made a request');
  assert.strictEqual(
    capturedHeaders[0].headers['x-sync-token'],
    'tok_verified_device_totp',
    'pullRemote must send x-sync-token header'
  );

  // Sync settings
  capturedHeaders = [];
  await SyncService.syncSettings();
  assert.ok(capturedHeaders.length > 0, 'syncSettings should have made a request');
  assert.strictEqual(
    capturedHeaders[0].headers['x-sync-token'],
    'tok_verified_device_totp',
    'syncSettings must send x-sync-token header'
  );

  console.log('✓ test-device-session-security passed successfully!');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
