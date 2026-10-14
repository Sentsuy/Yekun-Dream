/* ════════════════════════════════════════════════════════
   Yekun Dream — identity-service.js
   Gerenciamento de Identidade Google e Assinaturas PRO
   ════════════════════════════════════════════════════════ */

(function (global) {

const PRO_CACHE_KEY = 'yekun_pro_subscription_cache';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 horas

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
      // 1. Tenta obter via chrome.identity (Google Chrome)
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
            IdentityService.getFallbackEmail().then(resolve);
          });
          return;
        }
      } catch (_) {}

      IdentityService.getFallbackEmail().then(resolve);
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
      const url = `${config.supabaseUrl}/rest/v1/subscriptions?email=eq.${encodeURIComponent(email)}&select=email,status,valid_until,plan`;
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'apikey': config.supabaseKey,
          'Authorization': `Bearer ${config.supabaseKey}`
        }
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Erro na consulta Supabase: ${res.status} - ${errText}`);
      }

      const rows = await res.json();
      const now = Date.now();
      let statusData = {
        isPro: false,
        email,
        source: idInfo.source,
        daysLeft: 0,
        validUntil: 0,
        plan: 'none',
        cached: false
      };

      if (Array.isArray(rows) && rows.length > 0) {
        const sub = rows[0];
        const validUntil = Number(sub.valid_until) || 0;
        const isActive = sub.status === 'active' && validUntil > now;
        statusData = {
          isPro: isActive,
          email,
          source: idInfo.source,
          daysLeft: this.calculateDaysLeft(validUntil, now),
          validUntil,
          plan: sub.plan || 'annual',
          cached: false
        };
      }

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
