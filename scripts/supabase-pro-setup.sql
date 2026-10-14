-- ══════════════════════════════════════════════════════════════════════════
-- Yekun Dream — Supabase Pro & Assinaturas Anuais com PIN de 4 Dígitos
-- ══════════════════════════════════════════════════════════════════════════

-- 1. Tabela de Assinaturas (Subscriptions)
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    google_id TEXT,
    plan TEXT NOT NULL DEFAULT 'annual', -- 'annual', 'lifetime'
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'expired', 'canceled'
    amount_paid NUMERIC(10,2) DEFAULT 20.00,
    valid_until BIGINT NOT NULL,          -- Timestamp em milissegundos (epoch)
    created_at BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
    updated_at BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_email ON subscriptions(email);
CREATE INDEX IF NOT EXISTS idx_subscriptions_valid_until ON subscriptions(valid_until);

-- 2. Tabela de Códigos de Ativação (4 Dígitos)
CREATE TABLE IF NOT EXISTS activation_pins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pin VARCHAR(4) UNIQUE NOT NULL,      -- Código de 4 dígitos (ex: '7492')
    is_redeemed BOOLEAN DEFAULT FALSE,    -- Se já foi resgatado
    redeemed_by_email TEXT,              -- E-mail que ativou o PIN
    redeemed_at BIGINT,                  -- Data do resgate
    valid_duration_days INT DEFAULT 365, -- Duração (padrão: 365 dias)
    created_at BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint
);

CREATE INDEX IF NOT EXISTS idx_activation_pins_pin ON activation_pins(pin);

-- 3. Habilitação de RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE activation_pins ENABLE ROW LEVEL SECURITY;

-- 4. Políticas para a tabela de assinaturas
-- Permite leitura de status para qualquer cliente autenticado com a anon key
DROP POLICY IF EXISTS "Permitir consulta de status por email" ON subscriptions;
CREATE POLICY "Permitir consulta de status por email"
ON subscriptions
FOR SELECT
TO anon
USING (true);

-- 5. Função RPC Segura para Resgatar PIN de 4 Dígitos
-- Executa com privilégios de SECURITY DEFINER para atualizar tabelas sem expor chaves públicas
CREATE OR REPLACE FUNCTION redeem_activation_pin(p_pin TEXT, p_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_pin_record RECORD;
    v_new_valid_until BIGINT;
    v_now BIGINT;
    v_clean_email TEXT;
BEGIN
    v_now := (extract(epoch from now()) * 1000)::bigint;
    v_clean_email := lower(trim(p_email));

    IF length(trim(p_pin)) != 4 THEN
        RETURN jsonb_build_object('success', false, 'error', 'O código deve conter exatamente 4 dígitos numéricos.');
    END IF;

    IF v_clean_email IS NULL OR v_clean_email = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'E-mail do usuário não informado.');
    END IF;

    -- Busca o PIN não utilizado
    SELECT * INTO v_pin_record 
    FROM activation_pins 
    WHERE pin = trim(p_pin) AND is_redeemed = false;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Código de 4 dígitos inválido ou já utilizado.');
    END IF;

    -- Calcula nova validade (se já tiver assinatura ativa, soma +365 dias; se não, agora + 365 dias)
    SELECT CASE 
        WHEN valid_until > v_now THEN valid_until + (v_pin_record.valid_duration_days::bigint * 86400000)
        ELSE v_now + (v_pin_record.valid_duration_days::bigint * 86400000)
    END INTO v_new_valid_until
    FROM subscriptions
    WHERE email = v_clean_email;

    IF v_new_valid_until IS NULL THEN
        v_new_valid_until := v_now + (v_pin_record.valid_duration_days::bigint * 86400000);
    END IF;

    -- Marca PIN como utilizado
    UPDATE activation_pins
    SET is_redeemed = true,
        redeemed_by_email = v_clean_email,
        redeemed_at = v_now
    WHERE id = v_pin_record.id;

    -- Insere ou atualiza a assinatura do usuário
    INSERT INTO subscriptions (email, plan, status, amount_paid, valid_until, updated_at)
    VALUES (v_clean_email, 'annual', 'active', 20.00, v_new_valid_until, v_now)
    ON CONFLICT (email) DO UPDATE
    SET status = 'active',
        valid_until = v_new_valid_until,
        updated_at = v_now;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Assinatura Yekun PRO ativada com sucesso!',
        'valid_until', v_new_valid_until,
        'days_added', v_pin_record.valid_duration_days
    );
END;
$$;

-- 6. Atualização de Políticas na Tabela entries (RLS)
-- Garante que apenas assinantes com valid_until no futuro possam sincronizar
DROP POLICY IF EXISTS "Permitir sync apenas para assinantes ativos" ON entries;
DROP POLICY IF EXISTS "Permitir acesso completo via anon key" ON entries;
DROP POLICY IF EXISTS "Permitir sincronização pública" ON entries;

CREATE POLICY "Permitir sync apenas para assinantes ativos"
ON entries
FOR ALL
TO anon
USING (
    EXISTS (
        SELECT 1 FROM subscriptions s
        WHERE s.email = entries.sync_key
          AND s.status = 'active'
          AND s.valid_until > (extract(epoch from now()) * 1000)
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM subscriptions s
        WHERE s.email = entries.sync_key
          AND s.status = 'active'
          AND s.valid_until > (extract(epoch from now()) * 1000)
    )
);
