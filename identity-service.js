/* ════════════════════════════════════════════════════════
   Yekun Dream — identity-service.js
   Gerenciamento de Identidade Google e Assinaturas PRO
   ════════════════════════════════════════════════════════ */

(function (global) {

const PRO_CACHE_KEY = 'yekun_pro_subscription_cache';
const CACHE_TTL_MS = 1 * 60 * 60 * 1000; // 1 hora (segurança: reduzido de 6h)

const TotpUtil = {
  BASE32_CHARS: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567',

  generateSecret(length = 16) {
    let secret = '';
    const chars = this.BASE32_CHARS;
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const bytes = new Uint8Array(length);
      crypto.getRandomValues(bytes);
      for (let i = 0; i < length; i++) {
        secret += chars[bytes[i] % chars.length];
      }
    } else {
      for (let i = 0; i < length; i++) {
        secret += chars[Math.floor(Math.random() * chars.length)];
      }
    }
    return secret;
  },

  base32ToBytes(base32) {
    const clean = String(base32 || '').toUpperCase().replace(/=+$/, '').replace(/[\s-]/g, '');
    const bytes = [];
    let bits = 0;
    let value = 0;
    for (let i = 0; i < clean.length; i++) {
      const idx = this.BASE32_CHARS.indexOf(clean[i]);
      if (idx === -1) continue;
      value = (value << 5) | idx;
      bits += 5;
      if (bits >= 8) {
        bytes.push((value >>> (bits - 8)) & 255);
        bits -= 8;
      }
    }
    return new Uint8Array(bytes);
  },

  getOtpAuthUrl(email, secret, issuer = 'Yekun Dream') {
    const label = encodeURIComponent(`${issuer}:${email}`);
    const iss = encodeURIComponent(issuer);
    return `otpauth://totp/${label}?secret=${secret}&issuer=${iss}&algorithm=SHA1&digits=6&period=30`;
  },

  async generateToken(secret, timeMs = Date.now()) {
    if (typeof crypto === 'undefined' || !crypto.subtle) {
      return '';
    }
    try {
      const epochSec = Math.floor(timeMs / 1000);
      const counter = Math.floor(epochSec / 30);
      const counterBytes = new Uint8Array(8);
      let tmp = counter;
      for (let i = 7; i >= 0; i--) {
        counterBytes[i] = tmp & 0xff;
        tmp = Math.floor(tmp / 256);
      }

      const keyBytes = this.base32ToBytes(secret);
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyBytes,
        { name: 'HMAC', hash: { name: 'SHA-1' } },
        false,
        ['sign']
      );

      const sig = await crypto.subtle.sign('HMAC', cryptoKey, counterBytes);
      const hmac = new Uint8Array(sig);
      const offset = hmac[hmac.length - 1] & 0x0f;
      const code =
        ((hmac[offset] & 0x7f) << 24) |
        ((hmac[offset + 1] & 0xff) << 16) |
        ((hmac[offset + 2] & 0xff) << 8) |
        (hmac[offset + 3] & 0xff);
      return (code % 1000000).toString().padStart(6, '0');
    } catch (_) {
      return '';
    }
  },

  async verifyToken(token, secret, window = 1) {
    const cleanToken = String(token || '').trim();
    if (!/^\d{6}$/.test(cleanToken)) return false;
    const now = Date.now();
    for (let w = -window; w <= window; w++) {
      const generated = await this.generateToken(secret, now + (w * 30000));
      if (generated && generated === cleanToken) return true;
    }
    return false;
  }
};

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
          const handleResult = (userInfo) => {
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
          };

          try {
            // Chrome 84+: suporta { accountStatus: 'ANY' } para pegar mesmo sem Sync ativado
            chrome.identity.getProfileUserInfo({ accountStatus: 'ANY' }, userInfo => {
              if (userInfo && userInfo.email) {
                handleResult(userInfo);
              } else {
                try {
                  chrome.identity.getProfileUserInfo(handleResult);
                } catch (_) {
                  handleResult(userInfo);
                }
              }
            });
            return;
          } catch (_) {
            chrome.identity.getProfileUserInfo(handleResult);
            return;
          }
        }
      } catch (_) {}
      resolve({ email: '', source: 'none', id: '' });
    });
  },

  Totp: TotpUtil,

  async getStoredCredentials() {
    return new Promise(resolve => {
      try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get(['proAccessPin', 'proRecoveryKey', 'proTotpSecret', 'proTotpEnabled'], res => {
            resolve({
              accessPin: (res && res.proAccessPin) ? String(res.proAccessPin) : '',
              recoveryKey: (res && res.proRecoveryKey) ? String(res.proRecoveryKey) : '',
              totpSecret: (res && res.proTotpSecret) ? String(res.proTotpSecret) : '',
              totpEnabled: !!(res && res.proTotpEnabled)
            });
          });
          return;
        }
      } catch (_) {}
      resolve({ accessPin: '', recoveryKey: '', totpSecret: '', totpEnabled: false });
    });
  },

  async saveStoredCredentials(creds = {}) {
    return new Promise(resolve => {
      try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          const payload = {};
          if (creds.accessPin !== undefined) payload.proAccessPin = String(creds.accessPin);
          if (creds.recoveryKey !== undefined) payload.proRecoveryKey = String(creds.recoveryKey);
          if (creds.totpSecret !== undefined) payload.proTotpSecret = String(creds.totpSecret);
          if (creds.totpEnabled !== undefined) payload.proTotpEnabled = !!creds.totpEnabled;
          chrome.storage.local.set(payload, resolve);
          return;
        }
      } catch (_) {}
      resolve();
    });
  },

  async clearStoredCredentials() {
    return new Promise(resolve => {
      try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.remove(['proAccessPin', 'proRecoveryKey', 'proTotpSecret', 'proTotpEnabled'], resolve);
          return;
        }
      } catch (_) {}
      resolve();
    });
  },

  async clearCustomProEmail() {
    await this.clearStoredCredentials();
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

  async verifyProAccess(config, email, secret) {
    const cleanEmail = this.normalizeEmail(email);
    const cleanSecret = String(secret || '').trim();

    if (!cleanEmail) {
      return { success: false, error: 'E-mail não informado.' };
    }
    if (!cleanSecret) {
      return { success: false, error: 'Informe o PIN de 6 dígitos ou a Chave de Recuperação.' };
    }

    if (!config || !config.supabaseUrl || !config.supabaseKey) {
      return { success: false, error: 'Servidor Supabase não configurado.' };
    }

    try {
      const url = `${config.supabaseUrl}/rest/v1/rpc/verify_pro_access`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': config.supabaseKey,
          'Authorization': `Bearer ${config.supabaseKey}`
        },
        body: JSON.stringify({
          p_email: cleanEmail,
          p_secret: cleanSecret
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        return { success: false, error: `Falha ao verificar acesso: ${res.status} - ${errText}` };
      }

      const result = await res.json();
      if (result && result.success) {
        await this.saveStoredCredentials({
          accessPin: result.access_pin || (cleanSecret.length === 6 ? cleanSecret : ''),
          recoveryKey: result.recovery_key || (cleanSecret.startsWith('YK-') ? cleanSecret : ''),
          totpEnabled: !!result.totp_enabled
        });

        await this.setCustomProEmail(cleanEmail);

        const now = Date.now();
        const validUntil = Number(result.validUntil) || 0;
        const statusData = {
          isPro: true,
          email: cleanEmail,
          source: 'custom',
          daysLeft: this.calculateDaysLeft(validUntil, now),
          validUntil,
          plan: result.plan || 'annual',
          accessPin: result.access_pin || '',
          recoveryKey: result.recovery_key || '',
          totpEnabled: !!result.totp_enabled,
          cached: false
        };
        await this.saveCachedProStatus(statusData);

        return {
          success: true,
          statusData,
          accessPin: result.access_pin,
          recoveryKey: result.recovery_key,
          totpEnabled: !!result.totp_enabled
        };
      } else {
        return {
          success: false,
          error: (result && result.error) ? result.error : 'PIN de Acesso ou Chave de Recuperação incorreta.'
        };
      }
    } catch (err) {
      return { success: false, error: `Erro de conexão: ${err.message}` };
    }
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

    const creds = await this.getStoredCredentials();

    // Se for e-mail manual (custom) e não tiver credenciais nesta máquina: bloqueia
    if (idInfo.source === 'custom' && !creds.accessPin && !creds.recoveryKey) {
      return {
        isPro: false,
        email,
        source: 'custom',
        needsPin: true,
        daysLeft: 0,
        validUntil: 0,
        plan: 'none',
        cached: false
      };
    }

    try {
      if (idInfo.source === 'custom' && (creds.accessPin || creds.recoveryKey)) {
        const vRes = await this.verifyProAccess(config, email, creds.accessPin || creds.recoveryKey);
        if (vRes.success && vRes.statusData) {
          return vRes.statusData;
        }
      }

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
        accessPin: creds.accessPin || '',
        recoveryKey: creds.recoveryKey || '',
        totpEnabled: creds.totpEnabled || false,
        cached: false
      };

      await this.saveCachedProStatus(statusData);
      return statusData;
    } catch (err) {
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
    const is4Digit = /^\d{4}$/.test(rawPin);
    const is6Digit = /^\d{6}$/.test(rawPin);
    const isRecovery = /^YK-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(rawPin);

    if (!is4Digit && !is6Digit && !isRecovery) {
      return {
        success: false,
        error: 'O código deve conter exatamente 4 ou 6 números (ex: 7492 ou 839204) ou a Chave de Recuperação.'
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
        error: 'Informe seu e-mail para vincular este código de 4 dígitos ou PIN.'
      };
    }

    // Se for PIN de 6 dígitos ou Chave de Recuperação, valida via verifyProAccess
    if (is6Digit || isRecovery) {
      const vRes = await this.verifyProAccess(config, email, rawPin);
      if (vRes.success) {
        return {
          success: true,
          message: 'Assinatura Yekun PRO autorizada com sucesso!',
          validUntil: vRes.statusData ? vRes.statusData.validUntil : 0,
          daysAdded: 0
        };
      }
      return { success: false, error: vRes.error || 'Código inválido.' };
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

  async setupTotp(email) {
    const secret = TotpUtil.generateSecret(16);
    const otpAuthUrl = TotpUtil.getOtpAuthUrl(email, secret);
    return {
      secret,
      otpAuthUrl,
      qrUrl: `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(otpAuthUrl)}&size=160x160`
    };
  },

  async verifyAndEnableTotp(config, email, secret, code) {
    const valid = await TotpUtil.verifyToken(code, secret);
    if (!valid) {
      return { success: false, error: 'Código de 6 dígitos inválido ou expirado. Verifique o relógio do seu celular.' };
    }
    await this.saveStoredCredentials({
      totpSecret: secret,
      totpEnabled: true
    });
    return { success: true, message: 'Google Authenticator ativado com sucesso!' };
  },

  async disableTotp() {
    await this.saveStoredCredentials({
      totpSecret: '',
      totpEnabled: false
    });
    return { success: true };
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

})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : this)));
