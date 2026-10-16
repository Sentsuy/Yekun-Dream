const fs = require('fs');
const path = require('path');
const assert = require('assert');

const sqlPath = path.resolve(__dirname, '../scripts/supabase-feedback-setup.sql');
assert.ok(fs.existsSync(sqlPath), 'scripts/supabase-feedback-setup.sql deve existir');

const sql = fs.readFileSync(sqlPath, 'utf8');

// 1. Tabelas
assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS feedback_reports'), 'Deve criar tabela feedback_reports');
assert.ok(/message\s+VARCHAR\(300\)\s+NOT NULL/i.test(sql), 'Mensagem deve ser VARCHAR(300) NOT NULL');
assert.ok(/category\s+VARCHAR\(20\)/i.test(sql), 'Categoria deve ser VARCHAR(20)');
assert.ok(/status\s+VARCHAR\(20\)\s+NOT NULL\s+DEFAULT\s+'pending'/i.test(sql), 'Status default deve ser pending');
assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS feedback_rate_limits'), 'Deve criar tabela feedback_rate_limits');

// 2. RPC submit_feedback
assert.ok(/CREATE OR REPLACE FUNCTION submit_feedback/.test(sql), 'Deve criar funcao RPC submit_feedback');
assert.ok(sql.includes('SECURITY DEFINER'), 'submit_feedback deve ser SECURITY DEFINER');

// 3. Validação de tamanho no back-end
assert.ok(sql.includes('length(p_message) > 300') || sql.includes('length(trim(coalesce(p_message, \'\'))) > 300'),
  'Deve rejeitar mensagens com mais de 300 caracteres');
assert.ok(sql.includes('< 5'), 'Deve rejeitar mensagens com menos de 5 caracteres');
assert.ok(sql.includes('substr(trim(p_message), 1, 300)'), 'Deve truncar mensagem defensivamente para 300 caracteres');

// 4. Rate-limit e RLS
assert.ok(sql.includes('v_recent_count >= 5'), 'Deve limitar a 5 envios por hora');
assert.ok(sql.includes('ALTER TABLE feedback_reports ENABLE ROW LEVEL SECURITY'), 'Deve habilitar RLS em feedback_reports');
assert.ok(/GRANT EXECUTE ON FUNCTION submit_feedback.*TO anon/i.test(sql.replace(/\s+/g, ' ')),
  'Deve conceder permissao de execucao para anon');

console.log('✓ test-supabase-feedback-sql passed');
process.exit(0);
