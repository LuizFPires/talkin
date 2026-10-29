import { NextResponse } from 'next/server';
import { selectProviders } from '@talkin/pipeline';
import { createClient } from '@/lib/supabase/server';
import { toVectorLiteral } from '@/lib/pergunte';

export const maxDuration = 60;

type Filtros = {
  obraId?: string | null;
  participante?: string | null;
  plataforma?: string | null;
  tipoKey?: string | null;
  periodo?: { from?: string; to?: string } | null;
};
type Grupo = {
  recordingId: string;
  title: string;
  source: string;
  date: string;
  trechos: { startMs: number; text: string }[];
};

/** Busca livre (SPEC 16): filtra as reuniões e, se houver tema, traz trechos. */
export async function POST(request: Request) {
  const { tema, modo, filtros } = (await request.json().catch(() => ({}))) as {
    tema?: string;
    modo?: 'significado' | 'exata';
    filtros?: Filtros;
  };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  // Reuniões candidatas (RLS aplica visibilidade) + filtros estruturados.
  let q = supabase
    .from('recordings')
    .select('id, title, source, created_at, template_id, templates(key)')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(100);
  if (filtros?.obraId) q = q.eq('project_id', filtros.obraId);
  if (filtros?.plataforma) q = q.eq('source', filtros.plataforma);
  if (filtros?.periodo?.from) q = q.gte('created_at', filtros.periodo.from);
  if (filtros?.periodo?.to) q = q.lte('created_at', `${filtros.periodo.to}T23:59:59`);
  const { data: recs } = await q;
  let candidatos =
    (recs as
      | {
          id: string;
          title: string;
          source: string;
          created_at: string;
          templates: { key: string } | null;
        }[]
      | null) ?? [];
  if (filtros?.tipoKey) candidatos = candidatos.filter((r) => r.templates?.key === filtros.tipoKey);

  // Filtro por participante: restringe às gravações com um falante daquele nome.
  if (filtros?.participante) {
    const { data: sp } = await supabase
      .from('speakers')
      .select('recording_id')
      .eq('display_name', filtros.participante);
    const comParticipante = new Set(
      ((sp as { recording_id: string }[] | null) ?? []).map((s) => s.recording_id),
    );
    candidatos = candidatos.filter((r) => comParticipante.has(r.id));
  }

  const byId = new Map(candidatos.map((r) => [r.id, r]));
  const grupos = new Map<string, Grupo>();
  const add = (rid: string) => {
    const r = byId.get(rid);
    if (r && !grupos.has(rid)) {
      grupos.set(rid, {
        recordingId: rid,
        title: r.title,
        source: r.source,
        date: r.created_at,
        trechos: [],
      });
    }
    return grupos.get(rid);
  };

  const temaLimpo = (tema ?? '').trim();
  if (!temaLimpo) {
    // Sem tema: só as reuniões que batem com os filtros.
    for (const r of candidatos) add(r.id);
    return NextResponse.json({ grupos: [...grupos.values()] });
  }

  if (modo === 'exata') {
    const { data: ts } = await supabase
      .from('transcripts')
      .select('id, recording_id')
      .in(
        'recording_id',
        candidatos.map((r) => r.id),
      );
    const transcripts = (ts as { id: string; recording_id: string }[] | null) ?? [];
    const recByTranscript = new Map(transcripts.map((t) => [t.id, t.recording_id]));
    if (transcripts.length) {
      const { data: segs } = await supabase
        .from('segments')
        .select('transcript_id, start_ms, text')
        .in(
          'transcript_id',
          transcripts.map((t) => t.id),
        )
        .ilike('text', `%${temaLimpo.replace(/[\\%_]/g, '\\$&')}%`)
        .limit(200);
      for (const s of (segs as
        | { transcript_id: string; start_ms: number; text: string }[]
        | null) ?? []) {
        const rid = recByTranscript.get(s.transcript_id);
        const g = rid ? add(rid) : undefined;
        if (g && g.trechos.length < 3) g.trechos.push({ startMs: s.start_ms, text: s.text });
      }
    }
  } else {
    // Por significado: embeddings + match_segments, restrito aos candidatos.
    const [vec] = await selectProviders().embedding.embed([temaLimpo]);
    const { data } = await supabase.rpc('match_segments', {
      query_embedding: toVectorLiteral(vec!),
      match_count: 60,
      p_recording: null,
      // Restringe aos candidatos no SQL (recall não é limitado pelo top-N global).
      p_recordings: candidatos.map((r) => r.id),
    });
    for (const t of (data as { recording_id: string; start_ms: number; text: string }[] | null) ??
      []) {
      if (!byId.has(t.recording_id)) continue;
      const g = add(t.recording_id);
      if (g && g.trechos.length < 3) g.trechos.push({ startMs: t.start_ms, text: t.text });
    }
  }

  // Ordena por número de menções (trechos) desc.
  const ordenados = [...grupos.values()].sort((a, b) => b.trechos.length - a.trechos.length);
  return NextResponse.json({ grupos: ordenados });
}
