const fs = require('fs');
const path = require('path');
const assert = require('assert');

const sqlPath = path.resolve(__dirname, '../scripts/supabase-pro-setup.sql');
assert.ok(fs.existsSync(sqlPath), 'Arquivo scripts/supabase-pro-setup.sql deve existir');

const sql = fs.readFileSync(sqlPath, 'utf8');

assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS subscriptions'), 'Deve conter CREATE TABLE subscriptions');
assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS activation_pins'), 'Deve conter CREATE TABLE activation_pins');
assert.ok(sql.includes('CREATE OR REPLACE FUNCTION redeem_activation_pin'), 'Deve conter funcao RPC redeem_activation_pin');
assert.ok(sql.includes('ENABLE ROW LEVEL SECURITY'), 'Deve habilitar Row Level Security');
assert.ok(sql.includes('valid_until'), 'subscriptions deve conter campo valid_until');
assert.ok(sql.includes('pin VARCHAR(4)'), 'activation_pins deve conter campo pin de 4 digitos');

console.log('✓ test-supabase-pro-sql-syntax passed');
process.exit(0);
