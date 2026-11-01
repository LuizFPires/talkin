import type { SupabaseClient } from '@supabase/supabase-js';
import { custoRealBotCents, formatDateBR, type BotProvider } from '@talkin/core';
import { processRecording, selectProviders } from '@talkin/pipeline';
import { createSupabasePorts } from '@/lib/pipeline-ports';
import { BOT_CENTS_PER_HOUR } from '@/lib/bot';

/** Teto do arquivo de áudio do bot (4 h de mp3 a 128 kbps ≈ 230 MB). */
const MAX_BYTES = 400 * 1024 * 1024;

type LinhaBot = {
  id: string;
  organization_id: string;
  platform: 'meet' | 'teams' | 'zoom';
  meeting_url: string;
  provider_bot_id: string;
  recording_id: string | null;
  created_by: string;
};

const NOME_PLATAFORMA = { meet: 'Google Meet', teams: 'Teams', zoom: 'Zoom' } as const;

/**
 * Depois que o bot sai da reunião: baixa o áudio do provedor, guarda como um
 * único bloco no Storage (mesma pasta/convenção do gravador), cria a gravação
 * na biblioteca e roda o pipeline (transcrição → ata). Idempotente: o
 * `recording_id` do bot é gravado com compare-and-set; o segundo webhook da
 * mesma reunião não cria gravação duplicada.
 */
export async function ingerirGravacaoDoBot(
  admin: SupabaseClient,
  provider: BotProvider,
  bot: LinhaBot,
): Promise<{ recordingId: string } | { pulado: string }> {
  if (bot.recording_id) return { pulado: 'já ingerida' };

  const midia = await provider.fetchRecording(bot.provider_bot_id);
  if (!midia) return { pulado: 'mídia ainda não disponível' };

  // Cria a gravação primeiro e reivindica o bot (CAS) — só um worker segue.
  const titulo = `Reunião no ${NOME_PLATAFORMA[bot.platform]} · ${formatDateBR(new Date().toISOString())}`;
  const { data: rec, error: recErr } = await admin
    .from('recordings')
    .insert({
      organization_id: bot.organization_id,
      created_by: bot.created_by,
      title: titulo,
      source: bot.platform,
      status: 'enviando',
      recorded_at: midia.startedAt,
    })
    .select('id')
    .single();
  if (recErr || !rec) throw new Error('falha ao criar a gravação do bot');

  const { data: reivindicado } = await admin
    .from('meeting_bots')
    .update({ recording_id: rec.id })
    .eq('id', bot.id)
    .is('recording_id', null)
    .select('id')
    .maybeSingle();
  if (!reivindicado) {
    await admin.from('recordings').delete().eq('id', rec.id);
    return { pulado: 'outro worker já ingeriu' };
  }

  try {
    // Baixa a mídia (URL temporária, host já validado em extrairMidiaRecall).
    const res = await fetch(midia.downloadUrl);
    if (!res.ok) throw new Error(`download ${res.status}`);
    const tamanho = Number(res.headers.get('content-length') ?? '0');
    if (tamanho > MAX_BYTES) throw new Error('áudio acima do limite');
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.byteLength === 0) throw new Error('áudio vazio');
    if (bytes.byteLength > MAX_BYTES) throw new Error('áudio acima do limite');

    const ext = midia.formato;
    const contentType = ext === 'mp3' ? 'audio/mpeg' : 'video/mp4';
    const path = `${bot.organization_id}/${rec.id}/0000.${ext}`;
    const { error: upErr } = await admin.storage
      .from('audio')
      .upload(path, bytes, { contentType, upsert: true });
    if (upErr) throw new Error('falha ao guardar o áudio');
    const { error: chErr } = await admin.from('recording_chunks').insert({
      recording_id: rec.id,
      index: 0,
      storage_path: path,
      bytes: bytes.byteLength,
      uploaded_at: new Date().toISOString(),
    });
    if (chErr) throw new Error('falha ao registrar o bloco');

    // Custo real do bot pelo tempo em chamada; duração da gravação.
    const custo = custoRealBotCents(midia.startedAt, midia.completedAt, BOT_CENTS_PER_HOUR);
    const duracaoS =
      midia.startedAt && midia.completedAt
        ? Math.max(
            1,
            Math.round(
              (new Date(midia.completedAt).getTime() - new Date(midia.startedAt).getTime()) / 1000,
            ),
          )
        : null;
    if (custo !== null)
      await admin.from('meeting_bots').update({ cost_cents: custo }).eq('id', bot.id);
    if (duracaoS) await admin.from('recordings').update({ duration_s: duracaoS }).eq('id', rec.id);
  } catch (err) {
    await admin
      .from('recordings')
      .update({ status: 'erro', error: 'bot: ' + (err instanceof Error ? err.message : 'falha') })
      .eq('id', rec.id);
    throw err;
  }

  // Pipeline (1 bloco → sem ffmpeg): transcrição com diarização → ata → embeddings.
  const { data: claimed } = await admin
    .from('recordings')
    .update({ status: 'transcrevendo' })
    .eq('id', rec.id)
    .in('status', ['enviando', 'erro'])
    .select('id')
    .maybeSingle();
  if (claimed) {
    await processRecording(rec.id, createSupabasePorts(), selectProviders()).catch(() => {
      // processRecording já registrou o job e marcou 'erro'; a tela mostra o motivo.
    });
  }
  return { recordingId: rec.id };
}
