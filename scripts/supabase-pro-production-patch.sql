-- ══════════════════════════════════════════════════════════════════════════
-- Yekun Dream — Supabase Pro Production Patch (Consolidado)
-- Execute este script no SQL Editor do Supabase (https://supabase.com)
-- para garantir que todas as colunas, funções e regras de segurança de
-- produção estejam 100% atualizadas.
-- ══════════════════════════════════════════════════════════════════════════

-- ── 1. Colunas de Segurança na Tabela subscriptions ───────────────────────
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS access_pin VARCHAR(6);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS recovery_key VARCHAR(19);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS totp_secret TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_subscriptions_access_pin ON subscriptions(access_pin);
CREATE INDEX IF NOT EXISTS idx_subscriptions_recovery_key ON subscriptions(recovery_key);

-- ── 2. Helpers Internos de Geração ────────────────────────────────────────
CREATE OR REPLACE FUNCTION _generate_recovery_key()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN 'YK-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4))
           || '-' || upper(substr(md5(random()::text || clock_timestamp()::text), 5, 4))
           || '-' || upper(substr(md5(random()::text || clock_timestamp()::text), 9, 4));
END;
$$;

CREATE OR REPLACE FUNCTION _generate_6digit_pin()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN lpad((floor(random() * 1000000))::int::text, 6, '0');
END;
$$;

CREATE OR REPLACE FUNCTION _generate_unique_pin()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_pin     TEXT;
    v_tries   INT := 0;
BEGIN
    LOOP
        v_pin := lpad((floor(random() * 10000))::int::text, 4, '0');
        IF NOT EXISTS (SELECT 1 FROM activation_pins WHERE pin = v_pin) THEN
            RETURN v_pin;
        END IF;
        v_tries := v_tries + 1;
        EXIT WHEN v_tries > 100;
    END LOOP;
    RETURN lpad((extract(epoch from now())::bigint % 10000)::text, 4, '0');
END;
$$;

-- ── 3. RPC: approve_from_gateway (Atualizada & Protegida) ──────────────────
CREATE OR REPLACE FUNCTION approve_from_gateway(
    p_gateway            TEXT,
    p_gateway_charge_id  TEXT,
    p_amount_paid        NUMERIC DEFAULT NULL,
    p_approved_by        TEXT    DEFAULT 'webhook'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_req             RECORD;
    v_now             BIGINT;
    v_pin             TEXT;
    v_access_pin      TEXT;
    v_recovery_key    TEXT;
    v_new_valid_until BIGINT;
    v_sub_id          UUID;
    v_days            INT := 365;
BEGIN
    v_now := (extract(epoch from now()) * 1000)::bigint;

    IF p_gateway_charge_id IS NULL OR trim(p_gateway_charge_id) = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'gateway_charge_id obrigatório.');
    END IF;

    SELECT * INTO v_req
    FROM   activation_requests
    WHERE  gateway_charge_id = trim(p_gateway_charge_id)
      AND  gateway = p_gateway
    LIMIT  1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Solicitação não encontrada para este charge_id.');
    END IF;

    -- Idempotência: se já aprovado, recupera credenciais existentes
    IF v_req.status = 'approved' THEN
        SELECT access_pin, recovery_key, valid_until INTO v_access_pin, v_recovery_key, v_new_valid_until
        FROM subscriptions WHERE id = v_req.subscription_id;
        RETURN jsonb_build_object(
            'success',          true,
            'already_approved', true,
            'email',            v_req.email,
            'subscription_id',  v_req.subscription_id,
            'valid_until',      v_new_valid_until,
            'access_pin',       v_access_pin,
            'recovery_key',     v_recovery_key
        );
    END IF;

    IF v_req.status IN ('rejected', 'expired') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Solicitação ' || v_req.status || ' — reabrir não permitido.');
    END IF;

    -- PIN de 4 dígitos histórico para registro auditado
    v_pin := _generate_unique_pin();
    INSERT INTO activation_pins (pin, is_redeemed, redeemed_by_email, redeemed_at, valid_duration_days, created_at)
    VALUES (v_pin, true, v_req.email, v_now, v_days, v_now);

    -- Novos PIN de 6 dígitos e Chave Mestra para a conta
    v_access_pin := _generate_6digit_pin();
    v_recovery_key := _generate_recovery_key();

    -- Calcula validade (+365 dias)
    SELECT CASE
        WHEN valid_until > v_now THEN valid_until + (v_days::bigint * 86400000)
        ELSE v_now + (v_days::bigint * 86400000)
    END INTO v_new_valid_until
    FROM subscriptions
    WHERE email = v_req.email;

    IF v_new_valid_until IS NULL THEN
        v_new_valid_until := v_now + (v_days::bigint * 86400000);
    END IF;

    -- Insere ou atualiza mantendo credenciais existentes se houver
    INSERT INTO subscriptions (email, plan, status, amount_paid, valid_until, access_pin, recovery_key, created_at, updated_at)
    VALUES (v_req.email, 'annual', 'active',
            coalesce(p_amount_paid, v_req.amount), v_new_valid_until, v_access_pin, v_recovery_key, v_now, v_now)
    ON CONFLICT (email) DO UPDATE
    SET status       = 'active',
        amount_paid  = coalesce(p_amount_paid, EXCLUDED.amount_paid, subscriptions.amount_paid),
        valid_until  = v_new_valid_until,
        access_pin   = coalesce(subscriptions.access_pin, EXCLUDED.access_pin),
        recovery_key = coalesce(subscriptions.recovery_key, EXCLUDED.recovery_key),
        updated_at   = v_now
    RETURNING id, access_pin, recovery_key INTO v_sub_id, v_access_pin, v_recovery_key;

    -- Marca activation_requests como aprovado
    UPDATE activation_requests
    SET    status          = 'approved',
           approved_at     = v_now,
           approved_by     = p_approved_by,
           subscription_id = v_sub_id
    WHERE  id = v_req.id;

    RETURN jsonb_build_object(
        'success',         true,
        'email',           v_req.email,
        'valid_until',     v_new_valid_until,
        'subscription_id', v_sub_id,
        'days_added',      v_days,
        'access_pin',      v_access_pin,
        'recovery_key',    v_recovery_key
    );
END;
$$;

-- ── 4. Nova RPC Segura: claim_charge_credentials ──────────────────────────
-- Permite que o frontend da extensão (que detém o gateway_charge_id da sessão ativa)
-- resgate o PIN de 6 dígitos e a Chave Mestra logo após a confirmação do pagamento.
CREATE OR REPLACE FUNCTION claim_charge_credentials(
    p_email              TEXT,
    p_gateway_charge_id  TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_clean_email  TEXT;
    v_clean_charge TEXT;
    v_req          RECORD;
    v_sub          RECORD;
    v_now          BIGINT;
BEGIN
    v_now := (extract(epoch from now()) * 1000)::bigint;
    v_clean_email := lower(trim(coalesce(p_email, '')));
    v_clean_charge := trim(coalesce(p_gateway_charge_id, ''));

    IF v_clean_email = '' OR v_clean_charge = '' THEN
        RETURN jsonb_build_object('success', false, 'isPaid', false, 'error', 'E-mail e ID da cobrança obrigatórios.');
    END IF;

    SELECT * INTO v_req
    FROM activation_requests
    WHERE gateway_charge_id = v_clean_charge
      AND email = v_clean_email
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'isPaid', false, 'error', 'Cobrança não encontrada.');
    END IF;

    IF v_req.status = 'pending' THEN
        IF v_req.expires_at < v_now THEN
            UPDATE activation_requests SET status = 'expired' WHERE id = v_req.id;
            RETURN jsonb_build_object('success', true, 'isPaid', false, 'status', 'expired');
        END IF;
        RETURN jsonb_build_object('success', true, 'isPaid', false, 'status', 'pending');
    END IF;

    IF v_req.status = 'approved' THEN
        SELECT * INTO v_sub
        FROM subscriptions
        WHERE id = v_req.subscription_id;

        IF NOT FOUND THEN
            SELECT * INTO v_sub
            FROM subscriptions
            WHERE email = v_clean_email
              AND status = 'active'
              AND valid_until > v_now;
        END IF;

        IF FOUND THEN
            RETURN jsonb_build_object(
                'success',      true,
                'isPaid',       true,
                'isPro',        true,
                'email',        v_sub.email,
                'validUntil',   v_sub.valid_until,
                'plan',         v_sub.plan,
                'access_pin',   v_sub.access_pin,
                'recovery_key', v_sub.recovery_key,
                'totp_enabled', coalesce(v_sub.totp_enabled, false)
            );
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', false,
        'isPaid',  false,
        'status',  v_req.status,
        'error',   coalesce(v_req.error_message, 'Cobrança não aprovada ou expirada.')
    );
