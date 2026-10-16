// ════════════════════════════════════════════════════════════════════════
// Yekun Dream — Edge Function: create-pro-charge
//
// Fluxo:
//   1. Extensão POSTa { email } quando usuário clica "Pagar com Pix"
//   2. Chamamos AbacatePay para criar um Pix QR Code de R$ 20,00
//   3. Registramos a solicitação no Supabase via RPC request_activation
//   4. Devolvemos pra extensão: brCode (Copia-e-Cola), QR image, chargeId
//
// Env vars obrigatórias (configure com `supabase secrets set ...`):
//   ABACATEPAY_API_KEY       - sua API key (dev ou prod)
//   ABACATEPAY_BASE_URL      - "https://api.abacatepay.com/v1" (default)
//   SUPABASE_URL             - setada automaticamente pelo Supabase
//   SUPABASE_SERVICE_ROLE_KEY - setada automaticamente pelo Supabase
// ════════════════════════════════════════════════════════════════════════

import { corsHeaders, jsonResponse, handleOptions } from '../_shared/cors.ts';
import { callRpc } from '../_shared/supabase.ts';

const ABACATEPAY_API_KEY = Deno.env.get('ABACATEPAY_API_KEY') ?? '';
const ABACATEPAY_BASE_URL = Deno.env.get('ABACATEPAY_BASE_URL') ?? 'https://api.abacatepay.com/v2';
const PRO_PRICE_CENTS = 2000; // R$ 20,00
const EXPIRES_IN_SEC = 3600;  // 1 hora
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

interface AbacateChargeResponse {
  data?: {
    id?: string;
    amount?: number;
    brCode?: string;
    brCodeBase64?: string;
    status?: string;
    expiresAt?: string;
  };
  error?: string | null;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return handleOptions();
  if (req.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Método não permitido' }, 405);
  }

  if (!ABACATEPAY_API_KEY) {
    return jsonResponse({ success: false, error: 'ABACATEPAY_API_KEY não configurada' }, 500);
  }

  let body: { email?: string; name?: string } = {};
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ success: false, error: 'Body JSON inválido' }, 400);
  }

  const email = String(body.email ?? '').trim().toLowerCase();
  const name = String(body.name ?? '').trim().slice(0, 100) || 'Yekun User';

  if (!email || !EMAIL_REGEX.test(email) || email.length > 254) {
    return jsonResponse({ success: false, error: 'E-mail inválido' }, 400);
  }

  // 1. Cria cobrança Pix transparente na AbacatePay v2
  let charge: AbacateChargeResponse;
  try {
    const abRes = await fetch(`${ABACATEPAY_BASE_URL}/transparents/create`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ABACATEPAY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        method: 'PIX',
        data: {
          amount: PRO_PRICE_CENTS,
          expiresIn: EXPIRES_IN_SEC,
          description: 'Assinatura Yekun Cloud PRO - 365 dias',
          customer: { email, name },
          metadata: { name, email },
        },
      }),
    });
    const abText = await abRes.text();
    if (!abRes.ok) {
      console.error('[create-pro-charge] AbacatePay HTTP', abRes.status, abText);
      return jsonResponse({ success: false, error: `Falha no gateway (${abRes.status})` }, 502);
    }
    charge = JSON.parse(abText);
  } catch (err) {
    console.error('[create-pro-charge] Erro de rede AbacatePay:', err);
    return jsonResponse({ success: false, error: 'Erro de rede ao criar cobrança' }, 502);
  }

  const chargeId = charge?.data?.id;
  const brCode = charge?.data?.brCode;
  if (!chargeId || !brCode) {
    console.error('[create-pro-charge] Resposta AbacatePay sem id/brCode:', charge);
    return jsonResponse({ success: false, error: 'Resposta inválida do gateway' }, 502);
  }

  // 2. Registra solicitação no Supabase (idempotente por chargeId)
  try {
    await callRpc('request_activation', {
      p_email: email,
      p_amount: PRO_PRICE_CENTS / 100,
      p_gateway: 'abacatepay',
      p_gateway_charge_id: chargeId,
    });
  } catch (err) {
    console.error('[create-pro-charge] Falha ao registrar request:', err);
    // Não bloqueia: a cobrança foi criada; o webhook ainda pode aprovar depois
    // porque chamará approve_from_gateway (que exige request existente — então
    // precisamos sinalizar isso de volta pro cliente retentar)
    return jsonResponse({ success: false, error: 'Falha ao registrar solicitação' }, 500);
  }

  return jsonResponse({
    success: true,
    chargeId,
    brCode,
    brCodeBase64: charge?.data?.brCodeBase64 ?? null,
    amount: PRO_PRICE_CENTS / 100,
    expiresAt: charge?.data?.expiresAt ?? null,
  });
});
