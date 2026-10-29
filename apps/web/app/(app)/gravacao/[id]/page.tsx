import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { AtaContent, type RecordingStatus } from '@talkin/core';
import { GravacaoView } from '@/components/gravacao-view';

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
  const { data: rec } = await supabase
    .from('recordings')
    .select('id, title, status, source, duration_s, created_at')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!rec) notFound();

  const { data: summary } = await supabase
    .from('summaries')
    .select('content')
    .eq('recording_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: transcript } = await supabase
    .from('transcripts')
    .select('id')
    .eq('recording_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let segments: SegmentRow[] = [];
  if (transcript) {
    const { data } = await supabase
      .from('segments')
      .select('start_ms, end_ms, text, speaker:speakers(label, display_name)')
      .eq('transcript_id', transcript.id)
      .order('start_ms', { ascending: true });
    segments = (data as unknown as SegmentRow[] | null) ?? [];
  }

  const { data: chunk } = await supabase
    .from('recording_chunks')
    .select('storage_path')
    .eq('recording_id', id)
    .order('index', { ascending: true })
    .limit(1)
    .maybeSingle();
  let audioUrl: string | null = null;
  if (chunk) {
    const { data: signed } = await supabase.storage
      .from('audio')
      .createSignedUrl(chunk.storage_path, 3600);
    audioUrl = signed?.signedUrl ?? null;
  }

  const ata = summary?.content ? AtaContent.safeParse(summary.content) : null;

  return (
    <GravacaoView
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
    />
  );
}
