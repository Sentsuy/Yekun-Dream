const assert = require('assert');

// ── Setup Mock Environment ──────────────────────────────────
const mockStorage = {
  chapter_tracker_settings: {
    supabaseUrl: 'https://mock.supabase.co',
    supabaseKey: 'mock-key',
    syncKey: ''
  },
  chapter_tracker_entries_v3: []
};

global.chrome = {
  identity: {
    getProfileUserInfo: (cb) => cb({ email: '', id: '' })
  },
  storage: {
    local: {
      get: (keys, cb) => {
        const res = {};
        if (Array.isArray(keys)) {
          keys.forEach(k => { if (mockStorage[k] !== undefined) res[k] = mockStorage[k]; });
        } else if (typeof keys === 'string') {
          if (mockStorage[keys] !== undefined) res[keys] = mockStorage[keys];
        } else if (typeof keys === 'object' && keys !== null) {
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
  }
};

const { StorageLocal } = require('../storage-local');
const { IdentityService } = require('../identity-service');
const { SyncService } = require('../sync-service');

(async () => {
  console.log('Testing Auto-Pull & 2FA Multi-Device Sync Flow...');

  // 1. Simular conta PRO com 2FA ativo no Supabase
  const testEmail = 'brenodias48@gmail.com';
  const remoteWorks = [
    {
      id: 'work_1',
      name: 'Overgeared',
      chapter: 'Cap. 40',
      updated_at: 1000,
      sources: JSON.stringify([{ id: 's1', url: 'https://scan.com/overgeared/40', chapter: 'Cap. 40' }]),
      history: JSON.stringify([]),
      release_days: [1, 4],
      reading_status: 'lendo',
      publication_status: 'lancamento',
      aliases: ['OG']
    },
    {
      id: 'work_2',
      name: 'Solo Leveling',
      chapter: 'Cap. 100',
      updated_at: 2000,
      sources: JSON.stringify([{ id: 's2', url: 'https://scan.com/solo/100', chapter: 'Cap. 100' }]),
      history: JSON.stringify([]),
      release_days: [3],
      reading_status: 'concluido',
      publication_status: 'concluido',
      aliases: ['Na Honjaman Level Up']
    }
  ];

  let remoteSettingsStore = null;

  global.fetch = async (url, opts) => {
    if (url.includes('check_pro_status')) {
      return {
        ok: true,
        json: async () => ({
          isPro: true,
          plan: 'annual',
          validUntil: Date.now() + 365 * 86400000,
          totp_enabled: true
        })
      };
    }
    if (url.includes('user_settings')) {
      if (opts && opts.method === 'POST') {
        const payload = JSON.parse(opts.body);
        remoteSettingsStore = payload[0];
        return { ok: true, status: 201, json: async () => [remoteSettingsStore] };
      }
      return {
        ok: true,
        status: 200,
        json: async () => remoteSettingsStore ? [remoteSettingsStore] : []
      };
    }
    if (url.includes('entries')) {
      if (opts && opts.method === 'POST') {
        return { ok: true, status: 201, json: async () => [] };
      }
      return {
        ok: true,
        status: 200,
        json: async () => remoteWorks
      };
    }
    return { ok: false };
  };

  console.log('1. Setting custom PRO email and verifying 2FA credentials...');
  await IdentityService.setCustomProEmail(testEmail, 'custom');
  await IdentityService.saveStoredCredentials({
    totpSecret: '5SVVKUVYDHCLM5OF',
    totpEnabled: true,
    totpEmail: testEmail,
    accessPin: '',
    recoveryKey: ''
  });

  console.log('2. Verifying checkProStatus returns isPro: true without requiring PIN...');
  const status = await IdentityService.checkProStatus({ supabaseUrl: 'https://mock.supabase.co', supabaseKey: 'mock-key' }, true);
  assert.strictEqual(status.isPro, true, 'User with 2FA verified must be isPro: true');
  assert.strictEqual(status.needsPin, false, 'User with 2FA verified must NOT need PIN');
  assert.strictEqual(status.email, testEmail);

  console.log('3. Verifying SyncService.getClientConfig detects PRO and syncKey...');
  const clientConfig = await SyncService.getClientConfig();
  assert.strictEqual(clientConfig.isPro, true, 'SyncService must recognize PRO status');
  assert.strictEqual(clientConfig.syncKey, testEmail, 'SyncService syncKey must match email');

  console.log('4. Performing auto-pull of remote works...');
  assert.strictEqual((await StorageLocal.getWorks()).length, 0, 'Local works should be initially empty');
  const pullResult = await SyncService.pullRemote();
  assert.strictEqual(pullResult.pulled, 2, 'Should pull exactly 2 works');

  const localWorksAfterPull = await StorageLocal.getWorks();
  assert.strictEqual(localWorksAfterPull.length, 2, 'Local works should now contain 2 works');
  const overgeared = localWorksAfterPull.find(w => w.name === 'Overgeared');
  assert.ok(overgeared, 'Overgeared should exist');
  assert.deepStrictEqual(overgeared.releaseDays, [1, 4], 'Overgeared releaseDays must be [1, 4]');
  assert.strictEqual(overgeared.readingStatus, 'lendo');
  assert.strictEqual(overgeared.publicationStatus, 'lancamento');

  const solo = localWorksAfterPull.find(w => w.name === 'Solo Leveling');
  assert.ok(solo, 'Solo Leveling should exist');
  assert.deepStrictEqual(solo.releaseDays, [3], 'Solo Leveling releaseDays must be [3]');
  assert.strictEqual(solo.readingStatus, 'concluido');
  assert.strictEqual(solo.publicationStatus, 'concluido');

  console.log('5. Testing settings synchronization (pushing and pulling)...');
  // Simular alteração de configurações no PC de casa
  const homeSettings = await StorageLocal.getSettings();
  homeSettings.enableMorningNotification = true;
  homeSettings.enableEveningNotification = false;
  homeSettings.theme = 'neon';
  homeSettings.settingsUpdatedAt = 5000;
  await StorageLocal.saveSettings(homeSettings);

  const pushSettingsRes = await SyncService.syncSettings();
  assert.strictEqual(pushSettingsRes.synced, true);
  assert.strictEqual(pushSettingsRes.action, 'pushed');
  assert.ok(remoteSettingsStore, 'Remote settings store should have received settings payload');
  assert.strictEqual(remoteSettingsStore.settings.theme, 'neon');
  assert.strictEqual(remoteSettingsStore.settings.enableEveningNotification, false);

  // Simular outro PC puxando as configurações da nuvem
  const otherPcSettings = await StorageLocal.getSettings();
  otherPcSettings.theme = 'dark';
  otherPcSettings.enableEveningNotification = true;
  otherPcSettings.settingsUpdatedAt = 1000; // mais antigo que 5000
  await StorageLocal.saveSettings(otherPcSettings);

  const pullSettingsRes = await SyncService.syncSettings();
  assert.strictEqual(pullSettingsRes.synced, true);
  assert.strictEqual(pullSettingsRes.action, 'pulled');

  const syncedSettings = await StorageLocal.getSettings();
  assert.strictEqual(syncedSettings.theme, 'neon', 'Theme should be pulled as neon');
  assert.strictEqual(syncedSettings.enableEveningNotification, false, 'enableEveningNotification should be pulled as false');

  console.log('✓ test-auto-pull-on-connect passed successfully!');
  process.exit(0);
})();
