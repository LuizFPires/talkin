import { NextResponse } from 'next/server';
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

/**
 * Persiste trechos finais da transcrição AO VIVO (Deepgram Live) em lotes.
 * Usa a sessão do usuário: a RLS (can_modify_recording) garante que só o dono
 * grava. Cria o transcript (provider deepgram-live) e os falantes sob demanda,
 * no formato que o pipeline já lê (getSegments → regenerateSummary).
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

  // Espelha as rotas irmãs: autoriza explicitamente e só aceita gravação em captura
  // (a RLS já protege, mas isso dá 404/409 claros e evita anexar trechos a uma ata pronta).
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

  // Transcript da gravação (um só para a sessão ao vivo).
  const { data: existente } = await supabase
    .from('transcripts')
    .select('id')
    .eq('recording_id', recordingId)
    .eq('provider', 'deepgram-live')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  let transcriptId = existente?.id as string | undefined;
  if (!transcriptId) {
    const { data: novo, error } = await supabase
      .from('transcripts')
      .insert({ recording_id: recordingId, language: 'pt-BR', provider: 'deepgram-live' })
      .select('id')
      .single();
    if (error || !novo) return NextResponse.json({ error: 'Não encontrado.' }, { status: 404 });
    transcriptId = novo.id as string;
  }

  // Falantes: "Falante N" por índice do diarizador; cria os que faltam.
  const labels = [...new Set(segments.map((s) => `Falante ${s.speaker + 1}`))];
  const { data: atuais } = await supabase
    .from('speakers')
    .select('id, label')
    .eq('recording_id', recordingId);
  const idPorLabel = new Map<string, string>(
    ((atuais as { id: string; label: string }[] | null) ?? []).map((r) => [r.label, r.id]),
  );
  for (const label of labels) {
    if (idPorLabel.has(label)) continue;
    const { data: sp, error } = await supabase
      .from('speakers')
      .insert({ recording_id: recordingId, label, track: 'desconhecido' })
      .select('id')
      .single();
    if (error || !sp) return NextResponse.json({ error: 'Não encontrado.' }, { status: 404 });
    idPorLabel.set(label, sp.id as string);
  }

  const linhas = segments.map((s) => ({
    transcript_id: transcriptId,
    speaker_id: idPorLabel.get(`Falante ${s.speaker + 1}`) ?? null,
    start_ms: Math.round(s.startMs),
    end_ms: Math.round(s.endMs),
    text: s.text,
  }));
  const { error } = await supabase.from('segments').insert(linhas);
  if (error) return NextResponse.json({ error: 'Não foi possível salvar.' }, { status: 400 });

  return NextResponse.json({ ok: true, salvos: linhas.length });
}
