-- ══════════════════════════════════════════════════════════════════════════
-- Yekun Dream — Supabase Production Security Hardening & Audit Fixes
-- ══════════════════════════════════════════════════════════════════════════

-- ── 1. Eliminação de Políticas RLS Permissivas Residuais em 'entries' ─────────
-- Remove as políticas legadas que continham USING (true)
DROP POLICY IF EXISTS "Permitir leitura por sync_key" ON entries;
DROP POLICY IF EXISTS "Permitir inserção e atualização por sync_key" ON entries;
DROP POLICY IF EXISTS "Permitir sync apenas para assinantes ativos" ON entries;

-- Política estrita: apenas assinantes PRO ativos podem ler, gravar e excluir obras onde sync_key = email
CREATE POLICY "Permitir sync apenas para assinantes ativos" ON entries
    FOR ALL TO anon, authenticated
    USING (EXISTS (
        SELECT 1 FROM subscriptions s
        WHERE s.email = entries.sync_key
          AND s.status = 'active'
          AND s.valid_until::numeric > (extract(epoch from now()) * 1000)::numeric
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM subscriptions s
        WHERE s.email = entries.sync_key
          AND s.status = 'active'
          AND s.valid_until::numeric > (extract(epoch from now()) * 1000)::numeric
    ));

-- ── 2. Proteção RLS Estrita em 'user_settings' ──────────────────────────────
DROP POLICY IF EXISTS "Permitir leitura user_settings" ON user_settings;
DROP POLICY IF EXISTS "Permitir leitura user_settings assinantes" ON user_settings;
DROP POLICY IF EXISTS "Permitir gravacao user_settings assinantes" ON user_settings;

CREATE POLICY "Permitir leitura user_settings assinantes" ON user_settings
    FOR SELECT TO anon, authenticated
    USING (EXISTS (
        SELECT 1 FROM subscriptions s
        WHERE s.email = user_settings.sync_key
          AND s.status = 'active'
          AND s.valid_until::numeric > (extract(epoch from now()) * 1000)::numeric
    ));

CREATE POLICY "Permitir gravacao user_settings assinantes" ON user_settings
    FOR ALL TO anon, authenticated
    USING (EXISTS (
        SELECT 1 FROM subscriptions s
        WHERE s.email = user_settings.sync_key
          AND s.status = 'active'
          AND s.valid_until::numeric > (extract(epoch from now()) * 1000)::numeric
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM subscriptions s
        WHERE s.email = user_settings.sync_key
          AND s.status = 'active'
          AND s.valid_until::numeric > (extract(epoch from now()) * 1000)::numeric
    ));

-- ── 3. Revogação de Funções de Teste / Dev em Produção ─────────────────────
REVOKE EXECUTE ON FUNCTION simulate_dev_payment(TEXT) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION simulate_dev_payment(TEXT) TO service_role;

-- ── 4. Revogação de Funções Internas de Geração de Credenciais ─────────────
REVOKE EXECUTE ON FUNCTION _generate_6digit_pin() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION _generate_recovery_key() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION _generate_unique_pin() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION _base32_decode(TEXT) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION _int_to_big_endian_8bytes(BIGINT) FROM anon, authenticated, public;

