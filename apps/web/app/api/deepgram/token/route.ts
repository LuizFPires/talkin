import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ehUuid } from '@/lib/uuid';

export const maxDuration = 15;

// O token só precisa valer no handshake do WebSocket (a conexão segue aberta
// depois); o cliente busca um novo a cada (re)conexão. Máximo aceito: 3600.
const TTL_S = 120;

/**
 * Emite um access token TEMPORÁRIO do Deepgram (POST /v1/auth/grant) para o
 * navegador abrir o WebSocket da transcrição ao vivo. Diferente de criar chaves
 * (Manage API, que exige papel admin), o grant funciona com uma chave "Member"
 * e devolve um JWT curto com escopo usage::write — a chave-mestra nunca sai do
 * servidor. Só para quem pode modificar a gravação informada e enquanto ela
 * está em captura.
 */
export async function POST(request: Request) {
  const master = process.env.DEEPGRAM_API_KEY;
  if (!master) {
    return NextResponse.json({ error: 'Transcrição ao vivo indisponível.' }, { status: 503 });
  }

  const { recordingId } = (await request.json().catch(() => ({}))) as { recordingId?: string };
  if (!ehUuid(recordingId)) {
    return NextResponse.json({ error: 'Requisição inválida.' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  // Vínculo com uma gravação própria em captura (RLS + can_modify_recording).
  const { data: canModify } = await supabase.rpc('can_modify_recording', { rec: recordingId });
  if (!canModify) return NextResponse.json({ error: 'Não encontrado.' }, { status: 404 });
  const { data: rec } = await supabase
    .from('recordings')
    .select('status')
    .eq('id', recordingId)
    .maybeSingle();
  if (!rec || !['gravando', 'enviando'].includes(rec.status as string)) {
    return NextResponse.json({ error: 'Gravação não está em captura.' }, { status: 409 });
  }

  const res = await fetch('https://api.deepgram.com/v1/auth/grant', {
    method: 'POST',
    headers: { Authorization: `Token ${master}`, 'content-type': 'application/json' },
    body: JSON.stringify({ ttl_seconds: TTL_S }),
  });
  if (!res.ok) {
    return NextResponse.json({ error: 'Falha no provedor.', status: res.status }, { status: 502 });
  }
  const { access_token: token, expires_in: expiresIn } = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!token) return NextResponse.json({ error: 'Falha no provedor.' }, { status: 502 });

  return NextResponse.json({ token, expiresIn: expiresIn ?? TTL_S });
}
