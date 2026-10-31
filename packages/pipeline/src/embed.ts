import type { PipelinePorts, Providers } from './ports';

/**
 * Etapa de embeddings isolada (busca por significado e "Pergunte", M5), para a
 * gravação AO VIVO: a transcrição chega por /api/live/segmentos e a ata por
 * regenerateSummary, caminhos que não passam pelo processRecording — sem isto a
 * reunião nunca aparecia no "Pergunte". Idempotente (regrava os vetores).
 * Falha vira job 'embed' = error, sem derrubar a ata (status não muda).
 */
export async function embedRecording(
  recordingId: string,
  ports: PipelinePorts,
  providers: Providers,
): Promise<{ trechos: number }> {
  try {
    await ports.upsertJob(recordingId, 'embed', 'running');
    const rows = await ports.listSegmentRows(recordingId);
    if (rows.length > 0) {
      const vetores = await providers.embedding.embed(rows.map((r) => r.text));
      await ports.saveEmbeddings(rows.map((r, i) => ({ segmentId: r.id, embedding: vetores[i]! })));
    }
    await ports.upsertJob(recordingId, 'embed', 'done');
    return { trechos: rows.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await ports.upsertJob(recordingId, 'embed', 'error', message.slice(0, 160));
    throw err;
  }
}
