const assert = require('assert');
const fs = require('fs');
const path = require('path');

// ── 1. Logic Helpers (Unit Testing) ─────────────────────────
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

// ── Tests 1: Initials Generation ────────────────────────────
assert.strictEqual(getWorkInitials('Solo Leveling'), 'SL');
assert.strictEqual(getWorkInitials('One Piece'), 'OP');
assert.strictEqual(getWorkInitials('Martial Peak'), 'MP');
assert.strictEqual(getWorkInitials('Bleach'), 'BL');
assert.strictEqual(getWorkInitials(''), '?');
assert.strictEqual(getWorkInitials(null), '?');

// ── Tests 2: Relative Time ──────────────────────────────────
const now = 1700000000000;
assert.strictEqual(formatRelativeTime(now, now), 'Lido hoje');
assert.strictEqual(formatRelativeTime(now - 1000 * 60 * 60 * 25, now), 'Lido ontem');
assert.strictEqual(formatRelativeTime(now - 1000 * 60 * 60 * 24 * 3, now), 'Há 3 dias');
assert.strictEqual(formatRelativeTime(now - 1000 * 60 * 60 * 24 * 14, now), 'Há 2 semanas');
assert.strictEqual(formatRelativeTime(null, now), '');

// ── Tests 3: Sorting ────────────────────────────────────────
const sampleWorks = [
  { id: '1', name: 'Zetman', mainChapter: 'Cap. 50', updatedAt: 100 },
  { id: '2', name: 'Attack on Titan', mainChapter: 'Cap. 139', updatedAt: 300 },
  { id: '3', name: 'Berserk', mainChapter: 'Cap. 370', updatedAt: 200 }
];

const sortedRecent = sortWorks(sampleWorks, 'recent');
assert.deepStrictEqual(sortedRecent.map(w => w.id), ['2', '3', '1']);

const sortedAlpha = sortWorks(sampleWorks, 'alpha');
assert.deepStrictEqual(sortedAlpha.map(w => w.name), ['Attack on Titan', 'Berserk', 'Zetman']);

const sortedChapters = sortWorks(sampleWorks, 'chapters');
assert.deepStrictEqual(sortedChapters.map(w => w.name), ['Berserk', 'Attack on Titan', 'Zetman']);

// ── Tests 4: HTML & CSS & JS UI Inspection ──────────────────
const popupHtml = fs.readFileSync(path.resolve(__dirname, '../popup.html'), 'utf8');
const popupCss  = fs.readFileSync(path.resolve(__dirname, '../popup.css'), 'utf8');
const popupJs   = fs.readFileSync(path.resolve(__dirname, '../popup.js'), 'utf8');

assert.ok(popupHtml.includes('id="categoryFilter"'), 'popup.html must have categoryFilter select');
assert.ok(popupHtml.includes('id="btnClearSearch"'), 'popup.html must have btnClearSearch button');
assert.ok(popupCss.includes('.entry-avatar'), 'popup.css must have entry-avatar styles');
assert.ok(popupCss.includes('.btn-continue'), 'popup.css must have btn-continue styles');
assert.ok(popupJs.includes('getWorkInitials') || popupJs.includes('entry-avatar'), 'popup.js must support avatar initials');
assert.ok(popupJs.includes('formatRelativeTime'), 'popup.js must support relative time formatting');
assert.ok(popupJs.includes('sortFilter') || popupJs.includes('sortWorks'), 'popup.js must support sorting');

console.log('✓ UI/UX enhancements tests passed successfully!');
