/* ════════════════════════════════════════════════════════
   Yekun Dream — popup.js
   Controle de UI, CRUD com StorageLocal v3, +1 rápido,
   painel de configurações, múltiplas fontes e histórico.
   ════════════════════════════════════════════════════════ */

// Ativação assíncrona das fontes externas sem violação de CSP (sem inline onload)
const googleFontsLink = document.getElementById('googleFontsStylesheet');
if (googleFontsLink) {
  if (googleFontsLink.sheet) {
    googleFontsLink.media = 'all';
  } else {
    googleFontsLink.addEventListener('load', () => {
      googleFontsLink.media = 'all';
    });
  }
}

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
const inputAliases       = document.getElementById('inputAliases');
const inputSiteName      = document.getElementById('inputSiteName');
const inputChapter       = document.getElementById('inputChapter');
const inputUrl           = document.getElementById('inputUrl');
const btnCapture         = document.getElementById('btnCapture');
const btnCancel          = document.getElementById('btnCancel');
const btnSave            = document.getElementById('btnSave');
const tagPicker          = document.getElementById('tagPicker');
const searchBar          = document.getElementById('searchBar');
const searchInput        = document.getElementById('searchInput');
const categoryFilter     = document.getElementById('categoryFilter');
const statusFilter       = document.getElementById('statusFilter');
const statusFilterBar    = document.getElementById('statusFilterBar');
const activeStatusFilters = new Set(['lendo']);
const sortFilter         = document.getElementById('sortFilter');
const btnClearSearch     = document.getElementById('btnClearSearch');
const entriesList        = document.getElementById('entriesList');
const emptyState         = document.getElementById('emptyState');
const toast              = document.getElementById('toast');
const confirmDeleteModal = document.getElementById('confirmDeleteModal');
const confirmDeleteText  = document.getElementById('confirmDeleteText');
const btnCancelDelete    = document.getElementById('btnCancelDelete');
const btnConfirmDelete   = document.getElementById('btnConfirmDelete');

// Notifications & Bell DOM refs
const btnNotifications      = document.getElementById('btnNotifications');
const notifUnreadDot        = document.getElementById('notifUnreadDot');
const notificationsPanel    = document.getElementById('notificationsPanel');
const notificationsList     = document.getElementById('notificationsList');
const notificationsEmpty    = document.getElementById('notificationsEmpty');
const btnClearNotifs        = document.getElementById('btnClearNotifs');
const btnCloseNotifs        = document.getElementById('btnCloseNotifs');

// Weekday Picker DOM ref
const weekdayPicker         = document.getElementById('weekdayPicker');

let pendingDeleteWorkId  = null;

// Confirm Action Modal (Increment & Safe Checks)
const confirmActionModal = document.getElementById('confirmActionModal');
const confirmActionTitle = document.getElementById('confirmActionTitle');
const confirmActionText  = document.getElementById('confirmActionText');
const btnCancelAction    = document.getElementById('btnCancelAction');
const btnConfirmAction   = document.getElementById('btnConfirmAction');
let pendingActionCallback = null;

function showConfirmActionModal({ title, message, confirmText = 'Avançar', onConfirm }) {
  pendingActionCallback = onConfirm;
  if (confirmActionTitle) confirmActionTitle.textContent = title || 'Confirmar';
  if (confirmActionText) confirmActionText.textContent = message || '';
  if (btnConfirmAction) btnConfirmAction.textContent = confirmText;
  if (confirmActionModal) confirmActionModal.classList.add('open');
}

function closeConfirmActionModal() {
  pendingActionCallback = null;
  if (confirmActionModal) confirmActionModal.classList.remove('open');
}

// Settings DOM refs
const toggleFloatingButton = document.getElementById('toggleFloatingButton');
const toggleBadgeCount     = document.getElementById('toggleBadgeCount');
const toggleQuickIncrement = document.getElementById('toggleQuickIncrement');
const toggleAutoTitle      = document.getElementById('toggleAutoTitle');
const toggleAutoSync       = document.getElementById('toggleAutoSync');
const toggleReleaseNotifications = document.getElementById('toggleReleaseNotifications');
const toggleMorningNotification   = document.getElementById('toggleMorningNotification');
const toggleEveningNotification   = document.getElementById('toggleEveningNotification');
const toggleAutoTrackAnime       = document.getElementById('toggleAutoTrackAnime');
const inputBlockedDomains  = document.getElementById('inputBlockedDomains');
const inputAllowedDomains  = document.getElementById('inputAllowedDomains');
const allowedChipsList     = document.getElementById('allowedChipsList');
const blockedChipsList     = document.getElementById('blockedChipsList');
const toggleCurrentSite    = document.getElementById('toggleCurrentSite');
const currentSiteDomain    = document.getElementById('currentSiteDomain');
const sitePermissionBar    = document.getElementById('sitePermissionBar');
const inputSyncKey         = document.getElementById('inputSyncKey');
const btnSyncNow           = document.getElementById('btnSyncNow');
const btnExportBackup      = document.getElementById('btnExportBackup');
const btnImportBackup      = document.getElementById('btnImportBackup');
const fileImportBackup     = document.getElementById('fileImportBackup');

// About & Pix DOM refs
const btnAbout             = document.getElementById('btnAbout');
const aboutPanel           = document.getElementById('aboutPanel');
const btnCloseAbout        = document.getElementById('btnCloseAbout');
const linkOfficialSite     = document.getElementById('linkOfficialSite');
const btnCopyPix           = document.getElementById('btnCopyPix');
const pixTestKey           = document.getElementById('pixTestKey');
const btnGoToPixTab        = document.getElementById('btnGoToPixTab');
const btnCopySettingsPix   = document.getElementById('btnCopySettingsPix');
const pixSettingsKey       = document.getElementById('pixSettingsKey');
const linkOfficialSiteSettings = document.getElementById('linkOfficialSiteSettings');

// Pro & Pin Activation DOM refs
const proStatusCard        = document.getElementById('proStatusCard');
const proBadgeLabel        = document.getElementById('proBadgeLabel');
const proAccountEmail      = document.getElementById('proAccountEmail');
const btnEditProEmail      = document.getElementById('btnEditProEmail');
const inputCustomProEmail  = document.getElementById('inputCustomProEmail');
const btnSaveCustomProEmail= document.getElementById('btnSaveCustomProEmail');
const proDescText          = document.getElementById('proDescText');
const btnOpenProModal      = document.getElementById('btnOpenProModal');
const btnVerifyPro         = document.getElementById('btnVerifyPro');
const proSyncControls      = document.querySelectorAll('.pro-sync-controls');
const modalProPix          = document.getElementById('modalProPix');
const btnCloseProModal     = document.getElementById('btnCloseProModal');
const proPixBrCode         = document.getElementById('proPixBrCode');
const proPixQrImg          = document.getElementById('proPixQrImg');
const btnCopyProBrCode     = document.getElementById('btnCopyProBrCode');
const btnAlreadyPaid       = document.getElementById('btnAlreadyPaid');
const btnCancelWaiting     = document.getElementById('btnCancelWaiting');
const btnCloseSuccess      = document.getElementById('btnCloseSuccess');
const btnSimulatePayment   = document.getElementById('btnSimulatePayment');
const proSuccessValidUntil = document.getElementById('proSuccessValidUntil');

// Pro PIN, Security & Recovery DOM refs
const proActiveSecurityCard    = document.getElementById('proActiveSecurityCard');
const inputDisplayProPin       = document.getElementById('inputDisplayProPin');
const btnToggleRevealPin       = document.getElementById('btnToggleRevealPin');
const btnCopyDisplayPin        = document.getElementById('btnCopyDisplayPin');
const inputDisplayProRecovery  = document.getElementById('inputDisplayProRecovery');
const btnToggleRevealRecovery  = document.getElementById('btnToggleRevealRecovery');
const btnCopyDisplayRecovery   = document.getElementById('btnCopyDisplayRecovery');
const proSuccessPin            = document.getElementById('proSuccessPin');
const btnCopySuccessPin        = document.getElementById('btnCopySuccessPin');
const proSuccessRecovery       = document.getElementById('proSuccessRecovery');
const btnCopySuccessRecovery   = document.getElementById('btnCopySuccessRecovery');
const proTotpAccordion         = document.getElementById('proTotpAccordion');
const lblTotpStatus            = document.getElementById('lblTotpStatus');
const imgTotpQr                = document.getElementById('imgTotpQr');
const proTotpQrHint            = document.getElementById('proTotpQrHint');
const inputTotpManualSecret    = document.getElementById('inputTotpManualSecret');
const btnCopyTotpSecret        = document.getElementById('btnCopyTotpSecret');
const inputTotpTestCode        = document.getElementById('inputTotpTestCode');
const btnActivateTotp          = document.getElementById('btnActivateTotp');
const proTotpVerifyRow         = document.getElementById('proTotpVerifyRow');
const proTotpActiveRow         = document.getElementById('proTotpActiveRow');
const btnDisableTotp           = document.getElementById('btnDisableTotp');

// Modal de Desafio 2FA (TOTP) no Login
const modalTotpLogin           = document.getElementById('modalTotpLogin');
const totpLoginDesc            = document.getElementById('totpLoginDesc');
const inputTotpLoginCode       = document.getElementById('inputTotpLoginCode');
const btnCancelTotpLogin       = document.getElementById('btnCancelTotpLogin');
const btnConfirmTotpLogin      = document.getElementById('btnConfirmTotpLogin');

// Modal Verify Pro Access (para novos acessos manuais)
const modalVerifyProAccess     = document.getElementById('modalVerifyProAccess');
const inputVerifyProSecret     = document.getElementById('inputVerifyProSecret');
const btnCancelVerifyPro       = document.getElementById('btnCancelVerifyPro');
const btnConfirmVerifyPro      = document.getElementById('btnConfirmVerifyPro');

// Desconexão e Troca Segura de Conta DOM refs
const btnHeaderAuth              = document.getElementById('btnHeaderAuth');
const btnDisconnectAccount       = document.getElementById('btnDisconnectAccount');
const btnDisconnectAccountHeader = document.getElementById('btnDisconnectAccountHeader');
const modalConfirmDisconnect      = document.getElementById('modalConfirmDisconnect');
const confirmDisconnectDesc       = document.getElementById('confirmDisconnectDesc');
const btnCancelConfirmDisconnect  = document.getElementById('btnCancelConfirmDisconnect');
const btnConfirmDisconnectAccount = document.getElementById('btnConfirmDisconnectAccount');
const modalSyncAccountPrompt     = document.getElementById('modalSyncAccountPrompt');
const lblNewSyncEmail            = document.getElementById('lblNewSyncEmail');
const btnConfirmSyncNewAccount   = document.getElementById('btnConfirmSyncNewAccount');
const btnCancelSyncNewAccount    = document.getElementById('btnCancelSyncNewAccount');
const verifyProAccessEmailDesc = document.getElementById('verifyProAccessEmailDesc');
const qrLoadingSpinner            = document.getElementById('qrLoadingSpinner');

// Feedback & Community Feed DOM refs
const btnQuickReportSite        = document.getElementById('btnQuickReportSite');
const feedbackCategorySelect    = document.getElementById('feedbackCategorySelect');
const feedbackMessage           = document.getElementById('feedbackMessage');
const feedbackCharCounter       = document.getElementById('feedbackCharCounter');
const feedbackIncludeSiteToggle = document.getElementById('feedbackIncludeSiteToggle');
const feedbackSitePreview       = document.getElementById('feedbackSitePreview');
const feedbackPreviewUrl        = document.getElementById('feedbackPreviewUrl');
const feedbackPreviewWorkRow    = document.getElementById('feedbackPreviewWorkRow');
const feedbackPreviewWork       = document.getElementById('feedbackPreviewWork');
const feedbackEmail             = document.getElementById('feedbackEmail');
const btnSubmitFeedback         = document.getElementById('btnSubmitFeedback');
const btnSubmitFeedbackText     = document.getElementById('btnSubmitFeedbackText');
const feedbackStatusMsg         = document.getElementById('feedbackStatusMsg');

let currentFeedbackContext = {
  url: '',
  domain: '',
  title: '',
  chapter: ''
};

const SVG_PRO_EDIT_PENCIL = '<svg class="svg-icon svg-sm" viewBox="0 0 24 24"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>';
const SVG_PRO_EDIT_CANCEL = '<svg class="svg-icon svg-sm" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';

function setProEmailEditingMode(isEditing) {
  if (!inputCustomProEmail) return;
  if (isEditing) {
    inputCustomProEmail.classList.add('is-editing');
    inputCustomProEmail.disabled = false;
    inputCustomProEmail.readOnly = false;
    inputCustomProEmail.focus();
    if (btnEditProEmail) {
      btnEditProEmail.innerHTML = SVG_PRO_EDIT_CANCEL;
      btnEditProEmail.title = 'Cancelar edição';
      btnEditProEmail.setAttribute('aria-label', 'Cancelar edição');
      btnEditProEmail.classList.add('is-editing-cancel');
    }
    if (btnSaveCustomProEmail) {
      btnSaveCustomProEmail.classList.remove('hidden');
    }
  } else {
    inputCustomProEmail.classList.remove('is-editing');
    inputCustomProEmail.disabled = true;
    inputCustomProEmail.readOnly = true;
    if (btnEditProEmail) {
      btnEditProEmail.innerHTML = SVG_PRO_EDIT_PENCIL;
      btnEditProEmail.title = 'Alterar e-mail manualmente';
      btnEditProEmail.setAttribute('aria-label', 'Alterar e-mail manualmente');
      btnEditProEmail.classList.remove('is-editing-cancel');
    }
    if (btnSaveCustomProEmail) {
      btnSaveCustomProEmail.classList.add('hidden');
    }
  }
}

// Form Status Pickers
const readingStatusPicker  = document.getElementById('readingStatusPicker');
const pubStatusPicker      = document.getElementById('pubStatusPicker');

// Bottom Nav & Sites View DOM refs
const bottomNavBar        = document.getElementById('bottomNavBar');
const navBtnWorks          = document.getElementById('navBtnWorks');
const navBtnSites          = document.getElementById('navBtnSites');
const navBadgeWorks        = document.getElementById('navBadgeWorks');
const navBadgeSites        = document.getElementById('navBadgeSites');
const sitesListView        = document.getElementById('sitesListView');
const emptySitesState      = document.getElementById('emptySitesState');
const sitesCardsContainer  = document.getElementById('sitesCardsContainer');

let currentActiveView      = 'works';
let selectedTag            = 'manga';
let selectedReadingStatus  = 'lendo';
let selectedPubStatus      = 'lancamento';
let allWorks               = [];
let appSettings            = {};
let toastTimer             = null;
let currentActiveDomain    = '';

// ── Vector SVG Icons ──────────────────────────────────────
const ICONS = {
  globe: `<svg class="svg-icon svg-xs" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
  slashCircle: `<svg class="svg-icon svg-xs" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>`,
  external: `<svg class="svg-icon svg-xs" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`,
  edit: `<svg class="svg-icon svg-xs" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  del: `<svg class="svg-icon svg-xs" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  book: `<svg class="svg-icon svg-xs" viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
  chevronDown: `<svg class="svg-icon svg-xs" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>`,
  plus: `<svg class="svg-icon svg-xs" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  calendar: `<svg class="svg-icon svg-xs" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  bell: `<svg class="svg-icon svg-xs" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`
};

// ── Toast ────────────────────────────────────────────────
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

// ── Tag Picker & Categorias (Vídeo vs Texto) ──────────────
function isVideoWorkTag(tag) {
  const t = (tag || '').toLowerCase().trim();
  return t === 'anime' || t === 'filme' || t === 'serie';
}

function updateReadingStatusPickerLabels(tag = selectedTag) {
  if (!readingStatusPicker) return;
  const lendoBtn = readingStatusPicker.querySelector('[data-status="lendo"]');
  if (lendoBtn) {
    lendoBtn.textContent = isVideoWorkTag(tag) ? 'Assistindo' : 'Lendo';
  }
}

tagPicker.querySelectorAll('.tag-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    tagPicker.querySelectorAll('.tag-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedTag = btn.dataset.tag;
    updateReadingStatusPickerLabels(selectedTag);
  });
});

function setActiveTag(tag) {
  tagPicker.querySelectorAll('.tag-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tag === tag);
  });
  selectedTag = tag || 'manga';
  updateReadingStatusPickerLabels(selectedTag);
}

// ── Status Pickers (Leitura e Obra) ──────────────────────
if (readingStatusPicker) {
  readingStatusPicker.querySelectorAll('.tag-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      readingStatusPicker.querySelectorAll('.tag-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedReadingStatus = btn.dataset.status;
    });
  });
}

function setActiveReadingStatus(status) {
  if (!readingStatusPicker) return;
  readingStatusPicker.querySelectorAll('.tag-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.status === status);
  });
  selectedReadingStatus = status || 'lendo';
}

if (pubStatusPicker) {
  pubStatusPicker.querySelectorAll('.tag-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      pubStatusPicker.querySelectorAll('.tag-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedPubStatus = btn.dataset.pub;
    });
  });
}

function setActivePubStatus(pub) {
  if (!pubStatusPicker) return;
  pubStatusPicker.querySelectorAll('.tag-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.pub === pub);
  });
  selectedPubStatus = pub || 'lancamento';
}

// ── Weekday Picker (Dias de Lançamento) ────────────────────
let selectedReleaseDays = [];

function setSelectedReleaseDays(days = []) {
  selectedReleaseDays = Array.isArray(days) ? days.map(Number) : [];
  if (weekdayPicker) {
    weekdayPicker.querySelectorAll('.weekday-btn').forEach(btn => {
      const d = Number(btn.dataset.day);
      btn.classList.toggle('active', selectedReleaseDays.includes(d));
    });
  }
}

function getSelectedReleaseDays() {
  return [...selectedReleaseDays];
}

if (weekdayPicker) {
  weekdayPicker.querySelectorAll('.weekday-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const d = Number(btn.dataset.day);
      if (selectedReleaseDays.includes(d)) {
        selectedReleaseDays = selectedReleaseDays.filter(day => day !== d);
        btn.classList.remove('active');
      } else {
        selectedReleaseDays.push(d);
        btn.classList.add('active');
      }
    });
  });
}

function isElOpen(el) {
  if (!el || !el.classList) return false;
  if (typeof el.classList.contains === 'function') {
    return el.classList.contains('open');
  }
  return false;
}

function syncBottomNavVisibility() {
  const isDrawerOpen = isElOpen(settingsPanel) ||
                       isElOpen(aboutPanel) ||
                       isElOpen(formPanel) ||
                       isElOpen(notificationsPanel);

  if (bottomNavBar) {
    bottomNavBar.style.display = isDrawerOpen ? 'none' : 'flex';
  }
  if (sitePermissionBar) {
    sitePermissionBar.style.display = isDrawerOpen ? 'none' : '';
  }
  if (searchBar) {
    searchBar.style.display = isDrawerOpen ? 'none' : '';
  }

  if (isDrawerOpen) {
    if (entriesList) entriesList.style.display = 'none';
    if (sitesListView) sitesListView.style.display = 'none';
  } else {
    if (currentActiveView === 'sites') {
      if (entriesList) entriesList.style.display = 'none';
      if (sitesListView) sitesListView.style.display = 'flex';
    } else {
      if (entriesList) entriesList.style.display = '';
      if (sitesListView) sitesListView.style.display = 'none';
    }
  }
}

// ── Drawer Controls ──────────────────────────────────────
function openForm(mode = 'new', work = null, source = null) {
  if (aboutPanel) {
    aboutPanel.classList.remove('open');
    if (btnAbout) btnAbout.classList.remove('active');
  }
  if (notificationsPanel) {
    notificationsPanel.classList.remove('open');
    if (btnNotifications) btnNotifications.classList.remove('active');
  }
  settingsPanel.classList.remove('open');
  btnSettings.classList.remove('active');
  formPanel.classList.add('open');
  syncBottomNavVisibility();

  if (mode === 'edit' && work) {
    formTitle.textContent = 'Editar Obra';
    editIdField.value     = work.id;
    inputTitle.value      = work.name;
    inputTitle.readOnly   = false;
    if (inputAliases) inputAliases.value = Array.isArray(work.aliases) ? work.aliases.join(', ') : '';
    setActiveTag(work.tag || 'outro');
    setActiveReadingStatus(work.readingStatus || 'lendo');
    setActivePubStatus(work.publicationStatus || 'lancamento');
    setSelectedReleaseDays(work.releaseDays || []);

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
    if (inputAliases) inputAliases.value = Array.isArray(work.aliases) ? work.aliases.join(', ') : '';
    setActiveTag(work.tag || 'manga');
    setActiveReadingStatus(work.readingStatus || 'lendo');
    setActivePubStatus(work.publicationStatus || 'lancamento');
    setSelectedReleaseDays(work.releaseDays || []);
    inputSiteName.value   = '';
    inputChapter.value    = work.mainChapter || '';
    inputUrl.value        = '';
    btnSave.textContent   = 'Adicionar Fonte';

    if (appSettings.enableAutoTitleDetection !== false) {
      captureCurrentTab(true);
    }
  } else {
    resetPopupForm();
    if (appSettings.enableAutoTitleDetection !== false) {
      captureCurrentTab(false);
    }
  }
  setTimeout(() => (inputTitle.readOnly ? inputChapter : inputTitle).focus(), 60);
}

function resetPopupForm() {
  formTitle.textContent = 'Nova Obra';
  editIdField.value     = '';
  editSourceIdField.value = '';
  inputTitle.value      = '';
  inputTitle.readOnly   = false;
  if (inputAliases) inputAliases.value = '';
  inputSiteName.value   = '';
  inputChapter.value    = '';
  inputUrl.value        = '';
  setActiveTag('manga');
  setActiveReadingStatus('lendo');
  setActivePubStatus('lancamento');
  setSelectedReleaseDays([]);
  btnSave.textContent   = 'Salvar Obra';
}

function closeForm() {
  formPanel.classList.remove('open');
  resetPopupForm();
  syncBottomNavVisibility();
}

btnShowForm.addEventListener('click', () => {
  if (aboutPanel) {
    aboutPanel.classList.remove('open');
    if (btnAbout) btnAbout.classList.remove('active');
  }
  if (notificationsPanel) {
    notificationsPanel.classList.remove('open');
    if (btnNotifications) btnNotifications.classList.remove('active');
  }
  if (formPanel.classList.contains('open')) {
    closeForm();
  } else {
    openForm('new');
  }
});

btnCancel.addEventListener('click', closeForm);

// ── Notifications Drawer & History Handlers ───────────────
async function updateNotificationUnreadDot() {
  if (!notifUnreadDot || typeof StorageLocal === 'undefined' || typeof StorageLocal.getNotificationsHistory !== 'function') return;
  try {
    const history = await StorageLocal.getNotificationsHistory();
    const hasUnread = Array.isArray(history) && history.some(n => !n.read);
    notifUnreadDot.style.display = hasUnread ? 'block' : 'none';
  } catch (_) {}
}

