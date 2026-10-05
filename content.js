/* ════════════════════════════════════════════════════════
   Chapter Tracker — content.js
   Botão flutuante + mini-form inline (Shadow DOM isolado).
   Persistência direta via storage-local.js (chrome.storage.local).
   ════════════════════════════════════════════════════════ */

(async function () {
  if (document.getElementById('__ct_root__')) return; // evita duplicação

  // ── Carrega configurações e verifica permissão do domínio ──
  const settings = typeof StorageLocal !== 'undefined'
    ? await StorageLocal.getSettings()
    : { enableFloatingButton: true, enableBadgeCount: true, blockedDomains: [] };

  if (!settings.enableFloatingButton) return;

  const currentHost = window.location.hostname.toLowerCase();
  const isBlocked = (settings.blockedDomains || []).some(d => {
    const domain = d.trim().toLowerCase();
    return domain && (currentHost === domain || currentHost.endsWith('.' + domain));
  });

  if (isBlocked) return;

  // ── Inject font silenciosamente se não existir ───────────
  if (!document.getElementById('__ct_font__')) {
    const lk = document.createElement('link');
    lk.id   = '__ct_font__';
    lk.rel  = 'stylesheet';
    lk.href = 'https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@700;800&display=swap';
    document.head.appendChild(lk);
  }

  // ── Shadow DOM root (isolamento total de CSS) ────────────
  const host = document.createElement('div');
  host.id = '__ct_root__';
  Object.assign(host.style, {
    position: 'fixed', bottom: '24px', right: '24px',
    zIndex: '2147483647', fontFamily: 'sans-serif'
  });
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });

  // ── CSS injetado no shadow ───────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@700;800&display=swap');

    :host { all: initial; }

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg:       #0d0d0f;
      --surface:  #141418;
      --surface2: #1c1c22;
      --border:   #2a2a32;
      --accent:   #e8ff47;
      --accent2:  #ff5c5c;
      --text:     #e8e8ec;
      --muted:    #606070;
      --radius:   8px;
      --mono:     'Space Mono', monospace;
      --sans:     'Syne', sans-serif;
      --ease:     140ms cubic-bezier(.4,0,.2,1);
    }

    /* ── FAB ── */
    #ct-fab {
      width: 48px; height: 48px;
      background: #e8ff47;
      border: none; border-radius: 50%;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      font-size: 22px;
      box-shadow: 0 4px 20px rgba(232,255,71,.35), 0 2px 8px rgba(0,0,0,.6);
      transition: transform var(--ease), box-shadow var(--ease), background var(--ease);
      position: relative;
      z-index: 2;
      user-select: none;
    }
    #ct-fab:hover {
      transform: scale(1.1);
      box-shadow: 0 6px 28px rgba(232,255,71,.5), 0 2px 8px rgba(0,0,0,.7);
    }
    #ct-fab:active { transform: scale(.95); }
    #ct-fab.open { background: #ff5c5c; box-shadow: 0 4px 20px rgba(255,92,92,.4); }

    /* ── Badge contador ── */
    #ct-badge {
      position: absolute;
      top: -4px; right: -4px;
      background: #ff5c5c;
      color: #fff;
      font-family: var(--mono);
      font-size: 9px;
      font-weight: 700;
      min-width: 16px; height: 16px;
      border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      padding: 0 4px;
      pointer-events: none;
      opacity: 0;
      transition: opacity var(--ease);
    }
    #ct-badge.visible { opacity: 1; }

    /* ── Painel flutuante ── */
    #ct-panel {
      position: absolute;
      bottom: 58px; right: 0;
      width: 310px;
      background: #0d0d0f;
      border: 1px solid #2a2a32;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 16px 48px rgba(0,0,0,.8), 0 2px 8px rgba(0,0,0,.6);
      transform-origin: bottom right;
      transform: scale(.85) translateY(10px);
      opacity: 0;
      pointer-events: none;
      transition: transform 200ms cubic-bezier(.34,1.56,.64,1), opacity 180ms ease;
    }
    #ct-panel.open {
      transform: scale(1) translateY(0);
      opacity: 1;
      pointer-events: all;
    }

    /* ── Panel header ── */
    .ct-pheader {
      background: #141418;
      border-bottom: 1px solid #2a2a32;
      padding: 10px 14px;
      display: flex; align-items: center; gap: 8px;
    }
    .ct-picon { color: #e8ff47; font-size: 16px; }
    .ct-ptitle {
      font-family: 'Syne', sans-serif;
      font-weight: 800;
      font-size: 10px;
      letter-spacing: .14em;
      text-transform: uppercase;
      color: #e8e8ec;
      flex: 1;
    }
    .ct-ptitle em { font-style: normal; color: #e8ff47; }

    /* ── Status strip (título detectado) ── */
    #ct-status {
      padding: 8px 14px;
      background: #1c1c22;
      border-bottom: 1px solid #2a2a32;
      font-family: 'Space Mono', monospace;
      font-size: 10px;
      color: #606070;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    #ct-status span { color: #e8e8ec; }
    #ct-status.known { color: #606070; }
    #ct-status.known span { color: #e8ff47; font-weight: 700; }

    /* ── Form ── */
    .ct-form { padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; }

    .ct-field { display: flex; flex-direction: column; gap: 3px; }

    .ct-label {
      font-family: 'Space Mono', monospace;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: .16em;
      color: #606070;
      text-transform: uppercase;
    }
    .ct-label em { font-style: normal; color: #e8ff47; }

    .ct-chapter-row { display: flex; gap: 6px; }

    .ct-input {
      background: #0d0d0f;
      border: 1px solid #2a2a32;
      border-radius: 6px;
      color: #e8e8ec;
      font-family: 'Space Mono', monospace;
      font-size: 11px;
      padding: 6px 10px;
      outline: none;
      width: 100%;
      transition: border-color 140ms ease;
    }
    .ct-input::placeholder { color: #606070; }
    .ct-input:focus { border-color: #e8ff47; }
    .ct-input.flash { border-color: #ff5c5c; }

    .ct-btn-inc {
      background: #1c1c22;
      border: 1px solid #2a2a32;
      border-radius: 6px;
      color: #e8ff47;
      font-family: 'Space Mono', monospace;
      font-size: 11px;
      font-weight: 700;
      padding: 0 10px;
      cursor: pointer;
      flex-shrink: 0;
      transition: all 140ms ease;
    }
    .ct-btn-inc:hover { background: #2a2a32; border-color: #e8ff47; }

    /* ── Tag picker ── */
    .ct-tags { display: flex; gap: 4px; flex-wrap: wrap; }
    .ct-tag {
      background: none;
      border: 1px solid #2a2a32;
      border-radius: 20px;
      color: #606070;
      font-family: 'Space Mono', monospace;
      font-size: 9px;
      padding: 2px 9px;
      cursor: pointer;
      transition: all 140ms ease;
    }
    .ct-tag:hover { border-color: #e8e8ec; color: #e8e8ec; }
    .ct-tag.active[data-tag="manga"] { background:#2d1f4e; border-color:#a78bfa; color:#a78bfa; }
    .ct-tag.active[data-tag="anime"] { background:#3d1630; border-color:#f472b6; color:#f472b6; }
    .ct-tag.active[data-tag="serie"] { background:#0d3328; border-color:#34d399; color:#34d399; }
    .ct-tag.active[data-tag="livro"] { background:#0f2040; border-color:#60a5fa; color:#60a5fa; }
    .ct-tag.active[data-tag="outro"] { background:#3d1e0a; border-color:#fb923c; color:#fb923c; }

    /* ── Botões ── */
    .ct-actions { display: flex; gap: 6px; margin-top: 2px; }
    .ct-btn {
      flex: 1;
      border: none; border-radius: 6px;
      font-family: 'Space Mono', monospace;
      font-size: 10px; font-weight: 700;
      letter-spacing: .06em;
      padding: 8px 0;
      cursor: pointer;
      transition: all 140ms ease;
    }
    .ct-btn-save { background: #e8ff47; color: #0d0d0f; }
    .ct-btn-save:hover { background: #d4eb30; }
    .ct-btn-save:active { transform: scale(.97); }
    .ct-btn-cancel { background: #141418; color: #606070; border: 1px solid #2a2a32; }
    .ct-btn-cancel:hover { color: #e8e8ec; border-color: #606070; }

    /* ── Toast ── */
    #ct-toast {
      position: absolute;
      bottom: 58px; right: 0;
      background: #1c1c22;
      border: 1px solid #2a2a32;
      border-radius: 6px;
      color: #e8e8ec;
      font-family: 'Space Mono', monospace;
      font-size: 10px;
      padding: 7px 14px;
      white-space: nowrap;
      opacity: 0;
      transform: translateY(6px);
      pointer-events: none;
      transition: all 220ms ease;
      z-index: 3;
    }
    #ct-toast.show { opacity: 1; transform: translateY(0); }
  `;
  shadow.appendChild(style);

  // ── HTML do widget ───────────────────────────────────────
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div id="ct-fab" title="Chapter Tracker">
      <span id="ct-fab-icon">◈</span>
      <span id="ct-badge"></span>
    </div>

    <div id="ct-panel">
      <div class="ct-pheader">
        <span class="ct-picon">◈</span>
        <span class="ct-ptitle">CHAPTER <em>TRACKER</em></span>
      </div>

      <div id="ct-status">Carregando…</div>

      <div class="ct-form">
        <input type="hidden" id="ct-edit-id" />

        <div class="ct-field">
          <label class="ct-label" id="ct-name-label">TÍTULO</label>
          <input class="ct-input" id="ct-name" type="text" placeholder="Nome da obra…" autocomplete="off" />
        </div>

        <div class="ct-field">
          <label class="ct-label">CAPÍTULO / EPISÓDIO</label>
          <div class="ct-chapter-row">
            <input class="ct-input" id="ct-chapter" type="text" placeholder="Cap. 000 / Ep. 00" autocomplete="off" />
            <button class="ct-btn-inc" id="ct-inc" title="Avançar +1 capítulo">+1</button>
          </div>
        </div>

        <div class="ct-field">
          <label class="ct-label">CATEGORIA</label>
          <div class="ct-tags" id="ct-tags">
            <button class="ct-tag active" data-tag="manga">Mangá</button>
            <button class="ct-tag" data-tag="anime">Anime</button>
            <button class="ct-tag" data-tag="serie">Série</button>
            <button class="ct-tag" data-tag="livro">Livro</button>
            <button class="ct-tag" data-tag="outro">Outro</button>
          </div>
        </div>

        <div class="ct-actions">
          <button class="ct-btn ct-btn-cancel" id="ct-cancel">Cancelar</button>
          <button class="ct-btn ct-btn-save"   id="ct-save">Salvar</button>
        </div>
      </div>
    </div>

    <div id="ct-toast"></div>
  `;
  shadow.appendChild(wrap);

  // ── Refs ─────────────────────────────────────────────────
  const fab       = shadow.getElementById('ct-fab');
  const fabIcon   = shadow.getElementById('ct-fab-icon');
  const badge     = shadow.getElementById('ct-badge');
  const panel     = shadow.getElementById('ct-panel');
  const statusEl  = shadow.getElementById('ct-status');
  const editIdInp = shadow.getElementById('ct-edit-id');
  const nameInp   = shadow.getElementById('ct-name');
  const nameLabel = shadow.getElementById('ct-name-label');
  const chapterInp= shadow.getElementById('ct-chapter');
  const incBtn    = shadow.getElementById('ct-inc');
  const tagsWrap  = shadow.getElementById('ct-tags');
  const btnCancel = shadow.getElementById('ct-cancel');
  const btnSave   = shadow.getElementById('ct-save');
  const toastEl   = shadow.getElementById('ct-toast');

  let selectedTag   = 'manga';
  let toastTimer    = null;
  let currentTitle  = '';
  let currentUrl    = '';
  let existingEntry = null;

  // ── Toast ────────────────────────────────────────────────
  function toast(msg, duration = 2200) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), duration);
  }

  // ── Tag picker ───────────────────────────────────────────
  tagsWrap.querySelectorAll('.ct-tag').forEach(btn => {
    btn.addEventListener('click', () => {
      tagsWrap.querySelectorAll('.ct-tag').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedTag = btn.dataset.tag;
    });
  });

  function setTag(tag) {
    tagsWrap.querySelectorAll('.ct-tag').forEach(b => b.classList.toggle('active', b.dataset.tag === tag));
    selectedTag = tag;
  }

  // ── Extrai título limpo da página ────────────────────────
  function getPageTitle() {
    const raw = document.title || '';
    return raw.replace(/\s*[-–|·•]\s*.{0,40}$/, '').trim() || raw.trim();
  }

  function normalize(s) {
    return (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function findExisting(entries, name) {
    const n = normalize(name);
    return entries.find(e => !e.deleted && normalize(e.name) === n) || null;
  }

  // ── Atualiza badge com total de entradas ─────────────────
  function updateBadge(entries) {
    if (!settings.enableBadgeCount) {
      badge.classList.remove('visible');
      return;
    }
    const count = entries.filter(e => !e.deleted).length;
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.classList.add('visible');
    } else {
      badge.classList.remove('visible');
    }
  }

  // ── Preenche o form ao abrir ─────────────────────────────
  async function populateForm() {
    currentTitle = getPageTitle();
    currentUrl   = window.location.href;

    const entries = await StorageLocal.getEntries();
    updateBadge(entries);

    existingEntry = findExisting(entries, currentTitle);

    if (existingEntry) {
      statusEl.className = 'known';
      statusEl.innerHTML = `Continuando: <span>${esc(existingEntry.name)}</span>`;
      editIdInp.value    = existingEntry.id;
      nameInp.value      = existingEntry.name;
      nameInp.readOnly   = true;
      nameInp.style.opacity = '.6';
      nameLabel.innerHTML = 'TÍTULO <em>(já salvo)</em>';
      chapterInp.value   = existingEntry.chapter || '';
      setTag(existingEntry.tag || 'manga');
      btnSave.textContent = 'Atualizar';
    } else {
      statusEl.className = '';
      statusEl.innerHTML = `Página: <span>${esc(currentTitle.slice(0, 38))}${currentTitle.length > 38 ? '…' : ''}</span>`;
      editIdInp.value    = '';
      nameInp.value      = currentTitle;
      nameInp.readOnly   = false;
      nameInp.style.opacity = '1';
      nameLabel.innerHTML = 'TÍTULO';
      chapterInp.value   = '';
      setTag('manga');
      btnSave.textContent = 'Salvar';
    }

    setTimeout(() => chapterInp.focus(), 80);
  }

  // ── Botão +1 Rápido no Form ──────────────────────────────
  incBtn.addEventListener('click', () => {
    const currentVal = chapterInp.value.trim() || (existingEntry ? existingEntry.chapter : 'Cap. 0');
    chapterInp.value = StorageLocal.parseChapterIncrement(currentVal);
    chapterInp.focus();
  });

  // ── Toggle painel ────────────────────────────────────────
  fab.addEventListener('click', async () => {
    const isOpen = panel.classList.contains('open');
    if (isOpen) {
      panel.classList.remove('open');
      fab.classList.remove('open');
      fabIcon.textContent = '◈';
    } else {
      panel.classList.add('open');
      fab.classList.add('open');
      fabIcon.textContent = '✕';
      await populateForm();
    }
  });

  btnCancel.addEventListener('click', () => {
    panel.classList.remove('open');
    fab.classList.remove('open');
    fabIcon.textContent = '◈';
  });

  // ── Salvar (Atualiza existente ou cria nova sem duplicatas) ─
  btnSave.addEventListener('click', async () => {
    const name    = nameInp.value.trim();
    const chapter = chapterInp.value.trim();

    if (!chapter) {
      chapterInp.classList.add('flash');
      chapterInp.focus();
      setTimeout(() => chapterInp.classList.remove('flash'), 800);
      return;
    }

    const payload = {
      id: existingEntry ? existingEntry.id : undefined,
      name: name || currentTitle,
      chapter,
      url: currentUrl,
      tag: selectedTag
    };

    await StorageLocal.saveEntry(payload);
    const updatedEntries = await StorageLocal.getEntries();
    updateBadge(updatedEntries);

    const isUpdate = !!existingEntry;
    toast(isUpdate ? `✓ Progresso atualizado — ${chapter}` : '✓ Entrada salva!');

    setTimeout(() => {
      panel.classList.remove('open');
      fab.classList.remove('open');
      fabIcon.textContent = '◈';
    }, 1200);
  });

  // ── Fechar ao clicar fora do host ────────────────────────
  document.addEventListener('click', e => {
    if (!host.contains(e.target) && panel.classList.contains('open')) {
      panel.classList.remove('open');
      fab.classList.remove('open');
      fabIcon.textContent = '◈';
    }
  });

  // ── Enter no campo capítulo dispara save ─────────────────
  chapterInp.addEventListener('keydown', e => {
    if (e.key === 'Enter') btnSave.click();
  });

  // ── Init: atualiza badge ─────────────────────────────────
  if (typeof StorageLocal !== 'undefined') {
    StorageLocal.getEntries().then(updateBadge);
  }

  function esc(s) {
    return String(s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

})();
