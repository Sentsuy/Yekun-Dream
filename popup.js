/* ════════════════════════════════════════════════════════
   Chapter Tracker — popup.js
   Controle de UI, CRUD com StorageLocal, +1 rápido,
   painel de configurações e backup JSON.
   ════════════════════════════════════════════════════════ */

// ── DOM refs ────────────────────────────────────────────
const btnShowForm      = document.getElementById('btnShowForm');
const btnSettings      = document.getElementById('btnSettings');
const btnCloseSettings = document.getElementById('btnCloseSettings');
const formPanel        = document.getElementById('formPanel');
const settingsPanel    = document.getElementById('settingsPanel');
const formTitle        = document.getElementById('formTitle');
const editIdField      = document.getElementById('editId');
const inputTitle       = document.getElementById('inputTitle');
const inputChapter     = document.getElementById('inputChapter');
const inputUrl         = document.getElementById('inputUrl');
const btnCapture       = document.getElementById('btnCapture');
const btnCancel        = document.getElementById('btnCancel');
const btnSave          = document.getElementById('btnSave');
const tagPicker        = document.getElementById('tagPicker');
const searchInput      = document.getElementById('searchInput');
const entriesList      = document.getElementById('entriesList');
const emptyState       = document.getElementById('emptyState');
const entryCount       = document.getElementById('entryCount');
const toast            = document.getElementById('toast');

// Settings DOM refs
const toggleFloatingButton = document.getElementById('toggleFloatingButton');
const toggleBadgeCount     = document.getElementById('toggleBadgeCount');
const toggleQuickIncrement = document.getElementById('toggleQuickIncrement');
const toggleAutoTitle      = document.getElementById('toggleAutoTitle');
const toggleAutoSync       = document.getElementById('toggleAutoSync');
const inputBlockedDomains  = document.getElementById('inputBlockedDomains');
const inputSyncKey         = document.getElementById('inputSyncKey');
const btnSyncNow           = document.getElementById('btnSyncNow');
const btnExportBackup      = document.getElementById('btnExportBackup');
const btnImportBackup      = document.getElementById('btnImportBackup');
const fileImportBackup     = document.getElementById('fileImportBackup');

let selectedTag   = 'manga';
let allEntries    = [];
let appSettings   = {};
let toastTimer    = null;

// ── Toast ────────────────────────────────────────────────
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

// ── Tag Picker ───────────────────────────────────────────
tagPicker.querySelectorAll('.tag-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    tagPicker.querySelectorAll('.tag-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedTag = btn.dataset.tag;
  });
});

function setActiveTag(tag) {
  tagPicker.querySelectorAll('.tag-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tag === tag);
  });
  selectedTag = tag;
}

// ── Drawer Controls ──────────────────────────────────────
function openForm(mode = 'new', entry = null) {
  settingsPanel.classList.remove('open');
  btnSettings.classList.remove('active');
  formPanel.classList.add('open');

  if (mode === 'edit' && entry) {
    formTitle.textContent = 'Editar Entrada';
    editIdField.value     = entry.id;
    inputTitle.value      = entry.name;
    inputChapter.value    = entry.chapter;
    inputUrl.value        = entry.url;
    setActiveTag(entry.tag || 'outro');
    btnSave.textContent   = 'Atualizar';
  } else {
    formTitle.textContent = 'Nova Entrada';
    editIdField.value     = '';
    inputTitle.value      = '';
    inputChapter.value    = '';
    inputUrl.value        = '';
    setActiveTag('manga');
    btnSave.textContent   = 'Salvar';

    // Auto capture if enabled
    if (appSettings.enableAutoTitleDetection) {
      captureCurrentTab();
    }
  }
  setTimeout(() => inputTitle.focus(), 60);
}

function closeForm() {
  formPanel.classList.remove('open');
}

btnShowForm.addEventListener('click', () => {
  if (formPanel.classList.contains('open')) {
    closeForm();
  } else {
    openForm('new');
  }
});

btnCancel.addEventListener('click', closeForm);

// ── Settings Drawer ──────────────────────────────────────
function toggleSettingsDrawer() {
  formPanel.classList.remove('open');
  const isOpen = settingsPanel.classList.toggle('open');
  btnSettings.classList.toggle('active', isOpen);
}

btnSettings.addEventListener('click', toggleSettingsDrawer);
if (btnCloseSettings) btnCloseSettings.addEventListener('click', () => {
  settingsPanel.classList.remove('open');
  btnSettings.classList.remove('active');
});

