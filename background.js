/* ════════════════════════════════════════════════════════
   Chapter Tracker — background.js (Service Worker)
   Gerenciamento de alarmes periódicos de sincronização
   e comunicação em segundo plano.
   ════════════════════════════════════════════════════════ */

try {
  importScripts('storage-local.js', 'identity-service.js', 'sync-service.js');
} catch (e) {
  console.warn('importScripts failed in worker environment:', e);
}

const SYNC_ALARM = 'chapter_tracker_sync_alarm';

async function syncActionIcon() {
  if (typeof StorageLocal !== 'undefined' && typeof chrome !== 'undefined' && chrome.action && chrome.action.setIcon) {
    try {
      const settings = await StorageLocal.getSettings();
      const valid = ['dark', 'light', 'pink'].includes(settings.theme) ? settings.theme : 'dark';
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
    } catch (_) {}
  }
}

const RELEASE_ALARM_MORNING = 'release_alarm_morning';
const RELEASE_ALARM_EVENING = 'release_alarm_evening';
const NOTIF_URLS_STORAGE_KEY = 'chapter_tracker_notif_urls';
const notificationUrlMap = new Map();

async function saveNotificationUrl(notifId, targetUrl) {
  notificationUrlMap.set(notifId, targetUrl);
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    try {
      chrome.storage.local.get([NOTIF_URLS_STORAGE_KEY], (res) => {
        const map = res && res[NOTIF_URLS_STORAGE_KEY] ? res[NOTIF_URLS_STORAGE_KEY] : {};
        map[notifId] = targetUrl;
        const keys = Object.keys(map);
        if (keys.length > 50) {
          keys.slice(0, keys.length - 50).forEach(k => delete map[k]);
        }
        chrome.storage.local.set({ [NOTIF_URLS_STORAGE_KEY]: map });
      });
    } catch (_) {}
  }
}

async function getNotificationUrl(notifId) {
  if (notificationUrlMap.has(notifId)) {
    return notificationUrlMap.get(notifId);
  }
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    try {
      return new Promise(resolve => {
        chrome.storage.local.get([NOTIF_URLS_STORAGE_KEY], (res) => {
          const map = res && res[NOTIF_URLS_STORAGE_KEY] ? res[NOTIF_URLS_STORAGE_KEY] : {};
          resolve(map[notifId] || '');
        });
      });
    } catch (_) {}
  }
  return '';
}

