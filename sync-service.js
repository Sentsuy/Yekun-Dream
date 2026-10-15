/* ════════════════════════════════════════════════════════
   Chapter Tracker — sync-service.js
   Sincronização bidirecional em nuvem via Supabase REST
   com resolução Last-Write-Wins (LWW) e soft-deletes (v3: Works & Sources).
   ════════════════════════════════════════════════════════ */

if (typeof IdentityService === 'undefined' && typeof require !== 'undefined') {
  try {
    const idMod = require('./identity-service');
    if (idMod && idMod.IdentityService) {
      global.IdentityService = idMod.IdentityService;
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

    if (typeof IdentityService !== 'undefined' && IdentityService && IdentityService.checkProStatus) {
      try {
        const proStatus = await IdentityService.checkProStatus({ supabaseUrl, supabaseKey });
        isPro = !!proStatus.isPro;
        proEmail = proStatus.email || '';
      } catch (_) {}
    }

    const syncKey = proEmail || (settings.syncKey ? settings.syncKey.trim() : '');

    return {
      syncKey,
      supabaseUrl,
      supabaseKey,
      isPro,
      proEmail
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
        history: JSON.stringify(w.history || [])
      };
    });

    const url = `${config.supabaseUrl}/rest/v1/entries?on_conflict=id`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.supabaseKey,
        'Authorization': `Bearer ${config.supabaseKey}`,
        'Prefer': 'resolution=merge-duplicates'
      },
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

    const url = `${config.supabaseUrl}/rest/v1/entries?sync_key=eq.${encodeURIComponent(config.syncKey)}&order=updated_at.desc`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': config.supabaseKey,
        'Authorization': `Bearer ${config.supabaseKey}`
      }
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
      const local = map.get(rem.id);
      const remoteUpdatedAt = Number(rem.updated_at) || 0;

      // Se não existe ou remoto é mais recente
      if (!local || remoteUpdatedAt > (local.updatedAt || 0)) {
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

        map.set(rem.id, {
          id: rem.id,
          name: rem.name,
          mainChapter: rem.chapter || (sources[0] && sources[0].chapter) || 'Cap. 1',
          tag: rem.tag || 'manga',
          lastReadSourceId: sources[0] ? sources[0].id : '',
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

      return {
        ok: true,
        pushed: pushRes.pushed,
        pulled: pullRes.pulled,
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
