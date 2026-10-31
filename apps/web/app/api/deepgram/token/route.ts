import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ehUuid } from '@/lib/uuid';

export const maxDuration = 15;

// 1 h: a conexão é autenticada no handshake; se o socket cair, o cliente
// reconecta buscando uma chave nova (não precisa de 4 h de validade).
const TTL_S = 3600;

/**
 * Emite uma chave TEMPORÁRIA do Deepgram para o navegador abrir o WebSocket da
 * transcrição ao vivo. Só para quem pode modificar a gravação informada e
 * enquanto ela está em captura — evita uso da conta fora de uma gravação real.
 * A chave-mestra (DEEPGRAM_API_KEY) nunca sai do servidor; a temporária tem
 * escopo mínimo (usage:write) e expira sozinha.
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

  const headers = { Authorization: `Token ${master}`, 'content-type': 'application/json' };

  const projRes = await fetch('https://api.deepgram.com/v1/projects', { headers });
  if (!projRes.ok) return NextResponse.json({ error: 'Falha no provedor.' }, { status: 502 });
  const { projects } = (await projRes.json()) as { projects?: { project_id: string }[] };
  const projectId = projects?.[0]?.project_id;
  if (!projectId) return NextResponse.json({ error: 'Falha no provedor.' }, { status: 502 });

  const keyRes = await fetch(`https://api.deepgram.com/v1/projects/${projectId}/keys`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      comment: `talkin-live ${recordingId.slice(0, 8)}`,
      scopes: ['usage:write'],
      time_to_live_in_seconds: TTL_S,
    }),
  });
  if (!keyRes.ok) return NextResponse.json({ error: 'Falha no provedor.' }, { status: 502 });
  const { key } = (await keyRes.json()) as { key?: string };
  if (!key) return NextResponse.json({ error: 'Falha no provedor.' }, { status: 502 });

  return NextResponse.json({ key, expiresIn: TTL_S });
}
