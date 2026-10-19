/* ════════════════════════════════════════════════════════
   Yekun Dream — content.js
   Botão flutuante + mini-form inline (Shadow DOM isolado).
   Persistência direta via storage-local.js (v3: multi-fontes e obras).
   ════════════════════════════════════════════════════════ */

(function () {

const YekunVideoTracker = {
  targetRatio: 0.70,
  minPlayedSeconds: 120,
  minDurationSeconds: 60,
  checkThrottleMs: 2000,
  activeVideo: null,
  playedSeconds: 0,
  lastPlayTimestamp: null,
  lastCheckTimestamp: 0,
  hasTriggered: false,
  boundListeners: null,

  reset(video = null) {
    this.playedSeconds = 0;
    this.lastPlayTimestamp = null;
    this.lastCheckTimestamp = 0;
    this.hasTriggered = false;
    if (video) {
      this.activeVideo = video;
    }
  },

  simulatePlayTime(video, seconds) {
    this.playedSeconds += seconds;
    this.lastCheckTimestamp = 0;
  },

  onSourceChange(video) {
    this.reset(video);
  },

  _accumulatePlayedTime(video) {
    if (this.lastPlayTimestamp && !video.paused) {
      const now = Date.now();
      const elapsed = (now - this.lastPlayTimestamp) / 1000;
      if (elapsed > 0 && elapsed < 30) {
        this.playedSeconds += elapsed;
      }
      this.lastPlayTimestamp = now;
    }
  },

  attach(video, onTrigger) {
    if (!video) return;
    this.reset(video);

    const onPlay = () => {
      this.lastPlayTimestamp = Date.now();
    };

    const onPause = () => {
      this._accumulatePlayedTime(video);
      this.lastPlayTimestamp = null;
    };

    const onTimeUpdate = () => {
      if (this.hasTriggered) return;
      const now = Date.now();
      if (now - this.lastCheckTimestamp < this.checkThrottleMs) {
        return;
      }
      this.lastCheckTimestamp = now;
      this._accumulatePlayedTime(video);

      if (!video.duration || video.duration < this.minDurationSeconds) return;

      const ratio = video.currentTime / video.duration;
      if (ratio >= this.targetRatio && this.playedSeconds >= this.minPlayedSeconds) {
        this.hasTriggered = true;
        if (typeof onTrigger === 'function') {
          onTrigger({
            ratio,
            playedSeconds: this.playedSeconds,
            duration: video.duration,
            currentTime: video.currentTime
          });
        }
      }
    };

    const onEnded = () => {
      this._accumulatePlayedTime(video);
      if (this.hasTriggered) return;
      if (!video.duration || video.duration < this.minDurationSeconds) return;

      if (this.playedSeconds >= 60) {
        this.hasTriggered = true;
        if (typeof onTrigger === 'function') {
          onTrigger({
            ratio: 1.0,
            playedSeconds: this.playedSeconds,
            duration: video.duration,
            currentTime: video.duration
          });
        }
      }
    };

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('ended', onEnded);

    this.boundListeners = { video, onPlay, onPause, onTimeUpdate, onEnded };
  },

  detach() {
    if (this.boundListeners) {
      const { video, onPlay, onPause, onTimeUpdate, onEnded } = this.boundListeners;
      try {
        video.removeEventListener('play', onPlay);
        video.removeEventListener('pause', onPause);
        video.removeEventListener('timeupdate', onTimeUpdate);
        video.removeEventListener('ended', onEnded);
      } catch (_) {}
      this.boundListeners = null;
    }
    this.activeVideo = null;
  },

  initAutoTracking(onTrigger) {
    if (typeof document === 'undefined') return;

    const tryFindVideo = () => {
      const video = document.querySelector('video');
      if (video && video !== this.activeVideo) {
        this.attach(video, onTrigger);
        return true;
      }
      return false;
    };

    if (!tryFindVideo()) {
      let isScheduled = false;
      const observer = new MutationObserver((mutations, obs) => {
        if (isScheduled) return;
        isScheduled = true;
        const scheduleFn = (typeof requestAnimationFrame === 'function') ? requestAnimationFrame : (cb => setTimeout(cb, 100));
        scheduleFn(() => {
          isScheduled = false;
          if (tryFindVideo()) {
            obs.disconnect();
          }
        });
      });
      observer.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true
      });
      setTimeout(() => {
        try { observer.disconnect(); } catch (_) {}
      }, 45000);
    }
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    YekunVideoTracker
  };
}

if (typeof window !== 'undefined') {
  window.YekunVideoTracker = YekunVideoTracker;
}