function getNextAlarmTime(targetHour, targetMinute = 0) {
  const now = new Date();
  const next = new Date();
  next.setHours(targetHour, targetMinute, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next.getTime();
}

async function scheduleReleaseAlarms() {
  if (typeof chrome === 'undefined' || !chrome.alarms) return;
  const settings = (typeof StorageLocal !== 'undefined' && StorageLocal.getSettings)
    ? await StorageLocal.getSettings()
    : { enableReleaseNotifications: true, enableMorningNotification: true, enableEveningNotification: true };

  if (settings.enableReleaseNotifications !== false) {
    if (settings.enableMorningNotification !== false) {
      chrome.alarms.create(RELEASE_ALARM_MORNING, {
        when: getNextAlarmTime(8, 0),
        periodInMinutes: 1440
      });
    } else {
      chrome.alarms.clear(RELEASE_ALARM_MORNING);
    }

    if (settings.enableEveningNotification !== false) {
      chrome.alarms.create(RELEASE_ALARM_EVENING, {
        when: getNextAlarmTime(17, 0),
        periodInMinutes: 1440
      });
    } else {
      chrome.alarms.clear(RELEASE_ALARM_EVENING);
    }
  } else {
    chrome.alarms.clear(RELEASE_ALARM_MORNING);
    chrome.alarms.clear(RELEASE_ALARM_EVENING);
  }
}

async function handleReleaseAlarm(alarmName) {
  if (typeof StorageLocal === 'undefined') return;
  const settings = await StorageLocal.getSettings();
  if (settings.enableReleaseNotifications === false) return;

  const isMorning = alarmName === RELEASE_ALARM_MORNING;
  if (isMorning && settings.enableMorningNotification === false) return;
  if (!isMorning && settings.enableEveningNotification === false) return;

  const currentDay = new Date().getDay();
  const eligibleWorks = await StorageLocal.getEligibleReleasingWorks(currentDay);
  if (!eligibleWorks || eligibleWorks.length === 0) return;

  const type = isMorning ? 'morning' : 'evening';
  const names = eligibleWorks.map(w => w.name);
  const titlesSummary = names.length === 1
    ? names[0]
    : (names.length === 2 ? `${names[0]} e ${names[1]}` : `${names.slice(0, 2).join(', ')} e +${names.length - 2}`);

  const notifTitle = isMorning
    ? `☀️ Lançamentos de Hoje — Yekun Dream`
    : `🌆 Disponível Agora — Yekun Dream`;

  const notifMessage = isMorning
    ? `Hoje é dia de novo lançamento de: ${titlesSummary}!`
    : `Novos episódios/capítulos já devem estar no ar: ${titlesSummary}. Bora conferir?`;

  const primaryWork = eligibleWorks[0];
  const activeSource = (primaryWork.sources || []).find(s => s.id === primaryWork.lastReadSourceId) || (primaryWork.sources && primaryWork.sources[0]) || {};
  const targetUrl = activeSource.url || '';

  // Registra cada obra elegível no histórico do sininho
  for (const work of eligibleWorks) {
    const src = (work.sources || []).find(s => s.id === work.lastReadSourceId) || (work.sources && work.sources[0]) || {};
    await StorageLocal.addNotificationHistoryItem({
      workId: work.id,
      workName: work.name,
      type,
      url: src.url || '',
      tag: work.tag || 'anime'
    });
  }

  // Dispara notificação nativa do sistema
  if (typeof chrome !== 'undefined' && chrome.notifications && chrome.notifications.create) {
    const notifId = `yekun_rel_${type}_${Date.now()}`;
    await saveNotificationUrl(notifId, targetUrl);

    chrome.notifications.create(notifId, {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: notifTitle,
      message: notifMessage,
      priority: 2
    });
  }
}

// Configura alarme na inicialização / instalação
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onInstalled) {
  chrome.runtime.onInstalled.addListener(() => {
    if (chrome.alarms) chrome.alarms.create(SYNC_ALARM, { periodInMinutes: 15 });
    scheduleReleaseAlarms();
    syncActionIcon();
  });
}

if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onStartup) {
  chrome.runtime.onStartup.addListener(async () => {
    if (chrome.alarms) chrome.alarms.create(SYNC_ALARM, { periodInMinutes: 15 });
    scheduleReleaseAlarms();
    syncActionIcon();
    if (typeof StorageLocal !== 'undefined' && typeof SyncService !== 'undefined') {
      const settings = await StorageLocal.getSettings();
      if (settings.enableAutoSync && settings.syncKey) {
        await SyncService.syncAll();
      }
    }
  });
}

// Listener de alarmes periódicos
if (typeof chrome !== 'undefined' && chrome.alarms && chrome.alarms.onAlarm) {
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === SYNC_ALARM) {
      if (typeof StorageLocal !== 'undefined' && typeof SyncService !== 'undefined') {
        const settings = await StorageLocal.getSettings();
        if (settings.enableAutoSync && settings.syncKey) {
          await SyncService.syncAll();
        }
      }
    } else if (alarm.name === RELEASE_ALARM_MORNING || alarm.name === RELEASE_ALARM_EVENING) {
      await handleReleaseAlarm(alarm.name);
    }
  });
}

// Listener de clique nas notificações do Chrome
if (typeof chrome !== 'undefined' && chrome.notifications && chrome.notifications.onClicked) {
  chrome.notifications.onClicked.addListener(async (notifId) => {
    const url = await getNotificationUrl(notifId);
    if (url && chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url });
    }
  });
}

// Listener de mensagens manuais
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
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
}

// Listener de alteração de configurações para ícone dinâmico e reagendamento
if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.chapter_tracker_settings) {
      const newSettings = changes.chapter_tracker_settings.newValue;
      if (newSettings && newSettings.theme) {
        syncActionIcon();
      }
      scheduleReleaseAlarms();
    }
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getNextAlarmTime,
    scheduleReleaseAlarms,
    handleReleaseAlarm,
    saveNotificationUrl,
    getNotificationUrl,
    RELEASE_ALARM_MORNING,
    RELEASE_ALARM_EVENING
  };
}

