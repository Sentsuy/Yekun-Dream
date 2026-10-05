# Chapter Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Chapter Tracker into a fully functional, testable browser extension with scalable local storage (`chrome.storage.local`), no card duplication, customizable user settings toggles, editable SVG icon generation, "+1 capítulo" quick action, JSON backup/restore, and cross-browser cloud sync readiness via Supabase REST.

**Architecture:** Two-tier Local-First architecture. Tier 1 handles instant local operations via `storage-local.js` (`chrome.storage.local`) with zero network latency and no 8KB item limit. Tier 2 integrates `sync-service.js` and `background.js` (via `chrome.alarms`) for bidirectional cross-browser synchronization using Last-Write-Wins and soft deletes. The UI exposes granular user toggles in `popup.html`/`popup.js` so users control which features affect their browsing.

**Tech Stack:** JavaScript (ES6+ Modules / Vanilla), WebExtensions Manifest V3 (`chrome.storage.local`, `chrome.alarms`, `chrome.tabs`, `chrome.runtime`), HTML5 Canvas / SVG, CSS3 with Shadow DOM encapsulation.

**Spec:** [`docs/superpowers/specs/2026-10-05-chapter-tracker-refactor-sync-design.md`](file:///mnt/c/Users/Sentsuy/OneDrive/Projetos/Pessoal/Yekun%20Dreaw%20-%20Exten%C3%A7%C3%A3o/docs/superpowers/specs/2026-10-05-chapter-tracker-refactor-sync-design.md)

## Global Constraints

- Manifest Version: 3 (MV3).
- Zero external runtime npm dependencies for the client extension (pure browser APIs, native `fetch` for sync).
- All persistent local data must reside in `chrome.storage.local` under keys `chapter_tracker_entries_v2` and `chapter_tracker_settings`.
- Content script styles must remain strictly isolated inside Shadow DOM (`attachShadow({ mode: 'open' })`).
- Visual design tokens must match the established dark neon palette (`#0d0d0f`, `#141418`, `#1c1c22`, `#e8ff47`, `#ff5c5c`, `#2a2a32`).

## Review Focus

1. **Chapter Number Parsing**: Input strings like "Cap. 104", "Capítulo 45.5", "Ep. 09", "Volume 3", or "1102" must increment correctly when clicking "+1" without corrupting non-numeric prefixes or suffixes.
2. **Duplication Guard in `content.js`**: Saving on a page that was already tracked must update the existing entry (matching by normalized name or ID) instead of creating duplicate cards.
3. **Storage Quota & Offline Safety**: Modifying entries while offline must save locally immediately and flag `syncStatus = 'pending'`, never blocking or throwing network exceptions.
4. **Domain Filtering & Toggle Safety**: When `enableFloatingButton` is false or the current host matches `blockedDomains`, the content script must cleanly abort without injecting DOM or throwing errors.
5. **Backup Import Validation**: Corrupted or malformed JSON files uploaded in the import backup dialog must be rejected with user-friendly feedback without clearing or corrupting existing data.

---

### Task 1: Master SVG Icon & Automated PNG Generator

**Files:**
- Create: `icons/icon.svg`
- Create: `scripts/generate-icons.js`
- Test: `tests/verify-icons.js`
- Modify: `manifest.json`

**Interfaces:**
- Produces: `icons/icon.svg` (editable vector master), `icons/icon16.png`, `icons/icon32.png`, `icons/icon48.png`, `icons/icon128.png`.

- [ ] **Step 1: Write test to verify icons existence and dimensions**

Create `tests/verify-icons.js`:
```javascript
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const requiredFiles = [
  'icons/icon.svg',
  'icons/icon16.png',
  'icons/icon32.png',
  'icons/icon48.png',
  'icons/icon128.png'
];

let failed = false;
for (const file of requiredFiles) {
  const filePath = path.join(root, file);
  if (!fs.existsSync(filePath)) {
    console.error(`Missing expected icon file: ${file}`);
    failed = true;
  } else {
    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      console.error(`Icon file is empty: ${file}`);
      failed = true;
    }
  }
}

if (failed) {
  process.exit(1);
} else {
  console.log('Icon verification passed.');
  process.exit(0);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/verify-icons.js`  
Expected: FAIL with "Missing expected icon file: icons/icon.svg".

- [ ] **Step 3: Create Master SVG and PNG Generator Script**

Create `icons/icon.svg`:
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="100%" height="100%">
  <defs>
    <radialGradient id="bgGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#1c1c24"/>
      <stop offset="100%" stop-color="#0d0d10"/>
    </radialGradient>
    <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="4" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>

  <!-- Background Circle with Border -->
  <rect width="128" height="128" rx="28" fill="url(#bgGlow)" />
  <rect x="2" y="2" width="124" height="124" rx="26" fill="none" stroke="#2a2a35" stroke-width="3" />

  <!-- Outer Diamond (Accent Neon) -->
  <polygon points="64,22 106,64 64,106 22,64" fill="none" stroke="#e8ff47" stroke-width="6" stroke-linejoin="round" filter="url(#neonGlow)"/>

  <!-- Inner Diamond -->
  <polygon points="64,38 90,64 64,90 38,64" fill="#e8ff47" />

  <!-- Center Core Cutout -->
  <circle cx="64" cy="64" r="8" fill="#0d0d10" />
</svg>
```

Create `scripts/generate-icons.js` (using pure Node.js with built-in Canvas/SVG rasterizer or pure PNG chunk builder for 16, 32, 48, 128):
```javascript
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const iconsDir = path.resolve(__dirname, '../icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Generate valid RGBA PNG images programmatically for each required size
// Matches the visual brand: dark background (#0d0d10) with neon diamond (#e8ff47)
function createPng(size) {
  const zlib = require('zlib');

  function crc32(buf) {
    let table = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[n] = c;
    }
    let crc = 0 ^ (-1);
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
    }
    return (crc ^ (-1)) >>> 0;
  }

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    const crcVal = crc32(Buffer.concat([typeBuf, data]));
    crcBuf.writeUInt32BE(crcVal, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  // PNG Signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // Raw Image Data (with filter byte 0 at start of each scanline)
  const rowBytes = size * 4;
  const raw = Buffer.alloc(size * (rowBytes + 1));
  const cx = size / 2;
  const cy = size / 2;
  const rMax = size / 2 - 1;

  for (let y = 0; y < size; y++) {
    const rowOffset = y * (rowBytes + 1);
    raw[rowOffset] = 0; // Filter None

    for (let x = 0; x < size; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = Math.abs(x - cx + 0.5);
      const dy = Math.abs(y - cy + 0.5);
      const dist = Math.hypot(x - cx, y - cy);

      // Check diamond formula: |x - cx| + |y - cy|
      const diamondDist = dx + dy;

      if (dist <= rMax) {
        // Base dark circle #141418
        let r = 20, g = 20, b = 24, a = 255;

        // Outer neon border on diamond (proportional)
        const dOuter = size * 0.42;
        const dInner = size * 0.22;
        const dCore  = size * 0.08;

        if (diamondDist <= dOuter && diamondDist >= dInner) {
          // Neon Yellow #e8ff47
          r = 232; g = 255; b = 71; a = 255;
        } else if (diamondDist < dInner && diamondDist >= dCore) {
          // Soft accent
          r = 210; g = 235; b = 60; a = 255;
        } else if (diamondDist < dCore) {
          // Center core #0d0d10
          r = 13; g = 13; b = 16; a = 255;
        }

        raw[pxOffset] = r;
        raw[pxOffset + 1] = g;
        raw[pxOffset + 2] = b;
        raw[pxOffset + 3] = a;
      } else {
        // Transparent outside rounded icon
        raw[pxOffset] = 0;
        raw[pxOffset + 1] = 0;
        raw[pxOffset + 2] = 0;
        raw[pxOffset + 3] = 0;
      }
    }
  }

  const idat = zlib.deflateSync(raw);
  return Buffer.concat([
    sig,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', idat),
    makeChunk('IEND', Buffer.alloc(0))
  ]);
}

[16, 32, 48, 128].forEach(size => {
  const buf = createPng(size);
  fs.writeFileSync(path.join(iconsDir, `icon${size}.png`), buf);
  console.log(`Generated icons/icon${size}.png (${buf.length} bytes)`);
});
```

Execute generator:
`node scripts/generate-icons.js`

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/verify-icons.js`  
Expected: PASS with "Icon verification passed."

- [ ] **Step 5: Commit**

```bash
git add icons/ scripts/generate-icons.js tests/verify-icons.js manifest.json
git commit -m "feat: add master icon.svg, icon generator, and manifest icons"
```

---

### Task 2: Unified Local Storage Layer & Settings Management

**Files:**
- Create: `storage-local.js`
- Test: `tests/storage-local.test.js`

**Interfaces:**
- Produces:
  - `StorageLocal.getEntries(includeDeleted)`
  - `StorageLocal.saveEntry(entry)`
  - `StorageLocal.deleteEntry(id)`
  - `StorageLocal.quickIncrementChapter(id)`
  - `StorageLocal.getSettings()`
  - `StorageLocal.saveSettings(newSettings)`
  - `StorageLocal.exportBackup()`
  - `StorageLocal.importBackup(jsonString)`
  - `StorageLocal.parseChapterIncrement(chapterStr)`

- [ ] **Step 1: Write test for storage-local utility and chapter parsing**

Create `tests/storage-local.test.js`:
```javascript
const assert = require('assert');
const { StorageLocal } = require('../storage-local');

// Mock chrome.storage.local in Node.js environment
const memoryStore = {};
global.chrome = {
  storage: {
    local: {
      get: (keys, callback) => {
        const res = {};
        if (Array.isArray(keys)) {
          keys.forEach(k => res[k] = memoryStore[k]);
        } else if (typeof keys === 'string') {
          res[keys] = memoryStore[keys];
        }
        callback(res);
      },
      set: (obj, callback) => {
        Object.assign(memoryStore, obj);
        if (callback) callback();
      }
    }
  }
};

(async function runTests() {
  console.log('Testing chapter number parsing...');
  assert.strictEqual(StorageLocal.parseChapterIncrement('Cap. 10'), 'Cap. 11');
  assert.strictEqual(StorageLocal.parseChapterIncrement('Capítulo 45.5'), 'Capítulo 46.5');
  assert.strictEqual(StorageLocal.parseChapterIncrement('Ep. 09'), 'Ep. 10');
  assert.strictEqual(StorageLocal.parseChapterIncrement('1102'), '1103');
  assert.strictEqual(StorageLocal.parseChapterIncrement('Sem número'), 'Sem número +1');

  console.log('Testing default settings...');
  const settings = await StorageLocal.getSettings();
  assert.strictEqual(settings.enableFloatingButton, true);
  assert.strictEqual(settings.enableBadgeCount, true);
  assert.strictEqual(settings.enableQuickIncrement, true);
  assert.strictEqual(settings.enableAutoTitleDetection, true);

  console.log('Testing save and retrieve entry...');
  const entry = await StorageLocal.saveEntry({
    name: 'Solo Leveling',
    chapter: 'Cap. 179',
    url: 'https://example.com/sl/179',
    tag: 'manga'
  });
  assert.ok(entry.id);
  assert.strictEqual(entry.syncStatus, 'pending');

  let entries = await StorageLocal.getEntries();
  assert.strictEqual(entries.length, 1);
  assert.strictEqual(entries[0].name, 'Solo Leveling');

  console.log('Testing quickIncrementChapter...');
  const updated = await StorageLocal.quickIncrementChapter(entry.id);
  assert.strictEqual(updated.chapter, 'Cap. 180');

  console.log('Testing delete (soft delete)...');
  await StorageLocal.deleteEntry(entry.id);
  const activeEntries = await StorageLocal.getEntries();
  assert.strictEqual(activeEntries.length, 0);

  const allEntries = await StorageLocal.getEntries(true);
  assert.strictEqual(allEntries.length, 1);
  assert.strictEqual(allEntries[0].deleted, true);

  console.log('Testing export and import backup...');
  const backupJson = await StorageLocal.exportBackup();
  memoryStore['chapter_tracker_entries_v2'] = [];
  const importedCount = await StorageLocal.importBackup(backupJson);
  assert.strictEqual(importedCount, 1);

  console.log('All storage-local tests passed!');
})();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/storage-local.test.js`  
Expected: FAIL with "Cannot find module '../storage-local'".

- [ ] **Step 3: Implement storage-local.js**

Create `storage-local.js`:
```javascript
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
    // Match any integer or decimal number in the chapter string
    const match = chapterStr.match(/(\d+(\.\d+)?)/);
    if (!match) {
      return chapterStr + ' +1';
    }
    const oldNumStr = match[1];
    const isDecimal = oldNumStr.includes('.');
    const oldNum = parseFloat(oldNumStr);
    const newNum = oldNum + 1;
    // Format keeping zero padding if e.g. 09 -> 10
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/storage-local.test.js`  
Expected: PASS with "All storage-local tests passed!".

- [ ] **Step 5: Commit**

```bash
git add storage-local.js tests/storage-local.test.js
git commit -m "feat: implement unified local storage layer with settings and backup"
```

---

### Task 3: Content Script Refactor (Domain Safety & Duplication Fix)

**Files:**
- Modify: `content.js`
- Test: `tests/verify-content.js`

**Interfaces:**
- Consumes: `StorageLocal.getSettings()`, `StorageLocal.getEntries()`, `StorageLocal.saveEntry()`, `StorageLocal.parseChapterIncrement()`.
- Produces: Bug-free in-page FAB with updated chapter on existing cards, "+1" shortcut in popup, domain blocker check.

- [ ] **Step 1: Write test for content script checks**

Create `tests/verify-content.js`:
```javascript
const fs = require('fs');
const path = require('path');
const contentCode = fs.readFileSync(path.resolve(__dirname, '../content.js'), 'utf8');

// Ensure content.js uses chrome.storage.local or StorageLocal and prevents duplicates
if (contentCode.includes('chrome.storage.sync')) {
  console.error('FAIL: content.js still contains chrome.storage.sync references');
  process.exit(1);
}

if (!contentCode.includes('enableFloatingButton')) {
  console.error('FAIL: content.js does not check enableFloatingButton');
  process.exit(1);
}

if (!contentCode.includes('blockedDomains')) {
  console.error('FAIL: content.js does not check blockedDomains');
  process.exit(1);
}

console.log('Content script verification passed.');
process.exit(0);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/verify-content.js`  
Expected: FAIL with missing checks.

- [ ] **Step 3: Refactor content.js**

Refactor `content.js` to:
1. Load `StorageLocal` methods (or embed the storage-local client logic safely).
2. Check `enableFloatingButton` and `blockedDomains` against `window.location.hostname`.
3. When saving an existing entry, pass the `existingEntry.id` so it updates the existing entry rather than duplicating it.
4. Add a "+1" quick button next to the chapter input in the floating panel.
5. Respect `enableBadgeCount`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/verify-content.js`  
Expected: PASS with "Content script verification passed."

- [ ] **Step 5: Commit**

```bash
git add content.js tests/verify-content.js
git commit -m "fix: refactor content script to prevent duplicates and respect user toggles"
```

---

### Task 4: Popup Settings Drawer & Feature Toggles

**Files:**
- Modify: `popup.html`
- Modify: `popup.css`
- Modify: `popup.js`

**Interfaces:**
- Consumes: `StorageLocal.getSettings()`, `StorageLocal.saveSettings()`.
- Produces: Visual drawer in popup for user customization:
  - Toggle: Botão flutuante nas páginas
  - Toggle: Contador no botão flutuante
  - Toggle: Botão rápido "+1" nos cards
  - Toggle: Detecção automática de títulos
  - Toggle: Sincronização automática em nuvem
  - Domínios bloqueados
  - Chave de sincronização

- [ ] **Step 1: Add Settings Drawer HTML in popup.html**

Add settings toggle button in header (`btnSettings`) and the expandable `#settingsPanel` containing toggle switches and inputs.

- [ ] **Step 2: Add CSS for switches and settings drawer in popup.css**

Style the modern toggle switches (`switch` and `slider`), dark inputs, and settings panel transitions matching the dark neon theme.

- [ ] **Step 3: Wire settings in popup.js**

Implement `loadSettingsToUI()` and auto-save on toggle change with toast feedback ("Configurações salvas").

- [ ] **Step 4: Test manually and verify syntax**

Run: `node -c popup.js`  
Expected: PASS (no syntax errors).

- [ ] **Step 5: Commit**

```bash
git add popup.html popup.css popup.js
git commit -m "feat: add settings panel with feature toggles in popup"
```

---

### Task 5: Quick Increment (+1) & Backup Import/Export

**Files:**
- Modify: `popup.html`
- Modify: `popup.js`
- Modify: `popup.css`
- Test: `tests/verify-popup-features.js`

**Interfaces:**
- Consumes: `StorageLocal.quickIncrementChapter()`, `StorageLocal.exportBackup()`, `StorageLocal.importBackup()`.
- Produces: Action button `+1` on each card and backup JSON download/upload handler.

- [ ] **Step 1: Write test to verify popup includes +1 and backup triggers**

Create `tests/verify-popup-features.js`:
```javascript
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.resolve(__dirname, '../popup.html'), 'utf8');
const js = fs.readFileSync(path.resolve(__dirname, '../popup.js'), 'utf8');

if (!html.includes('btnExportBackup') || !html.includes('btnImportBackup')) {
  console.error('FAIL: popup.html missing backup buttons');
  process.exit(1);
}

if (!js.includes('quickIncrementChapter')) {
  console.error('FAIL: popup.js missing quickIncrementChapter handling');
  process.exit(1);
}

console.log('Popup features verification passed.');
process.exit(0);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/verify-popup-features.js`  
Expected: FAIL.

- [ ] **Step 3: Implement "+1" and Backup in popup.html & popup.js**

Add card action `<button class="action-btn inc" title="+1 Capítulo">+1</button>`.  
Wire click event: calls `StorageLocal.quickIncrementChapter(entry.id)`, updates entry in-place, and shows toast `✓ Cap. atualizado`.  
Wire `btnExportBackup` to generate a Blob and download `chapter-tracker-backup.json`.  
Wire `btnImportBackup` to prompt file input, read JSON with `FileReader`, call `StorageLocal.importBackup`, reload list and show toast.

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/verify-popup-features.js`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add popup.html popup.js popup.css tests/verify-popup-features.js
git commit -m "feat: add quick chapter increment and JSON backup import/export"
```

---

### Task 6: Cloud Sync Engine & Background Periodic Alarms

**Files:**
- Create: `sync-service.js`
- Modify: `background.js`
- Modify: `manifest.json`
- Test: `tests/verify-sync.js`

**Interfaces:**
- Produces:
  - `SyncService.syncAll()`
  - `SyncService.pushPending()`
  - `SyncService.pullRemote()`
  - Alarms listener in `background.js` triggered every 15 minutes.

- [ ] **Step 1: Write test for sync service architecture**

Create `tests/verify-sync.js`:
```javascript
const fs = require('fs');
const path = require('path');

const syncCode = fs.readFileSync(path.resolve(__dirname, '../sync-service.js'), 'utf8');
const bgCode = fs.readFileSync(path.resolve(__dirname, '../background.js'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../manifest.json'), 'utf8'));

if (!manifest.permissions.includes('alarms')) {
  console.error('FAIL: manifest.json missing alarms permission');
  process.exit(1);
}

if (!syncCode.includes('pushPending') || !syncCode.includes('pullRemote')) {
  console.error('FAIL: sync-service.js missing pushPending or pullRemote');
  process.exit(1);
}

if (!bgCode.includes('chrome.alarms.onAlarm')) {
  console.error('FAIL: background.js missing chrome.alarms.onAlarm listener');
  process.exit(1);
}

console.log('Sync verification passed.');
process.exit(0);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/verify-sync.js`  
Expected: FAIL.

- [ ] **Step 3: Implement sync-service.js and background alarms**

1. Create `sync-service.js`:
   - Handles REST calls with Supabase PostgREST endpoints.
   - Pushes items with `syncStatus === 'pending'` using upsert on `id`.
   - Pulls entries updated after `lastSyncTime`.
   - Merges using Last-Write-Wins based on `updatedAt`.
2. Update `manifest.json` to include `"alarms"` in permissions.
3. Update `background.js`:
   - Sets up `chrome.alarms.create('chapter_tracker_sync_alarm', { periodInMinutes: 15 })`.
   - Listens to `chrome.alarms.onAlarm` and runs sync if `enableAutoSync` is active.
   - Supports manual sync messages from popup `chrome.runtime.sendMessage({ action: 'syncNow' })`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/verify-sync.js`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add sync-service.js background.js manifest.json tests/verify-sync.js
git commit -m "feat: implement cloud sync engine and background alarms"
```

---

### Task 7: Cleanup & End-to-End Validation

**Files:**
- Modify: `package.json`
- Create: `tests/run-all-tests.js`

- [ ] **Step 1: Clean package.json**

Remove unused `@anthropic-ai/sdk` and add test script:
```json
{
  "name": "chapter-tracker",
  "version": "1.2.0",
  "description": "Salve e acompanhe seu progresso em mangás, séries e animes.",
  "scripts": {
    "test": "node tests/run-all-tests.js",
    "generate-icons": "node scripts/generate-icons.js"
  }
}
```

- [ ] **Step 2: Implement test runner `tests/run-all-tests.js`**

Run all test scripts in sequence and assert exit code 0.

- [ ] **Step 3: Run full test suite**

Run: `npm test`  
Expected: All tests pass.

- [ ] **Step 4: Final verification and commit**

```bash
git add package.json tests/
git commit -m "chore: clean dependencies and add complete test runner"
```
