/* ════════════════════════════════════════════════════════
   Chapter Tracker — sync-service.js
   Sincronização bidirecional em nuvem via Supabase REST
   com resolução Last-Write-Wins (LWW) e soft-deletes (v3: Works & Sources).
   ════════════════════════════════════════════════════════ */

if (typeof IdentityService === 'undefined' && typeof require !== 'undefined') {
  try {
    const idMod = require('./identity-service');
    if (idMod && idMod.IdentityService) {
      (typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this)).IdentityService = idMod.IdentityService;
    }
  } catch (_) {}
}

const STORAGE_KEY_ENTRIES_V3 = 'chapter_tracker_entries_v3';

const SyncService = {
  async getClientConfig() {
    const settings = await StorageLocal.getSettings();
    const supabaseUrl = settings.supabaseUrl ? settings.supabaseUrl.trim().replace(/\/$/, '') : '';
    const supabaseKey = settings.supabaseKey ? settings.supabaseKey.trim() : '';

    let isPro = false;
    let proEmail = '';
    let deviceToken = '';

    if (typeof IdentityService !== 'undefined' && IdentityService) {
      if (IdentityService.checkProStatus) {
        try {
          const proStatus = await IdentityService.checkProStatus({ supabaseUrl, supabaseKey });
          isPro = !!proStatus.isPro;
          proEmail = proStatus.email || '';
        } catch (_) {}
      }

      if (isPro && proEmail && IdentityService.ensureDeviceSessionToken) {
        try {
          deviceToken = await IdentityService.ensureDeviceSessionToken({ supabaseUrl, supabaseKey }, proEmail);
        } catch (_) {}
      } else if (IdentityService.getStoredCredentials) {
        try {
          const creds = await IdentityService.getStoredCredentials();
          deviceToken = (creds && creds.deviceToken) ? creds.deviceToken : '';
        } catch (_) {}
      }
    }

    const syncKey = proEmail || (settings.syncKey ? settings.syncKey.trim() : '');

    return {
      syncKey,
      supabaseUrl,
      supabaseKey,
      isPro,
      proEmail,
      deviceToken
    };
  },

  async pushPending() {
    const config = await this.getClientConfig();
    if (!config.isPro || !config.syncKey || !config.supabaseUrl || !config.supabaseKey) {
      return { pushed: 0, reason: 'offline_or_free_mode' };
    }

    const allWorks = await StorageLocal.getAllRawWorks();
    const pending = allWorks.filter(w => w.syncStatus === 'pending');

    if (pending.length === 0) {
      return { pushed: 0 };
    }

    const payload = pending.map(w => {
      const activeSrc = (w.sources || []).find(s => s.id === w.lastReadSourceId) || (w.sources && w.sources[0]) || {};
      return {
        id: w.id,
        sync_key: config.syncKey,
        name: w.name,
        chapter: w.mainChapter || activeSrc.chapter || 'Cap. 1',
        url: activeSrc.url || '',
        tag: w.tag || 'manga',
        created_at: w.createdAt,
        updated_at: w.updatedAt,
        deleted: !!w.deleted,
        sources: JSON.stringify(w.sources || []),
        history: JSON.stringify(w.history || []),
        release_days: Array.isArray(w.releaseDays) ? w.releaseDays : [],
        reading_status: w.readingStatus || 'lendo',
        publication_status: w.publicationStatus || 'lancamento',
        aliases: Array.isArray(w.aliases) ? w.aliases : [],
        last_read_source_id: w.lastReadSourceId || ''
      };
    });

    const pushHeaders = {
      'Content-Type': 'application/json',
      'apikey': config.supabaseKey,
      'Authorization': `Bearer ${config.supabaseKey}`,
      'Prefer': 'resolution=merge-duplicates'
    };
    if (config.deviceToken) {
      pushHeaders['x-sync-token'] = config.deviceToken;
    }

    const url = `${config.supabaseUrl}/rest/v1/entries?on_conflict=id`;
    const response = await fetch(url, {
      method: 'POST',
      headers: pushHeaders,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Falha no envio de dados: ${response.status} - ${errText}`);
    }

    // Marca como synced localmente
    const pendingIds = new Set(pending.map(p => p.id));
    allWorks.forEach(w => {
      if (pendingIds.has(w.id)) {
        w.syncStatus = 'synced';
      }
    });

    await new Promise(resolve => chrome.storage.local.set({ [STORAGE_KEY_ENTRIES_V3]: allWorks }, resolve));
    return { pushed: pending.length };
  },

  async pullRemote() {
    const config = await this.getClientConfig();
    if (!config.isPro || !config.syncKey || !config.supabaseUrl || !config.supabaseKey) {
      return { pulled: 0, reason: 'offline_or_free_mode' };
    }

    const pullHeaders = {
      'apikey': config.supabaseKey,
      'Authorization': `Bearer ${config.supabaseKey}`
    };
    if (config.deviceToken) {
      pullHeaders['x-sync-token'] = config.deviceToken;
    }

    const url = `${config.supabaseUrl}/rest/v1/entries?sync_key=eq.${encodeURIComponent(config.syncKey)}&order=updated_at.desc`;
    const response = await fetch(url, {
      method: 'GET',
      headers: pullHeaders
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Falha no recebimento de dados: ${response.status} - ${errText}`);
    }

    const remoteEntries = await response.json();
    if (!Array.isArray(remoteEntries)) {
      return { pulled: 0 };
    }

    const localList = await StorageLocal.getAllRawWorks();
    const map = new Map(localList.map(w => [w.id, w]));

    let updatedCount = 0;
    for (const rem of remoteEntries) {
      let local = map.get(rem.id);
      if (!local && rem.name && typeof StorageLocal.findMatchingWork === 'function') {
        const matchRes = StorageLocal.findMatchingWork(rem.name, Array.from(map.values()));
        if (matchRes && matchRes.exactMatch) {
          local = matchRes.exactMatch;
        }
      }
      const remoteUpdatedAt = Number(rem.updated_at) || 0;

      let sources = [];
      let history = [];

      try {
        if (rem.sources) {
          sources = typeof rem.sources === 'string' ? JSON.parse(rem.sources) : rem.sources;
        }
      } catch (e) {
        sources = [];
      }

      try {
        if (rem.history) {
          history = typeof rem.history === 'string' ? JSON.parse(rem.history) : rem.history;
        }
      } catch (e) {
        history = [];
      }

      if (!Array.isArray(sources) || sources.length === 0) {
        const domain = StorageLocal.extractDomain(rem.url);
        const siteName = StorageLocal.formatSiteName(domain);
        const srcId = 'src_' + rem.id;
        sources = [{
          id: srcId,
          siteName,
          domain,
          url: rem.url || '',
          chapter: rem.chapter || 'Cap. 1',
          updatedAt: remoteUpdatedAt
        }];
      }

      let releaseDays = [];
      try {
        if (rem.release_days) {
          releaseDays = typeof rem.release_days === 'string' ? JSON.parse(rem.release_days) : rem.release_days;
        }
      } catch (_) { releaseDays = []; }
      if (!Array.isArray(releaseDays)) releaseDays = [];

      let aliases = [];
      try {
        if (rem.aliases) {
          aliases = typeof rem.aliases === 'string' ? JSON.parse(rem.aliases) : rem.aliases;
        }
      } catch (_) { aliases = []; }
      if (!Array.isArray(aliases)) aliases = [];

      const remoteWorkData = {
        name: rem.name,
        mainChapter: rem.chapter || (sources[0] && sources[0].chapter) || 'Cap. 1',
        tag: rem.tag || 'manga',
        readingStatus: rem.reading_status || 'lendo',
        publicationStatus: rem.publication_status || 'lancamento',
        releaseDays,
        aliases,
        lastReadSourceId: rem.last_read_source_id || (sources[0] ? sources[0].id : ''),
        updatedAt: remoteUpdatedAt,
        deleted: !!rem.deleted,
        sources,
        history
      };

      if (local) {
        if (typeof StorageLocal.mergeWorkData === 'function') {
          StorageLocal.mergeWorkData(local, remoteWorkData);
        } else if (remoteUpdatedAt > (local.updatedAt || 0)) {
          Object.assign(local, remoteWorkData);
        }
        local.syncStatus = 'synced';
        map.set(local.id, local);
        updatedCount++;
      } else {
        map.set(rem.id, {
          id: rem.id,
          name: rem.name,
          mainChapter: rem.chapter || (sources[0] && sources[0].chapter) || 'Cap. 1',
          tag: rem.tag || 'manga',
          readingStatus: rem.reading_status || 'lendo',
          publicationStatus: rem.publication_status || 'lancamento',
          releaseDays,
          aliases,
          lastReadSourceId: rem.last_read_source_id || (sources[0] ? sources[0].id : ''),
          createdAt: Number(rem.created_at) || remoteUpdatedAt,
          updatedAt: remoteUpdatedAt,
          deleted: !!rem.deleted,
          syncStatus: 'synced',
          sources,
          history
        });
        updatedCount++;
      }
    }

    const merged = Array.from(map.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    await new Promise(resolve => chrome.storage.local.set({ [STORAGE_KEY_ENTRIES_V3]: merged }, resolve));

    return { pulled: updatedCount };
  },

  async syncSettings() {
    const config = await this.getClientConfig();
    if (!config.isPro || !config.syncKey || !config.supabaseUrl || !config.supabaseKey) {
      return { synced: false, reason: 'offline_or_free_mode' };
    }

    try {
      const currentSettings = await StorageLocal.getSettings();
      const localUpdated = Number(currentSettings.settingsUpdatedAt) || 0;

      // 1. Consulta configurações remotas do usuário
      const url = `${config.supabaseUrl}/rest/v1/user_settings?sync_key=eq.${encodeURIComponent(config.syncKey)}`;
      const getHeaders = {
        'apikey': config.supabaseKey,
        'Authorization': `Bearer ${config.supabaseKey}`
      };
      if (config.deviceToken) {
        getHeaders['x-sync-token'] = config.deviceToken;
      }
      const res = await fetch(url, {
        method: 'GET',
        headers: getHeaders
      });

      if (!res.ok) {
        return { synced: false, error: `Falha ao buscar configurações: ${res.status}` };
      }

      const rows = await res.json();
      const remote = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;

      // Chaves de preferência que devem ser sincronizadas entre computadores
      const SYNCABLE_KEYS = [
        'enableReleaseNotifications',
        'enableMorningNotification',
        'enableEveningNotification',
        'autoTrackAnime',
        'enableFloatingButton',
        'enableBadgeCount',
        'enableQuickIncrement',
        'enableAutoTitleDetection',
        'enableAutoSync',
        'theme',
        'allowedDomains',
        'blockedDomains'
      ];

      if (remote && remote.settings) {
        const remoteUpdated = Number(remote.updated_at) || 0;
        const remoteSettings = typeof remote.settings === 'string' ? JSON.parse(remote.settings) : remote.settings;

        // Se as configurações da nuvem forem mais recentes que as locais, puxa para o computador atual
        if (remoteUpdated > localUpdated) {
          let hasChanges = false;
          for (const k of SYNCABLE_KEYS) {
            if (remoteSettings[k] !== undefined && JSON.stringify(remoteSettings[k]) !== JSON.stringify(currentSettings[k])) {
              currentSettings[k] = remoteSettings[k];
              hasChanges = true;
            }
          }
          if (hasChanges) {
            currentSettings.settingsUpdatedAt = remoteUpdated;
            await StorageLocal.saveSettings(currentSettings);
            return { synced: true, action: 'pulled', remoteUpdated };
          }
          return { synced: true, action: 'unchanged' };
        }
      }

      // Caso contrário, se as configurações locais são mais recentes (ou nuvem está vazia), envia para a nuvem
      const payloadSettings = {};
      for (const k of SYNCABLE_KEYS) {
        if (currentSettings[k] !== undefined) {
          payloadSettings[k] = currentSettings[k];
        }
      }

      const now = Date.now();
      const pushHeaders = {
        'Content-Type': 'application/json',
        'apikey': config.supabaseKey,
        'Authorization': `Bearer ${config.supabaseKey}`,
        'Prefer': 'resolution=merge-duplicates'
      };
      if (config.deviceToken) {
        pushHeaders['x-sync-token'] = config.deviceToken;
      }
      const pushRes = await fetch(`${config.supabaseUrl}/rest/v1/user_settings?on_conflict=sync_key`, {
        method: 'POST',
        headers: pushHeaders,
        body: JSON.stringify([{
          sync_key: config.syncKey,
          settings: payloadSettings,
          updated_at: localUpdated > 0 ? localUpdated : now
        }])
      });

      if (pushRes.ok) {
        if (!currentSettings.settingsUpdatedAt) {
          currentSettings.settingsUpdatedAt = now;
          await StorageLocal.saveSettings(currentSettings);
        }
        return { synced: true, action: 'pushed' };
      }
    } catch (e) {
      console.debug('[SyncService] Erro ao sincronizar configurações:', e);
    }
    return { synced: false };
  },

  async syncAll() {
    // I-04: Evitar race condition — rejeitar se já há uma sync em andamento
    if (SyncService._syncInProgress) {
      return { ok: false, reason: 'sync_already_in_progress' };
    }
    SyncService._syncInProgress = true;
    try {
      const config = await this.getClientConfig();
      if (!config.supabaseUrl || !config.supabaseKey) {
        return { ok: false, error: 'URL ou chave de API do Supabase não configuradas.' };
      }
      if (!config.isPro) {
        return {
          ok: false,
          isProRequired: true,
          error: 'A sincronização em nuvem é um recurso do Yekun Cloud PRO. Ative sua assinatura anual por R$ 20/ano para sincronizar.'
        };
      }
      if (!config.syncKey) {
        return { ok: false, error: 'E-mail ou chave de sincronização não identificados.' };
      }

      const pushRes = await this.pushPending();
      const pullRes = await this.pullRemote();
      const settingsRes = await this.syncSettings();

      return {
        ok: true,
        pushed: pushRes.pushed,
        pulled: pullRes.pulled,
        settingsSynced: !!(settingsRes && settingsRes.synced),
        timestamp: Date.now()
      };
    } catch (err) {
      return { ok: false, error: err.message };
    } finally {
      SyncService._syncInProgress = false;
    }
  }
};

SyncService._syncInProgress = false;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SyncService };
}

(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this)).SyncService = SyncService;
