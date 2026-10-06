/* ════════════════════════════════════════════════════════
   Chapter Tracker — popup.js
   Controle de UI, CRUD com StorageLocal v3, +1 rápido,
   painel de configurações, múltiplas fontes e histórico.
   ════════════════════════════════════════════════════════ */

// ── DOM refs ────────────────────────────────────────────
const btnShowForm        = document.getElementById('btnShowForm');
const btnSettings        = document.getElementById('btnSettings');
const btnCloseSettings   = document.getElementById('btnCloseSettings');
const formPanel          = document.getElementById('formPanel');
const settingsPanel      = document.getElementById('settingsPanel');
const formTitle          = document.getElementById('formTitle');
const editIdField        = document.getElementById('editId');
const editSourceIdField  = document.getElementById('editSourceId');
const inputTitle         = document.getElementById('inputTitle');
const inputSiteName      = document.getElementById('inputSiteName');
const inputChapter       = document.getElementById('inputChapter');
const inputUrl           = document.getElementById('inputUrl');
const btnCapture         = document.getElementById('btnCapture');
const btnCancel          = document.getElementById('btnCancel');
const btnSave            = document.getElementById('btnSave');
const tagPicker          = document.getElementById('tagPicker');
const searchInput        = document.getElementById('searchInput');
const entriesList        = document.getElementById('entriesList');
const emptyState         = document.getElementById('emptyState');
const entryCount         = document.getElementById('entryCount');
const toast              = document.getElementById('toast');

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
let allWorks      = [];
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
  selectedTag = tag || 'manga';
}

// ── Drawer Controls ──────────────────────────────────────
function openForm(mode = 'new', work = null, source = null) {
  settingsPanel.classList.remove('open');
  btnSettings.classList.remove('active');
  formPanel.classList.add('open');

  if (mode === 'edit' && work) {
    formTitle.textContent = 'Editar Obra';
    editIdField.value     = work.id;
    inputTitle.value      = work.name;
    inputTitle.readOnly   = false;
    setActiveTag(work.tag || 'outro');

    const activeSrc = source || (work.sources || []).find(s => s.id === work.lastReadSourceId) || (work.sources && work.sources[0]) || {};
    editSourceIdField.value = activeSrc.id || '';
    inputSiteName.value   = activeSrc.siteName || '';
    inputChapter.value    = activeSrc.chapter || work.mainChapter || '';
    inputUrl.value        = activeSrc.url || '';
    btnSave.textContent   = 'Atualizar';
  } else if (mode === 'add_source' && work) {
    formTitle.textContent = `Nova Fonte para: ${work.name}`;
    editIdField.value     = work.id;
    editSourceIdField.value = '';
    inputTitle.value      = work.name;
    inputTitle.readOnly   = true;
    setActiveTag(work.tag || 'manga');
    inputSiteName.value   = '';
    inputChapter.value    = work.mainChapter || '';
    inputUrl.value        = '';
    btnSave.textContent   = 'Adicionar Fonte';

    if (appSettings.enableAutoTitleDetection) {
      captureCurrentTab(true);
    }
  } else {
    formTitle.textContent = 'Nova Obra';
    editIdField.value     = '';
    editSourceIdField.value = '';
    inputTitle.value      = '';
    inputTitle.readOnly   = false;
    inputSiteName.value   = '';
    inputChapter.value    = '';
    inputUrl.value        = '';
    setActiveTag('manga');
    btnSave.textContent   = 'Salvar Obra';

    if (appSettings.enableAutoTitleDetection) {
      captureCurrentTab(false);
    }
  }
  setTimeout(() => (inputTitle.readOnly ? inputChapter : inputTitle).focus(), 60);
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
async function captureCurrentTab(onlySource = false) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      inputUrl.value = tab.url;
      const domain = StorageLocal.extractDomain(tab.url);
      if (!inputSiteName.value) {
        inputSiteName.value = StorageLocal.formatSiteName(domain);
      }
      if (!onlySource && !inputTitle.value && tab.title) {
        inputTitle.value = tab.title.replace(/\s*[-–|·•]\s*.{0,40}$/, '').trim();
      }
    }
  } catch (e) {
    // Falha silenciosa
  }
}

