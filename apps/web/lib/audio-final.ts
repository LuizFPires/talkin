import type { SupabaseClient } from '@supabase/supabase-js';
import { extname } from 'node:path';

/**
 * Garante o arquivo de áudio COMPLETO da gravação no bucket `audio`
 * (`{org}/{id}/final.<ext>`). A gravação ao vivo sobe em blocos de 20 s que são
 * fragmentos de um mesmo stream do MediaRecorder; só o primeiro tem cabeçalho,
 * então a junção byte a byte, na ordem, reconstrói o arquivo. Roda com service
 * role depois de quem chama ter autorizado pela sessão. Idempotente: se o
 * final já existe, só devolve o caminho. Com um bloco só, devolve o próprio.
 */
export async function garantirAudioFinal(
  admin: SupabaseClient,
  recordingId: string,
): Promise<{ path: string; contentType: string } | null> {
  const { data: rec } = await admin
    .from('recordings')
    .select('organization_id')
    .eq('id', recordingId)
    .maybeSingle();
  if (!rec) return null;
  const pasta = `${rec.organization_id}/${recordingId}`;
  const prefixo = `${pasta}/`;

  const { data: chunks } = await admin
    .from('recording_chunks')
    .select('index, storage_path')
    .eq('recording_id', recordingId)
    .order('index', { ascending: true });
  const lista = ((chunks as { index: number; storage_path: string }[] | null) ?? []).filter(
    (c) => c.storage_path.startsWith(prefixo) && !c.storage_path.includes('..'),
  );
  if (!lista.length) return null;

  const ext = extname(lista[0]!.storage_path) || '.webm';
  const contentType = tipoPorExtensao(ext);
  if (lista.length === 1) return { path: lista[0]!.storage_path, contentType };

  const finalPath = `${pasta}/final${ext}`;
  const { data: existentes } = await admin.storage.from('audio').list(pasta, { search: 'final' });
  if ((existentes ?? []).some((o) => o.name === `final${ext}`)) {
    return { path: finalPath, contentType };
  }

  const partes: Uint8Array[] = [];
  for (const c of lista) {
    const { data, error } = await admin.storage.from('audio').download(c.storage_path);
    if (error || !data) throw new Error(`falha ao baixar bloco ${c.index}`);
    partes.push(new Uint8Array(await data.arrayBuffer()));
  }
  const total = partes.reduce((a, p) => a + p.byteLength, 0);
  const junto = new Uint8Array(total);
  let pos = 0;
  for (const p of partes) {
    junto.set(p, pos);
    pos += p.byteLength;
  }
  const { error: upErr } = await admin.storage
    .from('audio')
    .upload(finalPath, junto, { contentType, upsert: true });
  if (upErr) throw new Error('falha ao salvar o áudio final');
  return { path: finalPath, contentType };
}

function tipoPorExtensao(ext: string): string {
  switch (ext.toLowerCase()) {
    case '.m4a':
    case '.mp4':
      return 'audio/mp4';
    case '.mp3':
      return 'audio/mpeg';
    case '.wav':
      return 'audio/wav';
    case '.ogg':
      return 'audio/ogg';
    default:
      return 'audio/webm';
  }
}
