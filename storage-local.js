/* ════════════════════════════════════════════════════════
   Chapter Tracker — storage-local.js
   Unified local-first persistence via chrome.storage.local
   ════════════════════════════════════════════════════════ */

const STORAGE_KEY_ENTRIES  = 'chapter_tracker_entries_v2';
const STORAGE_KEY_SETTINGS = 'chapter_tracker_settings';

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

const StorageLocal = {
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

  getEntries(includeDeleted = false) {
    return new Promise(resolve => {
      chrome.storage.local.get([STORAGE_KEY_ENTRIES], result => {
        const list = result[STORAGE_KEY_ENTRIES] || [];
        if (includeDeleted) return resolve(list);
        resolve(list.filter(e => !e.deleted));
      });
    });
  },

  getAllRawEntries() {
    return new Promise(resolve => {
      chrome.storage.local.get([STORAGE_KEY_ENTRIES], result => {
        resolve(result[STORAGE_KEY_ENTRIES] || []);
      });
    });
  },

  async saveEntry(entryData) {
    const list = await this.getAllRawEntries();
    const now = Date.now();
    let target = null;

    if (entryData.id) {
      target = list.find(e => e.id === entryData.id);
    } else if (entryData.name) {
      const norm = entryData.name.trim().toLowerCase();
      target = list.find(e => !e.deleted && e.name.trim().toLowerCase() === norm);
    }

    if (target) {
      target.name       = entryData.name || target.name;
      target.chapter    = entryData.chapter !== undefined ? entryData.chapter : target.chapter;
      target.url        = entryData.url !== undefined ? entryData.url : target.url;
      target.tag        = entryData.tag || target.tag || 'manga';
      target.deleted    = false;
      target.updatedAt  = now;
      target.syncStatus = 'pending';
    } else {
      target = {
        id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'id_' + now + '_' + Math.random().toString(36).slice(2, 8),
        name: entryData.name ? entryData.name.trim() : 'Sem título',
        chapter: entryData.chapter ? entryData.chapter.trim() : 'Cap. 1',
        url: entryData.url ? entryData.url.trim() : '',
        tag: entryData.tag || 'manga',
        createdAt: now,
        updatedAt: now,
        deleted: false,
        syncStatus: 'pending'
      };
      list.unshift(target);
    }

    await new Promise(resolve => chrome.storage.local.set({ [STORAGE_KEY_ENTRIES]: list }, resolve));
    return target;
  },

  async deleteEntry(id) {
    const list = await this.getAllRawEntries();
    const entry = list.find(e => e.id === id);
    if (entry) {
      entry.deleted = true;
      entry.updatedAt = Date.now();
      entry.syncStatus = 'pending';
      await new Promise(resolve => chrome.storage.local.set({ [STORAGE_KEY_ENTRIES]: list }, resolve));
      return true;
    }
    return false;
  },

  parseChapterIncrement(chapterStr) {
    if (!chapterStr || typeof chapterStr !== 'string') return 'Cap. 1';
    // Match numbers with possible decimals
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

  async quickIncrementChapter(id) {
    const list = await this.getAllRawEntries();
    const entry = list.find(e => e.id === id);
    if (!entry) return null;

    entry.chapter = this.parseChapterIncrement(entry.chapter);
    entry.updatedAt = Date.now();
    entry.syncStatus = 'pending';
    await new Promise(resolve => chrome.storage.local.set({ [STORAGE_KEY_ENTRIES]: list }, resolve));
    return entry;
  },

  async exportBackup() {
    const entries = await this.getEntries(true);
    const settings = await this.getSettings();
    return JSON.stringify({
      version: 2,
      exportedAt: new Date().toISOString(),
      entries,
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
    if (!parsed || !Array.isArray(parsed.entries)) {
      throw new Error('Formato de arquivo de backup inválido.');
    }
    const currentList = await this.getAllRawEntries();
    const map = new Map(currentList.map(e => [e.id, e]));

    let importedCount = 0;
    for (const item of parsed.entries) {
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

    const merged = Array.from(map.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    await new Promise(resolve => chrome.storage.local.set({ [STORAGE_KEY_ENTRIES]: merged }, resolve));

    if (parsed.settings) {
      const currentSettings = await this.getSettings();
      await this.saveSettings({ ...currentSettings, ...parsed.settings });
    }

    return importedCount;
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { StorageLocal, DEFAULT_SETTINGS };
}
