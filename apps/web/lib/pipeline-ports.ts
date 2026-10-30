import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, extname } from 'node:path';
import type { PipelinePorts } from '@talkin/pipeline';
import { concatAndNormalize } from '@talkin/pipeline';
import type { AtaContent, TranscriptionResult } from '@talkin/core';
import { createAdminClient } from './supabase/admin';
import { toVectorLiteral } from './pergunte';

/** Portas do pipeline ligadas ao Supabase (service role, ignora RLS). */
export function createSupabasePorts(): PipelinePorts {
  const db = createAdminClient();

  return {
    async setStatus(recordingId, status) {
      await db.from('recordings').update({ status }).eq('id', recordingId);
    },

    async upsertJob(recordingId, step, status, error) {
      await db.from('processing_jobs').insert({
        recording_id: recordingId,
        step,
        status,
        error: error ?? null,
        updated_at: new Date().toISOString(),
      });
    },

    async prepareAudio(recordingId) {
      // Prefixo exigido do caminho (defesa em profundidade contra path traversal):
      // o worker usa service role, então não confia no storage_path armazenado.
      const { data: rec } = await db
        .from('recordings')
        .select('organization_id')
        .eq('id', recordingId)
        .single();
      if (!rec) throw new Error('gravação não encontrada');
      const prefix = `${rec.organization_id}/${recordingId}/`;

      const { data: chunks } = await db
        .from('recording_chunks')
        .select('index, storage_path')
        .eq('recording_id', recordingId)
        .order('index', { ascending: true });
      if (!chunks?.length) throw new Error('sem blocos de áudio');

      const dir = await mkdtemp(join(tmpdir(), 'talkin-dl-'));
      const localPaths: string[] = [];
      for (const chunk of chunks) {
        const p = chunk.storage_path;
        if (!p.startsWith(prefix) || p.includes('..') || /[\\%]/.test(p)) {
          throw new Error('caminho de bloco inválido');
        }
        const { data, error } = await db.storage.from('audio').download(p);
        if (error || !data) throw new Error(`falha ao baixar bloco ${chunk.index}`);
        // Nome gerado pelo worker (não confia no storage_path).
        const local = join(
          dir,
          `chunk-${String(chunk.index).padStart(4, '0')}${extname(chunk.storage_path) || '.webm'}`,
        );
        await writeFile(local, Buffer.from(await data.arrayBuffer()));
        localPaths.push(local);
      }
      return localPaths.length === 1 ? localPaths[0]! : concatAndNormalize(localPaths);
    },

    async saveTranscript(recordingId, result: TranscriptionResult) {
      // Idempotente: limpa transcrição/falantes anteriores (reprocesso não duplica).
      // segments cai em cascata com transcripts; speakers são por gravação.
      await db.from('transcripts').delete().eq('recording_id', recordingId);
      await db.from('speakers').delete().eq('recording_id', recordingId);

      const { data: transcript, error } = await db
        .from('transcripts')
        .insert({ recording_id: recordingId, language: result.language, provider: result.provider })
        .select('id')
        .single();
      if (error || !transcript) throw new Error('falha ao salvar transcrição');

      const labels = [...new Set(result.segments.map((s) => s.speakerLabel))];
      const speakerIdByLabel: Record<string, string> = {};
      for (const label of labels) {
        const track =
          result.segments.find((s) => s.speakerLabel === label)?.track ?? 'desconhecido';
        const { data: sp } = await db
          .from('speakers')
          .insert({ recording_id: recordingId, label, track })
          .select('id')
          .single();
        if (sp) speakerIdByLabel[label] = sp.id;
      }

      if (result.segments.length) {
        await db.from('segments').insert(
          result.segments.map((s) => ({
            transcript_id: transcript.id,
            speaker_id: speakerIdByLabel[s.speakerLabel] ?? null,
            start_ms: s.startMs,
            end_ms: s.endMs,
            text: s.text,
          })),
        );
      }
      return { transcriptId: transcript.id, speakerIdByLabel };
    },

    async getTemplate(recordingId) {
      const { data: rec } = await db
        .from('recordings')
        .select('template_id')
        .eq('id', recordingId)
        .single();
      const query = rec?.template_id
        ? db.from('templates').select('id, key, sections').eq('id', rec.template_id)
        : db
            .from('templates')
            .select('id, key, sections')
            .is('organization_id', null)
            .eq('key', 'generico');
      const { data: tpl } = await query.maybeSingle();
      return {
        templateId: tpl?.id ?? null,
        key: tpl?.key ?? 'generico',
        sections: (tpl?.sections as { key: string; title: string; instructions?: string }[]) ?? [
          { key: 'resumo', title: 'Resumo' },
        ],
      };
    },

    async getSegments(recordingId) {
      const { data: transcript } = await db
        .from('transcripts')
        .select('id')
        .eq('recording_id', recordingId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!transcript) return [];
      const { data } = await db
        .from('segments')
        .select('start_ms, end_ms, text, speaker:speakers(label, track)')
        .eq('transcript_id', transcript.id)
        .order('start_ms', { ascending: true });
      type Row = {
        start_ms: number;
        end_ms: number;
        text: string;
        speaker: { label: string; track: 'eu' | 'outros' | 'desconhecido' } | null;
      };
      return ((data as unknown as Row[] | null) ?? []).map((s) => ({
        speakerLabel: s.speaker?.label ?? 'Falante',
        track: s.speaker?.track ?? 'desconhecido',
        startMs: s.start_ms,
        endMs: s.end_ms,
        text: s.text,
      }));
    },

    async getContext(recordingId) {
      const { data: rec } = await db
        .from('recordings')
        .select('project_id, projects(name)')
        .eq('id', recordingId)
        .single();
      const projectName = (rec?.projects as { name?: string } | null)?.name;
      return projectName ? { projectName } : undefined;
    },

    async saveSummary(recordingId, templateId, content: AtaContent) {
      // Idempotente: substitui a ata anterior (reprocesso não acumula).
      await db.from('summaries').delete().eq('recording_id', recordingId);
      const { data, error } = await db
        .from('summaries')
        .insert({ recording_id: recordingId, template_id: templateId, status: 'rascunho', content })
        .select('id')
        .single();
      if (error || !data) throw new Error('falha ao salvar ata');
      return data.id;
    },

    async saveActionItems(recordingId, summaryId, content: AtaContent) {
      // Idempotente: limpa pendências anteriores da gravação.
      await db.from('action_items').delete().eq('recording_id', recordingId);
      const pend = content.extracao.pendencias;
      if (!pend.length) return;
      await db.from('action_items').insert(
        pend.map((p) => ({
          recording_id: recordingId,
          summary_id: summaryId,
          text: p.texto,
          due_date: p.prazo,
          minute_ms: p.minuto_ms,
          status: 'aberta' as const,
        })),
      );
    },

    async addCost(recordingId, cost) {
      await db
        .from('recordings')
        .update({
          cost_transcription_cents: cost.transcriptionCents,
          cost_ai_cents: cost.aiCents,
        })
        .eq('id', recordingId);
    },

    async listSegmentRows(recordingId) {
      const { data: transcript } = await db
        .from('transcripts')
        .select('id')
        .eq('recording_id', recordingId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!transcript) return [];
      const { data } = await db
        .from('segments')
        .select('id, text')
        .eq('transcript_id', transcript.id)
        .order('start_ms', { ascending: true });
      return ((data as { id: string; text: string }[] | null) ?? []).map((r) => ({
        id: r.id,
        text: r.text,
      }));
    },

    async saveEmbeddings(items) {
      if (!items.length) return;
      // Lote: 1 RPC com unnest() em vez de N updates (etapa embed era a mais lenta).
      // pgvector espera o literal '[...]', igual ao caminho de leitura.
      const ids = items.map((it) => it.segmentId);
      const embs = items.map((it) => toVectorLiteral(it.embedding));
      const { error } = await db.rpc('set_segment_embeddings', { p_ids: ids, p_embs: embs });
      if (error) throw new Error(`falha ao salvar embeddings: ${error.message}`);
    },

    async addAiCost(recordingId, cents) {
      // Incremento atômico (evita corrida de read-modify-write); guard permite via service role.
      const { error } = await db.rpc('increment_ai_cost', {
        p_recording: recordingId,
        p_cents: cents,
      });
      if (error) throw new Error(`falha ao somar custo de IA: ${error.message}`);
    },
  };
}