-- ── 5. RPC set_totp_security Fortificada com Validação Criptográfica e Rate Limiting ──
CREATE OR REPLACE FUNCTION set_totp_security(
    p_email   TEXT,
    p_secret  TEXT,
    p_enabled BOOLEAN,
    p_code    TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_email        TEXT;
    v_code         TEXT;
    v_now          BIGINT;
    v_sub          RECORD;
    v_secret_bytes BYTEA;
    v_data_bytes   BYTEA;
    v_hmac         BYTEA;
    v_offset       INT;
    v_bin_code     BIGINT;
    v_expected     TEXT;
    v_counter      BIGINT;
    v_step         BIGINT;
    v_matched      BOOLEAN := FALSE;
    v_recent_tries INT;
BEGIN
    v_now   := (extract(epoch from now()) * 1000)::bigint;
    v_email := lower(trim(coalesce(p_email, '')));
    v_code  := regexp_replace(coalesce(p_code, ''), '\s+', '', 'g');

    IF v_email = '' OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' THEN
        RETURN jsonb_build_object('success', false, 'error', 'E-mail inválido.');
    END IF;

    -- Rate limiting: máx 5 tentativas por 10 min por e-mail
    SELECT count(*) INTO v_recent_tries
    FROM   pin_attempts
    WHERE  identifier = 'totp_sec_' || v_email
      AND  attempted_at > (v_now - 10 * 60 * 1000);

    IF v_recent_tries >= 5 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Muitas tentativas. Aguarde 10 minutos por segurança.');
    END IF;

    SELECT * INTO v_sub
    FROM subscriptions
    WHERE email = v_email;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Nenhuma assinatura encontrada para este e-mail.');
    END IF;

    -- Se estiver ativando 2FA: exige validação do código gerado pelo segredo
    IF coalesce(p_enabled, false) = TRUE THEN
        IF p_secret IS NULL OR trim(p_secret) = '' THEN
            RETURN jsonb_build_object('success', false, 'error', 'Segredo TOTP ausente.');
        END IF;

        IF v_code = '' OR length(v_code) != 6 THEN
            RETURN jsonb_build_object('success', false, 'error', 'Código de 6 dígitos é obrigatório para ativar o 2FA.');
        END IF;

        -- Validação HMAC-SHA1 do código com o novo segredo
        v_secret_bytes := _base32_decode(trim(p_secret));
        v_counter      := floor((v_now / 1000) / 30)::bigint;

        FOR v_step IN (v_counter - 2)..(v_counter + 2) LOOP
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

        IF NOT v_matched THEN
            INSERT INTO pin_attempts (identifier, attempted_at) VALUES ('totp_sec_' || v_email, v_now);
            RETURN jsonb_build_object('success', false, 'error', 'Código 2FA incorreto ou expirado.');
        END IF;

        UPDATE subscriptions
        SET totp_secret  = trim(p_secret),
            totp_enabled = TRUE,
            updated_at   = v_now
        WHERE email = v_email;

        DELETE FROM pin_attempts WHERE identifier = 'totp_sec_' || v_email;

        RETURN jsonb_build_object('success', true, 'email', v_email, 'totp_enabled', true);
    ELSE
        -- Desativação: se 2FA estava ativo, exige código 2FA atual ou PIN/Recovery Key para autorizar
        IF coalesce(v_sub.totp_enabled, false) = TRUE AND v_sub.totp_secret IS NOT NULL THEN
            IF v_code = '' THEN
                RETURN jsonb_build_object('success', false, 'error', 'Informe o código 2FA atual ou PIN para desativar.');
            END IF;

            -- Testa se o código é o PIN ou Recovery Key
            IF (v_sub.access_pin IS NOT NULL AND v_code = v_sub.access_pin) OR
               (v_sub.recovery_key IS NOT NULL AND upper(v_code) = upper(v_sub.recovery_key)) THEN
                v_matched := TRUE;
            ELSE
                -- Testa TOTP atual
                v_secret_bytes := _base32_decode(v_sub.totp_secret);
                v_counter      := floor((v_now / 1000) / 30)::bigint;

                FOR v_step IN (v_counter - 2)..(v_counter + 2) LOOP
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
            END IF;

            IF NOT v_matched THEN
                INSERT INTO pin_attempts (identifier, attempted_at) VALUES ('totp_sec_' || v_email, v_now);
                RETURN jsonb_build_object('success', false, 'error', 'Código de autorização inválido.');
            END IF;
        END IF;

        UPDATE subscriptions
        SET totp_secret  = NULL,
            totp_enabled = FALSE,
            updated_at   = v_now
        WHERE email = v_email;

        DELETE FROM pin_attempts WHERE identifier = 'totp_sec_' || v_email;

        RETURN jsonb_build_object('success', true, 'email', v_email, 'totp_enabled', false);
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION set_totp_security(TEXT, TEXT, BOOLEAN, TEXT) TO anon;

NOTIFY pgrst, 'reload schema';
