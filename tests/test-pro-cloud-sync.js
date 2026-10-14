const assert = require('assert');

// Mock chrome environment
const mockStorage = {
  chapter_tracker_settings: {
    supabaseUrl: 'https://wbappdsgstzintgznikb.supabase.co',
    supabaseKey: 'mock-key',
    syncKey: ''
  },
  chapter_tracker_entries_v3: [
    { id: 'work_1', name: 'One Piece', syncStatus: 'pending', updatedAt: 1000 }
  ]
};

global.chrome = {
  identity: {
    getProfileUserInfo: (cb) => cb({ email: 'subscriber@gmail.com', id: 'gid_1' })
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
        if (Array.isArray(keys)) keys.forEach(k => delete mockStorage[k]);
        else delete mockStorage[keys];
        if (cb) cb();
      }
    }
  }
};

const { StorageLocal } = require('../storage-local');
const { IdentityService } = require('../identity-service');
const { SyncService } = require('../sync-service');

(async function runTests() {
  console.log('Testing DEFAULT_SETTINGS in StorageLocal...');
  const settings = await StorageLocal.getSettings();
  assert.strictEqual(typeof settings.customProEmail, 'string');

  console.log('Testing SyncService guard: blocking FREE users...');
  // Mock IdentityService.checkProStatus to return isPro: false
  IdentityService.checkProStatus = async () => ({
    isPro: false,
    email: 'free_user@gmail.com',
    daysLeft: 0,
    validUntil: 0
  });

  const freeSyncResult = await SyncService.syncAll();
  assert.strictEqual(freeSyncResult.ok, false);
  assert.strictEqual(freeSyncResult.isProRequired, true);
  assert.ok(freeSyncResult.error.includes('Yekun Cloud PRO'));

  console.log('Testing SyncService guard: allowing ACTIVE PRO users with email as sync_key...');
  // Mock IdentityService.checkProStatus to return isPro: true
  IdentityService.checkProStatus = async () => ({
    isPro: true,
    email: 'pro_user@gmail.com',
    daysLeft: 365,
    validUntil: Date.now() + (365 * 86400000)
  });

  // Mock fetch for pushPending & pullRemote
  let calledUrl = '';
  let calledHeaders = {};
  global.fetch = async (url, options) => {
    calledUrl = url;
    calledHeaders = options.headers;
    if (options.method === 'POST') {
      return { ok: true, status: 201 };
    }
    return {
      ok: true,
      status: 200,
      json: async () => []
    };
  };

  const proSyncResult = await SyncService.syncAll();
  assert.strictEqual(proSyncResult.ok, true);
  assert.strictEqual(typeof proSyncResult.pushed, 'number');

  const config = await SyncService.getClientConfig();
  assert.strictEqual(config.syncKey, 'pro_user@gmail.com');
  assert.strictEqual(config.isPro, true);

  console.log('✓ test-pro-cloud-sync passed');
  process.exit(0);
})();
