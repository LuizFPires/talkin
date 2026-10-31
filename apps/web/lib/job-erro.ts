import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Último erro registrado pelo pipeline para a gravação (processing_jobs.error).
 * É a mensagem curta do provedor/etapa (ex.: "Anthropic 401", "spawn ffmpeg
 * ENOENT", "sem transcrição para regenerar"), nunca conteúdo de transcrição.
 */
export async function ultimoErroJob(
  db: SupabaseClient,
  recordingId: string,
): Promise<string | null> {
  const { data } = await db
    .from('processing_jobs')
    .select('step, error')
    .eq('recording_id', recordingId)
    .eq('status', 'error')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const row = data as { step?: string; error?: string | null } | null;
  if (!row?.error) return null;
  return `${row.step ?? 'pipeline'}: ${row.error}`.slice(0, 200);
}
