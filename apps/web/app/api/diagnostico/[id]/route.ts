import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ehUuid } from '@/lib/uuid';

export const maxDuration = 15;

/**
 * Diagnóstico de uma gravação para a tela de falha e para suporte: status,
 * transcrições com contagem de trechos, falantes e último erro do pipeline.
 * Usa a sessão do usuário (RLS decide o acesso). Só contagens e metadados —
 * nunca o texto da transcrição.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!ehUuid(id)) return NextResponse.json({ error: 'Requisição inválida.' }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  const { data: rec } = await supabase
    .from('recordings')
    .select('id, status, created_at, deleted_at')
    .eq('id', id)
    .maybeSingle();
  if (!rec) return NextResponse.json({ error: 'Não encontrado.' }, { status: 404 });

  const [{ data: transcripts }, { count: falantes }, { count: blocos }, { data: job }] =
    await Promise.all([
      supabase
        .from('transcripts')
        .select('id, provider, created_at')
        .eq('recording_id', id)
        .order('created_at', { ascending: true }),
      supabase.from('speakers').select('id', { count: 'exact', head: true }).eq('recording_id', id),
      supabase
        .from('recording_chunks')
        .select('id', { count: 'exact', head: true })
        .eq('recording_id', id),
      supabase
        .from('processing_jobs')
        .select('step, status, error, updated_at')
        .eq('recording_id', id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const lista =
    (transcripts as { id: string; provider: string | null; created_at: string }[]) ?? [];
  const transcricoes = await Promise.all(
    lista.map(async (t) => {
      const { count } = await supabase
        .from('segments')
        .select('id', { count: 'exact', head: true })
        .eq('transcript_id', t.id);
      return { provider: t.provider, criadaEm: t.created_at, trechos: count ?? 0 };
    }),
  );

  return NextResponse.json({
    status: rec.status,
    criadaEm: rec.created_at,
    naLixeira: Boolean(rec.deleted_at),
    blocosDeAudio: blocos ?? 0,
    falantes: falantes ?? 0,
    transcricoes,
    ultimoJob: job ?? null,
  });
}
