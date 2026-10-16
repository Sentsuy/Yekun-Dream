// Chama uma RPC do Supabase usando a service_role key.
// A service_role bypassa RLS, então use só do lado servidor.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

export async function callRpc<T = unknown>(fnName: string, params: Record<string, unknown>): Promise<T> {
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    throw new Error('Supabase env vars (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY) ausentes');
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fnName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_ROLE,
      'Authorization': `Bearer ${SERVICE_ROLE}`,
    },
    body: JSON.stringify(params),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`RPC ${fnName} HTTP ${res.status}: ${text}`);
  }
  try {
    return text ? JSON.parse(text) as T : (null as unknown as T);
  } catch {
    return text as unknown as T;
  }
}
