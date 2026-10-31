import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const maxDuration = 15;

const TTL_S = 4 * 3600; // cobre o limite de 4 h de gravação (SPEC 1)

/**
 * Emite uma chave TEMPORÁRIA do Deepgram para o navegador abrir o WebSocket da
 * transcrição ao vivo. A chave-mestra (DEEPGRAM_API_KEY) nunca sai do servidor;
 * a temporária tem escopo mínimo (usage:write) e expira sozinha.
 */
export async function POST() {
  const master = process.env.DEEPGRAM_API_KEY;
  if (!master) {
    return NextResponse.json({ error: 'Transcrição ao vivo indisponível.' }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

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
      comment: `talkin-live ${user.id.slice(0, 8)}`,
      scopes: ['usage:write'],
      time_to_live_in_seconds: TTL_S,
    }),
  });
  if (!keyRes.ok) return NextResponse.json({ error: 'Falha no provedor.' }, { status: 502 });
  const { key } = (await keyRes.json()) as { key?: string };
  if (!key) return NextResponse.json({ error: 'Falha no provedor.' }, { status: 502 });

  return NextResponse.json({ key, expiresIn: TTL_S });
}
