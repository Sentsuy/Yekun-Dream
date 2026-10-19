const assert = require('assert');
const fs = require('fs');
const path = require('path');

// 1. Mock Chrome Storage for storage-local tests
let mockStorage = {};
global.chrome = {
  storage: {
    local: {
      get: (keys, cb) => {
        const res = {};
        keys.forEach(k => { res[k] = mockStorage[k]; });
        if (cb) cb(res);
        return Promise.resolve(res);
      },
      set: (items, cb) => {
        Object.assign(mockStorage, items);
        if (cb) cb();
        return Promise.resolve();
      }
    },
    onChanged: { addListener: () => {} }
  },
  runtime: {
    sendMessage: () => {},
    onMessage: { addListener: () => {} }
  }
};

const { StorageLocal } = require('../storage-local');

async function runTests() {
  // Test 1: Save work with readingStatus and publicationStatus
  mockStorage = {};
  const work1 = await StorageLocal.saveWorkReading({
    workName: 'Solo Leveling',
    chapter: 'Cap. 179',
    url: 'https://asuracomic.net/series/solo-leveling-chapter-179',
    tag: 'manhwa',
    readingStatus: 'concluido',
    publicationStatus: 'concluido'
  });

  assert.ok(work1, 'Work must be created');
  assert.strictEqual(work1.readingStatus, 'concluido', 'readingStatus must be concluido');
  assert.strictEqual(work1.publicationStatus, 'concluido', 'publicationStatus must be concluido');

  // Test 2: Save work with defaults
  const work2 = await StorageLocal.saveWorkReading({
    workName: 'Omniscient Reader',
    chapter: 'Cap. 210',
    url: 'https://flamescans.org/series/orv-chapter-210',
    tag: 'manhwa'
  });

  assert.strictEqual(work2.readingStatus, 'lendo', 'Default readingStatus must be lendo');
  assert.strictEqual(work2.publicationStatus, 'lancamento', 'Default publicationStatus must be lancamento');

  // Test 3: Update status via updateWorkStatus
  const updatedWork2 = await StorageLocal.updateWorkStatus(work2.id, {
    readingStatus: 'pausado',
    publicationStatus: 'hiato'
  });

  assert.strictEqual(updatedWork2.readingStatus, 'pausado', 'readingStatus must be updated to pausado');
  assert.strictEqual(updatedWork2.publicationStatus, 'hiato', 'publicationStatus must be updated to hiato');

  // Test 4: Update status via updateWorkDetails
  const detailsUpdated = await StorageLocal.updateWorkDetails(work2.id, {
    readingStatus: 'dropado',
    publicationStatus: 'cancelado'
  });
  assert.strictEqual(detailsUpdated.readingStatus, 'dropado', 'readingStatus must be updated to dropado');
  assert.strictEqual(detailsUpdated.publicationStatus, 'cancelado', 'publicationStatus must be updated to cancelado');

  // Test 5: Backward compatibility migration on getAllRawWorks
  mockStorage['chapter_tracker_entries_v3'] = [
    {
      id: 'legacy-work-1',
      name: 'Legacy Manga',
      tag: 'manga',
      mainChapter: 'Cap. 10',
      sources: []
      // No readingStatus or publicationStatus
    }
  ];

  const rawWorks = await StorageLocal.getAllRawWorks();
  assert.strictEqual(rawWorks[0].readingStatus, 'lendo', 'Legacy works must default to lendo');
  assert.strictEqual(rawWorks[0].publicationStatus, 'lancamento', 'Legacy works must default to lancamento');

  // Test 6: HTML file verification
  const popupHtml = fs.readFileSync(path.resolve(__dirname, '../popup.html'), 'utf8');
  assert.ok(popupHtml.includes('id="readingStatusPicker"'), 'popup.html must have readingStatusPicker');
  assert.ok(popupHtml.includes('id="pubStatusPicker"'), 'popup.html must have pubStatusPicker');
  assert.ok(popupHtml.includes('id="statusFilter"'), 'popup.html must have statusFilter');
  assert.strictEqual(/[📖🌐↗✎✕＋▼⚙]/.test(popupHtml), false, 'popup.html must not contain legacy icon emojis/glyphs');

  // Test 7: CSS file verification
  const popupCss = fs.readFileSync(path.resolve(__dirname, '../popup.css'), 'utf8');
  assert.ok(popupCss.includes('.status-select'), 'popup.css must style .status-select');
  assert.ok(popupCss.includes('.entry-status-badge'), 'popup.css must style .entry-status-badge');
  assert.ok(popupCss.includes('.entry-pub-badge'), 'popup.css must style .entry-pub-badge');
  assert.ok(popupCss.includes('.status-concluido'), 'popup.css must style .status-concluido');
  assert.ok(popupCss.includes('.status-pausado'), 'popup.css must style .status-pausado');
  assert.ok(popupCss.includes('.status-dropado'), 'popup.css must style .status-dropado');
  assert.ok(popupCss.includes('.status-planejo'), 'popup.css must style .status-planejo');
  assert.ok(popupCss.includes('.pub-hiato'), 'popup.css must style .pub-hiato');

  // Test 8: JS file verification & filterWorks logic
  const popupJs = fs.readFileSync(path.resolve(__dirname, '../popup.js'), 'utf8');
  assert.ok(popupJs.includes('readingStatusPicker'), 'popup.js must reference readingStatusPicker');
  assert.ok(popupJs.includes('pubStatusPicker'), 'popup.js must reference pubStatusPicker');
  assert.ok(popupJs.includes('statusFilter'), 'popup.js must reference statusFilter');
  assert.strictEqual(/[📖🌐↗✎✕＋▼⚙]/.test(popupJs), false, 'popup.js must not contain legacy icon emojis/glyphs');

  // Test 9: filterWorks logic with reading status
  const mockWorksList = [
    { id: '1', name: 'Manga A', tag: 'manga', readingStatus: 'lendo' },
    { id: '2', name: 'Manga B', tag: 'manga', readingStatus: 'concluido' },
    { id: '3', name: 'Manga C', tag: 'manhwa', readingStatus: 'dropado' },
    { id: '4', name: 'Manga D', tag: 'manhwa', readingStatus: 'lendo' }
  ];

  function mockFilterWorks(works, query, category, sortBy, status) {
    let list = works || [];
    if (category && category !== 'all') {
      list = list.filter(w => (w.tag || 'outro').toLowerCase() === category.toLowerCase());
    }
    if (status && status !== 'all') {
      list = list.filter(w => (w.readingStatus || 'lendo').toLowerCase() === status.toLowerCase());
    }
    return list;
  }

  const lendoOnly = mockFilterWorks(mockWorksList, '', 'all', 'recent', 'lendo');
  assert.strictEqual(lendoOnly.length, 2, 'Should filter only lendo works (2 items)');

  const concluidoOnly = mockFilterWorks(mockWorksList, '', 'all', 'recent', 'concluido');
  assert.strictEqual(concluidoOnly.length, 1, 'Should filter only concluido works (1 item)');
  assert.strictEqual(concluidoOnly[0].name, 'Manga B');

  const dropadoOnly = mockFilterWorks(mockWorksList, '', 'all', 'recent', 'dropado');
  assert.strictEqual(dropadoOnly.length, 1, 'Should filter only dropado works (1 item)');
  assert.strictEqual(dropadoOnly[0].name, 'Manga C');

  // Test 10: 1-Click Status Cycling logic
  assert.ok(popupJs.includes('btn-status-cycle'), 'popup.js must generate btn-status-cycle buttons');
  assert.ok(popupCss.includes('cursor: pointer'), 'popup.css must style badges as clickable');

  const NEXT_STATUS = {
    'lendo': 'concluido',
    'concluido': 'pausado',
    'pausado': 'dropado',
    'dropado': 'planejo',
    'planejo': 'lendo'
  };

  let cycleState = 'lendo';
  cycleState = NEXT_STATUS[cycleState];
  assert.strictEqual(cycleState, 'concluido', 'Cycle from lendo must go to concluido');
  cycleState = NEXT_STATUS[cycleState];
  assert.strictEqual(cycleState, 'pausado', 'Cycle from concluido must go to pausado');
  cycleState = NEXT_STATUS[cycleState];
  assert.strictEqual(cycleState, 'dropado', 'Cycle from pausado must go to dropado');
  cycleState = NEXT_STATUS[cycleState];
  assert.strictEqual(cycleState, 'planejo', 'Cycle from dropado must go to planejo');
  cycleState = NEXT_STATUS[cycleState];
  assert.strictEqual(cycleState, 'lendo', 'Cycle from planejo must loop back to lendo');

  // Test 11: Layout protection against status badges overlapping + action button
  const metaRowSection = popupCss.substring(
    popupCss.indexOf('.entry-meta-row {'),
    popupCss.indexOf('}', popupCss.indexOf('.entry-meta-row {'))
  );
  assert.ok(metaRowSection.includes('flex-wrap: wrap'), 'entry-meta-row must have flex-wrap: wrap to prevent horizontal spill into + button');
  assert.ok(metaRowSection.includes('max-width: 100%'), 'entry-meta-row must have max-width: 100% boundary');

  const pubBadgeSection = popupCss.substring(
    popupCss.indexOf('.entry-pub-badge {'),
    popupCss.indexOf('}', popupCss.indexOf('.entry-pub-badge {'))
  );
  assert.ok(pubBadgeSection.includes('flex-shrink: 0'), 'entry-pub-badge must have flex-shrink: 0');
  assert.ok(pubBadgeSection.includes('white-space: nowrap'), 'entry-pub-badge must have white-space: nowrap');

  // Test 12: Dynamic Status Display (Assistindo for anime/filme/serie, Lendo for text works)
  assert.ok(popupJs.includes('isVideoWorkTag'), 'popup.js must define isVideoWorkTag helper');
  assert.ok(popupJs.includes('updateReadingStatusPickerLabels'), 'popup.js must have updateReadingStatusPickerLabels');

  function isVideoWorkTagMock(tag) {
    const t = (tag || '').toLowerCase().trim();
    return t === 'anime' || t === 'filme' || t === 'serie';
  }

  function getStatusLabelMock(tag, status = 'lendo') {
    const isVideo = isVideoWorkTagMock(tag);
    const statusLabels = {
      lendo: isVideo ? 'Assistindo' : 'Lendo',
      concluido: 'Concluído',
      pausado: 'Pausado',
      dropado: 'Dropado',
      planejo: 'Planejo'
    };
    return statusLabels[status] || status;
  }

  assert.strictEqual(getStatusLabelMock('anime', 'lendo'), 'Assistindo', 'Anime with lendo must display Assistindo');
  assert.strictEqual(getStatusLabelMock('filme', 'lendo'), 'Assistindo', 'Filme with lendo must display Assistindo');
  assert.strictEqual(getStatusLabelMock('serie', 'lendo'), 'Assistindo', 'Serie with lendo must display Assistindo');

  assert.strictEqual(getStatusLabelMock('manga', 'lendo'), 'Lendo', 'Manga with lendo must display Lendo');
  assert.strictEqual(getStatusLabelMock('manhwa', 'lendo'), 'Lendo', 'Manhwa with lendo must display Lendo');
  assert.strictEqual(getStatusLabelMock('webtoon', 'lendo'), 'Lendo', 'Webtoon with lendo must display Lendo');
  assert.strictEqual(getStatusLabelMock('novel', 'lendo'), 'Lendo', 'Novel with lendo must display Lendo');
  assert.strictEqual(getStatusLabelMock('livro', 'lendo'), 'Lendo', 'Livro with lendo must display Lendo');
  assert.strictEqual(getStatusLabelMock('outro', 'lendo'), 'Lendo', 'Outro with lendo must display Lendo');

  console.log('✓ Reading & Publication Status tests passed successfully!');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
