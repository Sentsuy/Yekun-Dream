-- ══════════════════════════════════════════════════════════════════════════
-- Yekun Dream — Fase 2: Solicitações de Ativação & Aprovação via Gateway
-- Aplique este script no Supabase SQL Editor APÓS:
--   • supabase-pro-setup.sql
--   • supabase-security-patch.sql
--
-- Objetivo: suporta o fluxo "pagou via AbacatePay → ativa automaticamente"
-- sem precisar que você gere/envie PIN manualmente. Mantém o PIN como
-- fallback (RPC redeem_activation_pin continua funcionando).
-- ══════════════════════════════════════════════════════════════════════════

-- ── 1. Tabela de solicitações de ativação ─────────────────────────────────
CREATE TABLE IF NOT EXISTS activation_requests (
    id                  UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    email               TEXT    NOT NULL,
    amount              NUMERIC(10, 2) NOT NULL DEFAULT 20.00,
    gateway             TEXT    NOT NULL DEFAULT 'manual',
      -- Valores previstos: 'abacatepay' | 'mercadopago' | 'manual'
    gateway_charge_id   TEXT    UNIQUE,
      -- ID da cobrança no gateway (NULL para 'manual')
    status              TEXT    NOT NULL DEFAULT 'pending',
      -- 'pending' | 'approved' | 'rejected' | 'expired'
    created_at          BIGINT  NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
    expires_at          BIGINT  NOT NULL DEFAULT ((extract(epoch from now()) * 1000)::bigint + 3600000),
      -- Expira em 1 hora por padrão
    approved_at         BIGINT,
    approved_by         TEXT,
      -- 'abacatepay_webhook' | 'manual_admin' | 'telegram_bot' | ...
    subscription_id     UUID    REFERENCES subscriptions(id) ON DELETE SET NULL,
    error_message       TEXT    -- para debug quando rejected
);

CREATE INDEX IF NOT EXISTS idx_activation_requests_email_status
    ON activation_requests (email, status);
CREATE INDEX IF NOT EXISTS idx_activation_requests_gateway_charge
    ON activation_requests (gateway_charge_id)
    WHERE gateway_charge_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activation_requests_pending_expires
    ON activation_requests (status, expires_at)
    WHERE status = 'pending';

ALTER TABLE activation_requests ENABLE ROW LEVEL SECURITY;
-- Nenhuma política pública: acesso só via SECURITY DEFINER RPCs abaixo


-- ── 2. RPC: criar solicitação de ativação ─────────────────────────────────
-- Chamada pela Edge Function quando criar uma cobrança no AbacatePay,
-- ou pelo próprio popup no modo "manual" (sem gateway) para fluxos legados.
-- Idempotente: se já houver pending com mesmo gateway_charge_id, retorna o existente.
CREATE OR REPLACE FUNCTION request_activation(
    p_email              TEXT,
    p_amount             NUMERIC DEFAULT 20.00,
    p_gateway            TEXT    DEFAULT 'manual',
    p_gateway_charge_id  TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_clean_email TEXT;
    v_now         BIGINT;
    v_expires_at  BIGINT;
    v_request_id  UUID;
    v_existing    RECORD;
BEGIN
    v_now := (extract(epoch from now()) * 1000)::bigint;
    v_expires_at := v_now + 3600000; -- 1 hora
    v_clean_email := lower(trim(p_email));

    -- Validações básicas
    IF v_clean_email IS NULL OR v_clean_email = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'E-mail obrigatório.');
    END IF;
    IF v_clean_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Formato de e-mail inválido.');
    END IF;
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Valor inválido.');
    END IF;
    IF p_gateway NOT IN ('abacatepay', 'mercadopago', 'manual') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Gateway desconhecido.');
    END IF;

    -- Idempotência por gateway_charge_id (se fornecido)
    IF p_gateway_charge_id IS NOT NULL AND trim(p_gateway_charge_id) != '' THEN
        SELECT id, status, expires_at INTO v_existing
        FROM   activation_requests
        WHERE  gateway_charge_id = trim(p_gateway_charge_id)
        LIMIT  1;

        IF FOUND THEN
            RETURN jsonb_build_object(
                'success',    true,
                'request_id', v_existing.id,
                'expires_at', v_existing.expires_at,
                'status',     v_existing.status,
                'reused',     true
            );
        END IF;
    END IF;

    -- Cancela pendings anteriores do mesmo e-mail+gateway (housekeeping)
    UPDATE activation_requests
    SET    status = 'expired'
    WHERE  email = v_clean_email
      AND  gateway = p_gateway
      AND  status = 'pending'
      AND  (gateway_charge_id IS NULL OR gateway_charge_id != trim(coalesce(p_gateway_charge_id, '')));

    -- Insere novo request
    INSERT INTO activation_requests (email, amount, gateway, gateway_charge_id, status, created_at, expires_at)
    VALUES (v_clean_email, p_amount, p_gateway,
            NULLIF(trim(coalesce(p_gateway_charge_id, '')), ''),
            'pending', v_now, v_expires_at)
    RETURNING id INTO v_request_id;

    RETURN jsonb_build_object(
        'success',    true,
        'request_id', v_request_id,
        'expires_at', v_expires_at,
        'status',     'pending',
        'reused',     false
    );
