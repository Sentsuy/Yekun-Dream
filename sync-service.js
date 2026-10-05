/* ════════════════════════════════════════════════════════
   Chapter Tracker — sync-service.js
   Sincronização bidirecional em nuvem via Supabase REST
   com resolução Last-Write-Wins (LWW) e soft-deletes.
   ════════════════════════════════════════════════════════ */

const SyncService = {
  async getClientConfig() {
    const settings = await StorageLocal.getSettings();
    return {
      syncKey: settings.syncKey ? settings.syncKey.trim() : '',
      supabaseUrl: settings.supabaseUrl ? settings.supabaseUrl.trim().replace(/\/$/, '') : '',
      supabaseKey: settings.supabaseKey ? settings.supabaseKey.trim() : ''
    };
  },

  async pushPending() {
    const config = await this.getClientConfig();
    if (!config.syncKey || !config.supabaseUrl || !config.supabaseKey) {
      return { pushed: 0, reason: 'offline_mode' };
    }

    const allEntries = await StorageLocal.getAllRawEntries();
    const pending = allEntries.filter(e => e.syncStatus === 'pending');

    if (pending.length === 0) {
      return { pushed: 0 };
    }

    const payload = pending.map(e => ({
      id: e.id,
      sync_key: config.syncKey,
      name: e.name,
      chapter: e.chapter,
      url: e.url || '',
      tag: e.tag || 'manga',
      created_at: e.createdAt,
      updated_at: e.updatedAt,
      deleted: !!e.deleted
    }));

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

    // Mark as synced locally
    const pendingIds = new Set(pending.map(p => p.id));
    allEntries.forEach(e => {
      if (pendingIds.has(e.id)) {
        e.syncStatus = 'synced';
      }
    });

    await new Promise(resolve => chrome.storage.local.set({ ['chapter_tracker_entries_v2']: allEntries }, resolve));
    return { pushed: pending.length };
  },

  async pullRemote() {
    const config = await this.getClientConfig();
    if (!config.syncKey || !config.supabaseUrl || !config.supabaseKey) {
      return { pulled: 0, reason: 'offline_mode' };
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

    const localList = await StorageLocal.getAllRawEntries();
    const map = new Map(localList.map(e => [e.id, e]));

    let updatedCount = 0;
    for (const rem of remoteEntries) {
      const local = map.get(rem.id);
      const remoteUpdatedAt = Number(rem.updated_at) || 0;

      // Se não existe ou remoto é mais recente
      if (!local || remoteUpdatedAt > (local.updatedAt || 0)) {
        map.set(rem.id, {
          id: rem.id,
          name: rem.name,
          chapter: rem.chapter,
          url: rem.url || '',
          tag: rem.tag || 'manga',
          createdAt: Number(rem.created_at) || remoteUpdatedAt,
          updatedAt: remoteUpdatedAt,
          deleted: !!rem.deleted,
          syncStatus: 'synced'
        });
        updatedCount++;
      }
    }

    const merged = Array.from(map.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    await new Promise(resolve => chrome.storage.local.set({ ['chapter_tracker_entries_v2']: merged }, resolve));

    return { pulled: updatedCount };
  },

  async syncAll() {
    try {
      const config = await this.getClientConfig();
      if (!config.syncKey) {
        return { ok: true, message: 'Modo local ativo (nenhuma chave de sincronização configurada).' };
      }
      if (!config.supabaseUrl || !config.supabaseKey) {
        return { ok: false, error: 'URL ou chave de API do Supabase não configuradas.' };
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
    }
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SyncService };
}
