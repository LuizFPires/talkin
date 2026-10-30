import { NextResponse } from 'next/server';
import { selectProviders } from '@talkin/pipeline';
import type { TrechoContexto } from '@talkin/core';
import { createClient } from '@/lib/supabase/server';
import { responderPergunta, toVectorLiteral } from '@/lib/pergunte';
import { ehUuid } from '@/lib/uuid';

export const maxDuration = 60;

type Trecho = { recording_id: string; recording_title: string; start_ms: number; text: string };

/** "Pergunte" (SPEC 17): responde com base nas gravações, sempre citando. */
export async function POST(request: Request) {
  const { pergunta, recordingId } = (await request.json().catch(() => ({}))) as {
    pergunta?: string;
    recordingId?: string | null;
  };
  if (!pergunta || pergunta.trim().length < 3) {
    return NextResponse.json({ error: 'Pergunta muito curta.' }, { status: 400 });
  }
  if (recordingId && !ehUuid(recordingId)) {
    return NextResponse.json({ error: 'Requisição inválida.' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  // Recupera os trechos mais próximos (RPC respeita o acesso do usuário via RLS).
  const [vec] = await selectProviders().embedding.embed([pergunta]);
  const { data, error } = await supabase.rpc('match_segments', {
    query_embedding: toVectorLiteral(vec!),
    match_count: 8,
    p_recording: recordingId ?? null,
  });
  if (error) return NextResponse.json({ error: 'Falha na busca.' }, { status: 500 });

  const trechos: TrechoContexto[] = ((data as Trecho[] | null) ?? []).map((t) => ({
    recordingId: t.recording_id,
    recordingTitle: t.recording_title,
    startMs: t.start_ms,
    text: t.text,
  }));

  const resposta = await responderPergunta(pergunta, trechos).catch(() => null);
  if (resposta === null)
    return NextResponse.json({ error: 'Falha ao responder.' }, { status: 500 });

  // Não mostra "Fontes" quando a resposta é a recusa (sem fonte efetiva).
  const recusou = resposta.startsWith('Não encontrei isso nas gravações');
  return NextResponse.json({
    resposta,
    citacoes: recusou
      ? []
      : trechos.map((t) => ({
          recordingId: t.recordingId,
          title: t.recordingTitle,
          startMs: t.startMs,
        })),
  });
}