btnCapture.addEventListener('click', async () => {
  await captureCurrentTab(inputTitle.readOnly);
  showToast('✓ Aba capturada');
});

// ── Salvar / Atualizar Obra e Fonte ──────────────────────
btnSave.addEventListener('click', async () => {
  const workName = inputTitle.value.trim();
  const chapter  = inputChapter.value.trim();
  const url      = inputUrl.value.trim();
  const siteName = inputSiteName.value.trim();
  const workId   = editIdField.value;

  if (!workName) { flash(inputTitle);   return; }
  if (!chapter)  { flash(inputChapter); return; }

  await StorageLocal.saveWorkReading({
    workId: workId || undefined,
    workName,
    chapter,
    url,
    siteName,
    tag: selectedTag
  });

  allWorks = await StorageLocal.getWorks();
  showToast(workId ? '✓ Obra atualizada' : '✓ Obra salva com sucesso');
  closeForm();
  renderList(searchInput.value.trim());
});

function flash(input) {
  input.style.borderColor = '#ff5c5c';
  input.focus();
  setTimeout(() => input.style.borderColor = '', 800);
}

// ── Delete Obra ──────────────────────────────────────────
async function deleteWork(id) {
  await StorageLocal.deleteWork(id);
  allWorks = await StorageLocal.getWorks();
  renderList(searchInput.value.trim());
  showToast('Obra removida');
}

// ── Delete Fonte Individual ──────────────────────────────
async function deleteSource(workId, sourceId) {
  await StorageLocal.deleteSource(workId, sourceId);
  allWorks = await StorageLocal.getWorks();
  renderList(searchInput.value.trim());
  showToast('Fonte removida');
}

// ── Quick Increment (+1) ─────────────────────────────────
async function handleQuickIncrement(workId) {
  const updated = await StorageLocal.quickIncrementWork(workId);
  if (updated) {
    allWorks = await StorageLocal.getWorks();
    renderList(searchInput.value.trim());
    showToast(`✓ ${updated.mainChapter}`);
  }
}
const quickIncrementChapter = handleQuickIncrement;


