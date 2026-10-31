import type { SupabaseClient } from '@supabase/supabase-js';

/** Dias que uma gravação fica na lixeira antes do expurgo automático (SPEC 24). */
export const DIAS_LIXEIRA = 30;

/**
 * Apaga de vez uma gravação já na lixeira: objetos do bucket privado `audio`
 * (pasta `{org}/{id}/`, mais os caminhos registrados em recording_chunks) e a
 * linha de `recordings` (as filhas caem por FK em cascata). Roda com service
 * role; quem chama já validou sessão e permissão. Nunca loga conteúdo.
 */
export async function expurgarGravacao(
  admin: SupabaseClient,
  recordingId: string,
): Promise<{ ok: true; arquivos: number } | { ok: false; motivo: string }> {
  const { data: rec } = await admin
    .from('recordings')
    .select('id, organization_id, deleted_at')
    .eq('id', recordingId)
    .maybeSingle();
  if (!rec) return { ok: false, motivo: 'não encontrada' };
  if (!rec.deleted_at) return { ok: false, motivo: 'não está na lixeira' };

  const pasta = `${rec.organization_id}/${rec.id}`;
  const caminhos = new Set<string>();
  const { data: chunks } = await admin
    .from('recording_chunks')
    .select('storage_path')
    .eq('recording_id', rec.id);
  for (const c of (chunks as { storage_path: string }[] | null) ?? []) caminhos.add(c.storage_path);
  const { data: objetos } = await admin.storage.from('audio').list(pasta, { limit: 1000 });
  for (const o of objetos ?? []) if (o.name) caminhos.add(`${pasta}/${o.name}`);

  if (caminhos.size) {
    const { error } = await admin.storage.from('audio').remove([...caminhos]);
    // Áudio não pode sobrar órfão: se o Storage falhar, não apaga a linha.
    if (error) return { ok: false, motivo: 'falha ao apagar o áudio' };
  }

  const { error } = await admin.from('recordings').delete().eq('id', rec.id);
  if (error) return { ok: false, motivo: 'falha ao apagar o registro' };
  return { ok: true, arquivos: caminhos.size };
}

/** Expurga tudo que está na lixeira há mais de `dias` dias. */
export async function expurgarVencidas(
  admin: SupabaseClient,
  dias = DIAS_LIXEIRA,
): Promise<{ expurgadas: number; falhas: number }> {
  const limite = new Date(Date.now() - dias * 86_400_000).toISOString();
  const { data } = await admin
    .from('recordings')
    .select('id')
    .not('deleted_at', 'is', null)
    .lt('deleted_at', limite)
    .limit(200);
  let expurgadas = 0;
  let falhas = 0;
  for (const r of (data as { id: string }[] | null) ?? []) {
    const res = await expurgarGravacao(admin, r.id);
    if (res.ok) expurgadas += 1;
    else falhas += 1;
  }
  return { expurgadas, falhas };
}
