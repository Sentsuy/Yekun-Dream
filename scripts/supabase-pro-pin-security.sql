-- ══════════════════════════════════════════════════════════════════════════
-- Yekun Dream — Supabase Pro PIN & Recovery Key Patch v2.0
-- Execute este script no SQL Editor do Supabase para atualizar a tabela
-- subscriptions e habilitar a verificação de PIN de 6 dígitos e Chave Mestra.
-- ══════════════════════════════════════════════════════════════════════════

-- 1. Novas colunas na tabela subscriptions
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS access_pin VARCHAR(6);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS recovery_key VARCHAR(19);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS totp_secret TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN DEFAULT FALSE;

-- 2. Helpers internos de geração
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

-- 3. Atualiza approve_from_gateway para gerar e retornar PIN + Recovery Key
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

    IF v_req.status = 'approved' THEN
        SELECT access_pin, recovery_key INTO v_access_pin, v_recovery_key
        FROM subscriptions WHERE id = v_req.subscription_id;
        RETURN jsonb_build_object(
            'success',          true,
            'already_approved', true,
            'email',            v_req.email,
            'subscription_id',  v_req.subscription_id,
            'access_pin',       v_access_pin,
            'recovery_key',     v_recovery_key
        );
    END IF;

    IF v_req.status IN ('rejected', 'expired') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Solicitação ' || v_req.status || ' — reabrir não permitido.');
    END IF;

    v_pin := _generate_unique_pin();

    INSERT INTO activation_pins (pin, is_redeemed, redeemed_by_email, redeemed_at, valid_duration_days, created_at)
    VALUES (v_pin, true, v_req.email, v_now, v_days, v_now);

    v_access_pin := _generate_6digit_pin();
    v_recovery_key := _generate_recovery_key();

    SELECT CASE
        WHEN valid_until > v_now THEN valid_until + (v_days::bigint * 86400000)
        ELSE v_now + (v_days::bigint * 86400000)
    END INTO v_new_valid_until
    FROM subscriptions
    WHERE email = v_req.email;

    IF v_new_valid_until IS NULL THEN
        v_new_valid_until := v_now + (v_days::bigint * 86400000);
    END IF;

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

-- 4. RPC verify_pro_access: validação em novos dispositivos
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

GRANT EXECUTE ON FUNCTION verify_pro_access(TEXT, TEXT) TO anon;
