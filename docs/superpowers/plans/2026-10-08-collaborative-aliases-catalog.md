# Collaborative Aliases & Canonical Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a hybrid multi-layer title resolution and crowdsourced alias catalog with consensus/integrity validation, enabling Chapter Tracker to identify works by their Portuguese, English, or Romaji names across any scan or reader site without manual duplication.

**Architecture:** 
1. Cache & local storage checks first (0ms).
2. Canonical public resolver querying AniList & MangaDex for official alternate titles and canonical IDs.
3. Crowdsourced alias service with quorum verification (>= 2 votes = verified), 1-to-1 conflict lock, and strict sanitization.
4. Smooth UI in content script (automatic link with subtle toast badge on high confidence, or 1-click quick-link dialog for unresolved titles) and alias management in popup edit form.

**Tech Stack:** JavaScript (ES6+ / Web Extensions API), AniList GraphQL, MangaDex REST API, Chrome Storage Local / Sync, Node.js assert test framework.

**Spec:** `/home/sentsuy/.gemini/antigravity-cli/brain/7e6ae7db-4bc2-4877-90ac-3228ba1a4f87/collaborative-alias-architecture.md`

## Global Constraints
- Pure vanilla JS without heavy external build dependencies (fully compatible with Chrome Manifest V3).
- Strict non-blocking network calls (timeouts of max 2500ms for network lookups, never blocking page rendering).
- Data integrity: 1-to-1 conflict prevention (one alias cannot point to two canonical works).
- Quorum rules: 1 vote = pending (soft prompt), >= 2 votes = verified (auto-resolution).
- Zero regression on all existing 24 test suites.

## Review Focus
1. Malformed or slow network requests from AniList/MangaDex APIs must gracefully fallback to local heuristic without throwing unhandled exceptions.
2. An alias that contains chapter numbers, URLs, or HTML entities must be sanitized and rejected before entering the alias catalog.
3. Two different users attempting to map the same alias to two conflicting canonical works must trigger conflict lock rather than overwriting.
4. Selecting a work from the "Vincular a uma obra existente" dropdown must update existing work sources, add the alias, and never create a duplicate entry.
5. All 24 existing test suites plus the new test suites must pass 100%.

---

### Task 1: Canonical Public Resolver Module (`canonical-resolver.js`)

**Files:**
- Create: `canonical-resolver.js`
- Create: `tests/test-canonical-resolver.js`

**Step 1: Write failing tests for CanonicalResolver**
- [ ] Create `tests/test-canonical-resolver.js` asserting:
  - `queryAniListTitles(titleOrSlug)` parses English, Romaji, and synonyms from mock GraphQL responses.
  - `queryMangaDexTitles(titleOrSlug)` parses altTitles and primary title from mock REST responses.
  - `resolveCanonicalAliases(titleOrSlug)` aggregates all aliases with timeout safety and error handling.
- [ ] Run `node tests/test-canonical-resolver.js` and verify it fails (module not found).

**Step 2: Implement CanonicalResolver**
- [ ] Create `canonical-resolver.js` with:
  - Lightweight fetch implementation for AniList GraphQL (`https://graphql.anilist.co`).
  - Lightweight fetch implementation for MangaDex API (`https://api.mangadex.org/manga`).
  - AbortController with 2500ms timeout.
  - Aggregator returning `{ canonicalTitle, externalId, aliases: string[] }`.
  - Export for Node.js (`module.exports`) and Browser (`window.CanonicalResolver`).
- [ ] Run `node tests/test-canonical-resolver.js` and verify all assertions pass.

---

### Task 2: Crowdsourced Alias Sync & Consensus Engine (`alias-crowd-service.js`)

**Files:**
- Create: `alias-crowd-service.js`
- Create: `tests/test-alias-crowd-service.js`

**Step 1: Write failing tests for AliasCrowdService**
- [ ] Create `tests/test-alias-crowd-service.js` asserting:
  - Sanitization rejects invalid titles (URLs, length < 3 or > 120, profanity/spam).
  - Normalization strips diacritics and delimiters.
  - Submitting an alias assigns `votes: 1` and `status: "pending"`.
  - A second independent submission increments votes to 2 and upgrades status to `"verified"`.
  - Conflicting submission (same alias mapped to different canonical work) throws/flags a conflict and preserves original verified mapping.