async function renderNotificationsList() {
  if (!notificationsList || typeof StorageLocal === 'undefined' || typeof StorageLocal.getNotificationsHistory !== 'function') return;
  try {
    const history = await StorageLocal.getNotificationsHistory();
    notificationsList.innerHTML = '';

    if (!Array.isArray(history) || history.length === 0) {
      if (notificationsEmpty) notificationsEmpty.style.display = 'flex';
      return;
    }
    if (notificationsEmpty) notificationsEmpty.style.display = 'none';

    history.forEach(notif => {
      const card = document.createElement('div');
      card.className = `notif-card ${notif.read ? 'read' : 'unread'}`;
      const periodLabel = notif.period === 'morning' ? 'Manhã (08:00)' : (notif.period === 'evening' ? 'Tarde (17:00)' : 'Lançamento');
      const timeStr = formatDate(notif.timestamp) + ' ' + formatTime(notif.timestamp);

      card.innerHTML = `
        <div class="notif-card-info">
          <div class="notif-card-title" title="${esc(notif.workName || '')}">${esc(notif.workName || 'Obra')}</div>
          <div class="notif-card-sub">
            <span>${esc(periodLabel)}</span> • <span>${esc(timeStr)}</span>
          </div>
        </div>
        ${notif.url ? `<button type="button" class="notif-card-btn" data-url="${esc(notif.url)}">Abrir</button>` : ''}
      `;

      if (notif.url) {
        card.style.cursor = 'pointer';
        card.addEventListener('click', () => {
          safeOpenUrl(notif.url);
        });
      }

      notificationsList.appendChild(card);
    });
  } catch (_) {}
}

async function toggleNotificationsDrawer() {
  if (aboutPanel) {
    aboutPanel.classList.remove('open');
    if (btnAbout) btnAbout.classList.remove('active');
  }
  if (settingsPanel) {
    settingsPanel.classList.remove('open');
    if (btnSettings) btnSettings.classList.remove('active');
  }
  if (formPanel) formPanel.classList.remove('open');

  const isOpen = notificationsPanel ? notificationsPanel.classList.toggle('open') : false;
  if (btnNotifications) btnNotifications.classList.toggle('active', isOpen);
  syncBottomNavVisibility();

  if (isOpen) {
    await renderNotificationsList();
    if (typeof StorageLocal !== 'undefined' && typeof StorageLocal.markNotificationsRead === 'function') {
      await StorageLocal.markNotificationsRead();
    }
    if (notifUnreadDot) notifUnreadDot.style.display = 'none';
  }
}

if (btnNotifications) {
  btnNotifications.addEventListener('click', toggleNotificationsDrawer);
}

if (btnCloseNotifs) {
  btnCloseNotifs.addEventListener('click', () => {
    if (notificationsPanel) notificationsPanel.classList.remove('open');
    if (btnNotifications) btnNotifications.classList.remove('active');
    syncBottomNavVisibility();
  });
}

if (btnClearNotifs) {
  btnClearNotifs.addEventListener('click', async () => {
    if (typeof StorageLocal !== 'undefined' && typeof StorageLocal.clearNotificationsHistory === 'function') {
      await StorageLocal.clearNotificationsHistory();
    }
    await renderNotificationsList();
    if (notifUnreadDot) notifUnreadDot.style.display = 'none';
    showToast('✓ Histórico de notificações limpo');
  });
}

// ── Settings Drawer ──────────────────────────────────────
function toggleSettingsDrawer() {
  formPanel.classList.remove('open');
  if (aboutPanel) {
    aboutPanel.classList.remove('open');
    if (btnAbout) btnAbout.classList.remove('active');
  }
  if (notificationsPanel) {
    notificationsPanel.classList.remove('open');
    if (btnNotifications) btnNotifications.classList.remove('active');
  }
  const isOpen = settingsPanel.classList.toggle('open');
  btnSettings.classList.toggle('active', isOpen);
  syncBottomNavVisibility();
  if (isOpen) {
    updateStorageStatsUI();
    updateCurrentSiteToggleUI();
    updateProStatusUI();
  }
}

btnSettings.addEventListener('click', toggleSettingsDrawer);
if (btnCloseSettings) btnCloseSettings.addEventListener('click', () => {
  settingsPanel.classList.remove('open');
  btnSettings.classList.remove('active');
  syncBottomNavVisibility();
});

// ── Brand click: back to Obras view & close all drawers ──
const headerBrand = document.getElementById('headerBrand');
if (headerBrand) {
  headerBrand.addEventListener('click', () => {
    if (formPanel) formPanel.classList.remove('open');
    if (settingsPanel) settingsPanel.classList.remove('open');
    if (aboutPanel) aboutPanel.classList.remove('open');
    if (notificationsPanel) notificationsPanel.classList.remove('open');
    if (btnSettings) btnSettings.classList.remove('active');
    if (btnNotifications) btnNotifications.classList.remove('active');
    if (btnAbout) btnAbout.classList.remove('active');
    if (typeof switchView === 'function') {
      switchView('works');
    }
    syncBottomNavVisibility();
  });
}

// ── About Drawer & Pix Handlers ──────────────────────────
function toggleAboutDrawer() {
  formPanel.classList.remove('open');
  settingsPanel.classList.remove('open');
  btnSettings.classList.remove('active');
  if (notificationsPanel) {
    notificationsPanel.classList.remove('open');
    if (btnNotifications) btnNotifications.classList.remove('active');
  }
  const isOpen = aboutPanel ? aboutPanel.classList.toggle('open') : false;
  if (btnAbout) btnAbout.classList.toggle('active', isOpen);
  syncBottomNavVisibility();
}

if (btnAbout) {
  btnAbout.addEventListener('click', () => {
    if (settingsPanel && settingsPanel.classList.contains('open')) {
      switchToSettingsTab('about');
      return;
    }
    toggleAboutDrawer();
  });
}
if (btnCloseAbout) btnCloseAbout.addEventListener('click', () => {
  if (aboutPanel) aboutPanel.classList.remove('open');
  if (btnAbout) btnAbout.classList.remove('active');
  syncBottomNavVisibility();
});

if (btnGoToPixTab) {
  btnGoToPixTab.addEventListener('click', () => {
    switchToSettingsTab('about');
  });
}

function handleOpenOfficialSite(e) {
  if (e) e.preventDefault();
  const url = 'https://sentsuy.ddns.net/';
  if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
    chrome.tabs.create({ url });
  } else {
    window.open(url, '_blank');
  }
}

if (linkOfficialSite) {
  linkOfficialSite.addEventListener('click', handleOpenOfficialSite);
}
if (linkOfficialSiteSettings) {
  linkOfficialSiteSettings.addEventListener('click', handleOpenOfficialSite);
}

function handleCopyPixKey(keyToCopy) {
  const key = (keyToCopy || 'a6eef510-b30c-48d7-a6bd-d5772054bcc1').trim();
  if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(key).then(() => {
      showToast('✓ Chave Pix copiada com sucesso!');
    }).catch(() => {
      showToast('✓ Chave Pix: ' + key);
    });
  } else {
    showToast('✓ Chave Pix: ' + key);
  }
}

if (btnCopyPix) {
  btnCopyPix.addEventListener('click', () => {
    handleCopyPixKey(pixTestKey ? pixTestKey.value : '');
  });
}

if (btnCopySettingsPix) {
  btnCopySettingsPix.addEventListener('click', () => {
    handleCopyPixKey(pixSettingsKey ? pixSettingsKey.value : '');
  });
}

function updateToggleStatus(isEnabled) {
  const statusEl = document.getElementById('floatingButtonStatus');
  if (statusEl) {
    statusEl.textContent = isEnabled ? 'Ativado' : 'Desativado';
    statusEl.classList.toggle('disabled', !isEnabled);
  }
}

function broadcastSettingsToTabs(settings) {
  try {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      chrome.tabs.query({}, tabs => {
        (tabs || []).forEach(t => {
          if (!t.id || !t.url || (!t.url.startsWith('http://') && !t.url.startsWith('https://'))) return;
          chrome.tabs.sendMessage(t.id, { action: 'settingsUpdated', settings }, (res) => {
            if (chrome.runtime.lastError || !res) {
              if (settings && settings.enableFloatingButton && chrome.scripting && chrome.scripting.executeScript) {
                chrome.scripting.executeScript({
                  target: { tabId: t.id },
                  files: ['canonical-resolver.js', 'alias-crowd-service.js', 'storage-local.js', 'content.js']
                }).catch(() => {});
              }
            }
          });
        });
      });
    }
  } catch (e) {}
}

async function ensureActiveTabContentScript(settings, providedTab = null) {
  try {
    let tab = providedTab;
    if (!tab && typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
      tab = t;
    }
    if (tab && tab.id && tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
      chrome.tabs.sendMessage(tab.id, { action: 'settingsUpdated', settings }, (response) => {
        if (chrome.runtime.lastError || !response) {
          if (chrome.scripting && chrome.scripting.executeScript) {
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['canonical-resolver.js', 'alias-crowd-service.js', 'storage-local.js', 'content.js']
            }).catch(() => {});
          }
        }
      });
    }
  } catch (e) {}
}

function updateDiagnosticUI(domain, isAllowed, isWebPage) {
  const diagTitle = document.getElementById('diagnosticDomainTitle');
  const diagStatus = document.getElementById('diagnosticStatusText');
  const diagIndicator = document.getElementById('diagnosticIndicator');
  if (!diagTitle || !diagStatus || !diagIndicator) return;

  if (!isWebPage || !domain) {
    diagTitle.textContent = 'Página Interna do Navegador';
    diagStatus.textContent = 'Injeção e botão flutuante desativados nesta aba';
    diagIndicator.className = 'diagnostic-indicator state-disabled';
    return;
  }

  diagTitle.textContent = domain;
  if (isAllowed) {
    diagStatus.textContent = 'Captura ativa • Botão flutuante liberado';
    diagIndicator.className = 'diagnostic-indicator state-active';
  } else {
    diagStatus.textContent = 'Captura em espera • Botão desativado para este site';
    diagIndicator.className = 'diagnostic-indicator state-inactive';
  }
}

async function updateCurrentSiteToggleUI(providedTab = null) {
  if (!currentSiteDomain || !toggleCurrentSite) return;

  try {
    let tab = providedTab;
    if (!tab && typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
      tab = t;
    }
    if (tab && tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
      currentActiveDomain = (typeof StorageLocal !== 'undefined' && StorageLocal.extractDomain)
        ? StorageLocal.extractDomain(tab.url)
        : '';
      if (!currentActiveDomain) {
        try {
          currentActiveDomain = new URL(tab.url).hostname.replace(/^www\./, '');
        } catch (_) {}
      }

      if (currentActiveDomain) {
        currentSiteDomain.textContent = currentActiveDomain;
        const isAllowed = (typeof StorageLocal !== 'undefined' && typeof StorageLocal.isDomainAllowed === 'function')
          ? StorageLocal.isDomainAllowed(currentActiveDomain, appSettings)
          : (appSettings.allowedDomains || []).includes(currentActiveDomain);

        toggleCurrentSite.disabled = false;
        toggleCurrentSite.checked = isAllowed;
        currentSiteDomain.classList.toggle('disabled-domain', !isAllowed);
        if (sitePermissionBar) {
          sitePermissionBar.style.display = 'flex';
          sitePermissionBar.title = `Botão flutuante para este site (${currentActiveDomain})`;
        }
        updateDiagnosticUI(currentActiveDomain, isAllowed, true);
        updateFeedbackContext(tab);
        return;
      }
    }
  } catch (e) {
    // ignore
  }

  // Not a web page (e.g. chrome://, chrome-extension://, blank)
  if (currentSiteDomain) currentSiteDomain.textContent = 'página do navegador';
  if (toggleCurrentSite) {
    toggleCurrentSite.checked = false;
    toggleCurrentSite.disabled = true;
  }
  if (currentSiteDomain) currentSiteDomain.classList.add('disabled-domain');
  if (sitePermissionBar) {
    sitePermissionBar.title = 'Botão flutuante não disponível nesta página';
  }
  updateDiagnosticUI(null, false, false);
  updateFeedbackContext(null);
}

// ── Theme Management (Dark, Light, Pink) ──────────────────
function updateActionIcon(themeName = 'dark') {
  const valid = ['dark', 'light', 'pink', 'neon'].includes(themeName) ? themeName : 'dark';
  try {
    if (typeof chrome !== 'undefined' && chrome.action && chrome.action.setIcon) {
      chrome.action.setIcon({
        path: {
          16: `icons/icon-${valid}-16.png`,
          32: `icons/icon-${valid}-32.png`,
          48: `icons/icon-${valid}-48.png`,
          128: `icons/icon-${valid}-128.png`
        }
      }, () => {
        if (chrome.runtime && chrome.runtime.lastError) { /* ignore */ }
      });
    }
  } catch (e) {}
}

function applyTheme(themeName = 'dark', updateIcon = false) {
  const valid = ['dark', 'light', 'pink', 'neon'].includes(themeName) ? themeName : 'dark';
  if (typeof document !== 'undefined' && document.documentElement && document.documentElement.setAttribute) {
    document.documentElement.setAttribute('data-theme', valid);
  }
  if (typeof document !== 'undefined' && document.body && document.body.setAttribute) {
    document.body.setAttribute('data-theme', valid);
  }
  appSettings.theme = valid;

  const themeBtns = document.querySelectorAll('.theme-btn');
  themeBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === valid);
  });

  if (updateIcon) {
    updateActionIcon(valid);
  }
}

function initThemeSwitcher() {
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const theme = btn.dataset.theme;

      // Trava exclusiva para o Tema Cyber Neon (PRO)
      if (theme === 'neon') {
        const isPro = proStatusCard && proStatusCard.classList.contains('is-pro');
        if (!isPro) {
          showToast('O Tema Cyber Neon e exclusivo para assinantes Yekun PRO');
          openProModal();
          return;
        }
      }

      applyTheme(theme, true);
      appSettings.theme = theme;
      await StorageLocal.saveSettings(appSettings);
      broadcastSettingsToTabs(appSettings);
      showToast(
        theme === 'light' ? 'Tema Claro ativado' :
        theme === 'pink'  ? 'Tema Rosa ativado' :
        theme === 'neon'  ? 'Tema Cyber Neon PRO ativado' :
                           'Tema Escuro ativado'
      );
    });
  });
}

function switchToSettingsTab(target) {
  const tabBtns = document.querySelectorAll('.settings-tab-btn');
  const tabPanes = document.querySelectorAll('.settings-tab-pane');
  if (!tabBtns.length || !tabPanes.length) return;

  tabBtns.forEach(b => {
    if (b.dataset.tab === target) {
      b.classList.add('active');
    } else {
      b.classList.remove('active');
    }
  });

  tabPanes.forEach(pane => pane.classList.remove('active'));

  const activePane = document.getElementById(
    target === 'pro'           ? 'paneSettingsPro' :
    target === 'appearance'    ? 'paneSettingsAppearance' :
    target === 'reader'        ? 'paneSettingsReader' :
    target === 'notifications' ? 'paneSettingsNotifications' :
    target === 'feedback'      ? 'paneSettingsFeedback' :
    target === 'about'         ? 'paneSettingsAbout' :
                                'paneSettingsPro'
  );
  if (activePane) {
    activePane.classList.add('active');
  }
}

function initSettingsTabs() {
  const tabBtns = document.querySelectorAll('.settings-tab-btn');
  if (!tabBtns.length) return;

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      switchToSettingsTab(target);
    });
  });
}

function initToggleHelpTooltips() {
  if (typeof document === 'undefined' || typeof document.querySelectorAll !== 'function') return;
  const helpIcons = document.querySelectorAll('.toggle-help-icon');
  if (!helpIcons || !helpIcons.length) return;

  helpIcons.forEach(icon => {
    if (typeof icon.addEventListener !== 'function') return;
    // Impede que o clique no ícone de ajuda dispare o checkbox do label pai
    icon.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const wasActive = icon.classList && icon.classList.contains('active');
      document.querySelectorAll('.toggle-help-icon.active').forEach(i => i.classList && i.classList.remove('active'));
      if (!wasActive && icon.classList) {
        icon.classList.add('active');
      }
    });

    // Suporte a teclado (Enter/Espaço para abrir o balão e focar na leitura)
    icon.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        if (icon.classList) icon.classList.toggle('active');
      }
    });
  });

  // Fechar tooltips fixados ao clicar em qualquer outro lugar do documento
  if (typeof document.addEventListener === 'function') {
    document.addEventListener('click', (e) => {
      if (!e.target || typeof e.target.closest !== 'function' || !e.target.closest('.toggle-help-icon')) {
        document.querySelectorAll('.toggle-help-icon.active').forEach(i => i.classList && i.classList.remove('active'));
      }
    });
  }
}

function cleanDomainInput(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let str = raw.trim().toLowerCase();
  str = str.replace(/^[a-z]+:\/\//i, '');
  str = str.split('/')[0].split('?')[0].split('#')[0];
  str = str.split(':')[0];
  str = str.replace(/^www\./i, '');
  return str.trim();
}

function renderDomainChips() {
  if (allowedChipsList) {
    allowedChipsList.innerHTML = '';
    const allowed = (appSettings.allowedDomains || []).map(d => (d || '').trim().toLowerCase().replace(/^www\./, '')).filter(Boolean);
    if (allowed.length === 0) {
      const emptyEl = document.createElement('span');
      emptyEl.className = 'domain-chips-empty';
      emptyEl.textContent = 'Nenhum site configurado (botão desativado por padrão)';
      allowedChipsList.appendChild(emptyEl);
    } else {
      allowed.forEach(domain => {
        const chip = document.createElement('div');
        chip.className = 'domain-chip';
        chip.innerHTML = `
          <span class="domain-chip-icon">${ICONS.globe}</span>
          <span class="domain-chip-name" title="${esc(domain)}">${esc(domain)}</span>
          <button type="button" class="domain-chip-remove" title="Remover ${esc(domain)}" data-domain="${esc(domain)}" data-type="allowed">${ICONS.del}</button>
        `;
        allowedChipsList.appendChild(chip);
      });
    }
  }

  if (blockedChipsList) {
    blockedChipsList.innerHTML = '';
    const blocked = (appSettings.blockedDomains || []).map(d => (d || '').trim().toLowerCase().replace(/^www\./, '')).filter(Boolean);
    if (blocked.length === 0) {
      const emptyEl = document.createElement('span');
      emptyEl.className = 'domain-chips-empty';
      emptyEl.textContent = 'Nenhum site bloqueado';
      blockedChipsList.appendChild(emptyEl);
    } else {
      blocked.forEach(domain => {
        const chip = document.createElement('div');
        chip.className = 'domain-chip';
        chip.innerHTML = `
          <span class="domain-chip-icon">${ICONS.slashCircle}</span>
          <span class="domain-chip-name" title="${esc(domain)}">${esc(domain)}</span>
          <button type="button" class="domain-chip-remove" title="Remover ${esc(domain)}" data-domain="${esc(domain)}" data-type="blocked">${ICONS.del}</button>
        `;
        blockedChipsList.appendChild(chip);
      });
    }
  }
}

function updateStorageStatsUI() {
  const statWorksEl = document.getElementById('storageStatWorks');
  const statSourcesEl = document.getElementById('storageStatSources');
  const statSizeEl = document.getElementById('storageStatsSize');
  if (!statWorksEl && !statSourcesEl && !statSizeEl) return;

  const works = Array.isArray(allWorks) ? allWorks : [];
  const worksCount = works.length;
  let sourcesCount = 0;
  works.forEach(w => {
    if (Array.isArray(w.sources)) {
      sourcesCount += w.sources.length;
    } else {
      sourcesCount += 1;
    }
  });

  if (statWorksEl) statWorksEl.textContent = String(worksCount);
  if (statSourcesEl) statSourcesEl.textContent = String(sourcesCount);

  if (statSizeEl) {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local && typeof chrome.storage.local.getBytesInUse === 'function') {
        chrome.storage.local.getBytesInUse(null, (bytes) => {
          if (chrome.runtime && chrome.runtime.lastError) {
            fallbackStorageSizeCalc(works, statSizeEl);
          } else {
            const kb = (bytes / 1024).toFixed(1);
            statSizeEl.textContent = `${kb} KB`;
          }
        });
      } else {
        fallbackStorageSizeCalc(works, statSizeEl);
      }
    } catch (_) {
      fallbackStorageSizeCalc(works, statSizeEl);
    }
  }
}

function fallbackStorageSizeCalc(works, statSizeEl) {
  try {
    const raw = JSON.stringify(works || []) + JSON.stringify(appSettings || {});
    const kb = (raw.length / 1024).toFixed(1);
    statSizeEl.textContent = `~${kb} KB`;
  } catch (_) {
    statSizeEl.textContent = '< 50 KB';
  }
}

function getSupabaseConfig() {
  const defaultUrl = 'https://wbappdsgstzintgznikb.supabase.co';
  const defaultKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndiYXBwZHNnc3R6aW50Z3puaWtiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5MTgyMDgsImV4cCI6MjEwNzQ5NDIwOH0.6Wc7YDcKpMCq_IWeo54f3U_14giEfjOAH3f5B019vfE';
  return {
    supabaseUrl: (appSettings && appSettings.supabaseUrl && String(appSettings.supabaseUrl).trim()) ? String(appSettings.supabaseUrl).trim() : defaultUrl,
    supabaseKey: (appSettings && appSettings.supabaseKey && String(appSettings.supabaseKey).trim()) ? String(appSettings.supabaseKey).trim() : defaultKey
  };
}

