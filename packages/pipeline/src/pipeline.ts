import { AtaContent, type JobStep } from '@talkin/core';
import type { PipelinePorts, Providers } from './ports';

/**
 * Orquestra o pipeline de uma gravação, atualizando o status a cada etapa
 * (ver CLAUDE.md › Pipeline). Cada etapa é reprocessável e, em caso de erro,
 * a gravação fica "erro" com o job marcado.
 */
export async function processRecording(
  recordingId: string,
  ports: PipelinePorts,
  providers: Providers,
): Promise<void> {
  let step: JobStep | null = null;
  try {
    // 1. Preparar áudio (concatenar blocos + normalizar)
    step = 'normalize';
    await ports.upsertJob(recordingId, step, 'running');
    await ports.setStatus(recordingId, 'transcrevendo');
    const audioPath = await ports.prepareAudio(recordingId);
    await ports.upsertJob(recordingId, step, 'done');

    // 2. Transcrever com diarização
    step = 'transcribe';
    await ports.upsertJob(recordingId, step, 'running');
    const transcription = await providers.transcription.transcribe({ audioPath });
    await ports.upsertJob(recordingId, step, 'done');

    // 3. Segmentar (persistir transcript + trechos + falantes)
    step = 'segment';
    await ports.setStatus(recordingId, 'segmentando');
    await ports.upsertJob(recordingId, step, 'running');
    await ports.saveTranscript(recordingId, transcription);
    await ports.upsertJob(recordingId, step, 'done');

    // 4. Gerar a ata + extração estruturada
    step = 'summarize';
    await ports.setStatus(recordingId, 'resumindo');
    await ports.upsertJob(recordingId, step, 'running');
    const template = await ports.getTemplate(recordingId);
    const context = await ports.getContext(recordingId);
    const ata = await providers.ata.generate({
      templateKey: template.key,
      templateSections: template.sections,
      segments: transcription.segments,
      context,
    });
    // Valida a saída da IA antes de salvar (nada inválido entra).
    const content = AtaContent.parse(ata.content);
    const summaryId = await ports.saveSummary(recordingId, template.templateId, content);
    await ports.upsertJob(recordingId, step, 'done');

    // 5. Extração → pendências como itens
    step = 'extract';
    await ports.setStatus(recordingId, 'extraindo');
    await ports.upsertJob(recordingId, step, 'running');
    await ports.saveActionItems(recordingId, summaryId, content);
    await ports.upsertJob(recordingId, step, 'done');

    // 6. Embeddings — no-op no M1 (busca semântica é M5)
    step = 'embed';
    await ports.upsertJob(recordingId, step, 'done');

    // Custos
    await ports.addCost(recordingId, {
      transcriptionCents: transcription.costCents,
      aiCents: ata.costCents,
    });

    await ports.setStatus(recordingId, 'pronto');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Marca a etapa que falhou (permite reprocessar só ela depois).
    // Mensagem curta para não persistir payload da ata em diagnóstico.
    if (step) await ports.upsertJob(recordingId, step, 'error', message.slice(0, 160));
    await ports.setStatus(recordingId, 'erro');
    throw new PipelineError(message, { cause: err });
  }
}

export class PipelineError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'PipelineError';
  }
}
