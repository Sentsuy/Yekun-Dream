/* ════════════════════════════════════════════════════════
   Chapter Tracker — storage-local.js
   Unified local-first persistence via chrome.storage.local
   Version 3: Multi-source works and reading history
   ════════════════════════════════════════════════════════ */

const STORAGE_KEY_ENTRIES_V2 = 'chapter_tracker_entries_v2';
const STORAGE_KEY_ENTRIES_V3 = 'chapter_tracker_entries_v3';
const STORAGE_KEY_SETTINGS   = 'chapter_tracker_settings';

const DEFAULT_SETTINGS = {
  syncKey: '',
  supabaseUrl: '',
  supabaseKey: '',
  autoSyncIntervalMinutes: 15,
  enableFloatingButton: true,
  enableBadgeCount: true,
  enableQuickIncrement: true,
  enableAutoTitleDetection: true,
  enableAutoSync: false,
  blockedDomains: []
};

function extractDomain(url) {
  if (!url || typeof url !== 'string') return '';
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./i, '').toLowerCase();
  } catch (e) {
    const match = url.match(/https?:\/\/(?:www\.)?([^\/\?#]+)/i);
    return match ? match[1].toLowerCase() : '';
  }
}

function formatSiteName(domain) {
  if (!domain) return 'Site Principal';
  const parts = domain.split('.');
  const base = parts.length > 1 ? parts[parts.length - 2] : parts[0];
  if (base.toLowerCase() === 'mangadex') return 'MangaDex';
  if (base.toLowerCase() === 'webtoons') return 'Webtoons';
  if (base.toLowerCase() === 'reaperscans') return 'Reaper Scans';
  if (base.toLowerCase() === 'neoxscans') return 'Neox Scans';
  return base.charAt(0).toUpperCase() + base.slice(1);
}

function generateId(prefix = 'id') {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return prefix + '_' + crypto.randomUUID();
  }
  return prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

const StorageLocal = {
  extractDomain,
  formatSiteName,

  getSettings() {
    return new Promise(resolve => {
      chrome.storage.local.get([STORAGE_KEY_SETTINGS], result => {
        resolve({ ...DEFAULT_SETTINGS, ...(result[STORAGE_KEY_SETTINGS] || {}) });
      });
    });
  },

  saveSettings(settings) {
    return new Promise(resolve => {
      chrome.storage.local.set({ [STORAGE_KEY_SETTINGS]: settings }, () => {
        resolve(settings);
      });
    });
  },

  // ── Migração Automática de v2 para v3 ────────────────────
  async migrateV2ToV3IfNeeded() {
    return new Promise(resolve => {
      chrome.storage.local.get([STORAGE_KEY_ENTRIES_V3, STORAGE_KEY_ENTRIES_V2], async result => {
        if (result[STORAGE_KEY_ENTRIES_V3]) {
          return resolve(result[STORAGE_KEY_ENTRIES_V3]);
        }

        const v2List = result[STORAGE_KEY_ENTRIES_V2] || [];
        if (!Array.isArray(v2List) || v2List.length === 0) {
          const empty = [];
          await new Promise(res => chrome.storage.local.set({ [STORAGE_KEY_ENTRIES_V3]: empty }, res));
          return resolve(empty);
        }

        const migratedWorks = v2List.map(v2 => {
          const domain = extractDomain(v2.url);
          const siteName = formatSiteName(domain);
          const sourceId = generateId('src');
          const now = v2.updatedAt || v2.createdAt || Date.now();

          const source = {
            id: sourceId,
            siteName,
            domain,
            url: v2.url || '',
            chapter: v2.chapter || 'Cap. 1',
            updatedAt: now
          };

          const history = [{
            id: generateId('hist'),
            timestamp: now,
            siteName,
            domain,
            chapter: source.chapter,
            url: source.url
          }];

          return {
            id: v2.id || generateId('work'),
            name: v2.name ? v2.name.trim() : 'Sem título',
            tag: v2.tag || 'manga',
            mainChapter: source.chapter,
            lastReadSourceId: sourceId,
            createdAt: v2.createdAt || now,
            updatedAt: now,
            deleted: !!v2.deleted,
            syncStatus: v2.syncStatus || 'pending',
            sources: [source],
            history
          };
        });

        await new Promise(res => chrome.storage.local.set({ [STORAGE_KEY_ENTRIES_V3]: migratedWorks }, res));
        resolve(migratedWorks);
      });
    });
  },

  async getAllRawWorks() {
    await this.migrateV2ToV3IfNeeded();
    return new Promise(resolve => {
      chrome.storage.local.get([STORAGE_KEY_ENTRIES_V3], result => {
        resolve(result[STORAGE_KEY_ENTRIES_V3] || []);
      });
    });
  },

  async getWorks(includeDeleted = false) {
    const list = await this.getAllRawWorks();
    if (includeDeleted) return list;
    return list.filter(w => !w.deleted);
  },

  async getWorkById(id) {
    const list = await this.getAllRawWorks();
    return list.find(w => w.id === id) || null;
  },

  async findWorkByName(name) {
    if (!name) return null;
    const norm = name.trim().toLowerCase();
    const list = await this.getWorks(false);
    return list.find(w => w.name.trim().toLowerCase() === norm) || null;
  },

  // ── Salva Leitura (Cria ou Atualiza Obra + Fonte + Histórico) ─
  async saveWorkReading(payload) {
    const list = await this.getAllRawWorks();
    const now = Date.now();

    const workName = (payload.workName || payload.name || '').trim() || 'Sem título';
    const normName = workName.toLowerCase();
    const chapter  = (payload.chapter || 'Cap. 1').trim();
    const url      = (payload.url || '').trim();
    const tag      = payload.tag || 'manga';

    const domain   = (payload.domain || extractDomain(url)).toLowerCase();
    const siteName = (payload.siteName || formatSiteName(domain)).trim();

    let work = null;
    if (payload.workId || payload.id) {
      work = list.find(w => w.id === (payload.workId || payload.id));
    } else {
      work = list.find(w => !w.deleted && w.name.trim().toLowerCase() === normName);
    }

    if (work) {
      work.name        = workName;
      work.tag         = payload.tag || work.tag || 'manga';
      work.deleted     = false;
      work.updatedAt   = now;
      work.syncStatus  = 'pending';
      work.mainChapter = chapter;

      if (!Array.isArray(work.sources)) work.sources = [];
      if (!Array.isArray(work.history)) work.history = [];

      // Procura fonte por domínio ou por siteName
      let source = work.sources.find(s => {
        if (domain && s.domain && s.domain === domain) return true;
        if (siteName && s.siteName && s.siteName.toLowerCase() === siteName.toLowerCase()) return true;
        return false;
      });

      if (source) {
        source.chapter   = chapter;
        source.url       = url || source.url;
        source.siteName  = siteName || source.siteName;
        source.domain    = domain || source.domain;
        source.updatedAt = now;
      } else {
        source = {
          id: generateId('src'),
          siteName,
          domain,
          url,
          chapter,
          updatedAt: now
        };
        work.sources.push(source);
      }

      work.lastReadSourceId = source.id;

      // Adiciona ao histórico (limite de 50 entradas)
      work.history.unshift({
        id: generateId('hist'),
        timestamp: now,
        siteName: source.siteName,
        domain: source.domain,
        chapter,
        url: source.url
      });
      if (work.history.length > 50) {
        work.history = work.history.slice(0, 50);
      }
    } else {
      // Nova obra criada
      const sourceId = generateId('src');
      const source = {
        id: sourceId,
        siteName,
        domain,
        url,
        chapter,
        updatedAt: now
      };

      const history = [{
        id: generateId('hist'),
        timestamp: now,
        siteName,
        domain,
        chapter,
        url
      }];

      work = {
        id: (payload.workId || payload.id) || generateId('work'),
        name: workName,
        tag,
        mainChapter: chapter,
        lastReadSourceId: sourceId,
        createdAt: now,
        updatedAt: now,
        deleted: false,
        syncStatus: 'pending',
        sources: [source],
        history
      };

      list.unshift(work);
    }

    await new Promise(resolve => chrome.storage.local.set({ [STORAGE_KEY_ENTRIES_V3]: list }, resolve));
    return work;
  },

  async updateWorkDetails(id, updates = {}) {
    const list = await this.getAllRawWorks();
    const work = list.find(w => w.id === id);
    if (!work) return null;

    if (updates.name) work.name = updates.name.trim();
    if (updates.tag)  work.tag  = updates.tag;
    work.updatedAt  = Date.now();
    work.syncStatus = 'pending';

    await new Promise(resolve => chrome.storage.local.set({ [STORAGE_KEY_ENTRIES_V3]: list }, resolve));
    return work;
  },

  async deleteWork(id) {
    const list = await this.getAllRawWorks();
    const work = list.find(w => w.id === id);
    if (work) {
      work.deleted = true;
      work.updatedAt = Date.now();
      work.syncStatus = 'pending';
      await new Promise(resolve => chrome.storage.local.set({ [STORAGE_KEY_ENTRIES_V3]: list }, resolve));
      return true;
    }
    return false;
  },

  async deleteSource(workId, sourceId) {
    const list = await this.getAllRawWorks();
    const work = list.find(w => w.id === workId);
    if (!work) return null;

    work.sources = (work.sources || []).filter(s => s.id !== sourceId);
    if (work.sources.length === 0) {
      work.deleted = true;
    } else {
      if (work.lastReadSourceId === sourceId) {
        work.lastReadSourceId = work.sources[0].id;
        work.mainChapter = work.sources[0].chapter;
      }
    }

    work.updatedAt  = Date.now();
    work.syncStatus = 'pending';

    await new Promise(resolve => chrome.storage.local.set({ [STORAGE_KEY_ENTRIES_V3]: list }, resolve));
    return work;
  },

  parseChapterIncrement(chapterStr) {
    if (!chapterStr || typeof chapterStr !== 'string') return 'Cap. 1';
    const match = chapterStr.match(/(\d+(\.\d+)?)/);
    if (!match) {
      return chapterStr + ' +1';
    }
    const oldNumStr = match[1];
    const isDecimal = oldNumStr.includes('.');
    const oldNum = parseFloat(oldNumStr);
    const newNum = oldNum + 1;
    const newNumStr = isDecimal ? newNum.toString() : (oldNumStr.startsWith('0') && oldNum < 9 ? '0' + newNum : newNum.toString());
    return chapterStr.replace(oldNumStr, newNumStr);
  },

  async quickIncrementWork(workId) {
    const list = await this.getAllRawWorks();
    const work = list.find(w => w.id === workId);
    if (!work) return null;

    const source = (work.sources || []).find(s => s.id === work.lastReadSourceId) || (work.sources && work.sources[0]);
    const currentChapter = source ? source.chapter : (work.mainChapter || 'Cap. 0');
    const nextChapter = this.parseChapterIncrement(currentChapter);

    const now = Date.now();
    if (source) {
      source.chapter = nextChapter;
      source.updatedAt = now;
      work.lastReadSourceId = source.id;
    }
    work.mainChapter = nextChapter;
    work.updatedAt   = now;
    work.syncStatus  = 'pending';

    if (!Array.isArray(work.history)) work.history = [];
    work.history.unshift({
      id: generateId('hist'),
      timestamp: now,
      siteName: source ? source.siteName : 'Principal',
      domain: source ? source.domain : '',
      chapter: nextChapter,
      url: source ? source.url : ''
    });
    if (work.history.length > 50) {
      work.history = work.history.slice(0, 50);
    }

    await new Promise(resolve => chrome.storage.local.set({ [STORAGE_KEY_ENTRIES_V3]: list }, resolve));
    return work;
  },

  // ── Exportação e Importação de Backup v3 ──────────────────
  async exportBackup() {
    const works = await this.getWorks(true);
    const settings = await this.getSettings();
    return JSON.stringify({
      version: 3,
      exportedAt: new Date().toISOString(),
      works,
      settings: {
        enableFloatingButton: settings.enableFloatingButton,
        enableBadgeCount: settings.enableBadgeCount,
        enableQuickIncrement: settings.enableQuickIncrement,
        enableAutoTitleDetection: settings.enableAutoTitleDetection,
        blockedDomains: settings.blockedDomains
      }
    }, null, 2);
  },

  async importBackup(jsonString) {
    const parsed = JSON.parse(jsonString);
    if (!parsed) throw new Error('Arquivo de backup inválido.');

    const currentWorks = await this.getAllRawWorks();
    const map = new Map(currentWorks.map(w => [w.id, w]));
    let importedCount = 0;

    // Se for backup v3
    if (Array.isArray(parsed.works)) {
      for (const item of parsed.works) {
        if (!item.id || !item.name) continue;
        const existing = map.get(item.id);
        if (!existing || (item.updatedAt || 0) >= (existing.updatedAt || 0)) {
          map.set(item.id, {
            ...item,
            syncStatus: 'pending'
          });
          importedCount++;
        }
      }
    } else if (Array.isArray(parsed.entries)) {
      // Se for backup legado v2
      for (const v2 of parsed.entries) {
        if (!v2.id || !v2.name) continue;
        const domain = extractDomain(v2.url);
        const siteName = formatSiteName(domain);
        const sourceId = generateId('src');
        const now = v2.updatedAt || v2.createdAt || Date.now();

        const source = {
          id: sourceId,
          siteName,
          domain,
          url: v2.url || '',
          chapter: v2.chapter || 'Cap. 1',
          updatedAt: now
        };

        const existing = map.get(v2.id);
        if (!existing || now >= (existing.updatedAt || 0)) {
          map.set(v2.id, {
            id: v2.id,
            name: v2.name,
            tag: v2.tag || 'manga',
            mainChapter: source.chapter,
            lastReadSourceId: sourceId,
            createdAt: v2.createdAt || now,
            updatedAt: now,
            deleted: !!v2.deleted,
            syncStatus: 'pending',
            sources: [source],
            history: [{
              id: generateId('hist'),
              timestamp: now,
              siteName,
              domain,
              chapter: source.chapter,
              url: source.url
            }]
          });
          importedCount++;
        }
      }
    } else {
      throw new Error('Estrutura de dados não reconhecida no backup.');
    }

    const merged = Array.from(map.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    await new Promise(resolve => chrome.storage.local.set({ [STORAGE_KEY_ENTRIES_V3]: merged }, resolve));

    if (parsed.settings) {
      const currentSettings = await this.getSettings();
      await this.saveSettings({ ...currentSettings, ...parsed.settings });
    }

    return importedCount;
  },

  // ── Compatibilidade Retroativa para métodos v2 ────────────
  async getEntries(includeDeleted = false) {
    const works = await this.getWorks(includeDeleted);
    return works.map(w => {
      const activeSource = (w.sources || []).find(s => s.id === w.lastReadSourceId) || (w.sources && w.sources[0]) || {};
      return {
        id: w.id,
        name: w.name,
        chapter: w.mainChapter || activeSource.chapter || 'Cap. 1',
        url: activeSource.url || '',
        tag: w.tag,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
        deleted: w.deleted,
        syncStatus: w.syncStatus
      };
    });
  },

  async getAllRawEntries() {
    return this.getEntries(true);
  },

  async saveEntry(entryData) {
    const work = await this.saveWorkReading({
      workId: entryData.id,
      workName: entryData.name,
      chapter: entryData.chapter,
      url: entryData.url,
      tag: entryData.tag
    });
    const activeSource = (work.sources || []).find(s => s.id === work.lastReadSourceId) || (work.sources && work.sources[0]) || {};
    return {
      id: work.id,
      name: work.name,
      chapter: work.mainChapter,
      url: activeSource.url || '',
      tag: work.tag,
      createdAt: work.createdAt,
      updatedAt: work.updatedAt,
      deleted: work.deleted,
      syncStatus: work.syncStatus
    };
  },

  async deleteEntry(id) {
    return this.deleteWork(id);
  },

  async quickIncrementChapter(id) {
    const work = await this.quickIncrementWork(id);
    if (!work) return null;
    const activeSource = (work.sources || []).find(s => s.id === work.lastReadSourceId) || (work.sources && work.sources[0]) || {};
    return {
      id: work.id,
      name: work.name,
      chapter: work.mainChapter,
      url: activeSource.url || '',
      tag: work.tag,
      updatedAt: work.updatedAt,
      syncStatus: work.syncStatus
    };
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { StorageLocal, DEFAULT_SETTINGS };
}
