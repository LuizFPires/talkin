import { beforeEach, describe, expect, it } from 'vitest';
import { UploadQueue } from './upload-queue';
import type { Chunk, ChunkUploader, QueueItem, QueueStore } from './types';

function memStore(): QueueStore & { items: QueueItem[] } {
  const store = {
    items: [] as QueueItem[],
    async load() {
      return store.items.map((i) => ({ ...i }));
    },
    async save(items: QueueItem[]) {
      store.items = items.map((i) => ({ ...i }));
    },
  };
  return store;
}

const chunk = (index: number): Chunk => ({
  index,
  localPath: `/tmp/${index}.m4a`,
  durationMs: 45_000,
  bytes: 1000,
});

describe('UploadQueue', () => {
  let store: ReturnType<typeof memStore>;
  beforeEach(() => {
    store = memStore();
  });

  it('sobe todos os blocos quando a rede está ok', async () => {
    const uploader: ChunkUploader = { async upload() {} };
    const q = new UploadQueue(uploader, store);
    await q.add(chunk(0));
    await q.add(chunk(1));
    const r = await q.flush();
    expect(r.uploaded).toBe(2);
    expect(q.allUploaded()).toBe(true);
  });

  it('nunca descarta um bloco que falhou no upload (fica pendente)', async () => {
    let falhas = 2;
    const uploader: ChunkUploader = {
      async upload() {
        if (falhas-- > 0) throw new Error('rede caiu');
      },
    };
    const q = new UploadQueue(uploader, store);
    await q.add(chunk(0));

    await q.flush(); // falha 1
    expect(q.pendingCount()).toBe(1);
    await q.flush(); // falha 2
    expect(q.pendingCount()).toBe(1);
    const r = await q.flush(); // sucesso
    expect(r.uploaded).toBe(1);
    expect(q.allUploaded()).toBe(true);
  });

  it('retoma a fila persistida e reprocessa o que ficou pendente', async () => {
    // Simula app que caiu com 1 bloco pendente já persistido.
    store.items = [
      { ...chunk(0), state: 'uploaded', attempts: 1 },
      { ...chunk(1), state: 'uploading', attempts: 0 }, // estava subindo quando caiu
    ];
    const uploader: ChunkUploader = { async upload() {} };
    const q = new UploadQueue(uploader, store);
    await q.init();
    const r = await q.flush();
    expect(r.uploaded).toBe(1); // só o pendente
    expect(q.allUploaded()).toBe(true);
  });

  it('para de tentar após maxAttempts, mas mantém o bloco na fila', async () => {
    const uploader: ChunkUploader = {
      async upload() {
        throw new Error('servidor fora');
      },
    };
    const q = new UploadQueue(uploader, store, 3);
    await q.add(chunk(0));
    await q.flush();
    await q.flush();
    await q.flush();
    const extra = await q.flush(); // já esgotou; não tenta mais
    expect(extra.uploaded).toBe(0);
    expect(q.pendingCount()).toBe(1); // continua na fila (não descartado)
    expect(q.snapshot()[0]!.state).toBe('failed');
  });
});
