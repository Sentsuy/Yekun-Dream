-- ══════════════════════════════════════════════════════════════════════════
-- Yekun Dream — Feed de Feedback, Sugestões & Solicitação de Mapeamento
-- Execute este script no SQL Editor do Supabase (https://supabase.com)
-- ══════════════════════════════════════════════════════════════════════════

-- ── 1. Tabela Principal de Relatos ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feedback_reports (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category            VARCHAR(20) NOT NULL CHECK (category IN ('site_mapping', 'bug_report', 'suggestion')),
    message             VARCHAR(300) NOT NULL,  -- Limite simples e direto de 300 caracteres
    site_url            VARCHAR(300),           -- URL sanitizada
    domain              VARCHAR(100),           -- Ex: 'mangaschan.com', 'animesonline.cc'
    detected_title      VARCHAR(200),           -- Título capturado
    detected_chapter    VARCHAR(50),            -- Capítulo/episódio detectado
    user_email          VARCHAR(150),           -- E-mail opcional para contato
    extension_version   VARCHAR(20) NOT NULL,   -- Ex: '1.2.0'
    browser_info        VARCHAR(150),           -- Ex: 'Chrome 128 / Linux'
    status              VARCHAR(20) NOT NULL DEFAULT 'pending' 
                        CHECK (status IN ('pending', 'in_review', 'mapped', 'resolved', 'rejected')),
    admin_notes         VARCHAR(2000),          -- Anotações internas do desenvolvedor no painel
    created_at          BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
    updated_at          BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint
);

-- Índices para performance e consultas no futuro painel web
CREATE INDEX IF NOT EXISTS idx_feedback_reports_status ON feedback_reports(status);
CREATE INDEX IF NOT EXISTS idx_feedback_reports_category ON feedback_reports(category);
CREATE INDEX IF NOT EXISTS idx_feedback_reports_domain ON feedback_reports(domain);
CREATE INDEX IF NOT EXISTS idx_feedback_reports_created_at ON feedback_reports(created_at DESC);

-- ── 2. Tabela de Rate Limiting ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feedback_rate_limits (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier    VARCHAR(150) NOT NULL,        -- IP ou e-mail normalizado
    submitted_at  BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_feedback_rate_limits_id_time 
    ON feedback_rate_limits(identifier, submitted_at);

-- ── 3. RPC Segura: submit_feedback ────────────────────────────────────────
CREATE OR REPLACE FUNCTION submit_feedback(
    p_category          TEXT,
    p_message           TEXT,
    p_site_url          TEXT    DEFAULT NULL,
    p_detected_title    TEXT    DEFAULT NULL,
    p_detected_chapter  TEXT    DEFAULT NULL,
    p_user_email        TEXT    DEFAULT NULL,
    p_extension_version TEXT    DEFAULT '1.2.0',
    p_browser_info      TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_clean_cat     VARCHAR(20);
    v_clean_msg     VARCHAR(300);
    v_clean_url     VARCHAR(300);
    v_domain        VARCHAR(100);
    v_title         VARCHAR(200);
    v_chapter       VARCHAR(50);
    v_clean_email   VARCHAR(150);
    v_version       VARCHAR(20);
    v_browser       VARCHAR(150);
    v_now           BIGINT;
    v_recent_count  INT;
    v_identifier    VARCHAR(150);
    v_report_id     UUID;
BEGIN
    v_now := (extract(epoch from now()) * 1000)::bigint;
    v_clean_cat := lower(trim(coalesce(p_category, '')));
    
    -- 1. Validação de categoria
    IF v_clean_cat NOT IN ('site_mapping', 'bug_report', 'suggestion') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Categoria inválida.');
    END IF;

    -- 2. Validação e truncamento estrito de mensagem (mínimo 5, máximo 300 chars)
    IF length(trim(coalesce(p_message, ''))) < 5 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Mensagem muito curta (mínimo 5 caracteres).');
    END IF;
    IF length(p_message) > 300 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Mensagem excede o limite permitido de 300 caracteres.');
    END IF;
    v_clean_msg := substr(trim(p_message), 1, 300);

    -- 3. Sanitização e limites de campos secundários contra payloads inflados
    v_clean_url := substr(trim(coalesce(p_site_url, '')), 1, 300);
    v_title := substr(trim(coalesce(p_detected_title, '')), 1, 200);
    v_chapter := substr(trim(coalesce(p_detected_chapter, '')), 1, 50);
    v_clean_email := substr(lower(trim(coalesce(p_user_email, ''))), 1, 150);
    v_version := substr(trim(coalesce(p_extension_version, '1.2.0')), 1, 20);
    v_browser := substr(trim(coalesce(p_browser_info, '')), 1, 150);

    -- 4. Extração e sanitização do domínio
    IF v_clean_url != '' THEN
        v_domain := substr(lower(substring(v_clean_url from '^(?:https?:\/\/)?(?:www\.)?([^\/\?#]+)')), 1, 100);
    END IF;

    -- 5. Rate limiting (máx 5 envios por hora)
    v_identifier := CASE 
        WHEN v_clean_email != '' THEN v_clean_email 
        ELSE 'anon_session' 
    END;

    SELECT count(*) INTO v_recent_count
    FROM   feedback_rate_limits
    WHERE  identifier = v_identifier
      AND  submitted_at > (v_now - 3600000);

    IF v_recent_count >= 5 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error',   'Limite de envios atingido (máx. 5 por hora). Aguarde antes de enviar novamente.'
        );
    END IF;

    INSERT INTO feedback_rate_limits (identifier, submitted_at)
    VALUES (v_identifier, v_now);

    -- 6. Gravação com tipos e tamanhos estritos
    INSERT INTO feedback_reports (
        category, message, site_url, domain, detected_title,
        detected_chapter, user_email, extension_version, browser_info,
        status, created_at, updated_at
    )
    VALUES (
        v_clean_cat, v_clean_msg, NULLIF(v_clean_url, ''), NULLIF(v_domain, ''),
        NULLIF(v_title, ''), NULLIF(v_chapter, ''), NULLIF(v_clean_email, ''),
        v_version, NULLIF(v_browser, ''),
        'pending', v_now, v_now
    )
    RETURNING id INTO v_report_id;

    RETURN jsonb_build_object(
        'success',   true,
        'report_id', v_report_id,
        'message',   'Feedback recebido com sucesso! Obrigado pela colaboração.'
    );
END;
$$;

-- ── 4. RLS e Permissões Seguras ───────────────────────────────────────────
ALTER TABLE feedback_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_rate_limits ENABLE ROW LEVEL SECURITY;

-- Usuários anônimos e autenticados não possuem SELECT na tabela de feedback de outros
-- Podem submeter exclusivamente através da RPC segura submit_feedback
GRANT EXECUTE ON FUNCTION submit_feedback(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION submit_feedback(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
