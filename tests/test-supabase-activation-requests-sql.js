const fs = require('fs');
const path = require('path');
const assert = require('assert');

const sqlPath = path.resolve(__dirname, '../scripts/supabase-pro-activation-requests.sql');
assert.ok(fs.existsSync(sqlPath), 'scripts/supabase-pro-activation-requests.sql deve existir');

const sql = fs.readFileSync(sqlPath, 'utf8');

// 1. Estrutura da tabela
assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS activation_requests'),
  'Deve criar tabela activation_requests');
assert.ok(/email\s+TEXT\s+NOT NULL/i.test(sql),
  'Tabela deve ter coluna email NOT NULL');
assert.ok(/amount\s+NUMERIC\(10,\s*2\)/i.test(sql),
  'Tabela deve ter coluna amount NUMERIC(10,2)');
assert.ok(/gateway\s+TEXT\s+NOT NULL/i.test(sql),
  'Tabela deve ter coluna gateway NOT NULL');
assert.ok(/gateway_charge_id\s+TEXT\s+UNIQUE/i.test(sql),
  'Tabela deve ter coluna gateway_charge_id UNIQUE');
assert.ok(/status\s+TEXT\s+NOT NULL\s+DEFAULT\s+'pending'/i.test(sql),
  'Tabela deve ter status default pending');
assert.ok(sql.includes('subscription_id'),
  'Tabela deve ter coluna subscription_id');
assert.ok(sql.includes('expires_at'),
  'Tabela deve ter coluna expires_at');

// 2. RLS
assert.ok(sql.includes('ALTER TABLE activation_requests ENABLE ROW LEVEL SECURITY'),
  'activation_requests deve habilitar RLS');

// 3. Índices essenciais
assert.ok(sql.includes('idx_activation_requests_email_status'),
  'Deve criar índice email_status');
assert.ok(sql.includes('idx_activation_requests_gateway_charge'),
  'Deve criar índice gateway_charge');

// 4. RPCs declaradas
assert.ok(/CREATE OR REPLACE FUNCTION request_activation/.test(sql),
  'Deve declarar RPC request_activation');
assert.ok(/CREATE OR REPLACE FUNCTION approve_from_gateway/.test(sql),
  'Deve declarar RPC approve_from_gateway');
assert.ok(/CREATE OR REPLACE FUNCTION expire_old_requests/.test(sql),
  'Deve declarar RPC expire_old_requests');
assert.ok(/CREATE OR REPLACE FUNCTION _generate_unique_pin/.test(sql),
  'Deve declarar helper _generate_unique_pin');

// 5. Todas as RPCs são SECURITY DEFINER (importante para contornar RLS)
const rpcBlocks = sql.match(/CREATE OR REPLACE FUNCTION[\s\S]+?\$\$;/g) || [];
assert.ok(rpcBlocks.length >= 4, `Deve ter >=4 RPCs, encontrou ${rpcBlocks.length}`);
rpcBlocks.forEach((block, i) => {
  assert.ok(block.includes('SECURITY DEFINER'),
    `RPC #${i + 1} deve ser SECURITY DEFINER`);
});

// 6. Validações de segurança dentro das RPCs
assert.ok(sql.includes("'^[^@\\s]+@[^@\\s]+\\.[^@\\s]{2,}$'"),
  'request_activation deve validar formato de e-mail');
assert.ok(/p_gateway\s+NOT IN\s*\(\s*'abacatepay',\s*'mercadopago',\s*'manual'/i.test(sql),
  'request_activation deve validar lista de gateways permitidos');

// 7. Idempotência do approve_from_gateway (importante p/ webhooks duplicados)
assert.ok(/already_approved/.test(sql),
  'approve_from_gateway deve retornar already_approved em caso de reprocessamento');

// 8. Grants ao role anon (as RPCs precisam ser chamadas pela REST)
assert.ok(/GRANT EXECUTE ON FUNCTION request_activation.*TO anon/i.test(sql.replace(/\s+/g, ' ')),
  'Deve grantar EXECUTE em request_activation para anon');
assert.ok(/GRANT EXECUTE ON FUNCTION approve_from_gateway.*TO anon/i.test(sql.replace(/\s+/g, ' ')),
  'Deve grantar EXECUTE em approve_from_gateway para anon');

// 9. Idempotency por gateway_charge_id em request_activation
assert.ok(/gateway_charge_id\s*=\s*trim\(p_gateway_charge_id\)/.test(sql),
  'request_activation deve procurar por gateway_charge_id existente antes de inserir');

// 10. approve_from_gateway cria PIN + subscription + atualiza request atomicamente
const approveBlock = sql.match(/CREATE OR REPLACE FUNCTION approve_from_gateway[\s\S]+?\$\$;/);
assert.ok(approveBlock, 'Bloco approve_from_gateway encontrado');
const body = approveBlock[0];
assert.ok(body.includes('INSERT INTO activation_pins'),
  'approve_from_gateway deve inserir em activation_pins');
assert.ok(body.includes('INSERT INTO subscriptions'),
  'approve_from_gateway deve inserir/atualizar subscriptions');
assert.ok(body.includes('UPDATE activation_requests'),
  'approve_from_gateway deve atualizar activation_requests');
assert.ok(body.includes("'approved'"),
  'approve_from_gateway deve marcar status como approved');

console.log('✓ test-supabase-activation-requests-sql passed');
process.exit(0);
