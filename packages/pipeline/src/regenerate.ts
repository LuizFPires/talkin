import { AtaContent } from '@talkin/core';
import type { PipelinePorts, Providers } from './ports';
import { PipelineError } from './pipeline';

/**
 * Regenera a ata com o modelo atual da gravação, SEM re-transcrever: reaproveita
 * os trechos já salvos (SPEC 9 — troca de modelo regenera a ata). Idempotente.
 */
export async function regenerateSummary(
  recordingId: string,
  ports: PipelinePorts,
  providers: Providers,
): Promise<void> {
  try {
    await ports.setStatus(recordingId, 'resumindo');
    await ports.upsertJob(recordingId, 'summarize', 'running');

    const segments = await ports.getSegments(recordingId);
    if (segments.length === 0) throw new Error('sem transcrição para regenerar');
    const template = await ports.getTemplate(recordingId);
    const context = await ports.getContext(recordingId);

    const ata = await providers.ata.generate({
      templateKey: template.key,
      templateSections: template.sections,
      segments,
      context,
    });
    const content = AtaContent.parse(ata.content);
    const summaryId = await ports.saveSummary(recordingId, template.templateId, content);
    await ports.upsertJob(recordingId, 'summarize', 'done');

    await ports.setStatus(recordingId, 'extraindo');
    await ports.upsertJob(recordingId, 'extract', 'running');
    await ports.saveActionItems(recordingId, summaryId, content);
    await ports.upsertJob(recordingId, 'extract', 'done');
    // Soma o custo de IA da regeneração ao total (sem tocar no de transcrição).
    await ports.addAiCost(recordingId, ata.costCents);
    await ports.setStatus(recordingId, 'pronto');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await ports.upsertJob(recordingId, 'summarize', 'error', message);
    await ports.setStatus(recordingId, 'erro');
    throw new PipelineError(message, { cause: err });
  }
}
