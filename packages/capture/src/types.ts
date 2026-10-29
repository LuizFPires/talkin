/** Bloco de áudio gravado localmente, à espera de upload. */
export type Chunk = {
  index: number;
  localPath: string;
  durationMs: number;
  bytes: number;
};

export type ChunkState = 'pending' | 'uploading' | 'uploaded' | 'failed';

export type QueueItem = Chunk & {
  state: ChunkState;
  attempts: number;
  lastError?: string;
};

/** Momento marcado durante a gravação (SPEC 5). */
export type Moment = {
  atMs: number; // relativo ao início da gravação
  label?: 'decisao' | 'pendencia' | 'valor' | 'atencao';
};

/** Faz o upload de um bloco; lança em falha (rede, servidor). */
export interface ChunkUploader {
  upload(item: Chunk): Promise<void>;
}

/** Persiste a fila entre sessões (offline/retomada). */
export interface QueueStore {
  load(): Promise<QueueItem[]>;
  save(items: QueueItem[]): Promise<void>;
}
