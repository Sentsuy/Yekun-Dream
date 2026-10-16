// ════════════════════════════════════════════════════════════════════════
// Yekun Dream — Edge Function: abacatepay-webhook
//
// Recebe POSTs da AbacatePay quando um pagamento muda de status.
// Quando status for 'PAID' ou evento 'billing.paid', chama a RPC
// approve_from_gateway no Supabase para gerar PIN, criar/estender
// subscription e marcar o request como approved — tudo atomicamente.
//
// Segurança:
//   • AbacatePay envia o segredo via query string ?webhookSecret=xxx
//     ou header. Validamos ambos antes de aceitar o payload.
//
// Env vars obrigatórias:
//   ABACATEPAY_WEBHOOK_SECRET - segredo configurado no painel AbacatePay
//   SUPABASE_URL              - automático
//   SUPABASE_SERVICE_ROLE_KEY - automático
// ════════════════════════════════════════════════════════════════════════

import { corsHeaders, jsonResponse, handleOptions } from '../_shared/cors.ts';
import { callRpc } from '../_shared/supabase.ts';

const WEBHOOK_SECRET = Deno.env.get('ABACATEPAY_WEBHOOK_SECRET') ?? '';

interface AbacateWebhookPayload {
  event?: string;
  data?: {
    billing?: {
      id?: string;
      amount?: number;
      status?: string;
    };
    payment?: {
      id?: string;
      amount?: number;
      status?: string;
    };
    pixQrCode?: {
      id?: string;
      amount?: number;
      status?: string;
    };
  };
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return handleOptions();
  if (req.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Método não permitido' }, 405);
  }

  if (!WEBHOOK_SECRET) {
    console.error('[webhook] ABACATEPAY_WEBHOOK_SECRET não configurado');
    return jsonResponse({ success: false, error: 'Webhook não configurado' }, 500);
  }

  // 1. Valida segredo (query ou header)
  const url = new URL(req.url);
  const querySecret = url.searchParams.get('webhookSecret');
  const headerSecret = req.headers.get('x-abacatepay-secret') ?? '';
  const providedSecret = querySecret || headerSecret;

  if (providedSecret !== WEBHOOK_SECRET) {
    console.warn('[webhook] Secret inválido. Rejeitado.');
    return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
  }

  // 2. Parse payload
  let payload: AbacateWebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ success: false, error: 'Payload JSON inválido' }, 400);
  }

  console.log('[webhook] Evento recebido:', payload.event, JSON.stringify(payload.data));

  // 3. Extrai charge_id e status do payload (aceita v1, v2 e transparent)
  const rawData = payload?.data as Record<string, any> | undefined;
  const chargeData =
    rawData?.billing ??
    rawData?.payment ??
    rawData?.pixQrCode ??
    rawData?.transparent ??
    (rawData && typeof rawData === 'object' && ('id' in rawData || 'status' in rawData) ? rawData : null);

  const chargeId = chargeData?.id;
  const status = String(chargeData?.status ?? '').toUpperCase();
  const rawAmount = Number(chargeData?.amount);
  // Se amount vier em centavos (>= 100), divide por 100
  const amount = !isNaN(rawAmount) ? (rawAmount >= 100 ? rawAmount / 100 : rawAmount) : null;

  if (!chargeId) {
    return jsonResponse({ success: false, error: 'charge_id ausente no payload' }, 400);
  }

  // 4. Só aprovamos eventos de pagamento confirmado
  const isPaidEvent =
    status === 'PAID' ||
    status === 'APPROVED' ||
    payload.event === 'billing.paid' ||
    payload.event === 'pix.paid' ||
    payload.event === 'transparent.completed' ||
    String(payload.event ?? '').toLowerCase().includes('paid') ||
    String(payload.event ?? '').toLowerCase().includes('completed');

  if (!isPaidEvent) {
    // Evento informacional (expired, pending, etc.) — apenas acusamos recebimento
    console.log('[webhook] Evento ignorado (status != paid):', status, payload.event);
    return jsonResponse({ success: true, ignored: true, status });
  }

  // 5. Aprova via RPC (idempotente)
  try {
    const result = await callRpc<{ success: boolean; email?: string; already_approved?: boolean; error?: string }>(
      'approve_from_gateway',
      {
        p_gateway: 'abacatepay',
        p_gateway_charge_id: chargeId,
        p_amount_paid: amount,
        p_approved_by: 'abacatepay_webhook',
      }
    );

    if (!result?.success) {
      console.error('[webhook] approve_from_gateway falhou:', result?.error);
      return jsonResponse({ success: false, error: result?.error ?? 'Falha ao aprovar' }, 500);
    }

    console.log('[webhook] Ativação OK:', result.email, result.already_approved ? '(já aprovado)' : '(novo)');
    return jsonResponse({
      success: true,
      email: result.email,
      alreadyApproved: !!result.already_approved,
    });
  } catch (err) {
    console.error('[webhook] Erro ao chamar RPC:', err);
    return jsonResponse({ success: false, error: 'Erro interno' }, 500);
  }
});
