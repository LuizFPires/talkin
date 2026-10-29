import { AtaContent } from '@talkin/core';
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
  try {
    // 1. Preparar áudio (concatenar blocos + normalizar)
    await ports.upsertJob(recordingId, 'normalize', 'running');
    await ports.setStatus(recordingId, 'transcrevendo');
    const audioPath = await ports.prepareAudio(recordingId);
    await ports.upsertJob(recordingId, 'normalize', 'done');

    // 2. Transcrever com diarização
    await ports.upsertJob(recordingId, 'transcribe', 'running');
    const transcription = await providers.transcription.transcribe({ audioPath });
    await ports.upsertJob(recordingId, 'transcribe', 'done');

    // 3. Segmentar (persistir transcript + trechos + falantes)
    await ports.setStatus(recordingId, 'segmentando');
    await ports.upsertJob(recordingId, 'segment', 'running');
    await ports.saveTranscript(recordingId, transcription);
    await ports.upsertJob(recordingId, 'segment', 'done');

    // 4. Gerar a ata + extração estruturada
    await ports.setStatus(recordingId, 'resumindo');
    await ports.upsertJob(recordingId, 'summarize', 'running');
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
    await ports.upsertJob(recordingId, 'summarize', 'done');

    // 5. Extração → pendências como itens
    await ports.setStatus(recordingId, 'extraindo');
    await ports.upsertJob(recordingId, 'extract', 'running');
    await ports.saveActionItems(recordingId, summaryId, content);
    await ports.upsertJob(recordingId, 'extract', 'done');

    // 6. Embeddings — no-op no M1 (busca semântica é M5)
    await ports.upsertJob(recordingId, 'embed', 'done');

    // Custos
    await ports.addCost(recordingId, {
      transcriptionCents: transcription.costCents,
      aiCents: ata.costCents,
    });

    await ports.setStatus(recordingId, 'pronto');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
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