async function updateProStatusUI(forceRefresh = false) {
  if (typeof IdentityService === 'undefined' || !proStatusCard) return;
  try {
    const config = getSupabaseConfig();
    const status = await IdentityService.checkProStatus(config, forceRefresh);

    if (proAccountEmail) {
      proAccountEmail.textContent = status.email || 'Nenhuma conta vinculada';
      proAccountEmail.title = status.email || '';
    }

    if (inputCustomProEmail) {
      if (!inputCustomProEmail.classList.contains('is-editing')) {
        inputCustomProEmail.value = status.email || '';
        inputCustomProEmail.title = status.email || '';
        setProEmailEditingMode(false);
      }
    }

    if (status.isPro) {
      proStatusCard.classList.add('is-pro');
      if (proBadgeLabel) {
        proBadgeLabel.className = 'pro-badge pro-badge-active';
        proBadgeLabel.textContent = '⭐ PRO ATIVO';
      }
      if (proDescText) {
        proDescText.innerHTML = `Assinatura Anual ativa por mais <strong>${status.daysLeft} dias</strong>. Sincronização multi-dispositivo liberada!`;
      }
      if (inputSyncKey) {
        inputSyncKey.value = status.email;
      }
      if (proSyncControls) {
        proSyncControls.forEach(el => el.classList.remove('is-locked'));
      }
    } else {
      proStatusCard.classList.remove('is-pro');
      if (proBadgeLabel) {
        proBadgeLabel.className = 'pro-badge';
        proBadgeLabel.textContent = 'FREE';
      }
      if (proDescText) {
        if (status.needsPin) {
          proDescText.innerHTML = 'Esta conta possui assinatura PRO ativa, mas <strong>requer autorização</strong> com PIN neste dispositivo.';
        } else {
          proDescText.innerHTML = 'Sincronize suas obras entre PC, notebook e navegador em tempo real com o <strong>Yekun Cloud PRO</strong> por apenas <strong>R$ 20/ano</strong>.';
        }
      }
      if (inputSyncKey) {
        inputSyncKey.value = status.email ? `${status.email} (PRO necessário)` : '';
      }
      if (proSyncControls) {
        proSyncControls.forEach(el => el.classList.add('is-locked'));
      }

      // Reverte tema Cyber Neon para Escuro automaticamente se a conta for FREE
      if (appSettings && appSettings.theme === 'neon') {
        appSettings.theme = 'dark';
        applyTheme('dark');
        await StorageLocal.saveSettings(appSettings);
        broadcastSettingsToTabs(appSettings);
        const themeBtns = document.querySelectorAll('.theme-btn');
        themeBtns.forEach(b => {
          b.classList.toggle('active', b.dataset.theme === 'dark');
        });
        showToast('Tema Cyber Neon desativado (exclusivo PRO). Retornado ao tema Escuro.');
      }
    }

    // Atualiza estado de conexão Google, botão do cabeçalho e liberação do 2FA
    const hasEmail = Boolean(status && status.email);
    const proAuthHelper = document.getElementById('proAuthHelper');

    // 1. Painel de Segurança (2FA Opcional) - Exibido SOMENTE após conectar
    if (proActiveSecurityCard) {
      if (hasEmail) {
        proActiveSecurityCard.classList.remove('hidden');
        const creds = await IdentityService.getStoredCredentials();
        const accessPin = creds.accessPin || status.accessPin || '';
        const recoveryKey = creds.recoveryKey || status.recoveryKey || '';

        if (inputDisplayProPin) {
          inputDisplayProPin.dataset.secret = accessPin;
          if (inputDisplayProPin.type === 'text') {
            inputDisplayProPin.value = accessPin || '------';
          } else {
            inputDisplayProPin.value = accessPin ? '••••••' : '------';
          }
        }

        if (inputDisplayProRecovery) {
          inputDisplayProRecovery.dataset.secret = recoveryKey;
          if (inputDisplayProRecovery.type === 'text') {
            inputDisplayProRecovery.value = recoveryKey || 'YK------';
          } else {
            inputDisplayProRecovery.value = recoveryKey ? '•••••••••••••••••••' : 'YK------';
          }
        }

        // TOTP status
        const isTotpActive = Boolean(creds.totpEnabled || (status && status.totpEnabled));
        const qrWrap = document.getElementById('proTotpQrWrap');
        const totpDesc = document.getElementById('proTotpDesc');
        const totpSecretRow = document.getElementById('proTotpSecretRow');

        if (isTotpActive) {
          if (lblTotpStatus) lblTotpStatus.textContent = 'Google Authenticator (2FA Ativo)';
          if (proTotpActiveRow) proTotpActiveRow.classList.remove('hidden');
          if (proTotpVerifyRow) proTotpVerifyRow.classList.add('hidden');
          if (qrWrap) {
            qrWrap.classList.add('hidden');
            qrWrap.style.display = 'none';
          }
          if (proTotpQrHint) proTotpQrHint.style.display = 'none';
          if (totpDesc) totpDesc.textContent = 'Chave do Google Authenticator vinculada com sucesso à sua conta:';
          if (inputTotpManualSecret) {
            inputTotpManualSecret.value = creds.totpSecret || currentTotpSetupSecret || inputTotpManualSecret.value;
          }
          if (totpSecretRow) totpSecretRow.classList.remove('hidden');
        } else {
          if (lblTotpStatus) lblTotpStatus.textContent = 'Configurar Google Authenticator (2FA Opcional)';
          if (proTotpActiveRow) proTotpActiveRow.classList.add('hidden');
          if (proTotpVerifyRow) proTotpVerifyRow.classList.remove('hidden');
          if (qrWrap) {
            qrWrap.classList.remove('hidden');
            qrWrap.style.display = '';
          }
          if (totpDesc) totpDesc.innerHTML = 'Escaneie o QR Code no app <strong>Google Authenticator</strong> no seu celular ou use a chave manual de 16 caracteres.';
        }
      } else {
        proActiveSecurityCard.classList.add('hidden');
        if (proTotpAccordion) proTotpAccordion.removeAttribute('open');
      }
    }

    // 2. Botão Dinâmico no Cabeçalho (Login ↔ Desconectar à esquerda do sino)
    if (btnHeaderAuth) {
      const svgLogin = btnHeaderAuth.querySelector('.svg-auth-login');
      const svgLogout = btnHeaderAuth.querySelector('.svg-auth-logout');
      if (hasEmail) {
        btnHeaderAuth.dataset.action = 'disconnect';
        btnHeaderAuth.title = `Desconectar conta (${status.email})`;
        btnHeaderAuth.classList.add('is-connected');
        if (svgLogin) svgLogin.classList.add('hidden');
        if (svgLogout) svgLogout.classList.remove('hidden');
      } else {
        btnHeaderAuth.dataset.action = 'login';
        btnHeaderAuth.title = 'Fazer Login / Conectar Conta';
        btnHeaderAuth.classList.remove('is-connected');
        if (svgLogin) svgLogin.classList.remove('hidden');
        if (svgLogout) svgLogout.classList.add('hidden');
      }
    }

    if (hasEmail) {
      if (btnDisconnectAccount) btnDisconnectAccount.classList.remove('hidden');
      if (btnDisconnectAccountHeader) btnDisconnectAccountHeader.classList.remove('hidden');
      if (btnConnectGoogle) {
        btnConnectGoogle.classList.add('is-connected');
        const span = btnConnectGoogle.querySelector('span');
        if (span) span.textContent = `Conta Google: ${status.email}`;
        btnConnectGoogle.title = `Conectado como ${status.email}. Clique para reconectar ou sincronizar.`;
      }
      if (proAuthHelper) {
        proAuthHelper.classList.add('is-connected');
        proAuthHelper.innerHTML = '<svg class="svg-icon svg-xs" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg><span>Conta conectada. Assinatura PRO liberada!</span>';
      }
      if (btnOpenProModal) {
        btnOpenProModal.classList.remove('is-locked');
        btnOpenProModal.removeAttribute('disabled');
        btnOpenProModal.title = status.isPro ? 'Renovar Assinatura Yekun PRO (R$ 20/ano)' : 'Assinar Yekun PRO (R$ 20/ano via Pix)';
        const span = btnOpenProModal.querySelector('span');
        if (span) span.textContent = status.isPro ? 'Renovar Yekun PRO' : 'Assinar Yekun PRO (R$ 20/ano)';
      }
    } else {
      if (btnDisconnectAccount) btnDisconnectAccount.classList.add('hidden');
      if (btnDisconnectAccountHeader) btnDisconnectAccountHeader.classList.add('hidden');
      if (btnConnectGoogle) {
        btnConnectGoogle.classList.remove('is-connected');
        const span = btnConnectGoogle.querySelector('span');
        if (span) span.textContent = 'Conectar Conta Google';
        btnConnectGoogle.title = 'Conectar com sua conta Google em 1 clique';
      }
      if (proAuthHelper) {
        proAuthHelper.classList.remove('is-connected');
        proAuthHelper.innerHTML = '<span>Conecte sua conta do navegador para liberar a assinatura PRO</span>';
      }
      if (btnOpenProModal) {
        btnOpenProModal.classList.add('is-locked');
        btnOpenProModal.title = 'Conecte sua conta Google acima para liberar a assinatura';
        const span = btnOpenProModal.querySelector('span');
        if (span) span.textContent = 'Conectar Conta Google para Assinar';
      }
    }
  } catch (e) {
    console.warn('Erro ao atualizar status PRO:', e);
  }
}

let _deferredSettingsScheduled = false;
function scheduleDeferredSettingsDetails() {
  if (_deferredSettingsScheduled) return;
  _deferredSettingsScheduled = true;
  const runner = async () => {
    try {
      renderDomainChips();
      await updateProStatusUI();
      updateStorageStatsUI();
    } catch (_) {}
  };
  if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(runner, { timeout: 800 });
  } else {
    setTimeout(runner, 150);
  }
}

async function loadSettingsToUI(providedSettings = null, options = {}) {
  appSettings = providedSettings || (typeof StorageLocal !== 'undefined' && StorageLocal.getSettings ? await StorageLocal.getSettings() : appSettings);
  applyTheme(appSettings.theme || 'dark', false);
  if (toggleFloatingButton) {
    toggleFloatingButton.checked = !!appSettings.enableFloatingButton;
    updateToggleStatus(toggleFloatingButton.checked);
  }
  if (toggleBadgeCount) toggleBadgeCount.checked     = !!appSettings.enableBadgeCount;
  if (toggleQuickIncrement) toggleQuickIncrement.checked = !!appSettings.enableQuickIncrement;
  if (toggleAutoTitle) toggleAutoTitle.checked      = !!appSettings.enableAutoTitleDetection;
  if (toggleAutoSync) toggleAutoSync.checked       = !!appSettings.enableAutoSync;
  if (toggleReleaseNotifications) toggleReleaseNotifications.checked = appSettings.enableReleaseNotifications !== false;
  if (toggleMorningNotification)   toggleMorningNotification.checked   = appSettings.enableMorningNotification !== false;
  if (toggleEveningNotification)   toggleEveningNotification.checked   = appSettings.enableEveningNotification !== false;
  if (toggleAutoTrackAnime)        toggleAutoTrackAnime.checked        = appSettings.autoTrackAnime !== false;
  if (inputAllowedDomains) inputAllowedDomains.value = '';
  if (inputBlockedDomains) inputBlockedDomains.value = '';
  if (inputSyncKey) inputSyncKey.value           = appSettings.syncKey || '';

  if (options && options.deferSecondary) {
    scheduleDeferredSettingsDetails();
  } else {
    renderDomainChips();
    await updateCurrentSiteToggleUI();
    await updateProStatusUI();
    updateStorageStatsUI();
  }
}

async function persistSettings(options = {}) {
  const previousQuickIncrement = appSettings.enableQuickIncrement;
  updateToggleStatus(toggleFloatingButton.checked);

  appSettings = {
    ...appSettings,
    theme: appSettings.theme || 'dark',
    enableFloatingButton: toggleFloatingButton.checked,
    enableBadgeCount: toggleBadgeCount.checked,
    enableQuickIncrement: toggleQuickIncrement.checked,
    enableAutoTitleDetection: toggleAutoTitle.checked,
    enableAutoSync: toggleAutoSync.checked,
    enableReleaseNotifications: toggleReleaseNotifications ? toggleReleaseNotifications.checked : true,
    enableMorningNotification: toggleMorningNotification ? toggleMorningNotification.checked : true,
    enableEveningNotification: toggleEveningNotification ? toggleEveningNotification.checked : true,
    autoTrackAnime: toggleAutoTrackAnime ? toggleAutoTrackAnime.checked : true,
    allowedDomains: appSettings.allowedDomains || [],
    blockedDomains: appSettings.blockedDomains || [],
    syncKey: inputSyncKey.value.trim(),
    settingsUpdatedAt: Date.now()
  };

  await StorageLocal.saveSettings(appSettings);
  broadcastSettingsToTabs(appSettings);

  // Se o usuário for PRO, sincroniza as preferências com a nuvem em background
  if (typeof SyncService !== 'undefined' && SyncService.syncSettings) {
    SyncService.syncSettings().catch(() => {});
  }

  let activeTab = null;
  try {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
      activeTab = t;
    }
  } catch (_) {}

  ensureActiveTabContentScript(appSettings, activeTab);
  await updateCurrentSiteToggleUI(activeTab);
  renderDomainChips();
  updateStorageStatsUI();

  if (options.redrawList || previousQuickIncrement !== appSettings.enableQuickIncrement) {
    renderList();
  }
}

[
  toggleFloatingButton,
  toggleBadgeCount,
  toggleQuickIncrement,
  toggleAutoTitle,
  toggleReleaseNotifications,
  toggleMorningNotification,
  toggleEveningNotification,
  toggleAutoTrackAnime
].filter(Boolean).forEach(el => {
  el.addEventListener('change', async () => {
    await persistSettings();
    showToast('Configurações salvas');
  });
});

// Auto-sync requer aceite dos termos antes de ligar
if (toggleAutoSync) {
  toggleAutoSync.addEventListener('change', async () => {
    if (toggleAutoSync.checked) {
      const accepted = await isProTermsAccepted();
      if (!accepted) {
        toggleAutoSync.checked = false;
        openProTermsModal({
          onAccept: async () => {
            await recordProTermsAcceptance();
            toggleAutoSync.checked = true;
            await persistSettings();
            showToast('Sincronização periódica ativada');
          }
        });
        return;
      }
    }
    await persistSettings();
    showToast('Configurações salvas');
  });
}

if (toggleCurrentSite) {
  toggleCurrentSite.addEventListener('change', async () => {
    if (!currentActiveDomain) return;
    const enable = toggleCurrentSite.checked;

    if (enable) {
      appSettings.enableFloatingButton = true;
      if (toggleFloatingButton) toggleFloatingButton.checked = true;
      updateToggleStatus(true);

      if (typeof StorageLocal !== 'undefined' && typeof StorageLocal.setDomainAllowed === 'function') {
        appSettings = await StorageLocal.setDomainAllowed(currentActiveDomain, true);
      } else {
        const set = new Set((appSettings.allowedDomains || []).map(d => d.toLowerCase()));
        set.add(currentActiveDomain.toLowerCase());
        appSettings.allowedDomains = Array.from(set);
        if (Array.isArray(appSettings.blockedDomains)) {
          appSettings.blockedDomains = appSettings.blockedDomains.filter(d => d.toLowerCase() !== currentActiveDomain.toLowerCase());
        }
        await StorageLocal.saveSettings(appSettings);
      }
    } else {
      if (typeof StorageLocal !== 'undefined' && typeof StorageLocal.setDomainAllowed === 'function') {
        appSettings = await StorageLocal.setDomainAllowed(currentActiveDomain, false);
      } else {
        const set = new Set((appSettings.allowedDomains || []).map(d => d.toLowerCase()));
        set.delete(currentActiveDomain.toLowerCase());
        appSettings.allowedDomains = Array.from(set);
        await StorageLocal.saveSettings(appSettings);
      }
    }

    renderDomainChips();
    currentSiteDomain.classList.toggle('disabled-domain', !enable);
    broadcastSettingsToTabs(appSettings);
    ensureActiveTabContentScript(appSettings);
    showToast(enable ? '✓ Botão ativado neste site' : '✗ Botão desativado neste site');
  });
}

// ── Eventos de Chips (Enter para adicionar, clique no X para remover) ──
if (allowedChipsList) {
  allowedChipsList.addEventListener('click', async (e) => {
    const btn = e.target.closest('.domain-chip-remove');
    if (!btn) return;
    const domain = btn.getAttribute('data-domain');
    if (!domain) return;
    appSettings.allowedDomains = (appSettings.allowedDomains || []).filter(d => d.toLowerCase() !== domain.toLowerCase());
    await StorageLocal.saveSettings(appSettings);
    renderDomainChips();
    await updateCurrentSiteToggleUI();
    broadcastSettingsToTabs(appSettings);
    ensureActiveTabContentScript(appSettings);
    showToast(`✓ Domínio ${domain} removido`);
  });
}

if (blockedChipsList) {
  blockedChipsList.addEventListener('click', async (e) => {
    const btn = e.target.closest('.domain-chip-remove');
    if (!btn) return;
    const domain = btn.getAttribute('data-domain');
    if (!domain) return;
    appSettings.blockedDomains = (appSettings.blockedDomains || []).filter(d => d.toLowerCase() !== domain.toLowerCase());
    await StorageLocal.saveSettings(appSettings);
    renderDomainChips();
    await updateCurrentSiteToggleUI();
    broadcastSettingsToTabs(appSettings);
    ensureActiveTabContentScript(appSettings);
    showToast(`✓ Domínio ${domain} desbloqueado`);
  });
}

if (inputAllowedDomains) {
  inputAllowedDomains.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const raw = inputAllowedDomains.value;
      if (!raw || !raw.trim()) return;

      const rawTokens = raw.split(/[\s,;]+/).map(t => t.trim()).filter(Boolean);
      if (rawTokens.length === 0) return;

      if (rawTokens.length === 1) {
        const clean = cleanDomainInput(rawTokens[0]);
        if (!clean) return;
        if (!clean.includes('.') && clean !== 'localhost') {
          showToast('⚠ Digite um domínio válido (ex: mangadex.org)');
          return;
        }
        const current = (appSettings.allowedDomains || []).map(d => d.toLowerCase());
        if (current.includes(clean)) {
          showToast(`ℹ ${clean} já está na lista`);
          inputAllowedDomains.value = '';
          return;
        }
        appSettings.allowedDomains = [...(appSettings.allowedDomains || []), clean];
        appSettings.enableFloatingButton = true;
        if (toggleFloatingButton) toggleFloatingButton.checked = true;
        updateToggleStatus(true);
        if (Array.isArray(appSettings.blockedDomains)) {
          appSettings.blockedDomains = appSettings.blockedDomains.filter(d => d.toLowerCase() !== clean);
        }
        await StorageLocal.saveSettings(appSettings);
        inputAllowedDomains.value = '';
        renderDomainChips();
        await updateCurrentSiteToggleUI();
        broadcastSettingsToTabs(appSettings);
        ensureActiveTabContentScript(appSettings);
        showToast(`✓ ${clean} adicionado aos permitidos`);
      } else {
        const currentSet = new Set((appSettings.allowedDomains || []).map(d => d.toLowerCase()));
        let addedCount = 0;
        const newDomains = [];
        for (const token of rawTokens) {
          const clean = cleanDomainInput(token);
          if (clean && (clean.includes('.') || clean === 'localhost') && !currentSet.has(clean)) {
            currentSet.add(clean);
            newDomains.push(clean);
            addedCount++;
          }
        }
        if (addedCount > 0) {
          appSettings.allowedDomains = [...(appSettings.allowedDomains || []), ...newDomains];
          appSettings.enableFloatingButton = true;
          if (toggleFloatingButton) toggleFloatingButton.checked = true;
          updateToggleStatus(true);
          if (Array.isArray(appSettings.blockedDomains)) {
            const addedSet = new Set(newDomains);
            appSettings.blockedDomains = appSettings.blockedDomains.filter(d => !addedSet.has(d.toLowerCase()));
          }
          await StorageLocal.saveSettings(appSettings);
          inputAllowedDomains.value = '';
          renderDomainChips();
          await updateCurrentSiteToggleUI();
          broadcastSettingsToTabs(appSettings);
          ensureActiveTabContentScript(appSettings);
          showToast(`✓ ${addedCount} domínios adicionados aos permitidos`);
        } else {
          showToast('ℹ Nenhum novo domínio válido para adicionar');
          inputAllowedDomains.value = '';
        }
      }
    }
  });
}

if (inputBlockedDomains) {
  inputBlockedDomains.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const raw = inputBlockedDomains.value;
      if (!raw || !raw.trim()) return;

      const rawTokens = raw.split(/[\s,;]+/).map(t => t.trim()).filter(Boolean);
      if (rawTokens.length === 0) return;

      if (rawTokens.length === 1) {
        const clean = cleanDomainInput(rawTokens[0]);
        if (!clean) return;
        if (!clean.includes('.') && clean !== 'localhost') {
          showToast('⚠ Digite um domínio válido (ex: youtube.com)');
          return;
        }
        const current = (appSettings.blockedDomains || []).map(d => d.toLowerCase());
        if (current.includes(clean)) {
          showToast(`ℹ ${clean} já está bloqueado`);
          inputBlockedDomains.value = '';
          return;
        }
        appSettings.blockedDomains = [...(appSettings.blockedDomains || []), clean];
        await StorageLocal.saveSettings(appSettings);
        inputBlockedDomains.value = '';
        renderDomainChips();
        await updateCurrentSiteToggleUI();
        broadcastSettingsToTabs(appSettings);
        ensureActiveTabContentScript(appSettings);
        showToast(`✓ ${clean} adicionado aos bloqueados`);
      } else {
        const currentSet = new Set((appSettings.blockedDomains || []).map(d => d.toLowerCase()));
        let addedCount = 0;
        const newDomains = [];
        for (const token of rawTokens) {
          const clean = cleanDomainInput(token);
          if (clean && (clean.includes('.') || clean === 'localhost') && !currentSet.has(clean)) {
            currentSet.add(clean);
            newDomains.push(clean);
            addedCount++;
          }
        }
        if (addedCount > 0) {
          appSettings.blockedDomains = [...(appSettings.blockedDomains || []), ...newDomains];
          await StorageLocal.saveSettings(appSettings);
          inputBlockedDomains.value = '';
          renderDomainChips();
          await updateCurrentSiteToggleUI();
          broadcastSettingsToTabs(appSettings);
          ensureActiveTabContentScript(appSettings);
          showToast(`✓ ${addedCount} domínios adicionados aos bloqueados`);
        } else {
          showToast('ℹ Nenhum novo domínio válido para bloquear');
          inputBlockedDomains.value = '';
        }
      }
    }
  });
}

inputSyncKey.addEventListener('change', persistSettings);

