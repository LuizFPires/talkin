import type { Chunk, ChunkUploader, QueueItem, QueueStore } from './types';

/**
 * Fila de upload incremental com retomada e persistência (SPEC 1 / CLAUDE.md).
 * Regra de ouro: um bloco só sai da fila quando o servidor confirma. Nunca descarta.
 */
export class UploadQueue {
  private items: QueueItem[] = [];
  private loaded = false;

  constructor(
    private readonly uploader: ChunkUploader,
    private readonly store: QueueStore,
    private readonly maxAttempts = 5,
  ) {}

  /** Carrega a fila persistida (retomada após queda/fechamento). */
  async init(): Promise<void> {
    this.items = await this.store.load();
    // Blocos que estavam "uploading" quando o app caiu voltam a pendentes.
    for (const it of this.items) {
      if (it.state === 'uploading') it.state = 'pending';
    }
    this.loaded = true;
  }

  /** Enfileira um bloco novo e persiste imediatamente (não perder áudio). */
  async add(chunk: Chunk): Promise<void> {
    if (!this.loaded) await this.init();
    if (this.items.some((i) => i.index === chunk.index)) return; // idempotente
    this.items.push({ ...chunk, state: 'pending', attempts: 0 });
    await this.store.save(this.items);
  }

  /** Tenta subir todos os pendentes. Falhas ficam na fila para a próxima vez. */
  async flush(): Promise<{ uploaded: number; pending: number }> {
    if (!this.loaded) await this.init();
    let uploaded = 0;
    for (const item of this.items) {
      if (item.state === 'uploaded') continue;
      if (item.attempts >= this.maxAttempts && item.state === 'failed') continue;
      item.state = 'uploading';
      try {
        await this.uploader.upload(item);
        item.state = 'uploaded';
        uploaded += 1;
      } catch (err) {
        item.attempts += 1;
        item.lastError = err instanceof Error ? err.message : String(err);
        // Esgotou as tentativas → 'failed' (continua na fila, não descarta).
        item.state = item.attempts >= this.maxAttempts ? 'failed' : 'pending';
      }
      await this.store.save(this.items);
    }
    return { uploaded, pending: this.pendingCount() };
  }

  /** Blocos ainda não confirmados pelo servidor. */
  pendingCount(): number {
    return this.items.filter((i) => i.state !== 'uploaded').length;
  }

  allUploaded(): boolean {
    return this.items.length > 0 && this.pendingCount() === 0;
  }

  snapshot(): readonly QueueItem[] {
    return this.items;
  }
}
