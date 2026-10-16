/* ════════════════════════════════════════════════════════
   Yekun Dream — feedback-service.js
   Envio de Feedbacks, Relatos e Sugestões de Mapeamento
   ════════════════════════════════════════════════════════ */

(function (global) {

  const MAX_MESSAGE_LENGTH = 300;
  const MIN_MESSAGE_LENGTH = 5;
  const ALLOWED_CATEGORIES = ['site_mapping', 'bug_report', 'suggestion'];

  const FeedbackService = {
    MAX_MESSAGE_LENGTH,
    MIN_MESSAGE_LENGTH,
    ALLOWED_CATEGORIES,

    /**
     * Valida os campos obrigatórios e limites do payload antes da submissão
     * @param {Object} payload 
     * @returns {{ valid: boolean, error?: string }}
     */
    validatePayload(payload) {
      if (!payload || typeof payload !== 'object') {
        return { valid: false, error: 'Payload inválido.' };
      }

      const category = String(payload.category || '').trim().toLowerCase();
      if (!this.ALLOWED_CATEGORIES.includes(category)) {
        return { 
          valid: false, 
          error: 'Categoria inválida. Selecione: Sugerir Site, Reportar Falha ou Sugestão Geral.' 
        };
      }

      const message = String(payload.message || '').trim();
      if (message.length < this.MIN_MESSAGE_LENGTH) {
        return { 
          valid: false, 
          error: `Mensagem muito curta. Mínimo de ${this.MIN_MESSAGE_LENGTH} caracteres.` 
        };
      }

      if (message.length > this.MAX_MESSAGE_LENGTH) {
        return { 
          valid: false, 
          error: `Mensagem excede o limite máximo permitido de ${this.MAX_MESSAGE_LENGTH} caracteres.` 
        };
      }

      return { valid: true };
    },

    /**
     * Helper para identificar navegador e plataforma para facilitar a depuração
     * @returns {string}
     */
    getBrowserInfo() {
      try {
        if (typeof navigator !== 'undefined' && navigator.userAgent) {
          const ua = navigator.userAgent;
          const platform = navigator.platform || 'Desktop';
          if (ua.includes('Edg/')) return `Edge / ${platform}`;
          if (ua.includes('Chrome/')) return `Chrome / ${platform}`;
          if (ua.includes('Firefox/')) return `Firefox / ${platform}`;
          if (ua.includes('Safari/')) return `Safari / ${platform}`;
          return ua.substring(0, 100);
        }
      } catch (_) {}
      return 'Chrome / Desktop';
    },

    /**
     * Obtém a versão instalada da extensão via manifest
     * @returns {string}
     */
    getExtensionVersion() {
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest) {
          const manifest = chrome.runtime.getManifest();
          if (manifest && manifest.version) {
            return String(manifest.version);
          }
        }
      } catch (_) {}
      return '1.2.0';
    },

    /**
     * Envia o feedback à RPC submit_feedback no Supabase
     * @param {{ supabaseUrl: string, supabaseKey: string }} config 
     * @param {Object} data 
     * @returns {Promise<{ success: boolean, message?: string, reportId?: string, error?: string }>}
     */
    async submitFeedback(config, data) {
      const validation = this.validatePayload(data);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      const supabaseUrl = (config && config.supabaseUrl ? config.supabaseUrl : '').replace(/\/+$/, '');
      const supabaseKey = config && config.supabaseKey ? config.supabaseKey : '';

      if (!supabaseUrl || !supabaseKey) {
        return { success: false, error: 'Configuração do Supabase ausente.' };
      }

      const category = String(data.category || '').trim().toLowerCase();
      const message = String(data.message || '').trim().substring(0, this.MAX_MESSAGE_LENGTH);
      const siteUrl = data.siteUrl ? String(data.siteUrl).trim().substring(0, 300) : null;
      const detectedTitle = data.detectedTitle ? String(data.detectedTitle).trim().substring(0, 200) : null;
      const detectedChapter = data.detectedChapter ? String(data.detectedChapter).trim().substring(0, 50) : null;
      const userEmail = data.userEmail ? String(data.userEmail).trim().toLowerCase().substring(0, 150) : null;
      const extensionVersion = this.getExtensionVersion().substring(0, 20);
      const browserInfo = this.getBrowserInfo().substring(0, 150);

      const rpcPayload = {
        p_category: category,
        p_message: message,
        p_site_url: siteUrl,
        p_detected_title: detectedTitle,
        p_detected_chapter: detectedChapter,
        p_user_email: userEmail,
        p_extension_version: extensionVersion,
        p_browser_info: browserInfo
      };

      try {
        const endpoint = `${supabaseUrl}/rest/v1/rpc/submit_feedback`;
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
          },
          body: JSON.stringify(rpcPayload)
        });

        if (!response.ok) {
          const errText = await response.text();
          let parsedErr;
          try {
            parsedErr = JSON.parse(errText);
          } catch (_) {}
          const errMsg = (parsedErr && (parsedErr.message || parsedErr.error)) || `Erro HTTP ${response.status}: ${errText}`;
          return { success: false, error: errMsg };
        }

        const result = await response.json();
        if (result && result.success === false) {
          return { success: false, error: result.error || 'Falha ao processar feedback.' };
        }

        return {
          success: true,
          message: (result && result.message) || 'Feedback enviado com sucesso! Obrigado por colaborar.',
          reportId: result && result.report_id
        };
      } catch (err) {
        return {
          success: false,
          error: err && err.message ? err.message : 'Falha na conexão de rede.'
        };
      }
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FeedbackService };
  }

  global.FeedbackService = FeedbackService;

})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : this)));
