/**
 * Chapter Tracker — Crowdsourced Alias Sync & Consensus Engine
 * Gerencia o catálogo comunitário de títulos e sinônimos com validação
 * por consenso (quórum >= 2 votos), trava de conflitos e sanitização.
 */

(function (global) {

const STORAGE_KEY_CROWD_ALIASES = 'chapter_tracker_crowd_aliases_v1';
const QUORUM_THRESHOLD = 2;

function sanitizeAliasInput(alias) {
  if (!alias || typeof alias !== 'string') return null;
  const trimmed = alias.trim();
  if (trimmed.length < 3 || trimmed.length > 120) return null;

  // Rejeita URLs
  if (/^https?:\/\//i.test(trimmed) || /www\.[a-z0-9\-]+\.[a-z]+/i.test(trimmed)) {
    return null;
  }

  // Rejeita menções cruas de capítulo (ex: "Capítulo 14", "Cap 10 - Solo Leveling")
  if (/(?:^|\s)(?:cap[íi]tulo|chapter|chap\.?|cap\.?|cp\.?|ch\.?|epis[óo]dio|ep\.?)\s*\d+/i.test(trimmed)) {
    return null;
  }

  // Remove caracteres perigosos
  const clean = trimmed.replace(/[<>{}\\]/g, '').trim();
  return clean.length >= 3 ? clean : null;
}

function normalizeAliasKey(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function createServiceInstance(customAdapter = null) {
  let fallbackMemoryStore = {};
  const adapter = customAdapter || {
    async getStore() {
      return new Promise(res => {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get([STORAGE_KEY_CROWD_ALIASES], r => {
            res(r && r[STORAGE_KEY_CROWD_ALIASES] ? r[STORAGE_KEY_CROWD_ALIASES] : {});
          });
        } else {
          res(fallbackMemoryStore);
        }
      });
    },
    async setStore(data) {
      return new Promise(res => {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ [STORAGE_KEY_CROWD_ALIASES]: data }, res);
        } else {
          fallbackMemoryStore = Object.assign({}, data);
          res();
        }
      });
    }
  };

  async function lookupAlias(rawTitle) {
    const key = normalizeAliasKey(rawTitle);
    if (!key) return { match: null, isVerified: false };

    const store = await adapter.getStore();
    const entry = store[key];
    if (!entry) return { match: null, isVerified: false };

    const isVerified = (entry.votes || 0) >= QUORUM_THRESHOLD || entry.status === 'verified';
    return {
      match: entry,
      isVerified
    };
  }

  async function submitAliasLink({ alias, canonicalTitle, externalId = '', userFingerprint = 'local' }) {
    const cleanAlias = sanitizeAliasInput(alias);
    if (!cleanAlias) {
      return { success: false, error: 'Título inválido para catálogo' };
    }

    const key = normalizeAliasKey(cleanAlias);
    const store = await adapter.getStore();
    const existing = store[key];

    const cleanCanonical = (canonicalTitle || '').trim();
    if (!cleanCanonical) {
      return { success: false, error: 'Título canônico obrigatório' };
    }

    // Trava de Conflito 1-para-1:
    // Se já existe e aponta para outro título canônico
    if (existing && normalizeAliasKey(existing.canonicalTitle) !== normalizeAliasKey(cleanCanonical)) {
      return {
        success: false,
        conflict: true,
        existingTarget: existing.canonicalTitle,
        attemptedTarget: cleanCanonical,
        status: existing.status,
        votes: existing.votes
      };
    }

    const voters = new Set(existing && Array.isArray(existing.voters) ? existing.voters : []);
    voters.add(userFingerprint);

    const votes = voters.size;
    const status = votes >= QUORUM_THRESHOLD ? 'verified' : 'pending';

    const updatedEntry = {
      aliasDisplay: cleanAlias,
      canonicalTitle: existing ? existing.canonicalTitle : cleanCanonical,
      externalId: existing?.externalId || externalId || '',
      votes,
      status,
      voters: Array.from(voters),
      updatedAt: Date.now()
    };

    store[key] = updatedEntry;
    await adapter.setStore(store);

    return {
      success: true,
      conflict: false,
      status,
      votes,
      entry: updatedEntry
    };
  }

  return {
    sanitizeAliasInput,
    normalizeAliasKey,
    lookupAlias,
    submitAliasLink,
    QUORUM_THRESHOLD
  };
}

const defaultInstance = createServiceInstance();

const AliasCrowdService = {
  ...defaultInstance,
  createServiceInstance
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AliasCrowdService;
}
global.AliasCrowdService = AliasCrowdService;

})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
