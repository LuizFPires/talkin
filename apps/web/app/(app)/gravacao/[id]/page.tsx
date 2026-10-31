import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { AtaContent, type RecordingStatus } from '@talkin/core';
import { GravacaoView } from '@/components/gravacao-view';
import { GestaoGravacao } from '@/components/gestao-gravacao';
import { ultimoErroJob } from '@/lib/job-erro';

export const dynamic = 'force-dynamic';

type SegmentRow = {
  start_ms: number;
  end_ms: number;
  text: string;
  speaker: { label: string; display_name: string | null } | null;
};

export default async function GravacaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isSupabaseConfigured()) {
    return (
      <div style={{ maxWidth: 820, margin: '0 auto', padding: 24, color: 'var(--text-secondary)' }}>
        Conecte o Supabase para ver a gravação.
      </div>
    );
  }

  const supabase = await createClient();

  // Consultas independentes em paralelo (antes eram 4 RTTs em série).
  const [recRes, templatesRes, summaryRes, transcriptRes, chunkRes] = await Promise.all([
    supabase
      .from('recordings')
      .select('id, title, status, source, duration_s, created_at, template_id')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle(),
    supabase.from('templates').select('id, key, name').order('name', { ascending: true }),
    supabase
      .from('summaries')
      .select('content')
      .eq('recording_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('transcripts')
      .select('id')
      .eq('recording_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('recording_chunks')
      .select('storage_path')
      .eq('recording_id', id)
      .order('index', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  const rec = recRes.data;
  if (!rec) notFound();

  const templates = (templatesRes.data as { id: string; key: string; name: string }[] | null) ?? [];
  const summary = summaryRes.data;
  const transcript = transcriptRes.data;
  const chunk = chunkRes.data;

  // Dependentes (segments precisa do transcript; URL assinada precisa do chunk) — em paralelo.
  const [segmentsRes, signedRes] = await Promise.all([
    transcript
      ? supabase
          .from('segments')
          .select('start_ms, end_ms, text, speaker:speakers(label, display_name)')
          .eq('transcript_id', transcript.id)
          .order('start_ms', { ascending: true })
      : Promise.resolve({ data: null }),
    chunk
      ? supabase.storage.from('audio').createSignedUrl(chunk.storage_path, 3600)
      : Promise.resolve({ data: null }),
  ]);

  const segments = (segmentsRes.data as unknown as SegmentRow[] | null) ?? [];
  const audioUrl = (signedRes.data as { signedUrl?: string } | null)?.signedUrl ?? null;

  const ata = summary?.content ? AtaContent.safeParse(summary.content) : null;
  const erroProcessamento = rec.status === 'erro' ? await ultimoErroJob(supabase, rec.id) : null;

  return (
    <>
      <GravacaoView
        recordingId={rec.id}
        titulo={rec.title?.trim() || 'Sem título'}
        status={rec.status as RecordingStatus}
        criadoEm={rec.created_at}
        ata={ata?.success ? ata.data : null}
        segments={segments.map((s) => ({
          startMs: s.start_ms,
          endMs: s.end_ms,
          text: s.text,
          falante: s.speaker?.display_name || s.speaker?.label || 'Falante',
        }))}
        audioUrl={audioUrl}
        templates={templates}
        templateId={rec.template_id as string | null}
        erroProcessamento={erroProcessamento}
      />
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '0 4px' }}>
        <GestaoGravacao recordingId={rec.id} />
      </div>
    </>
  );
}