- [ ] Run `node tests/test-alias-crowd-service.js` and verify it fails.

**Step 2: Implement AliasCrowdService**
- [ ] Create `alias-crowd-service.js` with:
  - Sanitizer function `sanitizeAliasInput(alias)`.
  - Quorum threshold constant `QUORUM_THRESHOLD = 2`.
  - Local catalog cache in `chrome.storage.local` with provider plug for cloud sync.
  - `lookupAlias(rawTitle)` returning `{ match: object | null, isVerified: boolean }`.
  - `submitAliasLink({ alias, canonicalTitle, externalId, sourceDomain })`.
  - Export for Node.js and Browser.
- [ ] Run `node tests/test-alias-crowd-service.js` and verify all assertions pass.

---

### Task 3: Integration into Local Storage & Floating Button UI (`storage-local.js` & `content.js`)

**Files:**
- Modify: `storage-local.js`
- Modify: `content.js`
- Create: `tests/test-collaborative-alias-integration.js`

**Step 1: Write failing integration tests**
- [ ] Create `tests/test-collaborative-alias-integration.js` asserting:
  - `StorageLocal.findMatchingWork` consults CanonicalResolver and AliasCrowdService when local match fails.
  - When verified alias is found, returns existing work without creating duplicate.
  - In `content.js`, selecting "Vincular a uma obra existente" submits the link to AliasCrowdService and records alias locally.
- [ ] Run `node tests/test-collaborative-alias-integration.js` and verify it fails.

**Step 2: Update `storage-local.js` and `content.js`**
- [ ] In `storage-local.js`, wire `resolvePageWorkDetails` and `findMatchingWork` to utilize `CanonicalResolver` and `AliasCrowdService`.
- [ ] In `content.js`:
  - Enhance the floating button's `#ct-link-wrap` with clear 1-click search/select.
  - Show subtle indicator when title is recognized via alias: `(reconhecido via alias: [Título])`.
  - On linking existing work, invoke `AliasCrowdService.submitAliasLink`.
- [ ] Run `node tests/test-collaborative-alias-integration.js` and verify it passes.

---

### Task 4: Popup Work Editor Aliases Management (`popup.html`, `popup.css`, `popup.js`)

**Files:**
- Modify: `popup.html`
- Modify: `popup.css`
- Modify: `popup.js`
- Create: `tests/test-popup-aliases-ui.js`

**Step 1: Write failing tests for popup aliases management**
- [ ] Create `tests/test-popup-aliases-ui.js` asserting:
  - `popup.html` contains input `#inputAliases` with label "NOMES ALTERNATIVOS / ALIASES".
  - `popup.js` loads `work.aliases` into `#inputAliases` as comma-separated string when editing.
  - Submitting form preserves/updates `aliases` in `StorageLocal.saveWork`.
- [ ] Run `node tests/test-popup-aliases-ui.js` and verify it fails.

**Step 2: Implement popup UI updates**
- [ ] Add `#inputAliases` to `popup.html` in the edit work form.
- [ ] Style `#inputAliases` in `popup.css` cleanly matching design system.
- [ ] Update `populateEditForm` and `saveWorkFromForm` in `popup.js` to handle `aliases`.
- [ ] Run `node tests/test-popup-aliases-ui.js` and verify it passes.

---

### Task 5: End-to-End Suite Runner & Regression Verification

**Files:**
- Modify: `tests/run-all-tests.js`
- Modify: `manifest.json`

**Step 1: Register new test suites in `tests/run-all-tests.js`**
- [ ] Add `test-canonical-resolver.js`, `test-alias-crowd-service.js`, `test-collaborative-alias-integration.js`, and `test-popup-aliases-ui.js`.
- [ ] Add syntax checks for new `.js` files.
- [ ] Update `manifest.json` scripts (`canonical-resolver.js`, `alias-crowd-service.js` in `content_scripts` and `background`).

**Step 2: Execute full test suite**
- [ ] Run `node tests/run-all-tests.js`.
- [ ] Verify that all test suites pass with 0 failures.
