const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Mock Chrome environment for StorageLocal tests
const memoryStore = {};
global.chrome = {
  storage: {
    local: {
      get: (keys, cb) => {
        if (typeof keys === 'string') {
          const res = {};
          res[keys] = memoryStore[keys];
          if (cb) cb(res);
          return Promise.resolve(res);
        }
        if (Array.isArray(keys)) {
          const res = {};
          keys.forEach(k => { res[k] = memoryStore[k]; });
          if (cb) cb(res);
          return Promise.resolve(res);
        }
        if (cb) cb(memoryStore);
        return Promise.resolve(memoryStore);
      },
      set: (items, cb) => {
        Object.assign(memoryStore, items);
        if (cb) cb();
        return Promise.resolve();
      }
    }
  }
};

const { StorageLocal, DEFAULT_SETTINGS } = require('../storage-local.js');

async function runTests() {
  console.log('=== TEST SUITE: Release Day Notifications & Bell History ===\n');

  // 1. Settings Verification
  console.log('1. Checking default settings...');
  assert.strictEqual(DEFAULT_SETTINGS.enableReleaseNotifications, true, 'Default setting enableReleaseNotifications must be true');
  assert.strictEqual(DEFAULT_SETTINGS.enableMorningNotification, true, 'Default setting enableMorningNotification must be true');
  assert.strictEqual(DEFAULT_SETTINGS.enableEveningNotification, true, 'Default setting enableEveningNotification must be true');
  console.log('✓ Default settings verified.');

  // 2. Manifest Permissions Verification
  console.log('2. Checking manifest.json permissions...');
  const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../manifest.json'), 'utf8'));
  assert.ok(Array.isArray(manifest.permissions) && manifest.permissions.includes('notifications'), 'manifest.json must include notifications permission');
  console.log('✓ Manifest permissions verified.');

  // 3. Work releaseDays persistence
  console.log('3. Testing releaseDays persistence on saveWorkReading and updateWorkDetails...');
  const work1 = await StorageLocal.saveWorkReading({
    workName: 'Solo Leveling',
    chapter: 'Cap. 100',
    releaseDays: [3], // Quarta-feira
    tag: 'manhwa'
  });
  assert.deepStrictEqual(work1.releaseDays, [3], 'releaseDays must be saved on work creation');

  const updated1 = await StorageLocal.updateWorkDetails(work1.id, {
    releaseDays: [1, 3, 5] // Seg, Qua, Sex
  });
  assert.deepStrictEqual(updated1.releaseDays, [1, 3, 5], 'releaseDays must be updated on updateWorkDetails');
  console.log('✓ releaseDays persisted correctly.');

  // 4. Notification History Management (Capped at 20)
  console.log('4. Testing notification history management (cap of 20 items)...');
  await StorageLocal.clearNotificationsHistory();
  let history = await StorageLocal.getNotificationsHistory();
  assert.strictEqual(history.length, 0, 'History must be empty initially');

  // Add 25 notification items to ensure capping at 20
  for (let i = 1; i <= 25; i++) {
    await StorageLocal.addNotificationHistoryItem({
      workId: work1.id,
      workName: `Obra ${i}`,
      type: i % 2 === 0 ? 'morning' : 'evening',
      url: `https://site.com/obra-${i}`,
      tag: 'anime'
    });
  }

  history = await StorageLocal.getNotificationsHistory();
  assert.strictEqual(history.length, 20, 'History must be capped at exactly 20 items');
  assert.strictEqual(history[0].workName, 'Obra 25', 'Latest notification must be first');
  assert.strictEqual(history[history.length - 1].workName, 'Obra 6', 'Oldest item beyond 20 must be purged');
  assert.strictEqual(history[0].read, false, 'New notifications must be unread');

  // Mark all as read
  await StorageLocal.markNotificationsRead();
  history = await StorageLocal.getNotificationsHistory();
  assert.ok(history.every(item => item.read === true), 'All notifications must be marked read');

  console.log('✓ Notification history capped at 20 and read state managed.');

  // 5. Eligibility Filter (Hiatus & Cancellation Guard)
  console.log('5. Testing getEligibleReleasingWorks with Hiatus/Cancellation Guard...');
  // work1: releasing on Wednesday (3), active
  // work2: releaseDays: [3], but hiatus -> MUST BE OMITTED
  const work2 = await StorageLocal.saveWorkReading({
    workName: 'Hunter x Hunter',
    chapter: 'Cap. 390',
    releaseDays: [3],
    publicationStatus: 'hiatus',
    readingStatus: 'lendo'
  });

  // work3: releaseDays: [3], but cancelled -> MUST BE OMITTED
  const work3 = await StorageLocal.saveWorkReading({
    workName: 'Act-Age',
    chapter: 'Cap. 120',
    releaseDays: [3],
    publicationStatus: 'cancelled',
    readingStatus: 'lendo'
  });

  // work4: releaseDays: [3], but dropado -> MUST BE OMITTED
  const work4 = await StorageLocal.saveWorkReading({
    workName: 'Dropada Series',
    chapter: 'Cap. 10',
    releaseDays: [3],
    readingStatus: 'dropado'
  });

  // work5: releaseDays: [3], but concluido -> MUST BE OMITTED
  const work5 = await StorageLocal.saveWorkReading({
    workName: 'Concluida Series',
    chapter: 'Cap. 200',
    releaseDays: [3],
    readingStatus: 'concluido'
  });

  // work6: releaseDays: [3], publicationStatus: releasing, readingStatus: lendo -> MUST BE INCLUDED
  const work6 = await StorageLocal.saveWorkReading({
    workName: 'One Piece',
    chapter: 'Cap. 1100',
    releaseDays: [3],
    publicationStatus: 'releasing',
    readingStatus: 'lendo'
  });

  const eligibleWed = await StorageLocal.getEligibleReleasingWorks(3);
  const eligibleIds = eligibleWed.map(w => w.id);
  assert.ok(eligibleIds.includes(work1.id), 'Active work1 must be eligible');
  assert.ok(eligibleIds.includes(work6.id), 'Active work6 must be eligible');
  assert.strictEqual(eligibleIds.includes(work2.id), false, 'Hiatus work2 must NOT be eligible');
  assert.strictEqual(eligibleIds.includes(work3.id), false, 'Cancelled work3 must NOT be eligible');
  assert.strictEqual(eligibleIds.includes(work4.id), false, 'Dropado work4 must NOT be eligible');
  assert.strictEqual(eligibleIds.includes(work5.id), false, 'Concluido work5 must NOT be eligible');

  // Check another day (e.g., day 2 - Tuesday)
  const eligibleTue = await StorageLocal.getEligibleReleasingWorks(2);
  assert.strictEqual(eligibleTue.length, 0, 'No works should be eligible on Tuesday');

  console.log('✓ Eligibility filter correctly guards against hiatus, cancellation, and finished/dropped works.');

  // 6. AniList Schedule Inference
  console.log('6. Testing AniList airing schedule inference...');
  const CanonicalResolver = require('../canonical-resolver.js');
  assert.strictEqual(typeof CanonicalResolver.getDayOfWeekFromTimestamp, 'function');

  // Specific Wednesday timestamp test: 2026-10-14 12:00:00 UTC = Wednesday (day 3)
  const wedTimestamp = 1791979200; // 2026-10-14 12:00:00 UTC
  const parsedDay = CanonicalResolver.getDayOfWeekFromTimestamp(wedTimestamp);
  assert.strictEqual(parsedDay, 3, 'Timestamp for Wednesday must return day 3');

  const mockAniListWithAiring = {
    id: 99999,
    status: 'RELEASING',
    title: { english: 'DanDaDan', romaji: 'Dandadan' },
    synonyms: ['Dandadan Anime'],
    nextAiringEpisode: {
      airingAt: wedTimestamp,
      episode: 3
    }
  };
  const parsedMedia = CanonicalResolver.parseAniListMedia(mockAniListWithAiring);
  assert.strictEqual(parsedMedia.canonicalTitle, 'DanDaDan');
  assert.strictEqual(parsedMedia.releaseDay, 3, 'Must extract releaseDay = 3 from nextAiringEpisode');

  console.log('✓ AniList schedule inference parsed correctly.');

  // 7. Background Alarms and Handlers
  console.log('7. Testing background alarms and handlers...');
  const background = require('../background.js');
  assert.strictEqual(typeof background.getNextAlarmTime, 'function');
  const next8am = background.getNextAlarmTime(8, 0);
  assert.ok(next8am > Date.now(), 'Next 8am alarm time must be in the future');
  const next5pm = background.getNextAlarmTime(17, 0);
  assert.ok(next5pm > Date.now(), 'Next 5pm alarm time must be in the future');
  console.log('✓ Background alarms verified.');

  // 8. Popup UI & CSS Verification
  console.log('8. Testing Popup UI HTML, CSS, and JS wiring...');
  const popupHtml = fs.readFileSync(path.resolve(__dirname, '../popup.html'), 'utf8');
  assert.ok(popupHtml.includes('id="btnNotifications"'), 'popup.html must have btnNotifications');
  assert.ok(popupHtml.includes('id="notifUnreadDot"'), 'popup.html must have notifUnreadDot');
  assert.ok(popupHtml.includes('id="notificationsPanel"'), 'popup.html must have notificationsPanel');
  assert.ok(popupHtml.includes('id="notificationsList"'), 'popup.html must have notificationsList');
  assert.ok(popupHtml.includes('id="notificationsEmpty"'), 'popup.html must have notificationsEmpty');
  assert.ok(popupHtml.includes('id="btnClearNotifs"'), 'popup.html must have btnClearNotifs');
  assert.ok(popupHtml.includes('id="btnCloseNotifs"'), 'popup.html must have btnCloseNotifs');
  assert.ok(popupHtml.includes('id="weekdayPicker"'), 'popup.html must have weekdayPicker');
  assert.ok(popupHtml.includes('id="toggleReleaseNotifications"'), 'popup.html must have toggleReleaseNotifications');
  assert.ok(popupHtml.includes('id="toggleMorningNotification"'), 'popup.html must have toggleMorningNotification');
  assert.ok(popupHtml.includes('id="toggleEveningNotification"'), 'popup.html must have toggleEveningNotification');
  assert.strictEqual(/[📖🌐↗✎✕＋▼⚙]/.test(popupHtml), false, 'popup.html must not contain legacy icon emojis/glyphs');

  const popupCss = fs.readFileSync(path.resolve(__dirname, '../popup.css'), 'utf8');
  assert.ok(popupCss.includes('.notifications-panel'), 'popup.css must style .notifications-panel');
  assert.ok(popupCss.includes('.notif-card'), 'popup.css must style .notif-card');
  assert.ok(popupCss.includes('.notif-unread-dot'), 'popup.css must style .notif-unread-dot');
  assert.ok(popupCss.includes('.weekday-picker'), 'popup.css must style .weekday-picker');
  assert.ok(popupCss.includes('.weekday-btn'), 'popup.css must style .weekday-btn');
  assert.ok(popupCss.includes('.entry-days-badge'), 'popup.css must style .entry-days-badge');

  const popupJs = fs.readFileSync(path.resolve(__dirname, '../popup.js'), 'utf8');
  assert.ok(popupJs.includes('btnNotifications'), 'popup.js must reference btnNotifications');
  assert.ok(popupJs.includes('notificationsPanel'), 'popup.js must reference notificationsPanel');
  assert.ok(popupJs.includes('toggleNotificationsDrawer'), 'popup.js must define toggleNotificationsDrawer');
  assert.ok(popupJs.includes('renderNotificationsList'), 'popup.js must define renderNotificationsList');
  assert.ok(popupJs.includes('updateNotificationUnreadDot'), 'popup.js must define updateNotificationUnreadDot');
  assert.ok(popupJs.includes('weekdayPicker'), 'popup.js must reference weekdayPicker');
  assert.ok(popupJs.includes('setSelectedReleaseDays'), 'popup.js must define setSelectedReleaseDays');
  assert.ok(popupJs.includes('getSelectedReleaseDays'), 'popup.js must define getSelectedReleaseDays');
  assert.ok(popupJs.includes('toggleReleaseNotifications'), 'popup.js must reference toggleReleaseNotifications');
  assert.ok(popupJs.includes('releaseDaysBadge'), 'popup.js must format releaseDaysBadge');
  assert.strictEqual(/[📖🌐↗✎✕＋▼⚙]/.test(popupJs), false, 'popup.js must not contain legacy icon emojis/glyphs');
  console.log('✓ Popup UI, CSS, and JS verified.');

  console.log('\nAll release day notifications unit tests passed successfully!');
}

runTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
