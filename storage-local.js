/* ════════════════════════════════════════════════════════
   Yekun Dream — storage-local.js
   Unified local-first persistence via chrome.storage.local
   Version 3: Multi-source works and reading history
   ════════════════════════════════════════════════════════ */

(function (global) {

const STORAGE_KEY_ENTRIES_V2 = 'chapter_tracker_entries_v2';
const STORAGE_KEY_ENTRIES_V3 = 'chapter_tracker_entries_v3';
const STORAGE_KEY_SETTINGS       = 'chapter_tracker_settings';
const STORAGE_KEY_NOTIFICATIONS_V1 = 'chapter_tracker_notifications_v1';

function getStorageLocal() {
  try {
    if (typeof chrome !== 'undefined' && chrome && chrome.storage && chrome.storage.local) {
      return chrome.storage.local;
    }
  } catch (_) {}
  return null;
}

function safeStorageGet(keys) {
  return new Promise(resolve => {
    try {
      const storage = getStorageLocal();
      if (!storage) return resolve({});
      const res = storage.get(keys, result => {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) return resolve({});
        resolve(result || {});
      });
      if (res && typeof res.catch === 'function') {
        res.catch(() => resolve({}));
      }
    } catch (_) {
      resolve({});
    }
  });
}

function safeStorageSet(data) {
  return new Promise(resolve => {
    try {
      const storage = getStorageLocal();
      if (!storage) return resolve();
      const res = storage.set(data, () => {
        resolve();
      });
      if (res && typeof res.catch === 'function') {
        res.catch(() => resolve());
      }
    } catch (_) {
      resolve();
    }
  });
}

const DEFAULT_SETTINGS = {
  syncKey: '',
  supabaseUrl: 'https://wbappdsgstzintgznikb.supabase.co',
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndiYXBwZHNnc3R6aW50Z3puaWtiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5MTgyMDgsImV4cCI6MjEwNzQ5NDIwOH0.6Wc7YDcKpMCq_IWeo54f3U_14giEfjOAH3f5B019vfE',
  autoSyncIntervalMinutes: 15,
  enableFloatingButton: true,
  enableBadgeCount: true,
  enableQuickIncrement: true,
  enableAutoTitleDetection: true,
  enableAutoSync: false,
  enableReleaseNotifications: true,
  enableMorningNotification: true,
  enableEveningNotification: true,
  autoTrackAnime: true,
  blockedDomains: [],
  allowedDomains: [],
  theme: 'dark',
  customProEmail: '',
  settingsUpdatedAt: 0,
  v4MetadataSyncDone: false
};

function extractDomain(url) {
  if (!url || typeof url !== 'string') return '';
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./i, '').toLowerCase();
  } catch (e) {
    const match = url.match(/https?:\/\/(?:www\.)?([^\/\?#]+)/i);
    return match ? match[1].toLowerCase() : '';
  }
}

function formatSiteName(domain) {
  if (!domain) return 'Site Principal';
  const parts = domain.split('.');
  const base = parts.length > 1 ? parts[parts.length - 2] : parts[0];
  if (base.toLowerCase() === 'mangadex') return 'MangaDex';
  if (base.toLowerCase() === 'webtoons') return 'Webtoons';
  if (base.toLowerCase() === 'reaperscans') return 'Reaper Scans';
  if (base.toLowerCase() === 'neoxscans') return 'Neox Scans';
  return base.charAt(0).toUpperCase() + base.slice(1);
}

function generateId(prefix = 'id') {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return prefix + '_' + crypto.randomUUID();
  }
  return prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

function isSeasonDescriptor(str) {
  if (!str || typeof str !== 'string') return false;
  const s = str.trim();
  return /^(?:\d+ª?\s*)?(?:temp(?:orada)?|season)(?:\s*\d+)?(?:\s*[-–—|·•~:]\s*.*)?$/i.test(s) ||
         /^(?:temp(?:orada)?|[st])\s*\d+[-_.\s|]*(?:[eE]p(?:is[oó]dio)?\.?|[eE])\s*\d+/i.test(s) ||
         /^(?:epis[oó]dio|episode|ep\.?)\s*\d+$/i.test(s);
}

function extractChapter(url = '', title = '', domText = '') {
  // 1. Temporada + Episódio (Temp 01 - Ep 01, S01E01, T01E01, Temporada 1 Ep 1, etc.)
  // Prioridade máxima em title, domText e url
  for (const src of [title, domText, url]) {
    if (!src) continue;

    // Temp 01 - Ep 01, S01E01, S 01 Ep 01, S1E2, T01E01, T1E2, S02-E06, etc.
    const seMatch = src.match(/(?:^|[\b\/_.\s-])(?:temp(?:orada)?|[st])\s*(\d{1,2})[-_.\s|]*(?:[eE]p(?:is[oó]dio)?\.?|[eE])\s*(\d{1,4})(?:[\b\/_.\s-]|$)/i);
    if (seMatch) {
      const sNum = String(parseInt(seMatch[1], 10)).padStart(2, '0');
      const epInt = parseInt(seMatch[2], 10);
      const eNum = epInt < 100 ? String(epInt).padStart(2, '0') : String(epInt);
      return `Temp ${sNum} - Ep ${eNum}`;
    }

    // "Temporada 2 Episodio 4", "1ª Temporada Ep 1", "Season 1 Episode 2", "temporada-4/episodio-9"
    const tempEpMatch = src.match(/(?:(?:(\d{1,2})\s*ª?\s*)?(?:temporada|season)[-_.\s]*(\d{1,2})?)[^\d\r\n]{1,20}?(?:epis[oó]dio|episode|ep\.?|e)[-_.\s]*(\d{1,4})/i);
    if (tempEpMatch && (tempEpMatch[1] || tempEpMatch[2])) {
      const sVal = tempEpMatch[1] || tempEpMatch[2];
      const sNum = String(parseInt(sVal, 10)).padStart(2, '0');
      const epInt = parseInt(tempEpMatch[3], 10);
      const eNum = epInt < 100 ? String(epInt).padStart(2, '0') : String(epInt);
      return `Temp ${sNum} - Ep ${eNum}`;
    }
  }

  // 2. Extração via título ou texto do DOM
  for (const src of [title, domText]) {
    if (!src) continue;
    const epMatch = src.match(/(?:epis[oó]dio|ep\.?)\s*(\d+(?:\.\d+)?)/i);
    if (epMatch) return `Ep. ${epMatch[1]}`;

    // E1, E01 avulso (ex: Re:Zero E1 Online, One Piece E1070)
    const eMatch = src.match(/(?:^|[\s\-_–|#\[(])e\s*(\d+(?:\.\d+)?)(?:[\b\s\-_–|\])]|$)/i);
    if (eMatch) return `Ep. ${parseFloat(eMatch[1])}`;

    const chMatch = src.match(/(?:cap[íi]tulo|chapter|chap\.?|cap\.?|cp\.?|ch\.?)\s*(\d+(?:\.\d+)?)/i);
    if (chMatch) return `Cap. ${chMatch[1]}`;

    const hashMatch = src.match(/#\s*(\d+(?:\.\d+)?)/);
    if (hashMatch) return `Cap. ${hashMatch[1]}`;

    // Filme numerado no título (ex: Filme 1, Filme 2, Movie 1)
    const movieNumMatch = src.match(/\b(?:filme|movie)\s*(\d+)\b/i);
    if (movieNumMatch) return `Filme ${movieNumMatch[1]}`;

    // Filme avulso no título
    if (/\b(?:filme|movie)\b/i.test(src) && !/(?:cap[íi]tulo|chapter|manga)/i.test(src)) {
      return 'Filme';
    }
  }

  // 3. Extração via URL
  if (url) {
    const epUrlMatch = url.match(/(?:epis[oó]dio|episode|ep)[-_.]?(\d+(?:\.\d+)?)/i);
    if (epUrlMatch) return `Ep. ${epUrlMatch[1]}`;

    // /e05, /e-05, etc.
    const eUrlMatch = url.match(/(?:\/|[-_])e[-_.]?(\d+(?:\.\d+)?)(?:[\/?#&]|$)/i);
    if (eUrlMatch) return `Ep. ${parseFloat(eUrlMatch[1])}`;

    const chUrlMatch = url.match(/(?:cap[íi]tulo|chapter|chap|cap|cp|ch)[-_.]?(\d+(?:\.\d+)?)/i);
    if (chUrlMatch) {
      const num = parseFloat(chUrlMatch[1]);
      if (num < 10000) return `Cap. ${chUrlMatch[1]}`;
    }

    // Rotas modernas de leitura com subcaminho como /ler/:slug/:cap, /read/:slug/:cap, /capitulo/:slug/:cap, /series/:slug/:cap
    const subpathMatch = url.match(/\/(?:ler|read|chapter|capitulo|manga|comic|comics|novel|series|obra|obras|webtoon|manhwa|manhua)\/[^\/]+\/(\d+(?:\.\d+)?)(?:[\/?#&]|$)/i);
    if (subpathMatch) {
      const num = parseFloat(subpathMatch[1]);
      if (num < 10000) return `Cap. ${subpathMatch[1]}`;
    }

    const standaloneMatch = url.match(/(?:^|[\/?#&])(?:c|chapter\/|capitulo\/|ler\/)(\d+(?:\.\d+)?)(?:[\/?#&]|$)/i);
    if (standaloneMatch) {
      const num = parseFloat(standaloneMatch[1]);
      if (num < 10000) return `Cap. ${standaloneMatch[1]}`;
    }

    // Rota de filmes na URL
    if (/\/(?:filme|filmes|movie|movies)\//i.test(url) || /\b(?:filme|movie)\b/i.test(url)) {
      const movieNumMatch = url.match(/(?:filme|movie)[-_.]?(\d+)/i);
      if (movieNumMatch) return `Filme ${movieNumMatch[1]}`;
      return 'Filme';
    }
  }

  return '';
}

function decodeHtmlEntities(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (m, dec) => String.fromCharCode(dec));
}

const NEXUS_KEY = "NexusToons2026SecretKeyForChapterEncryption!@#$";

function xorDecrypt(str, key) {
  let res = "";
  for (let i = 0; i < str.length; i++) {
    res += String.fromCharCode(str.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return res;
}

function base64UrlDecode(str) {
  let s = str.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  try {
    if (typeof atob === 'function') {
      // I-05: Substituído escape() (depreciado) por TextDecoder
      const binary = atob(s);
      try {
        return new TextDecoder('utf-8').decode(
          Uint8Array.from(binary, c => c.charCodeAt(0))
        );
      } catch (_) {
        return binary; // fallback para string binária pura
      }
    }
  } catch (_) {}
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(s, 'base64').toString('utf8');
  }
  return '';
}

function decryptNexusHash(hash) {
  try {
    const outer = base64UrlDecode(hash);
    if (!outer) return null;
    const [first] = outer.split("|");
    const middle = base64UrlDecode(first);
    if (!middle) return null;
    const parts = xorDecrypt(middle, NEXUS_KEY).split("|");
    if (parts.length < 3) return null;
    const chapterId = parseInt(parts[0], 10);
    const mangaSlug = parts[1] || "";
    return isNaN(chapterId) ? null : { chapterId, mangaSlug };
  } catch (_) {
    return null;
  }
}

function slugToTitle(slug) {
  if (!slug || typeof slug !== 'string') return '';
  const cleaned = slug
    .replace(/^(?:ler|assistir)[-_]/i, '')
    .replace(/-(?:cap[íi]tulo|chapter|chap|cap|cp|ch|epis[oó]dio|ep|temporada|season)[-_.]?\d+(?:\.\d+)?.*$/i, '')
    .replace(/[-_]+(?:pt[-_]?br|sub[-_]?ptbr|dublado|legendado|online|manga|manhwa|manhua|scan|completo)$/i, '')
    .replace(/[-_]+/g, ' ')
    .trim();
  const lowercaseWords = new Set(['de', 'da', 'do', 'das', 'dos', 'em', 'no', 'na', 'nos', 'nas', 'e', 'ou', 'com', 'por', 'para', 'a', 'o', 'as', 'os']);
  const words = cleaned.split(/\s+/).filter(Boolean);
  return words.map((w, idx) => {
    const lower = w.toLowerCase();
    if (idx > 0 && lowercaseWords.has(lower)) return lower;
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }).join(' ');
}

function extractSlugTitle(url) {
  if (!url || typeof url !== 'string') return '';
  try {
    const u = new URL(url, 'https://site.com');
    const domain = u.hostname.toLowerCase();

    // NexusToons: rotas /r/:hash, /ler/:slug/:cap, /manga/:slug
    if (domain.includes('nexus')) {
      const hashMatch = u.pathname.match(/\/r\/([A-Za-z0-9_-]+)/i);
      if (hashMatch && hashMatch[1]) {
        const dec = decryptNexusHash(hashMatch[1]);
        if (dec && dec.mangaSlug) {
          return slugToTitle(dec.mangaSlug);
        }
      }
      const lerMatch = u.pathname.match(/\/ler\/([^\/]+)/i);
      if (lerMatch && lerMatch[1]) {
        return slugToTitle(lerMatch[1]);
      }
      const mangaMatch = u.pathname.match(/\/manga\/([^\/]+)/i);
      if (mangaMatch && mangaMatch[1]) {
        return slugToTitle(mangaMatch[1]);
      }
    }

    // Crunchyroll: rotas /series/:id/:slug
    if (domain.includes('crunchyroll')) {
      const crMatch = u.pathname.match(/\/series\/[A-Za-z0-9_-]+\/([^\/?#]+)/i);
      if (crMatch && crMatch[1]) {
        return slugToTitle(crMatch[1]);
      }
    }

    const path = decodeURIComponent(u.pathname);

    // Suporte a rotas com ID intermediário como /series/:id/:slug (ex: Crunchyroll)
    const seriesIdSlugMatch = path.match(/\/series\/[A-Za-z0-9_-]{5,20}\/([^\/?#]+)/i);
    if (seriesIdSlugMatch && seriesIdSlugMatch[1]) {
      return slugToTitle(seriesIdSlugMatch[1]);
    }

    const match = path.match(/\/(?:story|manga|series|obra|comic|novel|read|leitor|ler|capitulo|anime|episodio|ep)\/([^\/]+)/i);
    if (match && match[1]) {
      let rawSlug = match[1];
      if (/^\d+$/.test(rawSlug)) return '';
      return slugToTitle(rawSlug);
    }
  } catch (e) {}
  return '';
}

function cleanWorkTitle(rawTitle = '') {
  if (!rawTitle || typeof rawTitle !== 'string') return '';
  let clean = decodeHtmlEntities(rawTitle);

  // 1. Remove verbos de ação inicial (ex: "Ler Solo Leveling", "Leia Tensura Nikki", "Assistir Homem-Aranha Filme")
  clean = clean.replace(/^(?:ler|leia|assistir(?:\s+ao|\s+a|\s+o)?|ver(?:\s+ao|\s+a|\s+o)?|read|watch)\s+/i, '');

  // 2. Remove colchetes de tags de mídia, scans e resoluções
  clean = clean.replace(/\[(?:pt[-_]?br|legendado|dublado|scan|raw|1080p|720p|4k|hd)\]/gi, '');
  clean = clean.replace(/\((?:ler online|manga online|legendado|dublado|completo|hd|raw|pt[-_]?br|filme|movie|\d{4})\)/gi, '');

  // 3. Remove resoluções soltas
  clean = clean.replace(/\b(?:1080p|720p|480p|4k|full\s*hd|hd)\b/gi, '');

  // 4. Remove sufixos de sites/scans conhecidos e separadores
  clean = clean.replace(/\s*[-–—|·•~]\s*(?:manga livre|mangalivre|nexus|nexustoons|ler online|manga online|scan|scans|neox|mangadex|read online|animesonline|animes\s*online|manga plus|ddl|vegitoons|mang[aá]stop|crunchyroll|assistir na crunchyroll|watch on crunchyroll|site\s+[a-z0-9]+|todos os capitulos|todos os epis[oó]dios|todos os filmes|assistir online|legendado|dublado|completo|hd|tcb\s*scans|webtoon|site).*$/gi, '');

  // 5. Remove slogans de SEO e termos comuns de agregadores no meio/fim do título
  clean = clean.replace(/\b(?:ler\s+mang[aá]\s+online\s+em\s+portugu[eê]s\s+gr[aá]tis|ler\s+mang[aá]\s+online|leia\s+online|ler\s+online|em\s+portugu[eê]s(?:\s+gr[aá]tis)?|pt[-_]?br|gr[aá]tis|todos\s+os\s+cap[íi]tulos|todos\s+os\s+epis[oó]dios|todos\s+os\s+filmes|online\s+for\s+free|for\s+free|assistir\s+na\s+crunchyroll|watch\s+on\s+crunchyroll|assistir\s+online)\b/gi, '');
  clean = clean.replace(/\s+(?:legendado|dublado|online)\b/gi, '');

  // 6. Remove temporadas e episódios (Temp 01 - Ep 01, S 01 Ep. 01, S01E01, T03E08, Temporada 4 Episódio 9, E1070)
  clean = clean.replace(/(?:[-–—:,|·•~]\s*)?(?:\b|[_\-\/])(?:temp(?:orada)?|[st])\s*\d{1,2}[-_.\s|]*(?:[eE]p(?:is[oó]dio)?\.?|[eE])\s*\d{1,4}\b/gi, '');
  clean = clean.replace(/(?:[-–—:,|·•~]\s*)?(?:\d{1,2}\s*ª?\s*)?(?:temp(?:orada)?|season)\s*\d*(?:\s*(?:epis[oó]dio|episode|ep\.?|e)\s*\d+)?\b/gi, '');
  clean = clean.replace(/(?:[-–—:,|·•~]\s*)?(?:cap[íi]tulo|chapter|chap\.?|cap\.?|cp\.?|ch\.?|epis[óo]dio|episode|ep\.?)\s*\d+(?:\.\d+)?\.?(?:\s*[,:\-–—|]\s*[^–—|]+)?\b(?:\s*final|\s*online)?/gi, '');
  clean = clean.replace(/(?:[-–—:,|·•~]\s*)?(?:^|[\s\-_–|#\[(])e\s*\d+(?:\.\d+)?\b/gi, '');
  clean = clean.replace(/(?:[-–—:,|·•~]\s*)?#\s*\d+\b/g, '');

  // 7. Remove termos de filmes (Filme, Movie, Filme Completo, etc.)
  clean = clean.replace(/(?:[-–—:,|·•~]\s*)?\b(?:filme|movie)\b(?:\s*\d+)?(?:\s*completo|\s*online|\s*hd|\s*dublado|\s*legendado)*/gi, '');

  // 8. Remove aspas ou colchetes especiais de capítulos (ex: 「...」, 【...】)
  clean = clean.replace(/[「」【】『』]/g, ' ');

  // 9. Remove fragmentos de traços ou texto solto de scan no final (exige espaço antes do hífen para não cortar palavras compostas como Homem-Aranha)
  clean = clean.replace(/\s+[-–—|·•~]\s*[^–—|-]{2,30}$/, '');
  clean = clean.replace(/[\(\[\{]\s*[\)\]\}]/g, ' ');
  clean = clean.replace(/^[\s\-–—:,|·•~.]+|[\s\-–—:,|·•~.]+$/g, '');
  clean = clean.replace(/\s+/g, ' ').trim();

  if (!clean || isSeasonDescriptor(clean)) {
    return isSeasonDescriptor(rawTitle) ? '' : clean;
  }

  return clean || rawTitle.trim();
}

function extractDualTitles(rawTitle = '') {
  if (!rawTitle || typeof rawTitle !== 'string') {
    return { primary: '', aliases: [] };
  }
  let str = decodeHtmlEntities(rawTitle).trim();

  const isTagOrMeta = (s) => {
    if (!s || typeof s !== 'string') return true;
    const t = s.trim().toLowerCase();
    if (!t || t.length < 2) return true;
    if (/^\d{4}$/.test(t)) return true; // Ano (ex: 2024)
    if (/^(?:1080p|720p|480p|4k|full\s*hd|hd|sd)$/i.test(t)) return true;
    if (/^(?:ler online|manga online|legendado|dublado|completo|hd|raw|pt[-_]?br|filme|movie|scan|scans|webtoon|novel|manga|manhwa|manhua|light novel|webnovel|pt|br|en|official|oficial|todos os capitulos|todos os episodios|online)$/i.test(t)) return true;
    if (isSeasonDescriptor(t)) return true;
    if (/^(?:cap[íi]tulo|chapter|chap|cap|cp|ch|epis[oó]dio|episode|ep|temp(?:orada)?|season)\s*\d+/i.test(t)) return true;
    return false;
  };

  const detectedAliases = [];

  // 1. Extração de blocos de parênteses ou colchetes contendo nomes alternativos
  // Ex: "O Começo Depois do Fim (The Beginning After The End)" ou "Eleceed [일렉시드]"
  const bracketMatches = Array.from(str.matchAll(/[\(\[]([^\)\]]+)[\)\]]/g));
  for (const m of bracketMatches) {
    const candidate = m[1].trim();
    if (!isTagOrMeta(candidate) && candidate.length >= 2) {
      if (!detectedAliases.some(a => normalizeTitle(a) === normalizeTitle(candidate))) {
        detectedAliases.push(candidate);
      }
    }
  }

  // Remove os blocos que viraram aliases da string principal
  let cleanPrimary = str;
  for (const alt of detectedAliases) {
    const escaped = alt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    cleanPrimary = cleanPrimary.replace(new RegExp(`\\s*[\\(\\[]${escaped}[\\)\\]]`, 'g'), '');
  }
  cleanPrimary = cleanPrimary.trim();

  // 2. Extração com barras (" / " ou " // ")
  // Ex: "Solo Leveling / Na Honjamun Lebel-eop / Only I Level Up"
  if (cleanPrimary.includes('/')) {
    const parts = cleanPrimary.split(/\s*(?:\/{1,2})\s*/).map(p => p.trim()).filter(Boolean);
    if (parts.length > 1) {
      const validParts = parts.filter(p => !isTagOrMeta(p));
      if (validParts.length > 1) {
        cleanPrimary = validParts[0];
        for (let i = 1; i < validParts.length; i++) {
          const part = validParts[i];
          if (!detectedAliases.some(a => normalizeTitle(a) === normalizeTitle(part))) {
            detectedAliases.push(part);
          }
        }
      }
    }
  }

  // 3. Extração com " | " se não for site ou slogan
  if (cleanPrimary.includes(' | ')) {
    const parts = cleanPrimary.split(/\s*\|\s*/).map(p => p.trim()).filter(Boolean);
    if (parts.length > 1) {
      const validParts = parts.filter(p => !isTagOrMeta(p));
      if (validParts.length > 1) {
        cleanPrimary = validParts[0];
        for (let i = 1; i < validParts.length; i++) {
          const part = validParts[i];
          if (!detectedAliases.some(a => normalizeTitle(a) === normalizeTitle(part))) {
            detectedAliases.push(part);
          }
        }
      }
    }
  }

  const primaryClean = (typeof cleanWorkTitle === 'function' ? cleanWorkTitle(cleanPrimary) : cleanPrimary).trim();

  return {
    primary: primaryClean || cleanPrimary || str,
    aliases: detectedAliases
  };
}

function normalizeTitle(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getBigrams(str) {
  const s = ' ' + str + ' ';
  const bigrams = new Set();
  for (let i = 0; i < s.length - 1; i++) {
    bigrams.add(s.slice(i, i + 2));
  }
  return bigrams;
}

function calculateSimilarity(a, b) {
  const normA = normalizeTitle(a);
  const normB = normalizeTitle(b);

  if (!normA || !normB) return 0;
  if (normA === normB) return 1.0;
  if (normA.replace(/\s+/g, '') === normB.replace(/\s+/g, '')) return 1.0;

  if (normA.length >= 5 && normB.length >= 5) {
    if (normA.includes(normB) || normB.includes(normA)) {
      const minLen = Math.min(normA.length, normB.length);
      const maxLen = Math.max(normA.length, normB.length);
      return Math.max(0.80, minLen / maxLen);
    }
  }

  const wordsA = new Set(normA.split(' ').filter(Boolean));
  const wordsB = new Set(normB.split(' ').filter(Boolean));
  let commonWords = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) commonWords++;
  }
  const tokenScore = (2 * commonWords) / (wordsA.size + wordsB.size);

  const bigramsA = getBigrams(normA);
  const bigramsB = getBigrams(normB);
  let commonBigrams = 0;
  for (const bg of bigramsA) {
    if (bigramsB.has(bg)) commonBigrams++;
  }
  const diceScore = (2 * commonBigrams) / (bigramsA.size + bigramsB.size);

  return Math.max(tokenScore, diceScore);
}

async function resolvePageWorkDetails(url) {
  if (!url || typeof url !== 'string') return null;
  const domain = extractDomain(url);

  // 1. Vegitoons SPA Resolver
  if (domain.includes('vegitoons')) {
    const m = url.match(/\/capitulo\/(\d+)/i);
    if (m) {
      try {
        const res = await fetch(`https://api.vegitoons.black/capitulos/${m[1]}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.obra && data.obra.obr_nome) {
            return {
              workName: cleanWorkTitle(data.obra.obr_nome),
              chapter: data.cap_nome ? extractChapter('', data.cap_nome) : `Cap. ${data.cap_numero || 1}`
            };
          }
        }
      } catch (e) {}
    }
  }

  // 2. MangásTop SPA Resolver
  if (domain.includes('mangastop')) {
    const m = url.match(/\/leitor\/(\d+)/i);
    if (m) {
      try {
        const res = await fetch(`https://mangastop.net/wp-json/mangastop/v1/leitor/${m[1]}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.titulo) {
            return {
              workName: cleanWorkTitle(data.titulo),
              chapter: extractChapter('', data.titulo) || `Cap. ${data.numero || 1}`
            };
          }
        }
      } catch (e) {}
    }
  }

  // 3. MangaDex SPA Resolver
  if (domain.includes('mangadex')) {
    const m = url.match(/\/chapter\/([a-f0-9\-]+)/i);
    if (m) {
      try {
        const res = await fetch(`https://api.mangadex.org/chapter/${m[1]}?includes[]=manga`);
        if (res.ok) {
          const data = await res.json();
          const manga = data?.data?.relationships?.find(r => r.type === 'manga');
          const titleObj = manga?.attributes?.title || {};
          const primaryTitle = titleObj.en || Object.values(titleObj)[0] || '';
          const altEn = (manga?.attributes?.altTitles || []).find(t => t.en)?.en;
          const chapterNum = data?.data?.attributes?.chapter;
          return {
            workName: primaryTitle || altEn || '',
            aliasName: altEn && altEn !== primaryTitle ? altEn : undefined,
            chapter: chapterNum ? `Cap. ${chapterNum}` : ''
          };
        }
      } catch (e) {}
    }
  }

  // 4. NexusToons SPA Resolver (rotas /r/:hash, /ler/:slug/:cap, /manga/:slug)
  if (domain.includes('nexus')) {
    const hashMatch = url.match(/\/r\/([A-Za-z0-9_-]+)/i);
    if (hashMatch && hashMatch[1]) {
      const dec = decryptNexusHash(hashMatch[1]);
      if (dec && dec.mangaSlug) {
        return {
          workName: slugToTitle(dec.mangaSlug),
          chapter: ''
        };
      }
    }

    const lerMatch = url.match(/\/ler\/([^\/]+)(?:\/(\d+))?/i);
    if (lerMatch && lerMatch[1]) {
      return {
        workName: slugToTitle(lerMatch[1]),
        chapter: lerMatch[2] ? `Cap. ${lerMatch[2]}` : ''
      };
    }

    const mangaMatch = url.match(/\/manga\/([^\/]+)/i);
    if (mangaMatch && mangaMatch[1]) {
      return {
        workName: slugToTitle(mangaMatch[1]),
        chapter: ''
      };
    }
  }

  return null;
}

const StorageLocal = {
  extractDomain,
  formatSiteName,
  extractChapter,
  cleanWorkTitle,
  isSeasonDescriptor,
  decodeHtmlEntities,
  extractSlugTitle,
  decryptNexusHash,
  slugToTitle,
  normalizeTitle,
  extractDualTitles,
  calculateSimilarity,
  resolvePageWorkDetails,

  isDomainAllowed(rawDomain, settings) {
    if (!settings || !Array.isArray(settings.allowedDomains)) return false;
    if (!rawDomain || typeof rawDomain !== 'string') return false;
    const domain = rawDomain.trim().toLowerCase().replace(/^www\./, '');
    if (!domain) return false;

    return settings.allowedDomains.some(d => {
      const allowed = (d || '').trim().toLowerCase().replace(/^www\./, '');
      return allowed && (domain === allowed || domain.endsWith('.' + allowed));
    });
  },

  async setDomainAllowed(domain, isAllowed) {
    const settings = await this.getSettings();
    const cleanDomain = (domain || '').trim().toLowerCase().replace(/^www\./, '');
    if (!cleanDomain) return settings;

    let current = (settings.allowedDomains || []).map(d => d.trim().toLowerCase().replace(/^www\./, '')).filter(Boolean);
    if (isAllowed) {
      if (!current.includes(cleanDomain)) {
        current.push(cleanDomain);
      }
      settings.enableFloatingButton = true;
      if (Array.isArray(settings.blockedDomains)) {
        settings.blockedDomains = settings.blockedDomains.filter(d => {
          const bd = (d || '').trim().toLowerCase().replace(/^www\./, '');
          return bd !== cleanDomain && !cleanDomain.endsWith('.' + bd);
        });
      }
    } else {
      current = current.filter(d => d !== cleanDomain);
    }

    settings.allowedDomains = current;
    await this.saveSettings(settings);
    return settings;
  },

  async getSettings() {
    const result = await safeStorageGet([STORAGE_KEY_SETTINGS]);
    const stored = result[STORAGE_KEY_SETTINGS] || {};
    return {
      ...DEFAULT_SETTINGS,
      ...stored,
      supabaseUrl: (stored.supabaseUrl && stored.supabaseUrl.trim()) ? stored.supabaseUrl : DEFAULT_SETTINGS.supabaseUrl,
      supabaseKey: (stored.supabaseKey && stored.supabaseKey.trim()) ? stored.supabaseKey : DEFAULT_SETTINGS.supabaseKey
    };
  },

  async getInitialData() {
    const result = await safeStorageGet([STORAGE_KEY_SETTINGS, STORAGE_KEY_ENTRIES_V3]);
    const stored = result[STORAGE_KEY_SETTINGS] || {};
    const settings = {
      ...DEFAULT_SETTINGS,
      ...stored,
      supabaseUrl: (stored.supabaseUrl && stored.supabaseUrl.trim()) ? stored.supabaseUrl : DEFAULT_SETTINGS.supabaseUrl,
      supabaseKey: (stored.supabaseKey && stored.supabaseKey.trim()) ? stored.supabaseKey : DEFAULT_SETTINGS.supabaseKey
    };

    let rawList = result[STORAGE_KEY_ENTRIES_V3];
    if (!rawList) {
      rawList = await this.getAllRawWorks();
    } else {
      this._v3MigrationDone = true;
    }

    const list = Array.isArray(rawList) ? rawList : [];

    if (!stored.v4MetadataSyncDone) {
      const hasEnrichedMetadata = list.some(w => (Array.isArray(w.releaseDays) && w.releaseDays.length > 0) || (w.readingStatus && w.readingStatus !== 'lendo') || (w.publicationStatus && w.publicationStatus !== 'lancamento'));
      if (hasEnrichedMetadata) {
        for (const w of list) {
          w.syncStatus = 'pending';
        }
        await safeStorageSet({ [STORAGE_KEY_ENTRIES_V3]: list });
      }
      settings.v4MetadataSyncDone = true;
      await this.saveSettings(settings);
    }

    const activeWorks = [];
    for (const w of list) {
      if (!Array.isArray(w.aliases)) w.aliases = [];
      if (!w.readingStatus) w.readingStatus = 'lendo';
      if (!w.publicationStatus) w.publicationStatus = 'lancamento';
      if (!w.deleted) activeWorks.push(w);
    }

    return { settings, works: activeWorks };
  },

  async saveSettings(settings) {
    await safeStorageSet({ [STORAGE_KEY_SETTINGS]: settings });
    return settings;
  },

  _v3MigrationDone: false,

  // ── Migração Automática de v2 para v3 ────────────────────
  async migrateV2ToV3IfNeeded() {
    if (this._v3MigrationDone) return null;
    const result = await safeStorageGet([STORAGE_KEY_ENTRIES_V3, STORAGE_KEY_ENTRIES_V2]);
    if (result[STORAGE_KEY_ENTRIES_V3]) {
      this._v3MigrationDone = true;
      return result[STORAGE_KEY_ENTRIES_V3];
    }

    const v2List = result[STORAGE_KEY_ENTRIES_V2] || [];
    if (!Array.isArray(v2List) || v2List.length === 0) {
      const empty = [];
      await safeStorageSet({ [STORAGE_KEY_ENTRIES_V3]: empty });
      this._v3MigrationDone = true;
      return empty;
    }

    const migratedWorks = v2List.map(v2 => {
      const domain = extractDomain(v2.url);
      const siteName = formatSiteName(domain);
      const sourceId = generateId('src');
      const now = v2.updatedAt || v2.createdAt || Date.now();

      const source = {
        id: sourceId,
        siteName,
        domain,
        url: v2.url || '',
        chapter: v2.chapter || 'Cap. 1',
        updatedAt: now
      };

      const history = [{
        id: generateId('hist'),
        timestamp: now,
        siteName,
        domain,
        chapter: source.chapter,
        url: source.url
      }];

      return {
        id: v2.id || generateId('work'),
        name: v2.name ? v2.name.trim() : 'Sem título',
        tag: v2.tag || 'manga',
        mainChapter: source.chapter,
        lastReadSourceId: sourceId,
        createdAt: v2.createdAt || now,
        updatedAt: now,
        deleted: !!v2.deleted,
        syncStatus: v2.syncStatus || 'pending',
        sources: [source],
        history
      };
    });

    await safeStorageSet({ [STORAGE_KEY_ENTRIES_V3]: migratedWorks });
    this._v3MigrationDone = true;
    return migratedWorks;
  },

  async getAllRawWorks() {
    // Se a migração já ocorreu, consulta diretamente apenas a chave V3 (reduz IPC pela metade)
    if (this._v3MigrationDone) {
      const result = await safeStorageGet([STORAGE_KEY_ENTRIES_V3]);
      const list = result[STORAGE_KEY_ENTRIES_V3] || [];
      for (const w of list) {
        if (!Array.isArray(w.aliases)) w.aliases = [];
        if (!w.readingStatus) w.readingStatus = 'lendo';
        if (!w.publicationStatus) w.publicationStatus = 'lancamento';
      }
      return list;
    }

    const migrated = await this.migrateV2ToV3IfNeeded();
    if (migrated && Array.isArray(migrated)) {
      for (const w of migrated) {
        if (!Array.isArray(w.aliases)) w.aliases = [];
        if (!w.readingStatus) w.readingStatus = 'lendo';
        if (!w.publicationStatus) w.publicationStatus = 'lancamento';
      }
      return migrated;
    }

    const result = await safeStorageGet([STORAGE_KEY_ENTRIES_V3]);
    const list = result[STORAGE_KEY_ENTRIES_V3] || [];
    for (const w of list) {
      if (!Array.isArray(w.aliases)) w.aliases = [];
      if (!w.readingStatus) w.readingStatus = 'lendo';
      if (!w.publicationStatus) w.publicationStatus = 'lancamento';
    }
    return list;
  },

  async getWorks(includeDeleted = false) {
    const list = await this.getAllRawWorks();
    if (includeDeleted) return list;
    return list.filter(w => !w.deleted);
  },

  async getWorkById(id) {
    const list = await this.getAllRawWorks();
    return list.find(w => w.id === id) || null;
  },

  findMatchingWork(rawSearchName, works = []) {
    if (!rawSearchName || !Array.isArray(works) || works.length === 0) {
      return { exactMatch: null, suggestions: [] };
    }

    const clean = this.cleanWorkTitle ? this.cleanWorkTitle(rawSearchName) : rawSearchName;
    const normSearch = normalizeTitle(clean);
    const compactSearch = normSearch.replace(/\s+/g, '');

    const activeWorks = works.filter(w => !w.deleted);

    // 1. Procura correspondência exata ou normalizada (por nome principal ou aliases)
    for (const w of activeWorks) {
      const namesToCheck = [w.name, ...(Array.isArray(w.aliases) ? w.aliases : [])];
      for (const candidate of namesToCheck) {
        if (!candidate) continue;
        const cleanCandidate = this.cleanWorkTitle ? this.cleanWorkTitle(candidate) : candidate;
        const normCandidate = normalizeTitle(cleanCandidate);
        const compactCandidate = normCandidate.replace(/\s+/g, '');

        if (
          clean.toLowerCase() === cleanCandidate.toLowerCase() ||
          normSearch === normCandidate ||
          (compactSearch.length >= 3 && compactSearch === compactCandidate)
        ) {
          return { exactMatch: w, suggestions: [] };
        }
      }
    }

    // 2. Procura por similaridade fonética / tokens para sugestões
    const suggestions = [];
    for (const w of activeWorks) {
      const namesToCheck = [w.name, ...(Array.isArray(w.aliases) ? w.aliases : [])];
      let bestScore = 0;
      let bestMatchedName = w.name;

      for (const candidate of namesToCheck) {
        if (!candidate) continue;
        const score = calculateSimilarity(clean, candidate);
        if (score > bestScore) {
          bestScore = score;
          bestMatchedName = candidate;
        }
      }

      if (bestScore >= 0.70) {
        suggestions.push({
          work: w,
          score: Math.round(bestScore * 100) / 100,
          matchedName: bestMatchedName
        });
      }
    }

    suggestions.sort((a, b) => b.score - a.score);
    return { exactMatch: null, suggestions };
  },

  async findMatchingWorkAsync(rawSearchName, works = []) {
    const localRes = this.findMatchingWork(rawSearchName, works);
    if (localRes.exactMatch) return localRes;

    // 1. Tenta consulta ao catálogo colaborativo de aliases
    const crowdService = typeof AliasCrowdService !== 'undefined'
      ? AliasCrowdService
      : (typeof require !== 'undefined' ? (() => { try { return require('./alias-crowd-service'); } catch (_) { return null; } })() : null);

    if (crowdService && typeof crowdService.lookupAlias === 'function') {
      try {
        const crowdLookup = await crowdService.lookupAlias(rawSearchName);
        if (crowdLookup && crowdLookup.match) {
          const canonical = crowdLookup.match.canonicalTitle;
          const matchViaCrowd = this.findMatchingWork(canonical, works);
          if (matchViaCrowd.exactMatch) {
            return {
              exactMatch: matchViaCrowd.exactMatch,
              suggestions: [],
              viaAlias: rawSearchName,
              canonicalTitle: canonical,
              isVerified: crowdLookup.isVerified
            };
          }
        }
      } catch (_) {}
    }

    // 2. Tenta resolução canônica no AniList / MangaDex
    const canonResolver = typeof CanonicalResolver !== 'undefined'
      ? CanonicalResolver
      : (typeof require !== 'undefined' ? (() => { try { return require('./canonical-resolver'); } catch (_) { return null; } })() : null);

    if (canonResolver && typeof canonResolver.resolveCanonicalAliases === 'function') {
      try {
        const canonRes = await canonResolver.resolveCanonicalAliases(rawSearchName);
        if (canonRes && canonRes.canonicalTitle) {
          const matchCanon = this.findMatchingWork(canonRes.canonicalTitle, works);
          if (matchCanon.exactMatch) {
            return {
              exactMatch: matchCanon.exactMatch,
              suggestions: [],
              viaCanonical: canonRes.canonicalTitle
            };
          }

          if (Array.isArray(canonRes.aliases)) {
            for (const alt of canonRes.aliases) {
              const altMatch = this.findMatchingWork(alt, works);
              if (altMatch.exactMatch) {
                return {
                  exactMatch: altMatch.exactMatch,
                  suggestions: [],
                  viaCanonical: canonRes.canonicalTitle
                };
              }
            }
          }
        }
      } catch (_) {}
    }

    return localRes;
  },

  async addWorkAlias(workId, aliasName) {
    if (!workId || !aliasName || typeof aliasName !== 'string') return null;
    const cleanAlias = (this.cleanWorkTitle ? this.cleanWorkTitle(aliasName) : aliasName).trim();
    if (!cleanAlias) return null;

    const list = await this.getAllRawWorks();
    const work = list.find(w => w.id === workId);
    if (!work) return null;

    if (!Array.isArray(work.aliases)) {
      work.aliases = [];
    }

    const normAlias = normalizeTitle(cleanAlias);
    const alreadyExists = (work.name && normalizeTitle(work.name) === normAlias) ||
      work.aliases.some(a => normalizeTitle(a) === normAlias);

    if (!alreadyExists) {
      work.aliases.push(cleanAlias);
      work.updatedAt = Date.now();
      work.syncStatus = 'pending';
      await safeStorageSet({ [STORAGE_KEY_ENTRIES_V3]: list });
    }

    return work;
  },

  async findWorkByName(name) {
    if (!name) return null;
    const works = await this.getWorks(false);
    const match = this.findMatchingWork(name, works);
    if (match.exactMatch) return match.exactMatch;
    if (match.suggestions.length > 0 && match.suggestions[0].score >= 0.90) {
      return match.suggestions[0].work;
    }
    return null;
  },

  // ── Salva Leitura (Cria ou Atualiza Obra + Fonte + Histórico + Aliases) ─
  async saveWorkReading(payload) {
    const list = await this.getAllRawWorks();
    const now = Date.now();

    const rawWorkName = (payload.workName || payload.name || '').trim();
    const cleanedWorkName = (this.cleanWorkTitle ? this.cleanWorkTitle(rawWorkName) : rawWorkName) || rawWorkName || 'Sem título';
    const { primary: parsedName, aliases: extractedAliases } = this.extractDualTitles
      ? this.extractDualTitles(cleanedWorkName)
      : { primary: cleanedWorkName, aliases: [] };
    const workName = parsedName || cleanedWorkName;
    const chapter  = (payload.chapter || 'Cap. 1').trim();
    const url      = (payload.url || '').trim();
    const tag      = payload.tag || 'manga';

    const domain   = (payload.domain || extractDomain(url)).toLowerCase();
    const siteName = (payload.siteName || formatSiteName(domain)).trim();

    // Reúne todos os candidatos a aliases (do título duplo, payload.aliases ou payload.aliasName)
    const candidateAliases = [];
    if (Array.isArray(payload.aliases)) {
      candidateAliases.push(...payload.aliases);
    }
    if (Array.isArray(extractedAliases)) {
      candidateAliases.push(...extractedAliases);
    }
    if (payload.aliasName) {
      candidateAliases.push(payload.aliasName);
    }

    let work = null;
    const targetWorkId = payload.linkToWorkId || payload.workId || payload.id;

    if (targetWorkId) {
      work = list.find(w => w.id === targetWorkId);
    } else {
      const match = this.findMatchingWork(workName, list);
      if (match.exactMatch) {
        work = match.exactMatch;
      }
    }

    // Trava de segurança: se payload exigir apenas obras já existentes (auto-incremento/autoTrack), nunca cria nova obra do zero
    if (!work && (payload.onlyExisting || payload.autoTrack)) {
      return null;
    }

    if (work) {
      // Se payload.renameWork for explicitamente verdadeiro, atualiza nome principal
      if (payload.renameWork && workName) {
        work.name = workName;
      }

      // Atualiza ou mescla aliases sem duplicatas
      if (!Array.isArray(work.aliases)) work.aliases = [];
      const normWorkName = normalizeTitle(work.name);
      for (const cand of candidateAliases) {
        const clean = (this.cleanWorkTitle ? this.cleanWorkTitle(cand) : cand).trim();
        const norm = normalizeTitle(clean);
        if (norm && norm !== normWorkName) {
          if (!work.aliases.some(a => normalizeTitle(a) === norm)) {
            work.aliases.push(clean);
          }
        }
      }

      work.tag         = payload.tag || work.tag || 'manga';
      if (payload.readingStatus) work.readingStatus = payload.readingStatus;
      if (payload.publicationStatus) work.publicationStatus = payload.publicationStatus;
      if (Array.isArray(payload.releaseDays)) work.releaseDays = payload.releaseDays;
      work.deleted     = false;
      work.updatedAt   = now;
      work.syncStatus  = 'pending';
      work.mainChapter = chapter;

      if (!Array.isArray(work.sources)) work.sources = [];
      if (!Array.isArray(work.history)) work.history = [];

      // Procura fonte por domínio ou por siteName
      let source = work.sources.find(s => {
        if (domain && s.domain && s.domain === domain) return true;
        if (siteName && s.siteName && s.siteName.toLowerCase() === siteName.toLowerCase()) return true;
        return false;
      });

      if (source) {
        source.chapter   = chapter;
        source.url       = url || source.url;
        source.siteName  = siteName || source.siteName;
        source.domain    = domain || source.domain;
        source.updatedAt = now;
      } else {
        source = {
          id: generateId('src'),
          siteName,
          domain,
          url,
          chapter,
          updatedAt: now
        };
        work.sources.push(source);
      }

      work.lastReadSourceId = source.id;

      // Adiciona ao histórico (limite de 50 entradas)
      work.history.unshift({
        id: generateId('hist'),
        timestamp: now,
        siteName: source.siteName,
        domain: source.domain,
        chapter,
        url: source.url
      });
      if (work.history.length > 50) {
        work.history = work.history.slice(0, 50);
      }
    } else {
      // Nova obra criada
      const sourceId = generateId('src');
      const source = {
        id: sourceId,
        siteName,
        domain,
        url,
        chapter,
        updatedAt: now
      };

      const history = [{
        id: generateId('hist'),
        timestamp: now,
        siteName,
        domain,
        chapter,
        url
      }];

      const initialAliases = [];
      const normWorkName = normalizeTitle(workName);
      for (const cand of candidateAliases) {
        const clean = (this.cleanWorkTitle ? this.cleanWorkTitle(cand) : cand).trim();
        const norm = normalizeTitle(clean);
        if (norm && norm !== normWorkName) {
          if (!initialAliases.some(u => normalizeTitle(u) === norm)) {
            initialAliases.push(clean);
          }
        }
      }

      work = {
        id: (payload.workId || payload.id) || generateId('work'),
        name: workName,
        aliases: initialAliases,
        tag,
        readingStatus: payload.readingStatus || 'lendo',
        publicationStatus: payload.publicationStatus || 'lancamento',
        releaseDays: Array.isArray(payload.releaseDays) ? payload.releaseDays : [],
        mainChapter: chapter,
        lastReadSourceId: sourceId,
        createdAt: now,
        updatedAt: now,
        deleted: false,
        syncStatus: 'pending',
        sources: [source],
        history
      };

      list.unshift(work);
    }

    await safeStorageSet({ [STORAGE_KEY_ENTRIES_V3]: list });
    return work;
  },

  async updateWorkDetails(id, updates = {}) {
    const list = await this.getAllRawWorks();
    const work = list.find(w => w.id === id);
    if (!work) return null;

    if (updates.name) work.name = updates.name.trim();
    if (updates.tag)  work.tag  = updates.tag;
    if (updates.readingStatus) work.readingStatus = updates.readingStatus;
    if (updates.publicationStatus) work.publicationStatus = updates.publicationStatus;
    if (Array.isArray(updates.releaseDays)) work.releaseDays = updates.releaseDays;
    work.updatedAt  = Date.now();
    work.syncStatus = 'pending';

    await safeStorageSet({ [STORAGE_KEY_ENTRIES_V3]: list });
    return work;
  },

  async updateWorkStatus(id, { readingStatus, publicationStatus, touchUpdatedAt = false } = {}) {
    const list = await this.getAllRawWorks();
    const work = list.find(w => w.id === id);
    if (!work) return null;

    if (readingStatus) work.readingStatus = readingStatus;
    if (publicationStatus) work.publicationStatus = publicationStatus;
    if (touchUpdatedAt) {
      work.updatedAt  = Date.now();
    }
    work.syncStatus = 'pending';

    await safeStorageSet({ [STORAGE_KEY_ENTRIES_V3]: list });
    return work;
  },

  async deleteWork(id) {
    const list = await this.getAllRawWorks();
    const work = list.find(w => w.id === id);
    if (work) {
      work.deleted = true;
      work.updatedAt = Date.now();
      work.syncStatus = 'pending';
      await safeStorageSet({ [STORAGE_KEY_ENTRIES_V3]: list });
      return true;
    }
    return false;
  },

  async deleteSource(workId, sourceId) {
    const list = await this.getAllRawWorks();
    const work = list.find(w => w.id === workId);
    if (!work) return null;

    work.sources = (work.sources || []).filter(s => s.id !== sourceId);
    if (work.sources.length === 0) {
      work.deleted = true;
    } else {
      if (work.lastReadSourceId === sourceId) {
        work.lastReadSourceId = work.sources[0].id;
        work.mainChapter = work.sources[0].chapter;
      }
    }

    work.updatedAt  = Date.now();
    work.syncStatus = 'pending';

    await safeStorageSet({ [STORAGE_KEY_ENTRIES_V3]: list });
    return work;
  },

  mergeWorkData(targetWork, incomingWork) {
    if (!targetWork || !incomingWork) return targetWork || incomingWork;

    // 1. Mescla fontes (sources) sem duplicar por domain ou siteName
    if (!Array.isArray(targetWork.sources)) targetWork.sources = [];
    const incomingSources = Array.isArray(incomingWork.sources) ? incomingWork.sources : [];

    for (const incSrc of incomingSources) {
      const existing = targetWork.sources.find(s =>
        (incSrc.domain && s.domain && incSrc.domain === s.domain) ||
        (incSrc.siteName && s.siteName && incSrc.siteName.toLowerCase() === s.siteName.toLowerCase())
      );
      if (existing) {
        if ((incSrc.updatedAt || 0) >= (existing.updatedAt || 0)) {
          existing.chapter = incSrc.chapter || existing.chapter;
          existing.url = incSrc.url || existing.url;
          existing.updatedAt = incSrc.updatedAt || Date.now();
        }
      } else {
        targetWork.sources.push({ ...incSrc });
      }
    }

    // 2. Mescla aliases sem duplicatas
    if (!Array.isArray(targetWork.aliases)) targetWork.aliases = [];
    const incomingAliases = Array.isArray(incomingWork.aliases) ? incomingWork.aliases : [];
    const normName = normalizeTitle(targetWork.name || '');
    for (const a of incomingAliases) {
      const clean = (this.cleanWorkTitle ? this.cleanWorkTitle(a) : a).trim();
      const norm = normalizeTitle(clean);
      if (norm && norm !== normName && !targetWork.aliases.some(ea => normalizeTitle(ea) === norm)) {
        targetWork.aliases.push(clean);
      }
    }

    // 3. Mescla histórico (history) sem duplicar itens idênticos
    if (!Array.isArray(targetWork.history)) targetWork.history = [];
    const incomingHistory = Array.isArray(incomingWork.history) ? incomingWork.history : [];
    for (const h of incomingHistory) {
      const exists = targetWork.history.some(eh =>
        (h.url && eh.url && h.url === eh.url) ||
        (h.timestamp && eh.timestamp && Math.abs(h.timestamp - eh.timestamp) < 1000)
      );
      if (!exists) {
        targetWork.history.push({ ...h });
      }
    }
    targetWork.history.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    if (targetWork.history.length > 50) {
      targetWork.history = targetWork.history.slice(0, 50);
    }

    // 4. Decide mainChapter e lastReadSourceId baseado no updatedAt mais recente
    const targetUpdated = targetWork.updatedAt || 0;
    const incomingUpdated = incomingWork.updatedAt || 0;
    if (incomingUpdated > targetUpdated) {
      targetWork.mainChapter = incomingWork.mainChapter || targetWork.mainChapter;
      if (incomingWork.tag) targetWork.tag = incomingWork.tag;
      if (incomingWork.lastReadSourceId) {
        const matchSrc = targetWork.sources.find(s => s.id === incomingWork.lastReadSourceId) || targetWork.sources[0];
        if (matchSrc) targetWork.lastReadSourceId = matchSrc.id;
      }
      if (incomingWork.readingStatus) targetWork.readingStatus = incomingWork.readingStatus;
      if (incomingWork.publicationStatus) targetWork.publicationStatus = incomingWork.publicationStatus;
      if (Array.isArray(incomingWork.releaseDays) && incomingWork.releaseDays.length > 0) {
        targetWork.releaseDays = incomingWork.releaseDays;
      }
      targetWork.updatedAt = incomingUpdated;
    }

    // 5. Metadados complementares
    if (!targetWork.readingStatus && incomingWork.readingStatus) targetWork.readingStatus = incomingWork.readingStatus;
    if (!targetWork.publicationStatus && incomingWork.publicationStatus) targetWork.publicationStatus = incomingWork.publicationStatus;
    if ((!targetWork.releaseDays || targetWork.releaseDays.length === 0) && Array.isArray(incomingWork.releaseDays) && incomingWork.releaseDays.length > 0) {
      targetWork.releaseDays = incomingWork.releaseDays;
    }

    return targetWork;
  },

  async markAllWorksPendingSync() {
    const list = await this.getAllRawWorks();
    let changed = false;
    for (const w of list) {
      if (w.syncStatus !== 'pending') {
        w.syncStatus = 'pending';
        changed = true;
      }
    }
    if (changed) {
      await safeStorageSet({ [STORAGE_KEY_ENTRIES_V3]: list });
    }
    return list.length;
  },

  parseChapterIncrement(chapterStr) {
    if (!chapterStr || typeof chapterStr !== 'string') return 'Cap. 1';

    // 1. Temporada + Episódio (ex: Temp 01 - Ep 01, S 01 Ep. 01, S01E01, S1E1, T01E01, etc.)
    const seMatch = chapterStr.match(/((?:temp(?:orada)?|[sStT])\s*\d+[-_.\s|]*(?:[eE]p(?:is[oó]dio)?\.?|[eE])\s*)(\d+)/i);
    if (seMatch) {
      const prefix = seMatch[1];
      const numStr = seMatch[2];
      const oldNum = parseInt(numStr, 10);
      const newNum = oldNum + 1;
      const padLen = numStr.length;
      const newNumStr = String(newNum).padStart(padLen, '0');
      return chapterStr.replace(seMatch[0], `${prefix}${newNumStr}`);
    }

    // 2. Filmes (Filme avulso não incrementa; Filme 1 -> Filme 2)
    if (/^filme\s*$/i.test(chapterStr.trim())) {
      return chapterStr;
    }
    const movieMatch = chapterStr.match(/^filme\s+(\d+)$/i);
    if (movieMatch) {
      const nextNum = parseInt(movieMatch[1], 10) + 1;
      return `Filme ${nextNum}`;
    }

    // 3. Incremento numérico padrão (Cap. 1 -> Cap. 2, Ep. 1 -> Ep. 2, etc.)
    const match = chapterStr.match(/(\d+(\.\d+)?)/);
    if (!match) {
      return chapterStr + ' +1';
    }
    const oldNumStr = match[1];
    const isDecimal = oldNumStr.includes('.');
    const oldNum = parseFloat(oldNumStr);
    const newNum = oldNum + 1;
    const newNumStr = isDecimal ? newNum.toString() : (oldNumStr.startsWith('0') && oldNum < 9 ? '0' + newNum : newNum.toString());
    return chapterStr.replace(oldNumStr, newNumStr);
  },

  parseChapterParts(chapterStr) {
    if (!chapterStr || typeof chapterStr !== 'string') return null;
    const s = chapterStr.trim();

    // 1. Temporada e Episódio (Temp 01 - Ep 02, S01E02, S 01 Ep. 02, T1E2, etc.)
    const seMatch = s.match(/(?:temp(?:orada)?|[sStT])\s*(\d+)[-_.\s|]*(?:[eE]p(?:is[oó]dio)?\.?|[eE])\s*(\d+(\.\d+)?)/i);
    if (seMatch) {
      return {
        season: parseInt(seMatch[1], 10),
        episode: parseFloat(seMatch[2]),
        isSeasonEp: true
      };
    }

    // 1b. Temporada ordinal (1ª Temporada | E1 - Episódio 1 / 1ª Temp - Ep 02)
    const ordMatch = s.match(/(\d+)[ªº°a-z]*\s*temp(?:orada)?[-_.\s|]*(?:[eE]p(?:is[oó]dio)?\.?|[eE])\s*(\d+(\.\d+)?)/i);
    if (ordMatch) {
      return {
        season: parseInt(ordMatch[1], 10),
        episode: parseFloat(ordMatch[2]),
        isSeasonEp: true
      };
    }

    // 2. Apenas temporada (Temp 2, Temporada 3)
    const seasonOnlyMatch = s.match(/^(?:temp(?:orada)?|[sS])\s*(\d+)$/i);
    if (seasonOnlyMatch) {
      return {
        season: parseInt(seasonOnlyMatch[1], 10),
        episode: 0,
        isSeasonEp: true
      };
    }

    // 3. Filmes (Filme 2, Filme)
    const movieMatch = s.match(/^filme\s*(\d+)?$/i);
    if (movieMatch) {
      return {
        season: 0,
        episode: movieMatch[1] ? parseInt(movieMatch[1], 10) : 1,
        isMovie: true
      };
    }

    // 4. Numérico padrão (Cap. 104.5, Ep. 12, etc.)
    const numMatch = s.match(/(\d+(\.\d+)?)/);
    if (numMatch) {
      return {
        season: null,
        episode: parseFloat(numMatch[1]),
        isSeasonEp: false
      };
    }

    return null;
  },

  compareChapters(ch1, ch2) {
    if (ch1 === ch2) return 0;
    const p1 = this.parseChapterParts(ch1);
    const p2 = this.parseChapterParts(ch2);

    if (!p1 && !p2) {
      return (ch1 || '').localeCompare(ch2 || '');
    }
    if (!p1) return -1;
    if (!p2) return 1;

    // Ambos temporada + episódio
    if (p1.isSeasonEp && p2.isSeasonEp) {
      if (p1.season !== p2.season) {
        return p1.season - p2.season;
      }
      return p1.episode - p2.episode;
    }

    // Um é temporada+episódio e outro é apenas episódio/capítulo
    if (p1.isSeasonEp && !p2.isSeasonEp) {
      if (p1.season === 1) return p1.episode - p2.episode;
      return p1.season > 1 ? 1 : -1;
    }
    if (!p1.isSeasonEp && p2.isSeasonEp) {
      if (p2.season === 1) return p1.episode - p2.episode;
      return p2.season > 1 ? -1 : 1;
    }

    // Ambos numéricos padrão (ou filmes)
    return p1.episode - p2.episode;
  },

  compareUrls(url1, url2) {
    if (!url1 || !url2) return 0;
    if (url1 === url2) return 0;
    const ch1 = typeof this.extractChapter === 'function' ? this.extractChapter(url1) : extractChapter(url1);
    const ch2 = typeof this.extractChapter === 'function' ? this.extractChapter(url2) : extractChapter(url2);
    if (ch1 && ch2) {
      return this.compareChapters(ch1, ch2);
    }
    return 0;
  },

  async quickIncrementWork(workId, options = {}) {
    const list = await this.getAllRawWorks();
    const work = list.find(w => w.id === workId);
    if (!work) return null;

    let source = (work.sources || []).find(s => s.id === work.lastReadSourceId) || (work.sources && work.sources[0]);
    const currentChapter = source ? source.chapter : (work.mainChapter || 'Cap. 0');
    
    // Se options.chapter for fornecido (ex: detectado na aba ativa), usa-o; caso contrário, incrementa +1
    const nextChapter = (options && options.chapter)
      ? options.chapter.trim()
      : this.parseChapterIncrement(currentChapter);

    const targetUrl = (options && options.url) ? options.url.trim() : (source ? source.url : '');
    const now = Date.now();

    if (source) {
      source.chapter = nextChapter;
      if (options && options.url) {
        source.url = options.url.trim();
      }
      if (options && options.domain) {
        source.domain = options.domain.trim();
      }
      if (options && options.siteName) {
        source.siteName = options.siteName.trim();
      }
      source.updatedAt = now;
      work.lastReadSourceId = source.id;
    } else if (options && options.url) {
      source = {
        id: generateId('src'),
        siteName: options.siteName || this.formatSiteName(options.domain || this.extractDomain(options.url)),
        domain: options.domain || this.extractDomain(options.url),
        url: options.url.trim(),
        chapter: nextChapter,
        updatedAt: now
      };
      if (!Array.isArray(work.sources)) work.sources = [];
      work.sources.push(source);
      work.lastReadSourceId = source.id;
    }

    work.mainChapter = nextChapter;
    work.updatedAt   = now;
    work.syncStatus  = 'pending';

    if (!Array.isArray(work.history)) work.history = [];
    work.history.unshift({
      id: generateId('hist'),
      timestamp: now,
      siteName: source ? source.siteName : 'Principal',
      domain: source ? source.domain : '',
      chapter: nextChapter,
      url: targetUrl || (source ? source.url : '')
    });
    if (work.history.length > 50) {
      work.history = work.history.slice(0, 50);
    }

    await safeStorageSet({ [STORAGE_KEY_ENTRIES_V3]: list });
    return work;
  },

  // ── Histórico de Notificações e Agendamento de Lançamentos ─
  async getNotificationsHistory() {
    const res = await safeStorageGet([STORAGE_KEY_NOTIFICATIONS_V1]);
    const list = res[STORAGE_KEY_NOTIFICATIONS_V1];
    return Array.isArray(list) ? list : [];
  },

  async addNotificationHistoryItem(item) {
    const history = await this.getNotificationsHistory();
    const newItem = {
      id: generateId('notif'),
      workId: item.workId || '',
      workName: item.workName || 'Obra',
      type: item.type || 'morning',
      url: item.url || '',
      tag: item.tag || 'anime',
      timestamp: item.timestamp || Date.now(),
      read: false
    };
    history.unshift(newItem);
    const trimmed = history.slice(0, 20); // Limite estrito de no máximo 20 itens
    await safeStorageSet({ [STORAGE_KEY_NOTIFICATIONS_V1]: trimmed });
    return newItem;
  },

  async markNotificationsRead() {
    const history = await this.getNotificationsHistory();
    history.forEach(item => { item.read = true; });
    await safeStorageSet({ [STORAGE_KEY_NOTIFICATIONS_V1]: history });
    return history;
  },

  async clearNotificationsHistory() {
    await safeStorageSet({ [STORAGE_KEY_NOTIFICATIONS_V1]: [] });
    return [];
  },

  async getEligibleReleasingWorks(dayOfWeek) {
    const works = await this.getWorks(false);
    return works.filter(w => {
      if (!w || w.deleted) return false;
      // Regra crucial: ignorar se estiver cancelada ou em hiato
      const pub = (w.publicationStatus || '').toLowerCase();
      if (pub === 'hiatus' || pub === 'cancelled' || pub === 'cancelado' || pub === 'hiato') return false;

      // Regra crucial: ignorar se o status de leitura for dropado ou concluido
      const read = (w.readingStatus || 'lendo').toLowerCase();
      if (read === 'dropado' || read === 'concluido') return false;

      // Verifica se o dia da semana informado está cadastrado nos dias de lançamento
      const days = Array.isArray(w.releaseDays) ? w.releaseDays : [];
      return days.includes(dayOfWeek);
    });
  },

  // ── Exportação e Importação de Backup v3 ──────────────────
  async exportBackup() {
    const works = await this.getWorks(true);
    const settings = await this.getSettings();
    return JSON.stringify({
      version: 3,
      exportedAt: new Date().toISOString(),
      works,
      settings: {
        enableFloatingButton: settings.enableFloatingButton,
        enableBadgeCount: settings.enableBadgeCount,
        enableQuickIncrement: settings.enableQuickIncrement,
        enableAutoTitleDetection: settings.enableAutoTitleDetection,
        enableReleaseNotifications: settings.enableReleaseNotifications,
        enableMorningNotification: settings.enableMorningNotification,
        enableEveningNotification: settings.enableEveningNotification,
        blockedDomains: settings.blockedDomains
      }
    }, null, 2);
  },

  async importBackup(jsonString) {
    // M-02: Validação de tamanho — rejeitar backups maiores que 5 MB
    if (typeof jsonString !== 'string' || jsonString.length > 5 * 1024 * 1024) {
      throw new Error('Arquivo de backup inválido ou maior que 5 MB.');
    }

    const parsed = JSON.parse(jsonString);
    if (!parsed) throw new Error('Arquivo de backup inválido.');

    const currentWorks = await this.getAllRawWorks();
    const map = new Map(currentWorks.map(w => [w.id, w]));
    let importedCount = 0;

    // M-02: Função de sanitização — allowlist de campos (evita prototype pollution e campos arbitrários)
    const VALID_TAGS = new Set(['manga', 'anime', 'webtoon', 'novel']);
    const VALID_READ_STATUS = new Set(['lendo', 'concluido', 'pausado', 'dropado', 'planejo']);
    const VALID_PUB_STATUS = new Set(['lancamento', 'completo', 'hiato', 'cancelado']);

    function sanitizeWork(item) {
      if (!item || typeof item !== 'object') return null;
      const id = String(item.id || '').slice(0, 128);
      const name = String(item.name || '').slice(0, 500).trim();
      if (!id || !name) return null;

      const sources = Array.isArray(item.sources)
        ? item.sources.slice(0, 50).map(s => ({
            id: String(s.id || generateId('src')).slice(0, 128),
            siteName: String(s.siteName || '').slice(0, 100),
            domain: String(s.domain || '').slice(0, 253),
            url: String(s.url || '').slice(0, 2048),
            chapter: String(s.chapter || '').slice(0, 100),
            updatedAt: Number(s.updatedAt) || 0
          }))
        : [];

      const history = Array.isArray(item.history)
        ? item.history.slice(0, 200).map(h => ({
            id: String(h.id || generateId('hist')).slice(0, 128),
            timestamp: Number(h.timestamp) || 0,
            siteName: String(h.siteName || '').slice(0, 100),
            domain: String(h.domain || '').slice(0, 253),
            chapter: String(h.chapter || '').slice(0, 100),
            url: String(h.url || '').slice(0, 2048)
          }))
        : [];

      return {
        id,
        name,
        tag: VALID_TAGS.has(item.tag) ? item.tag : 'manga',
        mainChapter: String(item.mainChapter || '').slice(0, 100),
        lastReadSourceId: String(item.lastReadSourceId || '').slice(0, 128),
        readingStatus: VALID_READ_STATUS.has(item.readingStatus) ? item.readingStatus : 'lendo',
        publicationStatus: VALID_PUB_STATUS.has(item.publicationStatus) ? item.publicationStatus : 'lancamento',
        aliases: Array.isArray(item.aliases)
          ? item.aliases.slice(0, 20).map(a => String(a).slice(0, 300))
          : [],
        releaseDays: Array.isArray(item.releaseDays) ? item.releaseDays.filter(d => Number.isInteger(d) && d >= 0 && d <= 6) : [],
        createdAt: Number(item.createdAt) || Date.now(),
        updatedAt: Number(item.updatedAt) || Date.now(),
        deleted: !!item.deleted,
        syncStatus: 'pending',
        sources,
        history
      };
    }

    // Se for backup v3
    if (Array.isArray(parsed.works)) {
      // M-02: Limitar número máximo de obras importadas
      const worksToImport = parsed.works.slice(0, 10000);
      for (const raw of worksToImport) {
        const item = sanitizeWork(raw);
        if (!item) continue;
        const existing = map.get(item.id);
        if (!existing || (item.updatedAt || 0) >= (existing.updatedAt || 0)) {
          map.set(item.id, item);
          importedCount++;
        }
      }
    } else if (Array.isArray(parsed.entries)) {
      // Se for backup legado v2
      for (const v2 of parsed.entries.slice(0, 10000)) {
        if (!v2.id || !v2.name) continue;
        const domain = extractDomain(v2.url);
        const siteName = formatSiteName(domain);
        const sourceId = generateId('src');
        const now = v2.updatedAt || v2.createdAt || Date.now();

        const source = {
          id: sourceId,
          siteName,
          domain,
          url: String(v2.url || '').slice(0, 2048),
          chapter: String(v2.chapter || 'Cap. 1').slice(0, 100),
          updatedAt: now
        };

        const existing = map.get(v2.id);
        if (!existing || now >= (existing.updatedAt || 0)) {
          map.set(v2.id, {
            id: String(v2.id).slice(0, 128),
            name: String(v2.name).slice(0, 500).trim(),
            tag: VALID_TAGS.has(v2.tag) ? v2.tag : 'manga',
            mainChapter: source.chapter,
            lastReadSourceId: sourceId,
            createdAt: v2.createdAt || now,
            updatedAt: now,
            deleted: !!v2.deleted,
            syncStatus: 'pending',
            sources: [source],
            history: [{
              id: generateId('hist'),
              timestamp: now,
              siteName,
              domain,
              chapter: source.chapter,
              url: source.url
            }]
          });
          importedCount++;
        }
      }
    } else {
      throw new Error('Estrutura de dados não reconhecida no backup.');
    }

    const merged = Array.from(map.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    await safeStorageSet({ [STORAGE_KEY_ENTRIES_V3]: merged });

    if (parsed.settings && typeof parsed.settings === 'object') {
      const currentSettings = await this.getSettings();
      // M-02: Só importar campos conhecidos de settings, nunca fazer spread cego
      const safeSettings = {};
      const BOOL_SETTINGS = ['enableFloatingButton', 'enableBadgeCount', 'enableQuickIncrement',
        'enableAutoTitleDetection', 'enableReleaseNotifications', 'enableMorningNotification', 'enableEveningNotification'];
      for (const key of BOOL_SETTINGS) {
        if (typeof parsed.settings[key] === 'boolean') safeSettings[key] = parsed.settings[key];
      }
      if (Array.isArray(parsed.settings.blockedDomains)) {
        safeSettings.blockedDomains = parsed.settings.blockedDomains
          .filter(d => typeof d === 'string' && d.length < 254)
          .slice(0, 500);
      }
      await this.saveSettings({ ...currentSettings, ...safeSettings });
    }

    return importedCount;
  },

  // ── Compatibilidade Retroativa para métodos v2 ────────────
  async getEntries(includeDeleted = false) {
    const works = await this.getWorks(includeDeleted);
    return works.map(w => {
      const activeSource = (w.sources || []).find(s => s.id === w.lastReadSourceId) || (w.sources && w.sources[0]) || {};
      return {
        id: w.id,
        name: w.name,
        chapter: w.mainChapter || activeSource.chapter || 'Cap. 1',
        url: activeSource.url || '',
        tag: w.tag,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
        deleted: w.deleted,
        syncStatus: w.syncStatus
      };
    });
  },

  async getAllRawEntries() {
    return this.getEntries(true);
  },

  async saveEntry(entryData) {
    const work = await this.saveWorkReading({
      workId: entryData.id,
      workName: entryData.name,
      chapter: entryData.chapter,
      url: entryData.url,
      tag: entryData.tag
    });
    const activeSource = (work.sources || []).find(s => s.id === work.lastReadSourceId) || (work.sources && work.sources[0]) || {};
    return {
      id: work.id,
      name: work.name,
      chapter: work.mainChapter,
      url: activeSource.url || '',
      tag: work.tag,
      createdAt: work.createdAt,
      updatedAt: work.updatedAt,
      deleted: work.deleted,
      syncStatus: work.syncStatus
    };
  },

  async deleteEntry(id) {
    return this.deleteWork(id);
  },

  async quickIncrementChapter(id) {
    const work = await this.quickIncrementWork(id);
    if (!work) return null;
    const activeSource = (work.sources || []).find(s => s.id === work.lastReadSourceId) || (work.sources && work.sources[0]) || {};
    return {
      id: work.id,
      name: work.name,
      chapter: work.mainChapter,
      url: activeSource.url || '',
      tag: work.tag,
      updatedAt: work.updatedAt,
      syncStatus: work.syncStatus
    };
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { StorageLocal, DEFAULT_SETTINGS };
}
global.StorageLocal = StorageLocal;
global.DEFAULT_SETTINGS = DEFAULT_SETTINGS;

})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