async function loadSettingsToUI() {
  appSettings = await StorageLocal.getSettings();
  toggleFloatingButton.checked = !!appSettings.enableFloatingButton;
  toggleBadgeCount.checked     = !!appSettings.enableBadgeCount;
  toggleQuickIncrement.checked = !!appSettings.enableQuickIncrement;
  toggleAutoTitle.checked      = !!appSettings.enableAutoTitleDetection;
  toggleAutoSync.checked       = !!appSettings.enableAutoSync;
  inputBlockedDomains.value    = (appSettings.blockedDomains || []).join(', ');
  inputSyncKey.value           = appSettings.syncKey || '';
}

async function persistSettings() {
  const domains = inputBlockedDomains.value
    .split(',')
    .map(d => d.trim().toLowerCase())
    .filter(Boolean);

  appSettings = {
    ...appSettings,
    enableFloatingButton: toggleFloatingButton.checked,
    enableBadgeCount: toggleBadgeCount.checked,
    enableQuickIncrement: toggleQuickIncrement.checked,
    enableAutoTitleDetection: toggleAutoTitle.checked,
    enableAutoSync: toggleAutoSync.checked,
    blockedDomains: domains,
    syncKey: inputSyncKey.value.trim()
  };

  await StorageLocal.saveSettings(appSettings);
  renderList(searchInput.value.trim());
}

[toggleFloatingButton, toggleBadgeCount, toggleQuickIncrement, toggleAutoTitle, toggleAutoSync].forEach(el => {
  el.addEventListener('change', async () => {
    await persistSettings();
    showToast('Configurações salvas');
  });
});

inputBlockedDomains.addEventListener('change', persistSettings);
inputSyncKey.addEventListener('change', persistSettings);

// ── Captura da aba atual ─────────────────────────────────
async function captureCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      inputUrl.value = tab.url || '';
      if (!inputTitle.value && tab.title) {
        inputTitle.value = tab.title.replace(/\s*[-–|·•]\s*.{0,40}$/, '').trim();
      }
    }
  } catch (e) {
    // Falha silenciosa ou toast
  }
}

btnCapture.addEventListener('click', async () => {
  await captureCurrentTab();
  showToast('✓ Aba capturada');
});

// ── Salvar / Atualizar ───────────────────────────────────
btnSave.addEventListener('click', async () => {
  const name    = inputTitle.value.trim();
  const chapter = inputChapter.value.trim();
  const url     = inputUrl.value.trim();

  if (!name)    { flash(inputTitle);   return; }
  if (!chapter) { flash(inputChapter); return; }

  const id = editIdField.value;

  await StorageLocal.saveEntry({
    id: id || undefined,
    name,
    chapter,
    url,
    tag: selectedTag
  });

  allEntries = await StorageLocal.getEntries();
  showToast(id ? '✓ Entrada atualizada' : '✓ Entrada salva');
  closeForm();
  renderList(searchInput.value.trim());
});

function flash(input) {
  input.style.borderColor = '#ff5c5c';
  input.focus();
  setTimeout(() => input.style.borderColor = '', 800);
}

// ── Delete ───────────────────────────────────────────────
async function deleteEntry(id) {
  await StorageLocal.deleteEntry(id);
  allEntries = await StorageLocal.getEntries();
  renderList(searchInput.value.trim());
  showToast('Entrada removida');
}

// ── Quick Increment (+1) ─────────────────────────────────
async function handleQuickIncrement(id) {
  const updated = await StorageLocal.quickIncrementChapter(id);
  if (updated) {
    allEntries = await StorageLocal.getEntries();
    renderList(searchInput.value.trim());
    showToast(`✓ ${updated.chapter}`);
  }
}

