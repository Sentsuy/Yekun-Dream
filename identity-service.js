/* ════════════════════════════════════════════════════════
   Yekun Dream — identity-service.js
   Gerenciamento de Identidade Google e Assinaturas PRO
   ════════════════════════════════════════════════════════ */

(function (global) {

const PRO_CACHE_KEY = 'yekun_pro_subscription_cache';
const CACHE_TTL_MS = 1 * 60 * 60 * 1000; // 1 hora (segurança: reduzido de 6h)

const IdentityService = {
  normalizeEmail(email) {
    if (!email || typeof email !== 'string') return '';
    return email.trim().toLowerCase();
  },

  calculateDaysLeft(validUntil, nowEpoch = Date.now()) {
    if (!validUntil || isNaN(Number(validUntil))) return 0;
    const diff = Number(validUntil) - nowEpoch;
    return diff > 0 ? Math.ceil(diff / 86400000) : 0;
  },

  async getIdentityInfo() {
    return new Promise(resolve => {
      // 1. Prioridade: se o usuário configurou um e-mail manual, usa ele
      IdentityService.getFallbackEmail().then(fallback => {
        if (fallback && fallback.email) {
          return resolve(fallback);
        }

        // 2. Se não houver e-mail manual, tenta obter via conta Google do Chrome
        IdentityService.getGoogleIdentityInfo().then(resolve);
      });
    });
  },

  async getGoogleIdentityInfo() {
    return new Promise(resolve => {
      try {
        if (typeof chrome !== 'undefined' && chrome.identity && typeof chrome.identity.getProfileUserInfo === 'function') {
          chrome.identity.getProfileUserInfo(userInfo => {
            if (userInfo && userInfo.email) {
              const clean = IdentityService.normalizeEmail(userInfo.email);
              if (clean) {
                return resolve({
                  email: clean,
                  source: 'google',
                  id: userInfo.id || ''
                });
              }
            }
            resolve({ email: '', source: 'none', id: '' });
          });
          return;
        }
      } catch (_) {}
      resolve({ email: '', source: 'none', id: '' });
    });
  },

  async clearCustomProEmail() {
    return new Promise(resolve => {
      try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.remove(['customProEmail', PRO_CACHE_KEY], () => resolve());
          return;
        }
      } catch (_) {}
      resolve();
    });
  },

  async getFallbackEmail() {
    return new Promise(resolve => {
      try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get(['customProEmail'], res => {
            const email = IdentityService.normalizeEmail(res && res.customProEmail);
            if (email) {
              return resolve({ email, source: 'custom', id: '' });
            }
            resolve({ email: '', source: 'none', id: '' });
          });
          return;
        }
      } catch (_) {}
      resolve({ email: '', source: 'none', id: '' });
    });
  },

  async setCustomProEmail(email) {
    const clean = this.normalizeEmail(email);
    // M-05: Validação básica de formato de e-mail antes de salvar
    if (!clean || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(clean) || clean.length > 254) {
      return '';
    }
    return new Promise(resolve => {
      try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ customProEmail: clean }, () => {
            // Invalida cache ao mudar o e-mail
            chrome.storage.local.remove([PRO_CACHE_KEY], () => resolve(clean));
          });
          return;
        }
      } catch (_) {}
      resolve(clean);
    });
  },

  async checkProStatus(config, forceRefresh = false) {
    const idInfo = await this.getIdentityInfo();
    const email = idInfo.email;

    if (!email) {
      return {
        isPro: false,
        email: '',
        source: 'none',
        daysLeft: 0,
        validUntil: 0,
        plan: 'none',
        cached: false
      };
    }

    // 1. Checa cache local se não for forceRefresh
    if (!forceRefresh) {
      const cached = await this.getCachedProStatus(email);
      if (cached) {
        return cached;
      }
    }

    if (!config || !config.supabaseUrl || !config.supabaseKey) {
      return {
        isPro: false,
        email,
        source: idInfo.source,
        daysLeft: 0,
        validUntil: 0,
        plan: 'none',
        error: 'Configuração do Supabase ausente',
        cached: false
      };
    }

    try {
      // C-01: Usar RPC check_pro_status em vez de query direta à tabela subscriptions.
      // A RPC é SECURITY DEFINER e devolve apenas os dados do e-mail solicitado,
      // sem expor a tabela completa via REST anon.
      const url = `${config.supabaseUrl}/rest/v1/rpc/check_pro_status`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': config.supabaseKey,
          'Authorization': `Bearer ${config.supabaseKey}`
        },
        body: JSON.stringify({ p_email: email })
      });

      if (!res.ok) {
        // I-03: Logar detalhe internamente, exibir mensagem genérica
        const errText = await res.text();
        console.debug('[IdentityService] Erro check_pro_status:', res.status, errText);
        throw new Error(`Falha ao verificar assinatura (${res.status})`);
      }

      const result = await res.json();
      const now = Date.now();
      const validUntil = Number(result.validUntil) || 0;

      const statusData = {
        isPro: !!result.isPro,
        email,
        source: idInfo.source,
        daysLeft: this.calculateDaysLeft(validUntil, now),
        validUntil,
        plan: result.plan || 'none',
        cached: false
      };

      await this.saveCachedProStatus(statusData);
      return statusData;
    } catch (err) {
      // Em caso de falha de rede, tenta usar o último cache disponível
      const fallbackCache = await this.getCachedProStatus(email, true);
      if (fallbackCache) {
        return { ...fallbackCache, networkError: err.message };
      }
      return {
        isPro: false,
        email,
        source: idInfo.source,
        daysLeft: 0,
        validUntil: 0,
        plan: 'none',
        error: err.message,
        cached: false
      };
    }
  },

  async redeemPin(config, pin, providedEmail = '') {
    const rawPin = String(pin || '').trim();
    if (!/^\d{4}$/.test(rawPin)) {
      return {
        success: false,
        error: 'O código deve conter exatamente 4 números (ex: 7492).'
      };
    }

    let email = this.normalizeEmail(providedEmail);
    if (!email) {
      const idInfo = await this.getIdentityInfo();
      email = idInfo.email;
    }

    if (!email) {
      return {
        success: false,
        error: 'Informe seu e-mail para vincular este código de 4 dígitos.'
      };
    }

    if (!config || !config.supabaseUrl || !config.supabaseKey) {
      return {
        success: false,
        error: 'Servidor Supabase não configurado.'
      };
    }

    try {
      const url = `${config.supabaseUrl}/rest/v1/rpc/redeem_activation_pin`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': config.supabaseKey,
          'Authorization': `Bearer ${config.supabaseKey}`
        },
        body: JSON.stringify({
          p_pin: rawPin,
          p_email: email
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        return { success: false, error: `Falha ao ativar código: ${res.status} - ${errText}` };
      }

      const result = await res.json();
      if (result && result.success) {
        // Atualiza cache com novo status PRO
        await this.checkProStatus(config, true);
        return {
          success: true,
          message: result.message || 'Assinatura Yekun PRO ativada com sucesso!',
          validUntil: result.valid_until,
          daysAdded: result.days_added
        };
      } else {
        return {
          success: false,
          error: (result && result.error) ? result.error : 'Código inválido ou já resgatado.'
        };
      }
    } catch (err) {
      return { success: false, error: `Erro de conexão: ${err.message}` };
    }
  },

  async getCachedProStatus(email, ignoreTtl = false) {
    return new Promise(resolve => {
      try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get([PRO_CACHE_KEY], res => {
            const entry = res && res[PRO_CACHE_KEY];
            if (!entry || entry.email !== email) return resolve(null);
            const now = Date.now();
            if (!ignoreTtl && (now - entry.timestamp > CACHE_TTL_MS)) {
              return resolve(null); // expirou
            }
            resolve({
              ...entry.data,
              cached: true,
              daysLeft: IdentityService.calculateDaysLeft(entry.data.validUntil, now),
              isPro: entry.data.isPro && entry.data.validUntil > now
            });
          });
          return;
        }
      } catch (_) {}
      resolve(null);
    });
  },

  async saveCachedProStatus(data) {
    return new Promise(resolve => {
      try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({
            [PRO_CACHE_KEY]: {
              email: data.email,
              timestamp: Date.now(),
              data
            }
          }, resolve);
          return;
        }
      } catch (_) {}
      resolve();
    });
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { IdentityService };
}

global.IdentityService = IdentityService;

})(typeof window !== 'undefined' ? window : global);