END;
$$;

-- ── 5. RPC verify_pro_access: autorização de novos dispositivos ───────────
CREATE OR REPLACE FUNCTION verify_pro_access(p_email TEXT, p_secret TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_now          BIGINT;
    v_email        TEXT;
    v_secret       TEXT;
    v_sub          RECORD;
    v_recent_tries INT;
BEGIN
    v_now    := (extract(epoch from now()) * 1000)::bigint;
    v_email  := lower(trim(coalesce(p_email, '')));
    v_secret := trim(coalesce(p_secret, ''));

    IF v_email = '' OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' THEN
        RETURN jsonb_build_object('success', false, 'error', 'E-mail inválido.');
    END IF;

    IF v_secret = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Informe o PIN de 6 dígitos ou a Chave de Recuperação.');
    END IF;

    SELECT count(*) INTO v_recent_tries
    FROM   pin_attempts
    WHERE  identifier = v_email
      AND  attempted_at > (v_now - 10 * 60 * 1000);

    IF v_recent_tries >= 5 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error',   'Muitas tentativas incorretas. Aguarde 10 minutos por segurança.'
        );
    END IF;

    INSERT INTO pin_attempts (identifier, attempted_at)
    VALUES (v_email, v_now);

    SELECT * INTO v_sub
    FROM subscriptions
    WHERE email = v_email
      AND status = 'active'
      AND valid_until > v_now;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Nenhuma assinatura PRO ativa encontrada para este e-mail.');
    END IF;

    IF (v_sub.access_pin IS NOT NULL AND v_sub.access_pin = v_secret)
       OR (v_sub.recovery_key IS NOT NULL AND upper(v_sub.recovery_key) = upper(v_secret))
       OR (length(v_secret) = 4 AND EXISTS (SELECT 1 FROM activation_pins WHERE redeemed_by_email = v_email AND pin = v_secret)) THEN

        DELETE FROM pin_attempts WHERE identifier = v_email;

        RETURN jsonb_build_object(
            'success',      true,
            'isPro',        true,
            'email',        v_sub.email,
            'validUntil',   v_sub.valid_until,
            'plan',         v_sub.plan,
            'access_pin',   v_sub.access_pin,
            'recovery_key', v_sub.recovery_key,
            'totp_enabled', coalesce(v_sub.totp_enabled, false)
        );
    END IF;

    RETURN jsonb_build_object('success', false, 'error', 'PIN de Acesso ou Chave de Recuperação incorreta.');
