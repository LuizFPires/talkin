import type { Chunk, ChunkUploader } from '@talkin/capture';
import { supabase } from './supabase';

/**
 * Sobe um bloco para o Storage da empresa: {org}/{recordingId}/{index}.m4a
 * Idempotente: o upload usa upsert e o insert do bloco usa onConflict (reenvio
 * após queda não quebra na constraint unique(recording_id, index)).
 */
export function chunkUploader(organizationId: string, recordingId: string): ChunkUploader {
  return {
    async upload(item: Chunk) {
      const path = `${organizationId}/${recordingId}/${String(item.index).padStart(4, '0')}.m4a`;
      const res = await fetch(item.localPath);
      const bytes = await res.arrayBuffer();
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
