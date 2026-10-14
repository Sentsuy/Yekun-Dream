/**
 * Chapter Tracker — Canonical Public Resolver
 * Consulta APIs públicas oficiais (AniList & MangaDex) para recuperar
 * nomes oficiais em múltiplos idiomas (Romaji, Inglês, Português, Sinônimos).
 */

(function (global) {

const ANILIST_GRAPHQL_URL = 'https://graphql.anilist.co';
const MANGADEX_API_URL = 'https://api.mangadex.org/manga';
const RESOLVER_TIMEOUT_MS = 2500;

function getDayOfWeekFromTimestamp(epochSeconds) {
  if (!epochSeconds || typeof epochSeconds !== 'number') return null;
  const date = new Date(epochSeconds * 1000);
  return date.getDay(); // 0 = Dom, 1 = Seg, ..., 6 = Sáb
}

function parseAniListMedia(media) {
  if (!media) return { canonicalTitle: '', externalId: '', aliases: [], releaseDay: null };
  const titles = media.title || {};
  const canonicalTitle = titles.english || titles.romaji || Object.values(titles)[0] || '';
  const externalId = media.id ? `anilist:${media.id}` : '';

  const aliasSet = new Set();
  if (titles.english && titles.english !== canonicalTitle) aliasSet.add(titles.english);
  if (titles.romaji && titles.romaji !== canonicalTitle) aliasSet.add(titles.romaji);
  if (titles.native && titles.native !== canonicalTitle) aliasSet.add(titles.native);

  if (Array.isArray(media.synonyms)) {
    media.synonyms.forEach(syn => {
      const s = (syn || '').trim();
      if (s && s !== canonicalTitle) aliasSet.add(s);
    });
  }

  let releaseDay = null;
  if (media.nextAiringEpisode && media.nextAiringEpisode.airingAt) {
    releaseDay = getDayOfWeekFromTimestamp(media.nextAiringEpisode.airingAt);
  }

  return {
    canonicalTitle,
    externalId,
    aliases: Array.from(aliasSet),
    releaseDay,
    status: media.status || ''
  };
}

function parseMangaDexData(item) {
  if (!item || !item.attributes) return { canonicalTitle: '', externalId: '', aliases: [] };
  const attrs = item.attributes;
  const titleObj = attrs.title || {};
  const canonicalTitle = titleObj.en || Object.values(titleObj)[0] || '';
  const externalId = item.id ? `mangadex:${item.id}` : '';

  const aliasSet = new Set();
  if (Array.isArray(attrs.altTitles)) {
    attrs.altTitles.forEach(alt => {
      const val = Object.values(alt)[0];
      if (val && typeof val === 'string' && val.trim() !== canonicalTitle) {
        aliasSet.add(val.trim());
      }
    });
  }

  return {
    canonicalTitle,
    externalId,
    aliases: Array.from(aliasSet)
  };
}

async function queryAniList(searchTitle) {
  if (!searchTitle || typeof searchTitle !== 'string') return null;
  const query = `
    query ($search: String) {
      Media(search: $search) {
        id
        status
        title {
          romaji
          english
          native
        }
        synonyms
        nextAiringEpisode {
          airingAt
          episode
        }
      }
    }
  `;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RESOLVER_TIMEOUT_MS);

  try {
    const res = await fetch(ANILIST_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ query, variables: { search: searchTitle } }),
      signal: controller.signal
    });
    clearTimeout(timer);

    if (res.ok) {
      const json = await res.json();
      return parseAniListMedia(json?.data?.Media);
    }
  } catch (e) {
    // Timeout or network error
  } finally {
    clearTimeout(timer);
  }
  return null;
}

async function queryMangaDex(searchTitle) {
  if (!searchTitle || typeof searchTitle !== 'string') return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RESOLVER_TIMEOUT_MS);

  try {
    const url = `${MANGADEX_API_URL}?title=${encodeURIComponent(searchTitle)}&limit=1`;
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: controller.signal
    });
    clearTimeout(timer);

    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json?.data) && json.data.length > 0) {
        return parseMangaDexData(json.data[0]);
      }
    }
  } catch (e) {
    // Timeout or network error
  } finally {
    clearTimeout(timer);
  }
  return null;
}

const CANONICAL_CACHE_KEY = 'chapter_tracker_canonical_cache_v1';
const CANONICAL_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias
const memoryCanonicalCache = new Map();

function normalizeCacheKey(str) {
  if (!str || typeof str !== 'string') return '';
  return str.toLowerCase().replace(/\s+/g, ' ').trim();
}

async function getCachedCanonical(key) {
  const normKey = normalizeCacheKey(key);
  if (!normKey) return null;
  const now = Date.now();

  if (memoryCanonicalCache.has(normKey)) {
    const entry = memoryCanonicalCache.get(normKey);
    if (entry && (now - entry.timestamp < CANONICAL_CACHE_TTL_MS)) {
      return entry.data;
    }
  }

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    try {
      const res = await new Promise(r => chrome.storage.local.get([CANONICAL_CACHE_KEY], r));
      const cache = res && res[CANONICAL_CACHE_KEY] ? res[CANONICAL_CACHE_KEY] : {};
      const entry = cache[normKey];
      if (entry && (now - entry.timestamp < CANONICAL_CACHE_TTL_MS)) {
        memoryCanonicalCache.set(normKey, entry);
        return entry.data;
      }
    } catch (_) {}
  }
  return null;
}

async function setCachedCanonical(key, data) {
  const normKey = normalizeCacheKey(key);
  if (!normKey || !data) return;
  const now = Date.now();
  const entry = { data, timestamp: now };
  memoryCanonicalCache.set(normKey, entry);

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    try {
      chrome.storage.local.get([CANONICAL_CACHE_KEY], (res) => {
        const cache = res && res[CANONICAL_CACHE_KEY] ? res[CANONICAL_CACHE_KEY] : {};
        cache[normKey] = entry;
        const keys = Object.keys(cache);
        if (keys.length > 200) {
          keys.slice(0, keys.length - 200).forEach(k => delete cache[k]);
        }
        chrome.storage.local.set({ [CANONICAL_CACHE_KEY]: cache });
      });
    } catch (_) {}
  }
}

async function resolveCanonicalAliases(searchTitle) {
  const clean = (searchTitle || '').trim();
  if (!clean) return { canonicalTitle: '', externalId: '', aliases: [] };

  const cached = await getCachedCanonical(clean);
  if (cached && cached.canonicalTitle) {
    return cached;
  }

  // 1. Tenta AniList primeiro (ótima cobertura de sinônimos oficiais)
  const aniListRes = await queryAniList(clean);
  if (aniListRes && aniListRes.canonicalTitle) {
    await setCachedCanonical(clean, aniListRes);
    return aniListRes;
  }

  // 2. Fallback para MangaDex (excelente catálogo de scans e altTitles em PT-BR)
  const mdRes = await queryMangaDex(clean);
  if (mdRes && mdRes.canonicalTitle) {
    await setCachedCanonical(clean, mdRes);
    return mdRes;
  }

  return { canonicalTitle: '', externalId: '', aliases: [] };
}

const CanonicalResolver = {
  parseAniListMedia,
  parseMangaDexData,
  queryAniList,
  queryMangaDex,
  resolveCanonicalAliases,
  getDayOfWeekFromTimestamp,
  getCachedCanonical,
  setCachedCanonical
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CanonicalResolver;
}
global.CanonicalResolver = CanonicalResolver;

})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
