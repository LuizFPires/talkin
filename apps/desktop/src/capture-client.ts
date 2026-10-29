import {
  UploadQueue,
  type Chunk,
  type ChunkUploader,
  type QueueItem,
  type QueueStore,
} from '@talkin/capture';
import { readFile } from '@tauri-apps/plugin-fs';
import { supabase } from './supabase';

/** Persistência da fila na janela do desktop (retomada ao reabrir). */
function queueStore(recordingId: string): QueueStore {
  const key = `talkin:queue:${recordingId}`;
  return {
    async load() {
      try {
        const raw = localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as QueueItem[]) : [];
      } catch {
        return [];
      }
    },
    async save(items) {
      localStorage.setItem(key, JSON.stringify(items));
    },
  };
}

/** Upload por faixa: {org}/{recordingId}/{eu|outros}-{index}.m4a */
function uploader(organizationId: string, recordingId: string): ChunkUploader {
  return {
    async upload(item: Chunk) {
      const track = item.track ?? 'eu';
      const path = `${organizationId}/${recordingId}/${track}-${String(item.index).padStart(4, '0')}.m4a`;
      const bytes = await readFile(item.localPath); // lê o arquivo que o Rust gravou
      const { error } = await supabase.storage
        .from('audio')
        .upload(path, bytes, { contentType: 'audio/m4a', upsert: true });
      if (error) throw new Error(error.message);
      const { error: insErr } = await supabase.from('recording_chunks').upsert(
        {
          recording_id: recordingId,
          index: item.index,
          storage_path: path,
          duration_s: Math.round(item.durationMs / 1000),
          bytes: item.bytes,
          uploaded_at: new Date().toISOString(),
        },
        { onConflict: 'recording_id,index', ignoreDuplicates: true },
      );
      if (insErr) throw new Error(insErr.message);
    },
  };
}

/** Fila de upload de uma gravação do desktop (reusa o núcleo testado do mobile). */
export function createUploadQueue(organizationId: string, recordingId: string): UploadQueue {
  return new UploadQueue(uploader(organizationId, recordingId), queueStore(recordingId));
}