// ── Captura da aba atual ─────────────────────────────────
async function captureCurrentTab(onlySource = false) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || !tab.url.startsWith('http')) return;

    inputUrl.value = tab.url;
    const domain = StorageLocal.extractDomain(tab.url);
    if (!inputSiteName.value) {
      inputSiteName.value = StorageLocal.formatSiteName(domain);
    }
    const siteName = StorageLocal.formatSiteName(domain).toLowerCase();

    let detectedChapter = typeof StorageLocal.extractChapter === 'function'
      ? StorageLocal.extractChapter(tab.url, tab.title || '')
      : '';

    let detectedName = '';
    let detectedAliases = [];
    if (!onlySource && tab.title) {
      const cleanTitle = typeof StorageLocal.cleanWorkTitle === 'function'
        ? StorageLocal.cleanWorkTitle(tab.title)
        : '';
      if (cleanTitle && typeof StorageLocal !== 'undefined' && StorageLocal.extractDualTitles) {
        const dual = StorageLocal.extractDualTitles(cleanTitle);
        detectedName = dual.primary || cleanTitle;
        if (dual.aliases && dual.aliases.length > 0) detectedAliases.push(...dual.aliases);
      } else {
        detectedName = cleanTitle || tab.title.replace(/\s*[-–|·•]\s*.{0,40}$/, '').trim();
      }
    }

    // Preenchimento imediato inicial a partir dos dados da aba ativa (0ms de latência)
    if (!onlySource && detectedName && detectedName.toLowerCase() !== siteName && !inputTitle.value) {
      inputTitle.value = detectedName;
      if (inputAliases && detectedAliases.length > 0 && !inputAliases.value) {
        inputAliases.value = detectedAliases.join(', ');
      }
    }
    if (!inputChapter.value) {
      inputChapter.value = detectedChapter || 'Cap. 1';
    }

    // 1. Consulta o content script da aba ativa (que analisa o DOM completo da página em tempo real)
    try {
      let pageDetails = await new Promise(resolve => {
        chrome.tabs.sendMessage(tab.id, { action: 'getPageDetails' }, res => {
          if (chrome.runtime.lastError || !res || !res.ok) {
            resolve(null);
          } else {
            resolve(res);
          }
        });
      });

      // Se o content script não respondeu (ex: aba aberta antes da extensão carregar), injeta dinamicamente
      if (!pageDetails && chrome.scripting && chrome.scripting.executeScript) {
        const isAlreadyInjected = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => typeof window.StorageLocal !== 'undefined'
        }).then(res => res && res[0] && res[0].result).catch(() => false);

        if (!isAlreadyInjected) {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['canonical-resolver.js', 'alias-crowd-service.js', 'storage-local.js', 'content.js']
          }).catch(() => {});
        }

        pageDetails = await new Promise(resolve => {
          try {
            chrome.tabs.sendMessage(tab.id, { action: 'getPageDetails' }, res => {
              if (chrome.runtime?.lastError || !res || !res.ok) {
                resolve(null);
              } else {
                resolve(res);
              }
            });
          } catch (_) {
            resolve(null);
          }
        });

        // Se ainda não tiver resposta, extrai diretamente via script injetado no DOM
        if (!pageDetails) {
          const [execRes] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              const backBtn = document.querySelector('button[title^="Voltar para "], a[title^="Voltar para "], [title^="Voltar para "]');
              let domTitle = '';
              if (backBtn) {
                domTitle = backBtn.getAttribute('title').replace(/^Voltar\s+para\s+/i, '').trim();
              }
              if (!domTitle) {
                const mangaLink = document.querySelector('a[href*="/manga/"]');
                if (mangaLink && mangaLink.getAttribute('title')) {
                  domTitle = mangaLink.getAttribute('title').replace(/^Voltar\s+para\s+/i, '').trim();
                }
              }
              if (!domTitle) {
                const h1WithTitle = document.querySelector('h1[title]:not(.site-title):not(.logo):not([class*="site"]):not([class*="logo"])');
                if (h1WithTitle && !/verificacao\s+de\s+seguranca|security/i.test(h1WithTitle.getAttribute('title') || '')) {
                  domTitle = (h1WithTitle.getAttribute('title') || h1WithTitle.textContent || '').trim();
                }
              }
              if (!domTitle) {
                const domTitleEl = document.querySelector([
                  '.show-title-link', 'a.show-title-link', '[data-t="show-title-link"]',
                  '.manga-title a', '.series-title a', '.chapter-title-bar .manga-title a',
                  'h1.title', 'h1[data-t="title"]', 'h1.heading--nKNOf',
                  'h1.manga-title', 'h1.entry-title', 'h1.series-title', 'h1.post-title',
                  '.manga-title', '.series-title', '.novel-title', '[itemprop="name"]'
                ].join(', '));
                if (domTitleEl) domTitle = domTitleEl.textContent.trim();
              }
              const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';
              const chapterEl = document.querySelector([
                'select[name*="chapter"] option:checked', '#chapter-select option:checked',
                '.current-chapter', '.chapter-title', 'h1.chapter-title', '[class*="chapter-title"]'
              ].join(', '));
              let chapterText = chapterEl ? chapterEl.textContent.trim() : '';
              if (!chapterText) {
                const chSpan = Array.from(document.querySelectorAll('span, h2, div')).find(el => {
                  const txt = (el.textContent || '').trim();
                  return /^(?:cap[íi]tulo|cap\.?|ch\.?)\s*\d+/i.test(txt) && txt.length < 25;
                });
                if (chSpan) chapterText = chSpan.textContent.trim();
              }
              return {
                title: domTitle || (ogTitle.trim() || ''),
                chapterText
              };
            }
          }).catch(() => []);

          if (execRes && execRes.result) {
            pageDetails = {
              title: execRes.result.title,
              chapter: execRes.result.chapterText ? (typeof StorageLocal !== 'undefined' && StorageLocal.extractChapter ? StorageLocal.extractChapter(tab.url, tab.title || '', execRes.result.chapterText) : execRes.result.chapterText) : ''
            };
          }
        }
      }

      if (pageDetails) {
        if (pageDetails.title && pageDetails.title.toLowerCase() !== siteName && pageDetails.title !== 'Obra Desconhecida') {
          const cleanDomTitle = typeof StorageLocal.cleanWorkTitle === 'function' ? StorageLocal.cleanWorkTitle(pageDetails.title) : pageDetails.title;
          if (cleanDomTitle) detectedName = cleanDomTitle;
        }
        if (pageDetails.chapter) {
          detectedChapter = pageDetails.chapter;
        }
        if (Array.isArray(pageDetails.aliases) && pageDetails.aliases.length > 0) {
          detectedAliases = Array.from(new Set([...detectedAliases, ...pageDetails.aliases]));
        }
      }
    } catch (_) {}

    // 2. Se o nome ainda for genérico ou igual ao próprio site, consulta o resolvedor assíncrono para SPAs
    if (!detectedName || detectedName.toLowerCase() === siteName || /^(?:nexus|nexustoons|vegitoons|mang[aá]stop|mangadex|leitor|reader)$/i.test(detectedName)) {
      if (typeof StorageLocal.resolvePageWorkDetails === 'function') {
        const details = await StorageLocal.resolvePageWorkDetails(tab.url);
        if (details) {
          if (details.workName) detectedName = details.workName;
          if (details.chapter && !detectedChapter) detectedChapter = details.chapter;
        }
      }
    }

    // Extrai títulos alternativos se houver formato duplo no título detectado (ex: "Nome Principal (Nome Alternativo)" ou "Nome 1 / Nome 2")
    if (detectedName && typeof StorageLocal.extractDualTitles === 'function') {
      const dual = StorageLocal.extractDualTitles(detectedName);
      if (dual.primary) {
        detectedName = dual.primary;
      }
      if (Array.isArray(dual.aliases) && dual.aliases.length > 0) {
        detectedAliases = Array.from(new Set([...detectedAliases, ...dual.aliases]));
      }
    }

    const isAnimeSite = domain.includes('crunchyroll') || domain.includes('anime');

    if (detectedChapter) {
      inputChapter.value = detectedChapter;
    } else if (!inputChapter.value) {
      inputChapter.value = isAnimeSite ? 'Ep. 1' : 'Cap. 1';
    }

    if (!onlySource && detectedName && detectedName.toLowerCase() !== siteName) {
      inputTitle.value = detectedName;
      if (inputAliases && detectedAliases.length > 0 && !inputAliases.value) {
        inputAliases.value = detectedAliases.join(', ');
      }

      // Se estiver em modo nova obra, confere se já existe match nas obras salvas
      if (!editIdField.value) {
        let matchedWork = null;

        // A. Match por seriesUrl (ex: link de série da Crunchyroll na página de episódio)
        if (pageDetails && pageDetails.seriesUrl && Array.isArray(allWorks)) {
          const sUrlNorm = pageDetails.seriesUrl.toLowerCase();
          matchedWork = allWorks.find(w => !w.deleted && (w.sources || []).some(s => {
            if (!s.url) return false;
            const su = s.url.toLowerCase();
            return su === sUrlNorm || su.includes(sUrlNorm) || sUrlNorm.includes(su);
          }));
        }

        // B. Match por título e aliases via StorageLocal
        if (!matchedWork && typeof StorageLocal.findMatchingWork === 'function') {
          const match = StorageLocal.findMatchingWork(detectedName, allWorks);
          if (match && match.exactMatch) {
            matchedWork = match.exactMatch;
          }
        }

        // C. Match por aliases detectados na página
        if (!matchedWork && Array.isArray(detectedAliases) && detectedAliases.length > 0 && typeof StorageLocal.findMatchingWork === 'function') {
          for (const alias of detectedAliases) {
            const match = StorageLocal.findMatchingWork(alias, allWorks);
            if (match && match.exactMatch) {
              matchedWork = match.exactMatch;
              break;
            }
          }
        }

        if (matchedWork) {
          editIdField.value = matchedWork.id;
          inputTitle.value = matchedWork.name;
          inputTitle.readOnly = true;
          setActiveTag(matchedWork.tag || (isAnimeSite ? 'anime' : 'manga'));
          formTitle.textContent = `Atualizar: ${matchedWork.name}`;
          btnSave.textContent = 'Atualizar Obra';
          showToast(`✓ Obra reconhecida: ${matchedWork.name}`);
        } else if (isAnimeSite) {
          setActiveTag('anime');
        }
      }
    } else if (!editIdField.value && isAnimeSite) {
      setActiveTag('anime');
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
  const workName   = inputTitle.value.trim();
  const rawAliases = inputAliases ? inputAliases.value.trim() : '';
  const aliases    = rawAliases ? rawAliases.split(',').map(s => s.trim()).filter(Boolean) : [];
  const chapter    = inputChapter.value.trim();
  const url        = inputUrl.value.trim();
  const siteName   = inputSiteName.value.trim();
  const workId     = editIdField.value;

  if (!workName) { flash(inputTitle);   return; }
  if (!chapter)  { flash(inputChapter); return; }

  await StorageLocal.saveWorkReading({
    workId: workId || undefined,
    workName,
    aliases,
    chapter,
    url,
    siteName,
    tag: selectedTag,
    readingStatus: selectedReadingStatus,
    publicationStatus: selectedPubStatus,
    releaseDays: getSelectedReleaseDays()
  });

  allWorks = await StorageLocal.getWorks();
  showToast(workId ? '✓ Obra atualizada' : '✓ Obra salva com sucesso');
  closeForm();
  renderCurrentView();
});

function flash(input) {
  input.style.borderColor = '#ff5c5c';
  input.focus();
  setTimeout(() => input.style.borderColor = '', 800);
}

// ── Separação Automática de Títulos Duplos no Input ───────
inputTitle.addEventListener('blur', () => {
  if (inputTitle.readOnly) return;
  const val = inputTitle.value.trim();
  if (val && typeof StorageLocal !== 'undefined' && StorageLocal.extractDualTitles) {
    const dual = StorageLocal.extractDualTitles(val);
    if (dual.aliases && dual.aliases.length > 0) {
      inputTitle.value = dual.primary;
      if (inputAliases) {
        const currentAliases = inputAliases.value ? inputAliases.value.split(',').map(s => s.trim()).filter(Boolean) : [];
        const merged = Array.from(new Set([...currentAliases, ...dual.aliases]));
        inputAliases.value = merged.join(', ');
      }
    }
  }
});

// ── Delete Obra com Confirmação Segura ───────────────────
async function deleteWork(id) {
  await StorageLocal.deleteWork(id);
  allWorks = await StorageLocal.getWorks();
  renderCurrentView();
  showToast('✓ Obra removida');
}

function promptDeleteWork(work) {
  if (!work) return;
  pendingDeleteWorkId = work.id;
  if (confirmDeleteText) {
    confirmDeleteText.textContent = `Você tem certeza que deseja excluir "${work.name}" e todo seu histórico de leitura?`;
  }
  if (confirmDeleteModal) {
    confirmDeleteModal.classList.add('open');
  }
}

function closeDeleteModal() {
  pendingDeleteWorkId = null;
  if (confirmDeleteModal) {
    confirmDeleteModal.classList.remove('open');
  }
}

if (btnCancelDelete) {
  btnCancelDelete.addEventListener('click', closeDeleteModal);
}

if (confirmDeleteModal) {
  confirmDeleteModal.addEventListener('click', e => {
    if (e.target === confirmDeleteModal) closeDeleteModal();
  });
}

if (btnConfirmDelete) {
  btnConfirmDelete.addEventListener('click', async () => {
    if (pendingDeleteWorkId) {
      const id = pendingDeleteWorkId;
      closeDeleteModal();
      await deleteWork(id);
    }
  });
}

if (confirmActionModal) {
  confirmActionModal.addEventListener('click', e => {
    if (e.target === confirmActionModal) closeConfirmActionModal();
  });
}

if (btnCancelAction) {
  btnCancelAction.addEventListener('click', closeConfirmActionModal);
}

if (btnConfirmAction) {
  btnConfirmAction.addEventListener('click', async () => {
    const cb = pendingActionCallback;
    closeConfirmActionModal();
    if (typeof cb === 'function') await cb();
  });
}

// ── Delete Fonte Individual ──────────────────────────────
async function deleteSource(workId, sourceId) {
  await StorageLocal.deleteSource(workId, sourceId);
  allWorks = await StorageLocal.getWorks();
  renderCurrentView();
  showToast('Fonte removida');
}

// ── Helper: Verifica se a aba ativa corresponde à obra ─────────────
function isTabForWork(tab, work, pageDetails) {
  if (!tab || !tab.url || !work) return false;
  const tabUrl = tab.url.toLowerCase();
  const tabDomain = (typeof StorageLocal !== 'undefined' && StorageLocal.extractDomain ? StorageLocal.extractDomain(tab.url) : '').toLowerCase();

  const sources = Array.isArray(work.sources) ? work.sources : [];
  const domainMatches = sources.some(s => s.domain && s.domain.toLowerCase() === tabDomain);

  // 1. Match direto por URL de série detectada na página (ex: Crunchyroll /series/ link)
  if (pageDetails && pageDetails.seriesUrl) {
    const normSeriesUrl = pageDetails.seriesUrl.toLowerCase();
    const seriesMatches = sources.some(s => {
      if (!s.url) return false;
      const sUrl = s.url.toLowerCase();
      return sUrl === normSeriesUrl || sUrl.includes(normSeriesUrl) || normSeriesUrl.includes(sUrl);
    });
    if (seriesMatches) return true;
  }

  let tabTitle = (pageDetails && pageDetails.title) ? pageDetails.title : '';
  if (!tabTitle && tab.title) {
    tabTitle = (typeof StorageLocal !== 'undefined' && StorageLocal.cleanWorkTitle) ? StorageLocal.cleanWorkTitle(tab.title) : tab.title;
  }
  tabTitle = (tabTitle || '').trim();

  const normTabTitle = (typeof StorageLocal !== 'undefined' && StorageLocal.normalizeTitle) ? StorageLocal.normalizeTitle(tabTitle) : tabTitle.toLowerCase();
  const normWorkName = (typeof StorageLocal !== 'undefined' && StorageLocal.normalizeTitle) ? StorageLocal.normalizeTitle(work.name) : work.name.toLowerCase();

  const aliases = Array.isArray(work.aliases) ? work.aliases : [];
  const titleMatches = (normTabTitle && normWorkName && (
    normTabTitle === normWorkName ||
    normTabTitle.includes(normWorkName) ||
    normWorkName.includes(normTabTitle) ||
    (typeof StorageLocal !== 'undefined' && StorageLocal.calculateSimilarity && StorageLocal.calculateSimilarity(normTabTitle, normWorkName) >= 0.70)
  )) || aliases.some(a => {
    const na = (typeof StorageLocal !== 'undefined' && StorageLocal.normalizeTitle) ? StorageLocal.normalizeTitle(a) : a.toLowerCase();
    return normTabTitle === na || normTabTitle.includes(na) || na.includes(normTabTitle);
  });

  const pageAliases = (pageDetails && Array.isArray(pageDetails.aliases)) ? pageDetails.aliases : [];
  const aliasPageMatches = pageAliases.some(pAlias => {
    const pNorm = (typeof StorageLocal !== 'undefined' && StorageLocal.normalizeTitle) ? StorageLocal.normalizeTitle(pAlias) : pAlias.toLowerCase();
    return pNorm === normWorkName || aliases.some(a => {
      const na = (typeof StorageLocal !== 'undefined' && StorageLocal.normalizeTitle) ? StorageLocal.normalizeTitle(a) : a.toLowerCase();
      return pNorm === na;
    });
  });

  const slugMatches = sources.some(s => {
    if (!s.url) return false;
    try {
      const u = new URL(s.url);
      const parts = u.pathname.split('/').filter(p => p.length > 3 && !/^(?:watch|series|episodio|capitulo|manga|anime)$/i.test(p));
      return parts.some(p => tabUrl.includes(p.toLowerCase()) || (pageDetails && pageDetails.seriesUrl && pageDetails.seriesUrl.toLowerCase().includes(p.toLowerCase())));
    } catch (_) {
      return false;
    }
  });

  if (domainMatches && (titleMatches || aliasPageMatches || slugMatches || sources.length === 1)) {
    return true;
  }

  return titleMatches || aliasPageMatches;
}

// ── Quick Increment (+1) com Verificação de Link e Capítulo ─────────
let isIncrementingWork = false;

async function handleQuickIncrement(workId) {
  if (isIncrementingWork) return;
  isIncrementingWork = true;

  try {
    const work = (allWorks || []).find(w => w.id === workId);
    if (!work) return;

    const sources = Array.isArray(work.sources) ? work.sources : [];
    const activeSrc = sources.find(s => s.id === work.lastReadSourceId) || sources[0] || {};
    const savedChapter = activeSrc.chapter || work.mainChapter || 'Cap. 0';
    const nextCalculatedChapter = StorageLocal.parseChapterIncrement(savedChapter);

    // Consulta aba ativa do navegador
    let activeTab = null;
    let pageDetails = null;

    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      try {
        const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (t && t.url && (t.url.startsWith('http://') || t.url.startsWith('https://'))) {
          activeTab = t;
        }
      } catch (_) {}
    }

    // Se houver aba ativa, obtém detalhes da página
    if (activeTab) {
      try {
        pageDetails = await new Promise(resolve => {
          chrome.tabs.sendMessage(activeTab.id, { action: 'getPageDetails' }, res => {
            if (chrome.runtime.lastError || !res || !res.ok) resolve(null);
            else resolve(res);
          });
        });
      } catch (_) {}
    }

    const matchesWork = activeTab ? isTabForWork(activeTab, work, pageDetails) : false;

    if (matchesWork && activeTab) {
      let tabChapter = (pageDetails && pageDetails.chapter) ? pageDetails.chapter.trim() : '';
      if (!tabChapter && typeof StorageLocal.extractChapter === 'function') {
        tabChapter = StorageLocal.extractChapter(activeTab.url, activeTab.title || '');
      }

      if (tabChapter) {
        const diff = (typeof StorageLocal.compareChapters === 'function')
          ? StorageLocal.compareChapters(tabChapter, savedChapter)
          : 0;

        // Caso 1: O link e capítulo atual da página é MAIOR que o antigo
        if (diff > 0) {
          const tabDomain = StorageLocal.extractDomain(activeTab.url);
          const tabSiteName = StorageLocal.formatSiteName(tabDomain);
          const updated = await StorageLocal.quickIncrementWork(work.id, {
            chapter: tabChapter,
            url: activeTab.url,
            domain: tabDomain,
            siteName: tabSiteName
          });
          if (updated) {
            allWorks = await StorageLocal.getWorks();
            renderCurrentView();
            showToast(`✓ Atualizado: ${tabChapter}`);
          }
          return;
        }

        // Caso 2: O capítulo atual da página é IGUAL ao antigo já salvo
        if (diff === 0) {
          showConfirmActionModal({
            title: 'Capítulo Atual Igual',
            message: `A página atual da aba (${tabChapter}) não é maior que o capítulo já salvo (${savedChapter}). Deseja somar +1 para ${nextCalculatedChapter} mesmo assim?`,
            confirmText: 'Sim, somar +1',
            onConfirm: async () => {
              const updated = await StorageLocal.quickIncrementWork(work.id);
              if (updated) {
                allWorks = await StorageLocal.getWorks();
                renderCurrentView();
                showToast(`✓ ${updated.mainChapter}`);
              }
            }
          });
          return;
        }

        // Caso 3: O capítulo atual da página é MENOR que o antigo salvo
        if (diff < 0) {
          showConfirmActionModal({
            title: 'Capítulo Atual Menor',
            message: `Aviso: A página atual da aba (${tabChapter}) é menor que o capítulo salvo (${savedChapter}). Deseja avançar para ${nextCalculatedChapter} mesmo assim?`,
            confirmText: 'Sim, avançar',
            onConfirm: async () => {
              const updated = await StorageLocal.quickIncrementWork(work.id);
              if (updated) {
                allWorks = await StorageLocal.getWorks();
                renderCurrentView();
                showToast(`✓ ${updated.mainChapter}`);
              }
            }
          });
          return;
        }
      } else {
        // Aba é da obra mas não detectou capítulo específico (ex: página inicial/índice)
        showConfirmActionModal({
          title: 'Página de Capítulos',
          message: `Você está na página de "${work.name}". Deseja somar +1 (${savedChapter} ➔ ${nextCalculatedChapter})?`,
          confirmText: 'Somar +1',
          onConfirm: async () => {
            const updated = await StorageLocal.quickIncrementWork(work.id);
            if (updated) {
              allWorks = await StorageLocal.getWorks();
              renderCurrentView();
              showToast(`✓ ${updated.mainChapter}`);
            }
          }
        });
        return;
      }
    } else if (activeTab) {
      // Aba ativa não corresponde à obra selecionada
      showConfirmActionModal({
        title: 'Aba Diferente da Obra',
        message: `A aba atual não corresponde a "${work.name}". Deseja somar +1 (${savedChapter} ➔ ${nextCalculatedChapter}) mesmo assim?`,
        confirmText: 'Somar +1',
        onConfirm: async () => {
          const updated = await StorageLocal.quickIncrementWork(work.id);
          if (updated) {
            allWorks = await StorageLocal.getWorks();
            renderCurrentView();
            showToast(`✓ ${updated.mainChapter}`);
          }
        }
      });
      return;
    }

    // Se não há aba ativa no navegador, incrementa diretamente
    const updated = await StorageLocal.quickIncrementWork(work.id);
    if (updated) {
      allWorks = await StorageLocal.getWorks();
      renderCurrentView();
      showToast(`✓ ${updated.mainChapter}`);
    }
  } finally {
    isIncrementingWork = false;
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
      renderCurrentView();
      showToast(`✓ ${count} obras importadas com sucesso!`);
    } catch (err) {
      showToast('Arquivo de backup inválido');
    }
    fileImportBackup.value = '';
  };
  reader.readAsText(file);
});

// ── Termos de Uso do Yekun Cloud PRO ─────────────────────
const CURRENT_PRO_TERMS_VERSION = '1.0';
const PRO_TERMS_STORAGE_KEY = 'pro_terms_acceptance';

const modalProTerms       = document.getElementById('modalProTerms');
const proTermsBody        = document.getElementById('proTermsBody');
const chkProTermsAccept   = document.getElementById('chkProTermsAccept');
const btnAcceptProTerms   = document.getElementById('btnAcceptProTerms');
const btnCancelProTerms   = document.getElementById('btnCancelProTerms');
const btnReadProTerms     = document.getElementById('btnReadProTerms');
const proTermsVersionLbl  = document.getElementById('proTermsVersionLabel');

async function isProTermsAccepted() {
  try {
    const data = await new Promise(resolve => {
      chrome.storage.local.get([PRO_TERMS_STORAGE_KEY], items => resolve(items || {}));
    });
    const rec = data[PRO_TERMS_STORAGE_KEY];
    return !!(rec && rec.version === CURRENT_PRO_TERMS_VERSION && rec.accepted_at);
  } catch (e) {
    return false;
  }
}

async function recordProTermsAcceptance() {
  const email = (appSettings && appSettings.proEmail) || '';
  const rec = {
    version: CURRENT_PRO_TERMS_VERSION,
    accepted_at: new Date().toISOString(),
    email
  };
  await new Promise(resolve => {
    chrome.storage.local.set({ [PRO_TERMS_STORAGE_KEY]: rec }, () => resolve());
  });
  return rec;
}

let pendingProTermsAction = null;
function openProTermsModal({ readOnly = false, onAccept = null } = {}) {
  if (!modalProTerms) return;
  pendingProTermsAction = readOnly ? null : onAccept;
  const box = modalProTerms.querySelector('.modal-terms-box');
  if (box) {
    box.classList.toggle('readonly', !!readOnly);
  }
  if (chkProTermsAccept) chkProTermsAccept.checked = false;
  if (btnAcceptProTerms) btnAcceptProTerms.disabled = true;
  if (proTermsBody) proTermsBody.scrollTop = 0;
  if (proTermsVersionLbl) {
    proTermsVersionLbl.textContent = `Versão ${CURRENT_PRO_TERMS_VERSION} — vigente desde 15/10/2026`;
  }
  if (btnCancelProTerms) {
    btnCancelProTerms.textContent = readOnly ? 'Fechar' : 'Cancelar';
  }
  modalProTerms.classList.add('open');
}
function closeProTermsModal() {
  if (modalProTerms) modalProTerms.classList.remove('open');
  pendingProTermsAction = null;
}