(async function () {
  if (typeof document === 'undefined') return;

  const currentHost = window.location.hostname.toLowerCase().replace(/^www\./, '');

  let appSettings = typeof StorageLocal !== 'undefined'
    ? await StorageLocal.getSettings()
    : { enableFloatingButton: true, enableBadgeCount: true, blockedDomains: [], allowedDomains: [], autoTrackAnime: true };

  function isDomainAllowed(hostName, allowedList = []) {
    if (!Array.isArray(allowedList) || allowedList.length === 0) return false;
    const h = (hostName || '').trim().toLowerCase().replace(/^www\./, '');
    if (!h) return false;
    return allowedList.some(d => {
      const allowed = (d || '').trim().toLowerCase().replace(/^www\./, '');
      return allowed && (h === allowed || h.endsWith('.' + allowed));
    });
  }

  function isDomainBlocked(blockedDomains = [], host = currentHost) {
    return (blockedDomains || []).some(d => {
      const domain = (d || '').trim().toLowerCase().replace(/^www\./, '');
      return domain && (host === domain || host.endsWith('.' + domain));
    });
  }

  function isSitePermitted(s = appSettings, host = currentHost) {
    const blocked = isDomainBlocked(s.blockedDomains || [], host);
    const allowed = isDomainAllowed(host, s.allowedDomains || []);
    return allowed && !blocked;
  }

  const isTopFrame = (typeof window !== 'undefined' && window.top === window);

  // Se estiver dentro de um iframe de player, executa apenas o Video Tracker e envia mensagem ao frame pai
  if (!isTopFrame) {
    // Se o iframe tiver document.referrer e o domínio pai for identificável:
    // Se o domínio pai NÃO estiver na lista de permitidos, ou estiver bloqueado, não inicializa rastreamento.
    const refHost = document.referrer ? (typeof StorageLocal !== 'undefined' && StorageLocal.extractDomain ? StorageLocal.extractDomain(document.referrer) : '') : '';
    if (refHost && !isSitePermitted(appSettings, refHost)) {
      return;
    }

    if (appSettings.autoTrackAnime !== false) {
      YekunVideoTracker.initAutoTracking(progressData => {
        try {
          if (window.parent && window.parent !== window) {
            window.parent.postMessage({
              type: 'YEKUN_VIDEO_PROGRESS_COMPLETED',
              source: 'yekun-dream',
              ...progressData
            }, '*');
          }
        } catch (_) {}
      });
    }
    return; // Fast-exit no iframe (não injeta botão flutuante nem form)
  }

  const existingRoot = document.getElementById('__ct_root__');
  if (existingRoot) {
    try { existingRoot.remove(); } catch (_) {}
  }

  // ── Inject font silenciosamente apenas quando o widget estiver visível ──
  function ensureFontsInjected() {
    if (!document.getElementById('__ct_font__') && document.head) {
      const lk = document.createElement('link');
      lk.id   = '__ct_font__';
      lk.rel  = 'stylesheet';
      lk.href = 'https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@700;800&display=swap';
      document.head.appendChild(lk);
    }
  }

  // ── Shadow DOM root (isolamento total de CSS) ────────────
  const host = document.createElement('div');
  host.id = '__ct_root__';
  Object.assign(host.style, {
    position: 'fixed', bottom: '24px', right: '24px',
    zIndex: '2147483647', fontFamily: 'sans-serif',
    display: 'none'
  });

  const shadow = host.attachShadow({ mode: 'open' });

  // ── CSS injetado no shadow ───────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@700;800&display=swap');

    :host { all: initial; }
    :host([hidden]), :host[hidden] { display: none !important; }

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :host, :root, #ct-container, #ct-container[data-theme="dark"] {
      --bg:            #0d0d0f;
      --surface:       #141418;
      --surface2:      #1c1c22;
      --border:        #2a2a32;
      --accent:        #38bdf8;
      --accent-hover:  #0ea5e9;
      --accent-rgb:    56, 189, 248;
      --accent2:       #ff5c5c;
      --text:          #e8e8ec;
      --text-contrast: #0f172a;
      --muted:         #606070;
      --radius:        8px;
      --mono:          'Space Mono', monospace;
      --sans:          'Syne', sans-serif;
      --ease:          140ms cubic-bezier(.4,0,.2,1);
    }

    #ct-container[data-theme="light"], :host([data-theme="light"]) {
      --bg:            #f8fafc;
      --surface:       #ffffff;
      --surface2:      #f1f5f9;
      --border:        #cbd5e1;
      --accent:        #2563eb;
      --accent-hover:  #1d4ed8;
      --accent-rgb:    37, 99, 235;
      --accent2:       #ef4444;
      --text:          #0f172a;
      --text-contrast: #ffffff;
      --muted:         #64748b;
    }

    #ct-container[data-theme="pink"], :host([data-theme="pink"]) {
      --bg:            #1c121a;
      --surface:       #251b22;
      --surface2:      #30232c;
      --border:        #4a3444;
      --accent:        #f472b6;
      --accent-hover:  #ec4899;
      --accent-rgb:    244, 114, 182;
      --accent2:       #fb7185;
      --text:          #fce7f3;
      --text-contrast: #1c121a;
      --muted:         #9d7b93;
    }

    #ct-container[data-theme="neon"], :host([data-theme="neon"]) {
      --bg:            #05070f;
      --surface:       #0c1022;
      --surface2:      #131936;
      --border:        #00f0ff;
      --accent:        #00f0ff;
      --accent-hover:  #33f3ff;
      --accent-rgb:    0, 240, 255;
      --accent2:       #ff007f;
      --text:          #e0f7ff;
      --text-contrast: #05070f;
      --muted:         #6482a6;
    }

    /* ── FAB ── */
    #ct-fab {
      width: 48px; height: 48px;
      background: var(--accent);
      color: var(--text-contrast);
      border: none; border-radius: 50%;
      cursor: grab;
      display: flex; align-items: center; justify-content: center;
      font-size: 22px;
      box-shadow: 0 4px 20px rgba(var(--accent-rgb), .38), 0 2px 8px rgba(0,0,0,.5);
      transition: transform var(--ease), box-shadow var(--ease), background var(--ease), color var(--ease);
      position: relative;
      z-index: 2;
      user-select: none;
      touch-action: none;
    }
    #ct-fab:hover {
      transform: scale(1.1);
      background: var(--accent-hover);
      box-shadow: 0 6px 28px rgba(var(--accent-rgb), .55), 0 2px 8px rgba(0,0,0,.6);
    }
    #ct-fab:active { cursor: grabbing; transform: scale(.95); }
    #ct-fab.open { background: var(--accent2); color: #ffffff; box-shadow: 0 4px 20px rgba(239,68,68,.4); }

    /* ── Badge contador ── */
    #ct-badge {
      position: absolute;
      top: -4px; right: -4px;
      background: var(--accent2);
      color: #fff;
      font-family: var(--mono);
      font-size: 9px;
      font-weight: 700;
      min-width: 16px; height: 16px;
      border-radius: 8px;
      padding: 0 4px;
      display: none;
      align-items: center;
      justify-content: center;
      border: 2px solid var(--bg);
    }
    #ct-badge.visible { display: flex; }

    /* ── Painel retrátil ── */
    #ct-panel {
      position: absolute;
      bottom: 58px; right: 0;
      width: 290px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      box-shadow: 0 12px 40px rgba(0,0,0,.7), 0 0 0 1px rgba(255,255,255,.05);
      display: none;
      flex-direction: column;
      overflow: hidden;
      z-index: 1;
      animation: ctSlideUp 160ms cubic-bezier(.4,0,.2,1);
    }
    #ct-panel.open { display: flex; }

    @keyframes ctSlideUp {
      from { opacity: 0; transform: translateY(10px) scale(.97); }
      to   { opacity: 1; transform: translateY(0)    scale(1);   }
    }

    /* ── Header do painel ── */
    .ct-pheader {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      background: var(--bg);
      border-bottom: 1px solid var(--border);
    }
    .ct-brand {
      display: flex; align-items: center; gap: 7px;
    }
    .ct-picon { color: var(--accent); font-size: 14px; }
    .ct-ptitle {
      font-family: 'Syne', sans-serif;
      font-size: 11px; font-weight: 800;
      letter-spacing: .08em;
      color: var(--text);
    }
    .ct-ptitle em { font-style: normal; color: var(--accent); }

    /* ── Status strip (título detectado) ── */
    #ct-status {
      padding: 8px 14px;
      background: var(--surface2);
      border-bottom: 1px solid var(--border);
      font-family: 'Space Mono', monospace;
      font-size: 10px;
      color: var(--muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    #ct-status span { color: var(--text); }
    #ct-status.known { color: var(--muted); }
    #ct-status.known span { color: var(--accent); font-weight: 700; }
    #ct-status.new-source span { color: #34d399; font-weight: 700; }

    /* ── Faixa do Site / Fonte ── */
    .ct-source-info {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      background: var(--surface2);
      border-bottom: 1px solid var(--border);
      font-family: 'Space Mono', monospace;
      font-size: 9px;
      color: var(--accent);
    }
    .ct-source-dot { font-size: 10px; }
    #ct-source-text {
      color: var(--text);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* ── Form ── */
    .ct-form { padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; }

    .ct-field { display: flex; flex-direction: column; gap: 3px; }

    .ct-label {
      font-family: 'Space Mono', monospace;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: .16em;
      color: var(--muted);
      text-transform: uppercase;
    }
    .ct-label em { font-style: normal; color: var(--accent); }

    .ct-chapter-row { display: flex; gap: 6px; }

    .ct-input {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--text);
      font-family: 'Space Mono', monospace;
      font-size: 11px;
      padding: 6px 10px;
      outline: none;
      width: 100%;
      transition: border-color 140ms ease;
    }
    .ct-input::placeholder { color: var(--muted); }
    .ct-input:focus { border-color: var(--accent); }
    .ct-input.flash { border-color: var(--accent2); }

    .ct-btn-inc {
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--accent);
      font-family: 'Space Mono', monospace;
      font-size: 11px;
      font-weight: 700;
      padding: 0 10px;
      cursor: pointer;
      flex-shrink: 0;
      transition: all 140ms ease;
    }
    .ct-btn-inc:hover { background: var(--surface); border-color: var(--accent); }

    /* ── Tag picker ── */
    .ct-tags { display: flex; gap: 4px; flex-wrap: wrap; }
    .ct-tag {
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: 20px;
      color: var(--muted);
      font-family: 'Space Mono', monospace;
      font-size: 9px;
      padding: 2px 9px;
      cursor: pointer;
      transition: all 140ms ease;
    }
    .ct-tag:hover { border-color: var(--accent); color: var(--text); }
    .ct-tag.active[data-tag="manga"]   { background:#2d1f4e; border-color:#a78bfa; color:#a78bfa; }
    .ct-tag.active[data-tag="manhwa"]  { background:#0c2d48; border-color:#38bdf8; color:#38bdf8; }
    .ct-tag.active[data-tag="manhua"]  { background:#3b1236; border-color:#e879f9; color:#e879f9; }
    .ct-tag.active[data-tag="anime"]   { background:#3d1630; border-color:#f472b6; color:#f472b6; }
    .ct-tag.active[data-tag="webtoon"] { background:#0d3322; border-color:#4ade80; color:#4ade80; }
    .ct-tag.active[data-tag="serie"]   { background:#0d3328; border-color:#34d399; color:#34d399; }
    .ct-tag.active[data-tag="filme"]   { background:#3b2d07; border-color:#f59e0b; color:#f59e0b; }
    .ct-tag.active[data-tag="livro"]   { background:#0f2040; border-color:#60a5fa; color:#60a5fa; }
    .ct-tag.active[data-tag="outro"]   { background:#3d1e0a; border-color:#fb923c; color:#fb923c; }

    /* ── Sugestão Inteligente e Link ── */
    .ct-match-box {
      background: var(--surface2);
      border: 1px dashed var(--accent);
      border-radius: 6px;
      padding: 6px 8px;
      display: flex;
      flex-direction: column;
      gap: 5px;
      font-size: 10px;
      color: var(--text);
      margin-top: 2px;
    }
    .ct-match-text { font-family: 'Space Mono', monospace; font-size: 10px; color: var(--muted); }
    .ct-match-text strong { color: var(--accent); }
    .ct-btn-match {
      background: var(--surface);
      border: 1px solid var(--accent);
      border-radius: 4px;
      color: var(--accent);
      font-family: 'Space Mono', monospace;
      font-size: 9px;
      font-weight: 700;
      padding: 4px 6px;
      cursor: pointer;
      text-align: center;
      transition: all 120ms ease;
    }
    .ct-btn-match:hover { background: var(--accent); color: var(--text-contrast); }

    .ct-link-wrap {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-top: -2px;
    }
    .ct-link-toggle {
      background: none;
      border: none;
      color: var(--accent);
      font-family: 'Space Mono', monospace;
      font-size: 9px;
      cursor: pointer;
      text-align: left;
      padding: 2px 0;
      opacity: 0.85;
      text-decoration: underline;
      transition: opacity 120ms ease;
    }
    .ct-link-toggle:hover { opacity: 1; }
    .ct-link-select {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--text);
      font-family: 'Space Mono', monospace;
      font-size: 10px;
      padding: 5px 8px;
      outline: none;
      display: none;
      width: 100%;
    }
    .ct-link-select.open { display: block; }

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
    .ct-btn-save { background: var(--accent); color: var(--text-contrast); }
    .ct-btn-save:hover { background: var(--accent-hover); }
    .ct-btn-save:active { transform: scale(.97); }
    .ct-btn-cancel { background: var(--surface); color: var(--muted); border: 1px solid var(--border); }
    .ct-btn-cancel:hover { color: var(--text); border-color: var(--muted); }

    /* ── Toast ── */
    #ct-toast {
      position: absolute;
      bottom: 58px; right: 0;
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--text);
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
  wrap.id = 'ct-container';
  wrap.innerHTML = `
    <div id="ct-fab" title="Yekun Dream">
      <span id="ct-fab-icon">◈</span>
      <span id="ct-badge"></span>
    </div>

    <div id="ct-panel">
      <div class="ct-pheader">
        <div class="ct-brand">
          <span class="ct-picon">◈</span>
          <span class="ct-ptitle">YEKUN <em>DREAM</em></span>
        </div>
      </div>

      <div id="ct-status">Carregando…</div>
      <div class="ct-source-info" id="ct-source-info">
        <span class="ct-source-dot">🌐</span>
        <span id="ct-source-text">Identificando site…</span>
      </div>

      <div class="ct-form">
        <input type="hidden" id="ct-edit-id" />

        <div class="ct-field">
          <label class="ct-label" id="ct-name-label">TÍTULO</label>
          <input class="ct-input" id="ct-name" type="text" placeholder="Nome da obra…" autocomplete="off" />
        </div>

        <div id="ct-suggestion-wrap" class="ct-match-box" style="display:none;">
          <div class="ct-match-text" id="ct-suggestion-text">Obra similar: <strong></strong></div>
          <button type="button" class="ct-btn-match" id="ct-btn-apply-match">Vincular a esta obra</button>
        </div>

        <div class="ct-link-wrap" id="ct-link-wrap" style="display:none;">
          <button type="button" class="ct-link-toggle" id="ct-link-toggle">🔗 Já acompanha esta obra com outro nome?</button>
          <select class="ct-link-select" id="ct-link-select">
            <option value="">-- Escolha uma das suas obras salvas --</option>
          </select>
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
            <button class="ct-tag" data-tag="manhwa">Manhwa</button>
            <button class="ct-tag" data-tag="manhua">Manhua</button>
            <button class="ct-tag" data-tag="anime">Anime</button>
            <button class="ct-tag" data-tag="webtoon">Webtoon</button>
            <button class="ct-tag" data-tag="serie">Série</button>
            <button class="ct-tag" data-tag="filme">Filme</button>
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

  function applyTheme(themeName = 'dark') {
    const valid = ['dark', 'light', 'pink', 'neon'].includes(themeName) ? themeName : 'dark';
    host.setAttribute('data-theme', valid);
    wrap.setAttribute('data-theme', valid);
  }

  applyTheme(appSettings.theme || 'dark');

  // ── Refs ─────────────────────────────────────────────────
  const fab            = shadow.getElementById('ct-fab');
  const fabIcon        = shadow.getElementById('ct-fab-icon');
  const badge          = shadow.getElementById('ct-badge');
  const panel          = shadow.getElementById('ct-panel');
  const statusEl       = shadow.getElementById('ct-status');
  const sourceTextEl   = shadow.getElementById('ct-source-text');
  const editIdInp      = shadow.getElementById('ct-edit-id');
  const nameInp        = shadow.getElementById('ct-name');
  const nameLabel      = shadow.getElementById('ct-name-label');
  const chapterInp     = shadow.getElementById('ct-chapter');
  const incBtn         = shadow.getElementById('ct-inc');
  const tagsWrap       = shadow.getElementById('ct-tags');
  const btnCancel      = shadow.getElementById('ct-cancel');
  const btnSave        = shadow.getElementById('ct-save');
  const toastEl        = shadow.getElementById('ct-toast');
  const suggestionWrap = shadow.getElementById('ct-suggestion-wrap');
  const suggestionText = shadow.getElementById('ct-suggestion-text');
  const btnApplyMatch  = shadow.getElementById('ct-btn-apply-match');
  const linkWrap       = shadow.getElementById('ct-link-wrap');
  const linkToggle     = shadow.getElementById('ct-link-toggle');
  const linkSelect     = shadow.getElementById('ct-link-select');

  let selectedTag     = 'manga';
  let toastTimer      = null;
  let currentTitle    = '';
  let currentUrl      = '';
  let existingEntry   = null; // Representa a obra existente (WorkEntry)
  let matchedSource   = null;

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

  // ── Site Drivers (Regras específicas e isoladas por plataforma) ─
  function runSiteDriver(domain) {
    if (!domain) return null;

    // Crunchyroll Driver
    if (domain.includes('crunchyroll')) {
      let title = '';
      let chapter = '';

      function isSeasonDesc(str) {
        if (!str || typeof str !== 'string') return false;
        const s = str.trim();
        return /^(?:\d+ª?\s*)?(?:temp(?:orada)?|season)(?:\s*\d+)?(?:\s*[-–—|·•~:]\s*.*)?$/i.test(s) ||
               /^(?:temp(?:orada)?|[st])\s*\d+[-_.\s|]*(?:[eE]p(?:is[oó]dio)?\.?|[eE])\s*\d+/i.test(s) ||
               /^(?:epis[oó]dio|episode|ep\.?)\s*\d+$/i.test(s);
      }

      const currentUrl = window.location.href;
      const isSeriesPage = /\/series\/[A-Za-z0-9_-]+/i.test(currentUrl);

      // ── CENÁRIO 1: Página da Própria Série (/series/:id/:slug) ──
      // Na página da série, o anime é a própria página em exibição.
      // NUNCA buscamos outros links "a[href*=/series/]" no documento para não capturar itens do menu/header.
      if (isSeriesPage) {
        // 1.1 Título principal no H1 da página de série
        const h1 = document.querySelector('h1.title, h1[data-t="title"], h1.heading--nKNOf, h1:not(.site-title):not(.logo):not([class*="site"]):not([class*="logo"])');
        if (h1 && h1.textContent) {
          const rawH1 = h1.textContent.trim();
          const cleanH1 = typeof StorageLocal !== 'undefined' && StorageLocal.cleanWorkTitle ? StorageLocal.cleanWorkTitle(rawH1) : rawH1;
          if (cleanH1 && cleanH1.length > 1 && !/^(?:crunchyroll|in[íi]cio|home|browse|navegar|s[eé]ries|animes)$/i.test(cleanH1) && !isSeasonDesc(cleanH1)) {
            title = cleanH1;
          }
        }

        // 1.2 JSON-LD Schema.org TVSeries
        if (!title) {
          try {
            const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
            for (const s of scripts) {
              const raw = (s.textContent || '').trim();
              if (!raw) continue;
              const parsed = JSON.parse(raw);
              const list = Array.isArray(parsed) ? parsed : (parsed['@graph'] || [parsed]);
              for (const item of list) {
                if (item && (item['@type'] === 'TVSeries' || item['@type'] === 'Series') && item.name) {
                  const sName = item.name.trim();
                  if (sName.length > 1 && !isSeasonDesc(sName)) {
                    title = sName;
                    break;
                  }
                }
              }
              if (title) break;
            }
          } catch (_) {}
        }

        // 1.3 Meta tags og:title / twitter:title
        if (!title) {
          const og = document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';
          if (og) {
            const cleanOg = typeof StorageLocal !== 'undefined' && StorageLocal.cleanWorkTitle ? StorageLocal.cleanWorkTitle(og) : og.trim();
            if (cleanOg && cleanOg.length > 1 && !isSeasonDesc(cleanOg)) {
              title = cleanOg;
            }
          }
        }

        // 1.4 Slug extraído diretamente da URL atual (/series/:id/:slug)
        if (!title && typeof StorageLocal !== 'undefined' && StorageLocal.extractSlugTitle) {
          const slugT = StorageLocal.extractSlugTitle(currentUrl);
          if (slugT && !isSeasonDesc(slugT)) {
            title = slugT;
          }
        }

        // 1.5 document.title como fallback
        if (!title && document.title) {
          const cleanDoc = typeof StorageLocal !== 'undefined' && StorageLocal.cleanWorkTitle ? StorageLocal.cleanWorkTitle(document.title) : document.title.trim();
          if (cleanDoc && cleanDoc.length > 1 && !isSeasonDesc(cleanDoc)) {
            title = cleanDoc;
          }
        }
      }

      // ── CENÁRIO 2: Página de Reprodução / Episódio (/watch/:id/:slug) ou Outras Rotas ──
      if (!title) {
        // 2.1 JSON-LD Schema.org TVEpisode / partOfSeries (Fonte mais estruturada e precisa no player)
        try {
          const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
          for (const s of scripts) {
            const raw = (s.textContent || '').trim();
            if (!raw) continue;
            const parsed = JSON.parse(raw);
            const list = Array.isArray(parsed) ? parsed : (parsed['@graph'] || [parsed]);
            for (const item of list) {
              if (item && (item.partOfSeries || item.partOfTVSeries)) {
                const seriesObj = item.partOfSeries || item.partOfTVSeries;
                const sName = typeof seriesObj === 'string' ? seriesObj : (seriesObj.name || '');
                if (!title && sName && sName.trim().length > 1 && !isSeasonDesc(sName)) {
                  title = sName.trim();
                }
                if (!chapter) {
                  const epNum = item.episodeNumber;
                  const seasonNum = item.partOfSeason && (item.partOfSeason.seasonNumber || item.partOfSeason.seasonDisplayNumber);
                  if (seasonNum && epNum) {
                    const sPadded = String(seasonNum).padStart(2, '0');
                    const epInt = parseInt(epNum, 10);
                    const ePadded = epInt < 100 ? String(epInt).padStart(2, '0') : String(epInt);
                    chapter = `Temp ${sPadded} - Ep ${ePadded}`;
                  } else if (epNum) {
                    chapter = `Ep. ${epNum}`;
                  }
                }
                if (title && chapter) break;
              }
            }
            if (title && chapter) break;
          }
        } catch (_) {}

        // 2.2 Elementos semânticos dedicados do player (.show-title-link, [data-t="show-title-link"], breadcrumbs)
        if (!title) {
          const showLink = document.querySelector([
            'a.show-title-link', '[data-t="show-title-link"]', '.show-title-link a', '.show-title-link',
            '[data-t="series-title"]', '.hero-heading-line a', '.current-media-parent a',
            '.breadcrumb a[href*="/series/"]', '.breadcrumbs a[href*="/series/"]', '[data-t="breadcrumb"] a[href*="/series/"]'
          ].join(', '));

          if (showLink) {
            const t = (showLink.textContent || '').trim();
            if (t && t.length > 1 && !isSeasonDesc(t) && !/^(?:in[íi]cio|home|series|animes|crunchyroll)$/i.test(t)) {
              title = t;
            } else {
              const href = showLink.getAttribute('href') || '';
              const slugTitle = typeof StorageLocal !== 'undefined' && StorageLocal.extractSlugTitle ? StorageLocal.extractSlugTitle(href) : '';
              if (slugTitle && !isSeasonDesc(slugTitle)) {
                title = slugTitle;
              }
            }
          }
        }

        // 2.3 Busca links de série SOMENTE dentro de containers de mídia/player e NUNCA no header/nav/footer/carrossel
        if (!title) {
          const mediaContainer = document.querySelector('.erc-current-media-info, .current-media-parent, .hero-heading-line, [data-t="media-info"], .player-container');
          if (mediaContainer) {
            const a = mediaContainer.querySelector('a[href*="/series/"]');
            if (a) {
              const t = (a.textContent || '').trim();
              if (t && t.length > 1 && !isSeasonDesc(t) && !/^(?:in[íi]cio|home|series|animes|crunchyroll)$/i.test(t)) {
                title = t;
              } else {
                const href = a.getAttribute('href') || '';
                const slugTitle = typeof StorageLocal !== 'undefined' && StorageLocal.extractSlugTitle ? StorageLocal.extractSlugTitle(href) : '';
                if (slugTitle && !isSeasonDesc(slugTitle)) title = slugTitle;
              }
            }
          }
        }

        // 2.4 Extração via document.title / meta og:title no player (ex: "Danganronpa 3 - Episódio 1 - Despair - Assistir na Crunchyroll")
        if (!title) {
          const rawDoc = document.title || document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';
          if (rawDoc) {
            const cleanDoc = typeof StorageLocal !== 'undefined' && StorageLocal.cleanWorkTitle ? StorageLocal.cleanWorkTitle(rawDoc) : '';
            if (cleanDoc && cleanDoc.length > 1 && !isSeasonDesc(cleanDoc) && !/^(?:crunchyroll|in[íi]cio|home)$/i.test(cleanDoc)) {
              title = cleanDoc;
            }
          }
        }
      }

      // ── Extração de capítulo via metadados do player se JSON-LD não tiver ──
      if (!chapter) {
        const metaEl = document.querySelector('.erc-current-media-info, .current-media-parent, .hero-heading-line, [data-t="episode-title"], [data-t="title"], select[name*="season"]');
        if (metaEl && metaEl.textContent) {
          chapter = StorageLocal.extractChapter(window.location.href, document.title || '', metaEl.textContent);
        } else if (document.title) {
          chapter = StorageLocal.extractChapter(window.location.href, document.title);
        }
      }

      if (title || chapter) {
        return {
          title: title ? StorageLocal.cleanWorkTitle(title) : '',
          chapter,
          tag: 'anime'
        };
      }
    }

    // AnimesOnline Driver
    if (domain.includes('animesonline')) {
      let title = '';
      const h1 = document.querySelector('h1.entry-title, h1');
      if (h1 && h1.textContent) {
        const cleaned = StorageLocal.cleanWorkTitle(h1.textContent);
        if (cleaned && !/^(?:todos\s+os|animes\s+online)/i.test(cleaned)) {
          title = cleaned;
        }
      }
      return {
        title,
        chapter: '',
        tag: 'anime'
      };
    }

    return null;
  }

  // ── Extrai dados limpos da página (título e capítulo) ────
  async function extractPageData() {
    const rawTitle = document.title || '';
    const currentUrl = window.location.href;

    const siteDomain = typeof StorageLocal !== 'undefined' && StorageLocal.extractDomain ? StorageLocal.extractDomain(currentUrl) : '';
    const siteName = typeof StorageLocal !== 'undefined' && StorageLocal.formatSiteName ? StorageLocal.formatSiteName(siteDomain).toLowerCase() : '';

    let domWorkTitle = '';
    let chapter = '';

    // 0. Executa driver dedicado do site se disponível (isolamento total)
    const driverResult = runSiteDriver(siteDomain);
    if (driverResult) {
      if (driverResult.title) domWorkTitle = driverResult.title;
      if (driverResult.chapter) chapter = driverResult.chapter;
    }

    // 0.0 Procura dados estruturados Schema.org (JSON-LD) genéricos se driver não encontrou
    if (!domWorkTitle) {
      try {
        const jsonLdScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
        for (const s of jsonLdScripts) {
          const raw = (s.textContent || '').trim();
          if (!raw) continue;
          const parsed = JSON.parse(raw);
          const list = Array.isArray(parsed) ? parsed : (parsed['@graph'] || [parsed]);
          for (const item of list) {
            if (item && (item.partOfSeries || item.partOfTVSeries)) {
              const seriesObj = item.partOfSeries || item.partOfTVSeries;
              const sName = typeof seriesObj === 'string' ? seriesObj : (seriesObj.name || '');
              if (sName && sName.trim().length > 1) {
                domWorkTitle = sName.trim();
              }
              if (!chapter) {
                const epNum = item.episodeNumber;
                const seasonNum = item.partOfSeason && (item.partOfSeason.seasonNumber || item.partOfSeason.seasonDisplayNumber);
                if (seasonNum && epNum) {
                  const sPadded = String(seasonNum).padStart(2, '0');
                  const epInt = parseInt(epNum, 10);
                  const ePadded = epInt < 100 ? String(epInt).padStart(2, '0') : String(epInt);
                  chapter = `Temp ${sPadded} - Ep ${ePadded}`;
                } else if (epNum) {
                  chapter = `Ep. ${epNum}`;
                }
              }
              if (domWorkTitle) break;
            }
          }
          if (domWorkTitle) break;
        }
      } catch (_) {}
    }

    // 0.1 Botões ou links de retorno com título da obra (ex: NexusToons: button/a[title="Voltar para Nome da Obra"])
    if (!domWorkTitle) {
      const backBtn = document.querySelector('button[title^="Voltar para "], a[title^="Voltar para "], [title^="Voltar para "]');
      if (backBtn) {
        const backTitle = backBtn.getAttribute('title').replace(/^Voltar\s+para\s+/i, '').trim();
        if (backTitle && !/^(?:in[íi]cio|home|downloads|obras|menu|cat[aá]logo)$/i.test(backTitle)) {
          domWorkTitle = backTitle;
        }
      }
    }

    // 0.2 Link direto da obra em cabeçalhos de leitura (ex: a[href*="/manga/"])
    if (!domWorkTitle) {
      const mangaLink = document.querySelector('a[href*="/manga/"]');
      if (mangaLink) {
        if (mangaLink.getAttribute('title')) {
          const t = mangaLink.getAttribute('title').replace(/^Voltar\s+para\s+/i, '').trim();
          if (t && !/^(?:in[íi]cio|home|obras)$/i.test(t)) domWorkTitle = t;
        } else if (mangaLink.textContent && mangaLink.textContent.trim().length > 1) {
          const t = mangaLink.textContent.trim();
          if (!/^(?:in[íi]cio|home|todos|voltar)$/i.test(t)) domWorkTitle = t;
        } else if (mangaLink.getAttribute('href') && typeof StorageLocal !== 'undefined' && StorageLocal.slugToTitle) {
          const m = mangaLink.getAttribute('href').match(/\/manga\/([^/?#]+)/i);
          if (m && m[1]) domWorkTitle = StorageLocal.slugToTitle(m[1]);
        }
      }
    }

    // 0.3 H1 com atributo title (ex: NexusToons: <h1 title="Nome da Obra">Nome</h1>)
    if (!domWorkTitle) {
      const h1WithTitle = document.querySelector('h1[title]:not(.site-title):not(.logo):not([class*="site"]):not([class*="logo"])');
      if (h1WithTitle) {
        const t = (h1WithTitle.getAttribute('title') || h1WithTitle.textContent || '').trim();
        if (t && !/^(?:verificacao\s+de\s+seguranca|security|turnstile|in[íi]cio|home)$/i.test(t)) {
          domWorkTitle = t;
        }
      }
    }

    // 0.4 Seletores semânticos clássicos e plataformas de streaming (Crunchyroll .show-title-link)
    if (!domWorkTitle) {
      const semanticTitleEl = document.querySelector([
        '.show-title-link', 'a.show-title-link', '[data-t="show-title-link"]', '[data-t="series-title"]',
        '.hero-heading-line a', 'h4.heading--is-link a', 'h4.heading--is-link',
        '.breadcrumb a[href*="/series/"]', '.breadcrumbs a[href*="/series/"]',
        '.manga-title a', '.series-title a', '.chapter-title-bar .manga-title a',
        'h1.manga-title', 'h1.entry-title', 'h1.series-title', 'h1.post-title',
        '.manga-title', '.series-title', '.novel-title', '[itemprop="name"]'
      ].join(', '));
      if (semanticTitleEl && semanticTitleEl.textContent) {
        const t = semanticTitleEl.textContent.trim();
        if (t.length > 1 && !/^(?:in[íi]cio|home|manga livre|nexus|todos os mang[aá]s|crunchyroll)$/i.test(t)) {
          domWorkTitle = t;
        }
      }
    }

    // 1. Procura link específico da obra em breadcrumbs ou leitor (com suporte a rotas com locale como /pt-br/series/...)
    if (!domWorkTitle) {
      const candidateLinks = Array.from(document.querySelectorAll('a[href*="/obra/"], a[href*="/story/"], a[href*="/title/"], a[href*="/manga/"], a[href*="/series/"], a[href*="/anime/"], a[href*="/show/"], .show-title-link, .breadcrumb a, .breadcrumbs a'));
      for (const a of candidateLinks) {
        if (a.closest && a.closest('header, nav:not([class*="breadcrumb"]):not([class*="crumbs"]), footer, [role="navigation"], .erc-header, .erc-nav, [data-t="carousel"], .erc-carousel')) continue;
        const text = (a.textContent || '').trim();
        if (!text || text.length <= 1) continue;
        if (/^(?:in[íi]cio|home|todos\s+os\s+(?:mang[aá]s|epis[oó]dios|cap[íi]tulos|filmes)|todos\s+os\s+epis[oó]dios|mang[aá]s|animes|cat[aá]logo|menu|lista|all|cap[íi]tulo|chapter|epis[óo]dio|episode|crunchyroll)/i.test(text)) continue;
        try {
          const u = new URL(a.getAttribute('href') || '', window.location.origin);
          const parts = u.pathname.split('/').filter(Boolean);
          const idx = parts.findIndex(p => ['manga', 'obra', 'story', 'title', 'series', 'anime', 'show'].includes(p.toLowerCase()));
          if (idx !== -1 && parts.length > idx + 1) {
            domWorkTitle = text;
            break;
          }
        } catch (_) {}
      }
    }

    // 2. Inspeciona meta tags no DOM (og:title, twitter:title)
    const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';
    const twitterTitle = document.querySelector('meta[name="twitter:title"]')?.getAttribute('content') || '';

    let domText = '';
    const heading = document.querySelector([
      'select[name*="chapter"] option:checked', '#chapter-select option:checked', '.chapter-select option:checked',
      '.current-chapter', '.chapter-title', 'h1.chapter-title', '[class*="chapter-title"]',
      'h1:not(.site-title):not(.logo):not([class*="site"]):not([class*="logo"])',
      'h2:not(.site-title):not(.logo):not([class*="site"]):not([class*="logo"])'
    ].join(', '));
    if (heading && !/verificacao\s+de\s+seguranca|security|turnstile/i.test(heading.textContent || '')) {
      domText = heading.textContent || '';
    }

    // 2.1 Procura também em spans e cabeçalhos de capítulos/episódios do leitor
    if (!domText || !/(?:cap|ch|ep|\be\d)/i.test(domText)) {
      const chapterSpan = Array.from(document.querySelectorAll('span, h2, h3, h4, div')).find(el => {
        const txt = (el.textContent || '').trim();
        return /^(?:cap[íi]tulo|cap\.?|ch\.?|epis[óo]dio|ep\.?|e)\s*\d+(?:\.\d+)?$/i.test(txt) ||
               (/^(?:cap[íi]tulo|cap\.?|ch\.?|epis[óo]dio|ep\.?|e)\s*\d+(?:\.\d+)?\b/i.test(txt) && txt.length < 25);
      });
      if (chapterSpan) {
        domText = chapterSpan.textContent.trim();
      }
    }

    if (!chapter) {
      chapter = typeof StorageLocal !== 'undefined' && StorageLocal.extractChapter
        ? StorageLocal.extractChapter(currentUrl, rawTitle, domText)
        : '';
    }

    let cleanTitle = typeof StorageLocal !== 'undefined' && StorageLocal.cleanWorkTitle
      ? StorageLocal.cleanWorkTitle(rawTitle)
      : '';

    const cleanDomainName = (siteDomain || '').replace(/\.[a-z]+$/, '').toLowerCase();
    const isGeneric = !cleanTitle ||
      cleanTitle.toLowerCase() === siteName ||
      cleanTitle.toLowerCase() === cleanDomainName ||
      (cleanDomainName.length >= 4 && cleanTitle.toLowerCase().includes(cleanDomainName) && cleanTitle.length < cleanDomainName.length + 4) ||
      /^(?:nexus|nexustoons|manga\s*livre|mangalivre|vegitoons|mang[aá]stop|mangadex|crunchyroll|leitor|reader|read online|ler online|cap[íi]tulo\s*\d+|chapter\s*\d+|epis[óo]dio\s*\d+|site\s+principal|todos\s+os\s+mang[aá]s)$/i.test(cleanTitle);

    if (domWorkTitle) {
      const cleanDom = StorageLocal.cleanWorkTitle(domWorkTitle);
      if (cleanDom && cleanDom.toLowerCase() !== siteName && cleanDom.toLowerCase() !== cleanDomainName) {
        cleanTitle = cleanDom;
      }
    }

    if (isGeneric && ogTitle) {
      const cleanOg = StorageLocal.cleanWorkTitle(ogTitle);
      if (cleanOg && cleanOg.toLowerCase() !== siteName && cleanOg.toLowerCase() !== cleanDomainName) {
        cleanTitle = cleanOg;
      }
    }

    if ((isGeneric || !cleanTitle) && twitterTitle) {
      const cleanTw = StorageLocal.cleanWorkTitle(twitterTitle);
      if (cleanTw && cleanTw.toLowerCase() !== siteName && cleanTw.toLowerCase() !== cleanDomainName) {
        cleanTitle = cleanTw;
      }
    }

    if ((isGeneric || !cleanTitle) && heading) {
      const cleanHeading = StorageLocal.cleanWorkTitle(heading.textContent || '');
      if (cleanHeading && cleanHeading.toLowerCase() !== siteName && cleanHeading.toLowerCase() !== cleanDomainName) {
        cleanTitle = cleanHeading;
      }
    }

    if ((isGeneric || !cleanTitle) && typeof StorageLocal !== 'undefined' && StorageLocal.extractSlugTitle) {
      const slugTitle = StorageLocal.extractSlugTitle(currentUrl);
      if (slugTitle && slugTitle.toLowerCase() !== siteName && slugTitle.toLowerCase() !== cleanDomainName) {
        cleanTitle = slugTitle;
      }
    }

    // Se ainda for genérico ou vazio, consulta o resolvedor assíncrono para SPAs conhecidas
    if ((isGeneric || !cleanTitle || cleanTitle.toLowerCase() === siteName) && typeof StorageLocal !== 'undefined' && StorageLocal.resolvePageWorkDetails) {
      const details = await StorageLocal.resolvePageWorkDetails(currentUrl);
      if (details) {
        if (details.workName) cleanTitle = details.workName;
        if (details.chapter && !chapter) chapter = details.chapter;
      }
    }

    if (!cleanTitle || cleanTitle.toLowerCase() === siteName || cleanTitle.toLowerCase() === cleanDomainName) {
      cleanTitle = rawTitle.replace(/\s*[-–|·•]\s*.{0,40}$/, '').trim() || 'Obra Desconhecida';
    }

    // Extrai títulos alternativos do DOM da página (ex: .alternative-title, .alt-name, itemprop="alternateName")
    const domAliases = [];
    try {
      const aliasEls = document.querySelectorAll([
        '.manga-alternative-title', '.alternative-title', '.alternative-titles',
        '.alt-titles', '.alt-title', '.alt-name', '.other-name', '.other-names',
        '.series-alternative', '[itemprop="alternateName"]', '.entry-subtitle',
        '.sub-title', '.subtitle'
      ].join(', '));
      aliasEls.forEach(el => {
        const txt = (el.textContent || '').trim();
        if (txt && txt.length > 1 && txt.length < 250) {
          const parts = txt.split(/[,;\n|]+/).map(p => p.trim()).filter(Boolean);
          parts.forEach(p => {
            if (p.length > 1 && !/^(?:alternativo|alternative|nomes?|outros?|sin[oô]nimos?|t[íi]tulos?)$/i.test(p)) {
              if (!domAliases.includes(p)) domAliases.push(p);
            }
          });
        }
      });
    } catch (_) {}

    // Extrai títulos duplos/alternativos do título detectado (ex: "Nome Principal (Nome Alternativo)" ou "Nome 1 / Nome 2")
    const dual = typeof StorageLocal !== 'undefined' && StorageLocal.extractDualTitles
      ? StorageLocal.extractDualTitles(cleanTitle)
      : { primary: cleanTitle, aliases: [] };

    if (dual.primary) {
      cleanTitle = dual.primary;
    }
    const combinedAliases = Array.from(new Set([...dual.aliases, ...domAliases]));

    return { title: cleanTitle, chapter, aliases: combinedAliases };
  }

  // ── Atualiza badge com total de obras ────────────────────
  function updateBadge(works) {
    if (!appSettings.enableBadgeCount) {
      badge.classList.remove('visible');
      return;
    }
    const count = (works || []).filter(w => !w.deleted).length;
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.classList.add('visible');
    } else {
      badge.classList.remove('visible');
    }
  }

  function selectExistingWorkToLink(work, siteLabel, siteDomain) {
    if (!work) return;
    existingEntry = work;
    editIdInp.value = work.id;
    nameInp.value = work.name;
    nameInp.readOnly = true;
    nameInp.style.opacity = '.6';
    nameLabel.innerHTML = 'VINCULAR A: <em>' + esc(work.name) + '</em>';
    setTag(work.tag || selectedTag);

    matchedSource = (work.sources || []).find(s => {
      return (s.domain && s.domain === siteDomain) || (s.siteName && s.siteName.toLowerCase() === (siteLabel || '').toLowerCase());
    });

    statusEl.className = 'known new-source';
    statusEl.innerHTML = `<span>🔗 Vinculando a:</span> <span>${esc(work.name)}</span>`;
    sourceTextEl.textContent = `Novo alias: "${currentTitle}" ➔ ${work.name}`;
    btnSave.textContent = 'Vincular e Salvar';
    if (suggestionWrap) suggestionWrap.style.display = 'none';

    // Submete ao catálogo coletivo de aliases em background
    if (typeof AliasCrowdService !== 'undefined' && AliasCrowdService.submitAliasLink && currentTitle) {
      AliasCrowdService.submitAliasLink({
        alias: currentTitle,
        canonicalTitle: work.name,
        userFingerprint: 'user_' + (work.id || 'local')
      }).catch(() => {});
    }
  }

  // ── Reset total de estado (Clean State Lifecycle) ────────
  function resetFormState() {
    existingEntry = null;
    matchedSource = null;
    currentTitle = '';
    currentUrl = window.location.href;
    if (editIdInp) editIdInp.value = '';
    if (nameInp) {
      nameInp.value = '';
      nameInp.readOnly = false;
      nameInp.style.opacity = '1';
    }
    if (nameLabel) nameLabel.innerHTML = 'TÍTULO DA OBRA';
    if (chapterInp) chapterInp.value = '';
    if (statusEl) {
      statusEl.className = '';
      statusEl.innerHTML = '';
    }
    if (sourceTextEl) sourceTextEl.textContent = '';
    if (btnSave) btnSave.textContent = 'Salvar Obra';
    if (suggestionWrap) suggestionWrap.style.display = 'none';
    if (linkWrap) linkWrap.style.display = 'none';
    if (linkSelect) {
      linkSelect.classList.remove('open');
      linkSelect.value = '';
      linkSelect.innerHTML = '<option value="">-- Escolha uma das suas obras salvas --</option>';
    }
  }

  // ── Preenche o form ao abrir ─────────────────────────────
  let lastExtractedPageData = { title: '', chapter: '', aliases: [] };

  async function populateForm() {
    resetFormState();
    let pageData = { title: '', chapter: '', aliases: [] };
    try {
      pageData = await extractPageData();
    } catch (_) {
      pageData = {
        title: typeof StorageLocal !== 'undefined' && StorageLocal.cleanWorkTitle ? StorageLocal.cleanWorkTitle(document.title || '') : (document.title || ''),
        chapter: typeof StorageLocal !== 'undefined' && StorageLocal.extractChapter ? StorageLocal.extractChapter(window.location.href, document.title || '') : '',
        aliases: []
      };
    }
    lastExtractedPageData = pageData;

    currentTitle = pageData.title || (typeof StorageLocal !== 'undefined' && StorageLocal.cleanWorkTitle ? StorageLocal.cleanWorkTitle(document.title || '') : '') || document.title || 'Obra Desconhecida';
    currentUrl   = window.location.href;
    const detectedChapter = pageData.chapter || (typeof StorageLocal !== 'undefined' && StorageLocal.extractChapter ? StorageLocal.extractChapter(currentUrl, document.title || '') : '') || 'Cap. 1';

    const siteDomain = StorageLocal.extractDomain(currentUrl) || currentHost;
    const siteLabel  = StorageLocal.formatSiteName(siteDomain);

    const works = await StorageLocal.getWorks();
    updateBadge(works);

    // Reseta áreas dinâmicas de sugestão e vínculo
    if (suggestionWrap) suggestionWrap.style.display = 'none';
    if (linkWrap) linkWrap.style.display = 'none';
    if (linkSelect) {
      linkSelect.classList.remove('open');
      linkSelect.value = '';
      linkSelect.innerHTML = '<option value="">-- Escolha uma das suas obras salvas --</option>';
    }

    // 1. Match local imediato (0ms de latência para preenchimento garantido)
    const localMatch = typeof StorageLocal !== 'undefined' && StorageLocal.findMatchingWork
      ? StorageLocal.findMatchingWork(currentTitle, works)
      : { exactMatch: null, suggestions: [] };

    const matchResult = localMatch;
    existingEntry = matchResult.exactMatch;

    if (existingEntry) {
      editIdInp.value    = existingEntry.id;
      nameInp.value      = existingEntry.name;
      nameInp.readOnly   = true;
      nameInp.style.opacity = '.6';
      nameLabel.innerHTML = 'OBRA <em>(já cadastrada)</em>';
      setTag(existingEntry.tag || 'manga');

      matchedSource = (existingEntry.sources || []).find(s => {
        return (s.domain && s.domain === siteDomain) || (s.siteName && s.siteName.toLowerCase() === siteLabel.toLowerCase());
      });

      if (matchedSource) {
        statusEl.className = 'known';
        statusEl.innerHTML = `Continuando: <span>${esc(existingEntry.name)}</span>`;
        if (matchResult.viaAlias || matchResult.viaCanonical) {
          sourceTextEl.textContent = `Identificado via alias: "${currentTitle}"`;
        } else if (existingEntry.name.toLowerCase() !== currentTitle.toLowerCase()) {
          sourceTextEl.textContent = `Fonte: ${matchedSource.siteName} (via alias: ${currentTitle})`;
        } else {
          sourceTextEl.textContent = `Fonte: ${matchedSource.siteName} (Último: ${matchedSource.chapter})`;
        }
        chapterInp.value = detectedChapter || matchedSource.chapter || '';
        btnSave.textContent = 'Atualizar Progresso';
      } else {
        statusEl.className = 'known new-source';
        statusEl.innerHTML = `<span>＋ Nova fonte</span> para: <span>${esc(existingEntry.name)}</span>`;
        if (matchResult.viaAlias || matchResult.viaCanonical) {
          sourceTextEl.textContent = `Identificado via alias "${currentTitle}" (${siteLabel})`;
        } else {
          sourceTextEl.textContent = `Novo site detectado: ${siteLabel} (${siteDomain})`;
        }
        chapterInp.value = detectedChapter || existingEntry.mainChapter || '';
        btnSave.textContent = 'Vincular Novo Site';
      }
    } else {
      statusEl.className = '';
      statusEl.innerHTML = `Página: <span>${esc(currentTitle.slice(0, 36))}${currentTitle.length > 36 ? '…' : ''}</span>`;
      sourceTextEl.textContent = `Site: ${siteLabel} (${siteDomain})`;
      editIdInp.value    = '';
      nameInp.value      = currentTitle;
      nameInp.readOnly   = false;
      nameInp.style.opacity = '1';
      nameLabel.innerHTML = 'TÍTULO DA OBRA';
      chapterInp.value   = detectedChapter || 'Cap. 1';
      if (/^filme/i.test(detectedChapter || '')) {
        setTag('filme');
      } else if (siteDomain.includes('anime') || siteDomain.includes('crunchyroll')) {
        setTag('anime');
      } else if (detectedChapter && /^(?:temp|[st]\d)/i.test(detectedChapter)) {
        setTag('serie');
      } else if (detectedChapter && /^ep\./i.test(detectedChapter)) {
        setTag('anime');
      } else {
        setTag('manga');
      }
      btnSave.textContent = 'Salvar Obra';

      // 1. Sugestão inteligente de match aproximado
      if (matchResult.suggestions && matchResult.suggestions.length > 0 && suggestionWrap) {
        const topSuggestion = matchResult.suggestions[0];
        suggestionWrap.style.display = 'flex';
        suggestionText.innerHTML = `Obra similar: <strong>${esc(topSuggestion.work.name)}</strong> (${Math.round(topSuggestion.score * 100)}%)`;
        btnApplyMatch.onclick = () => {
          selectExistingWorkToLink(topSuggestion.work, siteLabel, siteDomain);
        };
      }

      // 1b. Resolução assíncrona em segundo plano para aliases e títulos oficiais
      if (!existingEntry && typeof StorageLocal !== 'undefined' && StorageLocal.findMatchingWorkAsync) {
        StorageLocal.findMatchingWorkAsync(currentTitle, works).then(asyncMatch => {
          if (asyncMatch && asyncMatch.exactMatch && !existingEntry) {
            selectExistingWorkToLink(asyncMatch.exactMatch, siteLabel, siteDomain);
          } else if (asyncMatch && asyncMatch.suggestions && asyncMatch.suggestions.length > 0 && suggestionWrap && !existingEntry) {
            const topSuggestion = asyncMatch.suggestions[0];
            suggestionWrap.style.display = 'flex';
            suggestionText.innerHTML = `Obra similar: <strong>${esc(topSuggestion.work.name)}</strong> (${Math.round(topSuggestion.score * 100)}%)`;
            btnApplyMatch.onclick = () => {
              selectExistingWorkToLink(topSuggestion.work, siteLabel, siteDomain);
            };
          }
        }).catch(() => {});
      }

      // 2. Opção de vincular manualmente a qualquer obra cadastrada
      const activeWorks = works.filter(w => !w.deleted);
      if (activeWorks.length > 0 && linkWrap && linkSelect) {
        linkWrap.style.display = 'flex';

        // Ao clicar no botão, SEMPRE consulta fresco do storage e vem zerado
        linkToggle.onclick = async () => {
          const isCurrentlyOpen = linkSelect.classList.contains('open');
          if (isCurrentlyOpen) {
            linkSelect.classList.remove('open');
            return;
          }

          // Consulta SEMPRE fresca direto do storage
          const allStoredWorks = await StorageLocal.getWorks();
          const freshActiveWorks = (allStoredWorks || []).filter(w => !w.deleted);
          freshActiveWorks.sort((a, b) => a.name.localeCompare(b.name, 'pt', { sensitivity: 'base' }));

          linkSelect.innerHTML = '<option value="">-- Escolha uma das suas obras salvas --</option>';
          freshActiveWorks.forEach(w => {
            const opt = document.createElement('option');
            opt.value = w.id;
            opt.textContent = w.name;
            linkSelect.appendChild(opt);
          });

          // Vem SEMPRE zerado/neutro, sem opções do passado selecionadas
          linkSelect.value = '';
          linkSelect.classList.add('open');
          linkSelect.focus();
        };

        linkSelect.onchange = async () => {
          const chosenId = linkSelect.value;
          if (chosenId) {
            const allStoredWorks = await StorageLocal.getWorks();
            const chosen = (allStoredWorks || []).find(w => w.id === chosenId);
            if (chosen) selectExistingWorkToLink(chosen, siteLabel, siteDomain);
          } else {
            // Se desmarcou ou voltou ao neutro, restaura estado limpo detectado da página
            await populateForm();
          }
        };
      }
    }

    setTimeout(() => chapterInp.focus(), 80);
  }

  // ── Botão +1 Rápido no Form ──────────────────────────────
  incBtn.addEventListener('click', () => {
    const currentVal = chapterInp.value.trim() || (existingEntry ? existingEntry.mainChapter : 'Cap. 0');
    chapterInp.value = StorageLocal.parseChapterIncrement(currentVal);
    chapterInp.focus();
  });

  // ── Drag & Drop do Botão Flutuante (Móvel) ───────────────
  const STORAGE_KEY_FAB_POS = 'chapter_tracker_fab_pos';
  let isPointerDown = false;
  let hasDragged = false;
  let startPointerX = 0;
  let startPointerY = 0;
  let initialHostX = 0;
  let initialHostY = 0;

  function applyFabPosition(x, y) {
    const fabSize = 48;
    const padding = 10;
    const maxX = Math.max(padding, window.innerWidth - fabSize - padding);
    const maxY = Math.max(padding, window.innerHeight - fabSize - padding);

    const clampedX = Math.min(Math.max(padding, x), maxX);
    const clampedY = Math.min(Math.max(padding, y), maxY);

    host.style.left = `${clampedX}px`;
    host.style.top  = `${clampedY}px`;
    host.style.right = 'auto';
    host.style.bottom = 'auto';

    adjustPanelPlacement(clampedX, clampedY);
  }

  function adjustPanelPlacement(x, y) {
    const isUpper = y < (window.innerHeight / 2);
    const isLeft  = x < (window.innerWidth / 2);

    panel.style.top = isUpper ? '58px' : 'auto';
    panel.style.bottom = isUpper ? 'auto' : '58px';
    panel.style.left = isLeft ? '0' : 'auto';
    panel.style.right = isLeft ? 'auto' : '0';
  }

  function loadFabPosition() {
    try {
      if (typeof chrome !== 'undefined' && chrome && chrome.storage && chrome.storage.local) {
        const resPromise = chrome.storage.local.get([STORAGE_KEY_FAB_POS], res => {
          if (res && res[STORAGE_KEY_FAB_POS] && typeof res[STORAGE_KEY_FAB_POS].left === 'number') {
            applyFabPosition(res[STORAGE_KEY_FAB_POS].left, res[STORAGE_KEY_FAB_POS].top);
          } else {
            host.style.left = 'auto';
            host.style.top = 'auto';
            host.style.bottom = '24px';
            host.style.right = '24px';
          }
        });
        if (resPromise && typeof resPromise.catch === 'function') {
          resPromise.catch(() => {});
        }
      }
    } catch (e) {}
  }

  fab.addEventListener('pointerdown', e => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    isPointerDown = true;
    hasDragged = false;
    startPointerX = e.clientX;
    startPointerY = e.clientY;

    const rect = host.getBoundingClientRect();
    initialHostX = rect.left;
    initialHostY = rect.top;

    try { fab.setPointerCapture(e.pointerId); } catch (err) {}
  });

  fab.addEventListener('pointermove', e => {
    if (!isPointerDown) return;
    const deltaX = e.clientX - startPointerX;
    const deltaY = e.clientY - startPointerY;

    if (!hasDragged && (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4)) {
      hasDragged = true;
      fab.style.cursor = 'grabbing';
    }

    if (hasDragged) {
      applyFabPosition(initialHostX + deltaX, initialHostY + deltaY);
    }
  });

  function endDrag(e) {
    if (!isPointerDown) return;
    isPointerDown = false;
    fab.style.cursor = 'grab';

    try { fab.releasePointerCapture(e.pointerId); } catch (err) {}

    if (hasDragged) {
      const rect = host.getBoundingClientRect();
      const pos = { left: Math.round(rect.left), top: Math.round(rect.top) };
      try {
        if (typeof chrome !== 'undefined' && chrome && chrome.storage && chrome.storage.local) {
          const resPromise = chrome.storage.local.set({ [STORAGE_KEY_FAB_POS]: pos });
          if (resPromise && typeof resPromise.catch === 'function') {
            resPromise.catch(() => {});
          }
        }
      } catch (err) {}
    }
  }

  fab.addEventListener('pointerup', endDrag);
  fab.addEventListener('pointercancel', endDrag);

  // ── Toggle painel ────────────────────────────────────────
  fab.addEventListener('click', async () => {
    if (hasDragged) {
      hasDragged = false;
      return;
    }
    const isOpen = panel.classList.contains('open');
    if (isOpen) {
      panel.classList.remove('open');
      fab.classList.remove('open');
      fabIcon.textContent = '◈';
      resetFormState();
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
    resetFormState();
  });

  // ── Salvar (Atualiza existente ou cria nova sem duplicatas) ─
  async function executeSaveReading(opts = {}) {
    if (typeof StorageLocal === 'undefined') return null;

    // Trava de segurança: autoTrack NUNCA cria obra nova do zero
    if (opts.autoTrack && !existingEntry) {
      return null;
    }

    if (!currentTitle && typeof extractPageData === 'function') {
      try {
        const pd = await extractPageData();
        if (pd && pd.title) {
          currentTitle = pd.title;
          if (pd.chapter && (!chapterInp.value || chapterInp.value === 'Cap. 1')) {
            chapterInp.value = pd.chapter;
          }
        }
      } catch (_) {}
    }

    const name    = (nameInp && nameInp.value ? nameInp.value.trim() : '') || currentTitle || 'Sem título';
    const chapter = (chapterInp && chapterInp.value ? chapterInp.value.trim() : '') || (lastExtractedPageData && lastExtractedPageData.chapter) || 'Cap. 1';

    const siteDomain = StorageLocal.extractDomain(currentUrl) || currentHost;
    const siteLabel  = StorageLocal.formatSiteName(siteDomain);

    const payload = {
      linkToWorkId: existingEntry ? existingEntry.id : undefined,
      workId:       existingEntry ? existingEntry.id : undefined,
      workName:     existingEntry ? existingEntry.name : name,
      aliases:      (lastExtractedPageData && Array.isArray(lastExtractedPageData.aliases) && lastExtractedPageData.aliases.length > 0) ? lastExtractedPageData.aliases : undefined,
      aliasName:    currentTitle && currentTitle !== (existingEntry ? existingEntry.name : name) ? currentTitle : undefined,
      chapter,
      url:          currentUrl,
      domain:       siteDomain,
      siteName:     siteLabel,
      tag:          existingEntry ? (existingEntry.tag || selectedTag) : selectedTag,
      autoTrack:    !!opts.autoTrack,
      onlyExisting: !!opts.autoTrack
    };

    const savedWork = await StorageLocal.saveWorkReading(payload);
    const updatedWorks = await StorageLocal.getWorks();
    updateBadge(updatedWorks);

    try {
      if (typeof chrome !== 'undefined' && chrome && chrome.runtime && chrome.runtime.sendMessage) {
        const responsePromise = chrome.runtime.sendMessage({ action: 'workSaved', work: savedWork }, () => {
          if (chrome.runtime && chrome.runtime.lastError) { /* ignore */ }
        });
        if (responsePromise && typeof responsePromise.catch === 'function') {
          responsePromise.catch(() => {});
        }
      }
    } catch (e) {}

    if (opts.autoTrack) {
      toast(`✓ ${chapter} concluído e salvo automaticamente! (70%)`, 2800);
    } else {
      const isUpdate = !!existingEntry;
      const isNewSource = isUpdate && !matchedSource;

      if (isNewSource) {
        toast(`✓ Novo site vinculado à ${savedWork.name}!`);
      } else if (isUpdate) {
        toast(`✓ Progresso atualizado — ${chapter}`);
      } else {
        toast(`✓ Obra salva com sucesso!`);
      }
    }

    return savedWork;
  }

  btnSave.addEventListener('click', async () => {
    await executeSaveReading({ autoTrack: false });

    setTimeout(() => {
      panel.classList.remove('open');
      fab.classList.remove('open');
      fabIcon.textContent = '◈';
      resetFormState();
    }, 1200);
  });

  // ── Auto-Tracker de Animes (70% do Vídeo & Idempotência) ──
  const autoSavedInSession = new Set();

  async function handleAutoSave(progressData = {}) {
    if (appSettings.autoTrackAnime === false) return;

    // 1. Verificação obrigatória: site DEVE ter permissão concedida (liberado em allowedDomains)
    if (!isSitePermitted(appSettings)) {
      return;
    }

    if (typeof StorageLocal === 'undefined') return;

    // 2. Busca todas as obras ativas do usuário
    const allStoredWorks = await StorageLocal.getWorks();
    const activeStoredWorks = (allStoredWorks || []).filter(w => !w.deleted);
    if (!activeStoredWorks || activeStoredWorks.length === 0) {
      // Nenhuma obra cadastrada: não cria nada do zero
      return;
    }

    // 3. Identifica se a obra já existe entre as cadastradas
    let matchedWork = existingEntry;

    if (!matchedWork) {
      let pageData = lastExtractedPageData;
      if (!pageData && typeof extractPageData === 'function') {
        try {
          pageData = await extractPageData();
        } catch (_) {}
      }

      const candidateTitle = (pageData && pageData.title) ? pageData.title : currentTitle;

      if (candidateTitle) {
        // A. Match local imediato
        if (StorageLocal.findMatchingWork) {
          const matchRes = StorageLocal.findMatchingWork(candidateTitle, activeStoredWorks);
          if (matchRes && matchRes.exactMatch) {
            matchedWork = matchRes.exactMatch;
          }
        }

        // B. Match assíncrono (canon/crowd)
        if (!matchedWork && StorageLocal.findMatchingWorkAsync) {
          try {
            const asyncMatch = await StorageLocal.findMatchingWorkAsync(candidateTitle, activeStoredWorks);
            if (asyncMatch && asyncMatch.exactMatch) {
              matchedWork = asyncMatch.exactMatch;
            }
          } catch (_) {}
        }
      }

      // C. Match por URL da fonte cadastrada
      if (!matchedWork) {
        const thisUrl = currentUrl || window.location.href;
        matchedWork = activeStoredWorks.find(w => {
          return (w.sources || []).some(s => s.url && s.url === thisUrl);
        });
      }

      // D. Match por aliases da página
      if (!matchedWork && pageData && Array.isArray(pageData.aliases)) {
        for (const alias of pageData.aliases) {
          if (StorageLocal.findMatchingWork) {
            const m = StorageLocal.findMatchingWork(alias, activeStoredWorks);
            if (m && m.exactMatch) {
              matchedWork = m.exactMatch;
              break;
            }
          }
        }
      }
    }

    // REGRA FUNDAMENTAL: Só dá auto-incremento em obras que JÁ EXISTEM sem criar novas do zero!
    if (!matchedWork) {
      return;
    }

    existingEntry = matchedWork;

    // 4. Determina capítulo/episódio
    let detectedChapter = '';
    if (chapterInp && chapterInp.value && chapterInp.value !== 'Cap. 1' && chapterInp.value !== 'Ep. 01') {
      detectedChapter = chapterInp.value.trim();
    }
    if (!detectedChapter && lastExtractedPageData && lastExtractedPageData.chapter) {
      detectedChapter = lastExtractedPageData.chapter.trim();
    }
    if (!detectedChapter && typeof extractPageData === 'function') {
      try {
        const pd = await extractPageData();
        if (pd && pd.chapter) {
          detectedChapter = pd.chapter.trim();
        }
      } catch (_) {}
    }

    const currentChapter = matchedWork.mainChapter || (matchedWork.sources && matchedWork.sources[0] ? matchedWork.sources[0].chapter : 'Ep. 0');
    const targetChapter = detectedChapter || (StorageLocal.parseChapterIncrement ? StorageLocal.parseChapterIncrement(currentChapter) : 'Ep. 1');

    const sessionKey = `${currentUrl || window.location.href}__${matchedWork.id}__${targetChapter}`;
    if (autoSavedInSession.has(sessionKey)) return;
    autoSavedInSession.add(sessionKey);

    if (chapterInp) {
      chapterInp.value = targetChapter;
    }

    await executeSaveReading({ autoTrack: true });
  }

  // Ouvinte de mensagens vindas de players embutidos em iframe
  window.addEventListener('message', event => {
    if (event && event.data && event.data.type === 'YEKUN_VIDEO_PROGRESS_COMPLETED' && event.data.source === 'yekun-dream') {
      if (!isSitePermitted(appSettings)) return;
      handleAutoSave(event.data);
    }
  });

  function updateVideoTrackerState(s = appSettings) {
    const permitted = isSitePermitted(s);
    if (s.autoTrackAnime !== false && permitted) {
      YekunVideoTracker.initAutoTracking(progressData => {
        handleAutoSave(progressData);
      });
    } else {
      YekunVideoTracker.detach();
    }
  }

  // ── Fechar ao clicar fora do host ────────────────────────
  document.addEventListener('click', e => {
    if (!host.contains(e.target) && panel.classList.contains('open')) {
      panel.classList.remove('open');
      fab.classList.remove('open');
      fabIcon.textContent = '◈';
      resetFormState();
    }
  });

  // ── Enter no campo capítulo dispara save ─────────────────
  chapterInp.addEventListener('keydown', e => {
    if (e.key === 'Enter') btnSave.click();
  });

  // ── Polling inteligente de URL (apenas enquanto ativo) ──
  let urlPollTimer = null;
  function setUrlPolling(enable) {
    if (enable) {
      if (!urlPollTimer) {
        urlPollTimer = setInterval(onUrlChange, 2000);
      }
    } else {
      if (urlPollTimer) {
        clearInterval(urlPollTimer);
        urlPollTimer = null;
      }
    }
  }

  // ── Controle Dinâmico de Visibilidade do Botão ──────────
  function updateWidgetVisibility(s = appSettings) {
    const blocked = isDomainBlocked(s.blockedDomains || []);
    const allowed = isDomainAllowed(currentHost, s.allowedDomains || []);
    const visible = !!s.enableFloatingButton && allowed && !blocked;

    updateVideoTrackerState(s);

    if (visible) {
      ensureFontsInjected();
      setUrlPolling(true);
      const targetParent = document.body || document.documentElement;
      if (targetParent && !targetParent.contains(host)) {
        targetParent.appendChild(host);
      }
      host.style.setProperty('display', 'block', 'important');
      if (typeof wrap !== 'undefined') {
        wrap.style.setProperty('display', 'block', 'important');
      }
      host.removeAttribute('hidden');
      loadFabPosition();
      if (!s.enableBadgeCount && badge) {
        badge.classList.remove('visible');
      }
    } else {
      setUrlPolling(false);
      if (host.parentNode) {
        host.remove();
      }
      host.style.setProperty('display', 'none', 'important');
      if (typeof wrap !== 'undefined') {
        wrap.style.setProperty('display', 'none', 'important');
      }
      host.setAttribute('hidden', '');
    }
  }

  updateWidgetVisibility(appSettings);
  loadFabPosition();

  // ── Listeners de Mudança em Tempo Real ───────────────────
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener(async (changes, area) => {
      if (area === 'local') {
        if (changes.chapter_tracker_settings) {
          appSettings = { ...appSettings, ...(changes.chapter_tracker_settings.newValue || {}) };
          updateWidgetVisibility(appSettings);
          if (appSettings.theme) {
            applyTheme(appSettings.theme);
          }
          if (typeof StorageLocal !== 'undefined') {
            const works = await StorageLocal.getWorks();
            updateBadge(works);
          }
        }
        if (changes.chapter_tracker_entries_v3) {
          if (typeof StorageLocal !== 'undefined') {
            const works = await StorageLocal.getWorks();
            updateBadge(works);
          }
        }
      }
    });
  }

  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg.action === 'settingsUpdated' && msg.settings) {
        appSettings = { ...appSettings, ...msg.settings };
        updateWidgetVisibility(appSettings);
        if (appSettings.theme) {
          applyTheme(appSettings.theme);
        }
        sendResponse({ ok: true });
        return true;
      }
      if (msg.action === 'getPageDetails') {
        extractPageData().then(data => {
          const siteDomain = typeof StorageLocal !== 'undefined' && StorageLocal.extractDomain ? StorageLocal.extractDomain(window.location.href) : '';
          const siteName = typeof StorageLocal !== 'undefined' && StorageLocal.formatSiteName ? StorageLocal.formatSiteName(siteDomain) : '';
          sendResponse({
            ok: true,
            title: data.title || '',
            chapter: data.chapter || '',
            aliases: data.aliases || [],
            siteName: siteName,
            url: window.location.href
          });
        }).catch(() => {
          sendResponse({ ok: false });
        });
        return true;
      }
    });
  }

  // ── Init: atualiza badge ─────────────────────────────────
  if (typeof StorageLocal !== 'undefined') {
    StorageLocal.getWorks().then(updateBadge);
  }

  // ── Monitoramento de Navegação SPA (pushState, popstate, hashchange) ────
  let lastObservedUrl = window.location.href;

  function onUrlChange() {
    const newUrl = window.location.href;
    if (newUrl !== lastObservedUrl) {
      lastObservedUrl = newUrl;
      currentTitle = '';
      currentUrl = newUrl;
      matchedSource = null;
      existingEntry = null;
      if (typeof autoSavedInSession !== 'undefined') {
        autoSavedInSession.clear();
      }
      if (typeof StorageLocal !== 'undefined') {
        StorageLocal.getWorks().then(updateBadge);
      }
    }
  }

  window.addEventListener('popstate', onUrlChange);
  window.addEventListener('hashchange', onUrlChange);

  try {
    const origPushState = history.pushState;
    if (typeof origPushState === 'function') {
      history.pushState = function(...args) {
        const res = origPushState.apply(this, args);
        setTimeout(onUrlChange, 60);
        return res;
      };
    }
    const origReplaceState = history.replaceState;
    if (typeof origReplaceState === 'function') {
      history.replaceState = function(...args) {
        const res = origReplaceState.apply(this, args);
        setTimeout(onUrlChange, 60);
        return res;
      };
    }
  } catch (_) {}

  // Polling de URL gerenciado dinamicamente via setUrlPolling(visible)

  function esc(s) {
    return String(s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

})();

})();