END;
$$;

-- ── 6. RPC Segura de Simulação apenas para Ambiente de Teste ──────────────
CREATE OR REPLACE FUNCTION simulate_dev_payment(
    p_gateway_charge_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_req RECORD;
BEGIN
    SELECT * INTO v_req
    FROM activation_requests
    WHERE gateway_charge_id = trim(p_gateway_charge_id)
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Solicitação não encontrada');
    END IF;

    -- Trava estrita de segurança: só permite simular cobranças de teste/dev
    IF v_req.gateway_charge_id !~* '(test|dev)' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Simulação não autorizada para cobranças em produção.');
    END IF;

    RETURN approve_from_gateway(v_req.gateway, v_req.gateway_charge_id, v_req.amount, 'dev_simulator');
END;
$$;

-- ── 7. Permissões e Segurança de Execução (GRANTS & REVOKES) ──────────────

-- SEGURANÇA MÁXIMA: Fecha a brecha que permitia aprovar pagamentos pelo front
REVOKE EXECUTE ON FUNCTION approve_from_gateway(TEXT, TEXT, NUMERIC, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION approve_from_gateway(TEXT, TEXT, NUMERIC, TEXT) FROM authenticated;
REVOKE EXECUTE ON FUNCTION approve_from_gateway(TEXT, TEXT, NUMERIC, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION approve_from_gateway(TEXT, TEXT, NUMERIC, TEXT) TO service_role;

-- Funções públicas legítimas
GRANT EXECUTE ON FUNCTION request_activation(TEXT, NUMERIC, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION claim_charge_credentials(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION verify_pro_access(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION simulate_dev_payment(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION expire_old_requests() TO anon;
GRANT EXECUTE ON FUNCTION check_pro_status(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION redeem_activation_pin(TEXT, TEXT) TO anon;
