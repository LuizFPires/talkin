import { NextResponse } from 'next/server';
import { createAdminClient, hasServiceRole } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { ehUuid } from '@/lib/uuid';

export const maxDuration = 30;

type SegIn = { speaker: number; startMs: number; endMs: number; text: string };

const MAX_LOTE = 200;
const MAX_TEXTO = 4000;

function validar(body: unknown): { recordingId: string; segments: SegIn[] } | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as { recordingId?: unknown; segments?: unknown };
  if (!ehUuid(b.recordingId) || !Array.isArray(b.segments)) return null;
  if (b.segments.length === 0 || b.segments.length > MAX_LOTE) return null;
  const out: SegIn[] = [];
  for (const s of b.segments as unknown[]) {
    if (!s || typeof s !== 'object') return null;
    const { speaker, startMs, endMs, text } = s as Record<string, unknown>;
    if (!Number.isInteger(speaker) || (speaker as number) < 0 || (speaker as number) > 63)
      return null;
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;
    if ((startMs as number) < 0 || (endMs as number) < (startMs as number)) return null;
    if (typeof text !== 'string' || !text.trim() || text.length > MAX_TEXTO) return null;
    out.push({
      speaker: speaker as number,
      startMs: startMs as number,
      endMs: endMs as number,
      text: text.trim(),
    });
  }
  return { recordingId: b.recordingId, segments: out };
}

/** Erro de banco sem conteúdo: código + mensagem curta (para a tela e o suporte). */
function falha(etapa: string, err: { code?: string; message?: string } | null, status = 500) {
  const detalhe = `${etapa}: ${err?.code ?? ''} ${err?.message ?? 'sem retorno'}`.trim();
  return NextResponse.json({ error: 'Não foi possível salvar.', detalhe }, { status });
}

/**
 * Persiste trechos finais da transcrição AO VIVO (Deepgram Live) em lotes.
 * Autoriza pela sessão (can_modify_recording + gravação em captura) e, como as
 * rotas irmãs, escreve com service role depois disso — assim a gravação não
 * depende de sutilezas de RLS no RETURNING. Cria o transcript (provider
 * deepgram-live) e os falantes sob demanda, no formato que o pipeline já lê.
 */
export async function POST(request: Request) {
  const parsed = validar(await request.json().catch(() => null));
  if (!parsed) return NextResponse.json({ error: 'Requisição inválida.' }, { status: 400 });
  const { recordingId, segments } = parsed;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  const { data: canModify, error: errPerm } = await supabase.rpc('can_modify_recording', {
    rec: recordingId,
  });
  if (errPerm) return falha('permissão', errPerm);
  if (!canModify) return NextResponse.json({ error: 'Não encontrado.' }, { status: 404 });
  const { data: rec } = await supabase
    .from('recordings')
    .select('status')
    .eq('id', recordingId)
    .maybeSingle();
  if (!rec || !['gravando', 'enviando'].includes(rec.status as string)) {
    return NextResponse.json(
      { error: 'Gravação não está em captura.', detalhe: `status ${rec?.status ?? 'nulo'}` },
      { status: 409 },
    );
  }

  // Autorizado: escreve com service role (ou com a sessão, no modo só-código).
  const db = hasServiceRole() ? createAdminClient() : supabase;

  // Transcript da gravação (um só para a sessão ao vivo).
  const { data: existente, error: errBusca } = await db
    .from('transcripts')
    .select('id')
    .eq('recording_id', recordingId)
    .eq('provider', 'deepgram-live')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (errBusca) return falha('buscar transcrição', errBusca);
  let transcriptId = existente?.id as string | undefined;
  if (!transcriptId) {
    const { data: novo, error } = await db
      .from('transcripts')
      .insert({ recording_id: recordingId, language: 'pt-BR', provider: 'deepgram-live' })
      .select('id')
      .single();
    if (error || !novo) return falha('criar transcrição', error);
    transcriptId = novo.id as string;
  }

  // Falantes: "Falante N" por índice do diarizador; cria os que faltam.
  const labels = [...new Set(segments.map((s) => `Falante ${s.speaker + 1}`))];
  const { data: atuais, error: errFal } = await db
    .from('speakers')
    .select('id, label')
    .eq('recording_id', recordingId);
  if (errFal) return falha('buscar falantes', errFal);
  const idPorLabel = new Map<string, string>(
    ((atuais as { id: string; label: string }[] | null) ?? []).map((r) => [r.label, r.id]),
  );
  for (const label of labels) {
    if (idPorLabel.has(label)) continue;
    const { data: sp, error } = await db
      .from('speakers')
      .insert({ recording_id: recordingId, label, track: 'desconhecido' })
      .select('id')
      .single();
    if (error || !sp) return falha('criar falante', error);
    idPorLabel.set(label, sp.id as string);
  }

  const linhas = segments.map((s) => ({
    transcript_id: transcriptId,
    speaker_id: idPorLabel.get(`Falante ${s.speaker + 1}`) ?? null,
    start_ms: Math.round(s.startMs),
    end_ms: Math.round(s.endMs),
    text: s.text,
  }));
  const { error } = await db.from('segments').insert(linhas);
  if (error) return falha('salvar trechos', error);

  return NextResponse.json({ ok: true, salvos: linhas.length });
}
