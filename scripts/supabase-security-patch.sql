-- ══════════════════════════════════════════════════════════════════════════
-- Yekun Dream — Patch de Segurança v1.0 (Auditoria 2026-10)
-- Aplique este script no Supabase SQL Editor após o supabase-pro-setup.sql
--
-- Correções incluídas:
--   C-01: RPC check_pro_status — verificação PRO sem expor tabela ao anon
--   C-02: Remove política SELECT pública de subscriptions (USING true)
--   C-03: Rate limiting no redeem_activation_pin (5 tentativas / 10 min)
-- ══════════════════════════════════════════════════════════════════════════

-- ── C-03: Tabela de rate limiting para PIN ────────────────────────────────
CREATE TABLE IF NOT EXISTS pin_attempts (
    id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier  TEXT    NOT NULL,
    attempted_at BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint
);

CREATE INDEX IF NOT EXISTS idx_pin_attempts_identifier_at
    ON pin_attempts (identifier, attempted_at);

ALTER TABLE pin_attempts ENABLE ROW LEVEL SECURITY;

-- Nenhuma política pública: apenas SECURITY DEFINER pode escrever nesta tabela
-- (acesso só via RPC interna)

-- ── C-02: Remove política SELECT pública de subscriptions ─────────────────
-- Antes: USING (true) → qualquer anon lista TODOS os e-mails de assinantes
DROP POLICY IF EXISTS "Permitir consulta de status por email" ON subscriptions;

-- ── C-01: RPC segura para verificar status PRO sem expor a tabela ─────────
-- O cliente chama esta função em vez de fazer GET /rest/v1/subscriptions
-- A função roda como SECURITY DEFINER (acesso elevado interno) e devolve
-- apenas os campos necessários do e-mail solicitado — nunca listas.
CREATE OR REPLACE FUNCTION check_pro_status(p_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sub      RECORD;
    v_now      BIGINT;
    v_email    TEXT;
BEGIN
    v_now   := (extract(epoch from now()) * 1000)::bigint;
    v_email := lower(trim(p_email));

    IF v_email IS NULL OR v_email = '' THEN
        RETURN jsonb_build_object('isPro', false, 'error', 'E-mail não informado.');
    END IF;

    -- Validação básica de formato de e-mail (evita injeção de strings estranhas)
    IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' THEN
        RETURN jsonb_build_object('isPro', false, 'error', 'Formato de e-mail inválido.');
    END IF;

    SELECT status, valid_until, plan
    INTO   v_sub
    FROM   subscriptions
    WHERE  email = v_email
      AND  status = 'active'
      AND  valid_until > v_now;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('isPro', false, 'validUntil', 0, 'plan', 'none');
    END IF;

    RETURN jsonb_build_object(
        'isPro',      true,
        'validUntil', v_sub.valid_until,
        'plan',       v_sub.plan
    );
END;
$$;

-- ── C-03: Substitui redeem_activation_pin com rate limiting ──────────────
CREATE OR REPLACE FUNCTION redeem_activation_pin(p_pin TEXT, p_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_pin_record      RECORD;
    v_new_valid_until BIGINT;
    v_now             BIGINT;
    v_clean_email     TEXT;
    v_attempts        INT;
BEGIN
    v_now         := (extract(epoch from now()) * 1000)::bigint;
    v_clean_email := lower(trim(p_email));

    -- Validações básicas
    IF length(trim(p_pin)) != 4 OR trim(p_pin) !~ '^\d{4}$' THEN
        RETURN jsonb_build_object('success', false, 'error', 'O código deve conter exatamente 4 dígitos numéricos.');
    END IF;

    IF v_clean_email IS NULL OR v_clean_email = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'E-mail do usuário não informado.');
    END IF;

    IF v_clean_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Formato de e-mail inválido.');
    END IF;

    -- ── Rate limiting: máx 5 tentativas por e-mail em 10 minutos ──────────
    SELECT COUNT(*) INTO v_attempts
    FROM   pin_attempts
    WHERE  identifier    = v_clean_email
      AND  attempted_at  > (v_now - 600000);  -- 10 minutos em ms

    IF v_attempts >= 5 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error',   'Muitas tentativas. Aguarde 10 minutos antes de tentar novamente.'
        );
    END IF;

    -- Registra a tentativa (antes de validar o PIN, para contar tentativas inválidas)
    INSERT INTO pin_attempts (identifier, attempted_at)
    VALUES (v_clean_email, v_now);

    -- Limpa tentativas antigas deste e-mail (> 1 hora) para não acumular
    DELETE FROM pin_attempts
    WHERE  identifier   = v_clean_email
      AND  attempted_at < (v_now - 3600000);

    -- Busca o PIN não utilizado
    SELECT * INTO v_pin_record
    FROM   activation_pins
    WHERE  pin = trim(p_pin) AND is_redeemed = false;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Código de 4 dígitos inválido ou já utilizado.');
    END IF;

    -- Calcula nova validade
    SELECT CASE
        WHEN valid_until > v_now
            THEN valid_until + (v_pin_record.valid_duration_days::bigint * 86400000)
        ELSE v_now         + (v_pin_record.valid_duration_days::bigint * 86400000)
    END INTO v_new_valid_until
    FROM subscriptions
    WHERE email = v_clean_email;

    IF v_new_valid_until IS NULL THEN
        v_new_valid_until := v_now + (v_pin_record.valid_duration_days::bigint * 86400000);
    END IF;

    -- Marca PIN como utilizado
    UPDATE activation_pins
    SET    is_redeemed      = true,
           redeemed_by_email = v_clean_email,
           redeemed_at      = v_now
    WHERE  id = v_pin_record.id;

    -- Insere ou atualiza a assinatura
    INSERT INTO subscriptions (email, plan, status, amount_paid, valid_until, updated_at)
    VALUES (v_clean_email, 'annual', 'active', 20.00, v_new_valid_until, v_now)
    ON CONFLICT (email) DO UPDATE
    SET status     = 'active',
        valid_until = v_new_valid_until,
        updated_at  = v_now;

    -- Resgate bem-sucedido: remove as tentativas deste e-mail para resetar o contador
    DELETE FROM pin_attempts WHERE identifier = v_clean_email;

    RETURN jsonb_build_object(
        'success',    true,
        'message',    'Assinatura Yekun PRO ativada com sucesso!',
        'valid_until', v_new_valid_until,
        'days_added', v_pin_record.valid_duration_days
    );
END;
$$;
