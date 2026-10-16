const fs = require('fs');
const path = require('path');
const assert = require('assert');

const fnDir = path.resolve(__dirname, '../supabase/functions');

// 1. Diretórios obrigatórios
assert.ok(fs.existsSync(fnDir), 'supabase/functions/ deve existir');
assert.ok(fs.existsSync(path.join(fnDir, '_shared/cors.ts')), '_shared/cors.ts deve existir');
assert.ok(fs.existsSync(path.join(fnDir, '_shared/supabase.ts')), '_shared/supabase.ts deve existir');
assert.ok(fs.existsSync(path.join(fnDir, 'create-pro-charge/index.ts')), 'create-pro-charge/index.ts deve existir');
assert.ok(fs.existsSync(path.join(fnDir, 'abacatepay-webhook/index.ts')), 'abacatepay-webhook/index.ts deve existir');

// 2. Shared cors
const cors = fs.readFileSync(path.join(fnDir, '_shared/cors.ts'), 'utf8');
assert.ok(cors.includes('corsHeaders'), 'cors.ts deve exportar corsHeaders');
assert.ok(cors.includes('Access-Control-Allow-Origin'), 'cors.ts deve setar CORS');
assert.ok(cors.includes('jsonResponse'), 'cors.ts deve expor helper jsonResponse');
assert.ok(cors.includes('handleOptions'), 'cors.ts deve expor handleOptions');

// 3. Shared supabase client
const sb = fs.readFileSync(path.join(fnDir, '_shared/supabase.ts'), 'utf8');
assert.ok(sb.includes('callRpc'), 'supabase.ts deve exportar callRpc');
assert.ok(sb.includes('SUPABASE_SERVICE_ROLE_KEY'), 'callRpc deve usar service_role key');
assert.ok(sb.includes('/rest/v1/rpc/'), 'callRpc deve chamar REST /rest/v1/rpc/');

// 4. create-pro-charge
const createFn = fs.readFileSync(path.join(fnDir, 'create-pro-charge/index.ts'), 'utf8');
assert.ok(createFn.includes('Deno.serve'), 'create-pro-charge deve usar Deno.serve');
assert.ok(createFn.includes('ABACATEPAY_API_KEY'), 'deve ler ABACATEPAY_API_KEY');
assert.ok(createFn.includes('ABACATEPAY_BASE_URL'), 'deve ler ABACATEPAY_BASE_URL');
assert.ok(createFn.includes('/transparents/create') || createFn.includes('/pixQrCode/create'), 'deve chamar endpoint transparents/create ou pixQrCode/create');
assert.ok(createFn.includes('request_activation'), 'deve registrar via RPC request_activation');
assert.ok(createFn.includes("'abacatepay'"), 'deve usar gateway abacatepay');
assert.ok(createFn.includes('2000') || createFn.includes('PRO_PRICE_CENTS'), 'deve cobrar 2000 centavos (R$20)');
assert.ok(/if\s*\(\s*!email\s*\|\|\s*!EMAIL_REGEX/.test(createFn), 'deve validar email');
assert.ok(createFn.includes('handleOptions'), 'deve tratar preflight OPTIONS');

// 5. abacatepay-webhook
const webhookFn = fs.readFileSync(path.join(fnDir, 'abacatepay-webhook/index.ts'), 'utf8');
assert.ok(webhookFn.includes('Deno.serve'), 'webhook deve usar Deno.serve');
assert.ok(webhookFn.includes('ABACATEPAY_WEBHOOK_SECRET'), 'webhook deve validar segredo');
assert.ok(webhookFn.includes('webhookSecret') && webhookFn.includes('x-abacatepay-secret'),
  'webhook deve aceitar secret via query ou header');
assert.ok(webhookFn.includes('approve_from_gateway'), 'webhook deve chamar approve_from_gateway');
assert.ok(/PAID|APPROVED|billing\.paid/.test(webhookFn), 'webhook deve detectar status pago');
assert.ok(webhookFn.includes('alreadyApproved') || webhookFn.includes('already_approved'),
  'webhook deve retornar flag idempotente');
assert.ok(webhookFn.includes('abacatepay_webhook'), 'webhook deve setar approved_by=abacatepay_webhook');

// 6. Nenhum secret hardcoded (sanity check)
[createFn, webhookFn, sb].forEach((src, i) => {
  assert.ok(!/sk_[a-zA-Z0-9]{10,}/.test(src), `arquivo #${i} não deve conter chave sk_... hardcoded`);
  assert.ok(!/eyJ[A-Za-z0-9_-]{40,}/.test(src), `arquivo #${i} não deve conter JWT hardcoded`);
});

console.log('✓ test-edge-functions-structure passed');
process.exit(0);
