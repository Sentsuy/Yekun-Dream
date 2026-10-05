/* ════════════════════════════════════════════════════════
   Chapter Tracker — background.js (Service Worker)
   Gerenciamento de alarmes periódicos de sincronização
   e comunicação em segundo plano.
   ════════════════════════════════════════════════════════ */

try {
  importScripts('storage-local.js', 'sync-service.js');
} catch (e) {
  console.warn('importScripts failed in worker environment:', e);
}

const SYNC_ALARM = 'chapter_tracker_sync_alarm';

// Configura alarme na inicialização / instalação
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(SYNC_ALARM, { periodInMinutes: 15 });
});

chrome.runtime.onStartup.addListener(async () => {
  chrome.alarms.create(SYNC_ALARM, { periodInMinutes: 15 });
  if (typeof StorageLocal !== 'undefined' && typeof SyncService !== 'undefined') {
    const settings = await StorageLocal.getSettings();
    if (settings.enableAutoSync && settings.syncKey) {
      await SyncService.syncAll();
    }
  }
});

// Listener de alarmes periódicos
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === SYNC_ALARM) {
    if (typeof StorageLocal !== 'undefined' && typeof SyncService !== 'undefined') {
      const settings = await StorageLocal.getSettings();
      if (settings.enableAutoSync && settings.syncKey) {
        await SyncService.syncAll();
      }
    }
  }
});

// Listener de mensagens manuais
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'syncNow') {
    if (typeof SyncService !== 'undefined') {
      SyncService.syncAll().then(res => sendResponse(res)).catch(err => sendResponse({ ok: false, error: err.message }));
      return true; // assíncrono
    } else {
      sendResponse({ ok: false, error: 'SyncService indisponível' });
    }
  }
});