// ── Backup JSON (Exportar e Importar) ────────────────────
btnExportBackup.addEventListener('click', async () => {
  try {
    const jsonStr = await StorageLocal.exportBackup();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = `chapter-tracker-backup-${dateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('✓ Backup exportado!');
  } catch (err) {
    showToast('Erro ao exportar backup');
  }
});

btnImportBackup.addEventListener('click', () => {
  fileImportBackup.click();
});

fileImportBackup.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (evt) => {
    try {
      const count = await StorageLocal.importBackup(evt.target.result);
      allEntries = await StorageLocal.getEntries();
      await loadSettingsToUI();
      renderList();
      showToast(`✓ ${count} itens importados com sucesso!`);
    } catch (err) {
      showToast('Arquivo de backup inválido');
    }
    fileImportBackup.value = '';
  };
  reader.readAsText(file);
});

// ── Sincronizar Agora ────────────────────────────────────
btnSyncNow.addEventListener('click', async () => {
  await persistSettings();
  showToast('Iniciando sincronização…');
  try {
    if (chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ action: 'syncNow' }, response => {
        if (response && response.ok) {
          showToast('✓ Sincronizado com sucesso!');
          StorageLocal.getEntries().then(entries => {
            allEntries = entries;
            renderList(searchInput.value.trim());
          });
        } else {
          showToast(response && response.error ? response.error : 'Sincronização concluída');
        }
      });
    }
  } catch (e) {
    showToast('Erro na sincronização');
  }
});

// ── Render ───────────────────────────────────────────────
function renderList(filter = '') {
  const query = filter.toLowerCase();
  const list  = query
    ? allEntries.filter(e =>
        e.name.toLowerCase().includes(query) ||
        e.chapter.toLowerCase().includes(query) ||
        (e.url || '').toLowerCase().includes(query)
      )
    : allEntries;

  entryCount.textContent = allEntries.length;

  // Clear old cards (keep emptyState)
  entriesList.querySelectorAll('.entry-card').forEach(c => c.remove());

  if (list.length === 0) {
    emptyState.style.display = 'flex';
    return;
  }
  emptyState.style.display = 'none';

  list.forEach(entry => {
    const card = buildCard(entry);
    entriesList.appendChild(card);
  });
}

function buildCard(entry) {
  const card = document.createElement('div');
  card.className = 'entry-card';
  card.dataset.id = entry.id;

  const tag     = entry.tag || 'outro';
  const date    = new Date(entry.updatedAt || entry.createdAt);
  const dateStr = date.toLocaleDateString('pt-BR', { day:'2-digit', month:'short' });

  const shortUrl = entry.url
    ? entry.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').slice(0, 36) + (entry.url.length > 50 ? '…' : '')
    : '';

  const showIncBtn = appSettings.enableQuickIncrement !== false;

  card.innerHTML = `
    <div class="entry-tag-dot dot-${tag}"></div>
    <div class="entry-body">
      <div class="entry-top">
        <span class="entry-name" title="${esc(entry.name)}">${esc(entry.name)}</span>
        <span class="entry-cat">${tag}</span>
      </div>
      <div class="entry-chapter">${esc(entry.chapter)}</div>
      ${entry.url ? `<a class="entry-url" href="${esc(entry.url)}" title="${esc(entry.url)}" target="_blank">${esc(shortUrl)}</a>` : ''}
      <div class="entry-date">${dateStr}</div>
    </div>
    <div class="entry-actions">
      ${showIncBtn ? `<button class="action-btn inc" title="Avançar +1 capítulo">+1</button>` : ''}
      ${entry.url ? `<button class="action-btn open" title="Abrir URL">↗</button>` : ''}
      <button class="action-btn edit" title="Editar">✎</button>
      <button class="action-btn del"  title="Remover">✕</button>
    </div>
  `;

  // Quick increment
  const incBtn = card.querySelector('.action-btn.inc');
  if (incBtn) {
    incBtn.addEventListener('click', e => {
      e.stopPropagation();
      handleQuickIncrement(entry.id);
    });
  }

  // Open URL
  const openBtn = card.querySelector('.action-btn.open');
  if (openBtn) {
    openBtn.addEventListener('click', e => {
      e.stopPropagation();
      chrome.tabs.create({ url: entry.url });
    });
  }

  // Edit
  card.querySelector('.action-btn.edit').addEventListener('click', e => {
    e.stopPropagation();
    openForm('edit', entry);
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  // Delete
  card.querySelector('.action-btn.del').addEventListener('click', e => {
    e.stopPropagation();
    deleteEntry(entry.id);
  });

  // URL anchor inside body
  const urlLink = card.querySelector('.entry-url');
  if (urlLink) {
    urlLink.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      chrome.tabs.create({ url: entry.url });
    });
  }

  return card;
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Search ───────────────────────────────────────────────
searchInput.addEventListener('input', () => {
  renderList(searchInput.value.trim());
});

// ── Init ─────────────────────────────────────────────────
(async () => {
  await loadSettingsToUI();
  allEntries = await StorageLocal.getEntries();
  renderList();
})();
