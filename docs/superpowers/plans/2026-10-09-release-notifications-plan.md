# Release Day Notifications & Bell History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement morning (08:00) and evening (17:00) release day notifications, week-day schedule chips, AniList schedule inference, omission of hiatus/cancelled works, and a 20-item notification bell history drawer.

**Architecture:** Extend WorkEntry schema with `releaseDays` and StorageLocal with notification history management capped at 20 items. Update background service worker with `chrome.alarms` and `chrome.notifications`, update AniList GraphQL query in CanonicalResolver for airing schedule, and add a Bell button with an unread badge and drawer in the popup.

**Tech Stack:** Chrome Extension Manifest V3, Service Worker (`chrome.alarms`, `chrome.notifications`), Vanilla JS, CSS3 Variables, AniList GraphQL API, Node.js assert.

**Spec:** `docs/superpowers/specs/2026-10-09-release-day-notifications-and-bell-history-design.md`

## Global Constraints

- Never notify works marked as `publicationStatus === 'hiatus'`, `publicationStatus === 'cancelled'`, `readingStatus === 'dropado'`, or `readingStatus === 'concluido'`.
- Strict cap of 20 items in `notificationsHistory` to prevent storage bloat.
- Preserve 100% pass rate across existing 39 test suites.
- Respect user theme styling (dark, light, pink) across all new UI elements.

## Review Focus

1. Works in hiatus or cancelled must be completely skipped even if they have today's day-of-week selected.
2. Notifications history must never exceed 20 items under continuous additions.
3. Alarms scheduled at 08:00 and 17:00 must correctly calculate future timestamp when current time is past or before the target.
4. AniList GraphQL response with `nextAiringEpisode` must translate into local day of week without throwing on missing fields.
5. Notification click in Chrome must properly navigate to active source URL.

---

### Task 1: Manifest Permissions and Storage Settings Model

**Files:**
- Modify: `manifest.json`
- Modify: `storage-local.js`
- Test: `tests/test-release-notifications.js`

- [ ] **Step 1: Write failing unit test for permissions, settings, and releaseDays storage**
  Create `tests/test-release-notifications.js` asserting `DEFAULT_SETTINGS.enableReleaseNotifications === true`, `releaseDays` persistence on `saveWorkReading`, and notification history methods.
- [ ] **Step 2: Run test to confirm it fails**
  Run `node tests/test-release-notifications.js`.
- [ ] **Step 3: Update `manifest.json`**
  Add `"notifications"` to `permissions` array in `manifest.json`.
- [ ] **Step 4: Update `storage-local.js` settings and notification history management**
  Add `enableReleaseNotifications: true`, `enableMorningNotification: true`, `enableEveningNotification: true` to `DEFAULT_SETTINGS`.
  Add `getNotificationsHistory()`, `addNotificationHistoryItem(item)`, `markNotificationsRead()`, and `clearNotificationsHistory()` with 20-item cap.
  Support `releaseDays` in `saveWorkReading` and `updateWorkDetails`.
- [ ] **Step 5: Run unit tests to verify they pass**
  Run `node tests/test-release-notifications.js`.

---

### Task 2: Eligibility Filtering & Hiatus/Cancellation Guard

**Files:**
- Modify: `storage-local.js`
- Test: `tests/test-release-notifications.js`

- [ ] **Step 1: Add failing unit tests for eligibility filter**
  Add assertions in `tests/test-release-notifications.js` testing `getEligibleReleasingWorks(dayOfWeek)`.
  Ensure works in hiatus, cancelled, dropado, or concluido are omitted even with matching `releaseDays`.
- [ ] **Step 2: Run test to confirm failure**
  Run `node tests/test-release-notifications.js`.
- [ ] **Step 3: Implement `getEligibleReleasingWorks(dayOfWeek)` in `storage-local.js`**
  Implement filter verifying active reading status (`lendo`, `planejo`), active publication status (`releasing`, `upcoming`, or unspecified), and inclusion of `dayOfWeek` in `releaseDays`.
- [ ] **Step 4: Run unit tests to verify pass**
  Run `node tests/test-release-notifications.js`.

---

### Task 3: AniList Airing Schedule Inference in Canonical Resolver

**Files:**
- Modify: `canonical-resolver.js`
- Test: `tests/test-release-notifications.js`

- [ ] **Step 1: Add failing test for AniList schedule inference**
  Assert that `resolveAniListSchedule(media)` extracts `nextAiringEpisode.airingAt` and returns `releaseDay` (0 to 6).
- [ ] **Step 2: Run test to confirm failure**
  Run `node tests/test-release-notifications.js`.
- [ ] **Step 3: Update AniList GraphQL query and parsing in `canonical-resolver.js`**
  Add `nextAiringEpisode { airingAt episode }` to GraphQL query.
  Export helper to calculate local day of week from timestamp.
- [ ] **Step 4: Run test to verify pass**
  Run `node tests/test-release-notifications.js`.

---

### Task 4: Background Service Worker Alarms & System Notifications

**Files:**
- Modify: `background.js`
- Test: `tests/test-release-notifications.js`

- [ ] **Step 1: Add test verifying alarm scheduling calculation and notification builder**
  Add test in `tests/test-release-notifications.js` verifying alarm target time calculations for 08:00 and 17:00.
- [ ] **Step 2: Implement alarm setup and listener in `background.js`**
  Create alarms `release_alarm_morning` and `release_alarm_evening`.
  Handle alarm execution: fetch eligible works, dispatch `chrome.notifications.create`, record to notification history (max 20).
  Add `chrome.notifications.onClicked` listener to open source URL in a new tab.
- [ ] **Step 3: Run test to verify pass**
  Run `node tests/test-release-notifications.js`.

---

### Task 5: Popup UI — Bell Button, Unread Badge & Notifications Drawer

**Files:**
- Modify: `popup.html`
- Modify: `popup.css`
- Modify: `popup.js`
- Test: `tests/test-release-notifications.js`

- [ ] **Step 1: Add HTML for Bell Button and Notifications Drawer in `popup.html`**
  Add `#btnNotifications` in header with `.notif-unread-dot`.
  Add `#notificationsPanel` drawer containing header (title, clear button, close button) and `#notificationsList`.
  Add day-of-week chip selector (`.weekday-picker`) to edit form.
  Add settings toggles in `#settingsPanel`.
- [ ] **Step 2: Add styles in `popup.css`**
  Style `#btnNotifications`, unread dot, `#notificationsPanel`, notification cards, and `.weekday-picker` chips.
- [ ] **Step 3: Wire interactivity in `popup.js`**
  Toggle notifications drawer, render up to 20 notifications, mark as read on open, handle clear history, handle opening notification URL.
  Bind weekday picker chips in work form.
- [ ] **Step 4: Update `tests/test-release-notifications.js` and `tests/run-all-tests.js`**
  Add DOM assertions and include the test suite in `tests/run-all-tests.js`.
- [ ] **Step 5: Run full test suite to guarantee 100% pass rate**
  Run `node tests/run-all-tests.js`.