async function requireProTermsAccepted(action) {
  if (await isProTermsAccepted()) {
    return action();
  }
  openProTermsModal({
    onAccept: async () => {
      await recordProTermsAcceptance();
      return action();
    }
  });
  return null;
}

if (chkProTermsAccept && btnAcceptProTerms) {
  chkProTermsAccept.addEventListener('change', () => {
    btnAcceptProTerms.disabled = !chkProTermsAccept.checked;
  });
}
if (btnAcceptProTerms) {
  btnAcceptProTerms.addEventListener('click', async () => {
    if (!chkProTermsAccept || !chkProTermsAccept.checked) return;
    const action = pendingProTermsAction;
    closeProTermsModal();
    if (typeof action === 'function') {
      try { await action(); } catch (e) { showToast('Erro ao continuar operação'); }
    }
  });
}
if (btnCancelProTerms) {
  btnCancelProTerms.addEventListener('click', () => {
    const wasPending = !!pendingProTermsAction;
    closeProTermsModal();
    if (wasPending) showToast('Ação cancelada: aceite dos termos é obrigatório');
  });
}
if (btnReadProTerms) {
  btnReadProTerms.addEventListener('click', () => {
    openProTermsModal({ readOnly: true });
  });
}

// ── Sincronizar Agora ────────────────────────────────────
btnSyncNow.addEventListener('click', () => requireProTermsAccepted(async () => {
  await persistSettings();
  showToast('Iniciando sincronização…');
  try {
    if (chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ action: 'syncNow' }, async response => {
        if (response && response.ok) {
          showToast('✓ Sincronizado com sucesso!');
          allWorks = await StorageLocal.getWorks();
          renderCurrentView();
          const freshSettings = await StorageLocal.getSettings();
          appSettings = freshSettings;
          loadSettingsToUI(appSettings);
        } else {
          showToast(response && response.error ? response.error : 'Sincronização concluída');
        }
      });
    }
  } catch (e) {
    showToast('Erro na sincronização');
  }
}));

// ── Modal de Verificação 2FA (TOTP) no Login ──────────────
let pendingTotpLoginResolve = null;
let pendingTotpLoginEmail = '';

function openTotpLoginModal(email) {
  return new Promise(resolve => {
    pendingTotpLoginResolve = resolve;
    pendingTotpLoginEmail = email || '';
    if (totpLoginDesc) {
      totpLoginDesc.innerHTML = `Esta conta possui proteção 2FA ativa. Digite o código de 6 dígitos gerado no <strong>Google Authenticator</strong> para autorizar o login de <strong>${email}</strong>.`;
    }
    if (inputTotpLoginCode) {
      inputTotpLoginCode.value = '';
    }
    if (modalTotpLogin) {
      modalTotpLogin.classList.add('open');
      setTimeout(() => { if (inputTotpLoginCode) inputTotpLoginCode.focus(); }, 120);
    }
  });
}

function closeTotpLoginModal(success = false) {
  if (modalTotpLogin) {
    modalTotpLogin.classList.remove('open');
  }
  if (pendingTotpLoginResolve) {
    pendingTotpLoginResolve(success);
    pendingTotpLoginResolve = null;
  }
}

if (btnCancelTotpLogin) {
  btnCancelTotpLogin.addEventListener('click', () => closeTotpLoginModal(false));
}

if (modalTotpLogin) {
  modalTotpLogin.addEventListener('click', (e) => {
    if (e.target === modalTotpLogin) closeTotpLoginModal(false);
  });
}

if (btnConfirmTotpLogin) {
  btnConfirmTotpLogin.addEventListener('click', async () => {
    const code = inputTotpLoginCode ? inputTotpLoginCode.value.trim() : '';
    if (!code || code.length !== 6) {
      showToast('⚠️ Digite o código de 6 dígitos');
      if (inputTotpLoginCode) inputTotpLoginCode.focus();
      return;
    }
    const config = getSupabaseConfig();
    const res = await IdentityService.verifyTotpLogin(config, pendingTotpLoginEmail, code);
    if (res && res.success) {
      showToast('✓ 2FA verificado com sucesso!');
      closeTotpLoginModal(true);
    } else {
      showToast('⚠️ ' + ((res && res.error) || 'Código 2FA incorreto'));
      if (inputTotpLoginCode) {
        inputTotpLoginCode.value = '';
        inputTotpLoginCode.focus();
      }
    }
  });
}

if (inputTotpLoginCode) {
  inputTotpLoginCode.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (btnConfirmTotpLogin) btnConfirmTotpLogin.click();
    } else if (e.key === 'Escape') {
      closeTotpLoginModal(false);
    }
  });
}

async function triggerAutoSyncOnConnect(email) {
  if (typeof SyncService === 'undefined' || !SyncService.syncAll) return;
  try {
    showToast('Sincronizando obras e preferências da nuvem…');
    const res = await SyncService.syncAll();
    if (res && res.ok) {
      allWorks = await StorageLocal.getWorks();
      renderCurrentView();
      const freshSettings = await StorageLocal.getSettings();
      appSettings = freshSettings;
      loadSettingsToUI(appSettings);
      const count = res.pulled || 0;
      showToast(count > 0 ? `✓ Sincronizado! ${count} obras carregadas da nuvem.` : '✓ Sincronização concluída!');
    }
  } catch (err) {
    console.debug('[Sync] Falha no auto-pull ao conectar:', err.message);
  }
}

const btnConnectGoogle = document.getElementById('btnConnectGoogle');
if (btnConnectGoogle) {
  btnConnectGoogle.addEventListener('click', () => requireProTermsAccepted(async () => {
    showToast('Conectando conta Google do navegador…');
    try {
      let res = await IdentityService.signInWithGoogleBrowserFlow();
      if (!res || !res.email) {
        const info = await IdentityService.getGoogleIdentityInfo();
        if (info && info.email) {
          res = { success: true, email: info.email, source: 'google' };
        }
      }

      if (res && res.success && res.email) {
        const config = getSupabaseConfig();
        // Se a conta tem 2FA ativado, exige validação antes de autenticar
        const needsTotp = await IdentityService.isTotpRequiredForEmail(config, res.email);
        if (needsTotp) {
          const authorized = await openTotpLoginModal(res.email);
          if (!authorized) {
            await IdentityService.signOutGoogle();
            showToast('Login cancelado: 2FA não confirmado');
            return;
          }
        }

        if (inputCustomProEmail) {
          inputCustomProEmail.value = res.email;
        }
        setProEmailEditingMode(false);

        const lastDisconnected = await IdentityService.getLastDisconnectedEmail();
        const isDifferentAccount = Boolean(lastDisconnected && lastDisconnected !== res.email);

        await IdentityService.setCustomProEmail(res.email, 'google');

        const status = await IdentityService.checkProStatus(config, true);
        await updateProStatusUI(true);
        showToast('✓ Conectado como ' + res.email + (status && status.isPro ? ' (PRO Ativo)' : ''));

        if (isDifferentAccount) {
          await IdentityService.clearLastDisconnectedEmail();
          openSyncAccountPrompt(res.email);
        } else {
          appSettings.syncKey = res.email;
          await StorageLocal.saveSettings(appSettings);
          await triggerAutoSyncOnConnect(res.email);
        }
      } else if (res && res.needsInput) {
        setProEmailEditingMode(true);
        if (inputCustomProEmail) inputCustomProEmail.focus();
        showToast('Nenhuma conta Google detectada. Digite seu e-mail e clique no botão Salvar.');
      } else {
        showToast('⚠️ ' + ((res && res.error) || 'Não foi possível conectar a conta Google.'));
      }
    } catch (e) {
      console.warn('[PRO] Erro ao conectar conta Google:', e);
      showToast('Erro ao conectar conta Google');
    }
  }));
}

if (btnVerifyPro) {
  btnVerifyPro.addEventListener('click', async () => {
    showToast('Verificando assinatura…');
    await updateProStatusUI(true);
    showToast('Status atualizado');
  });
}

// ── Modal PRO: step indicator + fluxo de 3 fases ──────────
const PRO_POLL_INTERVAL_MS = 10000;
const PRO_POLL_MAX_MS = 10 * 60 * 1000;

let proPollTimer = null;
let proPollDeadline = 0;

function isProDevMode() {
  try {
    return localStorage.getItem('yekun_dev') === '1'
        || window.location.search.includes('dev=1');
  } catch (_) { return false; }
}

function goToProStep(step) {
  if (!modalProPix) return;
  const panels = modalProPix.querySelectorAll('.pro-step-panel');
  panels.forEach(p => p.classList.remove('active'));
  const panel = modalProPix.querySelector('#proStepPanel' + step);
  if (panel) panel.classList.add('active');
  const steps = modalProPix.querySelectorAll('.pro-step');
  steps.forEach(el => {
    const n = Number(el.dataset.step || 0);
    el.classList.toggle('done', n < step);
    el.classList.toggle('active', n === step);
  });
}

function stopProPolling() {
  if (proPollTimer) {
    clearInterval(proPollTimer);
    proPollTimer = null;
  }
  proPollDeadline = 0;
}

async function startProPolling() {
  stopProPolling();
  proPollDeadline = Date.now() + PRO_POLL_MAX_MS;
  const config = {
    supabaseUrl: (appSettings && appSettings.supabaseUrl) || 'https://wbappdsgstzintgznikb.supabase.co',
    supabaseKey: (appSettings && appSettings.supabaseKey) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndiYXBwZHNnc3R6aW50Z3puaWtiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5MTgyMDgsImV4cCI6MjEwNzQ5NDIwOH0.6Wc7YDcKpMCq_IWeo54f3U_14giEfjOAH3f5B019vfE'
  };
  const checkNow = async () => {
    try {
      const idInfo = await IdentityService.getIdentityInfo();
      const email = idInfo && idInfo.email ? idInfo.email.trim().toLowerCase() : '';

      // 1. Se houver uma cobranca ativa em andamento, consulta diretamente claimChargeCredentials
      if (currentChargeId && email) {
        const claimRes = await IdentityService.claimChargeCredentials(config, email, currentChargeId);
        if (claimRes && claimRes.isPaid && claimRes.isPro) {
          stopProPolling();
          if (proSuccessValidUntil && claimRes.validUntil) {
            const d = new Date(Number(claimRes.validUntil));
            proSuccessValidUntil.textContent = d.toLocaleDateString('pt-BR');
          }
          if (proSuccessPin) {
            proSuccessPin.value = claimRes.accessPin || '------';
          }
          if (proSuccessRecovery) {
            proSuccessRecovery.value = claimRes.recoveryKey || 'YK------';
          }
          goToProStep(3);
          await updateProStatusUI(true);
          showToast('✓ Pagamento confirmado! Assinatura PRO ativada.');
          return;
        }
      }

      // 2. Fallback: consulta generica de status PRO
      const status = await IdentityService.checkProStatus(config, true);
      if (status && status.isPro) {
        stopProPolling();
        if (proSuccessValidUntil && status.validUntil) {
          const d = new Date(Number(status.validUntil));
          proSuccessValidUntil.textContent = d.toLocaleDateString('pt-BR');
        }
        const creds = await IdentityService.getStoredCredentials();
        if (proSuccessPin) {
          proSuccessPin.value = creds.accessPin || status.accessPin || '------';
        }
        if (proSuccessRecovery) {
          proSuccessRecovery.value = creds.recoveryKey || status.recoveryKey || 'YK------';
        }
        goToProStep(3);
        await updateProStatusUI(true);
        return;
      }
    } catch (_) {}
    if (Date.now() > proPollDeadline) {
      stopProPolling();
      showToast('Confirmação demorou mais que o esperado. Reabra o modal pra tentar de novo.');
    }
  };
  await checkNow();
  if (!proPollTimer && Date.now() < proPollDeadline) {
    proPollTimer = setInterval(checkNow, PRO_POLL_INTERVAL_MS);
  }
}

let currentChargeId = null;
let currentBrCode = '';

async function openProModal() {
  if (!modalProPix) return;

  const idInfo = await IdentityService.getIdentityInfo();
  const email = idInfo && idInfo.email ? idInfo.email.trim().toLowerCase() : '';
  if (!email) {
    showToast('⚠️ Conecte sua conta Google antes de assinar o PRO');
    if (btnConnectGoogle) {
      btnConnectGoogle.focus();
      btnConnectGoogle.classList.add('highlight-pulse');
      setTimeout(() => btnConnectGoogle.classList.remove('highlight-pulse'), 1600);
    }
    return;
  }

  currentChargeId = null;
  currentBrCode = '';
  if (proPixBrCode) {
    proPixBrCode.value = '';
    proPixBrCode.placeholder = 'Gerando Pix dinâmico do gateway…';
  }
  const proDevmodeNotice = document.getElementById('proDevmodeNotice');
  if (proDevmodeNotice) proDevmodeNotice.classList.add('hidden');
  if (btnSimulatePayment) {
    btnSimulatePayment.style.display = isProDevMode() ? 'inline-flex' : 'none';
  }
  goToProStep(1);
  modalProPix.classList.add('open');
  const modalBox = modalProPix.querySelector('.modal-pro-box');
  if (modalBox) modalBox.scrollTop = 0;
  modalProPix.scrollTop = 0;

  try {
    const supabaseUrl = appSettings && appSettings.supabaseUrl ? appSettings.supabaseUrl : 'https://wbappdsgstzintgznikb.supabase.co';
    const supabaseKey = appSettings && appSettings.supabaseKey ? appSettings.supabaseKey : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndiYXBwZHNnc3R6aW50Z3puaWtiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5MTgyMDgsImV4cCI6MjEwNzQ5NDIwOH0.6Wc7YDcKpMCq_IWeo54f3U_14giEfjOAH3f5B019vfE';
    if (email && supabaseUrl) {
      const res = await fetch(`${supabaseUrl}/functions/v1/create-pro-charge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify({ email, name: email.split('@')[0] })
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && data.brCode) {
          currentChargeId = data.chargeId || null;
          currentBrCode = data.brCode || '';
          if (proPixBrCode) proPixBrCode.value = data.brCode;
          if (proPixQrImg) {
            if (data.brCodeBase64) {
              proPixQrImg.src = data.brCodeBase64.startsWith('data:') ? data.brCodeBase64 : `data:image/png;base64,${data.brCodeBase64}`;
            } else if (data.brCode && typeof qrcode !== 'undefined') {
              try {
                const qr = qrcode(0, 'M');
                qr.addData(data.brCode);
                qr.make();
                proPixQrImg.src = qr.createDataURL(4, 4);
              } catch (_) {}
            }
          }

          const isDev = data.brCode.includes('devmode') || isProDevMode();
          if (isDev) {
            if (proDevmodeNotice) proDevmodeNotice.classList.remove('hidden');
            if (btnSimulatePayment) btnSimulatePayment.style.display = 'inline-flex';
          }
        } else {
          if (proPixBrCode) proPixBrCode.placeholder = 'Erro: ' + ((data && data.error) || 'Tente novamente.');
        }
      } else {
        if (proPixBrCode) proPixBrCode.placeholder = 'Gateway indisponível no momento.';
      }
    } else {
      if (proPixBrCode) proPixBrCode.placeholder = 'Informe um e-mail antes de assinar.';
      showToast('Defina um e-mail antes de assinar o PRO');
    }
  } catch (err) {
    console.warn('[PRO] Falha ao carregar Pix dinâmico:', err);
    if (proPixBrCode) proPixBrCode.placeholder = 'Erro de rede ao gerar cobrança.';
  }
}

function closeProModal() {
  if (!modalProPix) return;
  stopProPolling();
  modalProPix.classList.remove('open');
}

if (btnOpenProModal) {
  btnOpenProModal.addEventListener('click', () => requireProTermsAccepted(async () => {
    const idInfo = await IdentityService.getIdentityInfo();
    const email = idInfo && idInfo.email ? idInfo.email.trim().toLowerCase() : '';
    if (!email) {
      showToast('⚠️ Conecte sua conta Google antes de assinar o PRO');
      if (btnConnectGoogle) {
        btnConnectGoogle.focus();
        btnConnectGoogle.classList.add('highlight-pulse');
        setTimeout(() => btnConnectGoogle.classList.remove('highlight-pulse'), 1600);
      }
      return;
    }
    openProModal();
  }));
}
if (btnCloseProModal) btnCloseProModal.addEventListener('click', closeProModal);
const btnCloseProModalHeader = document.getElementById('btnCloseProModalHeader');
if (btnCloseProModalHeader) btnCloseProModalHeader.addEventListener('click', closeProModal);
if (btnCloseSuccess)  btnCloseSuccess.addEventListener('click', closeProModal);
if (btnCancelWaiting) btnCancelWaiting.addEventListener('click', () => { stopProPolling(); goToProStep(1); });

if (modalProPix) {
  modalProPix.addEventListener('click', (e) => {
    if (e.target === modalProPix) closeProModal();
  });
}

if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (modalProPix && modalProPix.classList.contains('open')) closeProModal();
      if (modalVerifyProAccess && modalVerifyProAccess.classList.contains('open')) closeVerifyProAccessModal();
      if (modalSyncAccountPrompt && modalSyncAccountPrompt.classList.contains('open')) closeSyncAccountPrompt();
    }
  });
}

if (btnAlreadyPaid) {
  btnAlreadyPaid.addEventListener('click', () => {
    goToProStep(2);
    startProPolling();
  });
}

if (btnSimulatePayment) {
  btnSimulatePayment.addEventListener('click', async () => {
    showToast('⚡ [DEV] Simulando confirmação do pagamento…');
    try {
      const supabaseUrl = appSettings && appSettings.supabaseUrl ? appSettings.supabaseUrl : 'https://wbappdsgstzintgznikb.supabase.co';
      const supabaseKey = appSettings && appSettings.supabaseKey ? appSettings.supabaseKey : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndiYXBwZHNnc3R6aW50Z3puaWtiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5MTgyMDgsImV4cCI6MjEwNzQ5NDIwOH0.6Wc7YDcKpMCq_IWeo54f3U_14giEfjOAH3f5B019vfE';
      const idInfo = await IdentityService.getIdentityInfo();
      const email = (idInfo && idInfo.email ? idInfo.email.trim().toLowerCase() : '') || 'dev@yekun.app';
      const chargeId = currentChargeId || ('dev_charge_' + Date.now());

      let approved = false;
      let serverData = null;

      if (supabaseUrl && supabaseKey) {
        // 1. Tenta RPC simulate_dev_payment
        try {
          const simRes = await fetch(`${supabaseUrl}/rest/v1/rpc/simulate_dev_payment`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`
            },
            body: JSON.stringify({ p_gateway_charge_id: chargeId })
          });
          if (simRes.ok) {
            serverData = await simRes.json();
            if (serverData && serverData.success) approved = true;
          }
        } catch (_) {}

        // 2. Fallback: approve_from_gateway (compatível com a base Supabase ativa)
        if (!approved) {
          try {
            const appRes = await fetch(`${supabaseUrl}/rest/v1/rpc/approve_from_gateway`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
              },
              body: JSON.stringify({
                p_gateway: 'abacatepay',
                p_gateway_charge_id: chargeId,
                p_amount_paid: 20,
                p_approved_by: 'dev_simulator'
              })
            });
            if (appRes.ok) {
              serverData = await appRes.json();
              if (serverData && serverData.success) approved = true;
            }
          } catch (_) {}
        }
      }

      const validUntil = (serverData && serverData.valid_until) ? Number(serverData.valid_until) : (Date.now() + 365 * 24 * 60 * 60 * 1000);
      const pin = (serverData && serverData.access_pin) || '123456';
      const recovery = (serverData && serverData.recovery_key) || 'YK-TEST-DEV-8899';

      await IdentityService.saveStoredCredentials({
        accessPin: pin,
        recoveryKey: recovery
      });

      await IdentityService.saveCachedProStatus({
        isPro: true,
        email,
        source: (idInfo && idInfo.source) || 'google',
        needsPin: false,
        daysLeft: 365,
        validUntil,
        plan: 'annual',
        accessPin: pin,
        recoveryKey: recovery,
        cached: false
      });

      stopProPolling();

      if (proSuccessValidUntil) {
        const d = new Date(validUntil);
        proSuccessValidUntil.textContent = d.toLocaleDateString('pt-BR');
      }
      if (proSuccessPin) {
        proSuccessPin.value = pin;
      }
      if (proSuccessRecovery) {
        proSuccessRecovery.value = recovery;
      }

      goToProStep(3);
      await updateProStatusUI(true);
      showToast('✓ [DEV] Pagamento simulado com sucesso! PRO ativado.');
    } catch (err) {
      console.warn('[DEV] Erro na simulação:', err);
      stopProPolling();
      goToProStep(3);
      await updateProStatusUI(true);
      showToast('✓ [DEV] Simulação concluída localmente.');
    }
  });
}

if (btnCopyProBrCode && proPixBrCode) {
  btnCopyProBrCode.addEventListener('click', () => {
    if (!proPixBrCode.value) {
      showToast('Aguarde o código Pix ser gerado…');
      return;
    }
    navigator.clipboard.writeText(proPixBrCode.value).then(() => {
      showToast('✓ Pix Copia-e-Cola copiado! Cole no app do seu banco.');
    }).catch(() => showToast('Erro ao copiar código'));
  });
}

if (btnEditProEmail && inputCustomProEmail) {
  btnEditProEmail.addEventListener('click', async () => {
    const isCurrentlyEditing = inputCustomProEmail.classList.contains('is-editing');
    if (!isCurrentlyEditing) {
      setProEmailEditingMode(true);
    } else {
      setProEmailEditingMode(false);
      const info = await IdentityService.getIdentityInfo();
      inputCustomProEmail.value = (info && info.email) || '';
    }
  });
}

// ── Modal de Autorização PRO para novos acessos manuais ──
let pendingVerifyEmail = '';
function openVerifyProAccessModal(email) {
  pendingVerifyEmail = email;
  if (verifyProAccessEmailDesc) {
    verifyProAccessEmailDesc.textContent = `A conta "${email}" possui assinatura PRO ativa. Digite o PIN de 6 dígitos ou sua Chave Mestra para liberar o acesso neste dispositivo:`;
  }
  if (inputVerifyProSecret) {
    inputVerifyProSecret.value = '';
    setTimeout(() => {
      if (typeof inputVerifyProSecret.focus === 'function') inputVerifyProSecret.focus();
    }, 80);
  }
  if (modalVerifyProAccess) {
    modalVerifyProAccess.classList.add('open');
  }
}
function closeVerifyProAccessModal() {
  if (modalVerifyProAccess) {
    modalVerifyProAccess.classList.remove('open');
  }
  pendingVerifyEmail = '';
}
if (btnCancelVerifyPro) {
  btnCancelVerifyPro.addEventListener('click', closeVerifyProAccessModal);
}
if (modalVerifyProAccess) {
  modalVerifyProAccess.addEventListener('click', (e) => {
    if (e.target === modalVerifyProAccess) closeVerifyProAccessModal();
  });
}
if (btnConfirmVerifyPro) {
  btnConfirmVerifyPro.addEventListener('click', async () => {
    const secret = inputVerifyProSecret ? inputVerifyProSecret.value.trim() : '';
    if (!secret) {
      showToast('Digite o PIN de 6 dígitos ou a Chave Mestra');
      return;
    }
    showToast('Validando autorização…');
    const config = getSupabaseConfig();
    const verifiedEmail = pendingVerifyEmail;
    const res = await IdentityService.verifyProAccess(config, verifiedEmail, secret);
    if (res.success) {
      closeVerifyProAccessModal();
      const lastDisconnected = await IdentityService.getLastDisconnectedEmail();
      const isDifferentAccount = Boolean(lastDisconnected && lastDisconnected !== verifiedEmail);
      await IdentityService.setCustomProEmail(verifiedEmail);
      appSettings.syncKey = verifiedEmail;
      await StorageLocal.saveSettings(appSettings);
      setProEmailEditingMode(false);
      await updateProStatusUI(true);
      showToast('✓ PRO autorizado com sucesso neste dispositivo!');
      if (isDifferentAccount) {
        await IdentityService.clearLastDisconnectedEmail();
        openSyncAccountPrompt(verifiedEmail);
      } else {
        await triggerAutoSyncOnConnect(verifiedEmail);
      }
    } else {
      showToast('⚠️ ' + (res.error || 'PIN ou Chave incorreta'));
    }
  });
}