END;
$$;


-- ── 3. Helpers internos: geração de PINs e Chaves ─────────────────────────
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
    -- Último recurso: PIN baseado em timestamp (nunca cai aqui normalmente)
    RETURN lpad((extract(epoch from now())::bigint % 10000)::text, 4, '0');
END;
$$;

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


-- ── 4. RPC: aprovar solicitação vinda de gateway (webhook) ────────────────
-- Chamada pela Edge Function do webhook AbacatePay quando confirmar pagamento.
-- Idempotente: 2ª chamada com mesmo charge_id devolve sucesso sem duplicar.
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

    -- Idempotência: já aprovado
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

    -- Gera PIN de ativação auditado em activation_pins
    v_pin := _generate_unique_pin();

    INSERT INTO activation_pins (pin, is_redeemed, redeemed_by_email, redeemed_at, valid_duration_days, created_at)
    VALUES (v_pin, true, v_req.email, v_now, v_days, v_now);

    -- Gera PIN numérico de 6 dígitos e Chave Mestra de Recuperação para a conta
    v_access_pin := _generate_6digit_pin();
    v_recovery_key := _generate_recovery_key();

    -- Calcula nova validade (empilha se já for assinante)
    SELECT CASE
        WHEN valid_until > v_now THEN valid_until + (v_days::bigint * 86400000)
        ELSE v_now + (v_days::bigint * 86400000)
    END INTO v_new_valid_until
    FROM subscriptions
    WHERE email = v_req.email;

    IF v_new_valid_until IS NULL THEN
        v_new_valid_until := v_now + (v_days::bigint * 86400000);
    END IF;

    -- Insere/atualiza assinatura (preserva PIN e Recovery Key se já existiam)
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

    -- Marca request como approved
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


-- ── 5. RPC: verificar acesso PRO com PIN de 6 dígitos ou Chave Mestra ─────
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

    -- Rate limit check (máx 5 tentativas a cada 10 min por e-mail)
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

    -- Registra tentativa
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

    -- Verifica se p_secret é o PIN de 6 dígitos OU a Chave Mestra de Recuperação
    IF (v_sub.access_pin IS NOT NULL AND v_sub.access_pin = v_secret)
       OR (v_sub.recovery_key IS NOT NULL AND upper(v_sub.recovery_key) = upper(v_secret))
       OR (length(v_secret) = 4 AND EXISTS (SELECT 1 FROM activation_pins WHERE redeemed_by_email = v_email AND pin = v_secret)) THEN

        -- Sucesso: limpa tentativas falhas
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


-- ── 6. RPC: housekeeping — expira requests pendentes antigos ──────────────
CREATE OR REPLACE FUNCTION expire_old_requests()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INT;
    v_now   BIGINT;
BEGIN
    v_now := (extract(epoch from now()) * 1000)::bigint;
    UPDATE activation_requests
    SET    status = 'expired'
    WHERE  status = 'pending'
      AND  expires_at < v_now;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;


-- ── 7. Grants: expõe as RPCs ao role anon via REST ────────────────────────
GRANT EXECUTE ON FUNCTION request_activation(TEXT, NUMERIC, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION approve_from_gateway(TEXT, TEXT, NUMERIC, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION verify_pro_access(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION expire_old_requests() TO anon;
-- _generate_unique_pin é interna, não precisa expor

-- ══════════════════════════════════════════════════════════════════════════
-- Fim da Fase 2. Para testar:
--
-- 1. Criar solicitação manual (simula "Já paguei" sem gateway):
--    SELECT request_activation('seu-email@gmail.com', 20.00, 'manual', NULL);
--
-- 2. Aprovar via gateway simulado:
--    SELECT request_activation('seu-email@gmail.com', 20.00, 'abacatepay', 'chg_test_123');
--    SELECT approve_from_gateway('abacatepay', 'chg_test_123', 20.00, 'test_manual');
--
-- 3. Verificar status PRO ativo:
--    SELECT check_pro_status('seu-email@gmail.com');
--
-- 4. Housekeeping:
--    SELECT expire_old_requests();
-- ══════════════════════════════════════════════════════════════════════════