// ── Backup JSON (Exportar e Importar) ────────────────────
btnExportBackup.addEventListener('click', async () => {
  try {
    const jsonStr = await StorageLocal.exportBackup();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = `chapter-tracker-backup-v3-${dateStr}.json`;
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
      allWorks = await StorageLocal.getWorks();
      await loadSettingsToUI();
      renderList();
      showToast(`✓ ${count} obras importadas com sucesso!`);
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
          StorageLocal.getWorks().then(works => {
            allWorks = works;
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
function filterWorks(works, query) {
  const q = query.toLowerCase().trim();
  if (!q) return works;
  return works.filter(w => {
    if (w.name.toLowerCase().includes(q)) return true;
    if ((w.mainChapter || '').toLowerCase().includes(q)) return true;
    if ((w.tag || '').toLowerCase().includes(q)) return true;
    const hasSource = (w.sources || []).some(s =>
      (s.siteName || '').toLowerCase().includes(q) ||
      (s.domain || '').toLowerCase().includes(q) ||
      (s.chapter || '').toLowerCase().includes(q) ||
      (s.url || '').toLowerCase().includes(q)
    );
    return hasSource;
  });
}

function renderList(filter = '') {
  const list = filterWorks(allWorks, filter);
  entryCount.textContent = allWorks.length;

  entriesList.querySelectorAll('.entry-card').forEach(c => c.remove());

  if (list.length === 0) {
    emptyState.style.display = 'flex';
    return;
  }
  emptyState.style.display = 'none';

  list.forEach(work => {
    const card = buildWorkCard(work);
    entriesList.appendChild(card);
  });
}

function formatDate(epoch) {
  if (!epoch) return '';
  const d = new Date(epoch);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function formatTime(epoch) {
  if (!epoch) return '';
  const d = new Date(epoch);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function buildWorkCard(work) {
  const card = document.createElement('div');
  card.className = 'entry-card';
  card.dataset.id = work.id;

  const tag      = work.tag || 'outro';
  const dateStr  = formatDate(work.updatedAt || work.createdAt);
  const sources  = work.sources || [];
  const activeSrc = sources.find(s => s.id === work.lastReadSourceId) || sources[0] || {};
  const showIncBtn = appSettings.enableQuickIncrement !== false;

  // Chips HTML
  const chipsHtml = sources.map(s => {
    const href = s.url || '#';
    return `<a class="source-chip" href="${esc(href)}" title="${esc(s.url || s.siteName)}" target="_blank" data-srcid="${s.id}">
      🌐 ${esc(s.siteName)}: <span class="chip-ch">${esc(s.chapter)}</span> <span class="chip-ext">↗</span>
    </a>`;
  }).join('');

  // Sources list inside accordion
  const sourcesRowsHtml = sources.map(s => {
    return `<div class="source-item-row" data-srcid="${s.id}">
      <div class="source-item-left">
        <span class="source-item-name">${esc(s.siteName)} <small style="opacity:.6; font-size:8px;">(${esc(s.domain || '')})</small></span>
        <span class="source-item-ch">${esc(s.chapter)} • ${formatDate(s.updatedAt)}</span>
      </div>
      <div class="source-item-actions">
        ${s.url ? `<button class="action-btn open btn-src-open" title="Abrir URL">↗</button>` : ''}
        <button class="action-btn edit btn-src-edit" title="Editar fonte">✎</button>
        <button class="action-btn del btn-src-del" title="Remover fonte">✕</button>
      </div>
    </div>`;
  }).join('');

  // History timeline inside accordion
  const history = work.history || [];
  const historyRowsHtml = history.slice(0, 30).map(h => {
    return `<div class="history-item">
      <div class="history-item-dot"></div>
      <div class="history-item-content">
        <strong>${esc(h.siteName || h.domain || 'Site')}</strong>: <span class="hist-ch">${esc(h.chapter)}</span>
        <div class="hist-date">${formatDate(h.timestamp)} às ${formatTime(h.timestamp)}</div>
      </div>
    </div>`;
  }).join('') || '<div style="color:var(--muted); font-size:9px; font-family:var(--font-mono);">Nenhum histórico registrado ainda.</div>';

  card.innerHTML = `
    <div class="entry-tag-dot dot-${tag}"></div>
    <div class="entry-body">
      <div class="entry-top">
        <span class="entry-name" title="${esc(work.name)}">${esc(work.name)}</span>
        <span class="entry-cat">${tag}</span>
      </div>
      <div class="entry-chapter">${esc(work.mainChapter || 'Sem capítulo')}</div>

      <!-- Chips de Sites / Fontes -->
      <div class="entry-sources">
        ${chipsHtml || '<span style="font-size:9px; color:var(--muted); font-family:var(--font-mono);">Nenhuma fonte</span>'}
      </div>

      <div class="entry-date">${dateStr}</div>

      <!-- Accordion Toggle -->
      <button class="accordion-toggle">
        <span class="toggle-arrow">▼</span> Fontes & Histórico (${sources.length} ${sources.length === 1 ? 'site' : 'sites'})
      </button>

      <!-- Accordion Panel -->
      <div class="accordion-panel">
        <div class="panel-tabs">
          <button class="panel-tab active" data-tab="sources">Fontes (${sources.length})</button>
          <button class="panel-tab" data-tab="history">Histórico (${history.length})</button>
        </div>

        <div class="tab-content active tab-sources">
          <div class="sources-list">${sourcesRowsHtml}</div>
          <button class="btn-add-source">＋ Adicionar Outro Site</button>
        </div>

        <div class="tab-content tab-history">
          <div class="history-timeline">${historyRowsHtml}</div>
        </div>
      </div>
    </div>

    <!-- Actions no Card -->
    <div class="entry-actions">
      ${showIncBtn ? `<button class="action-btn inc" title="Avançar +1 capítulo na fonte ativa">+1</button>` : ''}
      ${activeSrc.url ? `<button class="action-btn open btn-main-open" title="Abrir link do site ativo">↗</button>` : ''}
      <button class="action-btn edit btn-main-edit" title="Editar Obra">✎</button>
      <button class="action-btn del btn-main-del"   title="Remover Obra">✕</button>
    </div>
  `;

  // Quick increment
  const incBtn = card.querySelector('.action-btn.inc');
  if (incBtn) {
    incBtn.addEventListener('click', e => {
      e.stopPropagation();
      handleQuickIncrement(work.id);
    });
  }

  // Open active source URL
  const mainOpenBtn = card.querySelector('.btn-main-open');
  if (mainOpenBtn) {
    mainOpenBtn.addEventListener('click', e => {
      e.stopPropagation();
      if (activeSrc.url) chrome.tabs.create({ url: activeSrc.url });
    });
  }

  // Edit work
  const mainEditBtn = card.querySelector('.btn-main-edit');
  if (mainEditBtn) {
    mainEditBtn.addEventListener('click', e => {
      e.stopPropagation();
      openForm('edit', work);
    });
  }

  // Delete work
  const mainDelBtn = card.querySelector('.btn-main-del');
  if (mainDelBtn) {
    mainDelBtn.addEventListener('click', e => {
      e.stopPropagation();
      deleteWork(work.id);
    });
  }

  // Accordion toggle
  const accToggle = card.querySelector('.accordion-toggle');
  const accPanel  = card.querySelector('.accordion-panel');
  accToggle.addEventListener('click', e => {
    e.stopPropagation();
    const isOpen = accPanel.classList.toggle('open');
    accToggle.classList.toggle('open', isOpen);
  });

  // Accordion tabs
  const tabBtns = card.querySelectorAll('.panel-tab');
  const tabSources = card.querySelector('.tab-sources');
  const tabHistory = card.querySelector('.tab-history');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      if (tab === 'sources') {
        tabSources.classList.add('active');
        tabHistory.classList.remove('active');
      } else {
        tabSources.classList.remove('active');
        tabHistory.classList.add('active');
      }
    });
  });

  // Add source button in accordion
  const btnAddSrc = card.querySelector('.btn-add-source');
  if (btnAddSrc) {
    btnAddSrc.addEventListener('click', e => {
      e.stopPropagation();
      openForm('add_source', work);
    });
  }

  // Source item rows actions
  card.querySelectorAll('.source-item-row').forEach(row => {
    const srcId = row.dataset.srcid;
    const src = sources.find(s => s.id === srcId);
    if (!src) return;

    const btnOpen = row.querySelector('.btn-src-open');
    if (btnOpen) {
      btnOpen.addEventListener('click', e => {
        e.stopPropagation();
        if (src.url) chrome.tabs.create({ url: src.url });
      });
    }

    const btnEdit = row.querySelector('.btn-src-edit');
    if (btnEdit) {
      btnEdit.addEventListener('click', e => {
        e.stopPropagation();
        openForm('edit', work, src);
      });
    }

    const btnDel = row.querySelector('.btn-src-del');
    if (btnDel) {
      btnDel.addEventListener('click', e => {
        e.stopPropagation();
        deleteSource(work.id, src.id);
      });
    }
  });

  // Prevent link click from collapsing card
  card.querySelectorAll('.source-chip').forEach(chip => {
    chip.addEventListener('click', e => {
      e.stopPropagation();
    });
  });

  return card;
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Search Listener ───────────────────────────────────────
searchInput.addEventListener('input', () => {
  renderList(searchInput.value.trim());
});

// ── Init ──────────────────────────────────────────────────
(async function init() {
  await loadSettingsToUI();
  allWorks = await StorageLocal.getWorks();
  renderList();
})();
