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

  // Consultas independentes em paralelo.
  const [recRes, templatesRes, summaryRes, transcriptRes, chunkRes, podeRes, integRes] =
    await Promise.all([
      supabase
        .from('recordings')
        .select('id, title, status, source, duration_s, created_at, template_id')
        .eq('id', id)
        .is('deleted_at', null)
        .maybeSingle(),
      supabase.from('templates').select('id, key, name').order('name', { ascending: true }),
      supabase
        .from('summaries')
        .select('content, status')
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
      supabase.rpc('can_modify_recording', { rec: id }),
      supabase.from('integrations').select('ioo_webhook_url').maybeSingle(),
    ]);

  const rec = recRes.data;
  if (!rec) notFound();

  const templates = (templatesRes.data as { id: string; key: string; name: string }[] | null) ?? [];
  const summary = summaryRes.data as { content: unknown; status: 'rascunho' | 'revisada' } | null;
  const transcript = transcriptRes.data;
  const chunk = chunkRes.data;

  const segmentsRes = transcript
    ? await supabase
        .from('segments')
        .select('start_ms, end_ms, text, speaker:speakers(label, display_name)')
        .eq('transcript_id', transcript.id)
        .order('start_ms', { ascending: true })
    : { data: null };

  const segments = (segmentsRes.data as unknown as SegmentRow[] | null) ?? [];
  // Rota que monta o arquivo completo (todos os blocos) uma vez e redireciona para
  // uma URL assinada com Range — o player passa a ter a gravação inteira.
  const audioUrl = chunk ? `/api/audio/${rec.id}` : null;

  const ata = summary?.content ? AtaContent.safeParse(summary.content) : null;
  const erroProcessamento = rec.status === 'erro' ? await ultimoErroJob(supabase, rec.id) : null;
  const temWebhook = Boolean(
    (integRes.data as { ioo_webhook_url: string | null } | null)?.ioo_webhook_url,
  );

  return (
    <>
      <GravacaoView
        recordingId={rec.id}
        titulo={rec.title?.trim() || 'Sem título'}
        status={rec.status as RecordingStatus}
        criadoEm={rec.created_at}
        duracaoS={rec.duration_s as number | null}
        ata={ata?.success ? ata.data : null}
        statusAta={ata?.success ? (summary?.status ?? 'rascunho') : null}
        podeEditar={Boolean(podeRes.data)}
        temWebhook={temWebhook}
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
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '0 4px 40px' }}>
        <GestaoGravacao recordingId={rec.id} />
      </div>
    </>
  );
}