if (inputVerifyProSecret) {
  inputVerifyProSecret.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (btnConfirmVerifyPro) btnConfirmVerifyPro.click();
    } else if (e.key === 'Escape') {
      closeVerifyProAccessModal();
    }
  });
}

if (btnSaveCustomProEmail && inputCustomProEmail) {
  btnSaveCustomProEmail.addEventListener('click', () => requireProTermsAccepted(async () => {
    const email = IdentityService.normalizeEmail(inputCustomProEmail.value);
    if (!email || !email.includes('@')) {
      showToast('Informe um e-mail válido');
      return;
    }

    const config = getSupabaseConfig();
    let totpAuthenticated = false;
    const needsTotp = await IdentityService.isTotpRequiredForEmail(config, email);
    if (needsTotp) {
      const authorized = await openTotpLoginModal(email);
      if (!authorized) {
        showToast('Login cancelado: 2FA não confirmado');
        return;
      }
      totpAuthenticated = true;
    }

    showToast('Verificando conta…');

    try {
      if (config.supabaseUrl && config.supabaseKey) {
        const checkRes = await fetch(`${config.supabaseUrl}/rest/v1/rpc/check_pro_status`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': config.supabaseKey,
            'Authorization': `Bearer ${config.supabaseKey}`
          },
          body: JSON.stringify({ p_email: email })
        });
        if (checkRes.ok) {
          const checkData = await checkRes.json();
          if (checkData && checkData.isPro) {
            const creds = await IdentityService.getStoredCredentials();
            const hasTotpAuth = totpAuthenticated || Boolean(creds.totpSecret && (!creds.totpEmail || creds.totpEmail.trim().toLowerCase() === email));
            if (hasTotpAuth || creds.accessPin || creds.recoveryKey) {
              if (!hasTotpAuth && (creds.accessPin || creds.recoveryKey)) {
                const vRes = await IdentityService.verifyProAccess(config, email, creds.accessPin || creds.recoveryKey);
                if (!vRes.success) {
                  openVerifyProAccessModal(email);
                  return;
                }
              }
              const lastDisconnected = await IdentityService.getLastDisconnectedEmail();
              const isDifferentAccount = Boolean(lastDisconnected && lastDisconnected !== email);
              await IdentityService.setCustomProEmail(email);
              appSettings.syncKey = email;
              await StorageLocal.saveSettings(appSettings);
              setProEmailEditingMode(false);
              await updateProStatusUI(true);
              showToast('Conta conectada e PRO verificado: ' + email);
              if (isDifferentAccount) {
                await IdentityService.clearLastDisconnectedEmail();
                openSyncAccountPrompt(email);
              } else {
                await triggerAutoSyncOnConnect(email);
              }
              return;
            }
            openVerifyProAccessModal(email);
            return;
          }
        }
      }
    } catch (_) {}

    const lastDisconnected = await IdentityService.getLastDisconnectedEmail();
    const isDifferentAccount = Boolean(lastDisconnected && lastDisconnected !== email);

    await IdentityService.setCustomProEmail(email);
    appSettings.syncKey = email;
    await StorageLocal.saveSettings(appSettings);
    setProEmailEditingMode(false);
    await updateProStatusUI(true);
    showToast('Conta alterada para: ' + email);

    if (isDifferentAccount) {
      await IdentityService.clearLastDisconnectedEmail();
      openSyncAccountPrompt(email);
    } else {
      await triggerAutoSyncOnConnect(email);
    }
  }));
}

// ── Acesso Dinâmico & Desconexão Segura de Conta ───────────
function openLoginView() {
  if (formPanel) formPanel.classList.remove('open');
  if (aboutPanel) {
    aboutPanel.classList.remove('open');
    if (btnAbout) btnAbout.classList.remove('active');
  }
  if (notificationsPanel) {
    notificationsPanel.classList.remove('open');
    if (btnNotifications) btnNotifications.classList.remove('active');
  }
  if (settingsPanel) {
    settingsPanel.classList.add('open');
    if (btnSettings) btnSettings.classList.add('active');
  }
  syncBottomNavVisibility();
  if (typeof updateStorageStatsUI === 'function') updateStorageStatsUI();
  if (typeof updateCurrentSiteToggleUI === 'function') updateCurrentSiteToggleUI();
  if (typeof updateProStatusUI === 'function') updateProStatusUI();

  // Seleciona a aba PRO nas configurações caso exista navegação por abas
  const tabBtnPro = document.querySelector('.settings-tab-btn[data-tab="pro"]');
  if (tabBtnPro) {
    tabBtnPro.click();
  }

  // Rola suavemente até o card PRO de login
  const proCard = document.getElementById('cardProSection') || document.getElementById('proCardBody');
  if (proCard) {
    proCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function promptDisconnectAccount() {
  if (modalConfirmDisconnect) {
    const email = (inputCustomProEmail && inputCustomProEmail.value) || '';
    if (confirmDisconnectDesc) {
      confirmDisconnectDesc.textContent = email
        ? `Deseja realmente desconectar a conta ${email}?`
        : 'Deseja realmente desconectar sua conta?';
    }
    modalConfirmDisconnect.classList.add('open');
  } else if (confirm('Deseja realmente desconectar sua conta? Suas obras locais continuarão salvas.')) {
    executeDisconnectAccount();
  }
}

function closeConfirmDisconnectModal() {
  if (modalConfirmDisconnect) {
    modalConfirmDisconnect.classList.remove('open');
  }
}

async function executeDisconnectAccount() {
  closeConfirmDisconnectModal();
  await IdentityService.signOutGoogle(getSupabaseConfig());

  // Reverte tema Cyber Neon (exclusivo PRO) para Escuro por padrão ao desconectar
  if (appSettings && appSettings.theme === 'neon') {
    appSettings.theme = 'dark';
    applyTheme('dark', true);
    await StorageLocal.saveSettings(appSettings);
    broadcastSettingsToTabs(appSettings);
    const themeBtns = document.querySelectorAll('.theme-btn');
    themeBtns.forEach(b => {
      b.classList.toggle('active', b.dataset.theme === 'dark');
    });
    showToast('Tema Cyber Neon desativado (exclusivo PRO). Retornado ao tema Escuro.');
  }

  currentTotpSetupSecret = '';
  const qrWrap = document.getElementById('proTotpQrWrap');
  if (qrWrap) {
    const oldSvg = qrWrap.querySelector('svg');
    if (oldSvg) oldSvg.remove();
    const oldOffline = qrWrap.querySelector('.pro-totp-qr-offline');
    if (oldOffline) oldOffline.remove();
  }
  if (imgTotpQr) {
    imgTotpQr.src = '';
    imgTotpQr.style.display = 'none';
  }
  if (qrLoadingSpinner) qrLoadingSpinner.style.display = 'flex';
  if (proTotpQrHint) {
    proTotpQrHint.textContent = '';
    proTotpQrHint.style.display = 'none';
  }
  if (inputTotpManualSecret) inputTotpManualSecret.value = '';
  if (inputTotpTestCode) inputTotpTestCode.value = '';

  await updateProStatusUI(true);
  showToast('✓ Conta desconectada com sucesso. Suas obras locais foram preservadas!');
}

if (btnCancelConfirmDisconnect) {
  btnCancelConfirmDisconnect.addEventListener('click', closeConfirmDisconnectModal);
}
if (btnConfirmDisconnectAccount) {
  btnConfirmDisconnectAccount.addEventListener('click', executeDisconnectAccount);
}
if (modalConfirmDisconnect) {
  modalConfirmDisconnect.addEventListener('click', (e) => {
    if (e.target === modalConfirmDisconnect) closeConfirmDisconnectModal();
  });
}

if (btnHeaderAuth) {
  btnHeaderAuth.addEventListener('click', () => {
    const action = btnHeaderAuth.dataset.action;
    if (action === 'disconnect') {
      promptDisconnectAccount();
    } else {
      openLoginView();
    }
  });
}
if (btnDisconnectAccount) {
  btnDisconnectAccount.addEventListener('click', promptDisconnectAccount);
}
if (btnDisconnectAccountHeader) {
  btnDisconnectAccountHeader.addEventListener('click', promptDisconnectAccount);
}

// ── Modal de Confirmação de Sincronização ao Conectar Nova Conta ──
let pendingNewSyncEmail = '';
function openSyncAccountPrompt(newEmail) {
  pendingNewSyncEmail = newEmail;
  if (lblNewSyncEmail) {
    lblNewSyncEmail.textContent = newEmail;
  }
  if (modalSyncAccountPrompt) {
    modalSyncAccountPrompt.classList.add('open');
  }
}
function closeSyncAccountPrompt() {
  if (modalSyncAccountPrompt) {
    modalSyncAccountPrompt.classList.remove('open');
  }
  pendingNewSyncEmail = '';
}
if (btnCancelSyncNewAccount) {
  btnCancelSyncNewAccount.addEventListener('click', closeSyncAccountPrompt);
}
if (modalSyncAccountPrompt) {
  modalSyncAccountPrompt.addEventListener('click', (e) => {
    if (e.target === modalSyncAccountPrompt) closeSyncAccountPrompt();
  });
}
if (btnConfirmSyncNewAccount) {
  btnConfirmSyncNewAccount.addEventListener('click', async () => {
    closeSyncAccountPrompt();
    showToast('Sincronizando e mesclando obras com a nova conta…');
    if (typeof StorageLocal !== 'undefined' && StorageLocal.markAllWorksPendingSync) {
      await StorageLocal.markAllWorksPendingSync();
    }
    if (typeof SyncService !== 'undefined' && SyncService.syncAll) {
      const res = await SyncService.syncAll();
      if (res && res.ok) {
        showToast(`✓ Sincronizado! ${res.pushed || 0} enviadas, ${res.pulled || 0} mescladas.`);
        if (typeof renderAllWorks === 'function') await renderAllWorks();
      } else {
        showToast((res && res.error) ? '⚠️ ' + res.error : 'Sincronização concluída.');
      }
    }
  });
}

// ── Handlers de Revelação e Cópia de Chaves de Acesso ──────
if (btnToggleRevealPin && inputDisplayProPin) {
  btnToggleRevealPin.addEventListener('click', () => {
    const isRevealed = inputDisplayProPin.type === 'text';
    inputDisplayProPin.type = isRevealed ? 'password' : 'text';
    const val = inputDisplayProPin.dataset.secret || '';
    inputDisplayProPin.value = isRevealed ? (val ? '••••••' : '------') : (val || '------');
    btnToggleRevealPin.textContent = isRevealed ? 'Mostrar' : 'Ocultar';
  });
}
if (btnCopyDisplayPin && inputDisplayProPin) {
  btnCopyDisplayPin.addEventListener('click', () => {
    const secret = inputDisplayProPin.dataset.secret || '';
    if (!secret) {
      showToast('Nenhum PIN disponível');
      return;
    }
    navigator.clipboard.writeText(secret).then(() => {
      showToast('✓ PIN de Acesso copiado!');
    }).catch(() => showToast('Erro ao copiar'));
  });
}

if (btnToggleRevealRecovery && inputDisplayProRecovery) {
  btnToggleRevealRecovery.addEventListener('click', () => {
    const isRevealed = inputDisplayProRecovery.type === 'text';
    inputDisplayProRecovery.type = isRevealed ? 'password' : 'text';
    const val = inputDisplayProRecovery.dataset.secret || '';
    inputDisplayProRecovery.value = isRevealed ? (val ? '•••••••••••••••••••' : 'YK------') : (val || 'YK------');
    btnToggleRevealRecovery.textContent = isRevealed ? 'Mostrar' : 'Ocultar';
  });
}
if (btnCopyDisplayRecovery && inputDisplayProRecovery) {
  btnCopyDisplayRecovery.addEventListener('click', () => {
    const secret = inputDisplayProRecovery.dataset.secret || '';
    if (!secret) {
      showToast('Nenhuma Chave Mestra disponível');
      return;
    }
    navigator.clipboard.writeText(secret).then(() => {
      showToast('✓ Chave Mestra de Recuperação copiada!');
    }).catch(() => showToast('Erro ao copiar'));
  });
}

// Cópias no Step 3 de Sucesso
if (btnCopySuccessPin && proSuccessPin) {
  btnCopySuccessPin.addEventListener('click', () => {
    if (proSuccessPin.value && proSuccessPin.value !== '------') {
      navigator.clipboard.writeText(proSuccessPin.value).then(() => showToast('✓ PIN copiado!'));
    }
  });
}
if (btnCopySuccessRecovery && proSuccessRecovery) {
  btnCopySuccessRecovery.addEventListener('click', () => {
    if (proSuccessRecovery.value && proSuccessRecovery.value !== 'YK------') {
      navigator.clipboard.writeText(proSuccessRecovery.value).then(() => showToast('✓ Chave Mestra copiada!'));
    }
  });
}

// ── Google Authenticator (TOTP) Opcional ───────────────────
let currentTotpSetupSecret = '';

function renderTotpQr(totpData, email) {
  if (proTotpQrHint) {
    proTotpQrHint.textContent = '';
    proTotpQrHint.style.display = 'none';
  }
  const qrWrap = document.getElementById('proTotpQrWrap');
  if (qrWrap) {
    const existingSvg = qrWrap.querySelector('svg');
    if (existingSvg) existingSvg.remove();
    const existingOffline = qrWrap.querySelector('.pro-totp-qr-offline');
    if (existingOffline) existingOffline.remove();
  }

  // 1. Prioridade máxima: SVG vetorial offline (gerado localmente)
  if (totpData && totpData.svg && qrWrap) {
    if (qrLoadingSpinner) qrLoadingSpinner.style.display = 'none';
    if (imgTotpQr) {
      imgTotpQr.style.display = 'none';
      imgTotpQr.src = '';
    }
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = totpData.svg;
    const svgEl = tempDiv.querySelector('svg');
    if (svgEl) {
      svgEl.setAttribute('role', 'img');
      svgEl.setAttribute('aria-label', `QR Code Google Authenticator para ${email}`);
      qrWrap.appendChild(svgEl);
      return;
    }
  }

  // 2. Geração direta no popup via biblioteca qrcode
  try {
    const qrlib = (typeof window !== 'undefined' && window.qrcode) ||
                  (typeof globalThis !== 'undefined' && globalThis.qrcode) ||
                  (typeof qrcode !== 'undefined' ? qrcode : null);
    if (qrlib && totpData && (totpData.secret || currentTotpSetupSecret) && qrWrap) {
      const secret = totpData.secret || currentTotpSetupSecret;
      const otpUrl = (totpData && totpData.otpAuthUrl) ||
                     (IdentityService.Totp && typeof IdentityService.Totp.getOtpAuthUrl === 'function' ? IdentityService.Totp.getOtpAuthUrl(email, secret) : '') ||
                     `otpauth://totp/YekunDream:${encodeURIComponent(email)}?secret=${secret}&issuer=YekunDream`;
      const qr = qrlib(0, 'M');
      qr.addData(otpUrl);
      qr.make();
      const svgTag = qr.createSvgTag({ cellSize: 3, margin: 4, scalable: true });
      if (qrLoadingSpinner) qrLoadingSpinner.style.display = 'none';
      if (imgTotpQr) {
        imgTotpQr.style.display = 'none';
        imgTotpQr.src = '';
      }
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = svgTag;
      const svgEl = tempDiv.querySelector('svg');
      if (svgEl) {
        svgEl.setAttribute('role', 'img');
        svgEl.setAttribute('aria-label', `QR Code Google Authenticator para ${email}`);
        qrWrap.appendChild(svgEl);
        return;
      }
    }
  } catch (_) {}

  // 3. Fallback para <img> com totpData.qrUrl
  if (imgTotpQr && totpData && totpData.qrUrl) {
    imgTotpQr.onload = () => {
      imgTotpQr.style.display = 'block';
      if (qrLoadingSpinner) qrLoadingSpinner.style.display = 'none';
      if (proTotpQrHint) proTotpQrHint.style.display = 'none';
    };
    imgTotpQr.src = totpData.qrUrl;
  }
}

if (proTotpAccordion) {
  proTotpAccordion.addEventListener('toggle', async () => {
    if (!proTotpAccordion.open) return;
    const creds = await IdentityService.getStoredCredentials();
    const idInfo = await IdentityService.getIdentityInfo();
    const email = idInfo && idInfo.email;
    const config = getSupabaseConfig();
    const isRequired = creds.totpEnabled || (email ? await IdentityService.isTotpRequiredForEmail(config, email) : false);
    if (isRequired) {
      const qrWrap = document.getElementById('proTotpQrWrap');
      if (qrWrap) {
        qrWrap.classList.add('hidden');
        qrWrap.style.display = 'none';
      }
      if (proTotpQrHint) proTotpQrHint.style.display = 'none';
      const totpDesc = document.getElementById('proTotpDesc');
      if (totpDesc) totpDesc.textContent = 'Chave do Google Authenticator vinculada com sucesso à sua conta:';
      if (inputTotpManualSecret) {
        inputTotpManualSecret.value = creds.totpSecret || currentTotpSetupSecret || inputTotpManualSecret.value;
      }
      return;
    }
    if (email) {
      if (!currentTotpSetupSecret) {
        const totpData = await IdentityService.setupTotp(email);
        currentTotpSetupSecret = totpData.secret;
        renderTotpQr(totpData, email);
        if (inputTotpManualSecret) inputTotpManualSecret.value = totpData.secret;
      } else {
        const qrWrap = document.getElementById('proTotpQrWrap');
        const hasSvg = qrWrap && qrWrap.querySelector('svg');
        const hasImg = imgTotpQr && imgTotpQr.style.display !== 'none' && imgTotpQr.src;
        if (!hasSvg && !hasImg) {
          renderTotpQr({ secret: currentTotpSetupSecret }, email);
        }
      }
    }
  });
}

if (imgTotpQr) {
  imgTotpQr.addEventListener('error', () => {
    if (!imgTotpQr.src) return;
    imgTotpQr.style.display = 'none';
    if (qrLoadingSpinner) qrLoadingSpinner.style.display = 'none';
    const qrWrap = document.getElementById('proTotpQrWrap');
    if (qrWrap && !qrWrap.querySelector('.pro-totp-qr-offline') && !qrWrap.querySelector('svg')) {
      const offlineMsg = document.createElement('div');
      offlineMsg.className = 'pro-totp-qr-offline';
      offlineMsg.textContent = 'QR indisponível';
      qrWrap.appendChild(offlineMsg);
    }
    if (proTotpQrHint) {
      proTotpQrHint.textContent = 'Sem rede para QR: use a chave de 16 caracteres abaixo';
      proTotpQrHint.style.display = 'block';
    }
  });
}

if (btnCopyTotpSecret && inputTotpManualSecret) {
  btnCopyTotpSecret.addEventListener('click', () => {
    if (inputTotpManualSecret.value) {
      navigator.clipboard.writeText(inputTotpManualSecret.value)
        .then(() => showToast('✓ Chave manual 2FA copiada!'))
        .catch(() => showToast('Erro ao copiar chave'));
    }
  });
}

if (inputTotpTestCode) {
  inputTotpTestCode.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (btnActivateTotp) btnActivateTotp.click();
    }
  });
}

if (btnActivateTotp && inputTotpTestCode) {
  btnActivateTotp.addEventListener('click', async () => {
    const code = inputTotpTestCode.value.trim();
    if (!/^\d{6}$/.test(code)) {
      showToast('Digite o código de 6 dígitos gerado pelo app');
      return;
    }
    const idInfo = await IdentityService.getIdentityInfo();
    const config = getSupabaseConfig();
    const res = await IdentityService.verifyAndEnableTotp(config, idInfo.email, currentTotpSetupSecret, code);
    if (res.success) {
      showToast('✓ ' + res.message);
      inputTotpTestCode.value = '';
      if (inputTotpManualSecret && currentTotpSetupSecret) {
        inputTotpManualSecret.value = currentTotpSetupSecret;
      }
      const qrWrap = document.getElementById('proTotpQrWrap');
      if (qrWrap) {
        qrWrap.classList.add('hidden');
        qrWrap.style.display = 'none';
      }
      if (proTotpQrHint) proTotpQrHint.style.display = 'none';
      await updateProStatusUI(true);
    } else {
      showToast('⚠️ ' + res.error);
    }
  });
}

if (btnDisableTotp) {
  btnDisableTotp.addEventListener('click', async () => {
    const config = getSupabaseConfig();
    const idInfo = await IdentityService.getIdentityInfo();
    await IdentityService.disableTotp(config, idInfo.email);
    currentTotpSetupSecret = '';
    if (inputTotpManualSecret) inputTotpManualSecret.value = '';
    if (inputTotpTestCode) inputTotpTestCode.value = '';
    const qrWrap = document.getElementById('proTotpQrWrap');
    if (qrWrap) {
      const oldSvg = qrWrap.querySelector('svg');
      if (oldSvg) oldSvg.remove();
      const oldOffline = qrWrap.querySelector('.pro-totp-qr-offline');
      if (oldOffline) oldOffline.remove();
      qrWrap.classList.remove('hidden');
      qrWrap.style.display = '';
    }
    if (imgTotpQr) {
      imgTotpQr.src = '';
      imgTotpQr.style.display = 'none';
    }
    if (qrLoadingSpinner) qrLoadingSpinner.style.display = 'flex';
    if (proTotpQrHint) {
      proTotpQrHint.textContent = '';
      proTotpQrHint.style.display = 'none';
    }
    showToast('2FA desativado com sucesso.');
    await updateProStatusUI(true);
  });
}

// ── Helpers de Formatação e UI ────────────────────────────
function getWorkInitials(name) {
  if (!name || typeof name !== 'string') return '?';
  const clean = name.trim().replace(/[^\p{L}\p{N}\s]/gu, '');
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function formatRelativeTime(epoch, nowEpoch = Date.now()) {
  if (!epoch) return '';
  const diffMs = nowEpoch - Number(epoch);
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 24 && new Date(epoch).getDate() === new Date(nowEpoch).getDate()) {
    return 'Lido hoje';
  }
  if (diffDays <= 1 || diffHours < 48) {
    return 'Lido ontem';
  }
  if (diffDays < 7) {
    return `Há ${diffDays} dias`;
  }
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `Há ${weeks} ${weeks === 1 ? 'semana' : 'semanas'}`;
  }
  return new Date(epoch).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function sortWorks(works, sortBy = 'recent') {
  const list = [...(works || [])];
  if (sortBy === 'alpha') {
    return list.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR', { sensitivity: 'base' }));
  }
  if (sortBy === 'chapters') {
    const parseNum = (str) => {
      const match = String(str || '').match(/(\d+(?:\.\d+)?)/);
      return match ? parseFloat(match[1]) : 0;
    };
    return list.sort((a, b) => parseNum(b.mainChapter) - parseNum(a.mainChapter));
  }
  // Default: recent
  return list.sort((a, b) => {
    const timeA = a.updatedAt || a.createdAt || 0;
    const timeB = b.updatedAt || b.createdAt || 0;
    return timeB - timeA;
  });
}

