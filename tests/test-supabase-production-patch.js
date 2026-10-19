const fs = require('fs');
const path = require('path');
const assert = require('assert');

const sqlPath = path.resolve(__dirname, '../scripts/supabase-pro-production-patch.sql');
assert.ok(fs.existsSync(sqlPath), 'scripts/supabase-pro-production-patch.sql deve existir');

const sql = fs.readFileSync(sqlPath, 'utf8');

// 1. Colunas de segurança
assert.ok(sql.includes('ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS access_pin VARCHAR(6)'),
  'Deve adicionar coluna access_pin na tabela subscriptions');
assert.ok(sql.includes('ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS recovery_key VARCHAR(19)'),
  'Deve adicionar coluna recovery_key na tabela subscriptions');
assert.ok(sql.includes('ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS totp_secret TEXT'),
  'Deve adicionar coluna totp_secret na tabela subscriptions');

// 2. RPCs
assert.ok(sql.includes('CREATE OR REPLACE FUNCTION approve_from_gateway'),
  'Deve declarar approve_from_gateway');
assert.ok(sql.includes('CREATE OR REPLACE FUNCTION claim_charge_credentials'),
  'Deve declarar claim_charge_credentials');
assert.ok(sql.includes('CREATE OR REPLACE FUNCTION verify_pro_access'),
  'Deve declarar verify_pro_access');
assert.ok(sql.includes('CREATE OR REPLACE FUNCTION simulate_dev_payment'),
  'Deve declarar simulate_dev_payment');
assert.ok(sql.includes('CREATE OR REPLACE FUNCTION set_totp_security'),
  'Deve declarar set_totp_security');
assert.ok(sql.includes('CREATE OR REPLACE FUNCTION verify_totp_login'),
  'Deve declarar verify_totp_login');

// 3. Segurança estrita de grants
assert.ok(/REVOKE EXECUTE ON FUNCTION approve_from_gateway.*FROM anon/i.test(sql.replace(/\s+/g, ' ')),
  'Deve revogar approve_from_gateway para anon');
assert.ok(/GRANT EXECUTE ON FUNCTION approve_from_gateway.*TO service_role/i.test(sql.replace(/\s+/g, ' ')),
  'Deve conceder approve_from_gateway para service_role');
assert.ok(/GRANT EXECUTE ON FUNCTION claim_charge_credentials.*TO anon/i.test(sql.replace(/\s+/g, ' ')),
  'Deve conceder claim_charge_credentials para anon');
assert.ok(/GRANT EXECUTE ON FUNCTION verify_pro_access.*TO anon/i.test(sql.replace(/\s+/g, ' ')),
  'Deve conceder verify_pro_access para anon');
assert.ok(/GRANT EXECUTE ON FUNCTION set_totp_security.*TO anon/i.test(sql.replace(/\s+/g, ' ')),
  'Deve conceder set_totp_security para anon');
assert.ok(/GRANT EXECUTE ON FUNCTION verify_totp_login.*TO anon/i.test(sql.replace(/\s+/g, ' ')),
  'Deve conceder verify_totp_login para anon');

console.log('✓ test-supabase-production-patch passed');
process.exit(0);
