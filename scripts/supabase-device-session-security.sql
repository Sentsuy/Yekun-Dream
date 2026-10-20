-- ══════════════════════════════════════════════════════════════════════════
-- Yekun Dream — Device Session Tokens & Anti-Scraping Protection
-- ══════════════════════════════════════════════════════════════════════════

-- ── 1. Tabela de Sessões Autorizadas por Dispositivo ───────────────────────
CREATE TABLE IF NOT EXISTS device_sessions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         TEXT NOT NULL,
    device_token  TEXT NOT NULL UNIQUE,
    created_at    BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
    last_used_at  BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint
);

CREATE INDEX IF NOT EXISTS idx_device_sessions_lookup ON device_sessions(email, device_token);
ALTER TABLE device_sessions ENABLE ROW LEVEL SECURITY;
-- Sem políticas públicas: acesso exclusivo via funções SECURITY DEFINER

-- ── 2. Função de Validação Estrita de Sincronização ────────────────────────
CREATE OR REPLACE FUNCTION is_authorized_sync(p_sync_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    v_token TEXT;
    v_email TEXT;
BEGIN
    v_email := lower(trim(coalesce(p_sync_key, '')));
    IF v_email = '' THEN RETURN FALSE; END IF;

    -- 1. Verifica se a conta é PRO ativa
    IF NOT is_active_pro(v_email) THEN
        RETURN FALSE;
    END IF;

    -- 2. Extrai o token do cabeçalho x-sync-token enviado pela extensão
    BEGIN
        v_token := current_setting('request.headers', true)::json ->> 'x-sync-token';
    EXCEPTION WHEN OTHERS THEN
        v_token := NULL;
    END;

    -- 3. Se não houver sessões cadastradas para este e-mail ainda (transição suave):
    IF NOT EXISTS (SELECT 1 FROM device_sessions WHERE email = v_email) THEN
        RETURN TRUE;
    END IF;

    -- 4. Exige que o token enviado seja válido e pertença a este e-mail
    IF v_token IS NOT NULL AND trim(v_token) != '' THEN
        IF EXISTS (SELECT 1 FROM device_sessions WHERE email = v_email AND device_token = trim(v_token)) THEN
            RETURN TRUE;
        END IF;
    END IF;

    RETURN FALSE;
END;
$$;

GRANT EXECUTE ON FUNCTION is_authorized_sync(TEXT) TO anon, authenticated;

-- ── 3. Atualização das Políticas RLS de 'entries' e 'user_settings' ─────────
DROP POLICY IF EXISTS "Permitir sync apenas para assinantes ativos" ON entries;
CREATE POLICY "Permitir sync apenas para assinantes ativos" ON entries
    FOR ALL TO anon, authenticated
    USING (is_authorized_sync(entries.sync_key))
    WITH CHECK (is_authorized_sync(entries.sync_key));

DROP POLICY IF EXISTS "Permitir leitura user_settings assinantes" ON user_settings;
DROP POLICY IF EXISTS "Permitir gravacao user_settings assinantes" ON user_settings;

CREATE POLICY "Permitir leitura user_settings assinantes" ON user_settings
    FOR SELECT TO anon, authenticated
    USING (is_authorized_sync(user_settings.sync_key));

CREATE POLICY "Permitir gravacao user_settings assinantes" ON user_settings
    FOR ALL TO anon, authenticated
    USING (is_authorized_sync(user_settings.sync_key))
    WITH CHECK (is_authorized_sync(user_settings.sync_key));

-- ── 4. Atualização de verify_totp_login para emitir Device Token ───────────
CREATE OR REPLACE FUNCTION verify_totp_login(
    p_email TEXT,
    p_code  TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_email        TEXT;
    v_code         TEXT;
    v_sub          RECORD;
    v_now          BIGINT;
    v_recent_tries INT;
    v_counter      BIGINT;
    v_secret_bytes BYTEA;
    v_data_bytes   BYTEA;
    v_hmac         BYTEA;
    v_offset       INT;
    v_bin_code     BIGINT;
    v_expected     TEXT;
    v_step         BIGINT;
    v_matched      BOOLEAN := FALSE;
    v_device_token TEXT;
BEGIN
    v_now   := (extract(epoch from now()) * 1000)::bigint;
    v_email := lower(trim(coalesce(p_email, '')));
    v_code  := regexp_replace(coalesce(p_code, ''), '\s+', '', 'g');

    IF v_email = '' OR v_code = '' OR length(v_code) != 6 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Informe o e-mail e o código de 6 dígitos.');
    END IF;

    -- Rate limiting: máx 5 tentativas a cada 10 min
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

    INSERT INTO pin_attempts (identifier, attempted_at) VALUES (v_email, v_now);

    SELECT * INTO v_sub
    FROM subscriptions
    WHERE email = v_email
      AND status = 'active'
      AND valid_until > v_now;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Nenhuma assinatura ativa encontrada.');
    END IF;

    IF coalesce(v_sub.totp_enabled, false) = false OR v_sub.totp_secret IS NULL OR trim(v_sub.totp_secret) = '' THEN
        DELETE FROM pin_attempts WHERE identifier = v_email;
        v_device_token := encode(gen_random_bytes(24), 'hex');
        INSERT INTO device_sessions (email, device_token) VALUES (v_email, v_device_token);
        RETURN jsonb_build_object('success', true, 'totp_enabled', false, 'device_token', v_device_token);
    END IF;

    -- Validação do TOTP usando HMAC-SHA1 com janela de ±1 passo (30s)
    v_secret_bytes := _base32_decode(v_sub.totp_secret);
    v_counter      := floor((v_now / 1000) / 30)::bigint;

    FOR v_step IN (v_counter - 1)..(v_counter + 1) LOOP
        v_data_bytes := _int_to_big_endian_8bytes(v_step);
        v_hmac       := hmac(v_data_bytes, v_secret_bytes, 'sha1');
        v_offset     := (get_byte(v_hmac, 19) & 15);
        v_bin_code   := ((get_byte(v_hmac, v_offset) & 127) << 24)
                      | ((get_byte(v_hmac, v_offset + 1) & 255) << 16)
                      | ((get_byte(v_hmac, v_offset + 2) & 255) << 8)
                      | (get_byte(v_hmac, v_offset + 3) & 255);
        v_expected   := lpad((v_bin_code % 1000000)::text, 6, '0');

        IF v_expected = v_code THEN
            v_matched := TRUE;
            EXIT;
        END IF;
    END LOOP;

    IF v_matched THEN
        DELETE FROM pin_attempts WHERE identifier = v_email;

        v_device_token := encode(gen_random_bytes(24), 'hex');
        INSERT INTO device_sessions (email, device_token) VALUES (v_email, v_device_token);

        RETURN jsonb_build_object(
            'success',      true,
            'email',        v_sub.email,
            'totp_enabled', true,
            'totp_secret',  v_sub.totp_secret,
            'access_pin',   v_sub.access_pin,
            'recovery_key', v_sub.recovery_key,
            'device_token', v_device_token
        );
    END IF;

    RETURN jsonb_build_object('success', false, 'error', 'Código 2FA incorreto ou expirado.');
END;
$$;

GRANT EXECUTE ON FUNCTION verify_totp_login(TEXT, TEXT) TO anon;

-- ── 5. Atualização de verify_pro_access para emitir Device Token ───────────
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
    v_device_token TEXT;
BEGIN
    v_now    := (extract(epoch from now()) * 1000)::bigint;
    v_email  := lower(trim(coalesce(p_email, '')));
    v_secret := trim(coalesce(p_secret, ''));

    IF v_email = '' OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' THEN
        RETURN jsonb_build_object('success', false, 'error', 'E-mail inválido.');
    END IF;

    IF v_secret = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'PIN ou Chave de Recuperação obrigatória.');
    END IF;

    -- Rate limiting: máx 5 tentativas a cada 10 min por e-mail
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

    INSERT INTO pin_attempts (identifier, attempted_at) VALUES (v_email, v_now);

    SELECT * INTO v_sub
    FROM   subscriptions
    WHERE  email = v_email
      AND  status = 'active'
      AND  valid_until > v_now;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Nenhuma assinatura ativa encontrada para este e-mail.');
    END IF;

    IF (v_sub.access_pin IS NOT NULL AND v_sub.access_pin = v_secret)
       OR (v_sub.recovery_key IS NOT NULL AND upper(v_sub.recovery_key) = upper(v_secret)) THEN

        DELETE FROM pin_attempts WHERE identifier = v_email;

        v_device_token := encode(gen_random_bytes(24), 'hex');
        INSERT INTO device_sessions (email, device_token) VALUES (v_email, v_device_token);

        RETURN jsonb_build_object(
            'success',      true,
            'isPro',        true,
            'email',        v_sub.email,
            'validUntil',   v_sub.valid_until,
            'plan',         v_sub.plan,
            'access_pin',   v_sub.access_pin,
            'recovery_key', v_sub.recovery_key,
            'totp_enabled', coalesce(v_sub.totp_enabled, false),
            'device_token', v_device_token
        );
    END IF;

    RETURN jsonb_build_object('success', false, 'error', 'PIN de Acesso ou Chave de Recuperação incorreta.');
END;
$$;

GRANT EXECUTE ON FUNCTION verify_pro_access(TEXT, TEXT) TO anon;

-- ── 6. Atualização de claim_charge_credentials para emitir Device Token ───────
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
    v_device_token TEXT;
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
            v_device_token := encode(gen_random_bytes(24), 'hex');
            INSERT INTO device_sessions (email, device_token) VALUES (v_clean_email, v_device_token);

            RETURN jsonb_build_object(
                'success',      true,
                'isPaid',       true,
                'isPro',        true,
                'email',        v_sub.email,
                'validUntil',   v_sub.valid_until,
                'plan',         v_sub.plan,
                'access_pin',   v_sub.access_pin,
                'recovery_key', v_sub.recovery_key,
                'totp_enabled', coalesce(v_sub.totp_enabled, false),
                'device_token', v_device_token
            );
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', false,
        'isPaid',  false,
        'status',  coalesce(v_req.status, 'unknown'),
        'error',   'Cobrança não confirmada ou pendente de pagamento.'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION claim_charge_credentials(TEXT, TEXT) TO anon;

-- ── 7. RPC get_or_create_device_session para Contas sem 2FA/PIN ─────────────
CREATE OR REPLACE FUNCTION get_or_create_device_session(
    p_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_email        TEXT;
    v_sub          RECORD;
    v_device_token TEXT;
    v_now          BIGINT;
BEGIN
    v_now   := (extract(epoch from now()) * 1000)::bigint;
    v_email := lower(trim(coalesce(p_email, '')));

    IF NOT is_active_pro(v_email) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Assinatura PRO inativa ou inexistente.');
    END IF;

    SELECT * INTO v_sub FROM subscriptions WHERE email = v_email;

    -- Se tiver 2FA ativo, impede token sem validação do 2FA
    IF coalesce(v_sub.totp_enabled, false) = TRUE THEN
        RETURN jsonb_build_object('success', false, 'needsTotp', true, 'error', 'Autenticação 2FA necessária.');
    END IF;

    -- Se tiver PIN configurado, exige validação do PIN
    IF v_sub.access_pin IS NOT NULL AND trim(v_sub.access_pin) != '' THEN
        RETURN jsonb_build_object('success', false, 'needsPin', true, 'error', 'PIN de acesso necessário.');
    END IF;

    v_device_token := encode(gen_random_bytes(24), 'hex');
    INSERT INTO device_sessions (email, device_token) VALUES (v_email, v_device_token);

    RETURN jsonb_build_object(
        'success',      true,
        'email',        v_email,
        'device_token', v_device_token
    );
END;
$$;

GRANT EXECUTE ON FUNCTION get_or_create_device_session(TEXT) TO anon;

-- ── 8. RPC revoke_device_session para Desconectar Dispositivo ────────────────
CREATE OR REPLACE FUNCTION revoke_device_session(p_device_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM device_sessions WHERE device_token = trim(coalesce(p_device_token, ''));
    RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION revoke_device_session(TEXT) TO anon;

-- ── 9. Rate Limiting em check_pro_status contra Enumeração de E-mails ─────────
CREATE OR REPLACE FUNCTION check_pro_status(p_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_email        TEXT;
    v_sub          RECORD;
    v_now          BIGINT;
    v_recent_tries INT;
    v_client_ip    TEXT;
BEGIN
    v_now   := (extract(epoch from now()) * 1000)::bigint;
    v_email := lower(trim(coalesce(p_email, '')));

    IF v_email = '' OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' THEN
        RETURN jsonb_build_object('isPro', false, 'validUntil', 0, 'plan', 'none', 'totp_enabled', false);
    END IF;

    -- Obter IP do cliente via headers
    BEGIN
        v_client_ip := coalesce(
            current_setting('request.headers', true)::json ->> 'cf-connecting-ip',
            current_setting('request.headers', true)::json ->> 'x-real-ip',
            'unknown'
        );
    EXCEPTION WHEN OTHERS THEN
        v_client_ip := 'unknown';
    END;

    -- Rate limiting: máx 30 consultas por minuto por IP para evitar enumeração
    IF v_client_ip != 'unknown' THEN
        SELECT count(*) INTO v_recent_tries
        FROM   pin_attempts
        WHERE  identifier = 'status_' || v_client_ip
          AND  attempted_at > (v_now - 60 * 1000);

        IF v_recent_tries >= 30 THEN
            RETURN jsonb_build_object(
                'isPro', false,
                'validUntil', 0,
                'plan', 'none',
                'totp_enabled', false,
                'error', 'Limite de requisições excedido. Aguarde 1 minuto.'
            );
        END IF;

        INSERT INTO pin_attempts (identifier, attempted_at) VALUES ('status_' || v_client_ip, v_now);
    END IF;

    SELECT status, valid_until, plan, totp_enabled
    INTO   v_sub
    FROM   subscriptions
    WHERE  email = v_email
      AND  status = 'active'
      AND  valid_until > v_now;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('isPro', false, 'validUntil', 0, 'plan', 'none', 'totp_enabled', false);
    END IF;

    RETURN jsonb_build_object(
        'isPro',        true,
        'validUntil',   v_sub.valid_until,
        'plan',         v_sub.plan,
        'totp_enabled', coalesce(v_sub.totp_enabled, false)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION check_pro_status(TEXT) TO anon;

NOTIFY pgrst, 'reload schema';