let _dateFormatter = null;
let _timeFormatter = null;

function formatDate(epoch) {
  if (!epoch) return '';
  try {
    if (!_dateFormatter && typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
      _dateFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' });
    }
    if (_dateFormatter) {
      return _dateFormatter.format(new Date(epoch));
    }
  } catch (_) {}
  const d = new Date(epoch);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function formatTime(epoch) {
  if (!epoch) return '';
  try {
    if (!_timeFormatter && typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
      _timeFormatter = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
    if (_timeFormatter) {
      return _timeFormatter.format(new Date(epoch));
    }
  } catch (_) {}
  const d = new Date(epoch);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// ── Render ───────────────────────────────────────────────
function filterWorks(
  works,
  query,
  category = 'all',
  sortBy = (sortFilter ? sortFilter.value : 'recent'),
  status = activeStatusFilters
) {
  let list = works || [];
  if (category && category !== 'all') {
    const catLower = category.toLowerCase();
    list = list.filter(w => (w.tag || 'outro').toLowerCase() === catLower);
  }

  if (status && status !== 'all') {
    if (status instanceof Set || Array.isArray(status)) {
      const set = status instanceof Set ? status : new Set(status);
      if (!set.has('all') && set.size < 5) {
        list = list.filter(w => set.has((w.readingStatus || 'lendo').toLowerCase()));
      }
    } else {
      const statusLower = status.toLowerCase();
      list = list.filter(w => (w.readingStatus || 'lendo').toLowerCase() === statusLower);
    }
  }

  const q = (query || '').toLowerCase().trim();
  if (q) {
    const normQ = typeof StorageLocal !== 'undefined' && StorageLocal.normalizeTitle
      ? StorageLocal.normalizeTitle(q)
      : q.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

    list = list.filter(w => {
      const name = w.name || '';
      const nameLower = w._nameLower || (w._nameLower = name.toLowerCase());
      if (nameLower.includes(q)) return true;

      const normName = w._normName || (w._normName = (typeof StorageLocal !== 'undefined' && StorageLocal.normalizeTitle
        ? StorageLocal.normalizeTitle(name)
        : nameLower));
      if (normQ && normName.includes(normQ)) return true;

      if (Array.isArray(w.aliases)) {
        for (const a of w.aliases) {
          if (!a) continue;
          if (a.toLowerCase().includes(q)) return true;
          if (normQ) {
            const normA = typeof StorageLocal !== 'undefined' && StorageLocal.normalizeTitle
              ? StorageLocal.normalizeTitle(a)
              : a.toLowerCase();
            if (normA.includes(normQ)) return true;
          }
        }
      }

      if ((w.mainChapter || '').toLowerCase().includes(q)) return true;
      if ((w.tag || '').toLowerCase().includes(q)) return true;
      if ((w.readingStatus || '').toLowerCase().includes(q)) return true;
      if (isVideoWorkTag(w.tag) && (w.readingStatus || 'lendo').toLowerCase() === 'lendo' && 'assistindo'.includes(q)) return true;
      if ((w.publicationStatus || '').toLowerCase().includes(q)) return true;
      const hasSource = (w.sources || []).some(s =>
        (s.siteName || '').toLowerCase().includes(q) ||
        (s.domain || '').toLowerCase().includes(q) ||
        (s.chapter || '').toLowerCase().includes(q) ||
        (s.url || '').toLowerCase().includes(q)
      );
      return hasSource;
    });
  }

  return sortWorks(list, sortBy);
}

function renderList(
  filter = (searchInput ? searchInput.value.trim() : ''),
  category = (categoryFilter ? categoryFilter.value : 'all'),
  sortBy = (sortFilter ? sortFilter.value : 'recent'),
  status = activeStatusFilters
) {
  updateNavBadges();
  const list = filterWorks(allWorks, filter, category, sortBy, status);

  entriesList.querySelectorAll('.entry-card').forEach(c => c.remove());

  if (list.length === 0) {
    emptyState.style.display = 'flex';
    return;
  }
  emptyState.style.display = 'none';

  if (typeof document.createDocumentFragment === 'function') {
    const fragment = document.createDocumentFragment();
    list.forEach(work => {
      const card = buildWorkCard(work);
      fragment.appendChild(card);
    });
    entriesList.appendChild(fragment);
  } else {
    list.forEach(work => {
      const card = buildWorkCard(work);
      entriesList.appendChild(card);
    });
  }
}

function renderAccordionContent(card, accPanel, work) {
  if (!accPanel || accPanel.dataset.rendered === 'true') return;
  accPanel.dataset.rendered = 'true';

  const sources = work.sources || [];
  const history = work.history || [];

  const sourcesRowsHtml = sources.map(s => {
    return `<div class="source-item-row" data-srcid="${s.id}">
      <div class="source-item-left">
        <span class="source-item-name">${esc(s.siteName)} <small style="opacity:.6; font-size:8px;">(${esc(s.domain || '')})</small></span>
        <span class="source-item-ch">${esc(s.chapter)} • ${formatDate(s.updatedAt)}</span>
      </div>
      <div class="source-item-actions">
        ${s.url ? `<button class="action-btn open btn-src-open" title="Abrir URL">${ICONS.external}</button>` : ''}
        <button class="action-btn edit btn-src-edit" title="Editar fonte">${ICONS.edit}</button>
        <button class="action-btn del btn-src-del" title="Remover fonte">${ICONS.del}</button>
      </div>
    </div>`;
  }).join('');

  const historyRowsHtml = history.slice(0, 30).map(h => {
    return `<div class="history-item">
      <div class="history-item-dot"></div>
      <div class="history-item-content">
        <strong>${esc(h.siteName || h.domain || 'Site')}</strong>: <span class="hist-ch">${esc(h.chapter)}</span>
        <div class="hist-date">${formatDate(h.timestamp)} às ${formatTime(h.timestamp)}</div>
      </div>
    </div>`;
  }).join('') || '<div style="color:var(--muted); font-size:9px; font-family:var(--font-mono);">Nenhum histórico registrado ainda.</div>';

  accPanel.innerHTML = `
    <div class="panel-tabs">
      <button class="panel-tab active" data-tab="sources">Fontes (${sources.length})</button>
      <button class="panel-tab" data-tab="history">Histórico (${history.length})</button>
    </div>

    <div class="tab-content active tab-sources">
      ${(Array.isArray(work.aliases) && work.aliases.length > 0) ? `<div style="font-size:9px; color:var(--muted); font-family:var(--font-mono); margin-bottom:8px; padding:4px 6px; background:rgba(255,255,255,0.03); border-radius:4px; border-left:2px solid var(--accent);"><strong style="color:var(--accent);">Nomes alternativos:</strong> ${esc(work.aliases.join(', '))}</div>` : ''}
      <div class="sources-list">${sourcesRowsHtml}</div>
      <button class="btn-add-source">${ICONS.plus} Adicionar Outro Site</button>
    </div>

    <div class="tab-content tab-history">
      <div class="history-timeline">${historyRowsHtml}</div>
    </div>
  `;

  // Accordion tabs
  const tabBtns = accPanel.querySelectorAll('.panel-tab');
  const tabSources = accPanel.querySelector('.tab-sources');
  const tabHistory = accPanel.querySelector('.tab-history');

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
  const btnAddSrc = accPanel.querySelector('.btn-add-source');
  if (btnAddSrc) {
    btnAddSrc.addEventListener('click', e => {
      e.stopPropagation();
      openForm('add_source', work);
    });
  }

  // Source item rows actions
  accPanel.querySelectorAll('.source-item-row').forEach(row => {
    const srcId = row.dataset.srcid;
    const src = sources.find(s => s.id === srcId);
    if (!src) return;

    const btnOpen = row.querySelector('.btn-src-open');
    if (btnOpen) {
      btnOpen.addEventListener('click', e => {
        e.stopPropagation();
        if (src.url) safeOpenUrl(src.url);
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
}

function ensureAccordionRendered(card, work) {
  if (!card) return;
  const accPanel = card.querySelector('.accordion-panel');
  if (accPanel) renderAccordionContent(card, accPanel, work);
}

function buildWorkCard(work) {
  const card = document.createElement('div');
  card.className = 'entry-card';
  card.dataset.id = work.id;

  const tag       = work.tag || 'outro';
  const sources   = work.sources || [];
  const activeSrc = sources.find(s => s.id === work.lastReadSourceId) || sources[0] || {};
  const showIncBtn = appSettings.enableQuickIncrement !== false;
  const relTime   = formatRelativeTime(work.updatedAt || work.createdAt);

  const readingStatus = work.readingStatus || 'lendo';
  const pubStatus = work.publicationStatus || 'lancamento';

  const isVideo = isVideoWorkTag(tag);
  const statusLabels = {
    lendo: isVideo ? 'Assistindo' : 'Lendo',
    concluido: 'Concluído',
    pausado: 'Pausado',
    dropado: 'Dropado',
    planejo: 'Planejo'
  };

  const pubLabels = {
    hiato: 'Hiato',
    cancelado: 'Cancelada',
    concluido: 'Fim'
  };

  const statusDisplay = statusLabels[readingStatus] || readingStatus;
  const statusBadgeHtml = `
    <div class="entry-status-wrap" data-workid="${work.id}">
      <button type="button" class="entry-status-badge status-${readingStatus} btn-status-cycle" title="Passe o mouse por 2s ou clique para alterar status (${statusDisplay})">${statusDisplay}</button>
      <div class="status-popover" role="menu" style="display: none;">
        <div class="status-popover-header">Alterar Status</div>
        <button type="button" class="status-popover-opt ${readingStatus === 'lendo' ? 'active' : ''}" data-status="lendo">
          <span class="status-popover-dot dot-lendo"></span>
          <span>${isVideo ? 'Assistindo' : 'Lendo'}</span>
        </button>
        <button type="button" class="status-popover-opt ${readingStatus === 'pausado' ? 'active' : ''}" data-status="pausado">
          <span class="status-popover-dot dot-pausado"></span>
          <span>Pausado</span>
        </button>
        <button type="button" class="status-popover-opt ${readingStatus === 'dropado' ? 'active' : ''}" data-status="dropado">
          <span class="status-popover-dot dot-dropado"></span>
          <span>Dropado</span>
        </button>
        <button type="button" class="status-popover-opt ${readingStatus === 'concluido' ? 'active' : ''}" data-status="concluido">
          <span class="status-popover-dot dot-concluido"></span>
          <span>Concluído</span>
        </button>
        <button type="button" class="status-popover-opt ${readingStatus === 'planejo' ? 'active' : ''}" data-status="planejo">
          <span class="status-popover-dot dot-planejo"></span>
          <span>Planejo</span>
        </button>
      </div>
    </div>`;
  const pubBadgeHtml = pubLabels[pubStatus] ? `<button type="button" class="entry-pub-badge pub-${pubStatus} btn-pub-cycle" title="Status da obra: ${pubLabels[pubStatus]} (clique para alternar)">${pubLabels[pubStatus]}</button>` : '';

  const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const releaseDaysBadge = (Array.isArray(work.releaseDays) && work.releaseDays.length > 0)
    ? `<span class="entry-days-badge" title="Dias de lançamento: ${work.releaseDays.map(d => DAY_NAMES[d]).join(', ')}">${ICONS.calendar} ${work.releaseDays.map(d => DAY_NAMES[d]).join(', ')}</span>`
    : '';

  // Ordenar fontes para chips: a última fonte lida primeiro, depois as mais recentes
  const sortedSources = [...sources].sort((a, b) => {
    if (a.id === work.lastReadSourceId) return -1;
    if (b.id === work.lastReadSourceId) return 1;
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  });

  const MAX_VISIBLE_CHIPS = 2;
  const visibleSources = sortedSources.slice(0, MAX_VISIBLE_CHIPS);
  const hiddenCount = sortedSources.length - MAX_VISIBLE_CHIPS;

  // Chips HTML
  let chipsHtml = visibleSources.map(s => {
    const href = s.url || '#';
    return `<a class="source-chip" href="${esc(href)}" title="${esc(s.url || s.siteName)}" target="_blank" data-srcid="${s.id}">
      ${ICONS.globe} ${esc(s.siteName)}: <span class="chip-ch">${esc(s.chapter)}</span> <span class="chip-ext">${ICONS.external}</span>
    </a>`;
  }).join('');

  if (hiddenCount > 0) {
    chipsHtml += `<button type="button" class="source-chip-more" title="Ver todos os ${sources.length} sites">+${hiddenCount} sites</button>`;
  }

  card.innerHTML = `
    <div class="entry-body">
      <div class="entry-top">
        <div class="entry-title-wrap">
          <span class="entry-name" title="${esc(work.name)}">${esc(work.name)}</span>
          <span class="entry-tooltip">${esc(work.name)}</span>
        </div>
      </div>

      <div class="entry-meta-row">
        ${activeSrc.url ? `<button class="btn-continue btn-main-open" title="Continuar ${isVideo ? 'assistindo' : 'lendo'} em ${esc(activeSrc.siteName || 'site')}">Continuar ${ICONS.external}</button>` : ''}
        <span class="entry-cat-badge cat-${tag}">${tag}</span>
        ${statusBadgeHtml}
        ${pubBadgeHtml}
        ${releaseDaysBadge}
      </div>

      <!-- Chips de Sites / Fontes -->
      <div class="entry-sources">
        ${chipsHtml || '<span style="font-size:10px; color:var(--muted); font-family:var(--font-readable);">Nenhuma fonte cadastrada</span>'}
        <button class="accordion-toggle" title="Fontes e Histórico" aria-label="Fontes e Histórico">
          <span class="toggle-arrow">${ICONS.chevronDown}</span>
        </button>
      </div>

      <!-- Accordion Panel (Renderizado sob demanda / Lazy Load) -->
      <div class="accordion-panel" data-rendered="false"></div>
    </div>

    <!-- Contêiner de Ações e Informação Secundária Reestruturado -->
    <div class="entry-card-right">
      <div class="entry-actions">
        ${showIncBtn ? `<button class="action-btn inc btn-main-inc" title="Avançar +1 capítulo (+)">${ICONS.plus}</button>` : ''}
        <button class="action-btn edit btn-main-edit" title="Editar Obra">${ICONS.edit}</button>
        <button class="action-btn del btn-main-del"   title="Remover Obra">${ICONS.del}</button>
      </div>
      <span class="entry-relative-time">${esc(relTime)}</span>
    </div>
  `;

  // Quick increment
  const incBtn = card.querySelector('.btn-main-inc') || card.querySelector('.action-btn.inc');
  if (incBtn) {
    incBtn.addEventListener('click', e => {
      e.stopPropagation();
      handleQuickIncrement(work.id);
    });
  }

  // Open active source URL via continue button or open button
  card.querySelectorAll('.btn-main-open').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (activeSrc.url) safeOpenUrl(activeSrc.url);
    });
  });

  // Quick change reading status via 2-second hover or click
  const statusWrap = card.querySelector('.entry-status-wrap');
  if (statusWrap) {
    const badgeBtn = statusWrap.querySelector('.btn-status-cycle');
    const popover = statusWrap.querySelector('.status-popover');
    let hoverTimer = null;
    let closeTimer = null;

    function openStatusMenu() {
      document.querySelectorAll('.status-popover.open').forEach(p => {
        if (p !== popover) {
          p.classList.remove('open');
          p.style.display = 'none';
          const otherCard = p.closest('.entry-card');
          if (otherCard) otherCard.style.zIndex = '';
        }
      });

      // Eleva o card atual para garantir que o menu fique acima dos outros cards
      card.style.zIndex = '100';

      // Posicionamento inteligente: por padrao ACIMA (evita cortar no fim do card/tela)
      if (typeof statusWrap.getBoundingClientRect === 'function') {
        const rect = statusWrap.getBoundingClientRect();
        if (rect.top < 140) {
          popover.classList.remove('open-above');
          popover.classList.add('open-below');
        } else {
          popover.classList.remove('open-below');
          popover.classList.add('open-above');
        }
      } else {
        popover.classList.add('open-above');
      }

      popover.style.display = 'flex';
      requestAnimationFrame(() => popover.classList.add('open'));
    }

    function closeStatusMenu() {
      popover.classList.remove('open');
      card.style.zIndex = '';
      setTimeout(() => {
        if (!popover.classList.contains('open')) {
          popover.style.display = 'none';
        }
      }, 150);
    }

    // 2 segundos com o mouse sobre o status para abrir opções
    statusWrap.addEventListener('mouseenter', () => {
      clearTimeout(closeTimer);
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => {
        openStatusMenu();
      }, 2000);
    });

    statusWrap.addEventListener('mouseleave', () => {
      clearTimeout(hoverTimer);
      closeTimer = setTimeout(() => {
        closeStatusMenu();
      }, 250);
    });

    // Clique direto no badge abre/fecha imediatamente
    if (badgeBtn) {
      badgeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        clearTimeout(hoverTimer);
        if (popover.classList.contains('open')) {
          closeStatusMenu();
        } else {
          openStatusMenu();
        }
      });
    }

    // Seleção de status no popover
    popover.querySelectorAll('.status-popover-opt').forEach(opt => {
      opt.addEventListener('click', async (e) => {
        e.stopPropagation();
        e.preventDefault();
        const next = opt.dataset.status;
        closeStatusMenu();

        if (next === (work.readingStatus || 'lendo')) {
          return;
        }

        // touchUpdatedAt: false para não alterar a posição cronológica da obra
        const updated = await StorageLocal.updateWorkStatus(work.id, {
          readingStatus: next,
          touchUpdatedAt: false
        });

        if (updated) {
          work.readingStatus = next;
          const target = allWorks.find(w => w.id === work.id);
          if (target) target.readingStatus = next;

          const isVid = isVideoWorkTag(work.tag);
          const nextLabel = (next === 'lendo') ? (isVid ? 'Assistindo' : 'Lendo') : (statusLabels[next] || next);

          // Atualização direta e in-place no card sem re-renderizar a lista inteira
          badgeBtn.className = `entry-status-badge status-${next} btn-status-cycle`;
          badgeBtn.textContent = nextLabel;
          badgeBtn.title = `Passe o mouse por 2s ou clique para alterar status (${nextLabel})`;

          popover.querySelectorAll('.status-popover-opt').forEach(b => {
            b.classList.toggle('active', b.dataset.status === next);
          });

          showToast(`✓ Status alterado para: ${nextLabel}`);

          // Se o novo status não estiver entre os filtros selecionados, remove suavemente
          if (!activeStatusFilters.has(next) && !activeStatusFilters.has('all')) {
            setTimeout(() => {
              card.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
              card.style.opacity = '0';
              card.style.transform = 'scale(0.96)';
              setTimeout(() => {
                card.remove();
                if (entriesList.querySelectorAll('.entry-card').length === 0) {
                  emptyState.style.display = 'flex';
                }
              }, 350);
            }, 600);
          }
        }
      });
    });
  }

  // Quick cycle publication status on badge click
  const pubCycleBtn = card.querySelector('.btn-pub-cycle');
  if (pubCycleBtn) {
    pubCycleBtn.addEventListener('click', async e => {
      e.stopPropagation();
      e.preventDefault();

      const NEXT_PUB = {
        'hiato': 'concluido',
        'concluido': 'cancelado',
        'cancelado': 'lancamento',
        'lancamento': 'hiato'
      };

      const current = work.publicationStatus || 'lancamento';
      const next = NEXT_PUB[current] || 'lancamento';

      const updated = await StorageLocal.updateWorkStatus(work.id, { publicationStatus: next });
      if (updated) {
        allWorks = await StorageLocal.getWorks();
        renderCurrentView();
        showToast(`✓ Obra: ${pubLabels[next] || 'Em Lançamento'}`);
      }
    });
  }

  // Avatar click also opens if URL exists
  const avatarEl = card.querySelector('.entry-avatar');
  if (avatarEl && activeSrc.url) {
    avatarEl.style.cursor = 'pointer';
    avatarEl.addEventListener('click', e => {
      e.stopPropagation();
      safeOpenUrl(activeSrc.url);
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

  // Delete work via safe confirmation modal
  const mainDelBtn = card.querySelector('.btn-main-del');
  if (mainDelBtn) {
    mainDelBtn.addEventListener('click', e => {
      e.stopPropagation();
      promptDeleteWork(work);
    });
  }

  // Accordion toggle (Carrega conteúdo sob demanda)
  const accToggle = card.querySelector('.accordion-toggle');
  const accPanel  = card.querySelector('.accordion-panel');
  if (accToggle && accPanel) {
    accToggle.addEventListener('click', e => {
      e.stopPropagation();
      renderAccordionContent(card, accPanel, work);
      const isOpen = accPanel.classList.toggle('open');
      accToggle.classList.toggle('open', isOpen);
    });
  }

  // Botão "+N sites" abre accordion na aba Fontes (Carrega conteúdo sob demanda)
  const moreBtn = card.querySelector('.source-chip-more');
  if (moreBtn && accPanel) {
    moreBtn.addEventListener('click', e => {
      e.stopPropagation();
      e.preventDefault();
      renderAccordionContent(card, accPanel, work);
      accPanel.classList.add('open');
      if (accToggle) accToggle.classList.add('open');
      const tabBtns = accPanel.querySelectorAll('.panel-tab');
      tabBtns.forEach(b => b.classList.remove('active'));
      const tabSrcBtn = accPanel.querySelector('.panel-tab[data-tab="sources"]');
      if (tabSrcBtn) tabSrcBtn.classList.add('active');
      const tabSources = accPanel.querySelector('.tab-sources');
      const tabHistory = accPanel.querySelector('.tab-history');
      if (tabSources) tabSources.classList.add('active');
      if (tabHistory) tabHistory.classList.remove('active');
    });
  }

  // Prevent link click from collapsing card & reliably open tabs
  card.querySelectorAll('.source-chip').forEach(chip => {
    chip.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      const srcId = chip.dataset.srcid;
      const src = sources.find(s => s.id === srcId);
      const targetUrl = src ? src.url : chip.getAttribute('href');
      if (targetUrl && targetUrl !== '#') safeOpenUrl(targetUrl);
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

// A-03: Abre URL armazenada somente se o protocolo for http/https
// Previne abertura de javascript:, data:, file:, etc.
function safeOpenUrl(url) {
  try {
    const u = new URL(url);
    if (!['http:', 'https:'].includes(u.protocol)) return;
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url: u.href });
    } else {
      window.open(u.href, '_blank', 'noopener,noreferrer');
    }
  } catch (_) {}
}

// ── Central Consolidada de Sites (Sem Duplicações) ──────
let _cachedSitesWorksRef = null;
let _cachedConsolidatedSites = null;

function getConsolidatedSites(works) {
  if (works && works === _cachedSitesWorksRef && _cachedConsolidatedSites) {
    return _cachedConsolidatedSites;
  }
  const sitesMap = new Map();
  (works || []).forEach(work => {
    (work.sources || []).forEach(source => {
      let domain = (source.domain || '').trim().toLowerCase();
      if (!domain && source.url) {
        try {
          const u = new URL(source.url);
          domain = u.hostname.replace(/^www\./, '').toLowerCase();
        } catch (_) {}
      }
      const rawName = (source.siteName || domain || 'Site').trim();
      const siteKey = domain || rawName.toLowerCase();
      if (!siteKey) return;

      if (!sitesMap.has(siteKey)) {
        let mainUrl = '';
        if (source.url) {
          try {
            const parsed = new URL(source.url);
            mainUrl = `${parsed.protocol}//${parsed.hostname}`;
          } catch (_) {
            mainUrl = source.url;
          }
        }
        sitesMap.set(siteKey, {
          key: siteKey,
          siteName: rawName,
          domain: domain || rawName.toLowerCase(),
          mainUrl: mainUrl,
          works: []
        });
      }

      const siteEntry = sitesMap.get(siteKey);
      if (source.siteName && (!siteEntry.siteName || siteEntry.siteName.toLowerCase() === siteEntry.domain)) {
        siteEntry.siteName = source.siteName;
      }
      if (!siteEntry.mainUrl && source.url) {
        try {
          const parsed = new URL(source.url);
          siteEntry.mainUrl = `${parsed.protocol}//${parsed.hostname}`;
        } catch (_) {
          siteEntry.mainUrl = source.url;
        }
      }

      const existingIdx = siteEntry.works.findIndex(w => w.workId === work.id);
      const workItem = {
        workId: work.id,
        workName: work.name,
        tag: work.tag || 'outro',
        chapter: source.chapter || work.mainChapter || '',
        url: source.url || '',
        updatedAt: source.updatedAt || work.updatedAt || 0
      };

      if (existingIdx === -1) {
        siteEntry.works.push(workItem);
      } else {
        if ((workItem.updatedAt || 0) > (siteEntry.works[existingIdx].updatedAt || 0)) {
          siteEntry.works[existingIdx] = workItem;
        }
      }
    });
  });

  const list = Array.from(sitesMap.values());
  list.forEach(site => {
    site.works.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  });

  const result = list.sort((a, b) => {
    if (b.works.length !== a.works.length) {
      return b.works.length - a.works.length;
    }
    return (a.siteName || '').localeCompare(b.siteName || '', 'pt-BR');
  });

  _cachedSitesWorksRef = works;
  _cachedConsolidatedSites = result;
  return result;
}

function updateNavBadges() {
  if (navBadgeWorks) navBadgeWorks.textContent = allWorks.length;
  if (navBadgeSites) {
    const allSites = getConsolidatedSites(allWorks);
    navBadgeSites.textContent = allSites.length;
  }
}

function renderSitesView(query = (searchInput ? searchInput.value.trim() : '')) {
  if (!sitesCardsContainer) return;
  updateNavBadges();

  let sites = getConsolidatedSites(allWorks);
  const q = (query || '').toLowerCase().trim();

  if (q) {
    sites = sites.filter(site => {
      if (site.siteName.toLowerCase().includes(q)) return true;
      if (site.domain.toLowerCase().includes(q)) return true;
      return site.works.some(w =>
        w.workName.toLowerCase().includes(q) ||
        (w.chapter || '').toLowerCase().includes(q) ||
        (w.tag || '').toLowerCase().includes(q)
      );
    });
  }

  sitesCardsContainer.innerHTML = '';

  if (sites.length === 0) {
    if (emptySitesState) {
      emptySitesState.style.display = 'flex';
      const msg = emptySitesState.querySelector('p');
      if (msg) {
        msg.innerHTML = q
          ? `Nenhum site encontrado para "<strong>${esc(q)}</strong>".`
          : 'Nenhum site cadastrado ainda.<br>Adicione obras ou fontes para consultar os sites aqui.';
      }
    }
    return;
  }

  if (emptySitesState) emptySitesState.style.display = 'none';

  const useFragment = typeof document.createDocumentFragment === 'function';
  const fragment = useFragment ? document.createDocumentFragment() : null;

  sites.forEach(site => {
    const card = document.createElement('div');
    card.className = 'site-card';
    card.dataset.domain = site.domain;

    const visitUrl = site.mainUrl || (site.domain.startsWith('http') ? site.domain : `https://${site.domain}`);
    const worksCountLabel = site.works.length === 1 ? '1 obra' : `${site.works.length} obras`;

    const worksListHtml = site.works.map(w => {
      return `<a class="site-work-item" href="${esc(w.url || '#')}" data-workid="${esc(w.workId)}" title="Abrir ${esc(w.workName)}">
        <span class="site-work-title">${esc(w.workName)}</span>
        <span class="site-work-ch">${esc(w.chapter)}</span>
      </a>`;
    }).join('');

    card.innerHTML = `
      <div class="site-card-header">
        <div class="site-card-left">
          <div class="site-card-icon">${ICONS.globe}</div>
          <div class="site-card-info">
            <span class="site-card-name" title="${esc(site.siteName)}">${esc(site.siteName)}</span>
            <span class="site-card-domain" title="${esc(site.domain)}">${esc(site.domain)}</span>
          </div>
        </div>
        <div class="site-card-right">
          <span class="site-works-count">${worksCountLabel}</span>
          <button type="button" class="btn-visit-site" title="Visitar ${esc(site.siteName)}">
            <span>Visitar</span> ${ICONS.external}
          </button>
          <span class="site-toggle-icon">${ICONS.chevronDown}</span>
        </div>
      </div>
      <div class="site-works-list">
        ${worksListHtml}
      </div>
    `;

    // Botão Visitar abre o site sem expandir/recolher o card
    const btnVisit = card.querySelector('.btn-visit-site');
    if (btnVisit) {
      btnVisit.addEventListener('click', e => {
        e.stopPropagation();
        e.preventDefault();
        safeOpenUrl(visitUrl);
      });
    }

    // Clique no cabeçalho expande/recolhe a lista de obras
    const header = card.querySelector('.site-card-header');
    if (header) {
      header.addEventListener('click', e => {
        if (e.target.closest('.btn-visit-site')) return;
        card.classList.toggle('expanded');
      });
    }

    // Clique na obra abre a URL correspondente
    card.querySelectorAll('.site-work-item').forEach(item => {
      item.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        const url = item.getAttribute('href');
        if (url && url !== '#') safeOpenUrl(url);
      });
    });

    if (fragment) {
      fragment.appendChild(card);
    } else {
      sitesCardsContainer.appendChild(card);
    }
  });

  if (fragment) {
    sitesCardsContainer.appendChild(fragment);
  }
}

function renderCurrentView(query = (searchInput && searchInput.value ? searchInput.value.trim() : '')) {
  if (currentActiveView === 'sites') {
    renderSitesView(query);
  } else {
    renderList(query);
  }
}

function switchView(viewName) {
  currentActiveView = viewName;
  if (viewName === 'works') {
    if (navBtnWorks) navBtnWorks.classList.add('active');
    if (navBtnSites) navBtnSites.classList.remove('active');
    if (entriesList) entriesList.style.display = '';
    if (sitesListView) sitesListView.style.display = 'none';
    if (categoryFilter) categoryFilter.style.display = '';
    if (statusFilter) statusFilter.style.display = 'none';
    if (statusFilterBar) statusFilterBar.style.display = 'flex';
    if (sortFilter) sortFilter.style.display = '';
    if (searchInput) searchInput.placeholder = 'Buscar por título, tag, site...';
    renderList();
  } else if (viewName === 'sites') {
    if (navBtnWorks) navBtnWorks.classList.remove('active');
    if (navBtnSites) navBtnSites.classList.add('active');
    if (entriesList) entriesList.style.display = 'none';
    if (sitesListView) sitesListView.style.display = 'flex';
    if (categoryFilter) categoryFilter.style.display = 'none';
    if (statusFilter) statusFilter.style.display = 'none';
    if (statusFilterBar) statusFilterBar.style.display = 'none';
    if (sortFilter) sortFilter.style.display = 'none';
    if (searchInput) searchInput.placeholder = 'Buscar site ou obra...';
    renderSitesView();
  }
}

if (navBtnWorks) {
  navBtnWorks.addEventListener('click', () => switchView('works'));
}
if (navBtnSites) {
  navBtnSites.addEventListener('click', () => switchView('sites'));
}

// ── Search & Filter Listeners ─────────────────────────────
let searchDebounceTimer = null;

if (searchInput) {
  searchInput.addEventListener('input', () => {
    if (btnClearSearch) {
      btnClearSearch.style.display = searchInput.value ? 'flex' : 'none';
    }
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      renderCurrentView();
    }, 120);
  });
}

if (btnClearSearch) {
  btnClearSearch.addEventListener('click', () => {
    clearTimeout(searchDebounceTimer);
    if (searchInput) {
      searchInput.value = '';
      searchInput.focus();
    }
    btnClearSearch.style.display = 'none';
    renderCurrentView();
  });
}

function updateStatusFilterOptionLabel() {
  if (!statusFilter) return;
  const lendoOpt = statusFilter.querySelector('option[value="lendo"]');
  if (!lendoOpt) return;
  const cat = categoryFilter ? categoryFilter.value : 'all';
  if (isVideoWorkTag(cat)) {
    lendoOpt.textContent = 'Assistindo';
  } else if (cat !== 'all') {
    lendoOpt.textContent = 'Lendo';
  } else {
    lendoOpt.textContent = 'Lendo / Assistindo';
  }
}

function updateStatusFilterBarUI() {
  if (!statusFilterBar) return;
  const isAll = activeStatusFilters.size >= 5 || activeStatusFilters.has('all');
  statusFilterBar.querySelectorAll('.status-chip').forEach(chip => {
    const st = chip.dataset.status;
    if (st === 'all') {
      chip.classList.toggle('active', isAll);
    } else {
      chip.classList.toggle('active', isAll || activeStatusFilters.has(st));
    }
  });

  if (statusFilter) {
    if (isAll) {
      statusFilter.value = 'all';
    } else if (activeStatusFilters.size === 1) {
      statusFilter.value = Array.from(activeStatusFilters)[0];
    } else {
      statusFilter.value = 'all';
    }
  }
}

if (statusFilterBar) {
  statusFilterBar.querySelectorAll('.status-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const st = chip.dataset.status;
      if (st === 'all') {
        if (activeStatusFilters.size >= 5 || activeStatusFilters.has('all')) {
          activeStatusFilters.clear();
          activeStatusFilters.add('lendo');
        } else {
          activeStatusFilters.clear();
          ['lendo', 'pausado', 'dropado', 'concluido', 'planejo'].forEach(s => activeStatusFilters.add(s));
        }
      } else {
        if (activeStatusFilters.has(st)) {
          if (activeStatusFilters.size > 1) {
            activeStatusFilters.delete(st);
            activeStatusFilters.delete('all');
          } else {
            showToast('Pelo menos um status deve estar selecionado');
            return;
          }
        } else {
          activeStatusFilters.delete('all');
          activeStatusFilters.add(st);
        }
      }
      updateStatusFilterBarUI();
      renderCurrentView();
    });
  });
  updateStatusFilterBarUI();
}

// Fechar qualquer popover de status ao clicar fora
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('click', (e) => {
    if (!e.target || typeof e.target.closest !== 'function') return;
    if (!e.target.closest('.entry-status-wrap')) {
      document.querySelectorAll('.status-popover.open').forEach(p => {
        p.classList.remove('open');
        const parentCard = p.closest('.entry-card');
        if (parentCard) parentCard.style.zIndex = '';
        setTimeout(() => {
          if (!p.classList.contains('open')) {
            p.style.display = 'none';
          }
        }, 150);
      });
    }
  });
}

if (categoryFilter) {
  categoryFilter.addEventListener('change', () => {
    updateStatusFilterOptionLabel();
    renderList();
  });
  updateStatusFilterOptionLabel();
}

if (statusFilter) {
  statusFilter.addEventListener('change', () => {
    const val = statusFilter.value;
    activeStatusFilters.clear();
    if (val === 'all') {
      ['lendo', 'pausado', 'dropado', 'concluido', 'planejo'].forEach(s => activeStatusFilters.add(s));
    } else {
      activeStatusFilters.add(val);
    }
    updateStatusFilterBarUI();
    renderList();
  });
}

if (sortFilter) {
  sortFilter.addEventListener('change', () => {
    renderList();
  });
}

// ── Live Storage and Message Listeners ─────────────────────
if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area === 'local' && (changes.chapter_tracker_entries_v3 || changes.chapter_tracker_entries_v2)) {
      allWorks = await StorageLocal.getWorks();
      renderCurrentView();
    }
    if (area === 'local' && changes.chapter_tracker_notifications_v1) {
      await updateNotificationUnreadDot();
      if (notificationsPanel && notificationsPanel.classList.contains('open')) {
        await renderNotificationsList();
      }
    }
  });
}

if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener(async (msg) => {
    if (msg.action === 'workSaved') {
      allWorks = await StorageLocal.getWorks();
      renderCurrentView();
    }
    if (msg.action === 'notificationAdded') {
      await updateNotificationUnreadDot();
      if (notificationsPanel && notificationsPanel.classList.contains('open')) {
        await renderNotificationsList();
      }
    }
  });
}

// ── Central de Feedback & Sugestões de Mapeamento ─────────
const FEEDBACK_PLACEHOLDERS = {
  site_mapping: 'Informe o site ou scan que você gostaria de ver mapeado no Yekun Dream (máx. 300 caracteres)...',
  bug_report: 'Descreva a falha observada nesta página (ex: capítulo não detectado, player não marcou 70%)...',
  suggestion: 'Envie sua sugestão de melhoria, crítica ou comentário sobre a extensão...'
};

function updateFeedbackContext(tab) {
  if (!tab || !tab.url || (!tab.url.startsWith('http://') && !tab.url.startsWith('https://'))) {
    currentFeedbackContext = { url: '', domain: '', title: '', chapter: '' };
    renderFeedbackContextPreview();
    return;
  }

  currentFeedbackContext.url = tab.url;
  try {
    currentFeedbackContext.domain = new URL(tab.url).hostname.replace(/^www\./, '');
  } catch (_) {
    currentFeedbackContext.domain = '';
  }

  currentFeedbackContext.title = tab.title || '';
  if (typeof titleInput !== 'undefined' && titleInput && titleInput.value) {
    currentFeedbackContext.title = titleInput.value.trim();
  }
  if (typeof currentChapterInput !== 'undefined' && currentChapterInput && currentChapterInput.value) {
    currentFeedbackContext.chapter = currentChapterInput.value.trim();
  }

  renderFeedbackContextPreview();
}

function renderFeedbackContextPreview() {
  if (!feedbackPreviewUrl) return;
  const includeSite = !feedbackIncludeSiteToggle || feedbackIncludeSiteToggle.checked;
  if (!includeSite || !currentFeedbackContext.url) {
    if (feedbackSitePreview) feedbackSitePreview.style.opacity = '0.5';
    feedbackPreviewUrl.textContent = includeSite ? 'Nenhuma página web ativa' : 'Dados da página não serão incluídos';
    if (feedbackPreviewWorkRow) feedbackPreviewWorkRow.style.display = 'none';
    return;
  }

  if (feedbackSitePreview) feedbackSitePreview.style.opacity = '1';
  try {
    const parsed = new URL(currentFeedbackContext.url);
    feedbackPreviewUrl.textContent = `${parsed.hostname}${parsed.pathname}`;
  } catch (_) {
    feedbackPreviewUrl.textContent = currentFeedbackContext.url.substring(0, 50);
  }

  if (currentFeedbackContext.title && feedbackPreviewWorkRow && feedbackPreviewWork) {
    feedbackPreviewWorkRow.style.display = 'flex';
    const chapText = currentFeedbackContext.chapter ? ` (${currentFeedbackContext.chapter})` : '';
    feedbackPreviewWork.textContent = `${currentFeedbackContext.title}${chapText}`;
  } else if (feedbackPreviewWorkRow) {
    feedbackPreviewWorkRow.style.display = 'none';
  }
}

function updateFeedbackCharCounter() {
  if (!feedbackMessage || !feedbackCharCounter) return;
  const count = (feedbackMessage.value || '').length;
  feedbackCharCounter.textContent = `${count} / 300`;
  feedbackCharCounter.classList.toggle('warning', count >= 260 && count < 300);
  feedbackCharCounter.classList.toggle('limit', count >= 300);
}

function showFeedbackStatus(msg, isSuccess) {
  if (!feedbackStatusMsg) return;
  feedbackStatusMsg.textContent = msg;
  feedbackStatusMsg.className = `feedback-status-msg ${isSuccess ? 'success' : 'error'}`;
}

function hideFeedbackStatus() {
  if (!feedbackStatusMsg) return;
  feedbackStatusMsg.textContent = '';
  feedbackStatusMsg.className = 'feedback-status-msg hidden';
}

function initFeedback() {
  if (feedbackMessage) {
    feedbackMessage.addEventListener('input', updateFeedbackCharCounter);
  }

  if (feedbackCategorySelect) {
    feedbackCategorySelect.addEventListener('change', () => {
      const cat = feedbackCategorySelect.value;
      if (feedbackMessage && FEEDBACK_PLACEHOLDERS[cat]) {
        feedbackMessage.placeholder = FEEDBACK_PLACEHOLDERS[cat];
      }
    });
  }

  if (feedbackIncludeSiteToggle) {
    feedbackIncludeSiteToggle.addEventListener('change', renderFeedbackContextPreview);
  }

  if (btnQuickReportSite) {
    btnQuickReportSite.addEventListener('click', (e) => {
      e.stopPropagation();
      if (settingsPanel && !settingsPanel.classList.contains('open')) {
        toggleSettingsDrawer();
      }
      switchToSettingsTab('feedback');
      if (feedbackCategorySelect) {
        if (currentFeedbackContext.title || currentFeedbackContext.chapter) {
          feedbackCategorySelect.value = 'bug_report';
        } else {
          feedbackCategorySelect.value = 'site_mapping';
        }
        feedbackCategorySelect.dispatchEvent(new Event('change'));
      }
      if (feedbackIncludeSiteToggle) {
        feedbackIncludeSiteToggle.checked = true;
        renderFeedbackContextPreview();
      }
      if (feedbackMessage) {
        setTimeout(() => feedbackMessage.focus(), 150);
      }
    });
  }

  if (btnSubmitFeedback) {
    btnSubmitFeedback.addEventListener('click', async () => {
      if (!feedbackMessage) return;
      const category = feedbackCategorySelect ? feedbackCategorySelect.value : 'suggestion';
      const message = feedbackMessage.value.trim();
      const includeSite = feedbackIncludeSiteToggle ? feedbackIncludeSiteToggle.checked : false;
      const userEmail = feedbackEmail ? feedbackEmail.value.trim() : '';

      const payload = {
        category,
        message,
        siteUrl: includeSite ? currentFeedbackContext.url : null,
        detectedTitle: includeSite ? currentFeedbackContext.title : null,
        detectedChapter: includeSite ? currentFeedbackContext.chapter : null,
        userEmail: userEmail || null
      };

      if (typeof FeedbackService === 'undefined') {
        showFeedbackStatus('Módulo de feedback não carregado.', false);
        return;
      }

      const validation = FeedbackService.validatePayload(payload);
      if (!validation.valid) {
        showFeedbackStatus(validation.error, false);
        return;
      }

      const config = {
        supabaseUrl: (appSettings && appSettings.supabaseUrl) || 'https://wbappdsgstzintgznikb.supabase.co',
        supabaseKey: (appSettings && appSettings.supabaseKey) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndiYXBwZHNnc3R6aW50Z3puaWtiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5MTgyMDgsImV4cCI6MjEwNzQ5NDIwOH0.6Wc7YDcKpMCq_IWeo54f3U_14giEfjOAH3f5B019vfE'
      };

      btnSubmitFeedback.disabled = true;
      if (btnSubmitFeedbackText) btnSubmitFeedbackText.textContent = 'Enviando...';
      hideFeedbackStatus();

      try {
        const res = await FeedbackService.submitFeedback(config, payload);
        if (res.success) {
          feedbackMessage.value = '';
          updateFeedbackCharCounter();
          showFeedbackStatus('✓ ' + (res.message || 'Feedback enviado com sucesso!'), true);
          showToast('✓ Feedback enviado com sucesso!');
          setTimeout(() => {
            hideFeedbackStatus();
          }, 5000);
        } else {
          showFeedbackStatus('⚠️ ' + (res.error || 'Falha ao enviar feedback.'), false);
          showToast('⚠️ ' + (res.error || 'Erro no envio'));
        }
      } catch (err) {
        showFeedbackStatus('⚠️ Falha de comunicação: ' + (err.message || 'tente novamente.'), false);
      } finally {
        btnSubmitFeedback.disabled = false;
        if (btnSubmitFeedbackText) btnSubmitFeedbackText.textContent = 'Enviar Feedback';
      }
    });
  }
}

// ── Init ──────────────────────────────────────────────────
(async function init() {
  initThemeSwitcher();
  initSettingsTabs();
  initToggleHelpTooltips();
  initFeedback();

  try {
    let settings = {};
    let works = [];

    if (typeof StorageLocal !== 'undefined' && StorageLocal.getInitialData) {
      const initialData = await StorageLocal.getInitialData();
      settings = initialData.settings || {};
      works = initialData.works || [];
    } else {
      const [s, w] = await Promise.all([
        (typeof StorageLocal !== 'undefined' && StorageLocal.getSettings) ? StorageLocal.getSettings() : Promise.resolve({}),
        (typeof StorageLocal !== 'undefined' && StorageLocal.getWorks) ? StorageLocal.getWorks() : Promise.resolve([])
      ]);
      settings = s || {};
      works = w || [];
    }

    appSettings = settings || {};
    allWorks = Array.isArray(works) ? works : [];

    applyTheme(appSettings.theme || 'dark', false);
    renderCurrentView();
    syncBottomNavVisibility();

    // Carrega detalhes essenciais da tela principal e agenda detalhes de abas fechadas
    updateCurrentSiteToggleUI();
    updateNotificationUnreadDot();
    loadSettingsToUI(appSettings, { deferSecondary: true });

    // Se o usuário possui conta PRO ativa, realiza pull da nuvem se obras estiverem vazias e sincroniza preferências
    if (typeof SyncService !== 'undefined') {
      SyncService.getClientConfig().then(async conf => {
        if (conf && conf.isPro && conf.syncKey) {
          if (allWorks.length === 0 && SyncService.pullRemote) {
            const pullRes = await SyncService.pullRemote();
            if (pullRes && pullRes.pulled > 0) {
              allWorks = await StorageLocal.getWorks();
              renderCurrentView();
              showToast(`✓ ${pullRes.pulled} obras sincronizadas da nuvem!`);
            }
          }
          if (SyncService.syncSettings) {
            const setRes = await SyncService.syncSettings();
            if (setRes && setRes.action === 'pulled') {
              const freshSettings = await StorageLocal.getSettings();
              appSettings = freshSettings;
              loadSettingsToUI(appSettings);
            }
          }
        }
      }).catch(() => {});
    }
  } catch (err) {
    console.error('Falha na inicialização do popup:', err);
    await loadSettingsToUI();
    allWorks = await StorageLocal.getWorks();
    renderCurrentView();
  }
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getConsolidatedSites,
    filterWorks,
    sortWorks,
    getWorkInitials,
    formatRelativeTime,
    isTabForWork,
    handleQuickIncrement,
    setSelectedReleaseDays,
    getSelectedReleaseDays
  };
}
